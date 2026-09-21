/**
 * SOVEREIGN // AEGIS — Test Suite: SM-2 scheduling semantics & the Memory Vault's
 * answer-before-reveal diagnosis
 *
 * Two things live here.
 *
 * 1. The SM-2 scheduling maths (`_calculateSM2` / `_qualityToCorrect`). The boundary the
 *    competency spine relies on: the four-button self-grade is mapped onto SM-2's own 0-5
 *    quality scale, and q < 3 is a lapse while q >= 3 is recalled — so the attempt log and
 *    the scheduler must agree, or the app holds two notions of "knew it".
 *
 * 2. The answer-before-reveal diagnosis (roadmap N2). A forced-choice guess at the card's
 *    diagnosis, taken BEFORE the flip, is demonstrated recall rather than felt recall. It is
 *    recorded under its own context ('sm2-diagnosis') with the chosen option, so the gap
 *    between demonstrated and felt recall stays distinguishable in the data.
 *
 * WHY THERE IS AN INDEXEDDB STUB AND A document STUB IN HERE
 * ----------------------------------------------------------
 * Node has no IndexedDB, and the project has a hard zero-dependency rule, so this file
 * carries the same ~90-line in-memory stub as test-attemptlog.js for exactly the surface
 * attemptlog.js uses. `_recordDiagnosisAttempt()` also touches `document` only to colour the
 * locked options after reveal; a minimal stub that returns null from getElementById makes
 * that a no-op, so the recording logic — the part that decides the evidence — is what gets
 * tested. Browser behaviour is covered by the Playwright end-to-end check.
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

// `_recordDiagnosisAttempt()` colours the locked options via getElementById after recording.
// In Node there is no DOM; a stub that returns null makes the colouring a no-op while the
// recording logic runs for real.
globalThis.document = { getElementById: () => null };

const { SpacedRepetition } = await import('../js/modules/spacedRepetition.js');
const { AttemptLog } = await import('../js/attemptlog.js');
const A = await import('../js/attempts.js');

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
      console.error('\n[FAIL] SM-2 semantics suite FAILED.');
      process.exitCode = 1;
    } else {
      console.log('\n[PASS] All SM-2 semantics assertions passed.');
    }
  }
}

const t = new TestHarness('SM-2 Semantics');
const drain = () => new Promise((r) => setTimeout(r, 20));

/** A module-shaped instance with the fields under test, like makeArena in test-attemptlog. */
const makeSR = (overrides) =>
  Object.assign(Object.create(Object.getPrototypeOf(SpacedRepetition)), SpacedRepetition, overrides);

const DIAGNOSES = [
  'Ad Hominem', 'Straw Man', 'False Dilemma', 'Slippery Slope', 'Confirmation Bias'
];
const DECK = DIAGNOSES.map((d, i) => ({
  id: `c${i + 1}`, diagnosis: d, tests: ['skill.fallacy.relevance'], heldOut: false
}));

console.log('\n=== SOVEREIGN // AEGIS — SM-2 SEMANTICS & ANSWER-BEFORE-REVEAL SUITE ===');

/* ---------------------------------------------------- scheduling maths (pure) */

