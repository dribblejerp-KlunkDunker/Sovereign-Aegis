/**
 * SOVEREIGN // AEGIS — Milestone 1 Empirical Stress & Adversarial Challenge Suite
 * Challenger 1 Verification Harness
 *
 * Exhaustive empirical challenge testing for:
 * 1. SIFT Labs: scoring logic, boundary scenarios, timing edge-cases, rapid bursts, intentional errors, trace lab distractor generation.
 * 2. SM-2 Spaced Repetition Bridge: synthetic aegis:sift-cards events, schema fuzzing, deduplication under storms, StateStore sync, SM-2 quality math.
 * 3. Rhetorical Sandbox: malformed clauses, missing assumptions, custom input fuzzing (XSS, unicode, large text), clause tagging, enthymeme deduction, Socratic steel-manning.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { StateStore, SEED_STATE } from '../js/state.js';
import { SiftLabs } from '../js/modules/siftLabs.js';
import { SpacedRepetition } from '../js/modules/spacedRepetition.js';
import { RhetoricalSandbox } from '../js/modules/rhetoricalSandbox.js';
import { recordAttempt, CONTEXTS } from '../js/attempts.js';
import { AttemptLog } from '../js/attemptlog.js';
import { estimate } from '../js/competency.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// -----------------------------------------------------------------------------
// IndexedDB In-Memory Stub for Headless Node Execution
// -----------------------------------------------------------------------------
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
      queueMicrotask(() => {
        if (!this.error && this.oncomplete) this.oncomplete({ target: this });
      });
    }
    objectStore(name) {
      if (!this._db.stores.has(name)) this._db.stores.set(name, new Map());
      return new FakeStore(this._db.stores.get(name), this);
    }
  }

  class FakeDb {
    constructor(name, version) {
      this.name = name;
      this.version = version;
      this.stores = new Map();
      this.objectStoreNames = { contains: (n) => this.stores.has(n) };
    }
    createObjectStore(name) {
      if (!this.stores.has(name)) this.stores.set(name, new Map());
      return new FakeStore(this.stores.get(name), { mode: 'readwrite' });
    }
    transaction(storeName, mode) {
      return new FakeTransaction(this, storeName, mode);
    }
    close() {}
  }

  globalThis.indexedDB = {
    open(name, version) {
      const req = new FakeRequest();
      queueMicrotask(() => {
        let db = databases.get(name);
        const isNew = !db;
        if (!db) {
          db = new FakeDb(name, version);
          databases.set(name, db);
        }
        req.result = db;
        if (isNew && req.onupgradeneeded) req.onupgradeneeded({ target: req });
        if (req.onsuccess) req.onsuccess({ target: req });
      });
      return req;
    }
  };
}

installIndexedDbStub();

// Install window and document event stubs for Node environment
globalThis.window = globalThis.window || {
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {}
};

// -----------------------------------------------------------------------------
// Test Harness
// -----------------------------------------------------------------------------
let totalPassed = 0;
let totalFailed = 0;
const failures = [];

function assert(condition, testName, details = '') {
  if (condition) {
    totalPassed++;
    console.log(`  ✓ ${testName}`);
  } else {
    totalFailed++;
    const msg = `✕ FAIL: ${testName} ${details ? '(' + details + ')' : ''}`;
    failures.push(msg);
    console.error(`  ${msg}`);
  }
}

function assertEqual(actual, expected, testName) {
  assert(actual === expected, testName, `Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
}

// -----------------------------------------------------------------------------
// MAIN TEST SUITE EXECUTION
// -----------------------------------------------------------------------------
async function runEmpiricalMilestone1Suite() {
  console.log('========================================================================');
  console.log('SOVEREIGN // AEGIS — MILESTONE 1 EMPIRICAL ADVERSARIAL STRESS SUITE');
  console.log('Pillar I: SIFT Labs Scoring, SM-2 Live Sync, and Rhetorical Sandbox');
  console.log('========================================================================\n');

  // Load baseline datasets for reference
  const siftScenariosPath = path.join(ROOT_DIR, 'data', 'sift_scenarios.json');
  const siftScenarios = JSON.parse(fs.readFileSync(siftScenariosPath, 'utf8'));

  const rhetoricalArgsPath = path.join(ROOT_DIR, 'data', 'rhetorical_arguments.json');
  const rhetoricalArgs = JSON.parse(fs.readFileSync(rhetoricalArgsPath, 'utf8'));

  const sm2CardsPath = path.join(ROOT_DIR, 'data', 'spaced_repetition_cards.json');
  const sm2Cards = JSON.parse(fs.readFileSync(sm2CardsPath, 'utf8'));

  // ===========================================================================
  // GROUP 1: SIFT LABS SCORING & BOUNDARY ADVERSARIAL STRESS
  // ===========================================================================
  console.log('------------------------------------------------------------------------');
  console.log('▶ GROUP 1: SIFT Labs Scoring Engine Adversarial Stress & Edge Cases');
  console.log('------------------------------------------------------------------------');

  const siftStore = new StateStore();
  const mockSiftApp = { store: siftStore };
  SiftLabs._app = mockSiftApp;
  SiftLabs._scenarios = siftScenarios;
  SiftLabs._sessionResults = [];

  // 1.1 Incomplete & Malformed Scenario Boundary Inputs
  console.log('\n[1.1] Scoring with Missing/Incomplete Scenario Schemas:');
  const bareScenario = {
    id: 'sift-edge-001',
    lab: 'stop',
    difficulty: 'beginner',
    domain: 'General',
    claim: 'Unverified claim without extra properties',
    correctDecision: 'stop'
  };

  let bareScoreResult = null;
  try {
    bareScoreResult = SiftLabs._scoreResult(bareScenario, true, 1000);
  } catch (err) {
    bareScoreResult = err;
  }
  assert(bareScoreResult && bareScoreResult.correct === true, 'SIFT handles scenario missing tests, sm2Tags, learningPoints gracefully');
  assertEqual(siftStore.get('sift.stats').total, 1, 'SIFT stats total incremented on bare scenario');
  assertEqual(siftStore.get('sift.stats').correct, 1, 'SIFT stats correct incremented on bare scenario');

  // 1.2 Boundary Timing Inputs (0ms, negative, massive, NaN, Infinity)
  console.log('\n[1.2] Timing Boundary Testing in SIFT Scoring:');
  const timingValues = [0, -500, 999999999, NaN, Infinity, -Infinity];
  for (const timeVal of timingValues) {
    const res = SiftLabs._scoreResult(bareScenario, false, timeVal);
    assert(res && res.correct === false, `SIFT scores safely with timeMs: ${timeVal}`);
  }

  // 1.3 Rapid Burst Decision Loop (1,000 Rapid Decisions)
  console.log('\n[1.3] High-Frequency Burst Decision Stress (1,000 decisions across 4 labs):');
  const burstStore = new StateStore();
  SiftLabs._app = { store: burstStore };
  SiftLabs._sessionResults = [];

  const labs = ['stop', 'investigate', 'coverage', 'trace'];
  const startBurst = Date.now();
  let expectedCorrect = 0;

  for (let i = 0; i < 1000; i++) {
    const lab = labs[i % 4];
    const isCorrect = i % 3 !== 0; // 2/3 correct
    if (isCorrect) expectedCorrect++;

    const sc = {
      id: `burst-sc-${i}`,
      lab,
      tests: [`skill.sift.${lab}`],
      heldOut: false,
      sm2Tags: isCorrect ? [] : ['test-tag'],
      learningPoints: isCorrect ? [] : ['Diagnostic learning point']
    };

    SiftLabs._scoreResult(sc, isCorrect, 1500);
  }
  const burstDuration = Date.now() - startBurst;

  const statsAfterBurst = burstStore.get('sift.stats');
  assertEqual(statsAfterBurst.total, 1000, 'SIFT stats.total matches exact 1,000 burst decisions');
  assertEqual(statsAfterBurst.correct, expectedCorrect, `SIFT stats.correct matches exact expected correct (${expectedCorrect})`);
  assertEqual(statsAfterBurst.byLab.stop.total, 250, 'Stop lab total is exactly 250');
  assertEqual(statsAfterBurst.byLab.investigate.total, 250, 'Investigate lab total is exactly 250');
  assertEqual(statsAfterBurst.byLab.coverage.total, 250, 'Coverage lab total is exactly 250');
  assertEqual(statsAfterBurst.byLab.trace.total, 250, 'Trace lab total is exactly 250');

  const expectedPoints = (expectedCorrect * 10) + ((1000 - expectedCorrect) * 2);
  const actualPoints = burstStore.get('operator.siftPoints');
  assertEqual(actualPoints, expectedPoints, `Operator SIFT points accumulated accurately (${actualPoints} == ${expectedPoints})`);
  assert(burstDuration < 1500, `1,000 burst decisions scored in ${burstDuration}ms (<1500ms)`);

  // 1.4 Intentional Mistake Flood & SM-2 Event Payload Contract Verification
  console.log('\n[1.4] Intentional Error Injection & SM-2 Flashcard Generation:');
  const interceptedSiftEvents = [];
  globalThis.window = globalThis.window || {};
  const prevDispatch = globalThis.window.dispatchEvent;
  globalThis.window.dispatchEvent = (event) => {
    if (event.type === 'aegis:sift-cards') {
      interceptedSiftEvents.push(event.detail?.cards);
    }
  };

  const sampleScenarioForError = {
    id: 'sift-stop-test-err',
    lab: 'stop',
    claim: 'Secret cure suppressed by medical cartels!',
    explanation: 'Conspiracy and urgency framing indicate manipulation.',
    learningPoints: [
      'Suppression rhetoric: Conspiracy framing bypasses institutional scrutiny.',
      'Miracle cure claims: Demands peer-reviewed replication.'
    ],
    sm2Tags: ['conspiracy-framing', 'urgency-signals'],
    tests: ['skill.sift.stop'],
    heldOut: false
  };

  SiftLabs._scoreResult(sampleScenarioForError, false, 2000);
  assert(interceptedSiftEvents.length > 0, 'Mistake dispatches aegis:sift-cards event');

  const emittedCards = interceptedSiftEvents[interceptedSiftEvents.length - 1];
  assertEqual(emittedCards.length, 2, 'Generated 2 memory cards from 2 learning points');

  for (let i = 0; i < emittedCards.length; i++) {
    const card = emittedCards[i];
    assert(card.id.startsWith('sift-sift-stop-test-err-lp'), `Card ${i} ID format is valid: ${card.id}`);
    assertEqual(card.domain, 'SIFT Verification', `Card ${i} domain is 'SIFT Verification'`);
    assert(card.prompt.includes('Secret cure suppressed'), `Card ${i} prompt contains scenario claim`);
    assert(card.diagnosis.startsWith('SIFT STOP'), `Card ${i} diagnosis starts with SIFT STOP`);
    assertEqual(card.latin, 'Siste et Perpende', `Card ${i} has correct Latin maxim for stop lab`);
    assertEqual(card.mechanism, sampleScenarioForError.explanation, `Card ${i} mechanism matches scenario explanation`);
    assertEqual(card.countermeasure, sampleScenarioForError.learningPoints[i], `Card ${i} countermeasure matches learning point`);
    assert(card.tests.includes('skill.sift.stop'), `Card ${i} tests array contains skill.sift.stop`);
    assertEqual(card.repetitions, 0, `Card ${i} repetitions initialized to 0`);
    assertEqual(card.interval, 0, `Card ${i} interval initialized to 0`);
    assertEqual(card.easeFactor, 2.5, `Card ${i} easeFactor initialized to 2.5`);
  }

  // 1.5 Unassessed Mode Validation
  console.log('\n[1.5] Non-Assessed Mode (`assessed: false`):');
  const countBeforeUnassessed = await AttemptLog.count();
  SiftLabs._scoreResult(sampleScenarioForError, true, 1000, { assessed: false });
  await new Promise(r => setTimeout(r, 20));
  const countAfterUnassessed = await AttemptLog.count();
  assertEqual(countAfterUnassessed, countBeforeUnassessed, 'Assessed: false mode does NOT write records to AttemptLog');

  // 1.6 Trace Lab Deterministic Option Permutation & Distractor Selection
  console.log('\n[1.6] Trace Lab Deterministic Distractor Generation & Boundary Conditions:');
  const traceScenario = siftScenarios.find(s => s.lab === 'trace');
  assert(Boolean(traceScenario), 'Trace scenario found in dataset');

  if (traceScenario) {
    const opts1 = SiftLabs._traceVerdictOptions(traceScenario);
    const opts2 = SiftLabs._traceVerdictOptions(traceScenario);

    assertEqual(opts1.length, 4, 'Trace verdict options contains 4 candidates');
    assertEqual(opts1.filter(o => o.correct).length, 1, 'Trace verdict options contains exactly 1 correct option');
    assertEqual(opts1.filter(o => !o.correct).length, 3, 'Trace verdict options contains exactly 3 distractors');

    // Verify deterministic shuffle (same scenario ID produces identical ordering)
    let isDeterministic = true;
    for (let k = 0; k < opts1.length; k++) {
      if (opts1[k].text !== opts2[k].text || opts1[k].correct !== opts2[k].correct) {
        isDeterministic = false;
      }
    }
    assert(isDeterministic, 'Trace verdict option permutation is strictly deterministic for a given scenario ID');

    // Test with empty scenario pool boundary
    SiftLabs._scenarios = [traceScenario]; // only 1 trace scenario
    const isolatedOpts = SiftLabs._traceVerdictOptions(traceScenario);
    assertEqual(isolatedOpts.filter(o => o.correct).length, 1, 'Trace options with 0 external distractors still contains 1 correct option without crashing');
    SiftLabs._scenarios = siftScenarios; // restore
  }

  // 1.7 LRU Cache Pruning for Seen Scenarios
  console.log('\n[1.7] Seen Scenarios Cache LRU Eviction:');
  const seenStore = new StateStore();
  SiftLabs._app = { store: seenStore };

  for (let s = 1; s <= 50; s++) {
    SiftLabs._markSeen(`scenario-${s.toString().padStart(3, '0')}`);
  }

  const seenMap = seenStore.get('sift.seen');
  const seenKeys = Object.keys(seenMap);
  assert(seenKeys.length <= 30, `Seen cache pruned to max 30 entries (Actual: ${seenKeys.length})`);
  assert(!seenKeys.includes('scenario-001'), 'Oldest seen entries (e.g. scenario-001) were evicted');
  assert(seenKeys.includes('scenario-050'), 'Most recently seen entry (scenario-050) is retained');

  // ===========================================================================
  // GROUP 2: SM-2 SPACED REPETITION LIVE BRIDGE FUZZING & STRESS
  // ===========================================================================
  console.log('\n------------------------------------------------------------------------');
  console.log('▶ GROUP 2: SM-2 Spaced Repetition Live Bridge Fuzzing & Stress');
  console.log('------------------------------------------------------------------------');

  const sm2Store = new StateStore();
  const mockSm2App = {
    store: sm2Store,
    showToast: () => {}
  };
  SpacedRepetition._app = mockSm2App;
  SpacedRepetition._deck = [];
  SpacedRepetition._activeQueue = [];

  // 2.1 Malformed & Fuzzed Payload Dispatch
  console.log('\n[2.1] Dispatching Malformed & Fuzzed Card Events to Live Bridge:');
  const fuzzedPayloads = [
    null,
    undefined,
    {},
    { cards: null },
    { cards: 'not-an-array' },
    { cards: 12345 },
    { cards: [null, undefined, 123, 'string', {}] }
  ];

  for (const p of fuzzedPayloads) {
    let threw = false;
    const isolatedStore = new StateStore();
    SpacedRepetition._app = { store: isolatedStore, showToast: () => {} };
    SpacedRepetition._deck = [];
    try {
      SpacedRepetition.enqueueCards(p?.cards || p);
    } catch (e) {
      threw = true;
    }
    assert(!threw, `enqueueCards safely handled fuzzed input ${JSON.stringify(p)} without throwing`);
  }

  // Restore clean state for 2.2
  SpacedRepetition._app = mockSm2App;
  SpacedRepetition._deck = [];
  sm2Store.set('sm2.deck', '[]');

  // 2.2 Deduplication Under Flood & Interleaved Mutations
  console.log('\n[2.2] Card Deduplication Stress (100 Duplicate Dispatches):');
  const testCardA = {
    id: 'test-card-dedup-01',
    domain: 'SIFT Verification',
    prompt: 'Deduplication prompt 1',
    diagnosis: 'SIFT STOP: Test Diagnosis',
    mechanism: 'Test Mechanism',
    countermeasure: 'Test Countermeasure',
    repetitions: 0,
    interval: 0,
    easeFactor: 2.5
  };

  const testCardB = {
    id: 'test-card-dedup-02',
    domain: 'Logical Fallacy',
    prompt: 'Deduplication prompt 2',
    diagnosis: 'Ad Hominem',
    mechanism: 'Attacking person',
    countermeasure: 'Address argument',
    repetitions: 0,
    interval: 0,
    easeFactor: 2.5
  };

  // Dispatch single card 100 times in rapid loop
  for (let i = 0; i < 100; i++) {
    SpacedRepetition.enqueueCards([testCardA]);
  }
  assertEqual(SpacedRepetition._deck.length, 1, '100 rapid duplicate dispatches resulted in exactly 1 card in _deck');

  // Interleaved flood: 50 unique cards + 50 duplicates
  const mixedBatch = [];
  for (let i = 0; i < 50; i++) {
    mixedBatch.push({
      id: `unique-card-${i}`,
      domain: 'SIFT Verification',
      prompt: `Prompt ${i}`,
      diagnosis: `Diagnosis ${i}`,
      mechanism: `Mechanism ${i}`,
      countermeasure: `Countermeasure ${i}`
    });
    mixedBatch.push(testCardA); // duplicate
    mixedBatch.push(testCardB); // duplicate / new
  }

  SpacedRepetition.enqueueCards(mixedBatch);
  assertEqual(SpacedRepetition._deck.length, 52, '50 unique + 2 deduplicated cards yield exactly 52 cards in _deck');

  // 2.3 StateStore Persistence & Corrupted Storage Recovery
  console.log('\n[2.3] StateStore Sync & Corrupted Store Deserialization Resilience:');
  const persistedRaw = sm2Store.get('sm2.deck');
  assert(typeof persistedRaw === 'string' && persistedRaw.length > 50, 'Deck persisted to StateStore under sm2.deck as JSON string');
  const parsedPersisted = JSON.parse(persistedRaw);
  assertEqual(parsedPersisted.length, 52, 'Persisted deck count matches in-memory deck count');

  // Corrupted StateStore fuzzing
  const corruptedStorageValues = [
    'INVALID_JSON_{{{',
    null,
    undefined,
    123456,
    true,
    '{}',
    '[]'
  ];

  for (const corruptedVal of corruptedStorageValues) {
    sm2Store.set('sm2.deck', corruptedVal);
    let hydrateThrew = false;
    try {
      SpacedRepetition._hydrateDeckFromStore();
    } catch (err) {
      hydrateThrew = true;
    }
    assert(!hydrateThrew, `_hydrateDeckFromStore safely handles corrupted storage value (${JSON.stringify(corruptedVal)})`);
  }

  // Restore valid deck
  sm2Store.set('sm2.deck', JSON.stringify(parsedPersisted));
  SpacedRepetition._hydrateDeckFromStore();
  assertEqual(SpacedRepetition._deck.length, 52, 'Deck restored cleanly from valid JSON state');

  // 2.4 Mathematical SuperMemo SM-2 Calculation & Ease Factor Floor
  console.log('\n[2.4] Mathematical SM-2 Scheduler Invariants & Ease Factor Boundary:');
  let mockCard = {
    id: 'sm2-calc-test',
    repetitions: 0,
    interval: 0,
    easeFactor: 2.5
  };

  // Quality 1 ("Again") -> Fail
  let resQ1 = SpacedRepetition._calculateSM2(mockCard, 1);
  assertEqual(resQ1.repetitions, 0, 'Quality 1 resets repetitions to 0');
  assertEqual(resQ1.interval, 1, 'Quality 1 resets interval to 1');
  assert(resQ1.easeFactor < 2.5, `Quality 1 decreases ease factor (${resQ1.easeFactor} < 2.5)`);

  // Repetition progression for Quality 3 ("Good")
  mockCard = { id: 'sm2-prog', repetitions: 0, interval: 0, easeFactor: 2.5 };
  let resR0 = SpacedRepetition._calculateSM2(mockCard, 3);
  assertEqual(resR0.repetitions, 1, 'Rep 0 -> Rep 1 for Quality 3');
  assertEqual(resR0.interval, 1, 'Rep 0 -> Interval 1 for Quality 3');

  let resR1 = SpacedRepetition._calculateSM2(resR0, 3);
  assertEqual(resR1.repetitions, 2, 'Rep 1 -> Rep 2 for Quality 3');
  assertEqual(resR1.interval, 6, 'Rep 1 -> Interval 6 for Quality 3');

  let resR2 = SpacedRepetition._calculateSM2(resR1, 3);
  assertEqual(resR2.repetitions, 3, 'Rep 2 -> Rep 3 for Quality 3');
  assertEqual(resR2.interval, Math.round(6 * resR1.easeFactor), `Rep 2 -> Interval Math.round(6 * ${resR1.easeFactor})`);

  // Ease Factor Floor Clamp Stress (20 consecutive failures)
  let deterioratingCard = { repetitions: 5, interval: 30, easeFactor: 1.4 };
  for (let fail = 0; fail < 20; fail++) {
    deterioratingCard = SpacedRepetition._calculateSM2(deterioratingCard, 1);
  }
  assertEqual(deterioratingCard.easeFactor, 1.3, 'Ease factor is strictly clamped at 1.3 minimum after 20 failures');

  // 2.5 Domain Filtering & Queue Management
  console.log('\n[2.5] Domain Filtering & Active Queue Construction:');
  SpacedRepetition._filterDomain = 'all';
  SpacedRepetition._buildQueue();
  assertEqual(SpacedRepetition._activeQueue.length, 52, 'Filter all includes all 52 available cards');

  SpacedRepetition._filterDomain = 'SIFT Verification';
  SpacedRepetition._buildQueue();
  assertEqual(SpacedRepetition._activeQueue.length, 51, 'Filter SIFT Verification matches 51 SIFT cards');

  SpacedRepetition._filterDomain = 'Logical Fallacy';
  SpacedRepetition._buildQueue();
  assertEqual(SpacedRepetition._activeQueue.length, 1, 'Filter Logical Fallacy matches 1 fallacy card');

  SpacedRepetition._filterDomain = 'NonexistentDomain';
  SpacedRepetition._buildQueue();
  assertEqual(SpacedRepetition._activeQueue.length, 0, 'Filter NonexistentDomain produces empty active queue');

  // ===========================================================================
  // GROUP 3: RHETORICAL SANDBOX MALFORMED INPUT & ADVERSARIAL STRESS
  // ===========================================================================
  console.log('\n------------------------------------------------------------------------');
  console.log('▶ GROUP 3: Rhetorical Sandbox Stress & Malformed Input Handling');
  console.log('------------------------------------------------------------------------');

  const sandboxStore = new StateStore();
  const mockSandboxApp = {
    store: sandboxStore,
    showToast: () => {}
  };
  RhetoricalSandbox._app = mockSandboxApp;
  RhetoricalSandbox._arguments = rhetoricalArgs;

  // 3.1 Defensive Object Accessors (_getAssumptionObj & _getSteelmanObj)
  console.log('\n[3.1] Missing & Malformed Object Boundary Handlers:');
  const assumptionFuzzInputs = [
    null,
    undefined,
    {},
    { unstatedAssumption: null },
    { unstatedAssumption: 'Direct string without object wrapper' },
    { unstatedAssumption: 12345 }
  ];

  for (const inp of assumptionFuzzInputs) {
    const res = RhetoricalSandbox._getAssumptionObj(inp);
    assert(typeof res === 'object' && res !== null, `_getAssumptionObj safely returns object for ${JSON.stringify(inp)}`);
    assert(typeof res.text === 'string', `_getAssumptionObj object has string text property`);
    assert(Array.isArray(res.distractors), `_getAssumptionObj object has array distractors`);
    assert(typeof res.explanation === 'string', `_getAssumptionObj object has string explanation`);
  }

  const steelmanFuzzInputs = [
    null,
    undefined,
    {},
    { steelMannedVersion: null },
    { steelMannedVersion: 'Direct steel-man string' },
    { steelMannedVersion: 999 }
  ];

  for (const inp of steelmanFuzzInputs) {
    const res = RhetoricalSandbox._getSteelmanObj(inp);
    assert(typeof res === 'object' && res !== null, `_getSteelmanObj safely returns object for ${JSON.stringify(inp)}`);
    assert(typeof res.text === 'string', `_getSteelmanObj object has string text property`);
    assert(Array.isArray(res.improvements), `_getSteelmanObj object has array improvements`);
    assert(Array.isArray(res.exercises), `_getSteelmanObj object has array exercises`);
  }

  // 3.2 Custom Argument Ingestion Fuzzing (XSS, Unicode, Massive Paragraphs)
  console.log('\n[3.2] Custom Argument Ingestion Fuzzing (XSS, Unicode, Long Strings):');
  const customInputs = [
    { desc: 'Empty String', text: '' },
    { desc: 'Whitespace Only', text: '    \t\r\n    ' },
    { desc: 'Single Period', text: '.' },
    { desc: 'HTML / XSS Tags', text: '<script>alert("xss")</script> Technology expands faster than ethics. Therefore <img src=x onerror=alert(1)> humanity is endangered.' },
    { desc: 'Unicode & Emojis', text: '🤖 人工智能正在改变世界。 ⚠️ 缺乏监管将导致灾难。 🛑 因此必须立即采取行动！' },
    { desc: 'Control & Null Bytes', text: 'Premise 1\u0000with null byte. Premise 2\u001Fwith control. Therefore conclusion\u007F.' },
    { desc: '5,000-Character Monolithic Argument', text: 'Claim '.repeat(500) + '. Therefore conclusion.' }
  ];

  for (const c of customInputs) {
    let threw = false;
    try {
      RhetoricalSandbox.loadCustomArgument(c.text);
    } catch (e) {
      threw = true;
    }
    assert(!threw, `loadCustomArgument successfully processed ${c.desc} without crashing`);
    assert(RhetoricalSandbox._isCustom === true, `${c.desc} flagged as isCustom`);
    assert(Array.isArray(RhetoricalSandbox._currentArg.clauses), `${c.desc} produced clauses array`);
    assert(RhetoricalSandbox._enthymemeOptions.length === 4, `${c.desc} generated 4 enthymeme options`);
    assert(RhetoricalSandbox._steelmanOptions.length === 4, `${c.desc} generated 4 steelman options`);
  }

  // 3.3 Clause Tagging Validation & Attempt Logging
  console.log('\n[3.3] Clause Tagging Validation & Idempotent Attempt Logging:');
  RhetoricalSandbox.loadArgument('arg-ai-risk');
  const argAiRisk = RhetoricalSandbox._currentArg;

  // Validation with 0 tags
  RhetoricalSandbox._userClauseTags = {};
  const attemptsBefore0 = await AttemptLog.count();
  RhetoricalSandbox._validateUserTags();
  await new Promise(r => setTimeout(r, 20));
  const attemptsAfter0 = await AttemptLog.count();
  assertEqual(attemptsAfter0, attemptsBefore0, 'Validation with 0 tags returns early and does NOT write attempt records');

  // Tag all clauses correctly
  argAiRisk.clauses.forEach(c => {
    RhetoricalSandbox._userClauseTags[c.id] = c.type;
  });

  RhetoricalSandbox._validateUserTags();
  await new Promise(r => setTimeout(r, 30));
  const attemptsAfterTagging = await AttemptLog.count();
  assertEqual(attemptsAfterTagging, attemptsBefore0 + argAiRisk.clauses.length, `Correct tagging logged exactly ${argAiRisk.clauses.length} attempt records`);

  // Idempotency: re-validating does not duplicate records in same session
  RhetoricalSandbox._validateUserTags();
  await new Promise(r => setTimeout(r, 20));
  const attemptsAfterRevalidation = await AttemptLog.count();
  assertEqual(attemptsAfterRevalidation, attemptsAfterTagging, 'Re-validating same clauses in same session is idempotent (no duplicate writes)');

  // 3.4 Enthymeme Deduction Drill Stress
  console.log('\n[3.4] Enthymeme Deduction Drill Stress & Unlocking:');
  RhetoricalSandbox.loadArgument('arg-ai-risk');

  // Submit without selection
  RhetoricalSandbox._selectedEnthymemeIdx = null;
  RhetoricalSandbox._submitEnthymemeDeduction();
  assert(RhetoricalSandbox._enthymemeUnlocked === false, 'Submitting without selection does not unlock diagnostic');

  // Submit with correct selection
  const correctEnthIdx = RhetoricalSandbox._enthymemeOptions.findIndex(o => o.isCorrect);
  assert(correctEnthIdx !== -1, 'Correct enthymeme index found');

  RhetoricalSandbox._selectedEnthymemeIdx = correctEnthIdx;
  RhetoricalSandbox._submitEnthymemeDeduction();
  assert(RhetoricalSandbox._enthymemeUnlocked === true, 'Submitting correct enthymeme unlocks diagnostic');
  assertEqual(RhetoricalSandbox._enthymemeSubmitted, true, 'Enthymeme submitted flag is true');

  // 3.5 Socratic Steel-Manning Drill Stress
  console.log('\n[3.5] Socratic Steel-Manning Drill Stress:');
  // Submit without selection
  RhetoricalSandbox._selectedSteelmanOptionIdx = null;
  RhetoricalSandbox._submitSteelmanExercise();
  assertEqual(RhetoricalSandbox._steelmanSubmitted, false, 'Submitting steel-man without selection is rejected');

  // Submit with correct selection
  const correctSteelIdx = RhetoricalSandbox._steelmanOptions.findIndex(o => o.isCorrect);
  assert(correctSteelIdx !== -1, 'Correct steel-man option index located');

  RhetoricalSandbox._selectedSteelmanOptionIdx = correctSteelIdx;
  RhetoricalSandbox._submitSteelmanExercise();
  assertEqual(RhetoricalSandbox._steelmanSubmitted, true, 'Submitting correct steel-man marks submission complete');

  // 3.6 State Persistence & Bayesian Competency Estimation
  console.log('\n[3.6] StateStore Persistence & Bayesian Competency Verification:');
  const storedRhetoricState = sandboxStore.get('rhetoric.state');
  assert(Boolean(storedRhetoricState), 'Rhetorical state persisted to StateStore');
  assertEqual(storedRhetoricState.activeArgId, 'arg-ai-risk', 'Stored state contains correct activeArgId');
  assertEqual(storedRhetoricState.enthymemeUnlocked, true, 'Stored state contains enthymemeUnlocked = true');

  const allRecordedAttempts = await AttemptLog.readAll();
  const fallacyCompetency = estimate(allRecordedAttempts, 'skill.fallacy.structure');
  assert(fallacyCompetency.n > 0, `Bayesian competency calculated attempts (n = ${fallacyCompetency.n})`);
  assert(fallacyCompetency.mastery > 0.5, `Bayesian competency mastery is above prior 0.5 (Mastery: ${fallacyCompetency.mastery.toFixed(3)})`);

  // ===========================================================================
  // SUMMARY & VERDICT
  // ===========================================================================
  console.log('\n========================================================================');
  console.log(`[CHALLENGER 1 SUMMARY] ${totalPassed} Passed, ${totalFailed} Failed`);
  console.log('========================================================================\n');

  if (totalFailed > 0) {
    console.error('FAILURES:');
    failures.forEach(f => console.error(`  - ${f}`));
    process.exitCode = 1;
  } else {
    console.log('All Milestone 1 empirical adversarial stress tests passed with 100% success.');
    process.exitCode = 0;
  }
}

runEmpiricalMilestone1Suite().catch(err => {
  console.error('\nUNCAUGHT EXCEPTION IN ADVERSARIAL STRESS HARNESS:', err);
  process.exitCode = 1;
});
