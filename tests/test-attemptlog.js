/**
 * SOVEREIGN // AEGIS — Test Suite: Append-only attempt log (js/attemptlog.js)
 *
 * WHY THERE IS AN INDEXEDDB STUB IN HERE
 * -------------------------------------
 * The attempt log is the only durable record of what the operator can and cannot do. Its
 * failure modes are quiet: a rejected record, a half-applied import, an id that does not
 * sort by time. None of those show up in the UI until months of history are wrong.
 *
 * Node has no IndexedDB, and the project has a hard zero-dependency rule, so this file
 * carries a ~90-line in-memory stub of exactly the surface attemptlog.js uses. That is a
 * real limitation and worth stating plainly: this suite proves the module's LOGIC —
 * validation, ordering, range scans, all-or-nothing import, dedupe — not that a real
 * browser IndexedDB behaves as the stub does. Browser behaviour is covered separately by
 * the Playwright end-to-end check.
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
    getAll(range) {
      let entries = [...this._map.entries()];
      if (range) entries = entries.filter(([k]) => range.includes(k));
      return this._req(entries.map(([, v]) => v));
    }
    getAllKeys() { return this._req([...this._map.keys()]); }
    count() { return this._req(this._map.size); }
    clear() {
      if (this._tx.mode !== 'readwrite') throw new Error('read-only transaction');
      this._map.clear();
      return this._req(undefined);
    }
  }

  class FakeTransaction {
    constructor(db, storeName, mode) {
      this.mode = mode;
      this._db = db;
      this._storeName = storeName;
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
    transaction(storeName, mode = 'readonly') {
      if (this.closed) throw new Error('database is closed');
      return new FakeTransaction(this, storeName, mode);
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

  globalThis.IDBKeyRange = {
    lowerBound(bound) { return { includes: (k) => String(k) >= String(bound) }; }
  };
}

installIndexedDbStub();

const { AttemptLog, normaliseAttempt, SCHEMA_VERSION } = await import('../js/attemptlog.js');

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
      console.error('\n[FAIL] Attempt log suite FAILED.');
      process.exitCode = 1;
    } else {
      console.log('\n[PASS] All attempt log assertions passed.');
    }
  }
}

const fsMod = await import('node:fs');
const urlMod = await import('node:url');
const readData = (rel) =>
  JSON.parse(fsMod.readFileSync(urlMod.fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8'));
const SKILL_IDS = new Set(readData('data/skills.json').map((s) => s.id));

const t = new TestHarness('AttemptLog');
const attempt = (over = {}) => ({
  skillId: 'skill.fallacy.relevance',
  itemId: 'q1',
  correct: true,
  ...over
});

console.log('\n=== SOVEREIGN // AEGIS — ATTEMPT LOG SUITE ===');

/* ------------------------------------------------------ normalisation (pure) */

await t.describe('normaliseAttempt — rejects rather than guessing', async () => {
  await t.it('rejects malformed input', () => {
    t.assertEqual(normaliseAttempt(null).ok, false, 'null rejected');
    t.assertEqual(normaliseAttempt('nope').ok, false, 'string rejected');
    t.assertEqual(normaliseAttempt(attempt({ skillId: '' })).ok, false, 'empty skillId rejected');
    t.assertEqual(normaliseAttempt(attempt({ skillId: 42 })).ok, false, 'non-string skillId rejected');
    t.assertEqual(normaliseAttempt(attempt({ itemId: undefined })).ok, false, 'missing itemId rejected');
    // `correct` must be a boolean, not truthy: a record of "1" would silently become a
    // correct answer, which is a wrong data point rather than a missing one.
    t.assertEqual(normaliseAttempt(attempt({ correct: 1 })).ok, false, 'truthy non-boolean correct rejected');
    t.assertEqual(normaliseAttempt(attempt({ correct: 'yes' })).ok, false, 'string correct rejected');
    t.assert(normaliseAttempt(attempt({ correct: false })).ok, 'correct:false is valid, not falsy-rejected');
  });

  await t.it('fills defaults without inventing data', () => {
    const r = normaliseAttempt(attempt()).record;
    t.assertEqual(r.v, SCHEMA_VERSION, 'schema version stamped on every record');
    t.assertEqual(r.context, 'unknown', 'missing context is explicitly "unknown"');
    t.assertEqual(r.heldOut, false, 'heldOut defaults false');
    t.assertEqual(r.latencyMs, null, 'unknown latency is null, not 0');
    t.assert(Number.isFinite(r.ts), 'timestamp defaulted to now');
    t.assert(/^att_[0-9a-f]{21}$/.test(r.id), `id is att_ + 21 hex (${r.id})`);
  });

  await t.it('normalises hostile-ish values', () => {
    t.assertEqual(normaliseAttempt(attempt({ latencyMs: -5 })).record.latencyMs, null, 'negative latency dropped');
    t.assertEqual(normaliseAttempt(attempt({ latencyMs: 12.7 })).record.latencyMs, 13, 'latency rounded to ms');
    t.assertEqual(normaliseAttempt(attempt({ latencyMs: NaN })).record.latencyMs, null, 'NaN latency dropped');
    t.assertEqual(normaliseAttempt(attempt({ heldOut: 'true' })).record.heldOut, false, 'heldOut is strict === true');
    t.assertEqual(normaliseAttempt(attempt({ context: 99 })).record.context, 'unknown', 'non-string context normalised');
  });

  await t.it('captures the chosen option as text, and only as text', () => {
    const withChosen = normaliseAttempt(attempt({ chosen: 'Ad Hominem' })).record;
    t.assertEqual(withChosen.chosen, 'Ad Hominem', 'a string chosen option is preserved');
    t.assertEqual(withChosen.v, SCHEMA_VERSION, 'a new record with a choice carries the current schema version');
    const empty = normaliseAttempt(attempt({ chosen: '' })).record;
    t.assertEqual(empty.chosen, null, 'an empty string is not a choice');
    const nonString = normaliseAttempt(attempt({ chosen: 42 })).record;
    t.assertEqual(nonString.chosen, null, 'a non-string chosen is dropped to null');
    const missing = normaliseAttempt(attempt({})).record;
    t.assertEqual(missing.chosen, null, 'a record without a choice reads null, not invented');
    const v2 = normaliseAttempt(attempt({ v: 2, confidence: 'sure' })).record;
    t.assertEqual(v2.v, 2, 'an imported v2 record keeps v2');
    t.assertEqual(v2.chosen, null, 'and reads chosen as not-stated');
  });

  await t.it('ids sort chronologically — this is what makes readSince a range scan', () => {
    const ids = [1000, 2000, 1786930000000, 1786930000001]
      .map((ts) => normaliseAttempt(attempt({ ts })).record.id);
    const sorted = [...ids].sort();
    t.assertEqual(JSON.stringify(sorted), JSON.stringify(ids), 'lexicographic order === chronological order');
    t.assertEqual(ids[0].length, ids[3].length, 'ids are fixed width (zero-padded)');
  });
});

/* ------------------------------------------------------------ append and read */