await t.describe('SM-2 scheduling — one notion of "knew it"', async () => {
  await t.it('the button-to-quality mapping makes Hard a pass, not a lapse', () => {
    // The four buttons are Again(1), Hard(2), Good(3), Easy(4); SM2_QUALITY_MAP maps them to
    // SM-2's 0-5 scale: {1:1, 2:3, 3:4, 4:5}. q < 3 is a lapse. Hard therefore lands on q=3,
    // SM-2's "correct, but with difficulty" — a pass, and the attempt log must agree.
    t.assertEqual(SpacedRepetition._qualityToCorrect(1), false, 'Again(1) is not recalled');
    t.assertEqual(SpacedRepetition._qualityToCorrect(2), true, 'Hard(2) is recalled (SM-2 q=3)');
    t.assertEqual(SpacedRepetition._qualityToCorrect(3), true, 'Good(3) is recalled');
    t.assertEqual(SpacedRepetition._qualityToCorrect(4), true, 'Easy(4) is recalled');
  });

  await t.it('the scheduler and the correctness mapping agree on every grade', () => {
    // This is the "semantic alignment" the suite exists to hold: a card scheduled as learned
    // must be logged as correct, or mastery and scheduling drift apart silently.
    const base = { id: 'x', repetitions: 2, interval: 6, easeFactor: 2.5 };
    for (const quality of [1, 2, 3, 4]) {
      const sched = SpacedRepetition._calculateSM2({ ...base }, quality);
      const passed = sched.repetitions > base.repetitions;
      t.assertEqual(SpacedRepetition._qualityToCorrect(quality), passed,
        `quality ${quality}: scheduler pass (${passed}) matches recorded correctness`);
    }
  });

  await t.it('Again resets to learning and lowers the ease factor', () => {
    const res = SpacedRepetition._calculateSM2({ id: 'x', repetitions: 3, interval: 20, easeFactor: 2.5 }, 1);
    t.assertEqual(res.repetitions, 0, 'repetitions reset to 0');
    t.assertEqual(res.interval, 1, 'interval back to 1 day');
    t.assert(res.easeFactor < 2.5, `ease factor fell (${res.easeFactor})`);
    t.assert(res.easeFactor >= 1.3, `ease factor floored at 1.3 (${res.easeFactor})`);
  });

  await t.it('passing grades advance repetitions and grow the interval', () => {
    const hard = SpacedRepetition._calculateSM2({ id: 'x', repetitions: 0, interval: 0, easeFactor: 2.5 }, 2);
    t.assertEqual(hard.repetitions, 1, 'Hard on a new card: first repetition');
    t.assertEqual(hard.interval, 1, 'first interval is 1 day');
    const good = SpacedRepetition._calculateSM2({ id: 'x', repetitions: 1, interval: 6, easeFactor: 2.5 }, 3);
    t.assertEqual(good.repetitions, 2, 'Good advances to the second repetition');
    t.assertEqual(good.interval, 6, 'second interval is 6 days');
    const easy = SpacedRepetition._calculateSM2({ id: 'x', repetitions: 2, interval: 6, easeFactor: 2.5 }, 4);
    t.assertEqual(easy.repetitions, 3, 'Easy advances past maturity');
    t.assertEqual(easy.interval, Math.round(6 * 2.5), 'mature interval is round(interval * EF)');
  });
});

/* -------------------------------------------- building the diagnosis options */

await t.describe('_buildDiagnosisOptions — a genuine four-way choice', async () => {
  await t.it('offers the answer plus three distractors from other cards', () => {
    const sr = makeSR({ _deck: DECK });
    const opts = sr._buildDiagnosisOptions(DECK[0]);
    t.assertEqual(opts.length, 4, 'exactly four options');
    t.assertEqual(new Set(opts).size, 4, 'all four are distinct');
    t.assert(opts.includes('Ad Hominem'), "the card's own diagnosis is among them");
    const others = new Set(DECK.filter((c) => c.id !== DECK[0].id).map((c) => c.diagnosis));
    const distractors = opts.filter((o) => o !== 'Ad Hominem');
    t.assertEqual(distractors.length, 3, 'three distractors');
    t.assert(distractors.every((d) => others.has(d)),
      `distractors come from other cards: ${distractors.join(' / ')}`);
  });

  await t.it('is deterministic per card id — re-encountering a card does not reshuffle', () => {
    const sr = makeSR({ _deck: DECK });
    const first = sr._buildDiagnosisOptions(DECK[2]);
    const second = sr._buildDiagnosisOptions(DECK[2]);
    t.assertEqual(JSON.stringify(first), JSON.stringify(second), 'same card, same option order');
  });

  await t.it('different cards present different orders', () => {
    // A shuffle that never varied would be a disguised tell.
    const sr = makeSR({ _deck: DECK });
    const orders = new Set(DECK.map((c) => JSON.stringify(sr._buildDiagnosisOptions(c))));
    t.assert(orders.size >= 2, `${orders.size} distinct orderings across ${DECK.length} cards`);
  });

  await t.it('pads from the fallback list when the deck is too thin', () => {
    const sr = makeSR({ _deck: [DECK[0]] });
    const opts = sr._buildDiagnosisOptions(DECK[0]);
    t.assertEqual(opts.length, 4, 'still four options from a one-card deck');
    t.assertEqual(new Set(opts).size, 4, 'and they are distinct');
    t.assert(opts.includes('Ad Hominem'), 'the answer is still present');
  });

  await t.it('cards sharing a diagnosis never duplicate it as a distractor', () => {
    const sr = makeSR({ _deck: [DECK[0], { ...DECK[0], id: 'c1b' }, DECK[1], DECK[2], DECK[3]] });
    const opts = sr._buildDiagnosisOptions(DECK[0]);
    t.assertEqual(new Set(opts).size, 4, 'no duplicate diagnosis in the options');
    t.assertEqual(opts.filter((o) => o === 'Ad Hominem').length, 1, 'the answer appears exactly once');
  });
});

