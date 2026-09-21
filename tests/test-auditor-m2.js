/**
 * SOVEREIGN // AEGIS — Forensic Auditor 2.0 Test Suite for Milestone 2
 * Deep Adversarial Integrity & Edge-Case Verification
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// In-memory IndexedDB stub for headless Node test environment
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

import { VerdadEngine } from '../js/modules/verdad.js';
import { recordAttempt, CONTEXTS } from '../js/attempts.js';
import { AttemptLog } from '../js/attemptlog.js';

const sourcesJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data', 'sources.json'), 'utf8'));
const fallaciesJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data', 'fallacies.json'), 'utf8'));
const verdadRulesJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data', 'verdad_rules.json'), 'utf8'));

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ [FAIL] ${msg}`);
  }
}

console.log('=== FORENSIC AUDITOR INDEPENDENT TEST BATTERY: MILESTONE 2 ===\n');

// 1. Edge Case Domain Parsing
console.log('--- 1. Domain Extraction Robustness & False Positive Resistance ---');
const edgeInputs = [
  { input: 'Download file.pdf or image.png from site https://archive.org/details/test?q=1#sec', expected: ['archive.org'] },
  { input: 'Email user@bbc.co.uk regarding report on nytimes.com and https://sub.propublica.org:443/data.json', expected: ['bbc.co.uk', 'nytimes.com', 'sub.propublica.org'] },
  { input: 'Variables like obj.property or a.length or config.ts should not be parsed as domains', expected: [] },
  { input: 'Multiple protocols: http://reuters.com and https://apnews.com and //ignored and www.snopes.com', expected: ['reuters.com', 'apnews.com', 'snopes.com'] }
];

for (const tc of edgeInputs) {
  const extracted = VerdadEngine.extractDomains(tc.input);
  for (const exp of tc.expected) {
    assert(extracted.includes(exp), `Extracted expected domain "${exp}" from "${tc.input.slice(0, 40)}..."`);
  }
  for (const ext of ['pdf', 'png', 'ts', 'property', 'length']) {
    assert(!extracted.some(d => d.endsWith(`.${ext}`)), `Ignored non-domain extension .${ext}`);
  }
}

// 2. Source Matching Hierarchy & Admiralty Scale
console.log('\n--- 2. Source Matching Subdomain Resolution & Fallbacks ---');
const subMatch = VerdadEngine.matchSources(['edition.cnn.com', 'world.bbc.com', 'nonexistent-shadow-outlet.org'], sourcesJson);
assert(subMatch.length === 3, 'Matched 3 queries');
assert(subMatch[0].domain === 'cnn.com' || subMatch[0].name.includes('CNN'), 'Resolved edition.cnn.com to CNN record');
assert(subMatch[0].admiraltyRating === 'C2' || subMatch[0].admiraltyRating === 'C3', 'CNN has C rating');
assert(subMatch[1].domain === 'bbc.com' || subMatch[1].name.includes('BBC'), 'Resolved world.bbc.com to BBC record');
assert(subMatch[1].admiraltyRating === 'A1', 'BBC has A1 rating');
assert(subMatch[2].matched === false, 'Non-existent outlet marked unmatched');
assert(subMatch[2].admiraltyRating === 'F6', 'Non-existent outlet assigned F6');

// 3. Fallacy Meta Resolution Robustness
console.log('\n--- 3. Fallacy Meta Resolution & Fallback Robustness ---');
const knownMeta = VerdadEngine.getFallacyMeta('fallacy-ad-hominem', 'Ad Hominem', fallaciesJson);
assert(knownMeta.latin === 'Argumentum ad Hominem', 'Ad Hominem latin nomenclature resolved');
assert(typeof knownMeta.explanation === 'string' && knownMeta.explanation.length > 10, 'Ad Hominem explanation populated');

const customMeta = VerdadEngine.getFallacyMeta('unknown-fallacy-999', 'Quantum Delusion', fallaciesJson);
assert(customMeta.latin === 'Non Sequitur', 'Unknown fallacy defaults gracefully to Non Sequitur');
assert(customMeta.name === 'Quantum Delusion', 'Preserves provided fallacy name');

// 4. Adversarial Reframing Invariance & Structural Soundness
console.log('\n--- 4. Adversarial Reframing Generator Stress Testing ---');
const emptyReframing = VerdadEngine.generateAdversarialReframings('');
assert(typeof emptyReframing.outrageMaximizer === 'object', 'Handles empty input string');
assert(emptyReframing.outrageMaximizer.vulnerabilityOptions.length === 4, 'Outrage options count is 4');
assert(emptyReframing.falseConsensus.vulnerabilityOptions.length === 4, 'Consensus options count is 4');
assert(emptyReframing.inGroupThreat.vulnerabilityOptions.length === 4, 'InGroup options count is 4');

const longClaim = 'A'.repeat(5000) + ' breaking news on inflation and prices';
const longReframing = VerdadEngine.generateAdversarialReframings(longClaim);
assert(typeof longReframing.outrageMaximizer.headline === 'string', 'Handles 5000 character string without crashing');

// 5. Dialectic Numerical Bounds & Math Integrity
console.log('\n--- 5. Epistemic Dialectic Numerical Bounds ---');
const stressCases = [
  '',
  '   ',
  'normal factual text with no emotional words whatsoever',
  'SHAMEFUL OUTRAGEOUS TREASONOUS CORRUPT DISGUSTING VILE SCANDAL TOXIC LETHAL CATASTROPHE APOCALYPSE ACT NOW BREAKING CRITICAL ALERT PATRIOTS TRUE INFILTRATORS CABAL DEEP STATE COVERUP PUPPET MASTERS HOPELESS DOOMED POINTLESS RIGGED SYSTEM 100% PROVEN ABSOLUTE CERTAINTY INDISPUTABLE FACT'
];

for (const txt of stressCases) {
  const res = VerdadEngine.runOfflineHeuristics(txt, verdadRulesJson, sourcesJson, fallaciesJson);
  assert(res.veracityScore >= 0 && res.veracityScore <= 100, `Veracity score (${res.veracityScore}) in [0, 100]`);
  assert(res.manipulationRisk >= 0 && res.manipulationRisk <= 100, `Manipulation risk (${res.manipulationRisk}) in [0, 100]`);
  assert(!Number.isNaN(res.veracityScore), 'Veracity score is not NaN');
  assert(!Number.isNaN(res.manipulationRisk), 'Manipulation risk is not NaN');
  assert(!Number.isNaN(res.step3_epistemics.hedgingRatio), 'Hedging ratio is not NaN');
  assert(!Number.isNaN(res.step3_epistemics.certaintyInflation), 'Certainty inflation is not NaN');
  assert(['block', 'caution', 'share'].includes(res.step5_synthesis.recommendation), `Valid recommendation: ${res.step5_synthesis.recommendation}`);
}

// 6. AttemptLog & Context Verification
console.log('\n--- 6. AttemptLog Persistence & Context Verification ---');
await recordAttempt({
  skillIds: ['skill.tactic.emotive-framing', 'skill.fallacy.appeals'],
  itemId: 'adversarial-outrageMaximizer-auditor',
  correct: true,
  context: CONTEXTS.SANDBOX,
  latencyMs: 820
});

const recentAttempts = await AttemptLog.readAll();
assert(recentAttempts.length > 0, 'Query retrieved attempt records from AttemptLog');
assert(recentAttempts.some(a => a.itemId === 'adversarial-outrageMaximizer-auditor' && a.context === 'sandbox'), 'Found specific auditor item with context sandbox in AttemptLog');

console.log('\n====================================================');
console.log(`Auditor Verification Summary: ${passed} Passed, ${failed} Failed`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
}