await t.describe('append / readAll / count', async () => {
  await t.it('starts empty', async () => {
    await AttemptLog.clear();
    t.assertEqual(await AttemptLog.count(), 0, 'count is 0 after clear');
    t.assertEqual((await AttemptLog.readAll()).length, 0, 'readAll is empty after clear');
  });

  await t.it('appends and reads back', async () => {
    const r = await AttemptLog.append(attempt({ ts: 1000, context: 'arena' }));
    t.assert(r.ok, 'append reports ok');
    const all = await AttemptLog.readAll();
    t.assertEqual(all.length, 1, 'one record stored');
    t.assertEqual(all[0].id, r.id, 'returned id matches stored id');
    t.assertEqual(all[0].context, 'arena', 'context preserved');
  });

  await t.it('refuses invalid records without touching the store', async () => {
    const before = await AttemptLog.count();
    const r = await AttemptLog.append({ skillId: 'x' });
    t.assertEqual(r.ok, false, 'invalid append reports not-ok');
    t.assert(/correct|itemId/.test(r.reason), `reason names the problem (${r.reason})`);
    t.assertEqual(await AttemptLog.count(), before, 'store size unchanged');
  });

  await t.it('readAll returns oldest first regardless of insertion order', async () => {
    await AttemptLog.clear();
    for (const ts of [3000, 1000, 2000]) await AttemptLog.append(attempt({ ts }));
    const ts = (await AttemptLog.readAll()).map((a) => a.ts);
    t.assertEqual(JSON.stringify(ts), JSON.stringify([1000, 2000, 3000]), 'sorted ascending by ts');
  });

  await t.it('append is additive — the log is never overwritten', async () => {
    await AttemptLog.clear();
    for (let i = 0; i < 25; i++) await AttemptLog.append(attempt({ ts: 1000 + i, correct: i % 2 === 0 }));
    t.assertEqual(await AttemptLog.count(), 25, '25 appends produce 25 records');
    const correct = (await AttemptLog.readAll()).filter((a) => a.correct).length;
    t.assertEqual(correct, 13, 'correct/incorrect both retained verbatim');
  });

  await t.it('two skills for one item produce two records sharing itemId', async () => {
    await AttemptLog.clear();
    // This is the Arena's behaviour: a question tagged with two skills is evidence about
    // both, and the estimator filters by skillId.
    await AttemptLog.append(attempt({ ts: 5000, skillId: 'skill.a', itemId: 'q7' }));
    await AttemptLog.append(attempt({ ts: 5000, skillId: 'skill.b', itemId: 'q7' }));
    const all = await AttemptLog.readAll();
    t.assertEqual(all.length, 2, 'two records written');
    t.assertEqual(new Set(all.map((a) => a.id)).size, 2, 'ids are distinct despite identical ts');
    t.assertEqual(new Set(all.map((a) => a.itemId)).size, 1, 'itemId is shared, so the event can be deduped later');
  });
});

/* -------------------------------------------------------------- range queries */

await t.describe('readSince', async () => {
  await t.it('returns only attempts at or after the timestamp', async () => {
    await AttemptLog.clear();
    for (const ts of [1000, 2000, 3000, 4000]) await AttemptLog.append(attempt({ ts }));
    t.assertEqual((await AttemptLog.readSince(0)).length, 4, 'since 0 returns everything');
    t.assertEqual((await AttemptLog.readSince(3000)).length, 2, 'since 3000 returns 2 (inclusive boundary)');
    t.assertEqual((await AttemptLog.readSince(4001)).length, 0, 'since past the end returns none');
  });

  await t.it('range scan agrees with a brute-force filter', async () => {
    await AttemptLog.clear();
    const stamps = [1, 500, 1786930000000, 1786930500000, 1786999999999];
    for (const ts of stamps) await AttemptLog.append(attempt({ ts }));
    for (const cut of [0, 500, 1786930000000, 1786930000001, 1786999999999]) {
      const viaRange = (await AttemptLog.readSince(cut)).length;
      const brute = stamps.filter((x) => x >= cut).length;
      t.assertEqual(viaRange, brute, `cut=${cut}: range scan matches filter`);
    }
  });
});

/* ------------------------------------------------------------ export / import */

await t.describe('export / import — the operator\'s real backup', async () => {
  await t.it('export is self-describing JSON', async () => {
    await AttemptLog.clear();
    for (const ts of [1000, 2000]) await AttemptLog.append(attempt({ ts }));
    const parsed = JSON.parse(await AttemptLog.export());
    t.assertEqual(parsed.format, 'sovereign-aegis-attempt-log', 'format tag present');
    t.assertEqual(parsed.v, SCHEMA_VERSION, 'schema version present');
    t.assertEqual(parsed.count, 2, 'count matches attempts array');
    t.assertEqual(parsed.attempts.length, 2, 'attempts included');
  });

  await t.it('round-trips through a wiped store', async () => {
    await AttemptLog.clear();
    for (const ts of [1000, 2000, 3000]) await AttemptLog.append(attempt({ ts }));
    const dump = await AttemptLog.export();
    const originalIds = (await AttemptLog.readAll()).map((a) => a.id);
    await AttemptLog.clear();
    t.assertEqual(await AttemptLog.count(), 0, 'store wiped before import');
    const r = await AttemptLog.import(dump);
    t.assert(r.ok, 'import reports ok');
    t.assertEqual(r.imported, 3, '3 records imported');
    t.assertEqual(JSON.stringify((await AttemptLog.readAll()).map((a) => a.id)), JSON.stringify(originalIds),
      'ids preserved exactly — import is restore, not re-record');
  });

  await t.it('importing twice is a no-op (dedupe by id)', async () => {
    await AttemptLog.clear();
    await AttemptLog.append(attempt({ ts: 1000 }));
    const dump = await AttemptLog.export();
    await AttemptLog.clear();
    await AttemptLog.import(dump);
    const second = await AttemptLog.import(dump);
    t.assert(second.ok, 'second import still reports ok');
    t.assertEqual(second.imported, 0, 'nothing imported the second time');
    t.assertEqual(second.skipped, 1, 'the duplicate is reported as skipped');
    t.assertEqual(await AttemptLog.count(), 1, 'store still holds one record');
  });

  await t.it('merges into an existing log without disturbing it', async () => {
    await AttemptLog.clear();
    await AttemptLog.append(attempt({ ts: 1000, itemId: 'existing' }));
    const dump = JSON.stringify({
      format: 'sovereign-aegis-attempt-log',
      v: SCHEMA_VERSION,
      attempts: [normaliseAttempt(attempt({ ts: 9000, itemId: 'imported' })).record]
    });
    const r = await AttemptLog.import(dump);
    t.assertEqual(r.imported, 1, 'the new record is imported');
    const items = (await AttemptLog.readAll()).map((a) => a.itemId);
    t.assertEqual(JSON.stringify(items), JSON.stringify(['existing', 'imported']), 'both records present, in time order');
  });

  await t.it('rejects the whole file rather than half-loading it', async () => {
    await AttemptLog.clear();
    const good = normaliseAttempt(attempt({ ts: 1000 })).record;
    const bad = { ...normaliseAttempt(attempt({ ts: 2000 })).record, correct: 'maybe' };
    const r = await AttemptLog.import(JSON.stringify({
      format: 'sovereign-aegis-attempt-log', v: 1, attempts: [good, bad]
    }));
    t.assertEqual(r.ok, false, 'import rejected');
    t.assert(/record 1/.test(r.reason), `reason identifies the offending index (${r.reason})`);
    t.assertEqual(await AttemptLog.count(), 0, 'ATOMIC: the valid record before it was NOT written');
  });

  await t.it('rejects files that are not attempt logs', async () => {
    t.assertEqual((await AttemptLog.import('{not json')).ok, false, 'malformed JSON rejected');
    t.assertEqual((await AttemptLog.import('{"format":"something-else","attempts":[]}')).ok, false, 'wrong format tag rejected');
    t.assertEqual((await AttemptLog.import('{"format":"sovereign-aegis-attempt-log"}')).ok, false, 'missing attempts array rejected');
    t.assertEqual((await AttemptLog.import('null')).ok, false, 'null rejected');
    // A pack-style payload must not be able to smuggle prototype pollution through import.
    const r = await AttemptLog.import('{"format":"sovereign-aegis-attempt-log","attempts":[{"skillId":"s","itemId":"i","correct":true,"__proto__":{"polluted":true}}]}');
    t.assert(r.ok, 'record with a __proto__ key still imports');
    t.assertEqual({}.polluted, undefined, 'Object.prototype was not polluted');
  });
});

/* ----------------------------------------------------------- graceful absence */

