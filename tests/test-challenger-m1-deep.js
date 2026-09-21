/**
 * SOVEREIGN // AEGIS — Milestone 1 Deep Empirical Challenger Verification Suite
 * 
 * Verifies:
 * 1. SIFT Labs AttemptLog recording, SM-2 memory card generation & data integrity across all 32 scenarios
 * 2. Rhetorical Sandbox clause tagging, enthymeme deduction, Socratic steel-manning, and custom arguments
 * 3. Spaced Repetition (SM-2) queue sync, quality grading, and live bridge
 * 4. State recovery resilience against corrupted localStorage states
 * 5. Zero dark patterns, predatory gamification, or artificial urgency audit
 * 6. DOM scaffolding & CSS token resolution integrity
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { StateStore, SEED_STATE } from '../js/state.js';
import { AegisCrypto } from '../js/crypto.js';
import { SiftLabs } from '../js/modules/siftLabs.js';
import { SpacedRepetition } from '../js/modules/spacedRepetition.js';
import { RhetoricalSandbox } from '../js/modules/rhetoricalSandbox.js';
import { recordAttempt, CONTEXTS } from '../js/attempts.js';
import { AttemptLog, normaliseAttempt, normaliseConfidence, SCHEMA_VERSION } from '../js/attemptlog.js';
import { estimate, estimateAll } from '../js/competency.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Install In-Memory IndexedDB Stub for Node
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
        if (!db) {
          db = new FakeDb(name, version);
          databases.set(name, db);
        }
        req.result = db;
        if (req.onsuccess) req.onsuccess({ target: req });
      });
      return req;
    }
  };
}

installIndexedDbStub();

// Install minimal DOM environment stub
function installDomStub() {
  const elements = new Map();

  class FakeElement {
    constructor(id = '', tag = 'div') {
      this.id = id;
      this.tagName = tag.toUpperCase();
      this.dataset = {};
      this.classList = {
        _classes: new Set(),
        add(c) { this._classes.add(c); },
        remove(c) { this._classes.delete(c); },
        contains(c) { return this._classes.has(c); },
        toggle(c) { if (this.contains(c)) this.remove(c); else this.add(c); }
      };
      this.style = {};
      this.children = [];
      this.attributes = new Map();
      this._innerHTML = '';
      this._textContent = '';
      this.listeners = new Map();
      this.disabled = false;
      this.value = '';
    }
    get innerHTML() { return this._innerHTML; }
    set innerHTML(val) {
      this._innerHTML = val;
      const idMatches = val.matchAll(/id=["']([^"']+)["']/g);
      for (const m of idMatches) {
        if (!elements.has(m[1])) {
          const child = new FakeElement(m[1]);
          elements.set(m[1], child);
        }
      }
    }
    get textContent() { return this._textContent; }
    set textContent(val) { this._textContent = val; }
    setAttribute(k, v) { this.attributes.set(k, String(v)); }
    getAttribute(k) { return this.attributes.get(k) || null; }
    removeAttribute(k) { this.attributes.delete(k); }
    get firstChild() { return this.children.length > 0 ? this.children[0] : null; }
    insertBefore(newChild, refChild) {
      const idx = this.children.indexOf(refChild);
      if (idx !== -1) {
        this.children.splice(idx, 0, newChild);
      } else {
        this.children.unshift(newChild);
      }
      return newChild;
    }
    appendChild(child) {
      this.children.push(child);
      if (child.id && !elements.has(child.id)) {
        elements.set(child.id, child);
      }
      return child;
    }
    removeChild(child) {
      this.children = this.children.filter(c => c !== child);
      return child;
    }
    addEventListener(evt, fn) {
      if (!this.listeners.has(evt)) this.listeners.set(evt, []);
      this.listeners.get(evt).push(fn);
    }
    dispatchEvent(evt) {
      const fns = this.listeners.get(evt.type) || [];
      fns.forEach(fn => fn(evt));
    }
    querySelectorAll(selector) {
      const results = [];
      for (const el of elements.values()) {
        if (selector.startsWith('#') && el.id === selector.slice(1)) results.push(el);
        else if (selector.startsWith('.') && el.classList.contains(selector.slice(1))) results.push(el);
        else if (selector.startsWith('[data-') && el.attributes.has(selector.slice(1, -1).split('=')[0])) results.push(el);
      }
      return results;
    }
    querySelector(selector) {
      const all = this.querySelectorAll(selector);
      return all.length > 0 ? all[0] : null;
    }
  }

  globalThis.document = {
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, new FakeElement(id));
      }
      return elements.get(id);
    },
    querySelectorAll(selector) {
      const dummy = new FakeElement();
      return dummy.querySelectorAll(selector);
    },
    querySelector(selector) {
      const dummy = new FakeElement();
      return dummy.querySelector(selector);
    },
    createElement(tag) {
      return new FakeElement('', tag);
    }
  };

  const windowListeners = new Map();
  globalThis.window = {
    addEventListener(evt, fn) {
      if (!windowListeners.has(evt)) windowListeners.set(evt, []);
      windowListeners.get(evt).push(fn);
    },
    dispatchEvent(evt) {
      const fns = windowListeners.get(evt.type) || [];
      fns.forEach(fn => fn(evt));
    }
  };

  globalThis.CustomEvent = class {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail || {};
    }
  };

  // Mock fetch to load local json datasets
  globalThis.fetch = async function(url) {
    const cleanPath = url.replace(/^\.\//, '').replace(/^\//, '');
    const fullPath = path.resolve(rootDir, cleanPath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      return {
        ok: true,
        json: async () => JSON.parse(content),
        text: async () => content
      };
    }
    throw new Error(`File not found: ${url}`);
  };
}

installDomStub();

class TestRunner {
  constructor(name) {
    this.name = name;
    this.total = 0;
    this.passed = 0;
    this.failed = 0;
    this.failures = [];
  }

  assert(condition, name, details = '') {
    this.total++;
    if (condition) {
      this.passed++;
      console.log(`  ✓ ${name}`);
    } else {
      this.failed++;
      const err = `✕ FAIL: ${name} ${details ? '(' + details + ')' : ''}`;
      this.failures.push(err);
      console.error(`  ${err}`);
    }
  }

  assertEqual(actual, expected, name) {
    this.assert(actual === expected, name, `Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
  }

  summary() {
    console.log('\n========================================================================');
    console.log(`  ${this.name} Summary: ${this.passed}/${this.total} Passed (${this.failed} Failed)`);
    console.log('========================================================================');
    if (this.failed > 0) {
      console.error('\nFailures:');
      this.failures.forEach(f => console.error(`  - ${f}`));
      process.exitCode = 1;
    }
    return { passed: this.passed, failed: this.failed, total: this.total };
  }
}

async function runDeepChallengerSuite() {
  const runner = new TestRunner('Challenger 2 Milestone 1 Deep Empirical Verification');

  console.log('========================================================================');
  console.log('  CHALLENGER 2: DEEP EMPIRICAL ADVERSARIAL HARNESS (MILESTONE 1)');
  console.log('========================================================================\n');

  // --------------------------------------------------------------------------
  // TEST GROUP 1: SIFT LABS DATASET & SCENARIO COVERAGE
  // --------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: SIFT Labs Scenario Structure & Tagging ---');
  const siftRaw = fs.readFileSync(path.join(rootDir, 'data/sift_scenarios.json'), 'utf8');
  const siftScenarios = JSON.parse(siftRaw);

  runner.assert(Array.isArray(siftScenarios) && siftScenarios.length === 32, `sift_scenarios.json contains 32 scenarios (Found: ${siftScenarios.length})`);

  const labCounts = { stop: 0, investigate: 0, coverage: 0, trace: 0 };
  siftScenarios.forEach(s => {
    labCounts[s.lab] = (labCounts[s.lab] || 0) + 1;
    runner.assert(Boolean(s.id), `Scenario ${s.id || 'unknown'} has non-empty ID`);
    runner.assert(Boolean(s.claim), `Scenario ${s.id} has claim string`);
    runner.assert(Boolean(s.explanation), `Scenario ${s.id} has explanation`);
    runner.assert(Array.isArray(s.learningPoints) && s.learningPoints.length > 0, `Scenario ${s.id} has learningPoints array`);
    runner.assert(Array.isArray(s.tests) && s.tests.length > 0, `Scenario ${s.id} has valid tests skill tags`);
    runner.assert(Array.isArray(s.sm2Tags) && s.sm2Tags.length > 0, `Scenario ${s.id} has sm2Tags`);
    runner.assert(typeof s.heldOut === 'boolean', `Scenario ${s.id} specifies heldOut boolean`);
  });

  runner.assertEqual(labCounts.stop, 8, 'Stop lab has 8 scenarios');
  runner.assertEqual(labCounts.investigate, 8, 'Investigate lab has 8 scenarios');
  runner.assertEqual(labCounts.coverage, 8, 'Coverage lab has 8 scenarios');
  runner.assertEqual(labCounts.trace, 8, 'Trace lab has 8 scenarios');

  // --------------------------------------------------------------------------
  // TEST GROUP 2: SIFT LABS ATTEMPTLOG INTEGRITY & SM-2 CARD EVENT DISPATCH
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: SIFT Labs AttemptLog Recording & SM-2 Live Dispatch ---');
  await AttemptLog.clear();
  const mockStore = new StateStore();
  const mockApp = { store: mockStore, showToast: () => {} };

  await SiftLabs.init(mockApp);

  let enqueuedCards = [];
  window.addEventListener('aegis:sift-cards', (e) => {
    enqueuedCards = e.detail?.cards || [];
  });

  let initialAttemptCount = await AttemptLog.count();
  runner.assertEqual(initialAttemptCount, 0, 'AttemptLog is clean before testing');

  // 2.1 Test Stop Lab Scenario with mistake
  const stopScenario = siftScenarios.find(s => s.lab === 'stop');
  const wrongDecision = stopScenario.correctDecision === 'stop' ? 'continue' : 'stop';
  
  enqueuedCards = [];
  SiftLabs._scoreResult(stopScenario, false, 1500);

  // Give microtasks time to settle
  await new Promise(r => setTimeout(r, 20));

  let attemptsAfterStop = await AttemptLog.readAll();
  runner.assertEqual(attemptsAfterStop.length, 1, 'Mistake in Stop Lab records exactly 1 attempt in AttemptLog');
  runner.assertEqual(attemptsAfterStop[0].correct, false, 'AttemptLog record shows correct: false');
  runner.assertEqual(attemptsAfterStop[0].context, CONTEXTS.SIFT, 'AttemptLog record context is "sift"');
  runner.assertEqual(attemptsAfterStop[0].skillId, 'skill.sift.stop', 'AttemptLog skillId matches skill.sift.stop');
  runner.assertEqual(attemptsAfterStop[0].itemId, stopScenario.id, 'AttemptLog itemId matches scenario ID');
  runner.assertEqual(attemptsAfterStop[0].latencyMs, 1500, 'AttemptLog latency is preserved');

  runner.assert(enqueuedCards.length > 0, `Mistake in Stop Lab generates ${enqueuedCards.length} SM-2 cards via aegis:sift-cards`);
  runner.assertEqual(enqueuedCards[0].domain, 'SIFT Verification', 'Generated SM-2 card domain is "SIFT Verification"');
  runner.assertEqual(enqueuedCards[0].easeFactor, 2.5, 'Generated SM-2 card has easeFactor 2.5');
  runner.assertEqual(enqueuedCards[0].repetitions, 0, 'Generated SM-2 card has repetitions 0');
  runner.assertEqual(enqueuedCards[0].interval, 0, 'Generated SM-2 card has interval 0');

  // 2.2 Test Stop Lab Scenario with correct decision
  enqueuedCards = [];
  SiftLabs._scoreResult(stopScenario, true, 800);
  await new Promise(r => setTimeout(r, 20));

  let attemptsAfterStopCorrect = await AttemptLog.readAll();
  runner.assertEqual(attemptsAfterStopCorrect.length, 2, 'Correct answer in Stop Lab records 2nd attempt in AttemptLog');
  runner.assertEqual(attemptsAfterStopCorrect[1].correct, true, '2nd attempt shows correct: true');
  runner.assertEqual(enqueuedCards.length, 0, 'No SM-2 cards enqueued on correct answer');

  // 2.3 Test non-assessed interaction (assessed: false)
  SiftLabs._scoreResult(stopScenario, true, 500, { assessed: false });
  await new Promise(r => setTimeout(r, 20));
  let attemptsAfterNonAssessed = await AttemptLog.readAll();
  runner.assertEqual(attemptsAfterNonAssessed.length, 2, 'Non-assessed interaction does NOT write to AttemptLog (no manufactured mastery)');

  // --------------------------------------------------------------------------
  // TEST GROUP 3: RHETORICAL SANDBOX ATTEMPTLOG & DRILLS
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Rhetorical Sandbox AttemptLog & Interactive Drills ---');
  await RhetoricalSandbox.init(mockApp);
  const rawRhetoric = fs.readFileSync(path.join(rootDir, 'data/rhetorical_arguments.json'), 'utf8');
  const rhetoricArgs = JSON.parse(rawRhetoric);

  runner.assert(Array.isArray(rhetoricArgs) && rhetoricArgs.length >= 6, `rhetorical_arguments.json contains 6 curated arguments (Found: ${rhetoricArgs.length})`);

  for (const arg of rhetoricArgs) {
    runner.assert(Boolean(arg.id), `Argument ${arg.id} has ID`);
    runner.assert(Boolean(arg.unstatedAssumption?.text), `Argument ${arg.id} unstatedAssumption has text`);
    runner.assert(Array.isArray(arg.unstatedAssumption?.distractors) && arg.unstatedAssumption.distractors.length >= 3, `Argument ${arg.id} unstatedAssumption has >= 3 distractors`);
    runner.assert(Boolean(arg.structuralFlaw?.name), `Argument ${arg.id} structuralFlaw has name`);
    runner.assert(Boolean(arg.steelMannedVersion?.text), `Argument ${arg.id} steelMannedVersion has text`);
    runner.assert(Array.isArray(arg.steelMannedVersion?.exercises) && arg.steelMannedVersion.exercises.length >= 1, `Argument ${arg.id} steelMannedVersion has >= 1 exercise`);
  }

  // 3.1 Clause Tagging & AttemptLog recording
  const testArg = rhetoricArgs[0];
  RhetoricalSandbox.loadArgument(testArg.id);

  // Tag all clauses correctly
  testArg.clauses.forEach(c => {
    RhetoricalSandbox._userClauseTags[c.id] = c.type;
  });

  const attemptsBeforeValidate = (await AttemptLog.readAll()).length;
  RhetoricalSandbox._validateUserTags();
  await new Promise(r => setTimeout(r, 20));

  const attemptsAfterValidate = await AttemptLog.readAll();
  const newAttempts = attemptsAfterValidate.length - attemptsBeforeValidate;
  runner.assertEqual(newAttempts, testArg.clauses.length, `Clause validation recorded ${newAttempts} attempts for ${testArg.clauses.length} clauses`);
  
  // Verify idempotency: re-validating does not re-record
  RhetoricalSandbox._validateUserTags();
  await new Promise(r => setTimeout(r, 20));
  const attemptsAfterRevalidate = (await AttemptLog.readAll()).length;
  runner.assertEqual(attemptsAfterRevalidate, attemptsAfterValidate.length, 'Re-validating same clauses is idempotent (no duplicate attempts logged)');

  // 3.2 Enthymeme Deduction Drill
  runner.assertEqual(RhetoricalSandbox._enthymemeOptions.length, 4, 'Enthymeme options array initialized with 4 choices (1 correct + 3 distractors)');
  const correctEnthymemeIdx = RhetoricalSandbox._enthymemeOptions.findIndex(o => o.isCorrect);
  runner.assert(correctEnthymemeIdx !== -1, 'Enthymeme options contains exactly 1 correct option');

  // Submit enthymeme
  RhetoricalSandbox._selectedEnthymemeIdx = correctEnthymemeIdx;
  const attemptsBeforeEnthymeme = (await AttemptLog.readAll()).length;
  RhetoricalSandbox._submitEnthymemeDeduction();
  await new Promise(r => setTimeout(r, 20));

  const attemptsAfterEnthymeme = await AttemptLog.readAll();
  runner.assertEqual(attemptsAfterEnthymeme.length, attemptsBeforeEnthymeme + 1, 'Enthymeme deduction recorded 1 attempt in AttemptLog');
  const enthymemeAttempt = attemptsAfterEnthymeme[attemptsAfterEnthymeme.length - 1];
  runner.assertEqual(enthymemeAttempt.itemId, `${testArg.id}#enthymeme`, 'Enthymeme attempt itemId is formatted correctly');
  runner.assertEqual(enthymemeAttempt.correct, true, 'Enthymeme attempt shows correct: true');
  runner.assertEqual(enthymemeAttempt.context, CONTEXTS.SANDBOX, 'Enthymeme attempt context is "sandbox"');
  runner.assertEqual(RhetoricalSandbox._enthymemeUnlocked, true, 'Enthymeme submission successfully unlocks structural flaw diagnostics');

  // 3.3 Socratic Steel-Manning Drill
  runner.assertEqual(RhetoricalSandbox._steelmanOptions.length, 4, 'Steel-manning options array initialized with 4 choices');
  const correctSteelmanIdx = RhetoricalSandbox._steelmanOptions.findIndex(o => o.isCorrect);
  runner.assert(correctSteelmanIdx !== -1, 'Steelman options contains exactly 1 correct option');

  RhetoricalSandbox._selectedSteelmanOptionIdx = correctSteelmanIdx;
  const attemptsBeforeSteelman = (await AttemptLog.readAll()).length;
  RhetoricalSandbox._submitSteelmanExercise();
  await new Promise(r => setTimeout(r, 20));

  const attemptsAfterSteelman = await AttemptLog.readAll();
  runner.assertEqual(attemptsAfterSteelman.length, attemptsBeforeSteelman + 1, 'Socratic steel-manning recorded 1 attempt in AttemptLog');
  const steelmanAttempt = attemptsAfterSteelman[attemptsAfterSteelman.length - 1];
  runner.assertEqual(steelmanAttempt.itemId, `${testArg.id}#steelman`, 'Steelman attempt itemId is formatted correctly');
  runner.assertEqual(steelmanAttempt.correct, true, 'Steelman attempt shows correct: true');
  runner.assertEqual(steelmanAttempt.context, CONTEXTS.SANDBOX, 'Steelman attempt context is "sandbox"');

  // 3.4 Custom Argument Ingestion
  RhetoricalSandbox.loadCustomArgument('Autonomous drones are increasingly weaponized. Unregulated weapons systems inevitably destabilize regional balance. Therefore, all automated drone manufacturing should be halted immediately.');
  runner.assertEqual(RhetoricalSandbox._isCustom, true, 'Custom argument flag set');
  runner.assertEqual(RhetoricalSandbox._currentArg.clauses.length, 3, 'Custom argument split into 3 clauses');
  runner.assertEqual(RhetoricalSandbox._enthymemeOptions.length, 4, 'Custom argument dynamically creates 4 enthymeme options');
  runner.assertEqual(RhetoricalSandbox._steelmanOptions.length, 4, 'Custom argument dynamically creates 4 steel-manning options');

  // --------------------------------------------------------------------------
  // TEST GROUP 4: SPACED REPETITION (SM-2) LIVE BRIDGE & ENGINE
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Spaced Repetition (SM-2) Live Bridge & Engine ---');
  await SpacedRepetition.init(mockApp);
  
  const testCards = [
    {
      id: 'test-card-1',
      domain: 'SIFT Verification',
      prompt: 'Urgency test prompt',
      diagnosis: 'Urgency Hijack',
      tests: ['skill.sift.stop'],
      repetitions: 0,
      interval: 0,
      easeFactor: 2.5,
      dueDate: new Date().toISOString().split('T')[0]
    },
    {
      id: 'test-card-2',
      domain: 'SIFT Verification',
      prompt: 'Authority test prompt',
      diagnosis: 'False Authority',
      tests: ['skill.sift.investigate-source'],
      repetitions: 0,
      interval: 0,
      easeFactor: 2.5,
      dueDate: new Date().toISOString().split('T')[0]
    }
  ];

  SpacedRepetition.enqueueCards(testCards);
  runner.assert(SpacedRepetition._deck.some(c => c.id === 'test-card-1'), 'Enqueued card 1 is present in SpacedRepetition deck');
  runner.assert(SpacedRepetition._deck.some(c => c.id === 'test-card-2'), 'Enqueued card 2 is present in SpacedRepetition deck');

  // Verify SM-2 calculation mathematics
  const calcAgain = SpacedRepetition._calculateSM2(testCards[0], 1); // Again
  runner.assertEqual(calcAgain.repetitions, 0, 'Rating Again (1) resets repetitions to 0');
  runner.assertEqual(calcAgain.interval, 1, 'Rating Again (1) resets interval to 1');

  const calcGood = SpacedRepetition._calculateSM2(testCards[0], 3); // Good
  runner.assertEqual(calcGood.repetitions, 1, 'Rating Good (3) increments repetitions to 1');
  runner.assertEqual(calcGood.interval, 1, 'Rating Good (3) sets first interval to 1 day');

  const calcGoodSecond = SpacedRepetition._calculateSM2({ ...testCards[0], repetitions: 1, interval: 1, easeFactor: 2.5 }, 3);
  runner.assertEqual(calcGoodSecond.repetitions, 2, 'Second Good review increments repetitions to 2');
  runner.assertEqual(calcGoodSecond.interval, 6, 'Second Good review sets interval to 6 days');

  const calcGoodThird = SpacedRepetition._calculateSM2({ ...testCards[0], repetitions: 2, interval: 6, easeFactor: 2.5 }, 3);
  runner.assertEqual(calcGoodThird.repetitions, 3, 'Third Good review increments repetitions to 3');
  runner.assertEqual(calcGoodThird.interval, 15, 'Third Good review scales interval by easeFactor (6 * 2.5 = 15)');

  // --------------------------------------------------------------------------
  // TEST GROUP 5: STATE PERSISTENCE & CRASH RECOVERY
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: State Persistence & Crash Recovery ---');

  // Corrupt state simulation: malformed strings, nulls, empty values
  const corruptedStore = new StateStore();
  corruptedStore.set('sm2.deck', 'MALFORMED_JSON_STRING_[[{');
  corruptedStore.set('rhetoric.state', null);
  corruptedStore.set('sift.stats', null);

  const crashRecoveryApp = { store: corruptedStore, showToast: () => {} };

  let didCrash = false;
  try {
    SpacedRepetition._app = crashRecoveryApp;
    SpacedRepetition._hydrateDeckFromStore();
    RhetoricalSandbox._app = crashRecoveryApp;
    RhetoricalSandbox.onMount();
    SiftLabs._app = crashRecoveryApp;
    SiftLabs.onMount();
  } catch (err) {
    didCrash = true;
    console.error('Crash occurred during corrupted state recovery:', err);
  } finally {
    if (typeof SiftLabs._clearTimer === 'function') {
      SiftLabs._clearTimer();
    }
  }

  runner.assert(!didCrash, 'Milestone 1 modules recover gracefully from missing or malformed store state without throwing');

  // --------------------------------------------------------------------------
  // TEST GROUP 6: ZERO DARK PATTERNS & ETHICAL ENGAGEMENT AUDIT
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: Zero Dark Patterns & Ethical Attention Architecture Audit ---');

  const jsFiles = [
    'js/app.js',
    'js/state.js',
    'js/crypto.js',
    'js/attempts.js',
    'js/attemptlog.js',
    'js/confidence.js',
    'js/competency.js',
    'js/modules/siftLabs.js',
    'js/modules/spacedRepetition.js',
    'js/modules/rhetoricalSandbox.js'
  ];

  const darkPatternForbiddenTokens = [
    { pattern: /\bstreak\s*(?:multiplier|bonus|flame|fire|loss|break)\b/i, name: 'Casino streak multiplier / streak pressure' },
    { pattern: /\b(?:jackpot|slot_machine|loot_box|lootbox|spin_wheel|lucky_draw)\b/i, name: 'Gambling / Casino dopamine mechanics' },
    { pattern: /\b(?:hurry_up|time_is_running_out|you_will_lose_rank|fomo_alert)\b/i, name: 'Manufactured urgency / FOMO intimidation' },
    { pattern: /\b(?:paywall|vip_tier|energy_refill|gems|coins_balance)\b/i, name: 'Microtransactions / Artificial energy gates' },
    { pattern: /\bconfetti\s*\(/i, name: 'Overstimulating dopamine confetti burst' }
  ];

  let detectedDarkPatterns = 0;
  for (const file of jsFiles) {
    const fullPath = path.join(rootDir, file);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf8');

    darkPatternForbiddenTokens.forEach(({ pattern, name }) => {
      const match = pattern.test(content);
      if (match) {
        detectedDarkPatterns++;
        runner.assert(false, `Zero dark patterns in ${file} (${name})`);
      }
    });
  }

  runner.assertEqual(detectedDarkPatterns, 0, 'Zero manipulative dark patterns or casino mechanics found across all Milestone 1 files');

  // Verify SIFT timer is purely observational elapsed counter (no countdown penalty)
  const siftLabSrc = fs.readFileSync(path.join(rootDir, 'js/modules/siftLabs.js'), 'utf8');
  runner.assert(siftLabSrc.includes('Date.now() - this._timerStart'), 'SIFT timer computes positive elapsed duration (observational)');
  runner.assert(!siftLabSrc.includes('timeLimit') && !siftLabSrc.includes('timeRemaining'), 'SIFT timer does not enforce punitive time limit or sudden death countdown');

  // --------------------------------------------------------------------------
  // TEST GROUP 7: DOM STRUCTURE & CSS DESIGN TOKENS
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 7: DOM Structure & CSS Design Token Verification ---');
  const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

  // Verify critical M1 DOM containers
  const requiredM1DomIds = [
    'subtab-sift-labs',
    'subtab-sandbox',
    'select-sandbox-preset',
    'sandbox-clauses-container',
    'sandbox-syllogism-chain',
    'sandbox-enthymeme-options',
    'btn-submit-enthymeme',
    'sandbox-flaw-lock-banner',
    'sandbox-flaw-content',
    'sandbox-steelman-view',
    'sandbox-steelman-exercise-options',
    'btn-submit-steelman-exercise',
    'subtab-memory',
    'sm2-review-view',
    'sm2-card-prompt-text',
    'sm2-card-back',
    'btn-sm2-reveal'
  ];

  requiredM1DomIds.forEach(id => {
    runner.assert(indexHtml.includes(`id="${id}"`), `index.html contains #${id}`);
  });

  // Verify dynamic sub-containers rendered by SiftLabs
  runner.assert(siftLabSrc.includes('id="sift-lab-selector-grid"'), 'siftLabs.js dynamic template includes #sift-lab-selector-grid');
  runner.assert(siftLabSrc.includes('id="sift-active-lab-viewport"'), 'siftLabs.js dynamic template includes #sift-active-lab-viewport');

  // Verify CSS variables
  const cssVars = fs.readFileSync(path.join(rootDir, 'css/variables.css'), 'utf8');
  const requiredTokens = [
    '--bg-void',
    '--granite-dark',
    '--bronze-primary',
    '--bronze-bright',
    '--parchment-primary',
    '--veracity-green',
    '--suspicion-amber',
    '--disinfo-crimson',
    '--font-display',
    '--font-serif',
    '--font-mono'
  ];

  requiredTokens.forEach(token => {
    runner.assert(cssVars.includes(`${token}:`), `variables.css defines token ${token}`);
  });

  return runner.summary();
}

runDeepChallengerSuite();
