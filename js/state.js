/**
 * SOVEREIGN // AEGIS — Reactive Central State Store
 * Deep path resolution, Pub/Sub, LocalStorage persistence & comprehensive SEED_STATE
 */

import { Persist } from './persist.js';

export const SEED_STATE = {
  app: {
    version: '1.0.0',
    name: 'SOVEREIGN // AEGIS',
    codename: 'Epistemic Aegis',
    activeTab: 'overview',
    activeSubTabs: {
      cognitive: 'masterclasses',
      verdad: 'analyzer',
      osint: 'search',
      identity: 'profile',
      earlyWarning: 'radar',
      reputation: 'directory',
      ach: 'matrix',
      narrative: 'topology',
      infowar: 'game',
      aftercare: 'pacer'
    },
    theme: 'dark-granite',
    sidebarCollapsed: false,
    mobileNavOpen: false,
    activeModal: null,
    drawerOpen: false,
    initialized: false
  },
  // Telemetry keys the UI genuinely derives from: networkLatencyMs is MEASURED in the
  // heartbeat (localStorage write+read round-trip; no remote endpoint exists in an
  // offline-first app), lastTick is the real loop heartbeat, and activeAp mirrors the
  // InfoWar game's live AP budget once a campaign runs. Everything theatrical was
  // removed 2026-09-25 — blockHeight/syncStatus/threatLevel/sentinelMode/epistemicHealth/
  // uptimeSeconds in the first purge, then activeNodes/attestation/consensus/alerts/
  // reputationScore in the second (a fake chain, a seeded 'ELEVATED' read by nothing,
  // invented enclave/PCR hardware attestation, fictional consensus peers, fake unread
  // alerts, a reputation score nothing computes). The SENTINEL pill and AP display are
  // DERIVED in js/app.js from real state: identity + key vault + attempt log, and the
  // game AP budget. Keep it that way: any new telemetry key must be measured or
  // estimated from real events, never seeded.
  telemetry: {
    networkLatencyMs: null,
    lastTick: null,
    activeAp: null
  },
  identity: {
    did: null, // e.g. 'did:key:zDnae...'
    alias: 'Sovereign-Sentinel-01',
    role: 'Tier-1 Epistemic Analyst',
    keyPair: null, // In-memory CryptoKeyPair
    publicKeyJwk: null,
    privateKeyJwk: null,
    fingerprint: null,
    created: null,
    credentials: [], // Array of W3C JSON-LD verifiable credentials (REAL: issued in-session)
    signedStatements: [] // Array of signed statements history
  },
  // The `attestation` block (invented TPM/PCR hardware claims), `consensus` block
  // (fictional peers and a fake B-EFT round counter), and `alerts` block (a hardcoded
  // unread count) were removed 2026-09-25: nothing read them except a stress test's
  // deep-path traversal, now pointed at the real identity.credentials array. A local,
  // offline app has no enclave to attest, no peers to poll, and no server alerts.
  verdad: {
    recentAnalyses: [],
    byokApiKey: '',
    preferredModel: 'gemini-2.0-flash',
    offlineOnly: false,
    autoExtractEntities: true
  },
  ach: {
    activeCaseId: 'preset-case-1',
    customCases: []
  },
  infowar: {
    currentCampaignId: 'campaign-1',
    activeGameState: null,
    highScores: {}
  },
  aftercare: {
    breathingCompletedCycles: 0,
    journalEntries: [],
    lastJournalDate: null
  },
  sift: {
    stats: { correct: 0, total: 0, byLab: {} },
    seen: {}
  },
  rhetoric: {
    state: null,
    activeArgId: 'arg-ai-risk',
    userTags: {},
    stats: { clausesTagged: 0, clausesCorrect: 0, enthymemesAttempted: 0, enthymemesCorrect: 0, steelmansCompleted: 0 }
  },
  sm2: {
    deck: null
  },
  settings: {
    soundEffects: true,
    hapticsEnabled: true,
    animationsEnabled: true,
    autoSaveIntervalMs: 5000,
    telemetryTickIntervalMs: 4000,
    storageKey: 'sovereign_aegis_state_v1'
  }
};

/**
 * Deep clone utility
 * @param {*} obj 
 * @returns {*}
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (Array.isArray(obj)) return obj.map(item => deepClone(item));
  
  const cloned = {};
  for (const key of Object.keys(obj)) {
    cloned[key] = deepClone(obj[key]);
  }
  return cloned;
}

/**
 * Memory storage fallback for Node.js / non-browser environments
 */
class MemoryStorage {
  constructor() {
    this._data = new Map();
  }
  getItem(key) {
    return this._data.has(key) ? this._data.get(key) : null;
  }
  setItem(key, value) {
    this._data.set(key, String(value));
  }
  removeItem(key) {
    this._data.delete(key);
  }
  clear() {
    this._data.clear();
  }
}

