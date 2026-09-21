/**
 * SOVEREIGN // AEGIS — Test Suite: Personal Defense Profile store (js/profilestore.js)
 *
 * WHY THERE IS AN INDEXEDDB STUB IN HERE
 * --------------------------------------
 * Same reasoning as the attempt-log suite: Node has no IndexedDB and the project has a
 * hard zero-dependency rule, so this file carries an in-memory stub of exactly the
 * surface profilestore.js uses — extended for multi-store transactions, because the
 * profile keeps responses and observations in two stores that import/clear must move
 * together. This suite proves the module's LOGIC — normalisation, dedupe, all-or-
 * nothing import — not that a real browser IndexedDB behaves as the stub does. Browser
 * behaviour is covered separately by the Playwright end-to-end check.
 *
 * Zero external runtime dependencies.
 */

/* ------------------------------------------------------ in-memory IndexedDB stub */

function installIndexedDbStub() {
  const databases = new Map(); // name -> { version, stores: Map<string, Map<key,value>> }

  class FakeRequest {
    constructor() { this.result = undefined; this.error = null; }
  }

  class FakeStore {
    constructor(map, tx) { this._map = map; this._tx = tx; }
    _req(value) { const r = new FakeRequest(); r.result = value; return r; }
    put(value, key) {
      if (this._tx.mode !== 'readwrite') throw new Error('read-only transaction');
      this._map.set(key, JSON.parse(JSON.stringify(value)));
      return this._req(key);
    }
    getAll() { return this._req([...this._map.values()]); }
    getAllKeys() { return this._req([...this._map.keys()]); }
    count() { return this._req(this._map.size); }
    clear() {
      if (this._tx.mode !== 'readwrite') throw new Error('read-only transaction');
      this._map.clear();
      return this._req(undefined);
    }
  }

  class FakeTransaction {
    constructor(db, storeNames, mode) {
      this.mode = mode;
      this._db = db;
      this._storeNames = storeNames;
      this.oncomplete = null;
      this.onerror = null;
      this.onabort = null;
      this.error = null;
      // Fires after the caller's synchronous block (which assigns oncomplete) finishes.
      queueMicrotask(() => { if (this.oncomplete) this.oncomplete(); });
    }
    objectStore(name) {
      const store = this._db._stores.get(name);
      if (!store) throw new Error(`no such store: ${name}`);
      return new FakeStore(store, this);
    }
  }

  class FakeDb {
    constructor(rec) {
      this._stores = rec.stores;
      this.closed = false;
      this.objectStoreNames = { contains: (n) => rec.stores.has(n) };
    }
    createObjectStore(name) { this._stores.set(name, new Map()); return {}; }
    transaction(names, mode = 'readonly') {
      if (this.closed) throw new Error('database is closed');
      const list = Array.isArray(names) ? names : [names];
      return new FakeTransaction(this, list, mode);
    }
    close() { this.closed = true; }
  }

  globalThis.indexedDB = {
    open(name, version) {
      const req = new FakeRequest();
      req.onupgradeneeded = null;
      req.onsuccess = null;
      req.onerror = null;
      queueMicrotask(() => {
        let rec = databases.get(name);
        const isNew = !rec || rec.version < version;
        if (!rec) { rec = { version, stores: new Map() }; databases.set(name, rec); }
        req.result = new FakeDb(rec);
        if (isNew) { rec.version = version; if (req.onupgradeneeded) req.onupgradeneeded(); }
        if (req.onsuccess) req.onsuccess();
      });
      return req;
    },
    _databases: databases
  };
}

installIndexedDbStub();

const { ProfileStore, normaliseResponse, normaliseObservation, SCHEMA_VERSION, ALLOWED_SCOPES,
  newRecordsSince, backupReminderDue, verifyBackup } = await import('../js/profilestore.js');

/* --------------------------------------------------------------------- harness */

