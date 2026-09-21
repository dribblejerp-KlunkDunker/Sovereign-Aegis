/**
 * SOVEREIGN // AEGIS — Personal Defense Profile store (IndexedDB, append-only)
 *
 * WHY THIS EXISTS
 * ---------------
 * The profile's raw answers and observation log are the most sensitive data the app
 * holds after the attempt log: they are a record of where someone's judgment bends.
 * DESIGN-product-decision.md rule D1 applies verbatim — device-local forever, no sync,
 * no escape hatch — so they live in IndexedDB under the same seam as js/attemptlog.js
 * and degrade the same way (soft failures, never throws).
 *
 * APPEND-ONLY, RAW EVENTS
 * -----------------------
 * Responses are never updated and derived levels are never stored. The banding rules
 * will be revised; the raw answers should not have to migrate when they are. `v` is
 * stamped on every record from day one, exactly like the attempt log.
 *
 * THE ONE FIELD THAT MUST NOT EXIST
 * ---------------------------------
 * There is no field where a third party's name belongs. Observation records describe
 * the operator's OWN reaction to a pressure event; the design refuses to store free
 * text about another person. That boundary is enforced here by simply never defining
 * such a field, and the UI builds on the same constraint.
 *
 * @module profilestore
 */

const DB_NAME = 'sovereign-aegis-profile';
const DB_VERSION = 1;
const STORE_RESPONSES = 'responses';
const STORE_OBSERVATIONS = 'observations';

/** Current record schema version. v1 is the first and only version; unknown future
 * `v`s are stamped current on import rather than guessed at. */
export const SCHEMA_VERSION = 1;

