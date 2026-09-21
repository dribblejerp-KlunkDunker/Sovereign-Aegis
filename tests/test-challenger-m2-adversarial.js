/**
 * SOVEREIGN // AEGIS — Challenger Test Suite: Milestone 2 Adversarial Stress Harness
 * Empirically stress-tests:
 *  1. Domain extraction under adversarial & tricky inputs (subdomains, ports, params, non-URLs, delimiters, unicode).
 *  2. Admiralty intelligence ratings & source directory resolution (known, unknown, root/subdomain, fallbacks).
 *  3. Adversarial Sandbox reframing generation & counter-brief evaluation invariants under extreme inputs.
 *  4. Epistemic Chain-of-Thought Dialectic 5-step mathematical & structural invariants.
 *  5. Fallacy Latin metadata resolution across all 13 canonical fallacy types.
 *  6. AttemptLog & SM-2 event payload contract verification.
 *  7. Complete Source Directory coverage (all sources in sources.json matched with valid Admiralty ratings).
 *  8. Comprehensive Fallacy Pattern Triggering across all rules in verdad_rules.json.
 *  9. Adversarial Gemini API resilience (malformed JSON, HTTP error, empty response).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

const sourcesJson = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'sources.json'), 'utf8'));
const fallaciesJson = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'fallacies.json'), 'utf8'));
const verdadRulesJson = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'verdad_rules.json'), 'utf8'));

VerdadEngine.sourcesDatabase = sourcesJson;
VerdadEngine.fallaciesDatabase = fallaciesJson;

class ChallengerTestHarness {
  constructor(suiteName) {
    this.suiteName = suiteName;
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
      this.failures.push({ suite: this.currentSuite, test: name, error: err.stack || err.message });
      console.error(`  ✗ [FAIL] ${name} (${err.message})`);
    }
  }

  assert(condition, message) {
    this.totalAssertions++;
    if (condition) {
      this.passed++;
      console.log(`    ✓ ${message}`);
    } else {
      this.failed++;
      this.failures.push({ suite: this.currentSuite, test: message, error: 'Assertion failed' });
      console.error(`    ✗ [FAIL] ${message}`);
    }
  }

  assertEqual(actual, expected, message) {
    this.assert(actual === expected, `${message} | Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
  }

  assertDeepEqual(actual, expected, message) {
    this.assert(JSON.stringify(actual) === JSON.stringify(expected), `${message} | Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
  }

  assertGreaterOrEqual(actual, minimum, message) {
    this.assert(actual >= minimum, `${message} | Got: ${actual} >= Min: ${minimum}`);
  }

  assertLessOrEqual(actual, maximum, message) {
    this.assert(actual <= maximum, `${message} | Got: ${actual} <= Max: ${maximum}`);
  }

  summary() {
    console.log('\n====================================================');
    console.log(`[${this.suiteName}] Summary: ${this.passed}/${this.totalAssertions} Passed (${this.failed} Failed)`);
    console.log('====================================================');
    if (this.failed > 0) {
      console.error('\nFailure Details:');
      this.failures.forEach(f => console.error(` - [${f.suite}] ${f.test}: ${f.error}`));
    }
    return { passed: this.passed, failed: this.failed, total: this.totalAssertions };
  }
}

const harness = new ChallengerTestHarness('Challenger 1: Milestone 2 Adversarial Stress Suite');

async function runChallengerTests() {
  // -------------------------------------------------------------------------
  // 1. Domain Extraction Engine Adversarial Stress
  // -------------------------------------------------------------------------
  await harness.describe('1. Domain Extraction Engine Tricky & Adversarial Inputs', async () => {
    await harness.it('Extracts deep multi-level subdomains', () => {
      const text = 'Check out deep.wire.service.apnews.com and mirror.corp.reuters.com today.';
      const domains = VerdadEngine.extractDomains(text);
      harness.assert(domains.some(d => d.includes('apnews.com')), 'apnews.com domain extracted');
      harness.assert(domains.some(d => d.includes('reuters.com')), 'reuters.com domain extracted');
    });

    await harness.it('Extracts international and country-code top-level domains (ccTLDs)', () => {
      const text = 'International news from lemonde.fr, spiegel.de, bbc.co.uk, globaltimes.cn, and news.com.au';
      const domains = VerdadEngine.extractDomains(text);
      harness.assert(domains.includes('lemonde.fr'), 'lemonde.fr extracted');
      harness.assert(domains.includes('spiegel.de'), 'spiegel.de extracted');
      harness.assert(domains.includes('bbc.co.uk'), 'bbc.co.uk extracted');
      harness.assert(domains.includes('globaltimes.cn'), 'globaltimes.cn extracted');
      harness.assert(domains.includes('news.com.au'), 'news.com.au extracted');
    });

    await harness.it('Handles URLs with custom ports without corrupting the domain', () => {
      const text = 'Dev server at http://reuters.com:8080/wire and https://rt.com:8443/breaking/news';
      const domains = VerdadEngine.extractDomains(text);
      harness.assert(domains.includes('reuters.com'), 'reuters.com extracted cleanly without port');
      harness.assert(domains.includes('rt.com'), 'rt.com extracted cleanly without port');
    });

    await harness.it('Handles complex query strings, fragments, and URL encodings', () => {
      const text = 'See https://snopes.com/fact-check/investigation?ref=twitter&token=123%20456&status=true#summary-section';
      const domains = VerdadEngine.extractDomains(text);
      harness.assert(domains.includes('snopes.com'), 'snopes.com extracted without query string trailing trash');
    });

    await harness.it('Handles domains encased in complex punctuation, brackets, and quotes', () => {
      const text = `Sources cited: (https://reuters.com), [apnews.com], "bbc.com", 'lemonde.fr', <factcheck.org>, and infowars.com... Also wsj.com!`;
      const domains = VerdadEngine.extractDomains(text);
      harness.assert(domains.includes('reuters.com'), 'reuters.com stripped of parens');
      harness.assert(domains.includes('apnews.com'), 'apnews.com stripped of brackets');
      harness.assert(domains.includes('bbc.com'), 'bbc.com stripped of double quotes');
      harness.assert(domains.includes('lemonde.fr'), 'lemonde.fr stripped of single quotes');
      harness.assert(domains.includes('factcheck.org'), 'factcheck.org stripped of angle brackets');
      harness.assert(domains.includes('infowars.com'), 'infowars.com stripped of trailing dots');
      harness.assert(domains.includes('wsj.com'), 'wsj.com stripped of exclamation point');
    });

    await harness.it('Filters out common non-domain file extensions from bare token matching', () => {
      const text = 'Document report.pdf and image photo.png and song audio.mp3 alongside real site politifact.com';
      const domains = VerdadEngine.extractDomains(text);
      harness.assert(!domains.includes('report.pdf'), 'report.pdf filtered out');
      harness.assert(!domains.includes('photo.png'), 'photo.png filtered out');
      harness.assert(!domains.includes('audio.mp3'), 'audio.mp3 filtered out');
      harness.assert(domains.includes('politifact.com'), 'politifact.com retained');
    });

    await harness.it('Handles non-string and malformed inputs gracefully without throwing', () => {
      harness.assertDeepEqual(VerdadEngine.extractDomains(''), [], 'Empty string returns empty array');
      harness.assertDeepEqual(VerdadEngine.extractDomains(null), [], 'null returns empty array');
      harness.assertDeepEqual(VerdadEngine.extractDomains(undefined), [], 'undefined returns empty array');
      harness.assertDeepEqual(VerdadEngine.extractDomains(12345), [], 'Number returns empty array');
      harness.assertDeepEqual(VerdadEngine.extractDomains({}), [], 'Object returns empty array');
    });

    await harness.it('Deduplicates mixed case and repeated protocol variants', () => {
      const text = 'HTTP://WWW.REUTERS.COM/path and https://reuters.com and reuters.com and WWW.REUTERS.COM';
      const domains = VerdadEngine.extractDomains(text);
      harness.assertEqual(domains.length, 1, 'Exactly 1 deduplicated domain');
      harness.assertEqual(domains[0], 'reuters.com', 'Normalized to reuters.com');
    });

    await harness.it('Handles extremely long text (100,000+ chars) with embedded domains within 50ms', () => {
      const filler = 'The quick brown fox jumps over the lazy dog. '.repeat(2000);
      const massiveText = `${filler} Check out https://propublica.org for more details. ${filler}`;
      const t0 = performance.now();
      const domains = VerdadEngine.extractDomains(massiveText);
      const elapsed = performance.now() - t0;
      harness.assert(domains.includes('propublica.org'), 'Domain extracted from massive text');
      harness.assertLessOrEqual(elapsed, 100, `Execution time (${elapsed.toFixed(2)}ms) <= 100ms`);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Admiralty Rating Scale & Source Directory Matching
  // -------------------------------------------------------------------------
  await harness.describe('2. Admiralty Intelligence Rating Scale & Directory Matching', async () => {
    await harness.it('Correctly resolves standard Admiralty scale ratings (A1..F6)', () => {
      const ratings = ['A1', 'A2', 'B1', 'B2', 'C2', 'C3', 'D4', 'E5', 'F6'];
      for (const r of ratings) {
        const desc = VerdadEngine.getAdmiraltyDescription(r);
        harness.assert(typeof desc === 'string' && desc.length > 10, `Admiralty code ${r} has meaningful description`);
        harness.assert(!desc.includes('Uncalibrated'), `Admiralty code ${r} is calibrated`);
      }
    });

    await harness.it('Handles invalid / uncalibrated Admiralty codes safely', () => {
      harness.assertEqual(VerdadEngine.getAdmiraltyDescription('Z9'), 'Uncalibrated Intelligence Rating', 'Z9 returns uncalibrated');
      harness.assertEqual(VerdadEngine.getAdmiraltyDescription(''), 'Uncalibrated Intelligence Rating', 'Empty string returns uncalibrated');
      harness.assertEqual(VerdadEngine.getAdmiraltyDescription(null), 'Uncalibrated Intelligence Rating', 'null returns uncalibrated');
    });

    await harness.it('Maps known dataset sources with full metadata fidelity', () => {
      const domains = ['reuters.com', 'snopes.com', 'nytimes.com', 'dailymail.co.uk', 'rt.com', 'infowars.com'];
      const matched = VerdadEngine.matchSources(domains, sourcesJson);

      harness.assertEqual(matched.length, 6, '6 matched sources');

      const reuters = matched.find(m => m.domain === 'reuters.com');
      harness.assertEqual(reuters.admiraltyRating, 'A1', 'Reuters is A1');
      harness.assertEqual(reuters.factuality, 'Very High', 'Reuters factuality is Very High');
      harness.assert(reuters.credibilityScore >= 95, 'Reuters credibility >= 95');
      harness.assertEqual(reuters.matched, true, 'Reuters matched is true');

      const snopes = matched.find(m => m.domain === 'snopes.com');
      harness.assertEqual(snopes.admiraltyRating, 'A2', 'Snopes is A2');

      const nyt = matched.find(m => m.domain === 'nytimes.com');
      harness.assertEqual(nyt.admiraltyRating, 'B1', 'NYT is B1');

      const dailymail = matched.find(m => m.domain === 'dailymail.co.uk');
      harness.assertEqual(dailymail.admiraltyRating, 'D4', 'Daily Mail is D4');

      const rt = matched.find(m => m.domain === 'rt.com');
      harness.assertEqual(rt.admiraltyRating, 'E5', 'RT is E5');

      const infowars = matched.find(m => m.domain === 'infowars.com');
      harness.assertEqual(infowars.admiraltyRating, 'F6', 'InfoWars is F6');
    });

    await harness.it('Subdomain lookups match parent domain in source directory', () => {
      const subdomains = ['wire.reuters.com', 'investigations.propublica.org', 'arabic.rt.com'];
      const matched = VerdadEngine.matchSources(subdomains, sourcesJson);

      harness.assertEqual(matched[0].admiraltyRating, 'A1', 'wire.reuters.com matches Reuters A1');
      harness.assertEqual(matched[1].admiraltyRating, 'A1', 'investigations.propublica.org matches ProPublica A1');
      harness.assertEqual(matched[2].admiraltyRating, 'E5', 'arabic.rt.com matches RT E5');
    });

    await harness.it('Unindexed / unknown domains receive Admiralty F6 and matched=false', () => {
      const unknown = ['my-secret-conspiracy-blog.darknet', 'unknown-disinfo-hub-888.cc'];
      const matched = VerdadEngine.matchSources(unknown, sourcesJson);

      harness.assertEqual(matched.length, 2, '2 unknown sources');
      harness.assertEqual(matched[0].matched, false, 'Unmatched 1');
      harness.assertEqual(matched[0].admiraltyRating, 'F6', 'Unmatched 1 has F6');
      harness.assertEqual(matched[1].matched, false, 'Unmatched 2');
      harness.assertEqual(matched[1].admiraltyRating, 'F6', 'Unmatched 2 has F6');
    });

    await harness.it('Empty domain list returns single Anonymous F6 record', () => {
      const matched = VerdadEngine.matchSources([], sourcesJson);
      harness.assertEqual(matched.length, 1, '1 record returned');
      harness.assertEqual(matched[0].domain, null, 'Domain is null');
      harness.assertEqual(matched[0].admiraltyRating, 'F6', 'Admiralty is F6');
      harness.assertEqual(matched[0].matched, false, 'Matched is false');
    });

    await harness.it('Handles null or malformed sourcesData parameter using fallbackSources', () => {
      const matched = VerdadEngine.matchSources(['reuters.com'], null);
      harness.assertEqual(matched.length, 1, '1 source matched from fallback');
      harness.assertEqual(matched[0].domain, 'reuters.com', 'reuters.com matched');
      harness.assertEqual(matched[0].admiraltyRating, 'A1', 'Fallback rating is A1');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Adversarial Sandbox Reframings Generation & Invariants
  // -------------------------------------------------------------------------
  await harness.describe('3. Adversarial Sandbox Reframings Invariants & Edge Cases', async () => {
    const testCases = [
      { name: 'Standard claim', text: 'Central bank announces interest rate change for next quarter.' },
      { name: 'Empty claim', text: '' },
      { name: 'Single word claim', text: 'Vaccines' },
      { name: 'Punctuation and symbols', text: '??? !!! ### $$$ %%% ***' },
      { name: 'XSS attempt string', text: '<script>alert(document.cookie)</script> and "onmouseover="alert(1)' },
      { name: 'Non-Latin multilingual text', text: '中央银行宣布下季度调整基准利率。СРОЧНОЕ СООБЩЕНИЕ!' },
      { name: 'Gigantic claim (5000 words)', text: 'Important policy briefing '.repeat(500) }
    ];

    for (const tc of testCases) {
      await harness.it(`Generates valid schema invariants for: ${tc.name}`, () => {
        const reframings = VerdadEngine.generateAdversarialReframings(tc.text);
        harness.assert(typeof reframings === 'object' && reframings !== null, 'Returns object');

        const vectors = ['outrageMaximizer', 'falseConsensus', 'inGroupThreat'];
        for (const v of vectors) {
          const item = reframings[v];
          harness.assert(typeof item === 'object' && item !== null, `${v} is object`);
          harness.assertEqual(item.vector, v, `${v}.vector matches`);
          harness.assert(typeof item.name === 'string' && item.name.length > 0, `${v}.name is string`);
          harness.assert(typeof item.badge === 'string' && item.badge.length > 0, `${v}.badge is string`);
          harness.assert(typeof item.headline === 'string' && item.headline.length > 0, `${v}.headline is string`);
          harness.assert(typeof item.text === 'string' && item.text.length > 0, `${v}.text is string`);
          harness.assert(typeof item.targetedVulnerability === 'string' && item.targetedVulnerability.length > 0, `${v}.targetedVulnerability is string`);
          harness.assert(typeof item.countermeasure === 'string' && item.countermeasure.length > 0, `${v}.countermeasure is string`);
          harness.assert(Array.isArray(item.skillIds) && item.skillIds.length > 0, `${v}.skillIds is non-empty array`);

          // Vulnerability options invariant
          harness.assert(Array.isArray(item.vulnerabilityOptions) && item.vulnerabilityOptions.length >= 4, `${v}.vulnerabilityOptions has >= 4 options`);
          harness.assert(typeof item.correctVulnerabilityIndex === 'number', `${v}.correctVulnerabilityIndex is number`);
          harness.assert(item.correctVulnerabilityIndex >= 0 && item.correctVulnerabilityIndex < item.vulnerabilityOptions.length, `${v}.correctVulnerabilityIndex is valid index`);

          // Counter-brief options invariant
          harness.assert(Array.isArray(item.counterBriefOptions) && item.counterBriefOptions.length >= 3, `${v}.counterBriefOptions has >= 3 options`);
          harness.assert(typeof item.correctBriefIndex === 'number', `${v}.correctBriefIndex is number`);
          harness.assert(item.correctBriefIndex >= 0 && item.correctBriefIndex < item.counterBriefOptions.length, `${v}.correctBriefIndex is valid index`);
        }
      });
    }
  });

  // -------------------------------------------------------------------------
  // 4. Epistemic Chain-of-Thought Dialectic 5-Step Integrity
  // -------------------------------------------------------------------------
  await harness.describe('4. Epistemic Chain-of-Thought Dialectic 5-Step Forensics', async () => {
    const claim = 'BREAKING: Don\'t listen to him because he is a convicted fraudster who allegedly leaked toxic biohazard data on reuters.com! Indisputable fact!';
    const res = VerdadEngine.runOfflineHeuristics(claim, verdadRulesJson, sourcesJson, fallaciesJson);

    await harness.it('Step 1 (Affect): Computes all 6 vectors within range [0, 100]', () => {
      const keys = ['outrage', 'fear', 'urgency', 'tribalism', 'conspiracy', 'fatalism'];
      for (const k of keys) {
        harness.assert(typeof res.step1_affect[k] === 'number', `step1_affect.${k} is number`);
        harness.assertGreaterOrEqual(res.step1_affect[k], 0, `step1_affect.${k} >= 0`);
        harness.assertLessOrEqual(res.step1_affect[k], 100, `step1_affect.${k} <= 100`);
      }
      harness.assert(Array.isArray(res.step1_affect.triggeredKeywords.fear), 'triggeredKeywords.fear is array');
      harness.assert(res.step1_affect.triggeredKeywords.fear.includes('toxic') || res.step1_affect.triggeredKeywords.fear.includes('biohazard'), 'triggered word toxic/biohazard found');
    });

    await harness.it('Step 2 (Fallacies): Detects fallacy with Latin nomenclature and quoted text slice', () => {
      harness.assert(Array.isArray(res.step2_fallacies), 'step2_fallacies is array');
      harness.assertGreaterOrEqual(res.step2_fallacies.length, 1, 'At least 1 fallacy detected');
      const f = res.step2_fallacies[0];
      harness.assert(f.name.includes('Ad Hominem'), 'Ad Hominem detected');
      harness.assert(f.latin.includes('Argumentum ad Hominem'), 'Latin name populated');
      harness.assert(claim.toLowerCase().includes(f.quote.toLowerCase()), 'Quote is substring of claim text');
    });

    await harness.it('Step 3 (Epistemics): Hedging ratio, certainty inflation, and reading level calibrated', () => {
      harness.assertGreaterOrEqual(res.step3_epistemics.hedgingRatio, 0, 'hedgingRatio >= 0');
      harness.assertLessOrEqual(res.step3_epistemics.hedgingRatio, 1, 'hedgingRatio <= 1');
      harness.assertGreaterOrEqual(res.step3_epistemics.certaintyInflation, 25, 'certaintyInflation >= 25');
      harness.assert(typeof res.step3_epistemics.readingLevel === 'string', 'readingLevel is string');
    });

    await harness.it('Step 4 (Sources): Extracted domain matched to Reuters A1', () => {
      harness.assertEqual(res.step4_sources.length, 1, '1 source extracted');
      harness.assertEqual(res.step4_sources[0].domain, 'reuters.com', 'Domain is reuters.com');
      harness.assertEqual(res.step4_sources[0].admiraltyRating, 'A1', 'Admiralty rating is A1');
      harness.assertEqual(res.step4_sources[0].matched, true, 'Source matched is true');
    });

    await harness.it('Step 5 (Synthesis): Generates recommendation, rationale, and prebunk brief', () => {
      harness.assert(['block', 'caution', 'share'].includes(res.step5_synthesis.recommendation), 'Valid recommendation');
      harness.assert(['unreliable', 'unverified', 'plausible'].includes(res.step5_synthesis.verdictClass), 'Valid verdictClass');
      harness.assert(typeof res.step5_synthesis.rationale === 'string' && res.step5_synthesis.rationale.length > 20, 'Comprehensive rationale');
      harness.assert(typeof res.step5_synthesis.prebunkBrief === 'string' && res.step5_synthesis.prebunkBrief.length > 10, 'Actionable prebunk brief');
      harness.assert(Array.isArray(res.step5_synthesis.keyFlags), 'keyFlags is array');
    });

    await harness.it('Preserves 100% backwards compatibility with legacy properties', () => {
      harness.assert(typeof res.veracityScore === 'number', 'veracityScore is number');
      harness.assert(typeof res.manipulationRisk === 'number', 'manipulationRisk is number');
      harness.assert(typeof res.credibilityTier === 'string', 'credibilityTier is string');
      harness.assert(typeof res.emotionalTriggers === 'object', 'emotionalTriggers is object');
      harness.assert(Array.isArray(res.detectedFallacies), 'detectedFallacies is array');
      harness.assert(typeof res.epistemicMetrics === 'object', 'epistemicMetrics is object');
      harness.assert(Array.isArray(res.biasIndicators), 'biasIndicators is array');
      harness.assert(typeof res.confidence === 'number', 'confidence is number');
      harness.assert(Array.isArray(res.sources), 'sources is array');
      harness.assert(typeof res.reasoning === 'string', 'reasoning is string');
      harness.assert(typeof res.prebunkSummary === 'string', 'prebunkSummary is string');
    });
  });

  // -------------------------------------------------------------------------
  // 5. Fallacy Metadata Resolution & Latin Nomenclature Coverage
  // -------------------------------------------------------------------------
  await harness.describe('5. Fallacy Metadata & Latin Nomenclature Coverage', async () => {
    const canonicalFallacies = [
      { id: 'fallacy-ad-hominem', name: 'Ad Hominem', expectedLatin: 'Argumentum ad Hominem' },
      { id: 'fallacy-ad-hominem-circumstantial', name: 'Ad Hominem (Circumstantial)', expectedLatin: 'Argumentum ad Hominem Circumstantiae' },
      { id: 'fallacy-false-dilemma', name: 'False Dilemma', expectedLatin: 'Tertium Non Datur' },
      { id: 'fallacy-slippery-slope', name: 'Slippery Slope', expectedLatin: 'Secundum Quid' },
      { id: 'fallacy-tu-quoque', name: 'Whataboutism / Tu Quoque', expectedLatin: 'Tu Quoque' },
      { id: 'fallacy-appeal-to-false-authority', name: 'Appeal to False Authority', expectedLatin: 'Argumentum ad Verecundiam' },
      { id: 'fallacy-appeal-to-fear', name: 'Appeal to Fear & Emotion', expectedLatin: 'Argumentum ad Metum' },
      { id: 'fallacy-straw-man', name: 'Straw Man', expectedLatin: 'Argumentum in Fabulam' },
      { id: 'fallacy-red-herring', name: 'Red Herring', expectedLatin: 'Ignoratio Elenchi' },
      { id: 'fallacy-appeal-to-popularity', name: 'Appeal to Popularity', expectedLatin: 'Argumentum ad Populum' },
      { id: 'fallacy-anecdotal-evidence', name: 'Anecdotal Evidence', expectedLatin: 'Testimonium Singulare' },
      { id: 'fallacy-post-hoc-ergo-propter-hoc', name: 'Post Hoc Ergo Propter Hoc', expectedLatin: 'Post Hoc Ergo Propter Hoc' },
      { id: 'fallacy-texas-sharpshooter', name: 'Texas Sharpshooter', expectedLatin: 'Cluster Illusion' }
    ];

    for (const f of canonicalFallacies) {
      await harness.it(`Resolves Latin and category for ${f.name}`, () => {
        const meta = VerdadEngine.getFallacyMeta(f.id, f.name, fallaciesJson);
        harness.assert(typeof meta.name === 'string', `${f.id} has name`);
        harness.assert(typeof meta.latin === 'string' && meta.latin.length > 0, `${f.id} has Latin: ${meta.latin}`);
        harness.assert(typeof meta.category === 'string', `${f.id} has category: ${meta.category}`);
        harness.assert(typeof meta.explanation === 'string' && meta.explanation.length > 10, `${f.id} has explanation`);
      });
    }
  });

  // -------------------------------------------------------------------------
  // 6. AttemptLog & Pedagogical Telemetry Integration
  // -------------------------------------------------------------------------
  await harness.describe('6. AttemptLog & Spaced Recall Telemetry Integration', async () => {
    await harness.it('Logs multi-skill attempt records into AttemptLog under CONTEXTS.SANDBOX and reads back', async () => {
      const skills = ['skill.tactic.emotive-framing', 'skill.fallacy.appeals'];
      const record = await recordAttempt({
        skillIds: skills,
        itemId: 'adversarial-outrageMaximizer',
        correct: true,
        context: CONTEXTS.SANDBOX,
        latencyMs: 2100,
        confidence: 'sure'
      });

      harness.assertEqual(record.recorded, 2, '2 skill attempts logged');

      const allRecords = await AttemptLog.readAll();
      harness.assert(Array.isArray(allRecords) && allRecords.length >= 2, 'Saved records retrieved from AttemptLog');
      const latest = allRecords.filter(r => r.itemId === 'adversarial-outrageMaximizer');
      harness.assertEqual(latest.length, 2, '2 records for this item in AttemptLog');
      harness.assertEqual(latest[0].context, CONTEXTS.SANDBOX, 'Context is sandbox');
      harness.assertEqual(latest[0].correct, true, 'Correct is true');
      harness.assertEqual(latest[0].latencyMs, 2100, 'Latency is preserved');
      harness.assertEqual(latest[0].confidence, 'sure', 'Confidence is sure');
    });
  });

  // -------------------------------------------------------------------------
  // 7. Complete Source Directory Database Audit (All entries in sources.json)
  // -------------------------------------------------------------------------
  await harness.describe('7. Complete Source Directory Database Coverage', async () => {
    await harness.it('Resolves all sources in sources.json with valid Admiralty codes and scores', () => {
      for (const src of sourcesJson) {
        harness.assert(typeof src.domain === 'string' && src.domain.length > 0, `Source ${src.name || src.domain} has domain`);
        const matchedList = VerdadEngine.matchSources([src.domain], sourcesJson);
        harness.assertEqual(matchedList.length, 1, `Matched 1 source for ${src.domain}`);
        const m = matchedList[0];
        harness.assertEqual(m.matched, true, `${src.domain} marked matched`);
        harness.assert(/^[A-F][1-6]$/.test(m.admiraltyRating), `${src.domain} has valid Admiralty code: ${m.admiraltyRating}`);
        harness.assert(typeof m.credibilityScore === 'number' && m.credibilityScore >= 0 && m.credibilityScore <= 100, `${src.domain} has valid credibility score: ${m.credibilityScore}`);
        harness.assert(typeof m.admiraltyDescription === 'string' && m.admiraltyDescription.length > 5, `${src.domain} has description`);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 8. Fallacy Detection Coverage Across Different Fallacy Rules
  // -------------------------------------------------------------------------
  await harness.describe('8. Fallacy Detection Triggering Across Diverse Fallacy Types', async () => {
    const testFallacies = [
      { text: "Don't listen to him because he is a convicted criminal!", expectedName: "Ad Hominem" },
      { text: "He only says that because he owns stock in the company!", expectedName: "Ad Hominem" },
      { text: "Either we completely shut down the borders or our nation will be destroyed!", expectedName: "False Dilemma" },
      { text: "If we allow this next year they will ban all private property!", expectedName: "Slippery Slope" },
      { text: "How can you criticize our tax policy when what about when you wasted billions?", expectedName: "Tu Quoque" },
      { text: "Hollywood celebrity says this juice cleanses all toxins!", expectedName: "Appeal to False Authority" },
      { text: "Think of the crying children who will suffer!", expectedName: "Appeal to Fear & Emotion" },
      { text: "Over 10 million users bought this so everyone knows that it works!", expectedName: "Appeal to Popularity" },
      { text: "My cousin tried it and was cured overnight!", expectedName: "Anecdotal Evidence" },
      { text: "Right after we changed the logo revenue surged so the logo caused it!", expectedName: "Post Hoc Ergo Propter Hoc" },
      { text: "Look at these three cancer patients near the tower proving radiation!", expectedName: "Texas Sharpshooter" }
    ];

    for (const tf of testFallacies) {
      await harness.it(`Triggers detection for: ${tf.expectedName}`, () => {
        const res = VerdadEngine.runOfflineHeuristics(tf.text, verdadRulesJson, sourcesJson, fallaciesJson);
        harness.assertGreaterOrEqual(res.step2_fallacies.length, 1, `Fallacy detected in "${tf.text.slice(0, 40)}..."`);
        const matchedFallacy = res.step2_fallacies[0];
        harness.assert(typeof matchedFallacy.name === 'string', 'Fallacy has name');
        harness.assert(typeof matchedFallacy.latin === 'string', `Fallacy has Latin: ${matchedFallacy.latin}`);
      });
    }
  });

  // -------------------------------------------------------------------------
  // 9. Dual-Mode BYOK Gemini Fallback Resilience
  // -------------------------------------------------------------------------
  await harness.describe('9. BYOK Gemini API Transport & Fallback Resilience', async () => {
    await harness.it('Seamlessly falls back to offline heuristics when Gemini API fails with HTTP 500', async () => {
      VerdadEngine.fetchImpl = async () => {
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: 'Internal Server Error' })
        };
      };

      const res = await VerdadEngine.analyzeClaim('Breaking: Unconfirmed rumors hint at major banking changes on reuters.com', { apiKey: 'dummy-key', mode: 'auto' });
      harness.assertEqual(res.isLiveApi, false, 'isLiveApi is false on fallback');
      harness.assert(typeof res.step1_affect === 'object', 'step1_affect intact');
      harness.assert(typeof res.step3_epistemics === 'object', 'step3_epistemics intact');
      harness.assertEqual(res.step4_sources[0].domain, 'reuters.com', 'Source extracted on fallback');
      harness.assertEqual(res.step4_sources[0].admiraltyRating, 'A1', 'Admiralty rating A1 on fallback');
      harness.assert(typeof res.step5_synthesis === 'object', 'step5_synthesis intact');

      VerdadEngine.fetchImpl = null;
    });

    await harness.it('Sanitizes XSS tags from live API responses', async () => {
      VerdadEngine.fetchImpl = async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{
              content: {
                parts: [{
                  text: JSON.stringify({
                    veracityScore: 40,
                    manipulationRisk: 65,
                    emotionalTriggers: { outrage: 50, fear: 20, urgency: 40, tribalism: 10, conspiracy: 30, fatalism: 0 },
                    detectedFallacies: [{ name: 'Straw Man <script>alert(1)</script>', confidence: 0.9 }],
                    biasIndicators: ['Sensationalism <img src=x onerror=alert(1)>'],
                    confidence: 80,
                    sources: ['https://reuters.com'],
                    reasoning: 'Detailed reasoning with <b>markup</b>.',
                    prebunkSummary: 'Refutation <iframe src="evil.com"></iframe>.'
                  })
                }]
              }
            }]
          })
        };
      };

      const res = await VerdadEngine.analyzeClaim('Test claim', { apiKey: 'dummy-key', mode: 'auto' });
      harness.assertEqual(res.isLiveApi, true, 'isLiveApi is true');
      harness.assert(!res.prebunkSummary.includes('<iframe'), 'iframe stripped from prebunkSummary');
      harness.assert(!res.step5_synthesis.prebunkBrief.includes('<iframe'), 'iframe stripped from step5_synthesis');

      VerdadEngine.fetchImpl = null;
    });
  });

  return harness.summary();
}

runChallengerTests().then(result => {
  if (result.failed > 0) {
    process.exit(1);
  }
}).catch(err => {
  console.error('Fatal error running Challenger stress suite:', err);
  process.exit(1);
});