class TestHarness {
  constructor(name) {
    this.suiteName = name; this.totalAssertions = 0; this.passed = 0;
    this.failed = 0; this.failures = []; this.currentSuite = '';
  }
  describe(name, fn) { this.currentSuite = name; console.log(`\n  --- ${name} ---`); return fn(); }
  async it(name, fn) {
    try { await fn(); } catch (err) {
      this.failed++; this.totalAssertions++;
      this.failures.push({ suite: this.currentSuite, test: name, error: err.message });
      console.error(`  ✗ [FAIL] ${name} (${err.message})`);
    }
  }
  assert(cond, msg) {
    this.totalAssertions++;
    if (cond) { this.passed++; console.log(`    ✓ ${msg}`); }
    else { this.failed++; this.failures.push({ suite: this.currentSuite, test: msg, error: 'Assertion failed' }); console.error(`    ✗ [FAIL] ${msg}`); }
  }
  assertEqual(a, e, m) { this.assert(a === e, `${m} | got ${JSON.stringify(a)}, expected ${JSON.stringify(e)}`); }
  summary() {
    console.log('\n====================================================');
    console.log(`[${this.suiteName}] Summary: ${this.passed}/${this.totalAssertions} Passed (${this.failed} Failed)`);
    console.log('====================================================');
    if (this.failed > 0) {
      console.error('\nFailure Details:');
      this.failures.forEach(f => console.error(` - [${f.suite}] ${f.test}: ${f.error}`));
      console.error('\n[FAIL] Profile store suite FAILED.');
      process.exitCode = 1;
    } else {
      console.log('\n[PASS] All profile store assertions passed.');
    }
  }
}

const t = new TestHarness('ProfileStore');
const resp = (over = {}) => ({ itemId: 'pitem.openness.01', value: 4, retake: 0, ...over });
const obs = (over = {}) => ({ tactic: 'false urgency', contextTag: 'urgency', ...over });

console.log('\n=== SOVEREIGN // AEGIS — PERSONAL DEFENSE PROFILE STORE SUITE ===');

/* ------------------------------------------------------ normalisation (pure) */

await t.describe('normaliseResponse — rejects rather than guessing', async () => {
  await t.it('rejects malformed input', () => {
    t.assertEqual(normaliseResponse(null).ok, false, 'null rejected');
    t.assertEqual(normaliseResponse('nope').ok, false, 'string rejected');
    t.assertEqual(normaliseResponse(resp({ itemId: '' })).ok, false, 'empty itemId rejected');
    t.assertEqual(normaliseResponse(resp({ value: '3' })).ok, false, 'numeric-string value rejected');
    t.assertEqual(normaliseResponse(resp({ value: 0 })).ok, false, 'value 0 rejected');
    t.assertEqual(normaliseResponse(resp({ value: 6 })).ok, false, 'value 6 rejected');
    t.assertEqual(normaliseResponse(resp({ value: 2.5 })).ok, false, 'non-integer value rejected');
    t.assertEqual(normaliseResponse(resp({ retake: undefined })).ok, false, 'missing retake rejected');
    t.assertEqual(normaliseResponse(resp({ retake: -1 })).ok, false, 'negative retake rejected');
    t.assertEqual(normaliseResponse(resp({ retake: 1.5 })).ok, false, 'non-integer retake rejected');
  });

  await t.it('fills defaults without inventing data', () => {
    const r = normaliseResponse(resp()).record;
    t.assertEqual(r.v, SCHEMA_VERSION, 'schema version stamped');
    t.assert(Number.isFinite(r.ts), 'timestamp defaulted to now');
    t.assert(/^presp_[0-9a-f]{21}$/.test(r.id), `id is presp_ + 21 hex (${r.id})`);
    t.assertEqual(r.confidence, null, 'unknown confidence is null, not 0');
    t.assertEqual(JSON.stringify(r.scope), '[]', 'missing scope is an empty list, not invented');
    t.assertEqual(r.retake, 0, 'retake preserved');
  });

  await t.it('normalises hostile-ish values', () => {
    t.assertEqual(normaliseResponse(resp({ confidence: 7 })).record.confidence, null, 'out-of-range confidence dropped');
    t.assertEqual(normaliseResponse(resp({ confidence: 'sure' })).record.confidence, null, 'string confidence dropped');
    t.assertEqual(normaliseResponse(resp({ confidence: 2 })).record.confidence, 2, 'int confidence kept');
    t.assertEqual(JSON.stringify(normaliseResponse(resp({ scope: ['online', 'nope', 42] })).record.scope), '["online"]', 'scope filtered to the allowed vocabulary');
    t.assertEqual(JSON.stringify(normaliseResponse(resp({ scope: 'online' })).record.scope), '[]', 'non-array scope dropped');
    const kept = normaliseResponse(resp({ id: 'presp_abc', v: 1 })).record;
    t.assertEqual(kept.id, 'presp_abc', 'an existing id is preserved (import is restore, not re-record)');
  });
});

