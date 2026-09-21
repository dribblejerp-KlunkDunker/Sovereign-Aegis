/**
 * SOVEREIGN // AEGIS — The Epistemic Commons
 * Modular Case Study Pack Hub, 1-Click Installer & Importer/Exporter.
 */

import { esc, sanitizeDeep } from '../security.js';
export const EpistemicCommons = {
  _app: null,
  _packs: [],
  _installedPackIds: new Set(),

  async init(app) {
    this._app = app;
    await this._loadPacks();
    this._bindEvents();
    console.log('[EpistemicCommons] Initialized.');
  },

  onMount() {
    this._renderHUD();
    this._renderPacksGrid();
  },

  onUnmount() {
    // Cleanup if needed
  },

  async _loadPacks() {
    try {
      const storedInstalled = this._app.store.get('commons.installed_packs');
      if (storedInstalled) {
        try {
          this._installedPackIds = new Set(JSON.parse(storedInstalled));
        } catch (e) {
          this._installedPackIds = new Set();
        }
      }

      const resp = await fetch('./data/community_packs.json')
        .catch(() => fetch('data/community_packs.json'));
      const data = await resp.json();
      this._packs = Array.isArray(data) ? data : [];

      // Check for user-imported custom packs.
      // These are third-party authored, so they are re-sanitised on every load — not
      // only at import time. A pack stored by an older, unpatched build could otherwise
      // still be carrying live markup, and this is the path that would revive it.
      const customPacksStored = this._app.store.get('commons.custom_packs');
      if (customPacksStored) {
        try {
          const customPacks = JSON.parse(customPacksStored);
          if (Array.isArray(customPacks)) {
            const cleaned = customPacks.map((p) => sanitizeDeep(p));
            this._packs.push(...cleaned);
            // Write the declawed copy back so the poisoned original does not persist.
            if (JSON.stringify(cleaned) !== JSON.stringify(customPacks)) {
              this._app.store.set('commons.custom_packs', JSON.stringify(cleaned));
              console.warn('[EpistemicCommons] Sanitised markup found in stored custom packs.');
            }
          }
        } catch (e) {
          console.warn('[EpistemicCommons] Error parsing custom packs', e);
        }
      }
    } catch (e) {
      console.warn('[EpistemicCommons] Could not load community_packs.json, using fallback.', e);
      this._packs = [];
    }
  },

  _saveInstalledState() {
    this._app.store.set('commons.installed_packs', JSON.stringify([...this._installedPackIds]));
  },

  _renderHUD() {
    const totalPacks = this._packs.length;
    const installedCount = this._installedPackIds.size;

    // Count cards in memory deck
    let memoryCount = 20;
    try {
      const storedDeck = this._app.store.get('sm2.deck');
      if (storedDeck) memoryCount = JSON.parse(storedDeck).length;
    } catch (e) {}

    const hudInstalled = document.getElementById('commons-hud-installed');
    const hudScenarios = document.getElementById('commons-hud-scenarios');
    const hudCards = document.getElementById('commons-hud-cards');
    const hudSyllogisms = document.getElementById('commons-hud-syllogisms');

    if (hudInstalled) hudInstalled.textContent = `${installedCount} / ${totalPacks}`;
    if (hudScenarios) hudScenarios.textContent = 11 + (installedCount * 2);
    if (hudCards) hudCards.textContent = memoryCount;
    if (hudSyllogisms) hudSyllogisms.textContent = 6 + (installedCount * 2);
  },

  _renderPacksGrid() {
    const grid = document.getElementById('commons-packs-grid');
    if (!grid || this._packs.length === 0) return;

    grid.innerHTML = this._packs.map(pack => {
      const isInstalled = this._installedPackIds.has(pack.id);
      const cardCount = pack.cards ? pack.cards.length : (pack.stats?.cards || 0);
      const scenarioCount = pack.scenarios ? pack.scenarios.length : (pack.stats?.scenarios || 0);
      const argCount = pack.arguments ? pack.arguments.length : (pack.stats?.arguments || 0);

      return `
        <div class="pack-card ${esc(isInstalled ? 'installed' : '')}" data-pack-id="${esc(pack.id)}">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
              <span class="badge badge-intel">${esc(pack.domain || 'GENERAL DEFENSE')}</span>
              <span class="badge ${esc(isInstalled ? 'badge-veracity' : 'badge-bronze')}">
                ${esc(isInstalled ? '✓ INSTALLED' : 'v' + (pack.version || '1.0.0'))}
              </span>
            </div>
            <h4 class="heading-4" style="color: var(--parchment-bright); margin: 6px 0 4px 0;">${esc(pack.title)}</h4>
            <div class="status-label text-muted" style="font-size: 0.75rem; margin-bottom: 8px;">BY ${esc(pack.author || 'ANONYMOUS')}</div>
            <p class="body-text" style="font-size: 0.85rem; line-height: 1.45; color: var(--stone-light); margin-bottom: 14px;">
              ${esc(pack.description)}
            </p>
          </div>

          <div>
            <!-- Content Composition Stats -->
            <div class="card-granite-inset" style="padding: 8px 12px; margin-bottom: 14px; display: flex; justify-content: space-between; font-size: 0.75rem; font-family: var(--font-mono); color: var(--stone-warm);">
              <span>🎯 ${esc(scenarioCount)} Scenarios</span>
              <span>🧠 ${esc(cardCount)} Cards</span>
              <span>⚖️ ${esc(argCount)} Syllogisms</span>
            </div>

            <!-- Actions Row -->
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-sm ${esc(isInstalled ? 'btn-outline' : 'btn-primary')} btn-toggle-install" data-pack-id="${esc(pack.id)}" style="flex: 1;">
                ${esc(isInstalled ? 'Uninstall Pack' : '⚡ Install Pack')}
              </button>
              <button class="btn btn-sm btn-secondary btn-export-pack" data-pack-id="${esc(pack.id)}" title="Download .aegis package file">
                📥 Export
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Bind Toggle Install buttons
    grid.querySelectorAll('.btn-toggle-install').forEach(btn => {
      btn.addEventListener('click', () => {
        const packId = btn.getAttribute('data-pack-id');
        if (this._installedPackIds.has(packId)) {
          this.uninstallPack(packId);
        } else {
          this.installPack(packId);
        }
      });
    });

    // Bind Export buttons
    grid.querySelectorAll('.btn-export-pack').forEach(btn => {
      btn.addEventListener('click', () => {
        const packId = btn.getAttribute('data-pack-id');
        this.exportPack(packId);
      });
    });
  },

  installPack(packId) {
    const pack = this._packs.find(p => p.id === packId);
    if (!pack) return;

    this._installedPackIds.add(packId);
    this._saveInstalledState();

    // Inject flashcards into Memory Vault (SM-2)
    if (Array.isArray(pack.cards) && pack.cards.length > 0) {
      try {
        let deck = [];
        const storedDeck = this._app.store.get('sm2.deck');
        if (storedDeck) deck = JSON.parse(storedDeck);

        const today = new Date().toISOString().split('T')[0];
        pack.cards.forEach(card => {
          if (!deck.some(c => c.id === card.id)) {
            deck.unshift({
              ...card,
              repetitions: 0,
              interval: 0,
              easeFactor: 2.5,
              dueDate: today,
              lastReviewed: null,
              history: [],
              packId: packId
            });
          }
        });
        this._app.store.set('sm2.deck', JSON.stringify(deck));
      } catch (e) {
        console.warn('[EpistemicCommons] Error injecting pack cards into SM-2 deck', e);
      }
    }

    this._renderHUD();
    this._renderPacksGrid();

    this._app?.showToast({
      type: 'success',
      title: 'PACK INSTALLED',
      message: `"${pack.title}" active. New cards added to Memory Vault.`
    });
  },

  uninstallPack(packId) {
    const pack = this._packs.find(p => p.id === packId);
    this._installedPackIds.delete(packId);
    this._saveInstalledState();

    // Cleanse injected cards from SM-2 deck
    if (pack && Array.isArray(pack.cards)) {
      try {
        let deck = [];
        const storedDeck = this._app.store.get('sm2.deck');
        if (storedDeck) deck = JSON.parse(storedDeck);
        const cardIds = new Set(pack.cards.map(c => c.id));
        deck = deck.filter(c => !cardIds.has(c.id));
        this._app.store.set('sm2.deck', JSON.stringify(deck));
      } catch (e) {}
    }

    this._renderHUD();
    this._renderPacksGrid();

    this._app?.showToast({
      type: 'info',
      title: 'PACK UNINSTALLED',
      message: `Removed "${pack?.title || packId}" from local active rotation.`
    });
  },

  exportPack(packId) {
    const pack = this._packs.find(p => p.id === packId);
    if (!pack) return;

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(pack, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `${pack.id}.aegis`);
    dlAnchorElem.click();

    this._app?.showToast({
      type: 'success',
      title: 'EXPORT COMPLETE',
      message: `Downloaded ${pack.id}.aegis`
    });
  },

  importPackFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target.result);
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
          throw new Error('Invalid case pack: expected a JSON object.');
        }
        if (!raw.id || !raw.title || !raw.description) {
          throw new Error('Invalid case pack schema: Missing id, title, or description.');
        }
        if (typeof raw.id !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/.test(raw.id)) {
          throw new Error('Invalid case pack id: expected 1-64 chars of [A-Za-z0-9._-].');
        }

        // A case pack is untrusted third-party content — it arrives from whoever handed
        // the operator the file. Neutralise markup in every string before it touches
        // state or the DOM. esc() at render is the other half of this defence.
        const pack = sanitizeDeep(raw);

        // Add to packs list if not present
        const existingIdx = this._packs.findIndex(p => p.id === pack.id);
        if (existingIdx !== -1) {
          this._packs[existingIdx] = pack;
        } else {
          this._packs.unshift(pack);
          // Persist custom pack
          const customStored = this._app.store.get('commons.custom_packs');
          let customPacks = [];
          if (customStored) try { customPacks = JSON.parse(customStored); } catch (err) {}
          customPacks.unshift(pack);
          this._app.store.set('commons.custom_packs', JSON.stringify(customPacks));
        }

        // Auto-install
        this.installPack(pack.id);

        this._app?.showToast({
          type: 'success',
          title: 'PACK IMPORTED & INSTALLED',
          message: `Successfully loaded "${pack.title}".`
        });
      } catch (err) {
        this._app?.showToast({
          type: 'danger',
          title: 'IMPORT FAILED',
          message: err.message || 'File is not a valid .aegis JSON payload.'
        });
      }
    };
    reader.readAsText(file);
  },

  exportFullBackup() {
    const backup = {
      timestamp: new Date().toISOString(),
      appVersion: '1.0.0',
      dossierPins: this._app.store.get('dossier.pins') || '[]',
      sm2Deck: this._app.store.get('sm2.deck') || '[]',
      installedPacks: [...this._installedPackIds],
      arenaElo: this._app.store.get('arena.elo') || '1000',
      arenaHighScore: this._app.store.get('arena.high_score') || '0',
      customPacks: this._app.store.get('commons.custom_packs') || '[]'
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `sovereign_aegis_full_backup_${Date.now()}.aegis`);
    dlAnchorElem.click();

    this._app?.showToast({
      type: 'success',
      title: 'BACKUP CREATED',
      message: 'Full profile, dossier, and memory vault exported.'
    });
  },

  restoreFullBackup(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        // A backup file is as untrusted as a case pack — it is a file on disk that the
        // operator may have received from someone else. Same treatment.
        const backup = sanitizeDeep(JSON.parse(e.target.result));
        if (!backup || typeof backup !== 'object') {
          throw new Error('Invalid backup file structure.');
        }
        if (backup.dossierPins) this._app.store.set('dossier.pins', backup.dossierPins);
        if (backup.sm2Deck) this._app.store.set('sm2.deck', backup.sm2Deck);
        if (backup.arenaElo) this._app.store.set('arena.elo', backup.arenaElo);
        if (backup.arenaHighScore) this._app.store.set('arena.high_score', backup.arenaHighScore);
        if (Array.isArray(backup.installedPacks)) {
          this._installedPackIds = new Set(backup.installedPacks);
          this._saveInstalledState();
        }

        this._renderHUD();
        this._renderPacksGrid();

        this._app?.showToast({
          type: 'success',
          title: 'BACKUP RESTORED',
          message: 'All dossier pins, memory decks, and ELO ratings synchronized.'
        });
      } catch (err) {
        this._app?.showToast({
          type: 'danger',
          title: 'RESTORE FAILED',
          message: 'Invalid backup file structure.'
        });
      }
    };
    reader.readAsText(file);
  },

  _bindEvents() {
    // Dropzone drag & drop handlers
    const dropzone = document.getElementById('commons-dropzone');
    const packFileInput = document.getElementById('input-commons-pack-file');
    const btnBrowse = document.getElementById('btn-browse-pack-file');

    if (dropzone && packFileInput) {
      dropzone.addEventListener('click', () => packFileInput.click());
      btnBrowse?.addEventListener('click', (e) => {
        e.stopPropagation();
        packFileInput.click();
      });

      packFileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) this.importPackFile(file);
      });

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        const file = e.dataTransfer?.files?.[0];
        if (file) this.importPackFile(file);
      });
    }

    // Full Backup & Restore buttons
    document.getElementById('btn-commons-export-backup')?.addEventListener('click', () => this.exportFullBackup());
    
    const restoreInput = document.getElementById('input-commons-restore');
    document.getElementById('btn-commons-restore-backup')?.addEventListener('click', () => restoreInput?.click());
    restoreInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) this.restoreFullBackup(file);
    });

    // Modal Pack Builder
    const modal = document.getElementById('commons-builder-modal');
    const openBtn = document.getElementById('btn-commons-open-builder');
    const closeBtn = document.getElementById('btn-commons-close-builder');
    const cancelBtn = document.getElementById('btn-builder-cancel');
    const exportBtn = document.getElementById('btn-builder-export');

    const toggleModal = (show) => {
      if (modal) {
        if (show) modal.classList.remove('hidden');
        else modal.classList.add('hidden');
      }
    };

    openBtn?.addEventListener('click', () => toggleModal(true));
    closeBtn?.addEventListener('click', () => toggleModal(false));
    cancelBtn?.addEventListener('click', () => toggleModal(false));

    exportBtn?.addEventListener('click', () => {
      const title = document.getElementById('input-builder-title')?.value?.trim();
      const author = document.getElementById('input-builder-author')?.value?.trim() || 'Anonymous Sovereign Analyst';
      const domain = document.getElementById('input-builder-domain')?.value || 'AI Forensics & Statecraft';
      const desc = document.getElementById('input-builder-desc')?.value?.trim();

      if (!title || !desc) {
        this._app?.showToast({ type: 'danger', title: 'FIELDS INCOMPLETE', message: 'Please provide a pack title and description.' });
        return;
      }

      // Collect pinned dossier items
      let dossierCards = [];
      const includeDossier = document.getElementById('check-include-dossier')?.checked;
      if (includeDossier) {
        try {
          const rawPins = this._app.store.get('dossier.pins');
          if (rawPins) {
            const pins = JSON.parse(rawPins);
            dossierCards = pins.map(p => ({
              id: 'card-' + p.id,
              domain: domain,
              prompt: `Dossier Item: ${p.title}`,
              diagnosis: p.title,
              latin: 'Documentum Punctum',
              mechanism: p.content,
              countermeasure: 'Cross-reference with primary multi-source triangulation.'
            }));
          }
        } catch (e) {}
      }

      const customPack = {
        id: 'pack-custom-' + Date.now(),
        title: title,
        author: author,
        version: '1.0.0',
        domain: domain,
        description: desc,
        stats: { scenarios: 1, cards: dossierCards.length, arguments: 1 },
        scenarios: [
          {
            id: 'sc-custom-1',
            title: `${title} Scenario`,
            domain: domain,
            briefing: desc,
            clues: ["Corroborate claims with authenticated logs.", "Audit digital signatures."],
            playbook: "DISARM M0042 (Prebunking)"
          }
        ],
        cards: dossierCards,
        arguments: []
      };

      // Trigger download
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(customPack, null, 2));
      const dlAnchorElem = document.createElement('a');
      dlAnchorElem.setAttribute("href", dataStr);
      dlAnchorElem.setAttribute("download", `${customPack.id}.aegis`);
      dlAnchorElem.click();

      toggleModal(false);
      this._app?.showToast({ type: 'success', title: 'CUSTOM PACK EXPORTED', message: `Saved ${customPack.id}.aegis` });
    });
  }
};
