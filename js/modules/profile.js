/**
 * SOVEREIGN // AEGIS — Personal Defense Profile (nav: 11 // Personal Defense)
 *
 * Thin view layer over the pure scoring module js/profile.js and the IndexedDB store
 * js/profilestore.js, per DESIGN-personal-defense-profile.md slice 1. All scoring and
 * salience decisions live in the pure module; this file fetches data, renders the four
 * surfaces (boundary ack → inventory → practice map → observation log → atlas), and
 * saves raw records. Nothing derived is ever stored — the map is recomputed on render.
 *
 * SAFETY BOUNDARIES ENFORCED HERE
 * -------------------------------
 * - No field collects a third party's name; observation text describes the operator's
 *   own reaction.
 * - Bands and conditions only: no type, no percentile, no "manipulability" number.
 * - The ack gate must be passed before the inventory appears, and the support card is
 *   static keyword routing (Profile.needsSupport) — never a danger assessment.
 * - Every interpolated string passes through esc() from js/security.js.
 */

import { esc } from '../security.js';
import { ProfileStore, newRecordsSince, backupReminderDue, verifyBackup } from '../profilestore.js';
import { compute, latestRetake, buildGuide, needsSupport } from '../profile.js';
import { DESTINATIONS } from '../nextDrillPanel.js';

const LENS_ORDER = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'emotional-stability', 'fairness-reciprocity'];
const LENS_LABELS = {
  openness: 'Openness', conscientiousness: 'Conscientiousness', extraversion: 'Extraversion',
  agreeableness: 'Agreeableness', 'emotional-stability': 'Emotional stability', 'fairness-reciprocity': 'Fairness & reciprocity'
};
const SCOPE_LABELS = { online: 'online', work: 'work', close: 'close relationships', money: 'money', health: 'health', civic: 'civic' };

/* Backup re-export reminder — the card prompts a re-export after N days with
 * new records since the last export. The clock lives in localStorage (it is a
 * reminder, not the data itself, so it does not belong in the IndexedDB stores
 * that export/import move). */
const BACKUP_REMINDER_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const LS_LAST_EXPORT = 'sovereign-aegis.profile.lastExport';
const LS_REMINDER_DAYS = 'sovereign-aegis.profile.reminderDays';
const LS_RESTORED_NEWER = 'sovereign-aegis.profile.restoredNewer';
const CONF_LABELS = { 1: 'guess', 2: 'mixed', 3: 'confident' };

