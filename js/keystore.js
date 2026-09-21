/**
 * SOVEREIGN // AEGIS — Non-extractable key vault (IndexedDB)
 *
 * WHY THIS EXISTS
 * ---------------
 * Signing keys were previously exported to JWK and written into `localStorage` as part
 * of the general application state blob. That put the private `d` parameter one
 * `localStorage.getItem()` away from any injected script — and the whole point of the
 * Identity module is that a credential signed by this DID could not have been forged.
 *
 * A `CryptoKey` created with `extractable: false` can be persisted in IndexedDB by
 * structured clone. It comes back as a usable signing handle whose private scalar the
 * page can never read. XSS can then *use* the key while the tab is open, but it cannot
 * *exfiltrate* it — the key does not survive the attacker's session, and the operator's
 * DID stays theirs.
 *
 * @module keystore
 */

const DB_NAME = 'sovereign-aegis-keystore';
const DB_VERSION = 1;
const STORE = 'keys';
const PRIMARY_KEY_ID = 'identity-signing-key';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable in this context'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const req = fn(store);
    t.oncomplete = () => resolve(req && req.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const KeyStore = {
  /**
   * Persist a non-extractable CryptoKeyPair.
   * @param {CryptoKeyPair} keyPair
   * @param {string} [id]
   */
  async put(keyPair, id = PRIMARY_KEY_ID) {
    const db = await openDb();
    try {
      await tx(db, 'readwrite', (s) =>
        s.put({ privateKey: keyPair.privateKey, publicKey: keyPair.publicKey, storedAt: Date.now() }, id)
      );
      return true;
    } finally {
      db.close();
    }
  },

  /**
   * Retrieve a stored keypair, or null if none has been vaulted.
   * @param {string} [id]
   * @returns {Promise<{privateKey: CryptoKey, publicKey: CryptoKey}|null>}
   */
  async get(id = PRIMARY_KEY_ID) {
    let db;
    try {
      db = await openDb();
    } catch {
      return null; // private-browsing / disabled IDB — caller falls back
    }
    try {
      const rec = await tx(db, 'readonly', (s) => s.get(id));
      return rec && rec.privateKey ? rec : null;
    } catch {
      return null;
    } finally {
      db.close();
    }
  },

  /**
   * Remove a stored keypair.
   * @param {string} [id]
   */
  async remove(id = PRIMARY_KEY_ID) {
    const db = await openDb();
    try {
      await tx(db, 'readwrite', (s) => s.delete(id));
      return true;
    } finally {
      db.close();
    }
  },

  /** @returns {Promise<boolean>} whether a hardened key is vaulted */
  async has(id = PRIMARY_KEY_ID) {
    return (await this.get(id)) !== null;
  },

  /** @returns {boolean} whether this environment can vault non-extractable keys */
  isAvailable() {
    return typeof indexedDB !== 'undefined';
  }
};

export default KeyStore;