/** The permitted per-answer scope vocabulary (spec §1). Unknown tags are dropped. */
export const ALLOWED_SCOPES = Object.freeze(['online', 'work', 'close', 'money', 'health', 'civic']);

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_RESPONSES)) db.createObjectStore(STORE_RESPONSES);
      if (!db.objectStoreNames.contains(STORE_OBSERVATIONS)) db.createObjectStore(STORE_OBSERVATIONS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Single-store transaction, mirroring attemptlog's tx(). */
function tx(db, store, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req && req.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

/** Multi-store transaction — used by import() and clear() so the two stores move together.
 * `fn` returns the request(s) it created; the resolved value is their .result(s), the same
 * contract the single-store tx() has — a caller awaiting txAll gets data, not IDBRequest
 * objects (which would be broken against real IndexedDB and every stub of it). */
function txAll(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction([STORE_RESPONSES, STORE_OBSERVATIONS], mode);
    const reqs = fn(
      t.objectStore(STORE_RESPONSES),
      t.objectStore(STORE_OBSERVATIONS)
    );
    t.oncomplete = () => {
      const list = reqs == null ? [] : (Array.isArray(reqs) ? reqs : [reqs]);
      const out = list.map((r) => (r && 'result' in r ? r.result : r));
      resolve(out.length === 1 ? out[0] : out);
    };
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

/**
 * Monotonic, lexicographically sortable id (same scheme as the attempt log).
 * @param {string} prefix - 'presp_' or 'pobs_'
 * @param {number} ts
 * @returns {string}
 */
function makeId(prefix, ts) {
  const time = ts.toString(16).padStart(13, '0');
  let rand = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const b = new Uint8Array(4);
    crypto.getRandomValues(b);
    rand = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  } else {
    rand = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  }
  return `${prefix}${time}${rand}`;
}

function normaliseConfidence(value) {
  return Number.isInteger(value) && value >= 1 && value <= 3 ? value : null;
}

/**
 * Validate and normalise a response record. Rejects rather than storing something the
 * scoring layer would later have to guess about: a non-numeric `value` is refused (the
 * module that scores these treats non-numbers as not-answered), and a missing `retake`
 * is refused because history is only queryable by it.
 * @param {object} r
 * @returns {{ok: true, record: object} | {ok: false, reason: string}}
 */
export function normaliseResponse(r) {
  if (!r || typeof r !== 'object') return { ok: false, reason: 'response is not an object' };
  if (typeof r.itemId !== 'string' || !r.itemId) return { ok: false, reason: 'itemId is required' };
  if (typeof r.value !== 'number' || !Number.isInteger(r.value) || r.value < 1 || r.value > 5) {
    return { ok: false, reason: 'value must be an integer 1..5' };
  }
  if (!Number.isInteger(r.retake) || r.retake < 0) return { ok: false, reason: 'retake must be an integer >= 0' };

  const ts = Number.isFinite(r.ts) ? r.ts : Date.now();
  const scope = Array.isArray(r.scope)
    ? r.scope.filter((s) => typeof s === 'string' && ALLOWED_SCOPES.includes(s))
    : [];

  return {
    ok: true,
    record: {
      v: SCHEMA_VERSION, // only v1 exists; a future schema migrates records, never guesses
      id: typeof r.id === 'string' && r.id ? r.id : makeId('presp_', ts),
      ts,
      itemId: r.itemId,
      value: r.value,
      confidence: normaliseConfidence(r.confidence),
      scope,
      retake: r.retake
    }
  };
}

/**
 * Validate and normalise an observation record. `resisted` is strict: only boolean true
 * or false survives; anything else (including the string 'true') reads null, which the
 * salience rule treats as "not stated" and never counts.
 * @param {object} o
 * @returns {{ok: true, record: object} | {ok: false, reason: string}}
 */
export function normaliseObservation(o) {
  if (!o || typeof o !== 'object') return { ok: false, reason: 'observation is not an object' };
  if (typeof o.tactic !== 'string' || !o.tactic) return { ok: false, reason: 'tactic is required' };
  if (typeof o.contextTag !== 'string' || !o.contextTag) return { ok: false, reason: 'contextTag is required' };

  const ts = Number.isFinite(o.ts) ? o.ts : Date.now();
  const text = (v) => (typeof v === 'string' && v ? v : null);
  let resisted = null;
  if (o.resisted === true) resisted = true;
  else if (o.resisted === false) resisted = false;

  return {
    ok: true,
    record: {
      v: SCHEMA_VERSION,
      id: typeof o.id === 'string' && o.id ? o.id : makeId('pobs_', ts),
      ts,
      tactic: o.tactic,
      contextTag: o.contextTag,
      initialReaction: text(o.initialReaction),
      action: text(o.action),
      outcome: text(o.outcome),
      confidence: normaliseConfidence(o.confidence),
      resisted
    }
  };
}

/**
 * SHA-256 hex of a string via Web Crypto — available in browsers on
 * localhost/file:// (secure contexts) and in Node 19+. Returns null when the
 * runtime has no crypto.subtle; export() then omits the checksum field and
 * import() skips verification rather than failing.
 * @param {string} text
 * @returns {Promise<string|null>}
 */
export async function sha256Hex(text) {
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (!subtle) return null;
  try {
    const buf = await subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

/**
 * SHA-256 of exactly the {responses, observations} payload of a parsed profile
 * export — the same serialisation import() verifies and export() embeds. Single
 * source of truth so the verify-before-import helper and the import gate can
 * never drift. Returns null when the runtime has no Web Crypto.
 * @param {{responses: unknown[], observations: unknown[]}} parsed
 * @returns {Promise<string|null>}
 */
async function hashProfilePayload(parsed) {
  return sha256Hex(JSON.stringify({ responses: parsed.responses, observations: parsed.observations }));
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Records (answers + observations) recorded strictly AFTER a timestamp — the
 * "new answers since your last export" count that drives the re-export reminder.
 * @param {Array<{ts?: number}>} responses
 * @param {Array<{ts?: number}>} observations
 * @param {number} sinceTs
 * @returns {number}
 */
export function newRecordsSince(responses, observations, sinceTs) {
  if (!Number.isFinite(sinceTs)) return 0;
  let n = 0;
  for (const r of responses || []) if (Number.isFinite(r.ts) && r.ts > sinceTs) n++;
  for (const o of observations || []) if (Number.isFinite(o.ts) && o.ts > sinceTs) n++;
  return n;
}

/**
 * Whether the backup is stale enough to prompt a re-export. Two ways to be due:
 * the clock is at least `days` old with records newer than it (the steady-state
 * aging rule), OR an import just restored records newer than the clock — the
 * backup file demonstrably lacks records the store now holds, so the age gate
 * is waived (`restoredNewer`, the module sets it from import()'s restoredMaxTs).
 * No last export means no prompt — there is nothing to re-export yet.
 * @param {number|null|undefined} lastExportTs
 * @param {number} now
 * @param {number} days
 * @param {number} newCount
 * @param {boolean} [restoredNewer]
 * @returns {boolean}
 */
export function backupReminderDue(lastExportTs, now, days, newCount, restoredNewer) {
  if (!Number.isFinite(lastExportTs) || lastExportTs <= 0) return false;
  const minDays = Number.isFinite(days) && days > 0 ? days : 7;
  const ageOk = now - lastExportTs >= minDays * DAY_MS;
  return newCount > 0 && (ageOk || restoredNewer === true);
}

/**
 * Verify a profile export BEFORE importing it: recompute SHA-256 over the
 * {responses, observations} payload and compare it with the file's embedded
 * checksum. Never touches the store — this is the "drop the file in, get a
 * verdict" check the backup card offers. Uses the same payload hash as
 * import(), so the two cannot drift.
 *
 * @param {string} json
 * @returns {Promise<{ok: boolean, state: string, sha256?: string, reason?: string}>}
 *   state: 'intact' | 'legacy' | 'unverifiable' | 'tampered' | 'invalid'
 */
export async function verifyBackup(json) {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return { ok: false, state: 'invalid', reason: `not valid JSON: ${e.message}` };
  }
  if (!parsed || parsed.format !== 'sovereign-aegis-profile') {
    return { ok: false, state: 'invalid', reason: 'not a profile export' };
  }
  if (!Array.isArray(parsed.responses) || !Array.isArray(parsed.observations)) {
    return { ok: false, state: 'invalid', reason: 'export contains no responses/observations arrays' };
  }
  const hasChecksum = typeof parsed.sha256 === 'string';
  if (!hasChecksum) return { ok: true, state: 'legacy', sha256: null };

  const actual = await hashProfilePayload(parsed);
  // A runtime without Web Crypto can neither embed nor recompute checksums;
  // call it unverifiable rather than condemning a file we could not check.
  if (actual === null) {
    return { ok: true, state: 'unverifiable', reason: 'this browser cannot compute SHA-256 — verification skipped' };
  }
  if (actual !== parsed.sha256) {
    return { ok: false, state: 'tampered', reason: 'checksum mismatch — the file was altered or corrupted in transit' };
  }
  return { ok: true, state: 'intact', sha256: parsed.sha256 };
}

export const ProfileStore = {
  /** @returns {boolean} whether profile data can be durably stored here */
  isAvailable() {
    return typeof indexedDB !== 'undefined';
  },

  /**
   * Record one response. Callers may await this; unlike the attempt log, a response is
   * saved by an explicit "save this pass" action, so there is no live quiz to block.
   * @param {object} response
   * @returns {Promise<{ok: boolean, id?: string, reason?: string}>}
   */
  async saveResponse(response) {
    const n = normaliseResponse(response);
    if (!n.ok) return { ok: false, reason: n.reason };
    let db;
    try { db = await openDb(); } catch (e) { return { ok: false, reason: `store unavailable: ${e.message}` }; }
    try {
      await tx(db, STORE_RESPONSES, 'readwrite', (s) => s.put(n.record, n.record.id));
      return { ok: true, id: n.record.id };
    } catch (e) {
      return { ok: false, reason: e.message };
    } finally {
      db.close();
    }
  },

  /**
   * Every response, oldest first; filtered to one retake when a retake number is given.
   * @param {number} [retake]
   * @returns {Promise<object[]>}
   */
  async readResponses(retake) {
    let db;
    try { db = await openDb(); } catch { return []; }
    try {
      const all = await tx(db, STORE_RESPONSES, 'readonly', (s) => s.getAll());
      const rows = Number.isInteger(retake) ? (all || []).filter((r) => r.retake === retake) : (all || []);
      return rows.sort((a, b) => a.ts - b.ts);
    } catch {
      return [];
    } finally {
      db.close();
    }
  },

  /** @returns {Promise<number>} */
  async countResponses() {
    let db;
    try { db = await openDb(); } catch { return 0; }
    try {
      return (await tx(db, STORE_RESPONSES, 'readonly', (s) => s.count())) || 0;
    } catch {
      return 0;
    } finally {
      db.close();
    }
  },

  /**
   * Append one observation. Free text fields describe the operator's OWN reaction only.
   * @param {object} observation
   * @returns {Promise<{ok: boolean, id?: string, reason?: string}>}
   */
  async appendObservation(observation) {
    const n = normaliseObservation(observation);
    if (!n.ok) return { ok: false, reason: n.reason };
    let db;
    try { db = await openDb(); } catch (e) { return { ok: false, reason: `store unavailable: ${e.message}` }; }
    try {
      await tx(db, STORE_OBSERVATIONS, 'readwrite', (s) => s.put(n.record, n.record.id));
      return { ok: true, id: n.record.id };
    } catch (e) {
      return { ok: false, reason: e.message };
    } finally {
      db.close();
    }
  },

  /**
   * Every observation, oldest first. The salience rule re-derives its windows from these
   * raw events; nothing derived is stored.
   * @returns {Promise<object[]>}
   */
  async readObservations() {
    let db;
    try { db = await openDb(); } catch { return []; }
    try {
      const all = await tx(db, STORE_OBSERVATIONS, 'readonly', (s) => s.getAll());
      return (all || []).sort((a, b) => a.ts - b.ts);
    } catch {
      return [];
    } finally {
      db.close();
    }
  },

  /** @returns {Promise<number>} */
  async countObservations() {
    let db;
    try { db = await openDb(); } catch { return 0; }
    try {
      return (await tx(db, STORE_OBSERVATIONS, 'readonly', (s) => s.count())) || 0;
    } catch {
      return 0;
    } finally {
      db.close();
    }
  },

  /**
   * Export the whole profile as a portable JSON string — the operator's only backup,
   * since IndexedDB dies with the browser profile.
   * @returns {Promise<string>}
   */
  async export() {
    const [responses, observations] = await Promise.all([this.readResponses(), this.readObservations()]);
    // The checksum covers the payload only (not exportedAt/count/sha256), so the
    // operator can verify the file in transit: any bit flip in a record changes it.
    const payload = JSON.stringify({ responses, observations });
    const sha256 = await sha256Hex(payload);
    return JSON.stringify({
      format: 'sovereign-aegis-profile',
      v: SCHEMA_VERSION,
      exportedAt: Date.now(),
      count: responses.length + observations.length,
      ...(sha256 ? { sha256 } : {}),
      responses,
      observations
    }, null, 2);
  },

  /**
   * Import a previously exported profile. Validates EVERY record before writing ANYTHING,
   * so a corrupted or hostile file can never leave a mixed store behind. Deduplicates by
   * id per store, so importing twice is a no-op. The two stores move in one transaction.
   *
   * @param {string} json
   * @returns {Promise<{ok: boolean, imported?: number, skipped?: number, reason?: string}>}
   */
  async import(json) {
    let parsed;
    try {
      parsed = JSON.parse(json);
    } catch (e) {
      return { ok: false, reason: `not valid JSON: ${e.message}` };
    }
    if (!parsed || parsed.format !== 'sovereign-aegis-profile') {
      return { ok: false, reason: 'not a profile export' };
    }
    if (!Array.isArray(parsed.responses) || !Array.isArray(parsed.observations)) {
      return { ok: false, reason: 'export contains no responses/observations arrays' };
    }
    // The file's digest, surfaced on the success result so the module can show it
    // on the import toast — the operator compares it with the export toast's digest
    // to confirm this exact file is the one they backed up. Null for legacy files.
    const fileSha256 = typeof parsed.sha256 === 'string' ? parsed.sha256 : null;

    // When the export carries a checksum, verify it BEFORE touching any record:
    // it covers the raw responses/observations payload, so corruption in transit
    // or on disk is caught here. Legacy exports without one still import.
    if (typeof parsed.sha256 === 'string') {
      const actual = await hashProfilePayload(parsed);
      if (actual !== parsed.sha256) {
        return { ok: false, reason: 'checksum mismatch — the file was altered or corrupted in transit' };
      }
    }

    // Validate everything BEFORE writing anything.
    const responses = [];
    for (const [i, r] of parsed.responses.entries()) {
      const n = normaliseResponse(r);
      if (!n.ok) return { ok: false, reason: `response ${i} invalid: ${n.reason}` };
      responses.push(n.record);
    }
    const observations = [];
    for (const [i, o] of parsed.observations.entries()) {
      const n = normaliseObservation(o);
      if (!n.ok) return { ok: false, reason: `observation ${i} invalid: ${n.reason}` };
      observations.push(n.record);
    }

    let db;
    try { db = await openDb(); } catch (e) { return { ok: false, reason: e.message }; }
    try {
      const [existingR, existingO] = await txAll(db, 'readonly', (rs, os) =>
        [rs.getAllKeys(), os.getAllKeys()]);
      const freshR = responses.filter((r) => !existingR.includes(r.id));
      const freshO = observations.filter((o) => !existingO.includes(o.id));
      if (freshR.length || freshO.length) {
        await txAll(db, 'readwrite', (rs, os) => {
          for (const r of freshR) rs.put(r, r.id);
          for (const o of freshO) os.put(o, o.id);
          return null;
        });
      }
      // Newest ts among the records ACTUALLY written (restores keep their original
      // timestamps) — the module compares it with its last-export clock to detect
      // "this import restored records the backup file doesn't have". Null when
      // nothing was written (everything was already present).
      const writtenTs = [...freshR, ...freshO].map((rec) => rec.ts).filter((t) => Number.isFinite(t));
      const restoredMaxTs = writtenTs.length ? Math.max(...writtenTs) : null;
      return { ok: true, imported: freshR.length + freshO.length, skipped: responses.length + observations.length - freshR.length - freshO.length, sha256: fileSha256, restoredMaxTs };
    } catch (e) {
      return { ok: false, reason: e.message };
    } finally {
      db.close();
    }
  },

  /** Wipe both stores. Wired into Hard Reset alongside AttemptLog.clear(). */
  async clear() {
    let db;
    try { db = await openDb(); } catch { return false; }
    try {
      await txAll(db, 'readwrite', (rs, os) => { rs.clear(); os.clear(); return null; });
      return true;
    } catch {
      return false;
    } finally {
      db.close();
    }
  }
};

export default ProfileStore;
