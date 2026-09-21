/**
 * SOVEREIGN // AEGIS — Durable local snapshot mirror (IndexedDB)
 *
 * WHY THIS EXISTS
 * ---------------
 * All operator state lived in a single `localStorage` key. `localStorage` is the most
 * fragile persistence a browser offers: it is wiped by "clear cookies and site data",
 * evicted under storage pressure, cleared by privacy extensions and cleanup tools, and
 * silently absent in some private-browsing modes. For a tool whose value accrues over
 * months — a spaced-repetition deck, a debiasing journal, a dossier — losing it to a
 * routine browser cleanup is a serious failure.
 *
 * This mirrors every snapshot into IndexedDB, which survives a localStorage-only clear
 * and has a far larger quota. On boot, if localStorage is missing or empty but a mirror
 * exists, the mirror is restored before the store initialises.
 *
 * HONEST LIMIT
 * ------------
 * IndexedDB is still browser-local origin storage. "Clear site data", a new browser, a
 * new device, or a reinstalled OS all lose it. There is no server here by design, so the
 * only true backup is an exported profile file — which is why the export/restore path in
 * epistemicCommons.js matters and why the UI nudges toward it. This module reduces
 * accidental loss; it does not make data safe.
 *
 * @module persist
 */

const DB_NAME = 'sovereign-aegis-store';
const DB_VERSION = 1;
const STORE = 'snapshots';
const SNAPSHOT_KEY = 'state';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req && req.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const Persist = {
  /** @returns {boolean} whether durable mirroring is possible here */
  isAvailable() {
    return typeof indexedDB !== 'undefined';
  },

  /**
   * Write a snapshot. Called debounced from StateStore.save().
   * @param {string} json - already-serialised state
   */
  async writeSnapshot(json) {
    const db = await openDb();
    try {
      await tx(db, 'readwrite', (s) => s.put({ json, savedAt: Date.now() }, SNAPSHOT_KEY));
      return true;
    } finally {
      db.close();
    }
  },

  /**
   * Read the last snapshot, or null.
   * @returns {Promise<{json: string, savedAt: number}|null>}
   */
  async readSnapshot() {
    let db;
    try { db = await openDb(); } catch { return null; }
    try {
      const rec = await tx(db, 'readonly', (s) => s.get(SNAPSHOT_KEY));
      return rec && typeof rec.json === 'string' ? rec : null;
    } catch {
      return null;
    } finally {
      db.close();
    }
  },

  /** Delete the mirror (used by Hard Reset so it does not resurrect state). */
  async clearSnapshot() {
    let db;
    try { db = await openDb(); } catch { return false; }
    try {
      await tx(db, 'readwrite', (s) => s.delete(SNAPSHOT_KEY));
      return true;
    } catch {
      return false;
    } finally {
      db.close();
    }
  },

  /**
   * Recover localStorage from the IndexedDB mirror when it is empty.
   *
   * Runs BEFORE the StateStore is constructed, because the store hydrates from
   * localStorage synchronously in its constructor.
   *
   * @param {string} storageKey - the localStorage key the store uses
   * @returns {Promise<{restored: boolean, savedAt: number|null, reason: string}>}
   */
  async recoverIfNeeded(storageKey) {
    if (typeof localStorage === 'undefined') {
      return { restored: false, savedAt: null, reason: 'no localStorage in this context' };
    }
    let existing = null;
    try { existing = localStorage.getItem(storageKey); } catch { /* access denied */ }

    if (existing && existing.length > 2) {
      return { restored: false, savedAt: null, reason: 'localStorage already populated' };
    }

    const snap = await this.readSnapshot();
    if (!snap) {
      return { restored: false, savedAt: null, reason: 'no durable mirror found' };
    }
    try {
      JSON.parse(snap.json);                       // refuse to restore corrupt data
      localStorage.setItem(storageKey, snap.json);
      return { restored: true, savedAt: snap.savedAt, reason: 'restored from IndexedDB mirror' };
    } catch (e) {
      return { restored: false, savedAt: null, reason: `mirror unreadable: ${e.message}` };
    }
  }
};

export default Persist;
