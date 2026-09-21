/**
 * SOVEREIGN // AEGIS — Adaptive Inoculation Runs (Personal Defense Profile, slice 3)
 *
 * WHAT THIS IS
 * ------------
 * The view layer for the pure selector in js/inoculation.js. It gathers the operator's real
 * data — the attempt log, the Defense Profile's responses and observation log, the tagged
 * inoculation dataset — hands it to buildRun(), and renders a three-stage run with the
 * "served because" reasons visible. Every answer is recorded to the competency spine under
 * the dedicated `inoculation-adaptive` context, and the debrief ties each outcome back to
 * the operator's own watchpoint countermeasures.
 *
 * WHAT THIS MODULE NEVER DOES
 * ---------------------------
 * It never invents a number. The only meter on screen is the resilience delta the content
 * author already gave each choice. Selection ordering stays inside the engine; the reasons
 * travel to the UI instead.
 *
 * @module inoculationAdaptive
 */

import { recordAttempt, CONTEXTS } from '../attempts.js';
import { AttemptLog } from '../attemptlog.js';
import { ProfileStore } from '../profilestore.js';
import { buildRun } from '../inoculation.js';
import { compute, buildGuide } from '../profile.js';
import { Confidence } from '../confidence.js';
import { esc } from '../security.js';