await t.describe('no IndexedDB — degrade, never throw', async () => {
  await t.it('reports unavailability and returns empty rather than crashing', async () => {
    const saved = globalThis.indexedDB;
    delete globalThis.indexedDB;
    try {
      t.assertEqual(AttemptLog.isAvailable(), false, 'isAvailable() reports false');
      const r = await AttemptLog.append(attempt());
      t.assertEqual(r.ok, false, 'append fails softly');
      t.assert(/unavailable/i.test(r.reason), `reason explains why (${r.reason})`);
      t.assertEqual((await AttemptLog.readAll()).length, 0, 'readAll returns []');
      t.assertEqual((await AttemptLog.readSince(0)).length, 0, 'readSince returns []');
      t.assertEqual(await AttemptLog.count(), 0, 'count returns 0');
      t.assertEqual(await AttemptLog.clear(), false, 'clear returns false');
    } finally {
      globalThis.indexedDB = saved;
    }
    t.assertEqual(AttemptLog.isAvailable(), true, 'availability restored for later suites');
  });
});

/* ------------------------------------------------- the loop, end to end (pure) */

await t.describe('log → estimator handoff', async () => {
  const { estimate, transfer } = await import('../js/competency.js');

  await t.it('a logged attempt moves the estimate off its cold-start default', async () => {
    await AttemptLog.clear();
    const now = 1786930000000;
    t.assertEqual(estimate(await AttemptLog.readAll(), 'skill.x', { now }).n, 0, 'cold start: n=0');
    for (let i = 0; i < 6; i++) {
      await AttemptLog.append(attempt({ skillId: 'skill.x', itemId: `q${i}`, correct: true, ts: now - i * 1000 }));
    }
    const est = estimate(await AttemptLog.readAll(), 'skill.x', { now });
    t.assertEqual(est.n, 6, 'estimator sees all 6 stored attempts');
    t.assert(est.mastery > 0.7, `mastery rose above the 0.5 default (${est.mastery.toFixed(3)})`);
    t.assert(est.confidence > 0.5, `confidence rose with n (${est.confidence.toFixed(3)})`);
  });

  await t.it('heldOut survives storage, so transfer can be computed from the log alone', async () => {
    await AttemptLog.clear();
    const now = 1786930000000;
    for (let i = 0; i < 12; i++) {
      await AttemptLog.append(attempt({
        skillId: 'skill.x', itemId: `h${i}`, heldOut: true,
        correct: i >= 6, ts: now - (12 - i) * 86400000
      }));
    }
    const stored = await AttemptLog.readAll();
    t.assertEqual(stored.filter((a) => a.heldOut).length, 12, 'heldOut flag persisted');
    t.assertEqual(estimate(stored, 'skill.x', { now }).n, 0, 'held-out attempts excluded from mastery by default');
    const tr = transfer(stored);
    t.assert(tr.available, 'transfer report is available at 12 held-out attempts');
    t.assertEqual(tr.delta, 1, 'delta is +1.0 — 0/6 early, 6/6 late');
    t.assert(tr.caveat.length > 40, 'caveat travels with the number');
  });
});

/* ------------------------------------------------------- calibration panel */

await t.describe('Calibration panel — the payoff, and what it refuses to draw', async () => {
  const P = await import('../js/calibrationPanel.js');
  const C = await import('../js/competency.js');

  // Deterministic synthetic learners: no RNG, no clock.
  const rated = (n, p, confidence, seed) => {
    let s = seed;
    const r = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    return Array.from({ length: n }, (_, i) => ({
      v: 2, id: `a_${confidence}_${i}`, ts: 1786000000000 + i * 1000, skillId: 'skill.x',
      itemId: `i${i}`, correct: r() < p, latencyMs: 1000, context: 'arena', heldOut: false, confidence
    }));
  };
  const overconfident = C.calibration([...rated(40, 0.45, 'sure', 3), ...rated(20, 0.5, 'unsure', 9)]);
  const wellCalibrated = C.calibration([
    ...rated(30, 0.9, 'sure', 3), ...rated(24, 0.6, 'unsure', 9), ...rated(18, 0.25, 'guess', 11)
  ]);

  await t.it('refuses to draw a curve from too little data', () => {
    const empty = C.calibration([]);
    t.assertEqual(P.reliabilitySvg(empty), '', 'no SVG at all with zero rated answers');
    t.assert(P.calibrationPanel(empty).includes(`0 of ${P.MIN_RATED}`), 'the panel states the shortfall as a count');

    const thin = C.calibration(rated(P.MIN_RATED - 1, 0.5, 'sure', 5));
    t.assertEqual(P.reliabilitySvg(thin), '', `still no SVG at ${P.MIN_RATED - 1} rated answers`);
    t.assert(P.calibrationPanel(thin).includes(`${P.MIN_RATED - 1} of ${P.MIN_RATED}`), 'and says how many are needed');
    // The refusal is the point: a firm-looking curve from four answers would be the application
    // committing the exact error it teaches against.
    t.assert(/would look firm and mean nothing/.test(P.calibrationPanel(thin)), 'and says why it is refusing');
  });

  await t.it('draws once there is enough, and reports the sample size', () => {
    const svg = P.reliabilitySvg(wellCalibrated);
    t.assert(svg.length > 500, `SVG rendered (${svg.length} chars)`);
    t.assert(P.calibrationPanel(wellCalibrated).includes(`${wellCalibrated.n} RATED ANSWERS`), 'n is on the panel');
  });

  await t.it('is one series in one hue — no status colour on the curve', () => {
    // Colouring the line by whether the operator looks good would encode a judgement the diagram
    // exists to let them make. Status tokens are reserved for status.
    const svg = P.reliabilitySvg(overconfident);
    t.assertEqual(/veracity-green|disinfo-crimson/.test(svg), false, 'no status colours in the plot');
    const hues = [...new Set((svg.match(/var\(--[a-z-]+\)/g) || []))].filter((v) => !/font|space/.test(v));
    t.assert(hues.every((h) => /bronze-primary|stone-warm|border-subtle|parchment-bright|bg-surface-inset/.test(h)),
      `only one data hue plus recessive furniture: ${hues.join(' ')}`);
  });

  await t.it('uses no hard-coded colours — the panel follows the theme', () => {
    const all = P.calibrationPanel(wellCalibrated) + P.reliabilitySvg(wellCalibrated);
    const literals = all.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
    t.assertEqual(literals.length, 0, `no hex literals${literals.length ? ` (${[...new Set(literals)].join(', ')})` : ''}`);
  });

  await t.it('the diagonal is the only dashed line, and axes are solid', () => {
    // Dashed gridlines read as "projection"; a dashed reference reads as a threshold, which is
    // what perfect calibration is. So exactly one dashed rule, and it is labelled.
    const svg = P.reliabilitySvg(wellCalibrated);
    const dashedLines = (svg.match(/<line[^>]*stroke-dasharray/g) || []).length;
    t.assertEqual(dashedLines, 1, 'exactly one dashed line — the reference diagonal');
    t.assert(svg.includes('PERFECTLY CALIBRATED'), 'and it is labelled, so identity is not colour-alone');
    const axes = (svg.match(/<line[^>]*border-subtle[^>]*>/g) || []);
    t.assertEqual(axes.length, 2, 'two solid hairline axes');
    t.assertEqual(axes.some((a) => /dasharray/.test(a)), false, 'neither axis is dashed');
  });

  await t.it('thin bins are drawn hollow and excluded from the fitted line', () => {
    // A bin of two answers must not look like a firm point on a curve.
    const lopsided = C.calibration([...rated(30, 0.8, 'sure', 3), ...rated(2, 0.5, 'guess', 7)]);
    const svg = P.reliabilitySvg(lopsided);
    t.assert(svg.includes('stroke-dasharray="3 3"'), 'the thin bin is drawn hollow');
    t.assert(svg.includes('too few to rely on'), 'and says so on hover');
    const poly = svg.match(/<polyline points="([^"]*)"/);
    const pointCount = poly ? poly[1].trim().split(/\s+/).length : 0;
    t.assertEqual(pointCount, 0, 'with only one reliable bin, no line is drawn at all');
  });

  await t.it('labels one point directly, not every point', () => {
    const svg = P.reliabilitySvg(wellCalibrated);
    const pctLabels = (svg.match(/% when sure/g) || []).length;
    t.assertEqual(pctLabels, 1, 'exactly one direct label — the claim with consequences');
  });

  await t.it('every value in the diagram is also in the table', () => {
    // A value reachable only inside a chart is a value some readers cannot reach.
    const table = P.reliabilityTable(wellCalibrated);
    const rows = (table.match(/<tr>/g) || []).length;
    t.assertEqual(rows, wellCalibrated.bins.length, `one row per bin (${rows})`);
    for (const b of wellCalibrated.bins) {
      t.assert(table.includes(b.level.toUpperCase()), `${b.level} row present`);
      t.assert(table.includes(`>${b.n}<`) || table.includes(`${b.n}\n`), `n=${b.n} shown for ${b.level}`);
    }
    t.assert(/tabular-nums/.test(table), 'table figures are tabular so columns align');
  });

  await t.it('names the direction and shows the Brier baseline', () => {
    t.assert(P.calibrationPanel(overconfident).includes('OVERCONFIDENT'), 'overconfident learner is named as such');
    const under = C.calibration(rated(40, 0.95, 'guess', 21));
    t.assert(P.calibrationPanel(under).includes('UNDERCONFIDENT'), 'underconfident learner too');
    t.assert(P.calibrationPanel(wellCalibrated).includes('WELL CALIBRATED'), 'and a calibrated one');
    // 0.250 is what claiming 50% on everything scores — without it the Brier number is unreadable.
    t.assert(P.calibrationPanel(overconfident).includes('0.250 is what claiming 50% on everything scores'),
      'the Brier baseline is stated, not assumed known');
  });

  await t.it('the caveat travels with the panel', () => {
    const html = P.calibrationPanel(wellCalibrated);
    t.assert(html.includes(wellCalibrated.caveat.slice(0, 40)),
      'calibration() supplies the caveat as data and the panel prints it');
  });

  await t.it('the hero figure avoids the display face and tabular figures', () => {
    const html = P.calibrationPanel(wellCalibrated);
    t.assert(/metric-value" style="font-family:var\(--font-sans\)/.test(html),
      'hero uses the sans face, not the display serif');
  });

  await t.it('renders without throwing on every shape calibration() can return', () => {
    const shapes = [null, undefined, {}, { available: false, n: 0, bins: [] },
      C.calibration([]), C.calibration(rated(3, 1, 'sure', 1)), wellCalibrated, overconfident];
    let threw = null;
    for (const s of shapes) {
      try { P.calibrationPanel(s); P.reliabilitySvg(s); P.reliabilityTable(s); }
      catch (e) { threw = `${JSON.stringify(s)?.slice(0, 30)}: ${e.message}`; }
    }
    t.assertEqual(threw, null, `all ${shapes.length} shapes render safely${threw ? ` (${threw})` : ''}`);
  });
});