/* ------------------------------------------------------- normalisation (obs) */

await t.describe('normaliseObservation — strict where it matters', async () => {
  await t.it('rejects records without tactic or contextTag', () => {
    t.assertEqual(normaliseObservation(null).ok, false, 'null rejected');
    t.assertEqual(normaliseObservation(obs({ tactic: '' })).ok, false, 'empty tactic rejected');
    t.assertEqual(normaliseObservation(obs({ tactic: 42 })).ok, false, 'non-string tactic rejected');
    t.assertEqual(normaliseObservation(obs({ contextTag: '' })).ok, false, 'empty contextTag rejected');
  });

  await t.it('resisted is strict boolean-or-null — a string cannot count', () => {
    t.assertEqual(normaliseObservation(obs({ resisted: true })).record.resisted, true, 'true survives');
    t.assertEqual(normaliseObservation(obs({ resisted: false })).record.resisted, false, 'false survives');
    t.assertEqual(normaliseObservation(obs({ resisted: 'true' })).record.resisted, null, 'string "true" reads null');
    t.assertEqual(normaliseObservation(obs({ resisted: 1 })).record.resisted, null, '1 reads null');
    t.assertEqual(normaliseObservation(obs()).record.resisted, null, 'missing reads null');
  });

  await t.it('free-text fields are strings or null; ids and timestamps default', () => {
    const r = normaliseObservation(obs({ action: '', outcome: 99, initialReaction: 'felt pulled' })).record;
    t.assertEqual(r.action, null, 'empty action dropped to null');
    t.assertEqual(r.outcome, null, 'non-string outcome dropped to null');
    t.assertEqual(r.initialReaction, 'felt pulled', 'real text preserved');
    t.assert(/^pobs_[0-9a-f]{21}$/.test(r.id), `id is pobs_ + 21 hex (${r.id})`);
    t.assert(Number.isFinite(r.ts), 'timestamp defaulted to now');
  });
});

/* ------------------------------------------------------------ append and read */

await t.describe('save / read / count', async () => {
  await t.it('starts empty and clears cleanly', async () => {
    await ProfileStore.clear();
    t.assertEqual(await ProfileStore.countResponses(), 0, 'no responses after clear');
    t.assertEqual(await ProfileStore.countObservations(), 0, 'no observations after clear');
  });

  await t.it('saves a response and reads it back with retake filter', async () => {
    await ProfileStore.clear();
    const r = await ProfileStore.saveResponse(resp({ value: 3, retake: 1 }));
    t.assert(r.ok, 'save reports ok');
    const all = await ProfileStore.readResponses();
    t.assertEqual(all.length, 1, 'one record stored');
    t.assertEqual(all[0].id, r.id, 'returned id matches stored id');
    t.assertEqual(all[0].value, 3, 'value preserved');
    t.assertEqual(all[0].retake, 1, 'retake preserved');
    t.assertEqual((await ProfileStore.readResponses(1)).length, 1, 'retake 1 filter finds it');
    t.assertEqual((await ProfileStore.readResponses(0)).length, 0, 'retake 0 filter does not');
  });

  await t.it('appends an observation and reads it back', async () => {
    await ProfileStore.clear();
    const o = await ProfileStore.appendObservation(obs({ resisted: false, confidence: 2 }));
    t.assert(o.ok, 'append reports ok');
    const all = await ProfileStore.readObservations();
    t.assertEqual(all.length, 1, 'one observation stored');
    t.assertEqual(all[0].resisted, false, 'resisted preserved');
    t.assertEqual(all[0].contextTag, 'urgency', 'contextTag preserved');
  });

  await t.it('refuses invalid records without touching either store', async () => {
    await ProfileStore.clear();
    const bad = await ProfileStore.saveResponse({ itemId: 'x' });
    t.assertEqual(bad.ok, false, 'invalid response reports not-ok');
    t.assert(/value|retake/.test(bad.reason), `reason names the problem (${bad.reason})`);
    const badO = await ProfileStore.appendObservation({ tactic: 'x' });
    t.assertEqual(badO.ok, false, 'invalid observation reports not-ok');
    t.assertEqual(await ProfileStore.countResponses(), 0, 'responses unchanged');
    t.assertEqual(await ProfileStore.countObservations(), 0, 'observations unchanged');
  });

  await t.it('readResponses sorts oldest first; responses and observations never mix', async () => {
    await ProfileStore.clear();
    for (const ts of [3000, 1000, 2000]) await ProfileStore.saveResponse(resp({ ts, retake: 0 }));
    const stamps = (await ProfileStore.readResponses()).map((r) => r.ts);
    t.assertEqual(JSON.stringify(stamps), JSON.stringify([1000, 2000, 3000]), 'ascending by ts');
    t.assertEqual(await ProfileStore.countObservations(), 0, 'observations untouched by response saves');
  });
});

