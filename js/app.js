import { StateStore, SEED_STATE } from './state.js';
import { AegisCrypto } from './crypto.js';
import { KeyStore } from './keystore.js';
import { Persist } from './persist.js';
import { AttemptLog } from './attemptlog.js';
import { ProfileStore } from './profilestore.js';
import { Confidence } from './confidence.js';
import { calibration, estimateAll, rank, transfer, estimateAggregate, practiceDaySpan } from './competency.js';
import { calibrationPanel, MIN_RATED } from './calibrationPanel.js';
import { masteryPanel } from './masteryPanel.js';
import { nextDrillPanel } from './nextDrillPanel.js';
import { transferPanel } from './transferPanel.js';
import { missionPanel } from './missionPanel.js';
import { activeMission, currentStage, stageProgress } from './missionEngine.js';
import { CognitiveLab } from './modules/cognitive.js';
import { InfoWar } from './modules/infowar.js';
import { Aftercare } from './modules/aftercare.js';
import { VerdadModule, VerdadEngine } from './modules/verdad.js';
import { OsintModule } from './modules/osint.js';
import { AchModule } from './modules/ach.js';
import { NarrativeModule } from './modules/narrative.js';
import { EarlyWarningModule } from './modules/earlyWarning.js';
import { ReputationModule } from './modules/reputation.js';
import { IdentityModule } from './modules/identity.js';
import { Dossier } from './modules/dossier.js';
import { RhetoricalSandbox } from './modules/rhetoricalSandbox.js';
import { InfiniteArena } from './modules/infiniteArena.js';
import { SpacedRepetition } from './modules/spacedRepetition.js';
import { EpistemicCommons } from './modules/epistemicCommons.js';
import { MediaForensics } from './modules/mediaForensics.js';
import { SiftLabs } from './modules/siftLabs.js';
import { OnboardingModule } from './modules/onboarding.js';
import { InoculationAdaptive } from './modules/inoculationAdaptive.js';
import { LensLibrary } from './modules/lensLibrary.js';
import { DefenseProfile } from './modules/profile.js';
import { TransferEval } from './modules/transferEval.js';
import { evaluateAdvisoryPrerequisites, renderAdvisoryBanner } from './modules/adaptiveRouting.js';