/* ------------------------------------------- predict-then-measure forensics drill */

await t.describe('Forensics drill — a viewer that shows you the answer measures nothing', async () => {
  const D = await import('../js/forensicsDrill.js');
  const samples = readData('data/forensic_samples.json');
  const drills = D.allDrills(samples);

  await t.it('every sample yields drills, in every mode that applies to it', () => {
    t.assert(drills.length >= 10, `${drills.length} drills across ${samples.length} samples (${drills.length * 2} questions)`);
    const covered = new Set(drills.map((d) => d.sampleId));
    t.assertEqual(covered.size, samples.length, 'every sample is drillable');
    // c2pa applies to every medium; the per-medium modes must match the sample's own `type`.
    const wrongMode = drills.filter((d) => {
      if (d.mode === 'c2pa') return false;
      const s = samples.find((x) => x.id === d.sampleId);
      return d.mode !== s.type;
    }).map((d) => `${d.sampleId}/${d.mode}`);
    t.assertEqual(wrongMode.length, 0,
      `no drill is offered for an inapplicable mode${wrongMode.length ? ` (${wrongMode.join(', ')})` : ''}`);
    // And every sample must get BOTH its own mode and the provenance mode — otherwise a medium
    // would silently contribute half the evidence the others do.
    const perSample = {};
    drills.forEach((d) => { (perSample[d.sampleId] = perSample[d.sampleId] || []).push(d.mode); });
    const short = Object.entries(perSample).filter(([, ms]) => ms.length !== 2).map(([id]) => id);
    t.assertEqual(short.length, 0, `every sample yields exactly 2 drills — its medium and c2pa${short.length ? ` (${short.join(', ')})` : ''}`);
  });

  await t.it('the predicted answer matches the sample\'s own ground truth', () => {
    // The question is derived from the same fields the viewport renders, so the two cannot
    // disagree — but only if the derivation is right. Check each mode against the raw data.
    const wrong = [];
    for (const d of drills) {
      const s = samples.find((x) => x.id === d.sampleId);
      const chosen = d.predict.options[d.predict.correctIndex];
      if (d.mode === 'image') {
        const ela = s.forensics.ela.anomalyDetected, fft = s.forensics.fft.spectralSpikes;
        const wantsEla = /Localised ELA anomalies/.test(chosen);
        const wantsFft = /periodic spikes/.test(chosen);
        if (wantsEla !== ela || wantsFft !== fft) wrong.push(`${d.itemId}: ELA ${ela}/${wantsEla}, FFT ${fft}/${wantsFft}`);
      }
      if (d.mode === 'audio') {
        const voc = s.forensics.spectrogram.vocoderArtifacts;
        const wantsVoc = /vocoder brickwall/.test(chosen);
        if (wantsVoc !== voc) wrong.push(`${d.itemId}: vocoder ${voc}/${wantsVoc}`);
      }
      if (d.mode === 'c2pa') {
        const m = s.c2paManifest;
        const present = Boolean(m) && m.tamperStatus !== 'NO_MANIFEST';
        const verified = present && m.verified === true;
        const saysNone = /No manifest at all/.test(chosen);
        const saysVerified = /claims a verified signature/.test(chosen) && !/does not/.test(chosen);
        if (saysNone === present) wrong.push(`${d.itemId}: presence mismatch`);
        if (present && saysVerified !== verified) wrong.push(`${d.itemId}: verified ${verified}/${saysVerified}`);
      }
    }
    t.assertEqual(wrong.length, 0, `every prediction matches ground truth${wrong.length ? ` (${wrong.join('; ')})` : ''}`);
  });

  await t.it('the correct "what does it establish?" answer is always the hedged one', () => {
    // This is the half operators skip, and the half the app exists for. Every establish question
    // must have the qualified answer as correct and confident over-reads as distractors.
    const bad = drills.filter((d) => {
      const right = d.establish.options[d.establish.correctIndex];
      const overclaims = d.establish.options.filter((_, i) => i !== d.establish.correctIndex);
      const hedged = /not|does not|narrows|which is not|Nothing about/i.test(right);
      const confident = overclaims.every((o) => /^That /.test(o) || /^Nothing —/.test(o));
      return !hedged || !confident;
    });
    t.assertEqual(bad.length, 0, `all ${drills.length} establish questions hedge the answer and over-read the distractors`);
  });

  await t.it('the prediction is a genuine four-way choice, not a disguised true/false', () => {
    const bad = drills.filter((d) =>
      d.predict.options.length !== 4 || new Set(d.predict.options).size !== 4 ||
      d.establish.options.length !== 4 || new Set(d.establish.options).size !== 4);
    t.assertEqual(bad.length, 0, 'every question offers four distinct options');
    // Across the corpus the answer must not sit in one place — that was the Arena's exploit.
    const spread = [0, 0, 0, 0];
    drills.forEach((d) => spread[d.predict.correctIndex]++);
    t.assert(spread.filter((n) => n > 0).length >= 2,
      `prediction answers land in ${spread.filter((n) => n > 0).length} different positions (${spread.join('/')})`);
  });

  await t.it('refuses to drill a user upload — its ground truth is a default, not a fact', () => {
    // Scoring a prediction against `isSynthetic: false` on a file the app has never seen would
    // manufacture evidence, which is the failure this whole phase exists to remove.
    const uploaded = { id: 'user-media', type: 'image', isSynthetic: false, forensics: { ela: {}, fft: {} } };
    t.assertEqual(D.buildDrill(uploaded, 'image'), null, 'user-media yields no drill');
    t.assertEqual(D.buildDrill(uploaded, 'c2pa'), null, 'not even in c2pa mode');
  });

  await t.it('refuses modes that do not apply to the medium', () => {
    const audio = samples.find((s) => s.type === 'audio');
    t.assertEqual(D.buildDrill(audio, 'image'), null, 'no image drill for an audio sample');
    t.assertEqual(D.buildDrill(audio, 'video'), null, 'no video drill for an audio sample');
    t.assert(D.buildDrill(audio, 'audio') !== null, 'but the audio drill exists');
    t.assert(D.buildDrill(audio, 'c2pa') !== null, 'and provenance applies to every medium');
  });

  await t.it('every question is tagged with a real skill', () => {
    const unknown = drills.flatMap((d) => [...d.predict.skills, ...d.establish.skills])
      .filter((s) => !SKILL_IDS.has(s));
    t.assertEqual(unknown.length, 0, 'no drill references an undefined skill');
    const forensicSkills = new Set(drills.flatMap((d) => [...d.predict.skills, ...d.establish.skills]));
    t.assert(forensicSkills.has('skill.forensics.read-measurements'), 'reads measurements');
    t.assert(forensicSkills.has('skill.forensics.provenance'), 'and interprets provenance');
  });

  await t.it('item ids are stable and distinct, so repeats are countable', () => {
    const ids = drills.flatMap((d) => [d.predict.itemId, d.establish.itemId]);
    t.assertEqual(new Set(ids).size, ids.length, `${ids.length} distinct item ids`);
    const again = D.allDrills(samples).flatMap((d) => [d.predict.itemId, d.establish.itemId]);
    t.assertEqual(JSON.stringify(again), JSON.stringify(ids), 'ids are deterministic across builds');
  });
});