/* ------------------------------------------------------------ export / import */

await t.describe('export / import — the operator\'s backup', async () => {
  await t.it('export is self-describing JSON covering both stores', async () => {
    await ProfileStore.clear();
    await ProfileStore.saveResponse(resp({ ts: 1000 }));
    await ProfileStore.appendObservation(obs({ ts: 2000 }));
    const parsed = JSON.parse(await ProfileStore.export());
    t.assertEqual(parsed.format, 'sovereign-aegis-profile', 'format tag present');
    t.assertEqual(parsed.v, SCHEMA_VERSION, 'schema version present');
    t.assertEqual(parsed.count, 2, 'count covers both stores');
    t.assertEqual(parsed.responses.length, 1, 'responses included');
    t.assertEqual(parsed.observations.length, 1, 'observations included');
    t.assert(/^[0-9a-f]{64}$/.test(parsed.sha256 || ''), 'export carries a 64-hex SHA-256 checksum');
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(
      JSON.stringify({ responses: parsed.responses, observations: parsed.observations })));
    const expectHex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    t.assertEqual(parsed.sha256, expectHex, 'checksum is exactly SHA-256 of the payload');
  });

  await t.it('round-trips through a wiped store, ids preserved exactly', async () => {
    await ProfileStore.clear();
    for (const ts of [1000, 2000, 3000]) await ProfileStore.saveResponse(resp({ ts, retake: 0 }));
    await ProfileStore.appendObservation(obs({ ts: 1500 }));
    const dump = await ProfileStore.export();
    const parsedDump = JSON.parse(dump);
    const idsBefore = JSON.stringify((await ProfileStore.readResponses()).map((r) => r.id));
    await ProfileStore.clear();
    const r = await ProfileStore.import(dump);
    t.assert(r.ok, 'import reports ok');
    t.assertEqual(r.imported, 4, 'all 4 records imported');
    t.assertEqual(r.sha256, parsedDump.sha256, 'import result carries the restored file\'s digest — the value to compare with the export toast');
    t.assertEqual(r.restoredMaxTs, 3000, 'restoredMaxTs is the newest ts actually written (restore, not re-record)');
    t.assertEqual(JSON.stringify((await ProfileStore.readResponses()).map((x) => x.id)), idsBefore,
      'response ids preserved exactly — import is restore, not re-record');
    t.assertEqual(await ProfileStore.countObservations(), 1, 'observation restored too');
  });

  await t.it('importing twice is a no-op', async () => {
    await ProfileStore.clear();
    await ProfileStore.saveResponse(resp({ ts: 1000 }));
    const dump = await ProfileStore.export();
    await ProfileStore.clear();
    await ProfileStore.import(dump);
    const second = await ProfileStore.import(dump);
    t.assert(second.ok, 'second import still ok');
    t.assertEqual(second.imported, 0, 'nothing imported the second time');
    t.assertEqual(second.skipped, 1, 'the duplicate is reported as skipped');
    t.assertEqual(second.restoredMaxTs, null, 'nothing written → no restored timestamp');
  });

  await t.it('rejects a file whose payload was altered in transit', async () => {
    await ProfileStore.clear();
    await ProfileStore.saveResponse(resp({ ts: 1000 }));
    const parsed = JSON.parse(await ProfileStore.export());
    parsed.responses[0].value = 5; // still a valid record shape — only the checksum gives it away
    await ProfileStore.clear();
    const r = await ProfileStore.import(JSON.stringify(parsed));
    t.assertEqual(r.ok, false, 'tampered file rejected');
    t.assert(/checksum/.test(r.reason), `reason names the checksum (${r.reason})`);
    t.assertEqual(await ProfileStore.countResponses(), 0, 'NOTHING was written');
  });

  await t.it('legacy exports without a checksum still import', async () => {
    await ProfileStore.clear();
    await ProfileStore.saveResponse(resp({ ts: 4000 })); // distinct id from earlier tests, so it imports fresh
    const parsed = JSON.parse(await ProfileStore.export());
    delete parsed.sha256;
    await ProfileStore.clear(); // import into an empty store, like a restore
    const r = await ProfileStore.import(JSON.stringify(parsed));
    t.assert(r.ok, 'legacy file without a checksum imports');
    t.assertEqual(r.imported, 1, 'its records import normally');
    t.assertEqual(r.sha256, null, 'legacy import reports no digest');
  });

  await t.it('rejects the whole file rather than half-loading it', async () => {
    await ProfileStore.clear();
    const good = normaliseResponse(resp({ ts: 1000 })).record;
    const bad = { ...normaliseResponse(resp({ ts: 2000 })).record, value: 'maybe' };
    const r = await ProfileStore.import(JSON.stringify({
      format: 'sovereign-aegis-profile', v: 1, responses: [good, bad], observations: []
    }));
    t.assertEqual(r.ok, false, 'import rejected');
    t.assert(/response 1/.test(r.reason), `reason identifies the offending index (${r.reason})`);
    t.assertEqual(await ProfileStore.countResponses(), 0, 'ATOMIC: the valid record before it was NOT written');
  });

  await t.it('rejects files that are not profile exports', async () => {
    t.assertEqual((await ProfileStore.import('{not json')).ok, false, 'malformed JSON rejected');
    t.assertEqual((await ProfileStore.import('{"format":"something-else","responses":[],"observations":[]}')).ok, false, 'wrong format tag rejected');
    t.assertEqual((await ProfileStore.import('{"format":"sovereign-aegis-profile"}')).ok, false, 'missing arrays rejected');
    t.assertEqual((await ProfileStore.import('null')).ok, false, 'null rejected');
  });

  await t.it('a hostile import cannot pollute Object.prototype', async () => {
    const payload = '{"format":"sovereign-aegis-profile","responses":[{"itemId":"i","value":3,"retake":0,"__proto__":{"polluted":true}}],"observations":[]}';
    const r = await ProfileStore.import(payload);
    t.assert(r.ok, 'record with a __proto__ key still imports');
    t.assertEqual({}.polluted, undefined, 'Object.prototype was not polluted');
  });
});