/* ------------------------------------------------- recording the diagnosis */

await t.describe('_recordDiagnosisAttempt — demonstrated recall, recorded once', async () => {
  const card = { id: 'c1', diagnosis: 'Ad Hominem', tests: ['skill.fallacy.relevance'], heldOut: false };

  await t.it('a correct prediction is recorded as correct with the chosen option', async () => {
    await AttemptLog.clear();
    const sr = makeSR({
      _activeQueue: [card], _currentIndex: 0, _selectedDiagnosis: 'Ad Hominem',
      _diagnosisRecorded: false, _shownAt: 1000, _revealedAt: 2000, _confidenceAtReveal: 'sure'
    });
    sr._recordDiagnosisAttempt();
    await drain();
    const all = await AttemptLog.readAll();
    t.assertEqual(all.length, 1, 'one record written');
    t.assertEqual(all[0].context, 'sm2-diagnosis', 'context is sm2-diagnosis, not sm2');
    t.assertEqual(all[0].correct, true, 'correct prediction recorded as correct');
    t.assertEqual(all[0].chosen, 'Ad Hominem', 'the chosen option is preserved for the confusion matrix');
    t.assertEqual(all[0].itemId, 'c1#diagnosis', "itemId is distinct from the self-grade's");
    t.assertEqual(all[0].confidence, 'sure', 'the certainty frozen at reveal is carried');
    t.assertEqual(all[0].latencyMs, 1000, 'latency is shown-to-reveal (1000ms)');
    t.assertEqual(all[0].skillId, 'skill.fallacy.relevance', "the card's skill is credited");
  });

  await t.it('a wrong prediction is recorded as wrong — that is the evidence', async () => {
    await AttemptLog.clear();
    const sr = makeSR({
      _activeQueue: [card], _currentIndex: 0, _selectedDiagnosis: 'Straw Man',
      _diagnosisRecorded: false, _shownAt: 500, _revealedAt: 1500, _confidenceAtReveal: 'guess'
    });
    sr._recordDiagnosisAttempt();
    await drain();
    const all = await AttemptLog.readAll();
    t.assertEqual(all.length, 1, 'one record written');
    t.assertEqual(all[0].correct, false, 'wrong prediction recorded as wrong');
    t.assertEqual(all[0].chosen, 'Straw Man', 'the wrong option is what gets recorded');
    t.assertEqual(all[0].confidence, 'guess', 'certainty survives even when wrong');
    t.assertEqual(all[0].latencyMs, 1000, 'latency measured the same way');
  });

  await t.it('is recorded at most once per card', async () => {
    await AttemptLog.clear();
    const sr = makeSR({
      _activeQueue: [card], _currentIndex: 0, _selectedDiagnosis: 'Ad Hominem',
      _diagnosisRecorded: false, _shownAt: 1000, _revealedAt: 2000, _confidenceAtReveal: 'sure'
    });
    sr._recordDiagnosisAttempt();
    sr._recordDiagnosisAttempt(); // the once-guard must hold
    await drain();
    t.assertEqual(await AttemptLog.count(), 1, 'a second call records nothing');
  });

  await t.it('no selection records nothing — silence beats a fabricated answer', async () => {
    await AttemptLog.clear();
    const sr = makeSR({
      _activeQueue: [card], _currentIndex: 0, _selectedDiagnosis: null,
      _diagnosisRecorded: false, _shownAt: 1000, _revealedAt: 2000, _confidenceAtReveal: 'sure'
    });
    sr._recordDiagnosisAttempt();
    await drain();
    t.assertEqual(await AttemptLog.count(), 0, 'skipping the diagnosis is not scored as wrong');
  });

  await t.it('an untagged card records nothing, warning once', async () => {
    await AttemptLog.clear();
    A._resetWarnings();
    const warnings = [];
    const realWarn = console.warn;
    console.warn = (...a) => warnings.push(a.join(' '));
    try {
      const sr = makeSR({
        _activeQueue: [{ id: 'c-untagged', diagnosis: 'Ad Hominem', tests: [] }], _currentIndex: 0,
        _selectedDiagnosis: 'Ad Hominem', _diagnosisRecorded: false,
        _shownAt: 1000, _revealedAt: 2000, _confidenceAtReveal: 'sure'
      });
      sr._recordDiagnosisAttempt();
      await drain();
    } finally {
      console.warn = realWarn;
    }
    t.assertEqual(await AttemptLog.count(), 0, 'no record for an untagged card');
    t.assertEqual(warnings.length, 1, 'warned once, not on every card');
  });

  await t.it('a card testing two skills fans out to two records sharing itemId', async () => {
    await AttemptLog.clear();
    const multi = { id: 'c2', diagnosis: 'Straw Man', tests: ['skill.a', 'skill.b'], heldOut: false };
    const sr = makeSR({
      _activeQueue: [multi], _currentIndex: 0, _selectedDiagnosis: 'Straw Man',
      _diagnosisRecorded: false, _shownAt: 1000, _revealedAt: 2000, _confidenceAtReveal: 'unsure'
    });
    sr._recordDiagnosisAttempt();
    await drain();
    const all = await AttemptLog.readAll();
    t.assertEqual(all.length, 2, 'two records for a two-skill card');
    t.assertEqual(JSON.stringify(all.map((a) => a.skillId).sort()), '["skill.a","skill.b"]', 'both skills credited');
    t.assertEqual(new Set(all.map((a) => a.itemId)).size, 1, 'one shared itemId');
    t.assertEqual(all.every((a) => a.context === 'sm2-diagnosis'), true, 'all under the diagnosis context');
  });

  await t.it('held-out cards stay flagged, so transfer can see them', async () => {
    await AttemptLog.clear();
    const held = { id: 'c3', diagnosis: 'False Dilemma', tests: ['skill.b'], heldOut: true };
    const sr = makeSR({
      _activeQueue: [held], _currentIndex: 0, _selectedDiagnosis: 'False Dilemma',
      _diagnosisRecorded: false, _shownAt: 1000, _revealedAt: 2000, _confidenceAtReveal: 'sure'
    });
    sr._recordDiagnosisAttempt();
    await drain();
    const all = await AttemptLog.readAll();
    t.assertEqual(all.length, 1, 'recorded');
    t.assertEqual(all[0].heldOut, true, 'heldOut survives into the log');
  });
});