/* ------------------------------------------------------- item quality gates */

await t.describe('Question bank quality — the batch has no automated gate without this', async () => {
  const arena = readData('data/arena_questions.json');
  const ASSESSED_FILES = ['data/arena_questions.json', 'data/spaced_repetition_cards.json',
    'data/sift_scenarios.json', 'data/inoculation.json', 'data/rhetorical_arguments.json'];

  await t.it('every question is structurally answerable', () => {
    const bad = arena.filter((q) =>
      !Array.isArray(q.options) || q.options.length !== 4 ||
      new Set(q.options).size !== q.options.length ||
      !Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= q.options.length);
    t.assertEqual(bad.length, 0, `all ${arena.length} questions have 4 distinct options and a valid correctIndex${bad.length ? ` (${bad.map((q) => q.id).join(', ')})` : ''}`);
  });

  await t.it('the correct answer is not detectable from option length', () => {
    // The classic accidental tell: the right answer is written more carefully and ends up
    // consistently longest. If it were, the whole bank could be passed without reading a claim.
    const longest = arena.filter((q) => {
      const lens = q.options.map((o) => o.length);
      return lens[q.correctIndex] === Math.max(...lens) && new Set(lens).size > 1;
    }).length;
    const rate = longest / arena.length;
    t.assert(rate < 0.4, `longest option is correct in ${(rate * 100).toFixed(0)}% of questions (chance 25%; was 50% before tools/balance-option-lengths.mjs)`);
  });

  await t.it('the correct answer is not detectable from position', async () => {
    // Asserted against the PRESENTATION order, not the stored one. Every question in the bank
    // stores its answer at correctIndex 0, and for a long time they were rendered in storage
    // order — so pressing "1" every time scored 100%. The fix lives in the module, so the test
    // has to look where the operator looks.
    const { InfiniteArena } = await import('../js/modules/infiniteArena.js');
    const stored = [0, 0, 0, 0];
    arena.forEach((q) => stored[q.correctIndex]++);
    t.assert(Math.max(...stored) === arena.length,
      `storage order is uniform (${stored.join('/')}) — which is exactly why presentation must shuffle`);

    const shown = [0, 0, 0, 0];
    arena.forEach((q) => shown[InfiniteArena._presentationOrder(q).indexOf(q.correctIndex)]++);
    const max = Math.max(...shown) / arena.length;
    t.assert(max < 0.4, `most common DISPLAY position holds ${(max * 100).toFixed(0)}% (spread: ${shown.join('/')}, chance 25%)`);
    t.assertEqual(shown.filter((c) => c === 0).length, 0, 'every display position is used');

    // The shuffle must be stable per question — reshuffling under a timer would be its own cruelty.
    const q0 = arena[0];
    t.assertEqual(JSON.stringify(InfiniteArena._presentationOrder(q0)),
      JSON.stringify(InfiniteArena._presentationOrder(q0)), 'presentation order is deterministic per question');
    const valid = arena.every((q) =>
      [...InfiniteArena._presentationOrder(q)].sort().join() === q.options.map((_, i) => i).join());
    t.assert(valid, 'every presentation order is a valid permutation of the options');
  });

  await t.it('every explanation does more than name the answer', () => {
    // An explanation that only labels the fallacy teaches a label. The bar is deliberately crude —
    // it catches the failure mode (a one-line restatement) without pretending to judge prose.
    const thin = arena.filter((q) => !q.explanation || q.explanation.length < 80).map((q) => q.id);
    t.assertEqual(thin.length, 0, `no explanation is a bare restatement${thin.length ? ` (${thin.join(', ')})` : ''}`);
    const contrasting = arena.filter((q) => /\bnot\b|\brather than\b|\binstead\b|\bwhereas\b|\bdiffers\b|\bunlike\b|\bneighbour\b|\bdistractor\b|\balternative\b/i.test(q.explanation)).length;
    // A ratchet, not a fixed bar. The P1 batch writes contrasting explanations at ~60%; the
    // original 28 questions predate that standard and sit at ~7%, which drags the whole-bank
    // figure down. The threshold is set just under the current value so the number can only
    // improve — rewriting the older explanations is tracked as follow-up work, not silently
    // forgotten.
    t.assert(contrasting / arena.length > 0.45,
      `${(contrasting / arena.length * 100).toFixed(0)}% of explanations contrast the answer with what it is not (ratchet: must not fall below 45%)`);
  });

  await t.it('no claim text is duplicated', () => {
    const seen = new Map();
    const dupes = [];
    for (const q of arena) {
      if (seen.has(q.claim)) dupes.push(`${seen.get(q.claim)}/${q.id}`);
      seen.set(q.claim, q.id);
    }
    t.assertEqual(dupes.length, 0, `no repeated claims${dupes.length ? ` (${dupes.join(', ')})` : ''}`);
  });

  await t.it('one answer string never means two different skill sets', () => {
    // Tags are derived from the correct answer, so an ambiguous answer would silently give two
    // questions contradictory tags — and the estimator would credit the wrong skill.
    const byAnswer = new Map();
    const clashes = [];
    for (const q of arena) {
      const key = q.options[q.correctIndex];
      const val = JSON.stringify([...(q.tests || [])].sort());
      if (byAnswer.has(key) && byAnswer.get(key) !== val) clashes.push(key);
      byAnswer.set(key, val);
    }
    t.assertEqual(clashes.length, 0, `${byAnswer.size} distinct answers, none ambiguous${clashes.length ? ` (${[...new Set(clashes)].join(', ')})` : ''}`);
  });

  await t.it('every skill has at least 8 items behind its estimate', () => {
    // The whole point of the P1 batch. Below ~8 attempts, confidence = n/(n+5) reports the estimate
    // as near-worthless, so a skill with two items can never leave "unknown" however much the
    // operator practises.
    const per = {};
    for (const f of ASSESSED_FILES) {
      for (const r of readData(f)) for (const s of (r.tests || [])) per[s] = (per[s] || 0) + 1;
    }
    const thin = [...SKILL_IDS].filter((id) => (per[id] || 0) < 8).map((id) => `${id}:${per[id] || 0}`);
    t.assertEqual(thin.length, 0, `all ${SKILL_IDS.size} skills have ≥8 items${thin.length ? ` (thin: ${thin.join(', ')})` : ''}`);
    t.assert(Object.values(per).reduce((a, b) => a + b, 0) >= 200,
      `${Object.values(per).reduce((a, b) => a + b, 0)} item-skill links across the bank`);
  });

  await t.it('no lab or category is answerable by one fixed reply', () => {
    // Same defect the SIFT stop lab shipped with: if the correct answer never varies within a
    // group, the operator scores 100% by reflex and the mastery curve is fiction.
    const sift = readData('data/sift_scenarios.json');
    const groups = [
      ['SIFT stop', sift.filter((s) => s.lab === 'stop').map((s) => s.correctDecision)],
      ['SIFT investigate', sift.filter((s) => s.lab === 'investigate').map((s) => s.correctAnswer)],
      ['SIFT coverage', sift.filter((s) => s.lab === 'coverage').map((s) => s.correctAnswer)]
    ];
    for (const [label, answers] of groups) {
      t.assert(new Set(answers).size >= 2,
        `${label}: ${new Set(answers).size} distinct correct answers across ${answers.length} items`);
    }
  });
});