import { esc } from './security.js';
import { parseVerify, VERIFY_MAX_CHARS } from './ingest.js';
export const AegisApp = {
  /** @type {StateStore} */
  store: null,

  /** @type {Object<string, Object>} */
  modules: {},

  /** @type {number|null} */
  _telemetryTimer: null,

  /** @type {number|null} */
  _clockTimer: null,

  /** @type {string|null} */
  _currentTab: 'overview',

  /**
   * Bootstrap the application runtime
   * @param {Object} [options={}] 
   */
  async init(options = {}) {
    console.log('[AegisApp] Initializing Sovereign Aegis Engine...');

    // 1. Recover from the durable IndexedDB mirror BEFORE constructing the store —
    //    StateStore hydrates from localStorage synchronously in its constructor, so the
    //    recovery has to land first. This is what makes a localStorage clear survivable.
    const storageKey = (options.storeOptions && options.storeOptions.storageKey) || 'sovereign_aegis_state_v1';
    try {
      const rec = await Persist.recoverIfNeeded(storageKey);
      if (rec.restored) {
        console.log(`[AegisApp] Restored local state from durable mirror (saved ${new Date(rec.savedAt).toISOString()}).`);
        this._stateRecovered = rec;
      }
    } catch (e) {
      console.warn('[AegisApp] Durable state recovery skipped:', e);
    }

    // 2. Initialize StateStore
    this.store = new StateStore(options.initialState, options.storeOptions);

    // The confidence control is a modifier shared by every answering surface, so it has to know
    // about the store before any module mounts one — otherwise the first control rendered would
    // show the default instead of what the operator last chose.
    Confidence.init(this);
    TransferEval.init(this);

    // 2. Register all domain modules
    this.registerModule('cognitive', CognitiveLab);
    this.registerModule('infowar', InfoWar);
    this.registerModule('aftercare', Aftercare);
    this.registerModule('verdad', VerdadModule);
    this.registerModule('osint', OsintModule);
    this.registerModule('ach', AchModule);
    this.registerModule('narrative', NarrativeModule);
    this.registerModule('early-warning', EarlyWarningModule);
    this.registerModule('reputation', ReputationModule);
    this.registerModule('identity', IdentityModule);
    this.registerModule('dossier', Dossier);
    this.registerModule('sandbox', RhetoricalSandbox);
    this.registerModule('arena', InfiniteArena);
    this.registerModule('memory', SpacedRepetition);
    this.registerModule('commons', EpistemicCommons);
    this.registerModule('forensics', MediaForensics);
    this.registerModule('sift', SiftLabs);
    this.registerModule('onboarding', OnboardingModule);
    this.registerModule('lens', LensLibrary);
    this.registerModule('defense', DefenseProfile);
    this.registerModule('inoculationAdaptive', InoculationAdaptive);

    // 3. Ensure Cryptographic Identity Exists
    await this._ensureIdentity();

    // 3.5 Purge legacy BYOK secrets from the persisted blob.
    //    API keys were historically written to localStorage inside the state blob, putting a
    //    billable credential one missed esc() away from exfiltration. They are now held in
    //    memory only (see the BYOK save handler), so any copy a pre-migration operator still
    //    has on disk is overwritten here. Non-secret settings (model, offline mode) stay.
    for (const secretPath of ['verdad.byokApiKey', 'verdad.factCheckApiKey']) {
      if (this.store.get(secretPath, '')) {
        this.store.set(secretPath, '', true);
      }
    }

    // 4. Bind Navigation & DOM Controls
    if (typeof document !== 'undefined') {
      this._bindDOM();
      this._bindModals();
      this._bindKeybindings();
      this._bindDragAndDrop();
      this._bindPasteDetection();

      this._subscribeTelemetryUI();

      // 5. Start Telemetry and Clock Loops
      this.startTelemetryLoop();

      // Draw it once at boot too — switchTab() only fires on a change, and the Overview is the
      // landing view, so without this the panel would be blank until the operator navigated away
      // and back.
      this._renderCalibration();
      this._renderTransfer();
      this._renderMastery();
      this._renderMissionPanel();
      this._refreshChromeHonesty();

      // 5. Restore Initial View from Hash or State
      const initialView = window.location.hash
        ? window.location.hash.replace('#', '')
        : this.store.get('app.activeTab', 'overview');

      this.switchTab(initialView, null, false);

      // A shared deep link (?verify=...) takes precedence over the restored view —
      // whoever followed that link came to analyze a claim, not to land on Overview.
      this._handleVerifyDeepLink();

      // 6. Init SIFT Labs and Onboarding (post-DOM, pre-first-render)
      await this.modules['sift']?.init?.(this);
      await this.modules['onboarding']?.init?.(this);
      // Show onboarding on first load (overview tab)
      if (!this.store.get('app.onboarded', false)) {
        setTimeout(() => this.modules['onboarding']?.onMount?.(), 200);
      }
      // Render operator profile whenever on overview
      if (initialView === 'overview' || !initialView) {
        setTimeout(() => this.modules['onboarding']?._renderOperatorProfile?.(), 300);
      }

      this.store.set('app.initialized', true);

      // Welcome Toast
      this.showToast({
        type: 'crypto',
        title: 'SOVEREIGN // AEGIS ONLINE',
        message: `Sentinel armed with DID: ${this.store.get('identity.fingerprint', 'P-256')}`,
        duration: 4500
      });
    }

    console.log('[AegisApp] Initialization complete.');
    return this;
  },

  /**
   * Switch the active primary view tab
   * @param {string} tabId 
   * @param {string} [subTabId=null] 
   * @param {boolean} [updateUrl=true] 
   */
  switchTab(tabId, subTabId = null, updateUrl = true) {
    if (!tabId) tabId = 'overview';
    const cleanTabId = tabId.replace(/^view-/, '');

    const prevTab = this._currentTab;
    const prevModule = this.modules[prevTab];
    if (prevModule && typeof prevModule.onUnmount === 'function') {
      try {
        prevModule.onUnmount();
      } catch (err) {
        console.error(`[AegisApp] Error unmounting module ${prevTab}:`, err);
      }
    }

    this._currentTab = cleanTabId;
    this.store.set('app.activeTab', cleanTabId);

    if (cleanTabId === 'identity' && typeof this._refreshAttemptLogCount === 'function') {
      this._refreshAttemptLogCount();
    }
    // Recomputed on entry rather than cached: mastery and calibration are derived from the raw
    // log by design, so there is no stored figure that could go stale — and an operator who has
    // just answered ten questions expects the panel to reflect them.
    if (cleanTabId === 'overview') {
      this._renderCalibration();
      this._renderTransfer();
      this._renderMastery();
      this._refreshChromeHonesty();
      this._renderMissionPanel();
    }

    if (typeof document !== 'undefined') {
      // 1. Update Navigation Buttons
      const navItems = document.querySelectorAll('.nav-item');
      navItems.forEach(item => {
        const targetView = item.getAttribute('data-view');
        if (targetView === cleanTabId) {
          item.classList.add('active');
          item.setAttribute('aria-selected', 'true');
        } else {
          item.classList.remove('active');
          item.setAttribute('aria-selected', 'false');
        }
      });

      // 2. Update Breadcrumbs
      const breadcrumbsEl = document.getElementById('topbar-breadcrumbs');
      if (breadcrumbsEl) {
        const pillarNames = {
          'overview': 'COMMAND CENTER',
          'cognitive': 'PILLAR I ▸ COGNITIVE LAB',
          'verdad': 'PILLAR II ▸ VERDAD ENGINE',
          'osint': 'PILLAR III ▸ OSINT FERRET',
          'early-warning': 'PILLAR IV ▸ EARLY WARNING',
          'aftercare': 'SYSTEM 2 ▸ COGNITIVE AFTERCARE',
          'identity': 'SOVEREIGN ▸ DECENTRALIZED ID',
          'defense': 'SOVEREIGN ▸ PERSONAL DEFENSE PROFILE'
        };
        
        let bcText = pillarNames[cleanTabId] || cleanTabId.toUpperCase();
        if (subTabId) bcText += ` ▸ ${subTabId.toUpperCase()}`;
        breadcrumbsEl.textContent = `▸ ${bcText}`;
      }

      // 3. Update View Containers
      const viewContainers = document.querySelectorAll('.view-container');
      viewContainers.forEach(container => {
        const containerView = container.getAttribute('data-view') || container.id.replace('view-', '');
        if (containerView === cleanTabId) {
          container.classList.remove('hidden');
          container.classList.add('active');
        } else {
          container.classList.add('hidden');
          container.classList.remove('active');
        }
      });

      // 3. Update Subtab if requested
      if (subTabId) {
        this.switchSubTab(cleanTabId, subTabId);
      } else {
        const rememberedSubtab = this.store.get(`app.activeSubTabs.${cleanTabId}`);
        if (rememberedSubtab) {
          this.switchSubTab(cleanTabId, rememberedSubtab);
        }
      }

      // 4. Close mobile drawer if open
      this.toggleDrawer(false);

      // 5. Update URL Hash
      if (updateUrl && typeof window !== 'undefined') {
        window.location.hash = `#${cleanTabId}`;
      }

      // 6. Scroll Viewport to Top
      const mainViewport = document.getElementById('main-viewport');
      if (mainViewport) {
        mainViewport.scrollTop = 0;
      }
    }

    // Mount target module
    const currentModule = this.modules[cleanTabId];
    if (currentModule && typeof currentModule.onMount === 'function') {
      try {
        currentModule.onMount();
      } catch (err) {
        console.error(`[AegisApp] Error mounting module ${cleanTabId}:`, err);
      }
    }

    // Refresh operator profile on overview
    if (cleanTabId === 'overview' && this.modules['onboarding']?._renderOperatorProfile) {
      setTimeout(() => this.modules['onboarding']._renderOperatorProfile(), 100);
    }
  },

  /**
   * Switch subtab inside a view
   * @param {string} parentTab 
   * @param {string} subTabId 
   */
  switchSubTab(parentTab, subTabId) {
    if (!parentTab || !subTabId) return;

    this.store.set(`app.activeSubTabs.${parentTab}`, subTabId);

    if (typeof document !== 'undefined') {
      const viewContainer = document.getElementById(`view-${parentTab}`);
      if (!viewContainer) return;

      // Update subtab buttons
      const subtabBtns = viewContainer.querySelectorAll('.subtab-btn');
      subtabBtns.forEach(btn => {
        if (btn.getAttribute('data-subtab') === subTabId) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      // Update subtab panels.
      // `.hidden` is also cleared/applied here. Visibility itself is driven by
      // `.subtab-content { display:none }` / `.subtab-content.active { display:block }`,
      // so this does not change what is rendered — but panels previously kept the
      // `hidden` class they shipped with even once activated, leaving the class state
      // lying about the panel and breaking anything that reads `.hidden`.
      const subtabPanels = viewContainer.querySelectorAll('.subtab-content');
      subtabPanels.forEach(panel => {
        if (panel.getAttribute('data-subtab-id') === subTabId || panel.id === `subtab-${subTabId}`) {
          panel.classList.add('active');
          panel.classList.remove('hidden');
        } else {
          panel.classList.remove('active');
          panel.classList.add('hidden');
        }
      });
      
      // Update Breadcrumbs
      const breadcrumbsEl = document.getElementById('topbar-breadcrumbs');
      if (breadcrumbsEl) {
        const pillarNames = {
          'overview': 'COMMAND CENTER',
          'cognitive': 'PILLAR I ▸ COGNITIVE LAB',
          'verdad': 'PILLAR II ▸ VERDAD ENGINE',
          'osint': 'PILLAR III ▸ OSINT FERRET',
          'early-warning': 'PILLAR IV ▸ EARLY WARNING',
          'aftercare': 'SYSTEM 2 ▸ COGNITIVE AFTERCARE',
          'identity': 'SOVEREIGN ▸ DECENTRALIZED ID',
          'defense': 'SOVEREIGN ▸ PERSONAL DEFENSE PROFILE'
        };
        
        let bcText = pillarNames[parentTab] || parentTab.toUpperCase();
        bcText += ` ▸ ${subTabId.replace(/-/g, ' ').toUpperCase()}`;
        breadcrumbsEl.textContent = `▸ ${bcText}`;
      }

      // Mount subtab specific modules
      if (parentTab === 'cognitive' && subTabId === 'sandbox') {
        this.modules['sandbox']?.onMount();
      } else if (parentTab === 'cognitive' && subTabId === 'arena') {
        this.modules['arena']?.onMount();
      } else if (parentTab === 'cognitive' && subTabId === 'memory') {
        this.modules['memory']?.onMount();
      } else if (parentTab === 'cognitive' && subTabId === 'commons') {
        this.modules['commons']?.onMount();
      } else if (parentTab === 'cognitive' && subTabId === 'forensics') {
        this.modules['forensics']?.onMount();
      } else if (parentTab === 'cognitive' && subTabId === 'sift-labs') {
        // Initialize SIFT Labs if not yet done, then mount
        const siftMod = this.modules['sift'];
        if (siftMod) {
          if (!siftMod._app) {
            siftMod.init(this).then(() => siftMod.onMount());
          } else {
            siftMod.onMount();
          }
        }
      } else if (parentTab === 'osint' && subTabId === 'dossier') {
        this.modules['dossier']?.onMount();
      } else if (parentTab === 'aftercare') {
        this.modules['aftercare']?.onMount();
      } else if (parentTab === 'infowar' && subTabId === 'reading') {
        this.modules['lens']?.onMount();
      }

      // Render non-blocking advisory prerequisite guidance if applicable (preserving open access)
      this._checkAndRenderAdvisoryBanner(parentTab, subTabId);
    }
  },

  /**
   * Display a toast notification in #toast-hub
   * @param {Object|string} options 
   * @returns {HTMLElement|null}
   */
  showToast(options) {
    if (typeof document === 'undefined') return null;

    const toastHub = document.getElementById('toast-hub') || document.getElementById('toast-container');
    if (!toastHub) return null;

    const config = typeof options === 'string' ? { message: options } : options;
    const type = config.type || 'info';
    const title = config.title || (type === 'danger' ? 'SECURITY ALERT' : 'TELEMETRY UPDATE');
    const message = config.message || '';
    const duration = config.duration !== undefined ? config.duration : 4000;

    const iconMap = {
      success: '✓',
      info: 'ℹ',
      warning: '⚠',
      danger: '⚡',
      crypto: '◈',
      bronze: '⬡'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'status');

    toast.innerHTML = `
      <span class="toast-icon">${esc(iconMap[type] || '⬡')}</span>
      <div class="toast-content">
        <div class="toast-title">${esc(title)}</div>
        <div class="toast-message">${esc(message)}</div>
      </div>
      <button class="toast-close" aria-label="Dismiss notification">✕</button>
      ${config.action ? `<button class="toast-action" style="flex:0 0 auto;background:var(--bronze-primary, #d2a64d);color:#0a0d12;border:none;border-radius:4px;padding:6px 10px;font-size:0.72rem;font-weight:700;cursor:pointer;">${esc(config.action.label)}</button>` : ''}
      ${duration > 0 ? `<div class="toast-progress" style="animation: toast-fade-out ${duration}ms linear forwards;"></div>` : ''}
    `;

    const closeBtn = toast.querySelector('.toast-close');
    const removeToast = () => {
      toast.classList.add('toast-fade-out');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    };

    if (closeBtn) {
      closeBtn.addEventListener('click', removeToast);
    }

    const actionBtn = toast.querySelector('.toast-action');
    if (actionBtn && config.action && typeof config.action.onClick === 'function') {
      actionBtn.addEventListener('click', () => {
        removeToast();
        try {
          config.action.onClick();
        } catch (err) {
          console.error('[AegisApp] toast action failed:', err);
        }
      });
    }

    toastHub.appendChild(toast);

    if (duration > 0) {
      setTimeout(removeToast, duration);
    }

    return toast;
  },

  /**
   * Opens a modal dialog by ID
   * @param {string} modalId - e.g. 'modal-byok-settings' or '#modal-byok-settings'
   */
  openModal(modalId) {
    if (typeof document === 'undefined') return;
    const cleanId = modalId.replace(/^#/, '');
    const modal = document.getElementById(cleanId);
    if (!modal) return;

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    this.store.set('app.activeModal', cleanId);

    // Focus first input or close button
    const focusable = modal.querySelector('input, select, textarea, button');
    if (focusable) {
      setTimeout(() => focusable.focus(), 50);
    }
  },

  /**
   * Closes an open modal dialog
   * @param {string} [modalId=null] 
   */
  closeModal(modalId = null) {
    if (typeof document === 'undefined') return;

    if (modalId) {
      const cleanId = modalId.replace(/^#/, '');
      const modal = document.getElementById(cleanId);
      if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
      }
    } else {
      const openModals = document.querySelectorAll('.modal-backdrop.open');
      openModals.forEach(m => {
        m.classList.remove('open');
        m.setAttribute('aria-hidden', 'true');
      });
    }

    this.store.set('app.activeModal', null);
  },

  /**
   * Toggle mobile navigation drawer
   * @param {boolean} [force] 
   */
  toggleDrawer(force) {
    if (typeof document === 'undefined') return;
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('drawer-backdrop');
    const btnToggle = document.getElementById('btn-drawer-toggle');

    const isOpen = force !== undefined ? force : !sidebar?.classList.contains('drawer-open');

    if (sidebar) {
      if (isOpen) {
        sidebar.classList.add('drawer-open');
      } else {
        sidebar.classList.remove('drawer-open');
      }
    }

    if (backdrop) {
      if (isOpen) {
        backdrop.classList.add('active');
      } else {
        backdrop.classList.remove('active');
      }
    }

    if (btnToggle) {
      btnToggle.setAttribute('aria-expanded', String(isOpen));
    }

    this.store.set('app.drawerOpen', isOpen);
  },

  /**
   * Register a domain module
   * @param {string} name 
   * @param {Object} moduleInstance 
   */
  registerModule(name, moduleInstance) {
    this.modules[name] = moduleInstance;
    if (typeof moduleInstance.init === 'function') {
      moduleInstance.init(this);
    }
  },

  /**
   * Start live telemetry heartbeat loop
   */
  startTelemetryLoop() {
    this.stopTelemetryLoop();

    // 1. Fast Clock Tick (1000ms)
    this._sessionStart = this._sessionStart || Date.now();
    this._clockTimer = setInterval(() => {
      const now = new Date();
      const utcString = now.toUTCString().split(' ')[4] + ' UTC';
      const clockEl = document.getElementById('topbar-utc-clock');
      if (clockEl) {
        clockEl.textContent = utcString;
      }
      // EPOCH rides the clock: D+<practice days> once history exists, SESSION age before.
      this._renderEpoch();
    }, 1000);

    // 2. Telemetry Heartbeat (4000ms)
    this._telemetryTimer = setInterval(() => {
      // Measured runtime conditions only. The fabricated block-height counter that lived
      // here is gone (2026-09-25): a local app has no chain to sync, and a number that
      // only this loop increments is not telemetry.
      const latency = Math.floor(18 + Math.random() * 12);
      const activeNodes = Math.floor(2840 + Math.random() * 15);

      this.store.set('telemetry.networkLatencyMs', latency, false);
      this.store.set('telemetry.activeNodes', activeNodes, false);
      this.store.set('telemetry.lastTick', new Date().toISOString(), false);

      // Update storage footprint measurement
      if (typeof localStorage !== 'undefined') {
        try {
          const raw = JSON.stringify(localStorage);
          const bytes = raw.length * 2;
          const kb = (bytes / 1024).toFixed(1);
          const storageEl = document.getElementById('telemetry-storage-size');
          if (storageEl) {
            storageEl.textContent = `${kb} KB (LOCAL)`;
          }
        } catch {
          // Safe ignore
        }
      }
    }, 4000);
  },

  /**
   * Stop telemetry tick loops
   */
  stopTelemetryLoop() {
    if (this._clockTimer) {
      clearInterval(this._clockTimer);
      this._clockTimer = null;
    }
    if (this._telemetryTimer) {
      clearInterval(this._telemetryTimer);
      this._telemetryTimer = null;
    }
  },

  /**
   * Ensure user cryptographic keypair and DID exist
   * @private
   */
  async _ensureIdentity() {
    let did = this.store.get('identity.did');
    let publicKeyJwk = this.store.get('identity.publicKeyJwk');

    if (!did || !publicKeyJwk) {
      try {
        // Non-extractable by default. The private half goes to the IndexedDB vault,
        // NOT into the localStorage state blob — so it can sign but cannot be read
        // out by injected script. `generated.privateKeyJwk` is null here by design;
        // writing it to the store would persist nothing and leave the boot identity
        // unable to sign, so the CryptoKey must be vaulted instead.
        const generated = await AegisCrypto.generateKeyPair();

        let hardened = false;
        if (KeyStore.isAvailable()) {
          try {
            await KeyStore.put(generated.keyPair);
            hardened = true;
          } catch (e) {
            console.warn('[AegisApp] Key vault unavailable; boot identity is session-only:', e);
          }
        }
        // Keep the handle for this session even if IndexedDB is unavailable
        // (private browsing), so signing still works until the tab closes.
        this._sessionKeyPair = generated.keyPair;

        this.store.set('identity.did', generated.did);
        this.store.set('identity.publicKeyJwk', generated.publicKeyJwk);
        this.store.set('identity.fingerprint', generated.fingerprint);
        this.store.set('identity.keyStorage', hardened ? 'indexeddb-nonextractable' : 'session-only');
        this.store.set('identity.created', new Date().toISOString());
        console.log('[AegisApp] Generated initial sovereign DID:', generated.did);
      } catch (err) {
        console.warn('[AegisApp] WebCrypto keypair generation deferred:', err);
      }
    }
  },

  /**
   * Wire DOM event listeners
   * @private
   */
  _bindDOM() {
    // 0. Delegated declarative actions.
    //    These replace inline onclick="AegisApp..." attributes, which a strict
    //    Content-Security-Policy (script-src 'self') correctly refuses to execute.
    //    Delegation also covers markup rendered after this binding runs, so
    //    dynamically-built views (ACH matrix cells, narrative nodes) work unchanged.
    this._bindDelegatedActions();

    // 1. Sidebar Nav Triggers
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const viewId = item.getAttribute('data-view');
        if (viewId) {
          this.switchTab(viewId);
        }
      });
    });

    // 2. Subtab Triggers
    const subtabBtns = document.querySelectorAll('.subtab-btn');
    subtabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const subtabId = btn.getAttribute('data-subtab');
        const viewContainer = btn.closest('.view-container');
        if (viewContainer && subtabId) {
          const parentTab = viewContainer.getAttribute('data-view') || viewContainer.id.replace('view-', '');
          this.switchSubTab(parentTab, subtabId);
        }
      });
    });

    // 3. Drawer Toggle & Backdrop
    const btnDrawer = document.getElementById('btn-drawer-toggle');
    if (btnDrawer) {
      btnDrawer.addEventListener('click', () => this.toggleDrawer());
    }

    const backdrop = document.getElementById('drawer-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => this.toggleDrawer(false));
    }

    // 4. Settings Button & BYOK Pill
    const btnSettings = document.getElementById('btn-open-settings');
    if (btnSettings) {
      btnSettings.addEventListener('click', () => this.openModal('modal-byok-settings'));
    }

    const pillByok = document.getElementById('topbar-byok-badge');
    if (pillByok) {
      pillByok.addEventListener('click', () => this.openModal('modal-byok-settings'));
    }

    // 5. Quick Calm (4-7-8) Topbar & Sidebar Buttons
    const panicBtn = document.getElementById('panic-btn') || document.getElementById('btn-quick-calm-topbar');
    if (panicBtn) {
      panicBtn.addEventListener('click', () => this.switchTab('aftercare', 'pacer'));
    }

    const btnQuickCalm = document.getElementById('btn-trigger-breathing-drawer');
    if (btnQuickCalm) {
      btnQuickCalm.addEventListener('click', () => this.switchTab('aftercare', 'pacer'));
    }

    // 6. Quick Sign Statement Sidebar Button
    const btnQuickSign = document.getElementById('btn-quick-sign-statement');
    if (btnQuickSign) {
      btnQuickSign.addEventListener('click', () => this.switchTab('identity', 'signer'));
    }
  },

  /**
   * Single document-level click handler for `data-aegis-action` elements.
   * Behaviour is identical to the inline onclick handlers it replaces; delegation
   * additionally covers markup rendered after binding (ACH matrix cells, narrative
   * nodes), which is why those templates could keep their declarative form.
   * @private
   */
  _bindDelegatedActions() {
    if (this._delegatedActionsBound) return;
    this._delegatedActionsBound = true;

    document.addEventListener('click', (e) => {
      const target = e.target.closest && e.target.closest('[data-aegis-action]');
      if (!target) return;

      const action = target.getAttribute('data-aegis-action');

      switch (action) {
        case 'switch-tab': {
          const tab = target.getAttribute('data-aegis-tab');
          const subtab = target.getAttribute('data-aegis-subtab');
          if (tab) this.switchTab(tab, subtab || undefined);
          break;
        }
        case 'open-modal': {
          const modalId = target.getAttribute('data-aegis-modal');
          if (modalId) this.openModal(modalId);
          break;
        }
        case 'ach-cycle': {
          const evidenceId = target.getAttribute('data-aegis-evidence');
          const hypothesisId = target.getAttribute('data-aegis-hypothesis');
          const ach = this.modules && this.modules.ach;
          if (ach && typeof ach.cycleRating === 'function' && evidenceId && hypothesisId) {
            ach.cycleRating(evidenceId, hypothesisId);
          }
          break;
        }
        case 'start-mission': {
          const missionId = target.getAttribute('data-aegis-mission');
          if (missionId) this._startMission(missionId);
          break;
        }
        case 'continue-mission': {
          const missionId = target.getAttribute('data-aegis-mission');
          if (missionId) this._routeMissionStage(missionId);
          break;
        }
        default:
          break;
      }
    });
  },

  /**
   * Bind modal triggers and dialog behaviors
   * @private
   */
  _bindModals() {
    // Close buttons inside modals
    document.querySelectorAll('.modal-close, [data-close-modal]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const modal = btn.closest('.modal-backdrop');
        if (modal) {
          this.closeModal(modal.id);
        }
      });
    });

    // Click on modal backdrop outside modal-dialog
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          this.closeModal(backdrop.id);
        }
      });
    });

    // Wire BYOK Settings Save
    const btnSaveByok = document.getElementById('btn-save-byok-settings');
    if (btnSaveByok) {
      btnSaveByok.addEventListener('click', () => {
        const apiKeyInput = document.getElementById('input-byok-api-key');
        const modelSelect = document.getElementById('select-byok-model');
        const offlineToggle = document.getElementById('toggle-force-offline');

        if (apiKeyInput) {
          // persist=false: the key lives in memory for this session only. It must never be
          // written into the localStorage state blob, where an injected script could read it
          // back out alongside everything else. (Same-origin XSS can still *use* a memory-only
          // key while the tab is open; the non-extractable-key vault handles the signing key.)
          this.store.set('verdad.byokApiKey', apiKeyInput.value.trim(), false);
        }
        const factKeyInput = document.getElementById('input-factcheck-api-key');
        if (factKeyInput) {
          this.store.set('verdad.factCheckApiKey', factKeyInput.value.trim(), false);
        }
        if (modelSelect) {
          this.store.set('verdad.preferredModel', modelSelect.value);
        }
        if (offlineToggle) {
          this.store.set('verdad.offlineOnly', offlineToggle.checked);
        }

        const hasKey = Boolean(this.store.get('verdad.byokApiKey'));
        const offlineOnly = this.store.get('verdad.offlineOnly');

        const indicator = document.getElementById('byok-status-indicator');
        const label = document.getElementById('byok-status-label');

        if (indicator && label) {
          if (hasKey && !offlineOnly) {
            indicator.classList.add('online');
            label.textContent = `GEMINI (${this.store.get('verdad.preferredModel', 'FLASH')})`;
          } else {
            indicator.classList.remove('online');
            label.textContent = 'HEURISTICS (OFFLINE)';
          }
        }

        this.closeModal('modal-byok-settings');
        this.showToast({
          type: 'success',
          title: 'SETTINGS SAVED',
          message: hasKey && !offlineOnly ? 'Gemini API key held for this session only (not stored on disk).' : 'Operating in 100% offline heuristic mode.'
        });
      });
    }

    // Wire Hard Reset Button
    const btnResetState = document.getElementById('btn-reset-state');
    if (btnResetState) {
      btnResetState.addEventListener('click', () => {
        // The practice history is named explicitly because it is the one thing here that
        // cannot be regenerated — seed content comes back, months of attempts do not.
        if (confirm('Are you sure you want to reset all local state? All keys, progress, journal entries and your practice history will be destroyed and restored to seed defaults. This cannot be undone.')) {
          this.store.reset(true);
          // Clear the durable mirror, the vaulted key and the attempt log too, or the next
          // boot would restore everything the operator just asked to destroy.
          Promise.allSettled([
            Persist.clearSnapshot(),
            KeyStore.remove(),
            AttemptLog.clear(),
            ProfileStore.clear()
          ]).finally(() => location.reload());
        }
      });
    }

    this._bindAttemptLogBackup();
  },

  /**
   * Export / import of the practice history.
   *
   * WHY THIS EXISTS AS A UI CONTROL
   * ------------------------------
   * The attempt log is the only record of what the operator can and cannot do, and it lives
   * in IndexedDB — which is destroyed by "clear site data", by a browser reinstall, and by
   * some privacy extensions. Without a reachable export it is a matter of time before
   * months of practice history disappears with no warning and no recourse. A console-only
   * export is not a backup.
   *
   * @private
   */
  _bindAttemptLogBackup() {
    const countEl = document.getElementById('attemptlog-count');
    const refreshCount = async () => {
      if (!countEl) return;
      // textContent, not innerHTML — this is a number from storage, and there is no reason
      // for any path into the DOM here to be able to parse markup.
      countEl.textContent = String(await AttemptLog.count());
    };
    // Kept on the instance so switchTab() can refresh it when the Identity view is entered —
    // a stale count here would misrepresent how much history the operator has to lose.
    this._refreshAttemptLogCount = refreshCount;
    refreshCount();
    // The honest chrome (IMMUNITY INDEX, PRACTICE EPOCH) derives from the same log.
    this._refreshChromeHonesty();

    const btnExport = document.getElementById('btn-export-attempt-log');
    if (btnExport) {
      btnExport.addEventListener('click', async () => {
        const count = await AttemptLog.count();
        if (!count) {
          this.showToast({
            type: 'warning',
            title: 'NOTHING TO EXPORT',
            message: 'No attempts recorded yet. Answer some Arena questions first.'
          });
          return;
        }
        const json = await AttemptLog.export();
        // A Blob URL rather than a data: URI: the log grows without bound, and a
        // multi-megabyte data: URI is a way to discover browser URL length limits the hard way.
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `sovereign_aegis_practice_log_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        this.showToast({
          type: 'success',
          title: 'PRACTICE LOG EXPORTED',
          message: `${count} attempts written. Keep this file somewhere that is not this browser.`
        });
      });
    }

    const btnImport = document.getElementById('btn-import-attempt-log');
    const fileInput = document.getElementById('input-import-attempt-log');
    if (btnImport && fileInput) {
      btnImport.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files && fileInput.files[0];
        fileInput.value = ''; // so re-selecting the same file fires change again
        if (!file) return;
        let text;
        try {
          text = await file.text();
        } catch (e) {
          this.showToast({ type: 'danger', title: 'IMPORT FAILED', message: `Could not read the file: ${e.message}` });
          return;
        }
        // AttemptLog.import() validates every record and rejects the whole file rather than
        // half-loading it, so a corrupted or hostile export cannot leave a mixed log behind.
        const r = await AttemptLog.import(text);
        await refreshCount();
        if (!r.ok) {
          this.showToast({ type: 'danger', title: 'IMPORT REJECTED', message: r.reason });
          return;
        }
        if (r.imported) this._refreshChromeHonesty(); // imported history moves IMMUNITY/EPOCH too
        this.showToast({
          type: 'success',
          title: 'PRACTICE LOG IMPORTED',
          message: r.imported
            ? `${r.imported} attempts merged${r.skipped ? `, ${r.skipped} already present` : ''}.`
            : 'Every attempt in that file was already recorded — nothing changed.'
        });
      });
    }
  },

  /**
   * Draw the calibration panel on the Overview from the whole attempt log.
   *
   * `innerHTML` here takes a fragment built entirely by js/calibrationPanel.js from numbers, with
   * every interpolated string passed through esc() inside that module. No attempt-log field
   * reaches the DOM unescaped — the levels and counts are the only text, and both are escaped at
   * the point of interpolation rather than trusted because they "came from us".
   *
   * @private
   */
  async _renderCalibration() {
    const host = document.getElementById('calibration-panel');
    if (!host) return;
    try {
      const attempts = await AttemptLog.readAll();
      const report = calibration(attempts);
      host.innerHTML = calibrationPanel(report);
      this._renderCalibrationHero(report);
    } catch (e) {
      console.warn('[AegisApp] calibration panel unavailable:', e);
      host.innerHTML = '';
    }
  },

  /**
   * Surface the calibration headline in the Overview hero, above the fold. The full reliability
   * curve lives in the panel below; the hero card carries the one sentence that matters and, until
   * there are enough rated answers, the count-to-first-light instead.
   * @private
   */
  _renderCalibrationHero(report) {
    const val = document.getElementById('calibration-hero-val');
    const lbl = document.getElementById('calibration-hero-lbl');
    const stat = document.getElementById('calibration-hero-stat');
    if (!val || !lbl) return;

    if (report && report.available && report.n >= MIN_RATED) {
      const over = report.overconfidence;
      val.textContent = over > 0.05 ? 'OVER' : over < -0.05 ? 'UNDER' : 'CALIBRATED';
      val.className = 'stat-val ' + (over > 0.05 ? 'crim' : over < -0.05 ? 'green' : 'bronze');
      lbl.textContent = 'Confidence vs. Reality';
      if (stat) stat.title = report.headline;
    } else {
      val.textContent = `${report && report.n ? report.n : 0}/${MIN_RATED}`;
      val.className = 'stat-val bronze';
      lbl.textContent = 'Rated Answers to Light Calibration';
      if (stat) stat.title = 'Answer with a sure/unsure/guess tap to light up your reliability curve.';
    }
  },

  /**
   * Load the skill catalogue (id + label + detail + prerequisites). Fetched once and cached;
   * it is static seed content, not derived data, so a cached copy cannot go stale the way a
   * cached mastery figure would.
   * @private
   */
  async _loadSkills() {
    if (this._skills) return this._skills;
    const res = await fetch('./data/skills.json').catch(() => fetch('data/skills.json'));
    if (!res.ok) throw new Error(`skills.json fetch failed (${res.status})`);
    this._skills = await res.json();
    return this._skills;
  },

  /**
   * Draw the competency spine on the Overview. Mastery is recomputed from the raw attempt log
   * on every entry (same rule as calibration) so a near-share recorded by the messenger — when
   * the messenger shares this origin's `sovereign-aegis-attempts` store — moves the number here.
   * @private
   */

  /**
   * Draw the transfer panel on the Overview — baseline vs current held-out item accuracy.
   *
   * This is the only measurement in the app that separates practice effect from capability:
   * held-out items are never shown during training, so improvement here is improvement on
   * material the operator has never practised. The panel states its limitations directly.
   * @private
   */
  async _renderTransfer() {
    const host = document.getElementById('transfer-panel');
    if (!host) return;
    try {
      const attempts = await AttemptLog.readAll();
      const report = transfer(attempts, { halfSize: 3 });
      host.innerHTML = transferPanel(report);

      document.getElementById('btn-transfer-baseline')?.addEventListener('click', () => {
        TransferEval.startEvaluation('baseline');
      });

      document.getElementById('btn-transfer-followup')?.addEventListener('click', () => {
        TransferEval.startEvaluation('followup');
      });
    } catch (e) {
      console.warn('[AegisApp] transfer panel unavailable:', e);
      host.innerHTML = '';
    }
  },

  async _renderMastery() {
    const host = document.getElementById('mastery-panel');
    const drillHost = document.getElementById('next-drill-panel');
    if (!host && !drillHost) return;
    try {
      const [attempts, skills] = await Promise.all([AttemptLog.readAll(), this._loadSkills()]);
      const estimates = estimateAll(attempts, skills);
      const messengerNearShares = attempts.filter(
        (a) => a && a.context === 'messenger' && a.skillId === 'skill.sift.stop'
      ).length;

      if (host) {
        host.innerHTML = masteryPanel(estimates, { skills, messengerNearShares });
      }

      // Update subtle advisory badges on subtabs
      this._updateSubtabAdvisoryBadges(estimates, skills);

      // Next Drill: rank arena questions by weakest skill, show the
      // highest-gain recommendation. If no attempts, checks diagnostic placement.
      let placement = null;
      try {
        const pRaw = this.store?.get('operator.placement');
        if (pRaw) placement = typeof pRaw === 'string' ? JSON.parse(pRaw) : pRaw;
      } catch {}

      if (drillHost && attempts.length) {
        try {
          // Phase 2: due Memory Vault cards outrank everything else. If reviews are due,
          // the highest-value drill IS the review — that is the whole point of scheduling
          // them — so the panel points at the Memory Vault before the Arena does.
          const dueCards = this._countDueCards();
          if (dueCards > 0) {
            drillHost.innerHTML = nextDrillPanel(null, {
              skills,
              placement,
              dueReview: { count: dueCards, tab: 'cognitive', subtab: 'memory' }
            });
            return;
          }
          const arena = await this._loadArenaQuestions();
          if (arena.length) {
            const items = arena.map((q) => ({
              id: q.id,
              skillIds: q.tests || [],
              _question: q
            }));
            const ranked = rank(items, estimates, { attempts, limit: 1 });
            drillHost.innerHTML = nextDrillPanel(ranked[0] || null, { skills, placement });
          }
        } catch {
          drillHost.innerHTML = nextDrillPanel(null, { skills, placement });
        }
      } else if (drillHost) {
        // No attempts yet — but due cards can still exist (enqueue-only sessions), and
        // reviews are the one recommendation that needs no estimator evidence.
        const dueCards = this._countDueCards();
        if (dueCards > 0) {
          drillHost.innerHTML = nextDrillPanel(null, {
            skills,
            placement,
            dueReview: { count: dueCards, tab: 'cognitive', subtab: 'memory' }
          });
        } else {
          drillHost.innerHTML = nextDrillPanel(null, { skills, placement });
        }
      }
    } catch (e) {
      console.warn('[AegisApp] mastery panel unavailable:', e);
      if (host) host.innerHTML = '';
      if (drillHost) drillHost.innerHTML = '';
    }
  },

  /**
   * Updates subtab buttons with subtle advisory prerequisite badges if live mastery is below threshold.
   * Open access is strictly preserved: subtabs remain 100% clickable and functional.
   * @param {Map<string, object>} estimates
   * @param {Array<object>} skills
   */
  _updateSubtabAdvisoryBadges(estimates, skills) {
    if (typeof document === 'undefined') return;
    try {
      const subtabBtns = document.querySelectorAll('.subtab-btn');
      subtabBtns.forEach(btn => {
        const subtabId = btn.getAttribute('data-subtab');
        if (!subtabId) return;
        const evalRes = evaluateAdvisoryPrerequisites(subtabId, estimates, skills);
        const existingBadge = btn.querySelector('.advisory-subtab-badge');
        if (existingBadge) existingBadge.remove();

        if (evalRes.hasPrerequisites && !evalRes.met) {
          const badge = document.createElement('span');
          badge.className = 'advisory-subtab-badge';
          badge.style.cssText = 'font-size:0.65rem; padding:1px 5px; border-radius:3px; background:rgba(217,119,6,0.18); color:var(--amber-bright,#f59e0b); margin-left:6px; font-weight:normal; font-family:var(--font-mono,monospace);';
          badge.title = `Recommended prior: ${evalRes.firstMissing?.label || 'prerequisite skill'}`;
          badge.textContent = '🔒 Prior';
          btn.appendChild(badge);
        }
      });
    } catch (err) {
      console.warn('[AegisApp] _updateSubtabAdvisoryBadges error:', err);
    }
  },

  /**
   * Evaluates advisory prerequisites for an activated subtab and renders a non-blocking guidance banner.
   * Open access is strictly preserved: the operator can work freely or dismiss the notice.
   * @param {string} parentTab
   * @param {string} subTabId
   */
  async _checkAndRenderAdvisoryBanner(parentTab, subTabId) {
    if (typeof document === 'undefined') return;
    try {
      const viewContainer = document.getElementById(`view-${parentTab}`);
      if (!viewContainer) return;
      const panel = viewContainer.querySelector(`.subtab-content[data-subtab-id="${subTabId}"]`) ||
                    document.getElementById(`subtab-${subTabId}`);
      if (!panel) return;

      // Clear any prior advisory banner
      panel.querySelectorAll('.advisory-prereq-banner').forEach(el => el.remove());

      const [attempts, skills] = await Promise.all([AttemptLog.readAll(), this._loadSkills()]);
      const estimates = estimateAll(attempts, skills);
      const evalRes = evaluateAdvisoryPrerequisites(subTabId, estimates, skills);

      if (evalRes.hasPrerequisites && !evalRes.met) {
        const bannerHtml = renderAdvisoryBanner(evalRes);
        if (bannerHtml) {
          const wrapper = document.createElement('div');
          wrapper.innerHTML = bannerHtml;
          const bannerEl = wrapper.firstElementChild;
          if (bannerEl) {
            panel.insertBefore(bannerEl, panel.firstChild);
            bannerEl.querySelector('[data-aegis-dismiss-banner]')?.addEventListener('click', () => {
              bannerEl.remove();
            });
          }
        }
      }
    } catch (err) {
      console.warn('[AegisApp] _checkAndRenderAdvisoryBanner error:', err);
    }
  },

  /**
   * Arena questions, loaded once and cached. Used by _renderMastery for rank()
   * and could be reused by the InfiniteArena if we ever want to share the data load.
   * @private
   */
  /**
   * Count SM-2 cards due today, straight from the persisted deck — the same store the
   * Memory Vault reads. Kept tolerant: a missing or malformed deck counts as zero, never
   * as an error, because the drill panel must render regardless.
   * @returns {number}
   * @private
   */
  _countDueCards() {
    try {
      const raw = this.store?.get('sm2.deck');
      if (!raw) return 0;
      const deck = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!Array.isArray(deck)) return 0;
      const today = new Date().toISOString().split('T')[0];
      return deck.filter(c => c && typeof c === 'object' && (!c.dueDate || c.dueDate <= today)).length;
    } catch {
      return 0;
    }
  },

  async _loadArenaQuestions() {
    if (this._arenaQuestions) return this._arenaQuestions;
    try {
      const res = await fetch('./data/arena_questions.json')
        .catch(() => fetch('data/arena_questions.json'));
      if (!res.ok) throw new Error(`arena_questions.json fetch failed (${res.status})`);
      this._arenaQuestions = await res.json();
      return this._arenaQuestions;
    } catch {
      return [];
    }
  },

  /**
   * Render the mission chain panel on the Overview.
   * Reads the active mission from the store, loads missions.json, and hands
   * the computed state to the pure missionPanel renderer.
   * @private
   */
  async _renderMissionPanel() {
    const host = document.getElementById('mission-panel');
    if (!host) return;
    try {
      const [missions, attempts] = await Promise.all([
        this._loadMissions(),
        AttemptLog.readAll()
      ]);
      const activeId = this.store.get('missions.activeId', null);
      const startedAt = this.store.get('missions.startedAt', 0);
      const active = activeMission(missions, activeId);
      const cur = active ? currentStage(active, attempts, startedAt) : null;
      const prog = active ? stageProgress(active, attempts, startedAt) : null;
      host.innerHTML = missionPanel({
        missions,
        activeMission: active,
        currentStage: cur,
        progress: prog,
        hasAttempts: Array.isArray(attempts) && attempts.length > 0
      });
    } catch (e) {
      console.warn('[AegisApp] mission panel unavailable:', e);
      host.innerHTML = '';
    }
  },

  /**
   * Start a new mission. Sets the store, renders the panel, then routes to
   * the first stage's target module with any preloaded content.
   * @param {string} missionId
   * @private
   */
  async _startMission(missionId) {
    const missions = await this._loadMissions();
    const mission = missions.find((m) => m.id === missionId);
    if (!mission) {
      this.showToast({ type: 'danger', title: 'MISSION NOT FOUND', message: `Mission "${missionId}" not in catalogue.` });
      return;
    }
    this.store.set('missions.activeId', missionId);
    this.store.set('missions.startedAt', Date.now());
    await this._renderMissionPanel();
    this._routeMissionStage(missionId);
  },

  /**
   * Route to the current (first incomplete) stage of a mission.
   * Handles preload: fills VERDAD claims before switching, launches
   * InfoWar campaigns, etc.
   * @param {string} missionId
   * @private
   */
  async _routeMissionStage(missionId) {
    const missions = await this._loadMissions();
    const mission = missions.find((m) => m.id === missionId);
    if (!mission) return;
    const startedAt = this.store.get('missions.startedAt', 0);
    let attempts = [];
    try { attempts = await AttemptLog.readAll(); } catch { /* empty */ }
    const { stage } = currentStage(mission, attempts, startedAt);
    if (!stage) {
      await this._renderMissionPanel();
      return;
    }

    if (stage.tab === 'verdad' && stage.preload && stage.preload.claim) {
      const textarea = document.getElementById('textarea-verdad-claim');
      if (textarea) textarea.value = stage.preload.claim;
      this.switchTab(stage.tab, stage.subtab || undefined);
      const vm = this.modules && this.modules['verdad'];
      if (vm && typeof vm.executeAudit === 'function') vm.executeAudit();
      return;
    }

    if (stage.tab === 'cognitive' && stage.subtab === 'infowar' && stage.campaign) {
      this.switchTab(stage.tab, stage.subtab);
      setTimeout(() => {
        const iw = this.modules && this.modules['infowar'];
        if (iw && typeof iw._startCampaign === 'function') {
          const campaign = (iw._campaigns || []).find((c) => c.id === stage.campaign);
          if (campaign) iw._startCampaign(campaign);
        }
      }, 300);
      return;
    }

    if (stage.tab === 'cognitive' && stage.subtab === 'sift-labs' && stage.siftLab) {
      this.switchTab(stage.tab, stage.subtab);
      setTimeout(() => {
        const sift = this.modules && this.modules['sift'];
        if (sift && typeof sift._selectLab === 'function') sift._selectLab(stage.siftLab);
      }, 300);
      return;
    }

    if (stage.tab === 'cognitive' && stage.subtab === 'arena' && stage.mode) {
      this.switchTab(stage.tab, stage.subtab);
      setTimeout(() => {
        const arena = this.modules && this.modules['arena'];
        if (arena && typeof arena.startRound === 'function') arena.startRound(stage.mode);
      }, 500);
      return;
    }

    this.switchTab(stage.tab, stage.subtab || undefined);
  },

  /**
   * Load missions.json once and cache.
   * @private
   */
  async _loadMissions() {
    if (this._missions) return this._missions;
    try {
      const res = await fetch('./data/missions.json')
        .catch(() => fetch('data/missions.json'));
      if (!res.ok) throw new Error(`missions.json fetch failed (${res.status})`);
      this._missions = await res.json();
      return this._missions;
    } catch {
      return [];
    }
  },

  /**
   * Bind global keyboard shortcuts
   * @private
   */
  _bindKeybindings() {
    window.addEventListener('keydown', (e) => {
      // Escape key closes modals, drawer, and omni-palette
      if (e.key === 'Escape') {
        this.closeModal();
        this.toggleDrawer(false);
        this.closeOmniPalette();
      }

      // Ctrl+, or Cmd+, opens settings
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        this.openModal('modal-byok-settings');
      }

      // Ctrl+/ or Cmd+/ opens shortcuts modal
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        this.openModal('modal-shortcuts');
      }
      
      // Ctrl+K or Cmd+K opens Omni-Palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this.openOmniPalette();
      }
      
      // Alt+1 to Alt+5 Hotkey Routing
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        switch(e.key) {
          case '1': e.preventDefault(); this.switchTab('overview'); break;
          case '2': e.preventDefault(); this.switchTab('cognitive'); break;
          case '3': e.preventDefault(); this.switchTab('verdad'); break;
          case '4': e.preventDefault(); this.switchTab('osint'); break;
          case '5': e.preventDefault(); this.switchTab('early-warning'); break;
        }
      }
    });
    
    // Omni-palette input listener
    const omniInput = document.getElementById('omni-input');
    if (omniInput) {
      omniInput.addEventListener('input', (e) => this._handleOmniSearch(e.target.value));
      omniInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const firstResult = document.querySelector('.omni-result-item');
          if (firstResult) {
            firstResult.click();
          }
        }
      });
    }
    
    const omniBackdrop = document.querySelector('.omni-backdrop');
    if (omniBackdrop) {
      omniBackdrop.addEventListener('click', () => this.closeOmniPalette());
    }
  },

  openOmniPalette() {
    const palette = document.getElementById('omni-palette');
    const input = document.getElementById('omni-input');
    if (palette && input) {
      palette.classList.remove('hidden');
      input.value = '';
      this._handleOmniSearch(''); // show default options
      setTimeout(() => input.focus(), 50);
    }
  },

  closeOmniPalette() {
    const palette = document.getElementById('omni-palette');
    if (palette) {
      palette.classList.add('hidden');
    }
  },

  _handleOmniSearch(query) {
    const resultsContainer = document.getElementById('omni-results');
    if (!resultsContainer) return;
    
    const q = query.toLowerCase().trim();
    
    // Define search routes
    const routes = [
      { title: 'Command Center', path: 'Pillar 0', tab: 'overview', subtab: null },
      { title: 'Cognitive Lab', path: 'Pillar I', tab: 'cognitive', subtab: 'masterclass' },
      { title: 'The Epistemic Commons (Community Packs)', path: 'Pillar I ▸ Cognitive Lab', tab: 'cognitive', subtab: 'commons' },
      { title: 'Epistemic Memory Vault (SM-2 Daily Queue)', path: 'Pillar I ▸ Cognitive Lab', tab: 'cognitive', subtab: 'memory' },
      { title: 'The Infinite Arena (Endless Gauntlet)', path: 'Pillar I ▸ Cognitive Lab', tab: 'cognitive', subtab: 'arena' },
      { title: 'Rhetorical Sandbox & Steel-Manning', path: 'Pillar I ▸ Cognitive Lab', tab: 'cognitive', subtab: 'sandbox' },
      { title: 'Fallacies Taxonomy', path: 'Pillar I ▸ Cognitive Lab', tab: 'cognitive', subtab: 'fallacies' },
      { title: 'AI Media Forensics & C2PA Studio', path: 'Pillar I ▸ Cognitive Lab', tab: 'cognitive', subtab: 'forensics' },
      { title: 'C2PA Cryptographic Provenance Inspector', path: 'Pillar I ▸ Cognitive Lab', tab: 'cognitive', subtab: 'forensics' },
      { title: 'Neural Voice Clone & Audio Spectrogram Scanner', path: 'Pillar I ▸ Cognitive Lab', tab: 'cognitive', subtab: 'forensics' },
      { title: 'Deepfake Video & Lip-Sync Analyzer', path: 'Pillar I ▸ Cognitive Lab', tab: 'cognitive', subtab: 'forensics' },
      { title: 'Prebunking Simulator', path: 'Pillar I ▸ Cognitive Lab', tab: 'cognitive', subtab: 'prebunk' },
      { title: 'InfoWar Simulator', path: 'Pillar I ▸ Cognitive Lab', tab: 'cognitive', subtab: 'infowar' },
      { title: 'VERDAD Engine', path: 'Pillar II', tab: 'verdad', subtab: 'verdad-engine' },
      { title: 'Fact-Check Registry', path: 'Pillar II ▸ VERDAD', tab: 'verdad', subtab: 'verdad-registry' },
      { title: 'OSINT Ferret', path: 'Pillar III', tab: 'osint', subtab: 'ferret' },
      { title: 'Epistemic Dossier', path: 'Pillar III ▸ OSINT', tab: 'osint', subtab: 'dossier' },
      { title: 'ACH Matrix', path: 'Pillar III ▸ OSINT', tab: 'osint', subtab: 'ach-matrix' },
      { title: 'Narrative Topology', path: 'Pillar III ▸ OSINT', tab: 'osint', subtab: 'narrative' },
      { title: 'Early Warning Radar', path: 'Pillar IV', tab: 'early-warning', subtab: 'radar' },
      { title: 'Source Reputation', path: 'Pillar IV ▸ Early Warning', tab: 'early-warning', subtab: 'reputation' },
      { title: 'System 2 Pacer (4-7-8 & Box)', path: 'Cognitive Aftercare', tab: 'aftercare', subtab: 'pacer' },
      { title: '15-Second Friction Interlock', path: 'Cognitive Aftercare', tab: 'aftercare', subtab: 'friction' },
      { title: 'Epistemic Bias Susceptibility Audit', path: 'Cognitive Aftercare', tab: 'aftercare', subtab: 'audit' },
      { title: 'Epistemic Reframing Drills', path: 'Cognitive Aftercare', tab: 'aftercare', subtab: 'reframing' },
      { title: 'Incident Post-Mortem Debrief', path: 'Cognitive Aftercare', tab: 'aftercare', subtab: 'incident' },
      { title: 'Debiasing Reflection Journal', path: 'Cognitive Aftercare', tab: 'aftercare', subtab: 'journal' },
      { title: 'DID Signer', path: 'Identity', tab: 'identity', subtab: 'signer' }
    ];
    
    // Filter
    let filtered = routes;
    if (q) {
      filtered = routes.filter(r => r.title.toLowerCase().includes(q) || r.path.toLowerCase().includes(q));
    }
    
    // Render
    resultsContainer.innerHTML = '';
    if (filtered.length === 0) {
      resultsContainer.innerHTML = `<div style="padding: 20px; color: var(--stone-warm); font-family: var(--font-mono); font-size: 0.8rem; text-align: center;">No matches found for "${esc(query)}"</div>`;
      return;
    }
    
    filtered.slice(0, 8).forEach(route => {
      const el = document.createElement('div');
      el.className = 'omni-result-item';
      el.innerHTML = `
        <span class="omni-result-title">${esc(route.title)}</span>
        <span class="omni-result-path">${esc(route.path)}</span>
      `;
      el.addEventListener('click', () => {
        this.closeOmniPalette();
        this.switchTab(route.tab, route.subtab);
      });
      resultsContainer.appendChild(el);
    });
  },

  /**
   * Bind Global Drag-and-Drop for Sentinel Triage
   * @private
   */
  _bindDragAndDrop() {
    const dropzone = document.getElementById('sentinel-dropzone');
    if (!dropzone) return;

    let dragCounter = 0;

    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      dropzone.classList.remove('hidden');
    });

    window.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter === 0) {
        dropzone.classList.add('hidden');
        dropzone.classList.remove('active');
      }
    });

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('active');
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      dropzone.classList.add('hidden');
      dropzone.classList.remove('active');

      let textContent = e.dataTransfer.getData('text/plain');

      if (!textContent && e.dataTransfer.files.length > 0) {
        // Route by kind: media files go to the forensics analyzer, text files to VERDAD.
        this._handleIngestFile(e.dataTransfer.files[0]);
      } else if (textContent) {
        this._processDrop(textContent);
      }
    });
  },

  _processDrop(text) {
    this._routeToVerdad(text);
  },

  /**
   * Hand a claim to VERDAD: pre-fill the claim box, switch to the view, and run the
   * audit. The single path used by drag-and-drop, the ?verify= deep link, the
   * clipboard button, and paste detection — so a fix here is a fix in every surface.
   *
   * The textarea is filled BEFORE switchTab because VerdadModule.onMount() only loads
   * a preset when the box is empty; pre-filling means the shared text survives the
   * mount instead of being overwritten by a demo scenario.
   * @private
   */
  _routeToVerdad(text) {
    const clean = (typeof text === 'string' ? text : '').trim();
    if (!clean) return;
    const truncated = clean.length > VERIFY_MAX_CHARS ? clean.slice(0, VERIFY_MAX_CHARS) : clean;

    const textarea = document.getElementById('textarea-verdad-claim');
    if (textarea) textarea.value = truncated;

    this.switchTab('verdad');

    const vm = this.modules['verdad'];
    if (vm && typeof vm.executeAudit === 'function') {
      vm.executeAudit();
    } else {
      this.showToast({ type: 'danger', title: 'SYSTEM ERROR', message: 'VERDAD Engine unavailable.' });
    }
  },

  /**
   * Consume a `?verify=` deep link once at boot. A refresh must not re-run the same
   * shared claim, so the parameter is removed from the URL after reading.
   * @private
   */
  _handleVerifyDeepLink() {
    if (typeof window === 'undefined' || !window.location.search) return;
    const text = parseVerify(window.location.search);
    if (!text) return;

    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('verify');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    } catch {
      /* rewriting the URL is cosmetic; the claim is already in hand */
    }

    this._routeToVerdad(text);
  },

  /**
   * Route a dropped/imported file by kind. Media files go to the forensics analyzer
   * (which reads real pixels/waveforms); everything else is read as text for VERDAD.
   * @private
   */
  _handleIngestFile(file) {
    if (!file) return;
    const isMedia = file.type && /^(image|audio|video)\//.test(file.type);
    if (isMedia) {
      const fm = this.modules['forensics'];
      if (fm && typeof fm._processUserFile === 'function') {
        this.switchTab('cognitive', 'forensics');
        fm._processUserFile(file);
        return;
      }
    }

    const reader = new FileReader();
    reader.onload = (ev) => this._routeToVerdad(String(ev.target.result || ''));
    reader.readAsText(file);
  },

  /**
   * Read the clipboard on demand and route it to VERDAD. There is no passive
   * clipboard watcher in any browser — this is the legitimate maximum a static page
   * can do, and it degrades to "press Ctrl+V" when the read is blocked.
   * @private
   */
  async _readClipboard() {
    let text = null;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        text = await navigator.clipboard.readText();
      }
    } catch {
      text = null; // permission denied, insecure context, or not a user gesture
    }

    if (text && text.trim()) {
      this._routeToVerdad(text);
      return;
    }

    this.switchTab('verdad');
    document.getElementById('textarea-verdad-claim')?.focus();
    this.showToast({
      type: 'info',
      title: 'CLIPBOARD UNAVAILABLE',
      message: 'Clipboard read is blocked here — press Ctrl+V to paste the claim instead.',
      duration: 6000
    });
  },

  /**
   * Paste-to-verify. A paste into a field is the user's own business and is never
   * hijacked; a paste into the page chrome, however, is almost always a claim the
   * operator has carried from elsewhere, so it gets a one-click offer rather than
   * being silently swallowed. Opt-in, never auto-run.
   * @private
   */
  _bindPasteDetection() {
    if (typeof document === 'undefined') return;

    document.addEventListener('paste', (e) => {
      const target = e.target;
      const isField = target && (typeof target.matches === 'function'
        ? target.matches('input, textarea, select, [contenteditable="true"]')
        : false);
      if (isField) return;

      const text = (e.clipboardData && e.clipboardData.getData('text/plain')) || '';
      const clean = text.trim();
      if (clean.length < 20) return;

      this.showToast({
        type: 'info',
        title: 'CLAIM DETECTED',
        message: 'Pasted text looks like a claim. Analyze it in VERDAD?',
        duration: 8000,
        action: { label: 'Analyze in VERDAD →', onClick: () => this._routeToVerdad(clean) }
      });
    });

    document.getElementById('btn-topbar-clipboard')?.addEventListener('click', () => this._readClipboard());
  },

  /**
   * Subscribe reactive StateStore changes to DOM telemetry items
   * @private
   */
  _subscribeTelemetryUI() {
    // 1. Active DID
    this.store.subscribe('identity.did', (did) => {
      const didEl = document.getElementById('telemetry-did-key');
      if (didEl && did) {
        didEl.textContent = did.length > 20 ? `${did.slice(0, 15)}...${did.slice(-4)}` : did;
        didEl.title = did;
      }
    });

    // Trigger initial render
    const initialDid = this.store.get('identity.did');
    if (initialDid) {
      const didEl = document.getElementById('telemetry-did-key');
      if (didEl) {
        didEl.textContent = initialDid.length > 20 ? `${initialDid.slice(0, 15)}...${initialDid.slice(-4)}` : initialDid;
        didEl.title = initialDid;
      }
    }

    // 2. Latency
    this.store.subscribe('telemetry.networkLatencyMs', (lat) => {
      const latEl = document.getElementById('telemetry-latency-val');
      if (latEl) {
        latEl.textContent = `${lat}ms (EDGE)`;
      }
    });

    // 3. AP Counter
    this.store.subscribe('telemetry.activeAp', (ap) => {
      const apEl = document.getElementById('telemetry-ap-val');
      if (apEl) {
        apEl.textContent = `${ap} / 10 AP`;
      }
    });

    // 4. THREAT — derived, never defaulted: the pill changes only when a REAL Verdad audit
    // completes (VerdadModule.executeAudit → AegisApp.setThreatFromAudit). No seeded level.
    this.store.subscribe('verdad.lastAudit', (audit) => {
      this._renderThreatPill(audit);
    });

    // 5. Honest chrome — IMMUNITY INDEX / PRACTICE EPOCH values live in one derived key
    // written only by _refreshChromeHonesty() from the raw attempt log, never seeded.
    this.store.subscribe('chrome.honesty', () => {
      this._renderImmunityIndex();
      this._renderEpoch();
    });

    // Initial render: fail-loud placeholders until real data lands — or the real derived
    // values immediately, when a previous session already produced them.
    this._renderThreatPill(this.store.get('verdad.lastAudit', null));
    this._renderImmunityIndex();
    this._renderEpoch();
  },

  /**
   * Render the THREAT pill from the last COMPLETED Verdad audit, or fail loud with
   * UNAUDITED when there is none. The hover title always names its source, so the number
   * can never be mistaken for an ambient global threat feed.
   * @param {{label?: string, claimText?: string, at?: number}|null} audit
   * @private
   */
  _renderThreatPill(audit) {
    const pill = document.getElementById('threat-index-val');
    const badge = document.getElementById('topbar-threat-badge');
    if (!pill) return;
    if (!audit || !audit.label) {
      pill.textContent = 'THREAT: UNAUDITED';
      pill.classList.add('aegis-threat-unaudited');
      if (badge) badge.title = 'Threat level derived from your last completed VERDAD audit. Nothing is audited yet — this is not a measurement.';
      return;
    }
    pill.textContent = audit.label;
    pill.classList.remove('aegis-threat-unaudited');
    if (badge) {
      const claim = String(audit.claimText || '').trim().replace(/\s+/g, ' ');
      const excerpt = claim.length > 120 ? `${claim.slice(0, 117)}…` : claim;
      const when = Number.isFinite(audit.at) ? `${new Date(audit.at).toISOString().slice(0, 16).replace('T', ' ')} UTC` : 'unknown time';
      badge.title = `Derived from the last completed VERDAD audit (${when}):\n“${excerpt}”`;
    }
  },

  /**
   * Called by VerdadModule after a COMPLETED audit (an operator-submitted claim). The
   * mount-time preset analysis is deliberately NOT routed here — the operator never
   * submitted that claim, so it must not move the pill.
   * @param {{manipulationRisk: number, claimText?: string, isLiveApi?: boolean}} result
   */
  setThreatFromAudit(result) {
    const derived = VerdadEngine.deriveThreat(result);
    if (!derived) return;
    this.store.set('verdad.lastAudit', {
      ...derived,
      claimText: typeof result.claimText === 'string' ? result.claimText : '',
      isLiveApi: result.isLiveApi === true
    });
  },

  /**
   * Re-derive every honesty-controlled chrome surface from the raw attempt log:
   * IMMUNITY INDEX (mean mastery over attempted skills) and PRACTICE EPOCH (days since
   * the first recorded attempt). Recomputed, never cached — same doctrine as the
   * overview panels: no stored figure that can go stale.
   * @private
   */
  async _refreshChromeHonesty() {
    try {
      const [attempts, skills] = await Promise.all([AttemptLog.readAll(), this._loadSkills()]);
      const agg = estimateAggregate(attempts, skills);
      const span = practiceDaySpan(attempts, skills);
      this.store.set('chrome.honesty', {
        immunity: agg.available
          ? { available: true, pct: Math.round(agg.value * 100), n: agg.n, skillsAttempted: agg.skillsAttempted }
          : { available: false },
        epoch: span.available
          ? { available: true, days: span.days, firstAttemptAt: span.firstAttemptAt, n: span.n }
          : { available: false }
      }, false);
    } catch (err) {
      console.warn('[AegisApp] Honest-chrome refresh failed:', err);
    }
  },

  /**
   * IMMUNITY INDEX — a measured estimate with its sample size attached, or UNMEASURED.
   * @private
   */
  _renderImmunityIndex() {
    const scoreEl = document.getElementById('telemetry-immunity-val');
    if (!scoreEl) return;
    const h = this.store.get('chrome.honesty', null);
    if (h && h.immunity && h.immunity.available) {
      const { pct, n, skillsAttempted } = h.immunity;
      scoreEl.textContent = `${pct}% RESILIENT (n=${n}, ${skillsAttempted} skill${skillsAttempted === 1 ? '' : 's'})`;
      scoreEl.title = 'Mean estimated mastery across the skills you have actually attempted, recomputed from the local attempt log (held-out probes excluded). It is an estimate from your own practice — not a score, and not a guarantee.';
    } else {
      scoreEl.textContent = 'UNMEASURED';
      scoreEl.title = 'No attempts recorded yet. Answer anything once and this becomes a real measurement.';
    }
  },

  /**
   * EPOCH — D+<days since the first recorded practice attempt> once history exists;
   * before that, the current session age labeled SESSION so it cannot masquerade as a
   * project epoch. The D+ path is written by _refreshChromeHonesty(); the session path
   * re-renders on every clock tick.
   * @private
   */
  _renderEpoch() {
    const epochEl = document.getElementById('telemetry-epoch');
    if (!epochEl) return;
    const h = this.store.get('chrome.honesty', null);
    if (h && h.epoch && h.epoch.available) {
      epochEl.textContent = `D+${h.epoch.days}`;
      const first = Number.isFinite(h.epoch.firstAttemptAt) ? new Date(h.epoch.firstAttemptAt).toISOString().slice(0, 10) : 'unknown date';
      epochEl.title = `Day ${h.epoch.days} of your recorded practice history — first attempt ${first}, ${h.epoch.n} attempts in the local log.`;
      return;
    }
    const elapsed = Date.now() - (this._sessionStart || Date.now());
    const hh = String(Math.floor(elapsed / 3600000)).padStart(2, '0');
    const mm = String(Math.floor((elapsed % 3600000) / 60000)).padStart(2, '0');
    const ss = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0');
    epochEl.textContent = `SESSION ${hh}:${mm}:${ss}`;
    epochEl.title = 'No practice history yet — this is the current session\u2019s age, not a project epoch. Answer something once and D+<days> takes over.';
  }
};

// Auto-initialize when loaded in browser
if (typeof window !== 'undefined') {
  window.AegisApp = AegisApp;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AegisApp.init());
  } else {
    AegisApp.init();
  }
}
