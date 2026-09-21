/**
 * SOVEREIGN // AEGIS — Test Suite M2: Pillar II Verification & Epistemic Forensics
 * Validates:
 *  1. 5-Step Epistemic Chain-of-Thought Dialectic Schema & Mathematics
 *  2. URL & Domain Regex Extraction Engine
 *  3. Source Directory Cross-Referencing & Admiralty Intelligence Ratings (A1..F6)
 *  4. Adversarial Sandbox Challenge Mode (3 Vectors: Outrage, Consensus, In-Group)
 *  5. Cognitive Vulnerability & Inoculating Counter-Brief Scoring
 *  6. AttemptLog Integration & Skill Telemetry
 * Zero external runtime dependencies.
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

// Load canonical datasets
const sourcesJson = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'sources.json'), 'utf8'));
const fallaciesJson = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'fallacies.json'), 'utf8'));
const verdadRulesJson = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'verdad_rules.json'), 'utf8'));

// Initialize VerdadEngine databases
VerdadEngine.sourcesDatabase = sourcesJson;
VerdadEngine.fallaciesDatabase = fallaciesJson;

// Standardized Zero-Dependency Test Harness
class TestHarness {
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
      this.failures.push({ suite: this.currentSuite, test: name, error: err.message });
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
      if (process.exitCode === undefined || process.exitCode === 0) {
        process.exitCode = 1;
      }
    }
    return { passed: this.passed, failed: this.failed, total: this.totalAssertions };
  }
}

const harness = new TestHarness('Milestone 2: Pillar II (VERDAD CoT Dialectic & Adversarial Sandbox)');

async function runTests() {
  // ----------------------------------------------------
  // Group 1: 5-Step Epistemic Chain-of-Thought Dialectic
  // ----------------------------------------------------
  await harness.describe('Group 1: 5-Step Epistemic Chain-of-Thought Dialectic Schema', async () => {
    const claim = 'BREAKING: Don\'t listen to him because he is a convicted fraudster who allegedly leaked toxic biohazard data on reuters.com! Indisputable fact!';
    const res = VerdadEngine.runOfflineHeuristics(claim, verdadRulesJson, sourcesJson, fallaciesJson);

    await harness.it('Step 1 (Affect): Computes 6-vector radar, dominant vector, and keyword triggers', () => {
      harness.assert(typeof res.step1_affect === 'object', 'step1_affect object present');
      harness.assert(typeof res.step1_affect.outrage === 'number', 'outrage score is number');
      harness.assert(typeof res.step1_affect.fear === 'number', 'fear score is number');
      harness.assert(typeof res.step1_affect.urgency === 'number', 'urgency score is number');
      harness.assert(typeof res.step1_affect.tribalism === 'number', 'tribalism score is number');
      harness.assert(typeof res.step1_affect.conspiracy === 'number', 'conspiracy score is number');
      harness.assert(typeof res.step1_affect.fatalism === 'number', 'fatalism score is number');
      harness.assert(typeof res.step1_affect.dominantVector === 'string' || res.step1_affect.dominantVector === null, 'dominantVector is string or null');
      harness.assert(typeof res.step1_affect.triggeredKeywords === 'object', 'triggeredKeywords map present');
      harness.assert(res.step1_affect.outrage >= 50 || res.step1_affect.fear >= 50 || res.step1_affect.urgency >= 50, 'affect vector intensity elevated');
    });

    await harness.it('Step 2 (Fallacies): Extracts exact matched quote, Latin name, category, and explanation', () => {
      harness.assert(Array.isArray(res.step2_fallacies), 'step2_fallacies is array');
      harness.assertGreaterOrEqual(res.step2_fallacies.length, 1, 'At least 1 fallacy detected');
      const f = res.step2_fallacies[0];
      harness.assert(typeof f.name === 'string', 'fallacy has name');
      harness.assert(typeof f.latin === 'string' && f.latin.length > 0, `fallacy has Latin designation: ${f.latin}`);
      harness.assert(typeof f.quote === 'string' && f.quote.length > 0, `fallacy has exact quote slice: "${f.quote}"`);
      harness.assert(typeof f.explanation === 'string' && f.explanation.length > 0, 'fallacy has explanation');
      harness.assert(typeof f.confidence === 'number', 'fallacy has confidence');
      harness.assert(typeof f.category === 'string', 'fallacy has category');
    });

    await harness.it('Step 3 (Epistemics): Computes hedging ratio, certainty inflation, word count, and reading level', () => {
      harness.assert(typeof res.step3_epistemics === 'object', 'step3_epistemics is object');
      harness.assert(typeof res.step3_epistemics.hedgingRatio === 'number', 'hedgingRatio is number');
      harness.assert(typeof res.step3_epistemics.certaintyInflation === 'number', 'certaintyInflation is number');
      harness.assert(typeof res.step3_epistemics.wordCount === 'number', 'wordCount is number');
      harness.assert(typeof res.step3_epistemics.readingLevel === 'string', 'readingLevel is string');
      harness.assert(Array.isArray(res.step3_epistemics.hedgingMatches), 'hedgingMatches is array');
      harness.assert(Array.isArray(res.step3_epistemics.certaintyMatches), 'certaintyMatches is array');
      harness.assert(res.step3_epistemics.hedgingMatches.includes('allegedly'), 'hedging match detected');
      harness.assert(res.step3_epistemics.certaintyMatches.includes('indisputable fact') || res.step3_epistemics.certaintyInflation >= 25, 'certainty match detected');
    });

    await harness.it('Step 4 (Sources): Extracted domain matched against source database with Admiralty rating', () => {
      harness.assert(Array.isArray(res.step4_sources), 'step4_sources is array');
      harness.assertGreaterOrEqual(res.step4_sources.length, 1, 'At least 1 source entry returned');
      const src = res.step4_sources[0];
      harness.assertEqual(src.domain, 'reuters.com', 'Domain accurately matched reuters.com');
      harness.assertEqual(src.admiraltyRating, 'A1', 'Reuters has Admiralty rating A1');
      harness.assertEqual(src.factuality, 'Very High', 'Reuters has Very High factuality');
      harness.assertEqual(src.bias, 'Center', 'Reuters has Center bias');
      harness.assert(src.credibilityScore >= 95, 'Reuters has high credibility score >= 95');
      harness.assertEqual(src.matched, true, 'Source marked as matched');
    });

    await harness.it('Step 5 (Synthesis): Synthesizes multi-vector rationale, recommendation, and prebunk brief', () => {
      harness.assert(typeof res.step5_synthesis === 'object', 'step5_synthesis is object');
      harness.assert(['block', 'caution', 'share'].includes(res.step5_synthesis.recommendation), `Valid recommendation: ${res.step5_synthesis.recommendation}`);
      harness.assert(['unreliable', 'unverified', 'plausible'].includes(res.step5_synthesis.verdictClass), `Valid verdictClass: ${res.step5_synthesis.verdictClass}`);
      harness.assert(typeof res.step5_synthesis.rationale === 'string' && res.step5_synthesis.rationale.length > 20, 'Rationale is comprehensive');
      harness.assert(typeof res.step5_synthesis.prebunkBrief === 'string' && res.step5_synthesis.prebunkBrief.length > 10, 'Prebunk brief is populated');
      harness.assert(Array.isArray(res.step5_synthesis.keyFlags), 'keyFlags is array');
    });
  });

  // ----------------------------------------------------
  // Group 2: Domain Extraction Engine
  // ----------------------------------------------------
  await harness.describe('Group 2: Domain & URL Extraction Logic', async () => {
    await harness.it('Extracts domains from full HTTPS URLs with query parameters and subpaths', () => {
      const text = 'Check the report at https://www.reuters.com/world/us/article-12345?ref=feed and https://apnews.com/hub/politics';
      const domains = VerdadEngine.extractDomains(text);
      harness.assert(domains.includes('reuters.com'), 'reuters.com extracted from URL');
      harness.assert(domains.includes('apnews.com'), 'apnews.com extracted from URL');
      harness.assertEqual(domains.length, 2, 'Exactly 2 domains extracted');
    });

    await harness.it('Extracts bare domain mentions in running text', () => {
      const text = 'Disinformation vectors were tracked originating from rt.com, sputniknews.com, and infowars.com.';
      const domains = VerdadEngine.extractDomains(text);
      harness.assert(domains.includes('rt.com'), 'rt.com extracted');
      harness.assert(domains.includes('sputniknews.com'), 'sputniknews.com extracted');
      harness.assert(domains.includes('infowars.com'), 'infowars.com extracted');
      harness.assertEqual(domains.length, 3, 'Exactly 3 domains extracted');
    });

    await harness.it('Handles URLs with ports and subdomains', () => {
      const text = 'Mirror active at http://subdomain.tass.com:8080/wire-service/bulletin';
      const domains = VerdadEngine.extractDomains(text);
      harness.assert(domains.includes('subdomain.tass.com') || domains.includes('tass.com'), 'Subdomain URL parsed');
    });

    await harness.it('Deduplicates repeated domain mentions and ignores non-domain text', () => {
      const text = 'Refer to bbc.co.uk and https://www.bbc.co.uk/news and BBC.CO.UK for updates.';
      const domains = VerdadEngine.extractDomains(text);
      harness.assertEqual(domains.length, 1, 'Deduplicated to single bbc.co.uk entry');
      harness.assertEqual(domains[0], 'bbc.co.uk', 'Normalized lowercase domain');
    });

    await harness.it('Returns empty array for text with no URLs or domains', () => {
      const text = 'There are no external links or internet domains mentioned in this statement.';
      const domains = VerdadEngine.extractDomains(text);
      harness.assertEqual(domains.length, 0, '0 domains extracted from plain text');
    });
  });

  // ----------------------------------------------------
  // Group 3: Source Directory Matching & Admiralty Ratings
  // ----------------------------------------------------
  await harness.describe('Group 3: Source Credibility Profiles & Admiralty Intelligence Scale', async () => {
    await harness.it('Matches wire agencies to Admiralty A1 rating', () => {
      const matched = VerdadEngine.matchSources(['reuters.com', 'apnews.com', 'afp.com'], sourcesJson);
      harness.assertEqual(matched.length, 3, '3 sources matched');
      harness.assertEqual(matched[0].admiraltyRating, 'A1', 'Reuters is A1');
      harness.assertEqual(matched[1].admiraltyRating, 'A1', 'AP is A1');
      harness.assertEqual(matched[2].admiraltyRating, 'A1', 'AFP is A1');
      harness.assert(matched[0].admiraltyDescription.includes('Completely Reliable'), 'A1 description verified');
    });

    await harness.it('Matches fact-checking organizations to Admiralty A1/A2 rating', () => {
      const matched = VerdadEngine.matchSources(['snopes.com', 'politifact.com', 'factcheck.org'], sourcesJson);
      harness.assertEqual(matched[0].admiraltyRating, 'A2', 'Snopes is A2');
      harness.assertEqual(matched[1].admiraltyRating, 'A2', 'PolitiFact is A2');
      harness.assertEqual(matched[2].admiraltyRating, 'A1', 'FactCheck.org is A1');
    });

    await harness.it('Matches newspapers of record to Admiralty A2/B1 rating', () => {
      const matched = VerdadEngine.matchSources(['wsj.com', 'nytimes.com'], sourcesJson);
      harness.assertEqual(matched[0].admiraltyRating, 'A2', 'WSJ is A2');
      harness.assertEqual(matched[1].admiraltyRating, 'B1', 'NYT is B1');
    });

    await harness.it('Matches state propaganda / disinfo vectors to Admiralty E5/F6 rating', () => {
      const matched = VerdadEngine.matchSources(['rt.com', 'infowars.com'], sourcesJson);
      harness.assertEqual(matched[0].admiraltyRating, 'E5', 'RT is E5');
      harness.assertEqual(matched[1].admiraltyRating, 'F6', 'InfoWars is F6');
      harness.assertLessOrEqual(matched[0].credibilityScore, 30, 'RT credibility <= 30');
      harness.assertLessOrEqual(matched[1].credibilityScore, 10, 'InfoWars credibility <= 10');
    });

    await harness.it('Assigns Admiralty F6 to unindexed external domains', () => {
      const matched = VerdadEngine.matchSources(['unknown-unregistered-site-999.xyz'], sourcesJson);
      harness.assertEqual(matched[0].matched, false, 'Unregistered domain marked unmatched');
      harness.assertEqual(matched[0].admiraltyRating, 'F6', 'Unregistered domain defaults to F6');
      harness.assertEqual(matched[0].factuality, 'Unverified', 'Factuality is Unverified');
    });

    await harness.it('Assigns Anonymous F6 rating when text contains no domain at all', () => {
      const matched = VerdadEngine.matchSources([], sourcesJson);
      harness.assertEqual(matched.length, 1, 'Single fallback entry returned');
      harness.assertEqual(matched[0].domain, null, 'Domain is null for anonymous');
      harness.assertEqual(matched[0].admiraltyRating, 'F6', 'Anonymous source receives Admiralty F6');
      harness.assertEqual(matched[0].name, 'Anonymous / Uncorroborated Source', 'Anonymous name assigned');
    });
  });

  // ----------------------------------------------------
  // Group 4: Adversarial Sandbox Challenge Mode
  // ----------------------------------------------------
  await harness.describe('Group 4: Adversarial Sandbox Reframing Generator', async () => {
    const claim = 'City municipal board announces water filtration upgrade scheduled for next month.';
    const reframings = VerdadEngine.generateAdversarialReframings(claim);

    await harness.it('Generates all 3 required adversarial vectors', () => {
      harness.assert(typeof reframings.outrageMaximizer === 'object', 'outrageMaximizer vector present');
      harness.assert(typeof reframings.falseConsensus === 'object', 'falseConsensus vector present');
      harness.assert(typeof reframings.inGroupThreat === 'object', 'inGroupThreat vector present');
    });

    await harness.it('Outrage Maximizer contains moral vilification framing and valid drill choices', () => {
      const om = reframings.outrageMaximizer;
      harness.assertEqual(om.vector, 'outrageMaximizer', 'Vector key is outrageMaximizer');
      harness.assert(om.badge.includes('Moral Vilification'), 'Badge indicates moral vilification');
      harness.assert(om.text.includes('SHAMEFUL OUTRAGE') || om.text.includes('betrayal'), 'Emotive words present');
      harness.assert(om.skillIds.includes('skill.tactic.emotive-framing'), 'Skill tag emotive-framing present');
      harness.assert(Array.isArray(om.vulnerabilityOptions) && om.vulnerabilityOptions.length === 4, '4 vulnerability options present');
      harness.assertEqual(om.correctVulnerabilityIndex, 0, 'Index 0 is optimal vulnerability');
      harness.assert(Array.isArray(om.counterBriefOptions) && om.counterBriefOptions.length === 3, '3 counter-brief options present');
      harness.assertEqual(om.correctBriefIndex, 0, 'Index 0 is optimal counter-brief');
    });

    await harness.it('False Consensus contains bandwagon consensus framing and valid drill choices', () => {
      const fc = reframings.falseConsensus;
      harness.assertEqual(fc.vector, 'falseConsensus', 'Vector key is falseConsensus');
      harness.assert(fc.badge.includes('Bandwagon'), 'Badge indicates bandwagon');
      harness.assert(fc.text.includes('EVERYONE AGREES') || fc.text.includes('consensus'), 'Bandwagon words present');
      harness.assert(fc.skillIds.includes('skill.tactic.astroturfing'), 'Skill tag astroturfing present');
      harness.assert(Array.isArray(fc.vulnerabilityOptions) && fc.vulnerabilityOptions.length === 4, '4 vulnerability options present');
      harness.assert(Array.isArray(fc.counterBriefOptions) && fc.counterBriefOptions.length === 3, '3 counter-brief options present');
    });

    await harness.it('In-Group Threat contains tribal siege narrative and valid drill choices', () => {
      const ig = reframings.inGroupThreat;
      harness.assertEqual(ig.vector, 'inGroupThreat', 'Vector key is inGroupThreat');
      harness.assert(ig.badge.includes('Tribal Siege'), 'Badge indicates tribal siege');
      harness.assert(ig.text.includes('TRIBAL') || ig.text.includes('infiltrators') || ig.text.includes('patriots'), 'Tribal keywords present');
      harness.assert(ig.skillIds.includes('skill.bias.attribution'), 'Skill tag bias attribution present');
      harness.assert(Array.isArray(ig.vulnerabilityOptions) && ig.vulnerabilityOptions.length === 4, '4 vulnerability options present');
      harness.assert(Array.isArray(ig.counterBriefOptions) && ig.counterBriefOptions.length === 3, '3 counter-brief options present');
    });
  });

  // ----------------------------------------------------
  // Group 5: AttemptLog & Spaced Repetition Integration
  // ----------------------------------------------------
  await harness.describe('Group 5: AttemptLog & Pedagogical Integration', async () => {
    await harness.it('Records successful sandbox challenge attempt to AttemptLog', async () => {
      const reframing = VerdadEngine.generateAdversarialReframings('Sample assertion').outrageMaximizer;
      const res = await recordAttempt({
        skillIds: reframing.skillIds,
        itemId: 'adversarial-outrageMaximizer',
        correct: true,
        context: CONTEXTS.SANDBOX,
        latencyMs: 1450,
        confidence: 'sure'
      });

      harness.assertEqual(res.recorded, reframing.skillIds.length, `Recorded ${reframing.skillIds.length} skill records in AttemptLog`);
    });

    await harness.it('Records failed sandbox challenge attempt with appropriate telemetry', async () => {
      const reframing = VerdadEngine.generateAdversarialReframings('Sample assertion').falseConsensus;
      const res = await recordAttempt({
        skillIds: reframing.skillIds,
        itemId: 'adversarial-falseConsensus',
        correct: false,
        context: CONTEXTS.SANDBOX,
        latencyMs: 3200,
        confidence: 'unsure'
      });

      harness.assertEqual(res.recorded, reframing.skillIds.length, `Recorded ${reframing.skillIds.length} failed skill records in AttemptLog`);
    });
  });

  // ----------------------------------------------------
  // Group 6: Fallacy Nomenclature & Meta Lookup
  // ----------------------------------------------------
  await harness.describe('Group 6: Fallacy Latin Nomenclature & Psychological Vector Lookup', async () => {
    await harness.it('Resolves classical Latin nomenclature for major fallacies', () => {
      const adHom = VerdadEngine.getFallacyMeta('fallacy-ad-hominem', 'Ad Hominem', fallaciesJson);
      harness.assert(adHom.latin.includes('Argumentum ad Hominem'), 'Ad Hominem Latin resolved');

      const falseDilemma = VerdadEngine.getFallacyMeta('fallacy-false-dilemma', 'False Dilemma', fallaciesJson);
      harness.assert(falseDilemma.latin.includes('Falsi Dilemmatis') || falseDilemma.latin.includes('Tertium Non Datur'), 'False Dilemma Latin resolved');

      const slippery = VerdadEngine.getFallacyMeta('fallacy-slippery-slope', 'Slippery Slope', fallaciesJson);
      harness.assert(slippery.latin.includes('Clivi Lubricosi') || slippery.latin.includes('Secundum Quid'), 'Slippery Slope Latin resolved');

      const tuQuoque = VerdadEngine.getFallacyMeta('fallacy-tu-quoque', 'Whataboutism / Tu Quoque', fallaciesJson);
      harness.assertEqual(tuQuoque.latin, 'Tu Quoque', 'Tu Quoque Latin resolved');
    });
  });

  return harness.summary();
}

// Standalone execution support
runTests().then(result => {
  if (result.failed > 0) {
    process.exit(1);
  }
}).catch(err => {
  console.error('Fatal error running Milestone 2 test suite:', err);
  process.exit(1);
});