/* ------------------------------------------------- the Arena's side of the wire */

await t.describe('InfiniteArena wiring — selection and recording', async () => {
  // Only the two DOM-free methods are exercised here: question selection and attempt
  // recording. Those are where the evidence is decided. The rendering path is covered by
  // the Playwright end-to-end check.
  const { InfiniteArena } = await import('../js/modules/infiniteArena.js');
  const makeArena = (questions) => Object.assign(Object.create(Object.getPrototypeOf(InfiniteArena)), InfiniteArena, {
    _questions: questions, _sinceProbe: 0, _questionShownAt: 0, _warnedUntagged: false
  });
  const QS = [
    { id: 'p1', tests: ['skill.a'], heldOut: false },
    { id: 'p2', tests: ['skill.a', 'skill.b'], heldOut: false },
    { id: 'p3', tests: ['skill.b'], heldOut: false },
    { id: 'h1', tests: ['skill.a'], heldOut: true }
  ];

  await t.it('held-out items are never drawn as ordinary practice', async () => {
    const arena = makeArena(QS);
    const drawn = [];
    for (let i = 0; i < 700; i++) drawn.push(arena._selectQuestion().id);
    const heldDraws = drawn.filter((id) => id === 'h1').length;
    const probeSlots = drawn.filter((_, i) => (i + 1) % 8 === 0).length;
    t.assertEqual(heldDraws, probeSlots, `held-out appeared exactly on the ${probeSlots} probe slots`);
    // Uniform selection would have put it at 25% here. The probe cadence caps it at 12.5%.
    t.assert(heldDraws / drawn.length < 0.13, `held-out exposure is ${(heldDraws / drawn.length * 100).toFixed(1)}%, not 25%`);
    t.assert(new Set(drawn).size === 4, 'every question is still reachable');
  });

  await t.it('probe cadence is exact, not probabilistic', async () => {
    const arena = makeArena(QS);
    const positions = [];
    for (let i = 1; i <= 24; i++) if (arena._selectQuestion().heldOut) positions.push(i);
    t.assertEqual(JSON.stringify(positions), JSON.stringify([8, 16, 24]), 'probes land on questions 8, 16, 24');
  });

  await t.it('content with no held-out items falls back to the plain draw', async () => {
    const arena = makeArena(QS.filter((q) => !q.heldOut));
    let ok = true;
    for (let i = 0; i < 40; i++) if (!arena._selectQuestion()) ok = false;
    t.assert(ok, 'never returns undefined when nothing is held out');
  });

  await t.it('one record per tested skill, sharing itemId and latency', async () => {
    await AttemptLog.clear();
    const arena = makeArena(QS);
    arena._questionShownAt = Date.now() - 1500;
    arena._recordAttempt(QS[1], false); // p2 tests two skills
    // append() is intentionally not awaited by the Arena, so drain the microtask queue.
    await new Promise((r) => setTimeout(r, 20));
    const all = await AttemptLog.readAll();
    t.assertEqual(all.length, 2, 'two records for a two-skill question');
    t.assertEqual(JSON.stringify(all.map((a) => a.skillId).sort()), '["skill.a","skill.b"]', 'both skills credited');
    t.assertEqual(new Set(all.map((a) => a.itemId)).size, 1, 'same itemId on both');
    t.assertEqual(all.every((a) => a.correct === false), true, 'a wrong answer is recorded as wrong');
    t.assertEqual(all.every((a) => a.context === 'arena'), true, 'context is "arena"');
    t.assert(all.every((a) => a.latencyMs >= 1500 && a.latencyMs < 4000), `latency measured (${all[0].latencyMs}ms)`);
  });

  await t.it('held-out probes are recorded as held out', async () => {
    await AttemptLog.clear();
    const arena = makeArena(QS);
    arena._questionShownAt = Date.now();
    arena._recordAttempt(QS[3], true);
    await new Promise((r) => setTimeout(r, 20));
    const all = await AttemptLog.readAll();
    t.assertEqual(all.length, 1, 'probe recorded');
    t.assertEqual(all[0].heldOut, true, 'flagged heldOut, so it feeds transfer and not mastery');
  });

  await t.it('an untagged question warns once instead of writing junk', async () => {
    await AttemptLog.clear();
    const arena = makeArena(QS);
    const warnings = [];
    const realWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    try {
      arena._recordAttempt({ id: 'untagged', tests: [] }, true);
      arena._recordAttempt({ id: 'untagged2' }, true);
      await new Promise((r) => setTimeout(r, 20));
    } finally {
      console.warn = realWarn;
    }
    t.assertEqual(await AttemptLog.count(), 0, 'nothing written for an untagged question');
    t.assertEqual(warnings.length, 1, 'warned exactly once, not on every question');
    t.assert(/tag-skills/.test(warnings[0]), 'the warning names the fix');
  });

  await t.it('shipped arena content is fully tagged — no silent evidence loss', async () => {
    const arenaQs = readData('data/arena_questions.json');
    const untagged = arenaQs.filter((q) => !Array.isArray(q.tests) || !q.tests.length);
    t.assertEqual(untagged.length, 0, `all ${arenaQs.length} arena questions carry tests[]`);
    const unknown = arenaQs.flatMap((q) => q.tests).filter((s) => !SKILL_IDS.has(s));
    t.assertEqual(unknown.length, 0, 'no question references an undefined skill');
    const held = arenaQs.filter((q) => q.heldOut === true).length;
    t.assert(held > 0 && held / arenaQs.length < 0.35, `${held}/${arenaQs.length} held out (${(held / arenaQs.length * 100).toFixed(0)}%) — measurable without starving practice`);
  });
});

/* ------------------------------------------------- the shared recorder (attempts.js) */