/**
 * Reactive Central State Store
 */
export class StateStore {
  /**
   * @param {Object} [initialState={}] 
   * @param {Object} [options={}] 
   */
  constructor(initialState = {}, options = {}) {
    this._options = {
      storageKey: options.storageKey || 'sovereign_aegis_state_v1',
      autoPersist: options.autoPersist !== false,
      ...options
    };

    // Determine storage backend (browser localStorage or memory storage fallback)
    try {
      if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
        this._storage = globalThis.localStorage;
      } else {
        this._storage = new MemoryStorage();
      }
    } catch {
      this._storage = new MemoryStorage();
    }

    // Initialize listeners
    this._subscribers = new Map(); // path -> Set of callbacks
    this._wildcardSubscribers = new Set(); // Set of { pattern, callback }
    this._eventListeners = new Map(); // eventName -> Set of handlers

    // Initialize state
    this._state = deepClone(SEED_STATE);

    // Merge with persisted storage
    this.load();

    // Merge any explicit overrides passed in constructor
    if (initialState && typeof initialState === 'object') {
      this._mergeDeep(this._state, initialState);
    }
  }

  /**
   * Resolve a dot-notated path to a value
   * @param {string} path - e.g. 'telemetry.blockHeight'
   * @param {*} [fallback=null]
   * @returns {*}
   */
  get(path, fallback = null) {
    if (!path || typeof path !== 'string') return fallback;
    const parts = path.split('.');
    let current = this._state;

    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return fallback;
      }
      current = current[part];
    }

    return current !== undefined ? current : fallback;
  }

  /**
   * Set a value at a dot-notated path and notify subscribers
   * @param {string} path 
   * @param {*} value 
   * @param {boolean} [persist=true] 
   * @returns {boolean} True if modified
   */
  set(path, value, persist = true) {
    if (!path || typeof path !== 'string') return false;

    const parts = path.split('.');
    let current = this._state;
    const stack = [];

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
        current[part] = {};
      }
      stack.push({ parent: current, key: part });
      current = current[part];
    }

    const lastKey = parts[parts.length - 1];
    const oldValue = current[lastKey];

    // Check if value actually changed
    if (oldValue === value && typeof value !== 'object') {
      return false;
    }

    current[lastKey] = value;

    if (persist && this._options.autoPersist) {
      this.save();
    }

    this.notify(path, value, oldValue);
    return true;
  }

  /**
   * Update a value at a dot-notated path using an updater function
   * @param {string} path 
   * @param {Function} updaterFn - (currentValue) => nextValue
   * @param {boolean} [persist=true] 
   * @returns {*} Next value
   */
  update(path, updaterFn, persist = true) {
    const currentVal = this.get(path);
    const nextVal = updaterFn(currentVal);
    this.set(path, nextVal, persist);
    return nextVal;
  }

  /**
   * Subscribe to changes on a path or wildcard pattern
   * @param {string} pathOrPattern - 'telemetry.threatLevel', 'telemetry.*', or '*'
   * @param {Function} callback - (newValue, oldValue, path) => void
   * @returns {Function} Unsubscribe function
   */
  subscribe(pathOrPattern, callback) {
    if (typeof callback !== 'function') return () => {};

    if (pathOrPattern.includes('*')) {
      const sub = { pattern: pathOrPattern, callback };
      this._wildcardSubscribers.add(sub);
      return () => {
        this._wildcardSubscribers.delete(sub);
      };
    }

    if (!this._subscribers.has(pathOrPattern)) {
      this._subscribers.set(pathOrPattern, new Set());
    }
    this._subscribers.get(pathOrPattern).add(callback);

    return () => {
      const subs = this._subscribers.get(pathOrPattern);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this._subscribers.delete(pathOrPattern);
        }
      }
    };
  }

  /**
   * Notify subscribers of a path change
   * @param {string} path 
   * @param {*} value 
   * @param {*} [oldValue=null] 
   */
  notify(path, value, oldValue = null) {
    // 1. Direct path subscribers
    const directSubs = this._subscribers.get(path);
    if (directSubs) {
      for (const cb of directSubs) {
        try {
          cb(value, oldValue, path);
        } catch (err) {
          console.error(`[StateStore] Subscriber error for ${path}:`, err);
        }
      }
    }

    // 2. Wildcard subscribers
    for (const { pattern, callback } of this._wildcardSubscribers) {
      if (this._matchesPattern(path, pattern)) {
        try {
          callback(value, oldValue, path);
        } catch (err) {
          console.error(`[StateStore] Wildcard subscriber error for ${pattern}:`, err);
        }
      }
    }

    // 3. Dispatch DOM CustomEvent if in browser
    if (typeof globalThis !== 'undefined' && globalThis.dispatchEvent && typeof CustomEvent !== 'undefined') {
      try {
        globalThis.dispatchEvent(new CustomEvent('aegis:state-change', {
          detail: { path, value, oldValue }
        }));
      } catch {
        // Safe ignore
      }
    }
  }

  /**
   * Generic event bus dispatcher
   * @param {string} event 
   * @param {*} payload 
   */
  dispatch(event, payload) {
    const handlers = this._eventListeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(payload);
        } catch (err) {
          console.error(`[StateStore] Event handler error for ${event}:`, err);
        }
      }
    }
  }

  /**
   * Subscribe to generic event bus
   * @param {string} event 
   * @param {Function} handler 
   * @returns {Function} Unsubscribe function
   */
  on(event, handler) {
    if (typeof handler !== 'function') return () => {};

    if (!this._eventListeners.has(event)) {
      this._eventListeners.set(event, new Set());
    }
    this._eventListeners.get(event).add(handler);

    return () => {
      const handlers = this._eventListeners.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this._eventListeners.delete(event);
        }
      }
    };
  }

  /**
   * Returns a deep clone of the entire current state tree
   * @returns {Object}
   */
  getState() {
    return deepClone(this._state);
  }

  /**
   * Save current state to storage
   */
  save() {
    let json = null;
    try {
      // Create a serializable clone (excluding non-serializable objects like CryptoKeyPair)
      const serializableState = this._sanitizeForStorage(this._state);
      json = JSON.stringify(serializableState);
      this._storage.setItem(this._options.storageKey, json);
    } catch (err) {
      console.warn('[StateStore] Failed to persist state to storage:', err);
    }
    // Mirror to IndexedDB so a localStorage clear or eviction does not lose everything.
    // Debounced because save() is called on every set(); IndexedDB writes are async and
    // there is no value in queueing one per keystroke.
    if (json !== null) this._scheduleDurableMirror(json);
  }

  /**
   * Debounced durable mirror. Best-effort by design: if IndexedDB is unavailable
   * (private browsing, disabled), localStorage remains the only copy and the app
   * continues working exactly as before.
   * @private
   */
  _scheduleDurableMirror(json) {
    if (typeof Persist === 'undefined' || !Persist.isAvailable()) return;
    this._pendingMirror = json;
    if (this._mirrorTimer) return;
    const flush = () => {
      this._mirrorTimer = null;
      const payload = this._pendingMirror;
      this._pendingMirror = null;
      if (payload) {
        Persist.writeSnapshot(payload).catch(err =>
          console.warn('[StateStore] Durable mirror write failed:', err));
      }
    };
    if (typeof setTimeout === 'function') {
      this._mirrorTimer = setTimeout(flush, 1200);
      // Do not hold a Node test process open on this timer.
      if (this._mirrorTimer && typeof this._mirrorTimer.unref === 'function') this._mirrorTimer.unref();
    } else {
      flush();
    }
  }

  /**
   * Load state from storage and merge with seed state
   */
  load() {
    try {
      const raw = this._storage.getItem(this._options.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this._mergeDeep(this._state, parsed);
        }
      }
    } catch (err) {
      console.warn('[StateStore] Failed to load persisted state:', err);
    }
  }

  /**
   * Reset state to pristine seed defaults
   * @param {boolean} [hard=false] 
   */
  reset(hard = false) {
    this._state = deepClone(SEED_STATE);
    if (hard) {
      try {
        this._storage.removeItem(this._options.storageKey);
      } catch {
        // Safe ignore
      }
    } else {
      this.save();
    }
    this.notify('*', this._state, null);
  }

  /**
   * Check if a path matches a wildcard pattern
   * @private
   */
  _matchesPattern(path, pattern) {
    if (pattern === '*') return true;
    if (!pattern.includes('*')) return path === pattern;

    const regexPattern = '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
    return new RegExp(regexPattern).test(path);
  }

  /**
   * Deep merge source object into target object
   * @private
   */
  _mergeDeep(target, source) {
    if (!source || typeof source !== 'object') return target;

    for (const key of Object.keys(source)) {
      const sourceVal = source[key];
      if (sourceVal && typeof sourceVal === 'object' && !Array.isArray(sourceVal) && !(sourceVal instanceof Date)) {
        if (!target[key] || typeof target[key] !== 'object') {
          target[key] = {};
        }
        this._mergeDeep(target[key], sourceVal);
      } else {
        target[key] = sourceVal;
      }
    }
    return target;
  }

  /**
   * Strip non-serializable fields prior to JSON serialization
   * @private
   */
  _sanitizeForStorage(state) {
    const copy = deepClone(state);
    if (copy.identity) {
      copy.identity.keyPair = null; // CryptoKeyPair is not directly serializable
    }
    return copy;
  }
}