export const DefenseProfile = {
  id: 'defense',
  _app: null,
  _items: [],
  _guides: null,
  _notes: { cards: [] },
  _skills: [],
  _responses: [],
  _observations: [],
  _backupBound: false,

  async init(app) {
    this._app = app;
    await this._loadData();
    await this._loadStore();
    // Seed the nav badge before the view is ever mounted — the backup clock
    // must be readable from every tab, not only from inside this view.
    this._refreshReminder();
    console.log('[DefenseProfile] Initialized.');
  },

  onMount() {
    this.render();
  },

  async _loadData() {
    try {
      const [items, guides, notes, skills] = await Promise.all([
        fetch('./data/profile-items.json').catch(() => fetch('data/profile-items.json')).then((r) => r.json()),
        fetch('./data/profile-guides.json').catch(() => fetch('data/profile-guides.json')).then((r) => r.json()),
        fetch('./data/framework-notes.json').catch(() => fetch('data/framework-notes.json')).then((r) => r.json()),
        fetch('./data/skills.json').catch(() => fetch('data/skills.json')).then((r) => r.json())
      ]);
      this._items = Array.isArray(items?.items) ? items.items : [];
      this._guides = guides || null;
      this._notes = notes || { cards: [] };
      this._skills = Array.isArray(skills) ? skills : [];
    } catch (err) {
      console.error('[DefenseProfile] Data load error:', err);
    }
  },

  async _loadStore() {
    this._responses = await ProfileStore.readResponses();
    this._observations = await ProfileStore.readObservations();
  },

  /* ------------------------------------------------------------- rendering */

  render() {
    this._renderAck();
    this._renderSupport();
    this._renderInventory();
    this._renderMap();
    this._renderLog();
    this._renderAtlas();
    this._bindBackup();
    this._refreshBackupCount();
    this._refreshReminder();
  },

  _acknowledged() {
    return this._app && this._app.store && this._app.store.get('profile.acknowledged', false) === true;
  },

  _renderAck() {
    const host = document.getElementById('profile-ack');
    if (!host) return;
    if (this._acknowledged()) {
      host.innerHTML = '';
      return;
    }
    host.innerHTML =
      '<div class="card card-bronze card-granite-inset" style="margin-bottom:var(--space-6);">' +
        '<div class="status-label" style="color:var(--bronze-primary,#d2a64d);">READ THIS FIRST — THE THREE RULES</div>' +
        '<ul style="margin:12px 0 0 0;padding-left:20px;line-height:1.7;font-size:0.85rem;color:var(--parchment-bright,#ece7de);">' +
          '<li><strong>Lens, not identity.</strong> These questions describe this reflection, not what you are. Bands change; you do not need to.</li>' +
          '<li><strong>Situations beat types.</strong> Pressure contexts are conditions anyone\'s judgment narrows under — not verdicts about you.</li>' +
          '<li><strong>Self-profiling only.</strong> Nothing here assesses another person, and nothing here is a diagnosis. No score, no percentile, no type.</li>' +
        '</ul>' +
        '<p class="body-muted" style="margin:12px 0 0 0;">Answers and observations stay on this device. They never sync — by design.</p>' +
        '<button class="btn btn-primary" id="btn-profile-ack" style="margin-top:16px;">I understand — begin the inventory</button>' +
      '</div>';
    const btn = document.getElementById('btn-profile-ack');
    if (btn) {
      btn.addEventListener('click', () => {
        this._app.store.set('profile.acknowledged', true);
        this.render(); // every surface was gated on the ack; now all of them render
      });
    }
  },

  /* --------------------------------------------------- support card (spec 8) */

  /**
   * High-risk disclosure path, DESIGN-personal-defense-profile.md section 8: whenever ANY
   * stored observation carries a coercive-control marker (static keyword match on the
   * operator's own text — never a danger assessment), a persistent support card is shown
   * here, and its route button jumps to the Dark Triad guide's support paths in the
   * Resistance Library. Recomputed from the observation log on every render; nothing is
   * stored about this state.
   */
  _hasSupportSignal() {
    const card = this._guides && this._guides.supportCard;
    if (!card) return false;
    return this._observations.some((o) => needsSupport(o, card));
  },

  _renderSupport() {
    const host = document.getElementById('profile-support');
    if (!host) return;
    if (!this._acknowledged() || !this._hasSupportSignal()) {
      host.innerHTML = '';
      return;
    }
    const card = this._guides.supportCard;
    host.innerHTML =
      '<div class="card card-danger" style="margin-bottom:var(--space-6);border-left:4px solid var(--disinfo-crimson,#f87171);">' +
        '<div class="status-label" style="color:var(--disinfo-crimson,#f87171);">' + esc(card.title) + '</div>' +
        '<p class="body-muted" style="margin:10px 0 0 0;">' + esc(card.body) + '</p>' +
        '<p class="body-muted" style="margin:10px 0 0 0;font-size:0.75rem;">' +
          'This card is a static route: the full support paths — one trusted person named in advance, professional and emergency resources — live in the Dark Triad behavior-recognition guide. Nothing here is a danger assessment; the app does not perform one.' +
        '</p>' +
        '<button class="btn btn-outline btn-sm" id="btn-profile-support-route" style="margin-top:14px;">SUPPORT PATHS → DARK TRIAD GUIDE</button>' +
      '</div>';
    const btn = document.getElementById('btn-profile-support-route');
    if (btn) btn.addEventListener('click', () => this._openSupportRoutes());
  },

  _openSupportRoutes() {
    if (!this._app) return;
    this._app.switchTab('infowar', 'reading');
    const lens = this._app.modules && this._app.modules['lens'];
    if (lens && typeof lens.openGuide === 'function' && lens.openGuide('lens.darktriad')) {
      // The reader renders compiled blocks with no element ids; the support heading is
      // unique, so locating it by its text is deterministic.
      setTimeout(() => {
        const body = document.getElementById('lens-reader-body');
        if (!body) return;
        const heads = body.querySelectorAll('h2, h3, h4');
        for (const h of heads) {
          if (h.textContent.trim().toLowerCase().indexOf('support paths') === 0) {
            h.scrollIntoView({ block: 'start' });
            break;
          }
        }
      }, 60);
    }
  },

  /* ------------------------------------------------------------- inventory */

  _renderInventory() {
    const host = document.getElementById('profile-inventory');
    if (!host) return;
    if (!this._acknowledged() || !this._items.length) {
      host.innerHTML = '';
      return;
    }
    const retake = latestRetake(this._responses);
    const answered = this._responses.filter((r) => r.retake === retake).length;
    const retakeLine = retake === null
      ? 'First pass — nothing answered yet.'
      : `Pass ${retake} has ${answered} answer(s). Starting pass ${retake + 1}.`;

    const scaleHtml = (name, from, to, labels) => {
      let out = '';
      for (let v = from; v <= to; v++) {
        const lbl = labels ? ' ' + labels[v] : '';
        out += '<label class="profile-scale-opt"><input type="radio" name="' + esc(name) + '" value="' + v + '">' + v + lbl + '</label>';
      }
      return out;
    };
    const scopeHtml = (item) => {
      let out = '';
      for (const s of item.scopes || []) {
        out += '<label class="profile-scope-opt"><input type="checkbox" name="pscope-' + esc(item.id) + '" value="' + esc(s) + '">' + esc(SCOPE_LABELS[s] || s) + '</label>';
      }
      return out;
    };
    const itemHtml = (item) =>
      '<div class="card card-granite-inset profile-item">' +
        '<p class="profile-item-text">' + esc(item.text) + '</p>' +
        '<div class="profile-scale" role="radiogroup" aria-label="agreement">' + scaleHtml('pval-' + item.id, 1, 5) + '</div>' +
        '<div class="profile-meta">' +
          '<span class="profile-meta-label">confidence</span>' +
          '<span class="profile-scale profile-scale-conf">' + scaleHtml('pconf-' + item.id, 1, 3, CONF_LABELS) + '</span>' +
          (item.scopes && item.scopes.length
            ? '<span class="profile-meta-label">applies to</span><span class="profile-scope">' + scopeHtml(item) + '</span>'
            : '') +
        '</div>' +
      '</div>';

    let html = '<div class="card" style="margin-bottom:var(--space-6);">' +
      '<div class="card-header"><h3 class="card-title">Reflection inventory</h3>' +
      // Count is the real loaded inventory length; the invented "~6 MIN" estimate is
      // gone — no per-item duration data exists to derive it from (honesty audit).
      '<span class="badge badge-neutral">' + esc(String(this._items.length)) + ' ITEMS</span></div>' +
      '<p class="body-muted" style="padding:0 16px 8px;">' + esc(retakeLine) + ' Answer what you can — an unanswered item never counts against you. Each item: how true it was for you recently, and how confident you are. On the pressure-context items, also mark the areas of life where that pressure shows up — those marks annotate the matching watchpoint below.</p>' +
      '</div>';

    for (const lens of LENS_ORDER) {
      const items = this._items.filter((i) => i.lens === lens);
      if (!items.length) continue;
      html += '<h4 class="heading-4 profile-group-title">' + esc(LENS_LABELS[lens] || lens) + '</h4>';
      html += items.map(itemHtml).join('');
    }
    html += '<h4 class="heading-4 profile-group-title">Pressure contexts — the situations, not you</h4>';
    const ctxNames = this._guides && this._guides.contexts ? Object.keys(this._guides.contexts) : [];
    for (const ctx of ctxNames) {
      const items = this._items.filter((i) => i.lens === 'ctx-' + ctx);
      if (!items.length) continue;
      const label = (this._guides.contexts[ctx] && this._guides.contexts[ctx].label) || ctx;
      html += '<h4 class="heading-4 profile-group-title profile-group-ctx">' + esc(label) + '</h4>';
      html += items.map(itemHtml).join('');
    }
    html += '<button class="btn btn-primary" id="btn-profile-save-pass" style="margin-top:16px;">Save this pass and build my map</button>';

    host.innerHTML = html;
    const save = document.getElementById('btn-profile-save-pass');
    if (save) save.addEventListener('click', () => this._savePass());
  },

  /* ------------------------------------------------------------ save a pass */

  async _savePass() {
    const nextRetake = (latestRetake(this._responses) ?? -1) + 1;
    const scopesOf = (item) => Array.from(
      document.querySelectorAll('input[name="pscope-' + CSS.escape(item.id) + '"]:checked')
    ).map((el) => el.value);
    const confidenceOf = (item) => {
      const el = document.querySelector('input[name="pconf-' + CSS.escape(item.id) + '"]:checked');
      return el ? Number(el.value) : null;
    };
    const valueOf = (item) => {
      const el = document.querySelector('input[name="pval-' + CSS.escape(item.id) + '"]:checked');
      return el ? Number(el.value) : null;
    };

    let saved = 0;
    let failed = 0;
    for (const item of this._items) {
      const value = valueOf(item);
      if (value === null) continue; // unanswered is not a midpoint
      const r = await ProfileStore.saveResponse({
        itemId: item.id, value, retake: nextRetake,
        confidence: confidenceOf(item),
        scope: scopesOf(item)
      });
      if (r.ok) saved++; else failed++;
    }
    await this._loadStore();
    this._renderInventory();
    this._renderMap();
    this._refreshBackupCount();
    this._refreshReminder();
    if (this._app && this._app.showToast) {
      this._app.showToast({
        type: saved ? 'success' : 'warning',
        title: saved ? 'PASS SAVED' : 'NOTHING SAVED',
        message: saved
          ? `${saved} answer(s) recorded (pass ${nextRetake}). Map recomputed from raw answers only.`
          : 'Answer at least one item before saving.'
      });
    }
    if (failed) console.warn(`[DefenseProfile] ${failed} response(s) rejected by the store.`);
  },

  /* ------------------------------------------------------------- backup UI */

  /**
   * Bind the profile backup card exactly once. The card is static markup in
   * index.html and is never innerHTML-replaced, so a plain guard prevents
   * re-binding across view entries; the count text refreshes on every render.
   */
  _bindBackup() {
    if (this._backupBound) return;
    this._backupBound = true;

    const btnExport = document.getElementById('btn-profile-export');
    if (btnExport) btnExport.addEventListener('click', () => this._exportProfile());

    const btnImport = document.getElementById('btn-profile-import');
    const fileInput = document.getElementById('input-profile-import');
    if (btnImport && fileInput) {
      btnImport.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files && fileInput.files[0];
        fileInput.value = ''; // so re-selecting the same file fires change again
        if (!file) return;
        await this._importProfile(file);
      });
    }

    const btnVerify = document.getElementById('btn-profile-verify');
    const verifyInput = document.getElementById('input-profile-verify');
    if (btnVerify && verifyInput) {
      btnVerify.addEventListener('click', () => verifyInput.click());
      verifyInput.addEventListener('change', async () => {
        const file = verifyInput.files && verifyInput.files[0];
        verifyInput.value = ''; // so re-selecting the same file fires change again
        if (!file) return;
        await this._verifyProfile(file);
      });
    }

    const btnNow = document.getElementById('btn-profile-backup-now');
    if (btnNow) btnNow.addEventListener('click', () => this._exportProfile());

    const inputDays = document.getElementById('input-profile-reminder-days');
    if (inputDays) {
      inputDays.addEventListener('change', () => {
        const d = parseInt(inputDays.value, 10);
        this._lsSet(LS_REMINDER_DAYS, String(Number.isFinite(d) && d > 0 ? d : BACKUP_REMINDER_DAYS));
        this._refreshReminder();
      });
    }
  },

  _lsGet(key) {
    try { return globalThis.localStorage ? globalThis.localStorage.getItem(key) : null; } catch { return null; }
  },

  _lsSet(key, value) {
    // Privacy modes throw on access — the reminder clock simply won't persist there.
    try { if (globalThis.localStorage) globalThis.localStorage.setItem(key, value); } catch { /* noop */ }
  },

  /**
   * Answers and observations live in IndexedDB, which dies with the browser
   * profile — the same argument the identity practice log makes for its export
   * control. Counts come from the in-memory arrays _loadStore() keeps current.
   */
  _refreshBackupCount() {
    const el = document.getElementById('profile-backup-count');
    if (!el) return;
    const n = (this._responses || []).length;
    const o = (this._observations || []).length;
    el.textContent = String(n) + (n === 1 ? ' answer' : ' answers') + ' · ' +
      String(o) + (o === 1 ? ' logged event' : ' logged events');
  },

  /**
   * The re-export prompt. Due two ways (backupReminderDue — pure, tested in
   * test-profilestore.js): the stored last-export clock is at least `days` old
   * AND records newer than it exist (steady-state aging), OR the last import
   * restored records newer than the clock — the backup file demonstrably lacks
   * records the store now holds, so the age gate is waived and the prompt uses
   * restore-flavored wording. The clock and the restored-newer flag live in
   * localStorage, not the stores — they are reminder state, not data; the flag
   * survives a reload so the prompt is not lost, and export clears it.
   */
  _refreshReminder() {
    const state = this._reminderState();
    const line = document.getElementById('profile-backup-reminder');
    const btnNow = document.getElementById('btn-profile-backup-now');
    if (line) {
      const inputDays = document.getElementById('input-profile-reminder-days');
      if (inputDays && inputDays.value !== String(state.safeDays)) inputDays.value = String(state.safeDays);
      line.textContent = state.text;
      line.style.color = state.due ? 'var(--bronze-primary, #d2a64d)' : '';
      if (btnNow) btnNow.hidden = !state.due;
    }
    // The badge is visible from every view — the verdict must land there even
    // when this view was never mounted (early return would drop it).
    this._refreshNavBadge(state);
  },

  /**
   * The backup-clock state behind both the in-view reminder card and the nav
   * badge. Nothing here touches the DOM: the same honest, condition-specific
   * reason (aging rule or restored-newer import) is the card's line text and
   * the badge's tooltip.
   */
  _reminderState() {
    const stored = this._lsGet(LS_REMINDER_DAYS);
    const days = stored ? parseInt(stored, 10) : BACKUP_REMINDER_DAYS;
    const safeDays = Number.isFinite(days) && days > 0 ? days : BACKUP_REMINDER_DAYS;
    const rawLast = this._lsGet(LS_LAST_EXPORT);
    const lastExportTs = rawLast ? parseInt(rawLast, 10) : null;
    const newCount = newRecordsSince(this._responses || [], this._observations || [], lastExportTs);
    const restoredNewer = this._lsGet(LS_RESTORED_NEWER) === '1';
    const due = backupReminderDue(lastExportTs, Date.now(), safeDays, newCount, restoredNewer);

    let text;
    if (!Number.isFinite(lastExportTs) || lastExportTs <= 0) {
      text = 'Last export: never — export once to start the re-export clock.';
    } else if (due && restoredNewer && Date.now() - lastExportTs < safeDays * DAY_MS) {
      // The import path fired the prompt, not the aging rule — say so honestly.
      text = '⚠ ' + newCount + (newCount === 1 ? ' record' : ' records') + ' restored after your last export ' +
        (newCount === 1 ? 'is' : 'are') + ' not in it — re-export to keep your backup current.';
    } else if (due) {
      text = '⚠ Backup is ' + safeDays + '+ days old with ' + newCount + (newCount === 1 ? ' new record' : ' new records') +
        ' since your last export — re-export to keep your backup current.';
    } else {
      const d = new Date(lastExportTs).toISOString().slice(0, 10);
      text = 'Last export: ' + d + (newCount ? ' · ' + newCount + (newCount === 1 ? ' new record' : ' new records') + ' since' : ' · backup is current');
    }
    return { due, restoredNewer, newCount, safeDays, lastExportTs, text };
  },

  /**
   * The Personal Defense nav badge doubles as the export-age indicator: while
   * the backup is due it reads ⚠ BACKUP in the attention color with the honest
   * reason as its tooltip — visible from any view; otherwise it is the static
   * item count again. Only this module writes it, and only from reminder state.
   */
  _refreshNavBadge(state) {
    const badge = document.getElementById('nav-badge-defense');
    if (!badge) return;
    if (state.due) {
      badge.textContent = '⚠ BACKUP';
      badge.className = 'nav-badge badge-bronze';
      badge.title = state.text;
    } else if (this._items.length) {
      // Derived from the loaded inventory (honesty audit 2026-09-26) — the old
      // hardcoded '38 ITEMS' silently claimed a dataset it hadn't checked.
      badge.textContent = `${this._items.length} ITEMS`;
      badge.className = 'nav-badge badge-neutral';
      badge.title = `${this._items.length} inventory items loaded from data/profile-items.json.`;
    } else {
      badge.textContent = 'ITEMS: N/A';
      badge.className = 'nav-badge badge-neutral';
      badge.title = 'profile-items.json unavailable — no item count can be honestly displayed.';
    }
  },

  async _exportProfile() {
    const n = (this._responses || []).length;
    const o = (this._observations || []).length;
    if (!n && !o) {
      if (this._app && this._app.showToast) {
        this._app.showToast({ type: 'warning', title: 'NOTHING TO EXPORT', message: 'No answers or logged events yet. Complete the inventory or log an observation first.' });
      }
      return;
    }
    const json = await ProfileStore.export();
    // The file's own sha256 field, surfaced so the operator can verify the file
    // wasn't altered in transit — import recomputes it and rejects a mismatch.
    let sha256 = null;
    try { sha256 = JSON.parse(json).sha256 || null; } catch { /* keep null */ }
    // A Blob URL rather than a data: URI — a large profile would hit URL length limits.
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sovereign_aegis_personal_defense_' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    // A real export starts (or advances) the re-export clock and acknowledges
    // any restored-newer flag — the fresh file covers everything, so the
    // normal aging rule takes over again.
    this._lsSet(LS_LAST_EXPORT, String(Date.now()));
    this._lsSet(LS_RESTORED_NEWER, '0');
    this._refreshReminder();
    if (this._app && this._app.showToast) {
      this._app.showToast({
        type: 'success',
        title: 'PROFILE EXPORTED',
        // Long enough to copy the checksum down.
        duration: 10000,
        message: String(n + o) + ' record(s) written (' + String(n) + ' answers, ' + String(o) + ' events).' +
          (sha256
            ? ' sha256: ' + sha256 + ' — import verifies this checksum; an altered file is rejected.'
            : ' Keep this file somewhere that is not this browser.')
      });
    }
  },

  async _importProfile(file) {
    let text;
    try {
      text = await file.text();
    } catch (e) {
      if (this._app && this._app.showToast) {
        this._app.showToast({ type: 'danger', title: 'IMPORT FAILED', message: 'Could not read the file: ' + e.message });
      }
      return;
    }
    // ProfileStore.import() validates every record before writing ANYTHING, so a
    // corrupted or hostile export cannot leave a mixed store behind.
    const r = await ProfileStore.import(text);
    if (!r.ok) {
      if (this._app && this._app.showToast) {
        this._app.showToast({ type: 'danger', title: 'IMPORT REJECTED', message: r.reason });
      }
      return;
    }
    await this._loadStore();
    // A re-import that restored records newer than the last export means the
    // backup file already lacks records the store holds — flag it so the
    // reminder fires now instead of waiting out the N-day age gate. Restores
    // keep original timestamps, so import() reports the newest written ts;
    // persisted so a reload does not lose the prompt. Export clears the flag.
    const rawLast = this._lsGet(LS_LAST_EXPORT);
    const lastExportTs = rawLast ? parseInt(rawLast, 10) : null;
    const restoredNewer = Number.isFinite(lastExportTs) && lastExportTs > 0 &&
      Number.isFinite(r.restoredMaxTs) && r.restoredMaxTs > lastExportTs;
    this._lsSet(LS_RESTORED_NEWER, restoredNewer ? '1' : '0');
    this.render();
    if (this._app && this._app.showToast) {
      this._app.showToast({
        type: 'success',
        // Long enough to copy the checksum down and compare it against the export toast's.
        duration: 10000,
        title: 'PROFILE IMPORTED',
        message: (r.imported
          ? String(r.imported) + ' record(s) restored' + (r.skipped ? ', ' + String(r.skipped) + ' already present' : '') + '. '
          : 'Every record in that file was already present — nothing changed. ') +
          (typeof r.sha256 === 'string'
            ? 'sha256: ' + r.sha256 + ' — matches the file just restored; compare it with the export toast\'s digest to confirm this is the file you backed up.'
            : 'Legacy export (no checksum) — an altered legacy file cannot be detected.')
      });
    }
  },

  /**
   * Verify a profile file BEFORE importing it: recompute the SHA-256 over its
   * payload and compare it with the embedded checksum (verifyBackup — pure,
   * tested in test-profilestore.js). Nothing is written to the store here; the
   * verdict renders in the card and a toast signals a file that must not be
   * imported. A legacy file without a checksum is accepted as legacy, never
   * condemned.
   */
  async _verifyProfile(file) {
    let text;
    try {
      text = await file.text();
    } catch (e) {
      if (this._app && this._app.showToast) {
        this._app.showToast({ type: 'danger', title: 'VERIFY FAILED', message: 'Could not read the file: ' + e.message });
      }
      return;
    }
    const v = await verifyBackup(text);
    const line = document.getElementById('profile-verify-result');
    let msg = '';
    let color = '';
    if (v.ok && v.state === 'intact') {
      msg = '✓ Verified — sha256 ' + v.sha256 + ' matches this file\'s payload. Safe to import.';
      color = 'var(--veracity-green, #7ac48a)';
    } else if (v.ok && v.state === 'legacy') {
      msg = '— Legacy export (no checksum): shape valid, but an altered legacy file cannot be detected. Import accepts it.';
      color = 'var(--bronze-primary, #d2a64d)';
    } else if (v.ok && v.state === 'unverifiable') {
      msg = '— ' + v.reason;
      color = 'var(--bronze-primary, #d2a64d)';
    } else if (v.state === 'tampered') {
      msg = '✗ ' + v.reason + ' Nothing was written — do not import this file.';
      color = 'var(--disinfo-crimson, #f87171)';
    } else {
      msg = '✗ ' + v.reason;
      color = 'var(--disinfo-crimson, #f87171)';
    }
    if (line) {
      line.textContent = msg;
      line.style.color = color;
    }
    if (!v.ok && this._app && this._app.showToast) {
      this._app.showToast({ type: 'danger', title: 'FILE NOT VERIFIED', message: v.reason + ' Nothing was imported.' });
    } else if (v.ok && v.state === 'intact' && this._app && this._app.showToast) {
      this._app.showToast({ type: 'success', title: 'FILE VERIFIED', message: 'Checksum matches. Safe to import.' });
    }
  },

  /* ------------------------------------------------------------------ map */

  _renderMap() {
    const host = document.getElementById('profile-map');
    if (!host) return;
    if (!this._acknowledged()) { host.innerHTML = ''; return; }

    if (!this._responses.length) {
      host.innerHTML =
        '<div class="card card-granite-inset" style="margin-bottom:var(--space-6);">' +
          '<div class="status-label">PRACTICE MAP — WAITING ON EVIDENCE</div>' +
          '<p class="body-muted" style="margin:10px 0 0 0;">Complete a pass of the inventory (and log pressure events below) and this map will be built from your own answers — bands, not labels; watchpoints for situations, not verdicts about you.</p>' +
        '</div>';
      return;
    }

    const levelMap = compute(this._responses, this._items);
    const guide = buildGuide(this._responses, levelMap, this._observations, this._guides, this._skills, {
      items: this._items,
      repeated: (latestRetake(this._responses) ?? 0) >= 1
    });

    let html = '<div class="card" style="margin-bottom:var(--space-6);">' +
      '<div class="card-header"><h3 class="card-title">Practice map</h3>' +
      '<span class="badge badge-neutral">RECOMPUTED FROM RAW ANSWERS</span></div>';

    // Bands
    html += '<div class="profile-bands">';
    for (const lens of LENS_ORDER) {
      const l = levelMap.get(lens);
      const chip = l && l.level ? '<span class="badge ' + (l.level === 'more' ? 'badge-bronze' : l.level === 'less' ? 'badge-neutral' : 'badge-veracity') + '">' + l.level + '</span>' : '<span class="badge badge-neutral">unanswered</span>';
      html += '<div class="profile-band"><span class="profile-band-lens">' + esc(LENS_LABELS[lens] || lens) + '</span>' + chip +
        '<span class="profile-band-n">' + (l ? l.n : 0) + ' answered</span></div>';
    }
    html += '</div>';

    // Assets
    if (guide.assets.length) {
      html += '<h4 class="heading-4 profile-group-title">Assets — what this reflection already has</h4><ul class="profile-list">';
      for (const a of guide.assets) html += '<li>' + esc(a.text) + '</li>';
      html += '</ul>';
    }

    // Watchpoints
    html += '<h4 class="heading-4 profile-group-title">Watchpoints — situations to name, not identities</h4>';
    if (!guide.watchpoints.length) {
      html += '<p class="body-muted">No pressure context is active right now — the mini-checks are all below threshold and no logged event supports one. That can change with one observation.</p>';
    } else {
      html += '<ul class="profile-list">';
      for (const w of guide.watchpoints) {
        const badge = w.salience === 'promoted'
          ? '<span class="badge badge-bronze">PROMOTED</span>'
          : '<span class="badge badge-neutral">NOTED</span>';
        const domains = w.domains && w.domains.length
          ? '<div class="profile-wp-text profile-wp-domains">surfaces where you marked it: ' +
            w.domains.map((d) => esc(SCOPE_LABELS[d] || d)).join(' · ') + '</div>'
          : '';
        html += '<li><div class="profile-wp-head">' + esc(w.label) + ' ' + badge +
          '<span class="profile-wp-evidence">evidence: ' + esc(w.evidence) + '</span></div>' +
          '<div class="profile-wp-text">' + esc(w.text) + '</div>' + domains + '</li>';
      }
      html += '</ul>';
    }

    // Countermeasures + routes
    if (guide.countermeasures.length) {
      html += '<h4 class="heading-4 profile-group-title">If-then countermeasures</h4><ul class="profile-list">';
      for (const cm of guide.countermeasures) {
        html += '<li><strong>' + esc(cm.tacticFamily) + '</strong> — ' + esc(cm.plan) + '</li>';
      }
      html += '</ul>';
      html += '<h4 class="heading-4 profile-group-title">Drill routes</h4><div class="profile-routes">';
      for (const r of guide.routes) {
        const dest = DESTINATIONS[r.skillId] || { tab: 'cognitive', subtab: 'arena', label: 'Arena Gauntlet' };
        html += '<button class="btn btn-outline btn-sm" data-aegis-action="switch-tab" data-aegis-tab="' + esc(dest.tab) + '" data-aegis-subtab="' + esc(dest.subtab) + '" style="margin:0 8px 8px 0;">' +
          esc(r.skillLabel) + ' → ' + esc(dest.label) + '</button>';
      }
      html += '</div>';
    }

    // Disconfirmation + evidence note
    html += '<h4 class="heading-4 profile-group-title">Test this picture</h4>' +
      '<p class="body-muted" style="margin:0;">' + esc(guide.disconfirmation) + '</p>' +
      '<p class="body-muted" style="margin:10px 0 0 0;font-size:0.75rem;">' + esc(guide.evidenceNote) + '</p>';
    html += '</div>';

    host.innerHTML = html;
  },

  /* ------------------------------------------------- observation log */

  _renderLog() {
    const host = document.getElementById('profile-log');
    if (!host) return;
    if (!this._acknowledged()) { host.innerHTML = ''; return; }

    const ctxOptions = this._guides && this._guides.contexts
      ? Object.entries(this._guides.contexts)
          .map(([k, c]) => '<option value="' + esc(k) + '">' + esc(c.label || k) + '</option>')
          .join('')
      : '';
    const resistedOptions =
      '<option value="">not stated</option>' +
      '<option value="true">I resisted — held the line</option>' +
      '<option value="false">I did not resist — got pulled in</option>';

    let html =
      '<div class="card" style="margin-bottom:var(--space-6);">' +
        '<div class="card-header"><h3 class="card-title">Observation log</h3>' +
        '<span class="badge badge-neutral">YOUR OWN PRESSURE EVENTS</span></div>' +
        '<p class="body-muted" style="padding:0 16px 8px;">Log what happened when a pressure tactic landed on YOU. Your own reaction only — no field here names another person. Two logged events (or one you did not resist) can promote a watchpoint; a confident resisted event subtracts one.</p>' +
        '<div class="profile-obs-form" style="padding:0 16px 16px;">' +
          '<div class="form-group"><label class="form-label">Tactic you recognised (your words)</label>' +
          '<input class="form-input" id="pobs-tactic" maxlength="200" placeholder="e.g. fake deadline, everyone-agrees framing"></div>' +
          '<div class="form-group"><label class="form-label">Pressure context</label>' +
          '<select class="form-input" id="pobs-context">' + ctxOptions + '</select></div>' +
          '<div class="form-group"><label class="form-label">Initial reaction</label>' +
          '<input class="form-input" id="pobs-reaction" maxlength="300" placeholder="how it felt in the moment"></div>' +
          '<div class="form-group"><label class="form-label">What you did</label>' +
          '<input class="form-input" id="pobs-action" maxlength="300" placeholder="your action"></div>' +
          '<div class="form-group"><label class="form-label">Outcome</label>' +
          '<input class="form-input" id="pobs-outcome" maxlength="300" placeholder="what happened after"></div>' +
          '<div class="form-group"><label class="form-label">Confidence in this record</label>' +
          '<select class="form-input" id="pobs-confidence"><option value="1">guess</option><option value="2">mixed</option><option value="3" selected>confident</option></select></div>' +
          '<div class="form-group"><label class="form-label">Did you resist?</label>' +
          '<select class="form-input" id="pobs-resisted">' + resistedOptions + '</select></div>' +
          '<button class="btn btn-primary" id="btn-profile-add-obs">Log observation</button>' +
        '</div>' +
      '</div>';

    // Existing observations, newest first.
    if (this._observations.length) {
      html += '<div class="card card-granite-inset" style="margin-bottom:var(--space-6);"><div class="card-header"><h3 class="card-title">Logged events</h3><span class="badge badge-neutral">' + this._observations.length + ' TOTAL</span></div><ul class="profile-list">';
      const fmt = (ts) => new Date(ts).toISOString().slice(0, 10);
      for (const o of [...this._observations].reverse()) {
        const tag = this._guides && this._guides.contexts[o.contextTag]
          ? this._guides.contexts[o.contextTag].label : o.contextTag;
        const badge = o.resisted === false
          ? '<span class="badge badge-danger">GOT PULLED IN</span>'
          : o.resisted === true
            ? '<span class="badge badge-veracity">RESISTED</span>'
            : '';
        html += '<li><div class="profile-wp-head">' + esc(fmt(o.ts)) + ' · ' + esc(tag) + ' · ' + esc(o.tactic) + ' ' + badge + '</div>' +
          (o.outcome ? '<div class="profile-wp-text">' + esc(o.outcome) + '</div>' : '') +
          '</li>';
      }
      html += '</ul></div>';
    }

    host.innerHTML = html;
    const btn = document.getElementById('btn-profile-add-obs');
    if (btn) btn.addEventListener('click', () => this._saveObservation());
  },

  async _saveObservation() {
    const val = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    const tactic = val('pobs-tactic');
    const contextTag = val('pobs-context');
    if (!tactic || !contextTag) {
      if (this._app && this._app.showToast) {
        this._app.showToast({ type: 'warning', title: 'INCOMPLETE', message: 'Tactic and context are required.' });
      }
      return;
    }
    const resistedRaw = val('pobs-resisted');
    const resisted = resistedRaw === 'true' ? true : resistedRaw === 'false' ? false : null;
    const observation = {
      tactic, contextTag,
      initialReaction: val('pobs-reaction') || null,
      action: val('pobs-action') || null,
      outcome: val('pobs-outcome') || null,
      confidence: Number(val('pobs-confidence')) || null,
      resisted
    };
    const r = await ProfileStore.appendObservation(observation);
    if (!r.ok) {
      if (this._app && this._app.showToast) {
        this._app.showToast({ type: 'danger', title: 'NOT LOGGED', message: r.reason });
      }
      return;
    }
    await this._loadStore();
    this._renderSupport();
    this._renderLog();
    this._renderMap();
    this._refreshBackupCount();
    this._refreshReminder();
    if (this._app && this._app.showToast) {
      this._app.showToast({ type: 'success', title: 'OBSERVATION LOGGED', message: 'The map was recomputed from it.' });
    }
    // Static keyword routing on the operator's own text — a support card, never a verdict.
    if (needsSupport(observation, this._guides && this._guides.supportCard)) {
      const card = this._guides.supportCard;
      const ack = document.getElementById('profile-ack');
      if (ack && this._app && this._app.showToast) {
        this._app.showToast({
          type: 'danger',
          title: card.title,
          message: 'This record shows coercive-control markers. A drill is not the right tool here — tell one trusted person and contact local support.',
          duration: 12000
        });
      }
    }
  },

  /* ------------------------------------------------------------------ atlas */

  _renderAtlas() {
    const host = document.getElementById('profile-atlas');
    if (!host) return;
    if (!this._acknowledged()) { host.innerHTML = ''; return; }
    const cards = (this._notes && this._notes.cards) || [];
    if (!cards.length) { host.innerHTML = ''; return; }

    let html = '<div class="card" style="margin-bottom:var(--space-6);">' +
      '<div class="card-header"><h3 class="card-title">Framework atlas</h3>' +
      '<span class="badge badge-neutral">EVIDENCE-TIERED · COMPARISON LENSES</span></div>' +
      '<p class="body-muted" style="padding:0 16px 8px;">What each popular framework actually measures, where its evidence stands, and which parts of it are compatible with this practice. Lenses for reflecting on yourself — never labels for other people.</p>';
    for (const c of cards) {
      const tier = c.tier || 'unrated';
      const tierClass = tier === 'strong' ? 'badge-veracity' : tier === 'moderate' ? 'badge-bronze' : 'badge-neutral';
      html += '<div class="card card-granite-inset" style="margin:0 16px 16px;">' +
        '<div class="profile-wp-head"><strong>' + esc(c.name) + '</strong> <span class="badge ' + tierClass + '">' + esc(tier) + '</span></div>' +
        '<p class="body-muted" style="margin:8px 0 0 0;"><strong>Measures:</strong> ' + esc(c.measures) + '</p>' +
        '<p class="body-muted" style="margin:6px 0 0 0;"><strong>Common misuse:</strong> ' + esc(c.misuse) + '</p>' +
        '<p class="body-muted" style="margin:6px 0 0 0;"><strong>Compatible practice:</strong> ' + esc(c.compatiblePractice) + '</p>' +
      '</div>';
    }
    html += '</div>';

    host.innerHTML = html;
  }
};

export default DefenseProfile;