/* -------------------------------------------------------- verify before import */

await t.describe('verifyBackup — checksum check before anything is written', async () => {
  await t.it('an intact export verifies as intact with its checksum returned', async () => {
    await ProfileStore.clear();
    await ProfileStore.saveResponse(resp({ ts: 1000 }));
    const dump = await ProfileStore.export();
    const v = await verifyBackup(dump);
    t.assertEqual(v.ok, true, 'intact file verifies');
    t.assertEqual(v.state, 'intact', 'state names intact');
    t.assert(/^[0-9a-f]{64}$/.test(v.sha256 || ''), 'returns the file checksum');
  });

  await t.it('a tampered payload is flagged and the store is never touched', async () => {
    await ProfileStore.clear();
    await ProfileStore.saveResponse(resp({ ts: 1000 }));
    const parsed = JSON.parse(await ProfileStore.export());
    parsed.responses[0].value = 5; // still a valid record — only the checksum gives it away
    const v = await verifyBackup(JSON.stringify(parsed));
    t.assertEqual(v.ok, false, 'tampered file fails');
    t.assertEqual(v.state, 'tampered', 'state names tampering');
    t.assert(/checksum/.test(v.reason || ''), 'reason names the checksum');
    t.assertEqual(await ProfileStore.countResponses(), 1, 'the store was NOT touched by verification');
    t.assertEqual(await ProfileStore.countObservations(), 0, 'observations untouched too');
  });

  await t.it('legacy files without a checksum are accepted as legacy, never condemned', async () => {
    const parsed = JSON.parse(await ProfileStore.export());
    delete parsed.sha256;
    const v = await verifyBackup(JSON.stringify(parsed));
    t.assert(v.ok && v.state === 'legacy', `legacy accepted (${v.state})`);
    t.assert(v.sha256 === null, 'no checksum reported');
  });

  await t.it('non-exports and malformed JSON are invalid', async () => {
    t.assertEqual((await verifyBackup('{not json')).state, 'invalid', 'malformed JSON');
    t.assertEqual((await verifyBackup('{"format":"something-else","responses":[],"observations":[]}')).state, 'invalid', 'wrong format tag');
    t.assertEqual((await verifyBackup('null')).state, 'invalid', 'null');
    t.assertEqual((await verifyBackup('{"format":"sovereign-aegis-profile"}')).state, 'invalid', 'missing arrays');
  });

  await t.it('without Web Crypto the verdict is unverifiable, never tampered', async () => {
    const dump = await ProfileStore.export();
    const hadCrypto = 'crypto' in globalThis;
    const desc = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    try {
      Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
      const v = await verifyBackup(dump);
      t.assert(v.ok && v.state === 'unverifiable', `no-subtle is unverifiable, not tampered (${v.state})`);
    } finally {
      if (hadCrypto) Object.defineProperty(globalThis, 'crypto', desc);
      else delete globalThis.crypto;
    }
  });
});