await t.describe('recordAttempt — one funnel for eight modules', async () => {
  const A = await import('../js/attempts.js');
  const drain = () => new Promise((r) => setTimeout(r, 20));

  await t.it('fans out one record per tested skill', async () => {
    await AttemptLog.clear();
    const r = await A.recordAttempt({
      skillIds: ['skill.a', 'skill.b', 'skill.c'], itemId: 'item-1', correct: true,
      context: A.CONTEXTS.SM2, latencyMs: 900
    });
    t.assertEqual(r.recorded, 3, 'three records written for three skills');
    const all = await AttemptLog.readAll();
    t.assertEqual(all.length, 3, 'all three are in the log');
    t.assertEqual(new Set(all.map((a) => a.itemId)).size, 1, 'one itemId across them');
    t.assertEqual(all.every((a) => a.context === 'sm2'), true, 'context carried through');
    t.assertEqual(all.every((a) => a.latencyMs === 900), true, 'latency carried through');
  });

  await t.it('drops untagged items and warns once per context', async () => {
    await AttemptLog.clear();
    A._resetWarnings();
    const warnings = [];
    const realWarn = console.warn;
    console.warn = (...a) => warnings.push(a.join(' '));
    let r1, r2, r3;
    try {
      r1 = await A.recordAttempt({ skillIds: [], itemId: 'x1', correct: true, context: 'sift' });
      r2 = await A.recordAttempt({ skillIds: undefined, itemId: 'x2', correct: true, context: 'sift' });
      r3 = await A.recordAttempt({ skillIds: [], itemId: 'x3', correct: true, context: 'sandbox' });
      await drain();
    } finally { console.warn = realWarn; }
    t.assertEqual(r1.recorded + r2.recorded + r3.recorded, 0, 'nothing recorded');
    t.assertEqual(await AttemptLog.count(), 0, 'log untouched');
    t.assertEqual(warnings.length, 2, 'warned once per context (sift, sandbox), not once per item');
    t.assert(warnings.every((w) => /tag-skills/.test(w)), 'each warning names the fix');
  });

  await t.it('refuses a non-boolean correct rather than coercing it', async () => {
    await AttemptLog.clear();
    const realWarn = console.warn; console.warn = () => {};
    let r;
    try {
      r = await A.recordAttempt({ skillIds: ['skill.a'], itemId: 'x', correct: 'yes', context: 'sm2' });
    } finally { console.warn = realWarn; }
    t.assertEqual(r.recorded, 0, 'not recorded');
    t.assertEqual(await AttemptLog.count(), 0, 'no guessed data point written');
  });

  await t.it('filters junk out of skillIds instead of writing it', async () => {
    await AttemptLog.clear();
    const r = await A.recordAttempt({
      skillIds: ['skill.a', '', null, undefined, 42, 'skill.b'], itemId: 'x', correct: false, context: 'sift'
    });
    t.assertEqual(r.recorded, 2, 'only the two real skill ids were written');
  });

  await t.it('reads the live confidence control when the caller omits it', async () => {
    // Six modules record. If each had to remember to pass confidence, one of them would forget and
    // produce uncalibratable records with no error — so the default is to read the shared control.
    const { Confidence } = await import('../js/confidence.js');
    await AttemptLog.clear();
    Confidence._reset();
    Confidence.set('sure');
    await A.recordAttempt({ skillIds: ['skill.a'], itemId: 'i1', correct: true, context: 'arena' });
    Confidence.set('guess');
    await A.recordAttempt({ skillIds: ['skill.a'], itemId: 'i2', correct: true, context: 'arena' });
    // An explicit value still wins — SM-2 needs this, because it freezes what was claimed before
    // the reveal rather than whatever the control says at grading time.
    await A.recordAttempt({ skillIds: ['skill.a'], itemId: 'i3', correct: true, context: 'sm2', confidence: 'unsure' });
    await new Promise((r) => setTimeout(r, 20));
    const rows = await AttemptLog.readAll();
    t.assertEqual(rows.length, 3, 'three records');
    t.assertEqual(rows.find((r) => r.itemId === 'i1').confidence, 'sure', 'first read the control');
    t.assertEqual(rows.find((r) => r.itemId === 'i2').confidence, 'guess', 'second saw the changed control');
    t.assertEqual(rows.find((r) => r.itemId === 'i3').confidence, 'unsure', 'explicit value overrides the control');
    t.assertEqual(rows.every((r) => r.v === SCHEMA_VERSION), true, 'all stamped at the current schema version');
    Confidence._reset();
  });

  await t.it('an explicitly null confidence is honest, not coerced', async () => {
    const { Confidence } = await import('../js/confidence.js');
    await AttemptLog.clear();
    Confidence._reset();
    await A.recordAttempt({ skillIds: ['skill.a'], itemId: 'i', correct: true, context: 'sm2', confidence: null });
    await new Promise((r) => setTimeout(r, 20));
    const rows = await AttemptLog.readAll();
    t.assertEqual(rows[0].confidence, null, 'null stays null — a module with nothing to report says so');
  });

  await t.it('startTimer measures forward-only elapsed time', async () => {
    const elapsed = A.startTimer();
    await new Promise((r) => setTimeout(r, 30));
    const ms = elapsed();
    t.assert(ms >= 25 && ms < 2000, `elapsed is plausible (${ms}ms)`);
    t.assert(elapsed() >= ms, 'monotonically non-decreasing');
  });
});

/* --------------------------------------------------- the sticky confidence control */

await t.describe('Confidence control — a modifier, not a question', async () => {
  const { Confidence, LEVELS } = await import('../js/confidence.js');

  await t.it('defaults to unsure, not sure', async () => {
    Confidence._reset();
    // An unset control must not flatter the operator. Defaulting to "sure" would generate a
    // fabricated overconfidence signal from people who never touched it.
    t.assertEqual(Confidence.current(), 'unsure', 'default is unsure');
  });

  await t.it('holds its setting across reads — this is what makes it cost zero taps', async () => {
    Confidence._reset();
    Confidence.set('guess');
    t.assertEqual(Confidence.current(), 'guess', 'first read');
    t.assertEqual(Confidence.current(), 'guess', 'still set on the next question');
    t.assertEqual(Confidence.current(), 'guess', 'and the one after that');
  });

  await t.it('rejects values outside the vocabulary without changing state', async () => {
    Confidence._reset();
    Confidence.set('sure');
    for (const bad of ['certain', '', null, 0.9, 'SURE']) {
      t.assertEqual(Confidence.set(bad), false, `set(${JSON.stringify(bad)}) refused`);
    }
    t.assertEqual(Confidence.current(), 'sure', 'the previous setting survived every bad write');
  });

  await t.it('persists through the state store when one is present', async () => {
    const writes = {};
    const fakeApp = { store: { get: (k) => writes[k] ?? null, set: (k, v) => { writes[k] = v; } } };
    Confidence._reset();
    Confidence.init(fakeApp);
    Confidence.set('sure');
    t.assertEqual(writes['confidence.level'], 'sure', 'written to the store');
    // A fresh init from the same store must recover it — the setting has to survive a reload or the
    // operator re-sets it every session and the sticky design buys nothing.
    Confidence._reset();
    Confidence.init(fakeApp);
    t.assertEqual(Confidence.current(), 'sure', 'recovered on the next boot');
  });

  await t.it('ignores a corrupted stored value', async () => {
    const fakeApp = { store: { get: () => 'absolutely-certain', set: () => {} } };
    Confidence._reset();
    Confidence.init(fakeApp);
    t.assertEqual(Confidence.current(), 'unsure', 'falls back to the default rather than trusting it');
  });

  await t.it('works with no store at all', async () => {
    Confidence._reset();
    Confidence.init(null);
    t.assertEqual(Confidence.current(), 'unsure', 'default available');
    t.assertEqual(Confidence.set('guess'), true, 'still settable in memory');
    t.assertEqual(Confidence.current(), 'guess', 'and readable');
  });

  await t.it('mount() degrades silently with no DOM', async () => {
    t.assertEqual(Confidence.mount(null), null, 'null host returns null instead of throwing');
  });

  await t.it('offers exactly three levels, ordered most to least certain', async () => {
    t.assertEqual(LEVELS.length, 3, 'three levels');
    t.assertEqual(JSON.stringify(LEVELS.map((l) => l.id)), '["sure","unsure","guess"]', 'ordered sure → guess');
    t.assertEqual(LEVELS.every((l) => l.label && l.hint), true, 'each carries a label and an explanatory hint');
  });
});