/* ------------------------------- demonstrated vs felt recall stay separable */

await t.describe('the gap between demonstrated and felt recall', async () => {
  const card = { id: 'c1', diagnosis: 'Ad Hominem', tests: ['skill.fallacy.relevance'], heldOut: false };

  await t.it('a right diagnosis self-graded as a lapse keeps BOTH records, disagreeing', async () => {
    await AttemptLog.clear();
    // Demonstrated: picked the right diagnosis before the flip.
    const sr = makeSR({
      _activeQueue: [card], _currentIndex: 0, _selectedDiagnosis: 'Ad Hominem',
      _diagnosisRecorded: false, _shownAt: 1000, _revealedAt: 2000, _confidenceAtReveal: 'sure'
    });
    sr._recordDiagnosisAttempt();
    // Felt: self-graded Again (quality 1, not recalled) — the same funnel rateCard() uses.
    await A.recordAttempt({
      skillIds: card.tests, itemId: card.id, correct: SpacedRepetition._qualityToCorrect(1),
      context: A.CONTEXTS.SM2, latencyMs: 500, confidence: 'sure'
    });
    await drain();
    const all = await AttemptLog.readAll();
    t.assertEqual(all.length, 2, 'two records for one card pass');
    const diag = all.find((a) => a.context === 'sm2-diagnosis');
    const self = all.find((a) => a.context === 'sm2');
    t.assert(diag && self, 'both contexts present');
    t.assertEqual(diag.correct, true, 'demonstrated recall: correct');
    t.assertEqual(self.correct, false, 'felt recall: self-graded as a lapse');
    t.assert(diag.itemId !== self.itemId, 'distinct itemIds (id#diagnosis vs id)');
    // The disagreement is the measurement: the operator KNEW it and did not trust themselves.
    t.assert(diag.correct !== self.correct, 'the demonstrated/felt gap is visible, not flattened');
  });

  await t.it('the reverse gap — wrong diagnosis, self-graded as known — is equally visible', async () => {
    await AttemptLog.clear();
    const sr = makeSR({
      _activeQueue: [card], _currentIndex: 0, _selectedDiagnosis: 'Straw Man',
      _diagnosisRecorded: false, _shownAt: 1000, _revealedAt: 2000, _confidenceAtReveal: 'sure'
    });
    sr._recordDiagnosisAttempt();
    await A.recordAttempt({
      skillIds: card.tests, itemId: card.id, correct: SpacedRepetition._qualityToCorrect(4),
      context: A.CONTEXTS.SM2, latencyMs: 300, confidence: 'sure'
    });
    await drain();
    const all = await AttemptLog.readAll();
    const diag = all.find((a) => a.context === 'sm2-diagnosis');
    const self = all.find((a) => a.context === 'sm2');
    t.assert(diag && self, 'both contexts present');
    t.assertEqual(diag.correct, false, 'demonstrated recall: wrong');
    t.assertEqual(self.correct, true, 'felt recall: claimed easy');
    t.assert(diag.correct !== self.correct, 'the overclaim survives as a record, not a summary');
  });

  await t.it('when the two agree, both records agree', async () => {
    await AttemptLog.clear();
    const sr = makeSR({
      _activeQueue: [card], _currentIndex: 0, _selectedDiagnosis: 'Ad Hominem',
      _diagnosisRecorded: false, _shownAt: 1000, _revealedAt: 2000, _confidenceAtReveal: 'unsure'
    });
    sr._recordDiagnosisAttempt();
    await A.recordAttempt({
      skillIds: card.tests, itemId: card.id, correct: SpacedRepetition._qualityToCorrect(3),
      context: A.CONTEXTS.SM2, latencyMs: 400, confidence: 'unsure'
    });
    await drain();
    const all = await AttemptLog.readAll();
    const diag = all.find((a) => a.context === 'sm2-diagnosis');
    const self = all.find((a) => a.context === 'sm2');
    t.assert(diag && self, 'both contexts present');
    t.assertEqual(diag.correct, true, 'demonstrated recall: correct');
    t.assertEqual(self.correct, true, 'felt recall: self-graded good');
  });
});

t.summary();