export const InoculationAdaptive = {
  _app: null,
  /** data/inoculation.json, loaded with the view's other datasets. */
  _scenarios: [],
  /** data/profile-items.json — the mini-check inventory salience() needs. */
  _profileItems: [],
  /** data/profile-guides.json — countermeasure copy for the debrief. */
  _guides: null,
  /** data/skills.json — skill labels for the debrief. */
  _skills: [],
  /** The active run object returned by buildRun, or null when idle. */
  _run: null,
  /** Stage the operator is on. */
  _stageIndex: 0,
  /** When the current stage became answerable — latency is measured, not assumed. */
  _stageShownAt: 0,
  /** Prior adaptive-context attempts, for freshness and probe-once enforcement. */
  _adaptiveLog: [],
  /** Runs started in this visit — the measurement cadence is per-session scheduling.
   *  Numbering is deliberately NOT reconstructed from the log: gaps cannot distinguish
   *  two runs played back-to-back from one slow run, and a mis-derived count could
   *  suppress measurement runs indefinitely. The log's authority here is probe-once
   *  enforcement (append-only), not numbering. */
  _sessionRuns: 0,
  /** Outcomes for the active run: {stage, choice, isCorrect, latencyMs}. */
  _outcomes: [],
  /** Element the entry card and run render into. */
  _host: null,

  init(app) {
    this._app = app;
    this._loadData();
  },

  async _loadData() {
    const loadJson = (filename) =>
      fetch(`./data/${filename}`).catch(() => fetch(`data/${filename}`)).then((r) => r.json()).catch(() => null);
    const [scenarios, profileItems, guides, skills] = await Promise.all([
      loadJson('inoculation.json'),
      loadJson('profile-items.json'),
      loadJson('profile-guides.json'),
      loadJson('skills.json')
    ]);
    this._scenarios = Array.isArray(scenarios) ? scenarios : [];
    // profile-items.json wraps its array in {format, contentVersion, items}; inoculation.json
    // is a bare array. Unwrap the wrapper — dropping it here would silently kill the
    // mini-check half of salience (the failure mode: every watchpoint reads event-only).
    this._profileItems = Array.isArray(profileItems)
      ? profileItems
      : Array.isArray(profileItems && profileItems.items) ? profileItems.items : [];
    this._guides = guides && typeof guides === 'object' ? guides : null;
    this._skills = Array.isArray(skills) ? skills : [];
    await this._refreshAdaptiveLog();
  },

  async _refreshAdaptiveLog() {
    try {
      const attempts = await AttemptLog.readAll();
      this._adaptiveLog = attempts.filter((a) => a && a.context === CONTEXTS.INOCULATION_ADAPTIVE);
    } catch {
      this._adaptiveLog = [];
    }
  },

  /**
   * The engine's inputs, gathered fresh. Failure of any store degrades to empty inputs —
   * salience then reads "no active watchpoint" and mastery reads "no attempts yet", which
   * is the honest description of an operator with no profile yet, not a fabricated state.
   * @returns {Promise<{attempts: object[], responses: object[], observations: object[]}>}
   */
  async _gatherInputs() {
    const [attempts, responses, observations] = await Promise.all([
      AttemptLog.readAll().catch(() => []),
      ProfileStore.readResponses().catch(() => []),
      ProfileStore.readObservations().catch(() => [])
    ]);
    return { attempts, responses, observations };
  },

  /**
   * Bind the entry card into its host. Called from the Prebunking renderer, which owns the
   * container; because that renderer rewrites the subtab's innerHTML on entry, the card is
   * (re-)inserted on every call — the id makes insertion idempotent within one render.
   */
  renderEntryCard(container) {
    this._host = container;
    if (!container) return;
    if (document.getElementById('adaptive-inoculation-card')) return;

    const card = document.createElement('div');
    card.className = 'card card-granite-inset';
    card.id = 'adaptive-inoculation-card';
    card.style.marginBottom = 'var(--space-4)';
    card.innerHTML = `
      <div class="flex-row-gap" style="justify-content:space-between;align-items:center;">
        <div>
          <div class="status-label text-bronze">ADAPTIVE RUN — PERSONAL DEFENSE PROFILE</div>
          <p class="body-muted" style="font-size:0.85rem;margin-top:4px;">
            Three stages chosen by your Defense Profile and competency spine. The reason under
            each stage says exactly why it was served. Every 3rd run measures transfer on
            held-out stages.
          </p>
        </div>
        <button class="btn btn-primary" id="btn-adaptive-inoculation">Start Adaptive Run →</button>
      </div>
      <div id="adaptive-inoculation-status" class="body-muted" style="font-size:0.8rem;margin-top:var(--space-2);"></div>
    `;
    container.insertBefore(card, container.firstChild);

    document.getElementById('btn-adaptive-inoculation')?.addEventListener('click', () => {
      this.startRun();
    });
    this._renderEntryStatus();
  },

  /** Entry card status line: what the selector currently knows about the operator. */
  async _renderEntryStatus() {
    const el = document.getElementById('adaptive-inoculation-status');
    if (!el) return;
    const { attempts, responses, observations } = await this._gatherInputs();
    const nObs = (observations || []).length;
    const nResp = (responses || []).length;
    el.textContent =
      `Inputs: ${nResp} profile answer(s), ${nObs} logged observation(s), ${attempts.length} attempt(s) on record. ` +
      (nResp || nObs
        ? 'Your profile is shaping the selection.'
        : 'Answer the Defense Profile inventory or log an observation to personalize selection.');
  },

  /**
   * Build and show a run. The whole flow renders into the shared Prebunking container so
   * the operator stays in one place; the static scenario list returns when they back out.
   */
  async startRun() {
    const container = this._host;
    if (!container) return;

    await this._refreshAdaptiveLog();
    const { attempts, responses, observations } = await this._gatherInputs();
    if (!this._scenarios.length) {
      this._app?.showToast?.({ type: 'warning', title: 'NO SCENARIOS', message: 'Inoculation data failed to load.' });
      return;
    }

    const run = buildRun({
      scenarios: this._scenarios,
      attempts,
      responses,
      observations,
      items: this._profileItems,
      adaptiveLog: this._adaptiveLog,
      runNumber: ++this._sessionRuns
    });
    this._run = run;
    this._stageIndex = 0;
    this._outcomes = [];
    this._renderRunIntro(run);
  },

  _renderRunIntro(run) {
    const container = this._host;
    if (!container) return;
    container.innerHTML = `
      <div class="card card-bronze" style="margin-bottom:var(--space-4);">
        <div class="status-label text-bronze">ADAPTIVE INOCULATION — ${run.isHeldOutRun ? 'MEASUREMENT RUN' : 'PRACTICE RUN'}</div>
        <p class="body-text" style="margin-top:var(--space-2);">${esc(run.note)}</p>
        ${run.heldOutShortfall > 0
          ? `<p class="body-muted" style="font-size:0.82rem;margin-top:var(--space-2);">${esc(String(run.heldOutShortfall))} of 3 stage slots had no held-out stage available; the run continues on practice stages rather than pretending to measure.</p>`
          : ''}
      </div>
      <div id="adaptive-run-body"></div>
    `;
    this._renderStage(run.stages[0]);
  },

  _renderStage(stage) {
    const container = this._host;
    const run = this._run;
    if (!container || !run || !stage) return;
    this._stageShownAt = Date.now();

    const body = container.querySelector('#adaptive-run-body');
    if (!body) return;

    body.innerHTML = `
      <div class="card" style="margin-bottom:var(--space-4);">
        <div class="flex-row-gap" style="justify-content:space-between;">
          <div class="status-label text-bronze">${esc(stage.scenarioTitle)}</div>
          <div class="status-label text-muted">Stage ${this._stageIndex + 1} / ${run.stages.length}${stage.isHeldOut ? ' · HELD-OUT PROBE' : ''}</div>
        </div>
        <div class="card-granite-inset" style="margin:var(--space-2) 0 var(--space-3) 0;">
          <div class="status-label text-bronze" style="margin-bottom:4px;">SERVED BECAUSE</div>
          <ul style="margin:0;padding-left:18px;">
            ${stage.reasons.map((r) => `<li style="font-size:0.8rem;color:var(--text-muted, #999);">${esc(r)}</li>`).join('')}
          </ul>
        </div>
        <p class="body-lead" style="margin-bottom:var(--space-4);line-height:1.65;">${esc(stage.prompt)}</p>
        ${stage.evidenceSnippets.length ? `
          <div class="card-granite-inset" style="margin-bottom:var(--space-3);">
            <div class="status-label text-bronze" style="margin-bottom:var(--space-2);">AVAILABLE EVIDENCE:</div>
            ${stage.evidenceSnippets.map((e) => `
              <div class="flex-row-gap" style="margin-bottom:6px;">
                <span class="text-intel-cyan">◉</span>
                <span style="font-size:0.85rem;">${esc(e)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
        <div class="status-label text-muted" style="margin-bottom:var(--space-3);">CHOOSE YOUR RESPONSE:</div>
        <div id="adaptive-inoc-confidence-host" style="margin-bottom:var(--space-3);"></div>
        <div style="display:flex;flex-direction:column;gap:var(--space-2);">
          ${stage.choices.map((ch) => `
            <button class="btn btn-outline adaptive-choice" data-choice-id="${esc(ch.choiceId)}"
                    style="text-align:left;justify-content:space-between;padding:14px 18px;">
              <span>${esc(ch.text)}</span>
              <span class="badge ${ch.type === 'Inoculate' ? 'badge-veracity' : ch.type === 'Reactive' ? 'badge-intel' : 'badge-disinfo'}">${esc(ch.type)}</span>
            </button>
          `).join('')}
        </div>
        <div id="adaptive-inoc-feedback" style="display:none;margin-top:var(--space-4);"></div>
      </div>
      <button class="btn btn-secondary" id="btn-adaptive-abort">← Abandon Run</button>
    `;

    Confidence.mount(document.getElementById('adaptive-inoc-confidence-host'), {
      label: 'HOW SURE ARE YOU THIS IS THE RIGHT RESPONSE?'
    });

    document.getElementById('btn-adaptive-abort')?.addEventListener('click', () => this._abort());

    let answered = false;
    body.querySelectorAll('.adaptive-choice').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        this._onChoice(stage, btn.getAttribute('data-choice-id'));
      });
    });
  },

  async _onChoice(stage, choiceId) {
    const choice = stage.choices.find((c) => c.choiceId === choiceId);
    const run = this._run;
    if (!choice || !run) return;

    const elapsed = Math.max(0, Date.now() - this._stageShownAt);
    const isCorrect = (choice.resilienceDelta || 0) > 0;

    const recorded = await recordAttempt({
      skillIds: stage.stageSkills,
      itemId: stage.itemId,
      correct: isCorrect,
      context: CONTEXTS.INOCULATION_ADAPTIVE,
      latencyMs: elapsed,
      heldOut: stage.isHeldOut,
      chosen: choice.text
    });
    if (!recorded.recorded) {
      console.warn(`[InoculationAdaptive] stage attempt not recorded: ${stage.itemId} (${recorded.reason})`);
    }

    // Refresh the freshness log so a future run this session sees this serving, and keep
    // the outcome for the debrief.
    this._adaptiveLog = [
      ...this._adaptiveLog,
      ...stage.stageSkills.map((skillId) => ({ itemId: stage.itemId, ts: Date.now(), context: CONTEXTS.INOCULATION_ADAPTIVE }))
    ];
    this._outcomes.push({ stage, choice, isCorrect, latencyMs: elapsed });

    const body = this._host?.querySelector('#adaptive-run-body');
    const box = body?.querySelector('#adaptive-inoc-feedback');
    if (box) {
      box.innerHTML = `
        <div class="card-granite-inset" style="border-left:3px solid var(--accent, #b8860b);">
          <div class="status-label ${isCorrect ? 'text-emerald' : 'text-crimson'}">${isCorrect ? 'RESILIENCE +: ' : 'RESILIENCE -: '}${esc(choice.type.toUpperCase())}</div>
          <p class="body-text" style="margin-top:6px;">${esc(choice.feedback || '')}</p>
        </div>
      `;
      box.style.display = 'block';

      const next = document.createElement('button');
      next.className = 'btn btn-primary';
      next.style.marginTop = 'var(--space-3)';
      next.textContent = this._stageIndex < run.stages.length - 1 ? 'Continue →' : 'View Debrief →';
      next.addEventListener('click', () => this._advance());
      box.appendChild(next);
    }
  },

  _advance() {
    if (!this._run) return;
    if (this._stageIndex < this._run.stages.length - 1) {
      this._stageIndex++;
      this._renderStage(this._run.stages[this._stageIndex]);
    } else {
      this._renderDebrief();
    }
  },

  /**
   * Debrief: what the operator chose, per stage, tied to the countermeasure they wrote for
   * that pressure context in their own Defense Profile map.
   */
  async _renderDebrief() {
    const container = this._host;
    const run = this._run;
    if (!container || !run) return;

    const { responses, observations } = await this._gatherInputs();

    // The countermeasure lookup runs the profile map over the operator's CURRENT answers,
    // so the debrief shows their own plan for exactly the pressures they just trained.
    let countermeasures = [];
    try {
      const levelMap = compute(responses, this._profileItems);
      const guide = buildGuide(responses, levelMap, observations, this._guides || {}, this._skills, { items: this._profileItems });
      countermeasures = guide.countermeasures;
    } catch (e) {
      console.warn('[InoculationAdaptive] countermeasure lookup failed:', e);
    }

    const correctCount = this._outcomes.filter((o) => o.isCorrect).length;
    const stageRows = run.stages.map((s, i) => {
      const outcome = this._outcomes[i];
      const cm = countermeasures.find((c) => s.contexts.includes(c.context));
      return `
        <div class="card-granite-inset" style="margin-bottom:var(--space-2);">
          <div class="flex-row-gap" style="justify-content:space-between;">
            <span class="status-label text-bronze">${esc(s.scenarioTitle)} — stage ${s.stageIndex + 1}${s.isHeldOut ? ' (held-out probe)' : ''}</span>
            <span class="badge ${outcome && outcome.isCorrect ? 'badge-veracity' : 'badge-disinfo'}">${outcome ? `${outcome.isCorrect ? 'HELD' : 'FOLDED'} — ${outcome.choice.type}` : 'UNANSWERED'}</span>
          </div>
          ${outcome ? `<p class="body-muted" style="font-size:0.82rem;margin-top:4px;">You chose: ${esc(outcome.choice.text)}</p>` : ''}
          ${cm ? `<p class="body-muted" style="font-size:0.82rem;margin-top:6px;">Your countermeasure: ${esc(cm.plan)}</p>` : ''}
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="card card-bronze" style="margin-bottom:var(--space-4);">
        <div class="status-label text-bronze">ADAPTIVE RUN DEBRIEF — ${run.isHeldOutRun ? 'MEASUREMENT' : 'PRACTICE'} RUN #${run.runNumber}</div>
        <p class="body-text" style="margin-top:var(--space-2);">
          ${correctCount} of ${run.stages.length} stage${run.stages.length === 1 ? '' : 's'} held. Every answer was recorded to the
          competency spine${run.isHeldOutRun ? ' — the held-out probes feed the transfer measurement' : ''}.
          These stages were chosen by your own profile; the countermeasures below are yours,
          from your Defense Profile map.
        </p>
      </div>
      ${stageRows}
      <button class="btn btn-secondary" id="btn-adaptive-done">← Back to Scenarios</button>
    `;

    document.getElementById('btn-adaptive-done')?.addEventListener('click', () => this._abort());
  },

  /** Return to the static scenario list, re-binding the entry card. */
  _abort() {
    this._run = null;
    this._outcomes = [];
    if (this._app && typeof this._app.modules?.cognitive?._renderPrebunking === 'function') {
      this._app.modules.cognitive._renderPrebunking();
    }
  }
};

export default InoculationAdaptive;