/* ------------------------------------------ every module's content is tagged */

await t.describe('retrofit coverage — all eight right/wrong moments have data behind them', async () => {
  const SM2 = await import('../js/modules/spacedRepetition.js');

  const ASSESSED = [
    ['data/arena_questions.json', 'Arena'],
    ['data/spaced_repetition_cards.json', 'SM-2'],
    ['data/sift_scenarios.json', 'SIFT Labs'],
    ['data/inoculation.json', 'Prebunking'],
    ['data/rhetorical_arguments.json', 'Sandbox']
  ];

  await t.it('every assessable item in every module carries tests[]', () => {
    for (const [file, label] of ASSESSED) {
      const rows = readData(file);
      const untagged = rows.filter((r) => !Array.isArray(r.tests) || !r.tests.length).map((r) => r.id);
      t.assertEqual(untagged.length, 0, `${label}: all ${rows.length} items tagged${untagged.length ? ` (missing: ${untagged.join(', ')})` : ''}`);
      const unknown = rows.flatMap((r) => r.tests || []).filter((s) => !SKILL_IDS.has(s));
      t.assertEqual(unknown.length, 0, `${label}: no references to undefined skills`);
    }
  });

  await t.it('reference content carries teaches[]', () => {
    for (const [file, label] of [['data/fallacies.json', 'Fallacies'], ['data/disarm.json', 'DISARM']]) {
      const rows = readData(file);
      const untagged = rows.filter((r) => !Array.isArray(r.teaches) || !r.teaches.length).map((r) => r.id);
      t.assertEqual(untagged.length, 0, `${label}: all ${rows.length} records tagged`);
    }
  });

  await t.it('every declared skill has at least one item that can measure it', () => {
    const assessable = new Set(ASSESSED.flatMap(([f]) => readData(f)).flatMap((r) => r.tests || []));
    const unmeasurable = [...SKILL_IDS].filter((id) => !assessable.has(id));
    t.assertEqual(unmeasurable.length, 0,
      `all 24 skills are measurable${unmeasurable.length ? ` (unmeasurable: ${unmeasurable.join(', ')})` : ''}`);
  });

  await t.it('no skill has every one of its items held out', () => {
    const rows = ASSESSED.flatMap(([f]) => readData(f));
    const starved = [...SKILL_IDS].filter((id) => {
      const mine = rows.filter((r) => (r.tests || []).includes(id));
      return mine.length && mine.every((r) => r.heldOut === true);
    });
    t.assertEqual(starved.length, 0, `no starved skills${starved.length ? ` (${starved.join(', ')})` : ''}`);
  });

  await t.it('held-out items only exist where something can administer them', () => {
    // Only the Arena has a probe cadence. A held-out item anywhere else is simply removed from
    // the app, which would be a silent content loss rather than a measurement.
    const arenaIds = new Set(readData('data/arena_questions.json').map((q) => q.id));
    const strays = ASSESSED.flatMap(([f]) => readData(f))
      .filter((r) => r.heldOut === true && !arenaIds.has(r.id)).map((r) => r.id);
    t.assertEqual(strays.length, 0, `no unreachable held-out items${strays.length ? ` (${strays.join(', ')})` : ''}`);
  });

  await t.it("SM-2 self-grades map onto the scheduler's own pass threshold", () => {
    const m = SM2.SpacedRepetition._qualityToCorrect.bind(SM2.SpacedRepetition);
    t.assertEqual(m(1), false, 'Again (1) is not recalled');
    t.assertEqual(m(2), true, 'Hard (2) is recalled - it maps to SM-2 quality 3');
    t.assertEqual(m(3), true, 'Good (3) is recalled');
    t.assertEqual(m(4), true, 'Easy (4) is recalled');
    // The boundary matters: the four buttons map onto SM-2's 0-5 scale via SM2_QUALITY_MAP
    // ({1:1, 2:3, 3:4, 4:5}) and SM-2 treats q < 3 as a lapse. Hard is SM-2 quality 3 - a
    // pass - and the scheduler advances its repetitions, so the estimator must agree or
    // the app holds two contradictory notions of "knew it".
    t.assertEqual(m('3'), true, 'string quality from a DOM attribute still maps correctly');
  });

  await t.it('SIFT scenarios map to the four SIFT skills, one per lab', () => {
    const rows = readData('data/sift_scenarios.json');
    const expected = {
      stop: 'skill.sift.stop',
      investigate: 'skill.sift.investigate-source',
      coverage: 'skill.sift.find-coverage',
      trace: 'skill.sift.trace-origin'
    };
    const wrong = rows.filter((r) => r.tests[0] !== expected[r.lab]).map((r) => r.id);
    t.assertEqual(wrong.length, 0, `every scenario tests its own lab's skill${wrong.length ? ` (${wrong.join(', ')})` : ''}`);
  });

  await t.it('the SIFT stop lab is not answerable by reflex', () => {
    // If every stop scenario's correct decision were "stop", mashing one button would score 100%
    // and skill.sift.stop would read as mastered from reflex. Worse, the lab would TRAIN the
    // reflex — every reward coming from distrust — and reflexive cynicism is its own epistemic
    // failure, not a safe default. So the set must contain legitimate claims too.
    const stop = readData('data/sift_scenarios.json').filter((s) => s.lab === 'stop');
    const decisions = stop.map((s) => s.correctDecision);
    const stops = decisions.filter((d) => d === 'stop').length;
    const continues = decisions.filter((d) => d === 'continue').length;
    t.assert(stops >= 2 && continues >= 2,
      `both answers occur (${stops} stop / ${continues} continue of ${stop.length})`);
    t.assert(continues / stop.length >= 0.25,
      `legitimate claims are ${Math.round(continues / stop.length * 100)}% of the lab — enough that "always stop" loses`);
    t.assert(stop.filter((s) => s.correctDecision === 'continue')
      .every((s) => (s.manipulationSignals || []).length === 0),
      'the continue scenarios carry no manipulation signals, so the correct answer is defensible');
  });

  await t.it('every trace scenario can produce a real judgement', () => {
    // The trace lab used to record correct:true unconditionally — clicking through scored 100%.
    // It now asks the operator to predict the verdict, and the distractors are other scenarios'
    // real verdicts, so there must be enough of them to build a question.
    const trace = readData('data/sift_scenarios.json').filter((s) => s.lab === 'trace');
    t.assert(trace.length >= 4, `${trace.length} trace scenarios — enough for 3 distractors plus the answer`);
    t.assertEqual(trace.filter((s) => !s.verdict).length, 0, 'every one has a verdict to predict');
    t.assertEqual(new Set(trace.map((s) => s.verdict)).size, trace.length,
      'all verdicts are distinct, so no two options are the same answer');
  });

  await t.it('inoculation stages have a non-neutral choice, or they record nothing', () => {
    // A stage where every choice has resilienceDelta 0 would be silently unrecordable — the
    // module refuses to invent a verdict the content author declined to give.
    const rows = readData('data/inoculation.json');
    const mute = [];
    for (const sc of rows) {
      for (const st of sc.branchingStages || []) {
        if (!(st.choices || []).some((c) => (c.resilienceDelta || 0) !== 0)) mute.push(`${sc.id}#${st.stageId}`);
      }
    }
    t.assertEqual(mute.length, 0, `every stage can produce evidence${mute.length ? ` (mute: ${mute.join(', ')})` : ''}`);
  });
});

t.summary();