/* ------------------------------------------------------------- backup reminder */

await t.describe('backup re-export reminder — pure clock logic', async () => {
  await t.it('newRecordsSince counts only records strictly after the clock', () => {
    t.assertEqual(newRecordsSince([{ ts: 100 }, { ts: 200 }, { ts: 150 }], [{ ts: 250 }], 150), 2,
      'the answer AT the boundary does not count; the newer ones do');
    t.assertEqual(newRecordsSince([], [], 0), 0, 'empty stores → 0');
    t.assertEqual(newRecordsSince([{ ts: 100 }, { noTs: true }], [{ ts: 50 }], 0), 2,
      'records without a finite ts are ignored, the rest count');
  });

  await t.it('backupReminderDue: old clock OR restored-newer, always with new records', () => {
    const now = 1_000_000_000_000;
    const DAY = 24 * 3600 * 1000;
    t.assertEqual(backupReminderDue(null, now, 7, 5), false, 'never exported → no prompt');
    t.assertEqual(backupReminderDue(now - 8 * DAY, now, 7, 0), false, 'old clock but no new records → no prompt');
    t.assertEqual(backupReminderDue(now - 8 * DAY, now, 7, 1), true, 'old clock with new records → prompt');
    t.assertEqual(backupReminderDue(now - 7 * DAY, now, 7, 1), true, 'exactly N days is due (>= boundary)');
    t.assertEqual(backupReminderDue(now - 6 * DAY, now, 7, 1), false, 'before N days → not due');
    t.assertEqual(backupReminderDue(now - 3 * DAY, now, 2, 1), true, 'custom days respected');
    t.assertEqual(backupReminderDue(now - 3 * DAY, now, 0, 1), false, 'invalid days falls back to the 7-day default');
    t.assertEqual(backupReminderDue(0, now, 7, 1), false, 'a zero clock reads as never exported');
  });

  await t.it('a re-import restoring newer records waives the age gate', () => {
    const now = 1_000_000_000_000;
    const DAY = 24 * 3600 * 1000;
    t.assertEqual(backupReminderDue(now - 1 * DAY, now, 7, 2, true), true,
      'young clock but the import restored newer records → prompt now');
    t.assertEqual(backupReminderDue(now - 1 * DAY, now, 7, 2, false), false,
      'same state without the flag stays behind the age gate');
    t.assertEqual(backupReminderDue(now - 8 * DAY, now, 7, 2, true), true,
      'flag with an old clock is still due (age path fires anyway)');
    t.assertEqual(backupReminderDue(now - 1 * DAY, now, 7, 0, true), false,
      'flag without new records → no prompt (nothing to re-export)');
    t.assertEqual(backupReminderDue(null, now, 7, 2, true), false,
      'flag with no clock → no prompt (never exported)');
  });
});

/* ----------------------------------------------------------- graceful absence */

await t.describe('no IndexedDB — degrade, never throw', async () => {
  await t.it('reports unavailability and returns empty rather than crashing', async () => {
    const saved = globalThis.indexedDB;
    delete globalThis.indexedDB;
    try {
      t.assertEqual(ProfileStore.isAvailable(), false, 'isAvailable() reports false');
      t.assertEqual((await ProfileStore.saveResponse(resp())).ok, false, 'save fails softly');
      t.assertEqual((await ProfileStore.readResponses()).length, 0, 'readResponses returns []');
      t.assertEqual(await ProfileStore.countResponses(), 0, 'count returns 0');
      t.assertEqual(await ProfileStore.clear(), false, 'clear returns false');
    } finally {
      globalThis.indexedDB = saved;
    }
    t.assertEqual(ProfileStore.isAvailable(), true, 'availability restored for later suites');
  });
});

t.summary();
