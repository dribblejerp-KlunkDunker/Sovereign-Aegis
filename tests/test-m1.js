/**
 * Milestone 1 Verification Suite
 * Tests StateStore, AegisCrypto (ECDSA P-256, did:key, canonicalization, Base58/Base64url),
 * SIFT Labs scoring & SM-2 memory card generation, Spaced Repetition live bridge,
 * and Rhetorical Sandbox enthymeme deduction & Socratic steel-manning.
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
import { AttemptLog } from '../js/attemptlog.js';
import { estimate } from '../js/competency.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

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

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✕ FAIL: ${message}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('SOVEREIGN // AEGIS — Milestone 1 Core Unit Tests');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // TEST GROUP 1: StateStore
  // ----------------------------------------------------
  console.log('--- TEST GROUP 1: StateStore ---');
  const store = new StateStore();

  assert(store.get('app.name') === 'SOVEREIGN // AEGIS', 'StateStore initial app name matches seed');
  assert(store.get('telemetry.networkLatencyMs') === SEED_STATE.telemetry.networkLatencyMs, 'StateStore initial telemetry matches seed (measured keys only — the theatrical sentinel/threat seeds were removed 2026-09-25)');
  assert(store.get('nonexistent.deep.path', 'fallback') === 'fallback', 'StateStore returns fallback on missing path');

  // Deep set
  store.set('telemetry.blockHeight', 1500000);
  assert(store.get('telemetry.blockHeight') === 1500000, 'StateStore set deep path resolves correctly');

  // Deep update
  store.update('telemetry.blockHeight', val => val + 50);
  assert(store.get('telemetry.blockHeight') === 1500050, 'StateStore update updaterFn mutates state correctly');

  // Exact Subscription
  let subscriberTriggered = false;
  let receivedNewVal = null;
  const unsubExact = store.subscribe('telemetry.networkLatencyMs', (newVal) => {
    subscriberTriggered = true;
    receivedNewVal = newVal;
  });
  store.set('telemetry.networkLatencyMs', 42);
  assert(subscriberTriggered && receivedNewVal === 42, 'Exact subscriber receives state change');

  // Unsubscribe
  unsubExact();
  subscriberTriggered = false;
  store.set('telemetry.networkLatencyMs', 99);
  assert(!subscriberTriggered, 'Unsubscribe stops subscription callbacks');

  // Wildcard Subscription
  let wildcardCount = 0;
  const unsubWildcard = store.subscribe('telemetry.*', (val, old, path) => {
    wildcardCount++;
  });
  store.set('telemetry.lastTick', 'CRITICAL');
  store.set('telemetry.activeNodes', 3000);
  assert(wildcardCount === 2, 'Wildcard subscriber matches all children in branch');
  unsubWildcard();

  // Event Bus
  let eventPayload = null;
  const unsubEvent = store.on('TEST_EVENT', payload => {
    eventPayload = payload;
  });
  store.dispatch('TEST_EVENT', { status: 'OK' });
  assert(eventPayload && eventPayload.status === 'OK', 'Event bus dispatch and on handler work');
  unsubEvent();

  // Reset
  store.reset(false);
  assert(store.get('telemetry.networkLatencyMs') === SEED_STATE.telemetry.networkLatencyMs, 'StateStore reset restores seed defaults');
  assert(typeof store.get('sift.stats') === 'object', 'StateStore includes sift stats tree in seed');
  assert(typeof store.get('rhetoric.stats') === 'object', 'StateStore includes rhetoric stats tree in seed');

  // ----------------------------------------------------
  // TEST GROUP 2: AegisCrypto Primitives
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 2: AegisCrypto Primitives ---');

  // Canonicalization
  const uncanonical = { z: 1, a: { y: 'test', b: [3, 2, 1], x: true }, m: null };
  const canonicalStr = AegisCrypto.canonicalize(uncanonical);
  const expectedCanonical = '{"a":{"b":[3,2,1],"x":true,"y":"test"},"m":null,"z":1}';
  assert(canonicalStr === expectedCanonical, `Canonical JSON deterministic sorting: ${canonicalStr}`);

  // Base64url round-trip
  const testBytes = new Uint8Array([0, 255, 128, 64, 32, 16, 8, 4, 2, 1]);
  const b64url = AegisCrypto.base64UrlEncode(testBytes);
  const decodedBytes = AegisCrypto.base64UrlDecode(b64url);
  let bytesMatch = true;
  for (let i = 0; i < testBytes.length; i++) {
    if (testBytes[i] !== decodedBytes[i]) bytesMatch = false;
  }
  assert(bytesMatch && !b64url.includes('+') && !b64url.includes('/') && !b64url.includes('='), 'Base64URL round-trip without standard padding');

  // Base58 round-trip
  const sampleBytes = new Uint8Array([0, 0, 1, 2, 3, 250, 255]);
  const b58Str = AegisCrypto.base58Encode(sampleBytes);
  const b58Decoded = AegisCrypto.base58Decode(b58Str);
  let b58Match = sampleBytes.length === b58Decoded.length;
  for (let i = 0; i < sampleBytes.length; i++) {
    if (sampleBytes[i] !== b58Decoded[i]) b58Match = false;
  }
  assert(b58Match, `Base58BTC encode/decode round-trip with leading zeros: ${b58Str}`);

  // SHA-256
  const hash = await AegisCrypto.computeHash('Sovereign Aegis Epistemic Defense');
  assert(hash.length === 64, `SHA-256 produces 64-char hex hash: ${hash.slice(0, 16)}...`);

  // Entropy & UUID
  const entropy = AegisCrypto.getRandomEntropy(16);
  assert(entropy.length === 32, `Entropy generator returns 32-hex chars: ${entropy}`);

  const uuid = AegisCrypto.generateUUID();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert(uuidRegex.test(uuid), `UUID v4 compliance: ${uuid}`);

  // ----------------------------------------------------
  // TEST GROUP 3: WebCrypto Keypair, Sign & Verify
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 3: ECDSA P-256 WebCrypto & did:key ---');

  const keyResult = await AegisCrypto.generateKeyPair();
  assert(Boolean(keyResult.keyPair), 'Keypair generated successfully');
  assert(keyResult.did.startsWith('did:key:z'), `DID starts with did:key:z: ${keyResult.did.slice(0, 20)}...`);
  assert(keyResult.publicKeyJwk.crv === 'P-256' && keyResult.publicKeyJwk.kty === 'EC', 'Public JWK has crv: P-256 and kty: EC');
  assert(keyResult.privateKeyJwk === null, 'Default keypair withholds the private JWK (non-extractable)');
  assert(keyResult.keyPair.privateKey.extractable === false, 'Default private key is non-extractable');

  // Explicit opt-in export path, used only for key backup / offline test vectors.
  const exportableResult = await AegisCrypto.generateKeyPair({ extractable: true });
  assert(Boolean(exportableResult.privateKeyJwk.d), 'Private JWK contains private parameter d when extractable is requested');

  // Sign Statement
  const statement = {
    statement: 'Claim #4829 regarding bank liquidity confirmed false.',
    timestamp: '2026-08-16T00:00:00Z',
    confidenceScore: 0.98,
    investigatorDid: keyResult.did
  };

  const signature = await AegisCrypto.signStatement(keyResult.keyPair.privateKey, statement);
  assert(typeof signature === 'string' && signature.length > 40, `Signed statement produces Base64url signature: ${signature.slice(0, 20)}...`);

  // Verify Statement with CryptoKey
  const isValidWithCryptoKey = await AegisCrypto.verifyStatement(keyResult.keyPair.publicKey, statement, signature);
  assert(isValidWithCryptoKey === true, 'Verification with CryptoKey succeeds');

  // Verify Statement with JWK
  const isValidWithJwk = await AegisCrypto.verifyStatement(keyResult.publicKeyJwk, statement, signature);
  assert(isValidWithJwk === true, 'Verification with Public JWK succeeds');

  // Verify Tampered Statement fails
  const tamperedStatement = { ...statement, confidenceScore: 0.50 };
  const isTamperedValid = await AegisCrypto.verifyStatement(keyResult.publicKeyJwk, tamperedStatement, signature);
  assert(isTamperedValid === false, 'Tampered statement signature verification correctly FAILS');

  // W3C Verifiable Credential Builder
  const vc = AegisCrypto.exportVerifiableCredential(keyResult.did, keyResult.publicKeyJwk, statement, signature);
  assert(vc['@context'].includes('https://www.w3.org/2018/credentials/v1'), 'VC contains W3C credentials v1 context');
  assert(vc.issuer === keyResult.did, 'VC issuer matches did');
  assert(vc.proof.jws === signature, 'VC proof JWS matches signature');
  assert(vc.credentialSubject.statement === statement.statement, 'VC credentialSubject matches claims');

  // ----------------------------------------------------
  // TEST GROUP 4: SIFT Labs Scoring & SM-2 Flashcard Generation
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 4: SIFT Labs Scoring & SM-2 Memory Card Generation ---');

  const siftMockApp = {
    store: new StateStore()
  };
  SiftLabs._app = siftMockApp;

  // Test SIFT Stop Lab evaluator scoring
  const stopScenarioLegit = {
    id: 'sift-stop-006',
    lab: 'stop',
    difficulty: 'beginner',
    domain: 'Science',
    claim: 'Peer-reviewed NASA study confirms lunar water ice signatures in shaded craters.',
    correctDecision: 'continue',
    explanation: 'Legitimate scientific report with proper attribution and verifiable institutional source.',
    learningPoints: ['Verify peer-reviewed consensus: Distinguish sensationalism from scientific confirmation.'],
    sm2Tags: ['source-verification'],
    tests: ['skill.sift.stop'],
    heldOut: false
  };

  const stopScenarioHostile = {
    id: 'sift-stop-001',
    lab: 'stop',
    difficulty: 'beginner',
    domain: 'Health',
    claim: 'BREAKING: Drinking coffee causes instant heart failure, doctors hiding it!',
    correctDecision: 'stop',
    explanation: 'Urgency framing and suppression conspiracy demand an immediate stop.',
    learningPoints: ['Urgency language is a System 1 hijack: Pause before reacting.'],
    sm2Tags: ['urgency-signals'],
    tests: ['skill.sift.stop'],
    heldOut: false
  };

  // Score correct decision for 'continue'
  const legitResult = SiftLabs._scoreResult(stopScenarioLegit, true, 1200);
  assert(legitResult.correct === true, 'SIFT Stop Lab correctly scores continue decision on legitimate claim');
  assert(siftMockApp.store.get('sift.stats').correct === 1, 'SIFT stats record correct decision increment');

  // Test SM-2 memory card generation contract
  let interceptedCards = null;
  const originalDispatch = typeof window !== 'undefined' ? window.dispatchEvent : null;
  globalThis.window = globalThis.window || {};
  globalThis.window.dispatchEvent = (event) => {
    if (event.type === 'aegis:sift-cards') {
      interceptedCards = event.detail?.cards;
    }
  };

  // Trigger incorrect result to invoke _enqueueMemoryCards
  SiftLabs._scoreResult(stopScenarioHostile, false, 2500);
  assert(Array.isArray(interceptedCards) && interceptedCards.length > 0, 'SIFT mistake generates SM-2 cards and dispatches aegis:sift-cards');

  const card0 = interceptedCards[0];
  assert(card0.domain === 'SIFT Verification', `Generated card has domain 'SIFT Verification': ${card0.domain}`);
  assert(typeof card0.prompt === 'string' && card0.prompt.length > 20, 'Generated card contains non-empty prompt');
  assert(typeof card0.diagnosis === 'string' && card0.diagnosis.startsWith('SIFT STOP'), `Generated card has diagnosis: ${card0.diagnosis}`);
  assert(typeof card0.latin === 'string' && card0.latin.length > 0, `Generated card has latin maxim: ${card0.latin}`);
  assert(typeof card0.mechanism === 'string' && card0.mechanism.length > 20, 'Generated card contains mechanism');
  assert(typeof card0.countermeasure === 'string' && card0.countermeasure.length > 10, 'Generated card contains countermeasure');
  assert(Array.isArray(card0.tests) && card0.tests.includes('skill.sift.stop'), 'Generated card contains skill test tag skill.sift.stop');
  assert(card0.repetitions === 0 && card0.interval === 0 && card0.easeFactor === 2.5, 'Generated card initializes with default SM-2 interval parameters');

  // Test verdict labels
  assert(SiftLabs._verdictLabel('domain_spoof') === '🌐 Domain Spoofing', 'Investigate lab verdict domain_spoof resolves correctly');
  assert(SiftLabs._verdictLabel('reliable') === '✅ Reliable Source', 'Investigate lab verdict reliable resolves correctly');

  // ----------------------------------------------------
  // TEST GROUP 5: Spaced Repetition (SM-2) Dynamic Enqueue & Hydration
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 5: Spaced Repetition (SM-2) Live Bridge ---');

  const sm2MockApp = {
    store: new StateStore(),
    showToast: () => {}
  };
  SpacedRepetition._app = sm2MockApp;
  SpacedRepetition._deck = [];

  // Enqueue cards
  SpacedRepetition.enqueueCards(interceptedCards);
  assert(SpacedRepetition._deck.length === interceptedCards.length, 'SpacedRepetition.enqueueCards adds cards into _deck');

  // Verify StateStore persistence
  const persistedDeckJson = sm2MockApp.store.get('sm2.deck');
  assert(Boolean(persistedDeckJson), 'SpacedRepetition persists deck to StateStore under sm2.deck');
  const parsedDeck = JSON.parse(persistedDeckJson);
  assert(parsedDeck.length === interceptedCards.length, 'Persisted deck matches enqueued count');

  // Deduplication check
  SpacedRepetition.enqueueCards(interceptedCards);
  assert(SpacedRepetition._deck.length === interceptedCards.length, 'Duplicate cards with same ID are not re-added');

  // Re-hydration check
  SpacedRepetition._deck = [];
  SpacedRepetition._hydrateDeckFromStore();
  assert(SpacedRepetition._deck.length === interceptedCards.length, '_hydrateDeckFromStore re-loads deck from StateStore');

  // Defensive handling of malformed / nullish / primitive card inputs
  let fuzzedThrew = false;
  try {
    SpacedRepetition.enqueueCards([null, undefined, 123, 'invalid', {}, { id: '' }, { id: '   ' }]);
  } catch (e) {
    fuzzedThrew = true;
  }
  assert(!fuzzedThrew, 'enqueueCards safely drops null, undefined, primitive, and empty id items without throwing');
  assert(SpacedRepetition._deck.length === interceptedCards.length, 'Deck length unchanged after dropping corrupt items');

  // Corrupt StateStore hydration defense
  sm2MockApp.store.set('sm2.deck', JSON.stringify([null, { id: 'valid-recovered-01' }, undefined, 'string-val', { id: '' }]));
  SpacedRepetition._hydrateDeckFromStore();
  assert(SpacedRepetition._deck.length === 1 && SpacedRepetition._deck[0].id === 'valid-recovered-01', '_hydrateDeckFromStore filters out null/corrupt entries from store');

  // Restore clean state
  sm2MockApp.store.set('sm2.deck', JSON.stringify(interceptedCards));
  SpacedRepetition._hydrateDeckFromStore();

  // Test queue building and domain filtering
  SpacedRepetition._filterDomain = 'all';
  SpacedRepetition._buildQueue();
  assert(SpacedRepetition._activeQueue.length === interceptedCards.length, '_buildQueue populates active review queue');

  SpacedRepetition._filterDomain = 'Logical Fallacy';
  SpacedRepetition._buildQueue();
  assert(SpacedRepetition._activeQueue.length === 0, '_buildQueue filters out non-matching domain cards');

  SpacedRepetition._filterDomain = 'SIFT Verification';
  SpacedRepetition._buildQueue();
  assert(SpacedRepetition._activeQueue.length === interceptedCards.length, '_buildQueue matches SIFT Verification domain cards');

  // ----------------------------------------------------
  // TEST GROUP 6: Rhetorical Sandbox Datasets & Engine
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 6: Rhetorical Sandbox Datasets & Engine ---');

  const rawArgs = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'rhetorical_arguments.json'), 'utf8'));
  assert(Array.isArray(rawArgs) && rawArgs.length === 6, `rhetorical_arguments.json contains 6 arguments (Actual: ${rawArgs.length})`);

  for (const arg of rawArgs) {
    // unstatedAssumption schema
    assert(typeof arg.unstatedAssumption === 'object' && arg.unstatedAssumption !== null, `Arg ${arg.id} unstatedAssumption is an object`);
    assert(typeof arg.unstatedAssumption.text === 'string' && arg.unstatedAssumption.text.length > 10, `Arg ${arg.id} unstatedAssumption has text`);
    assert(Array.isArray(arg.unstatedAssumption.distractors) && arg.unstatedAssumption.distractors.length >= 3, `Arg ${arg.id} unstatedAssumption has >= 3 distractors`);
    assert(typeof arg.unstatedAssumption.explanation === 'string' && arg.unstatedAssumption.explanation.length > 10, `Arg ${arg.id} unstatedAssumption has explanation`);

    // steelMannedVersion schema
    assert(typeof arg.steelMannedVersion === 'object' && arg.steelMannedVersion !== null, `Arg ${arg.id} steelMannedVersion is an object`);
    assert(typeof arg.steelMannedVersion.text === 'string' && arg.steelMannedVersion.text.length > 10, `Arg ${arg.id} steelMannedVersion has text`);
    assert(Array.isArray(arg.steelMannedVersion.improvements) && arg.steelMannedVersion.improvements.length >= 2, `Arg ${arg.id} steelMannedVersion has >= 2 improvements`);
    assert(Array.isArray(arg.steelMannedVersion.exercises) && arg.steelMannedVersion.exercises.length >= 1, `Arg ${arg.id} steelMannedVersion has >= 1 exercise`);

    for (const ex of arg.steelMannedVersion.exercises) {
      assert(typeof ex.id === 'string' && ex.id.length > 0, `Exercise ${ex.id} has ID`);
      assert(typeof ex.prompt === 'string' && ex.prompt.length > 10, `Exercise ${ex.id} has prompt`);
      assert(Array.isArray(ex.options) && ex.options.length === 4, `Exercise ${ex.id} has 4 options`);
      assert(typeof ex.correctIndex === 'number' && ex.correctIndex >= 0 && ex.correctIndex <= 3, `Exercise ${ex.id} has valid correctIndex`);
      assert(typeof ex.rationale === 'string' && ex.rationale.length > 10, `Exercise ${ex.id} has rationale`);
    }
  }

  // Rhetorical Sandbox Engine Unit Validation
  const sandboxMockApp = {
    store: new StateStore(),
    showToast: () => {}
  };
  RhetoricalSandbox._app = sandboxMockApp;
  RhetoricalSandbox._arguments = rawArgs;

  // Test loadArgument
  RhetoricalSandbox.loadArgument('arg-ai-risk');
  assert(RhetoricalSandbox._currentArg?.id === 'arg-ai-risk', 'RhetoricalSandbox.loadArgument loads requested argument');
  assert(RhetoricalSandbox._enthymemeOptions.length === 4, 'Enthymeme drill initializes 4 candidate options (1 correct + 3 distractors)');
  assert(RhetoricalSandbox._enthymemeOptions.filter(o => o.isCorrect).length === 1, 'Enthymeme drill contains exactly 1 correct option');
  assert(RhetoricalSandbox._steelmanOptions.length === 4, 'Socratic steel-manning drill initializes 4 options');

  // Test Enthymeme deduction evaluation & attempt logging
  const initialLogSize = await AttemptLog.count();
  const correctEnthymemeIdx = RhetoricalSandbox._enthymemeOptions.findIndex(o => o.isCorrect);
  assert(correctEnthymemeIdx !== -1, 'Correct enthymeme option index located');

  RhetoricalSandbox._selectedEnthymemeIdx = correctEnthymemeIdx;
  RhetoricalSandbox._submitEnthymemeDeduction();
  assert(RhetoricalSandbox._enthymemeUnlocked === true, 'Submitting enthymeme unlocks structural flaw diagnostic');
  
  await new Promise(r => setTimeout(r, 20));
  const postEnthymemeCount = await AttemptLog.count();
  assert(postEnthymemeCount === initialLogSize + 1, 'Enthymeme deduction logs attempt to AttemptLog');

  // Test Socratic Steel-manning exercise evaluation & attempt logging
  const correctSteelmanIdx = RhetoricalSandbox._steelmanOptions.findIndex(o => o.isCorrect);
  assert(correctSteelmanIdx !== -1, 'Correct steel-man option index located');

  RhetoricalSandbox._selectedSteelmanOptionIdx = correctSteelmanIdx;
  RhetoricalSandbox._submitSteelmanExercise();
  assert(RhetoricalSandbox._steelmanSubmitted === true, 'Submitting steel-man exercise marks submission');
  
  await new Promise(r => setTimeout(r, 20));
  const postSteelmanCount = await AttemptLog.count();
  assert(postSteelmanCount === initialLogSize + 2, 'Socratic steel-manning exercise logs attempt to AttemptLog');

  // Test State Persistence
  const savedState = sandboxMockApp.store.get('rhetoric.state');
  assert(savedState?.activeArgId === 'arg-ai-risk', 'RhetoricalSandbox state persisted activeArgId to StateStore');
  assert(savedState?.enthymemeUnlocked === true, 'RhetoricalSandbox state persisted enthymemeUnlocked to StateStore');

  // Test Custom Argument Ingestion
  RhetoricalSandbox.loadCustomArgument('All algorithms manipulate human dopamine. Human agency is therefore an illusion.');
  assert(RhetoricalSandbox._isCustom === true, 'loadCustomArgument sets isCustom flag');
  assert(RhetoricalSandbox._currentArg.clauses.length === 2, 'loadCustomArgument splits sentences into clauses');
  assert(RhetoricalSandbox._enthymemeOptions.length === 4, 'Custom argument generates dynamic enthymeme options');
  assert(RhetoricalSandbox._steelmanOptions.length === 4, 'Custom argument generates dynamic steelman options');

  // ----------------------------------------------------
  // TEST GROUP 7: Competency Tracking for Pillar I Skills
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 7: Bayesian Competency Tracking ---');

  const allAttempts = await AttemptLog.readAll();
  const fallacyEst = estimate(allAttempts, 'skill.fallacy.structure');
  assert(fallacyEst.n >= 2, `Bayesian competency tracks attempts for skill.fallacy.structure (n: ${fallacyEst.n})`);
  assert(fallacyEst.mastery > 0.5, `Mastery for skill.fallacy.structure reflects correct attempts: ${fallacyEst.mastery.toFixed(3)}`);

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite uncaught failure:', err);
  process.exit(1);
});
