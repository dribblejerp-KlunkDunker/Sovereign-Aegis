/**
 * SOVEREIGN // AEGIS — Forensic Auditor 1 Independent Test Suite
 * Exhaustively stress-tests Milestone 1 components:
 *  - SIFT Labs Engine & Sub-labs
 *  - Spaced Repetition (SM-2) Core Algorithm & Queue Management
 *  - Rhetorical Sandbox (Clause Tagging, Enthymeme Deduction, Steel-Manning, Custom Parser)
 *  - Central StateStore & Serialization
 *  - AttemptLog & Bayesian Competency Estimation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { StateStore, SEED_STATE } from '../js/state.js';
import { SiftLabs } from '../js/modules/siftLabs.js';
import { SpacedRepetition } from '../js/modules/spacedRepetition.js';
import { RhetoricalSandbox } from '../js/modules/rhetoricalSandbox.js';
import { recordAttempt, CONTEXTS } from '../js/attempts.js';
import { AttemptLog } from '../js/attemptlog.js';
import { estimate } from '../js/competency.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Polyfills for Node environment
globalThis.window = globalThis.window || {
  dispatchEvent: (event) => {}
};
globalThis.CustomEvent = globalThis.CustomEvent || class CustomEvent {
  constructor(type, params) {
    this.type = type;
    this.detail = params?.detail;
  }
};

// Install IndexedDB stub for Node environment
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
      if (!this.stores.has(storeName)) this.stores.set(storeName, new Map());
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

let totalPassed = 0;
let totalFailed = 0;

function check(desc, condition) {
  if (condition) {
    totalPassed++;
    console.log(`  [PASS] ${desc}`);
  } else {
    totalFailed++;
    console.error(`  [FAIL] ${desc}`);
  }
}

async function runAuditorSuite() {
  console.log('================================================================');
  console.log('   FORENSIC AUDITOR 1: INDEPENDENT EMPIRICAL INTEGRITY SUITE    ');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // SECTION 1: SIFT Labs Forensic Mechanics
  // -------------------------------------------------------------
  console.log('>>> 1. SIFT Labs Forensic Verification');
  const mockStore = new StateStore();
  SiftLabs._app = { store: mockStore };

  // Load scenarios file directly
  const siftData = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'sift_scenarios.json'), 'utf8'));
  SiftLabs._scenarios = siftData;

  check('SIFT scenarios dataset is non-empty array', Array.isArray(siftData) && siftData.length >= 10);

  const stopScenarios = SiftLabs._getScenariosForLab('stop');
  const investScenarios = SiftLabs._getScenariosForLab('investigate');
  const covScenarios = SiftLabs._getScenariosForLab('coverage');
  const traceScenarios = SiftLabs._getScenariosForLab('trace');

  check('All 4 SIFT sub-labs have scenarios', stopScenarios.length > 0 && investScenarios.length > 0 && covScenarios.length > 0 && traceScenarios.length > 0);

  // Test scoring logic for both correct and incorrect decisions
  const testScenario = stopScenarios[0];
  const initialPoints = parseInt(mockStore.get('operator.siftPoints') || '0', 10);
  
  const correctResult = SiftLabs._scoreResult(testScenario, true, 850);
  check('Correct decision returns correct: true', correctResult.correct === true);
  check('Correct decision awards 10 points', parseInt(mockStore.get('operator.siftPoints'), 10) === initialPoints + 10);
  
  let dispatchedCards = null;
  globalThis.window.dispatchEvent = (event) => {
    if (event.type === 'aegis:sift-cards') {
      dispatchedCards = event.detail?.cards;
    }
  };

  const incorrectResult = SiftLabs._scoreResult(testScenario, false, 1200);
  check('Incorrect decision returns correct: false', incorrectResult.correct === false);
  check('Incorrect decision awards 2 points', parseInt(mockStore.get('operator.siftPoints'), 10) === initialPoints + 12);
  check('Incorrect decision dispatches aegis:sift-cards with valid cards', Array.isArray(dispatchedCards) && dispatchedCards.length > 0);

  // Test SIFT Seen tracking and recycling limit (>30)
  for (let i = 0; i < 40; i++) {
    SiftLabs._markSeen(`test-seen-scenario-${i}`);
  }
  const seenMap = mockStore.get('sift.seen');
  const seenCount = Object.keys(seenMap).length;
  check('SIFT seen tracking prunes oldest when exceeding 30 entries', seenCount <= 31);

  // Test Trace Lab distractors
  const traceTestScenario = traceScenarios[0];
  const traceOpts = SiftLabs._traceVerdictOptions(traceTestScenario);
  check('Trace verdict options returns 4 items', traceOpts.length === 4);
  check('Trace verdict options contains exactly 1 correct option', traceOpts.filter(o => o.correct).length === 1);
  check('Trace verdict correct option text matches scenario verdict', traceOpts.find(o => o.correct).text === traceTestScenario.verdict);

  // -------------------------------------------------------------
  // SECTION 2: SM-2 Spaced Repetition Mathematical Exactness
  // -------------------------------------------------------------
  console.log('\n>>> 2. SM-2 Spaced Repetition Mathematical Verification');
  
  const cardTest = {
    id: 'test-card-1',
    domain: 'SIFT Verification',
    prompt: 'Test Prompt',
    diagnosis: 'Test Diagnosis',
    latin: 'Test Latin',
    mechanism: 'Test Mech',
    countermeasure: 'Test Counter',
    tests: ['skill.sift.stop'],
    heldOut: false,
    repetitions: 0,
    interval: 0,
    easeFactor: 2.5,
    dueDate: '2026-08-20',
    lastReviewed: null,
    history: []
  };

  // Step 1: Quality 4 (Easy) on Repetition 0
  const sm2Step1 = SpacedRepetition._calculateSM2(cardTest, 4);
  check('SM-2 Step 1 (q=4, rep=0) -> repetitions=1, interval=1', sm2Step1.repetitions === 1 && sm2Step1.interval === 1);
  check('SM-2 Step 1 Ease Factor updated from 2.5 to 2.6', sm2Step1.easeFactor === 2.6);

  // Step 2: Quality 3 (Good) on Repetition 1
  const sm2Step2 = SpacedRepetition._calculateSM2({ ...cardTest, ...sm2Step1 }, 3);
  check('SM-2 Step 2 (q=3, rep=1) -> repetitions=2, interval=6', sm2Step2.repetitions === 2 && sm2Step2.interval === 6);
  check('SM-2 Step 2 Ease Factor stays at 2.6 (delta = 0)', sm2Step2.easeFactor === 2.6);

  // Step 3: Quality 3 (Good) on Repetition 2
  const sm2Step3 = SpacedRepetition._calculateSM2({ ...cardTest, ...sm2Step2 }, 3);
  const expectedInterval3 = Math.round(6 * 2.6); // 16
  check(`SM-2 Step 3 (q=3, rep=2) -> interval=${expectedInterval3}`, sm2Step3.interval === expectedInterval3 && sm2Step3.repetitions === 3);

  // Step 4: Quality 1 (Again / Fail) on Repetition 3
  const sm2Step4 = SpacedRepetition._calculateSM2({ ...cardTest, ...sm2Step3 }, 1);
  check('SM-2 Step 4 (q=1, Fail) -> repetitions reset to 0, interval reset to 1', sm2Step4.repetitions === 0 && sm2Step4.interval === 1);
  check('SM-2 Step 4 Ease Factor reduced from 2.6 to 2.06', sm2Step4.easeFactor === 2.06);

  // Step 5: Lower bound clamp on Ease Factor (min 1.3)
  let lowEFCard = { ...cardTest, easeFactor: 1.35, repetitions: 2, interval: 4 };
  const sm2StepLow = SpacedRepetition._calculateSM2(lowEFCard, 1);
  check('SM-2 Ease Factor is strictly clamped to minimum 1.3', sm2StepLow.easeFactor === 1.3);

  // Live Enqueue & StateStore Bridge
  SpacedRepetition._app = { store: mockStore };
  SpacedRepetition._deck = [];
  mockStore.set('sm2.deck', null);

  const sampleNewCards = [
    { ...cardTest, id: 'sift-card-auto-1' },
    { ...cardTest, id: 'sift-card-auto-2' }
  ];
  SpacedRepetition.enqueueCards(sampleNewCards);
  check('enqueueCards adds cards to _deck', SpacedRepetition._deck.length === 2);
  check('enqueueCards writes JSON to sm2.deck in StateStore', JSON.parse(mockStore.get('sm2.deck')).length === 2);

  // Deduplication check
  SpacedRepetition.enqueueCards(sampleNewCards);
  check('enqueueCards deduplicates by ID without inflating deck', SpacedRepetition._deck.length === 2);

  // -------------------------------------------------------------
  // SECTION 3: Rhetorical Sandbox Deep Behavioral Verification
  // -------------------------------------------------------------
  console.log('\n>>> 3. Rhetorical Sandbox Behavioral & Pedagogical Verification');

  const rawRhetoricArgs = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'rhetorical_arguments.json'), 'utf8'));
  check('rhetorical_arguments.json contains exactly 6 curated arguments', rawRhetoricArgs.length === 6);

  RhetoricalSandbox._app = { store: mockStore, showToast: () => {} };
  RhetoricalSandbox._arguments = rawRhetoricArgs;

  for (let idx = 0; idx < rawRhetoricArgs.length; idx++) {
    const arg = rawRhetoricArgs[idx];
    RhetoricalSandbox.loadArgument(arg.id);

    check(`[Arg ${arg.id}] Loaded successfully`, RhetoricalSandbox._currentArg.id === arg.id);
    check(`[Arg ${arg.id}] Enthymeme options initialized with 4 items`, RhetoricalSandbox._enthymemeOptions.length === 4);
    check(`[Arg ${arg.id}] Enthymeme options contain exactly 1 correct answer`, RhetoricalSandbox._enthymemeOptions.filter(o => o.isCorrect).length === 1);
    check(`[Arg ${arg.id}] Steelman options initialized with 4 items`, RhetoricalSandbox._steelmanOptions.length === 4);
    check(`[Arg ${arg.id}] Steelman options contain exactly 1 correct answer`, RhetoricalSandbox._steelmanOptions.filter(o => o.isCorrect).length === 1);

    // Test tagging verification
    arg.clauses.forEach(c => {
      RhetoricalSandbox._userClauseTags[c.id] = c.type; // Set correct tags
    });
    RhetoricalSandbox._validateUserTags();
    const rhetoricStats = mockStore.get('rhetoric.stats');
    check(`[Arg ${arg.id}] User clause tagging successfully validated`, rhetoricStats.clausesCorrect > 0);

    // Test Enthymeme deduction
    const correctEntIdx = RhetoricalSandbox._enthymemeOptions.findIndex(o => o.isCorrect);
    RhetoricalSandbox._selectedEnthymemeIdx = correctEntIdx;
    RhetoricalSandbox._submitEnthymemeDeduction();
    check(`[Arg ${arg.id}] Enthymeme deduction unlocks structural flaw`, RhetoricalSandbox._enthymemeUnlocked === true);

    // Test Steelman exercise
    const correctStIdx = RhetoricalSandbox._steelmanOptions.findIndex(o => o.isCorrect);
    RhetoricalSandbox._selectedSteelmanOptionIdx = correctStIdx;
    RhetoricalSandbox._submitSteelmanExercise();
    check(`[Arg ${arg.id}] Steelman exercise marks submitted`, RhetoricalSandbox._steelmanSubmitted === true);
  }

  // Custom Argument Edge Case Test
  RhetoricalSandbox.loadCustomArgument('Premise one. Premise two. Therefore conclusion.');
  check('Custom argument parsed into 3 clauses', RhetoricalSandbox._currentArg.clauses.length === 3);
  check('Custom argument generates valid fallback assumption object', Boolean(RhetoricalSandbox._getAssumptionObj(RhetoricalSandbox._currentArg).text));
  check('Custom argument generates valid fallback steelman object', Boolean(RhetoricalSandbox._getSteelmanObj(RhetoricalSandbox._currentArg).text));

  // Fallback handlers on corrupt / empty input
  const nullAssump = RhetoricalSandbox._getAssumptionObj(null);
  check('_getAssumptionObj(null) returns safe fallback object', typeof nullAssump === 'object' && Array.isArray(nullAssump.distractors));

  const strAssump = RhetoricalSandbox._getAssumptionObj({ unstatedAssumption: 'Plain string assumption' });
  check('_getAssumptionObj(plainString) returns normalized object with distractors', strAssump.text === 'Plain string assumption' && strAssump.distractors.length === 3);

  const nullSteelman = RhetoricalSandbox._getSteelmanObj(null);
  check('_getSteelmanObj(null) returns safe fallback object', typeof nullSteelman === 'object' && Array.isArray(nullSteelman.improvements));

  // -------------------------------------------------------------
  // SECTION 4: Central StateStore Integrity & Reactivity
  // -------------------------------------------------------------
  console.log('\n>>> 4. Central StateStore & Serialization Verification');

  const testStore = new StateStore();
  testStore.set('custom.nested.key', { foo: 'bar', num: 123 });
  check('StateStore deep set & get works', testStore.get('custom.nested.key.foo') === 'bar');

  let wildFired = 0;
  testStore.subscribe('custom.nested.*', () => { wildFired++; });
  testStore.set('custom.nested.newKey', 'testVal');
  check('StateStore wildcard subscriber receives child mutation', wildFired === 1);

  // Test Sanitization: CryptoKeyPair stripping during save
  testStore.set('identity.keyPair', { publicKey: {}, privateKey: {} });
  testStore.save();
  const rawSaved = testStore._storage.getItem(testStore._options.storageKey);
  const parsedSaved = JSON.parse(rawSaved);
  check('StateStore save sanitizes and strips non-serializable keyPair', parsedSaved.identity.keyPair === null);

  // -------------------------------------------------------------
  // SECTION 5: AttemptLog & Bayesian Competency Engine
  // -------------------------------------------------------------
  console.log('\n>>> 5. AttemptLog & Bayesian Estimation Verification');

  const initialAttempts = await AttemptLog.readAll();
  const initialAttemptCount = initialAttempts.length;

  recordAttempt({
    skillIds: ['skill.sift.stop', 'skill.sift.investigate-source'],
    itemId: 'audit-test-item-1',
    correct: true,
    context: CONTEXTS.SIFT,
    latencyMs: 1100,
    heldOut: false
  });

  await new Promise(r => setTimeout(r, 25));
  const newAttempts = await AttemptLog.readAll();
  check('recordAttempt appends 2 records for 2 tested skillIds', newAttempts.length === initialAttemptCount + 2);

  const stopSkillEst = estimate(newAttempts, 'skill.sift.stop');
  check('Bayesian estimate computes valid mastery for tested skill', stopSkillEst.mastery >= 0.5 && stopSkillEst.n >= 1);
  check('Bayesian estimate calculates confidence >= 0', stopSkillEst.confidence >= 0);

  console.log('\n================================================================');
  console.log(`AUDITOR TEST SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED.`);
  console.log('================================================================');

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runAuditorSuite().catch(err => {
  console.error('Forensic test suite crashed:', err);
  process.exit(1);
});
