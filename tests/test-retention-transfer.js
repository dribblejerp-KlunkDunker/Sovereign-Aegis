/**
 * SOVEREIGN // AEGIS — Suite 41: Retention Machinery, Inoculation 3-Stage & Transfer Evaluation
 *
 * Tests:
 * 1. SpacedRepetition.enqueueCards() — deduplication, default SM-2 parameter seeding, queue refresh.
 * 2. Inoculation 3-Stage Branching — all 6 scenarios have >=3 stages, correct sequential linking,
 *    and 100% non-zero resilienceDelta values.
 * 3. Transfer Evaluation Protocol — held-out question integrity (40 items), baseline/follow-up
 *    split, within-subject transfer delta computation, and caveat preservation.
 *
 * Zero external runtime dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

/* ------------------------------------------------------ in-memory IndexedDB stub */
function installIndexedDbStub() {
  const databases = new Map();

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

// Minimal document stub
globalThis.document = {
  getElementById: () => null,
  createElement: () => ({ setAttribute: () => {}, appendChild: () => {}, classList: { add: () => {}, remove: () => {} }, style: {} }),
  querySelectorAll: () => []
};

const { SpacedRepetition } = await import('../js/modules/spacedRepetition.js');
const { AttemptLog } = await import('../js/attemptlog.js');
const { transfer } = await import('../js/competency.js');

class TestHarness {
  constructor(name) {
    this.suiteName = name;
    this.totalAssertions = 0;
    this.passed = 0;
    this.failed = 0;
    this.failures = [];
    this.currentSuite = '';
  }
  describe(name, fn) {
    this.currentSuite = name;
    console.log(`\n  --- ${name} ---`);
    return fn();
  }
  async it(name, fn) {
    try {
      await fn();
    } catch (err) {
      this.failed++;
      this.totalAssertions++;
      this.failures.push({ suite: this.currentSuite, test: name, error: err.message });
      console.error(`  ✗ [FAIL] ${name} (${err.message})`);
    }
  }
  assert(cond, msg) {
    this.totalAssertions++;
    if (cond) {
      this.passed++;
      console.log(`    ✓ ${msg}`);
    } else {
      this.failed++;
      this.failures.push({ suite: this.currentSuite, test: msg, error: 'Assertion failed' });
      console.error(`    ✗ [FAIL] ${msg}`);
    }
  }
  assertEqual(actual, expected, msg) {
    this.assert(actual === expected, `${msg} | Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
  }
  summary() {
    console.log(`\n====================================================`);
    console.log(`[${this.suiteName}] Summary: ${this.passed}/${this.totalAssertions} Passed (${this.failed} Failed)`);
    console.log(`====================================================`);
    if (this.failed > 0) process.exit(1);
  }
}

const t = new TestHarness('Retention Machinery, Inoculation 3-Stage & Transfer Suite');

// ─────────────────────────────────────────────────────────────
// 1. SpacedRepetition.enqueueCards()
// ─────────────────────────────────────────────────────────────
t.describe('Group 1: SpacedRepetition.enqueueCards() Retention Bridge', () => {
  const mockStore = {
    data: {},
    get(k) { return this.data[k]; },
    set(k, v) { this.data[k] = v; }
  };

  SpacedRepetition._app = {
    store: mockStore,
    showToast: () => {}
  };
  SpacedRepetition._deck = [];
  SpacedRepetition._activeQueue = [];

  t.assertEqual(typeof SpacedRepetition.enqueueCards, 'function', 'SpacedRepetition.enqueueCards exists');

  // Enqueue null or empty
  t.assertEqual(SpacedRepetition.enqueueCards(null), 0, 'enqueueCards(null) safely returns 0');
  t.assertEqual(SpacedRepetition.enqueueCards([]), 0, 'enqueueCards([]) safely returns 0');

  // Enqueue valid cards
  const newCards = [
    {
      id: 'test-card-01',
      domain: 'Test Domain',
      prompt: 'Test Prompt 1',
      diagnosis: 'Test Diagnosis 1',
      tests: ['skill.fallacy.ad-hominem']
    },
    {
      id: 'test-card-02',
      domain: 'Test Domain',
      prompt: 'Test Prompt 2',
      diagnosis: 'Test Diagnosis 2',
      tests: ['skill.sift.trace']
    }
  ];

  const added = SpacedRepetition.enqueueCards(newCards);
  t.assertEqual(added, 2, 'Added exactly 2 new cards');
  t.assertEqual(SpacedRepetition._deck.length, 2, 'Deck length updated to 2');

  const card1 = SpacedRepetition._deck.find(c => c.id === 'test-card-01');
  t.assert(card1 !== undefined, 'test-card-01 is present in deck');
  t.assertEqual(card1.repetitions, 0, 'card initialized with 0 repetitions');
  t.assertEqual(card1.interval, 0, 'card initialized with 0 interval');
  t.assertEqual(card1.easeFactor, 2.5, 'card initialized with 2.5 ease factor');
  t.assert(typeof card1.dueDate === 'string' && card1.dueDate.length === 10, 'card initialized with valid ISO date');

  // Deduplication check
  const duplicateRun = SpacedRepetition.enqueueCards([
    { id: 'test-card-01', prompt: 'Duplicate attempt' },
    { id: 'test-card-03', domain: 'New Card', prompt: 'New', diagnosis: 'New', tests: [] }
  ]);
  t.assertEqual(duplicateRun, 1, 'Deduplication ignored test-card-01 and added only test-card-03');
  t.assertEqual(SpacedRepetition._deck.length, 3, 'Deck total is now 3');

  // Invalid card shapes ignored
  const invalidRun = SpacedRepetition.enqueueCards([
    null,
    undefined,
    {},
    { id: '' }
  ]);
  t.assertEqual(invalidRun, 0, 'Invalid card items safely ignored');
});

// ─────────────────────────────────────────────────────────────
// 2. Inoculation 3-Stage Branching & Non-Zero Deltas
// ─────────────────────────────────────────────────────────────
t.describe('Group 2: Inoculation 3-Stage Branching & Scoring Invariants', () => {
  const rawInoc = fs.readFileSync(path.join(ROOT_DIR, 'data', 'inoculation.json'), 'utf8');
  const scenarios = JSON.parse(rawInoc);

  t.assertEqual(scenarios.length, 6, 'Exactly 6 core inoculation scenarios defined');

  let totalStages = 0;
  let totalChoices = 0;
  let nonZeroDeltas = 0;
  let validLinks = 0;

  for (const s of scenarios) {
    t.assert(s.branchingStages.length >= 3, `Scenario ${s.id} has >= 3 stages (got ${s.branchingStages.length})`);
    totalStages += s.branchingStages.length;

    for (let i = 0; i < s.branchingStages.length; i++) {
      const stage = s.branchingStages[i];
      t.assert(typeof stage.stageId === 'string' && stage.stageId.length > 0, `${s.id} stage ${i} has valid stageId`);
      t.assert(typeof stage.prompt === 'string' && stage.prompt.length > 20, `${s.id} stage ${i} has substantial prompt`);
      t.assert(Array.isArray(stage.choices) && stage.choices.length >= 3, `${s.id} stage ${i} has at least 3 choices`);

      for (const choice of stage.choices) {
        totalChoices++;
        if (typeof choice.resilienceDelta === 'number' && choice.resilienceDelta !== 0) {
          nonZeroDeltas++;
        }
        if (['Inoculate', 'Vulnerable', 'Reactive'].includes(choice.type)) {
          validLinks++;
        }

        // Sequential stage link invariant
        if (i === 0) {
          t.assertEqual(choice.nextStageId, s.branchingStages[1].stageId, `${s.id} stage 1 choice ${choice.choiceId} links to stage 2`);
        } else if (i === 1) {
          t.assertEqual(choice.nextStageId, s.branchingStages[2].stageId, `${s.id} stage 2 choice ${choice.choiceId} links to stage 3`);
        } else if (i === s.branchingStages.length - 1) {
          t.assertEqual(choice.nextStageId, null, `${s.id} final stage choice ${choice.choiceId} terminates with null`);
        }
      }
    }
  }

  t.assertEqual(totalStages, 18, 'Total stages across 6 scenarios is exactly 18 (3 per scenario)');
  t.assertEqual(totalChoices, 54, 'Total choices across all scenarios is exactly 54 (3 per stage)');
  t.assertEqual(nonZeroDeltas, 54, '100% of choices have non-zero resilience deltas');
  t.assertEqual(validLinks, 54, 'All choices have recognized behavioral types (Inoculate/Vulnerable/Reactive)');
});

// ─────────────────────────────────────────────────────────────
// 3. Transfer Evaluation Protocol & Competency Invariants
// ─────────────────────────────────────────────────────────────
t.describe('Group 3: Transfer Evaluation Protocol & Held-Out Generalization', () => {
  const rawArena = fs.readFileSync(path.join(ROOT_DIR, 'data', 'arena_questions.json'), 'utf8');
  const questions = JSON.parse(rawArena);
  const heldOut = questions.filter(q => q.heldOut === true);

  t.assertEqual(heldOut.length, 40, 'Exactly 40 held-out probe items reserved for transfer evaluation');

  // Verify all held-out items have valid 4-option structure and test skills
  for (const q of heldOut) {
    t.assert(Array.isArray(q.options) && q.options.length === 4, `${q.id} has exactly 4 options`);
    t.assert(q.correctIndex >= 0 && q.correctIndex < 4, `${q.id} has valid correctIndex`);
    t.assert(Array.isArray(q.tests) && q.tests.length > 0, `${q.id} tests at least 1 competency skill`);
  }

  // Simulated transfer study evaluations
  const baselineAttempts = heldOut.slice(0, 5).map((q, i) => ({
    itemId: q.id,
    skillId: q.tests[0],
    correct: i % 2 === 0, // 3/5 = 60%
    heldOut: true,
    ts: 1000 + i * 10,
    confidence: 'unsure'
  }));

  const followUpAttempts = heldOut.slice(5, 10).map((q, i) => ({
    itemId: q.id,
    skillId: q.tests[0],
    correct: true, // 5/5 = 100%
    heldOut: true,
    ts: 5000 + i * 10,
    confidence: 'sure'
  }));

  const combined = [...baselineAttempts, ...followUpAttempts];
  const report = transfer(combined, { halfSize: 5 });

  t.assertEqual(report.available, true, 'Transfer report is available with 10 held-out attempts (halfSize=5)');
  t.assertEqual(report.baseline.n, 5, 'Baseline form has 5 items');
  t.assertEqual(report.current.n, 5, 'Follow-up form has 5 items');
  t.assertEqual(report.baseline.accuracy, 0.6, 'Baseline accuracy is 60%');
  t.assertEqual(report.current.accuracy, 1.0, 'Follow-up accuracy is 100%');
  t.assertEqual(report.delta, 0.4, 'Transfer delta is +40 percentage points');
  t.assert(Array.isArray(report.ci95), '95% confidence interval computed');
  t.assert(typeof report.caveat === 'string' && report.caveat.includes('Within-subject comparison'), 'Scientific caveat string preserved');

  // Insufficient attempts returns honest unavailable report
  const thinReport = transfer(baselineAttempts.slice(0, 3), { halfSize: 5 });
  t.assertEqual(thinReport.available, false, 'Insufficient attempts correctly reports available: false');
  t.assert(thinReport.caveat.includes('Not enough held-out attempts'), 'Honest caveat explains insufficient data');
});

t.summary();
