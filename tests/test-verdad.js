/**
 * SOVEREIGN // AEGIS — Test Suite 5: VERDAD Real-Time Claim Verification & NLP Heuristics
 * Validates offline NLP heuristic engine, 6 emotional triggers, fallacy detection regexes,
 * hedging/certainty ratios, composite risk scoring, and BYOK Gemini API fallback logic.
 * Zero external runtime dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

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

// Canonical Fallacy & NLP Heuristic Rule Engine (matching verdad_rules.json and PROJECT.md)
// VerdadEngine is imported from the production module below — this suite previously
// carried its own duplicate copy of the class, so it could not detect a regression
// in the shipped code. Do not re-inline it.
import { VerdadEngine } from '../js/modules/verdad.js';


const harness = new TestHarness('VERDAD NLP Claim Verification & Heuristic Suite');

async function runTests() {
  // ----------------------------------------------------
  // Tier 1: 6-Vector Emotional Trigger Detection
  // ----------------------------------------------------
  await harness.describe('Tier 1: 6-Vector Emotional Manipulation Detection', async () => {
    await harness.it('Detects High Outrage Text (Vector >= 70)', () => {
      const text = 'SHAMEFUL OUTRAGE! These DISGUSTING corrupt traitors committed an ABHORRENT scandal that is completely UNACCEPTABLE and infuriating!';
      const res = VerdadEngine.runOfflineHeuristics(text);
      harness.assertGreaterOrEqual(res.emotionalTriggers.outrage, 70, 'Outrage vector intensity >= 70');
      harness.assertGreaterOrEqual(res.manipulationRisk, 40, 'Manipulation risk reflects outrage surge');
    });

    await harness.it('Detects High Fear & Existential Dread (Vector >= 70)', () => {
      const text = 'DANGER: A DEADLY toxic hazard and LETHAL epidemic represents an immediate CATASTROPHE and fatal extinction peril!';
      const res = VerdadEngine.runOfflineHeuristics(text);
      harness.assertGreaterOrEqual(res.emotionalTriggers.fear, 70, 'Fear vector intensity >= 70');
    });

    await harness.it('Detects High Urgency Pressure (Vector >= 80)', () => {
      const text = 'BREAKING EMERGENCY: CRITICAL ALERT! Act now and delete this immediately before it is too late! RT now!';
      const res = VerdadEngine.runOfflineHeuristics(text);
      harness.assertGreaterOrEqual(res.emotionalTriggers.urgency, 80, 'Urgency vector intensity >= 80');
    });

    await harness.it('Detects Tribal In-Group vs Out-Group Demonization (Vector >= 65)', () => {
      const text = 'Every true patriot must fight the enemy within and expose the foreign agent puppet infiltrator cabal!';
      const res = VerdadEngine.runOfflineHeuristics(text);
      harness.assertGreaterOrEqual(res.emotionalTriggers.tribalism, 65, 'Tribalism vector intensity >= 65');
    });

    await harness.it('Detects Conspiratorial Agency & Coverup Narratives (Vector >= 70)', () => {
      const text = 'The deep state shadow government and globalist cabal are executing a secret plot to bury the suppressed truth!';
      const res = VerdadEngine.runOfflineHeuristics(text);
      harness.assertGreaterOrEqual(res.emotionalTriggers.conspiracy, 70, 'Conspiracy vector intensity >= 70');
    });

    await harness.it('Detects Fatalism & Societal Despair (Vector >= 60)', () => {
      const text = 'Everything is hopeless and doomed. Society faces irreversible decay and inevitable collapse with no future!';
      const res = VerdadEngine.runOfflineHeuristics(text);
      harness.assertGreaterOrEqual(res.emotionalTriggers.fatalism, 60, 'Fatalism vector intensity >= 60');
    });

    await harness.it('Evaluates Neutral Factual Text with Minimal Affect (All Vectors < 20)', () => {
      const text = 'The Federal Reserve Open Market Committee announced it will maintain the federal funds target rate between 5.25% and 5.50% following its scheduled two-day meeting in Washington.';
      const res = VerdadEngine.runOfflineHeuristics(text);
      harness.assertLessOrEqual(res.emotionalTriggers.outrage, 20, 'Outrage < 20 for factual news');
      harness.assertLessOrEqual(res.emotionalTriggers.fear, 20, 'Fear < 20 for factual news');
      harness.assertLessOrEqual(res.emotionalTriggers.urgency, 20, 'Urgency < 20 for factual news');
      harness.assertLessOrEqual(res.emotionalTriggers.tribalism, 20, 'Tribalism < 20 for factual news');
      harness.assertLessOrEqual(res.emotionalTriggers.conspiracy, 20, 'Conspiracy < 20 for factual news');
      harness.assertLessOrEqual(res.emotionalTriggers.fatalism, 20, 'Fatalism < 20 for factual news');
      harness.assertLessOrEqual(res.manipulationRisk, 20, 'Overall manipulation risk < 20');
      harness.assertEqual(res.credibilityTier, 'High Credibility / Low Manipulation', 'Factual text is High Credibility');
    });
  });

  // ----------------------------------------------------
  // Tier 1: Fallacy Detection Pattern Regexes
  // ----------------------------------------------------
  await harness.describe('Tier 1: Logical Fallacy Pattern Matching Regexes', async () => {
    await harness.it('Detects Ad Hominem character attack', () => {
      const text = 'Do not accept his macroeconomic forecast because he is a corrupt liar and convicted fraudster.';
      const res = VerdadEngine.runOfflineHeuristics(text);
      const hasAdHominem = res.detectedFallacies.some(f => f.name === 'Ad Hominem');
      harness.assert(hasAdHominem, 'Ad Hominem fallacy detected');
    });

    await harness.it('Detects False Dilemma polarization', () => {
      const text = 'Either you support our emergency expenditure bill or the entire society will collapse into chaos!';
      const res = VerdadEngine.runOfflineHeuristics(text);
      const hasFalseDilemma = res.detectedFallacies.some(f => f.name === 'False Dilemma');
      harness.assert(hasFalseDilemma, 'False Dilemma fallacy detected');
    });

    await harness.it('Detects Slippery Slope extreme extrapolation', () => {
      const text = 'If we pass this basic parking zoning law it will inevitably lead to totalitarian dictatorship!';
      const res = VerdadEngine.runOfflineHeuristics(text);
      const hasSlipperySlope = res.detectedFallacies.some(f => f.name === 'Slippery Slope');
      harness.assert(hasSlipperySlope, 'Slippery Slope fallacy detected');
    });

    await harness.it('Detects Whataboutism / Tu Quoque diversion', () => {
      const text = 'Why investigate our municipal deficit? What about when the other party ran up debt five years ago?';
      const res = VerdadEngine.runOfflineHeuristics(text);
      const hasWhataboutism = res.detectedFallacies.some(f => f.name === 'Whataboutism / Tu Quoque');
      harness.assert(hasWhataboutism, 'Whataboutism fallacy detected');
    });

    await harness.it('Detects Appeal to False Celebrity Authority', () => {
      const text = 'A famous celebrity confirms this colloidal silver solution cures all viral infections.';
      const res = VerdadEngine.runOfflineHeuristics(text);
      const hasAuth = res.detectedFallacies.some(f => f.name === 'Appeal to False Authority');
      harness.assert(hasAuth, 'Appeal to False Authority detected');
    });

    await harness.it('Detects Appeal to Fear & Pity', () => {
      const text = 'Think of the innocent children who will suffer if we do not act immediately!';
      const res = VerdadEngine.runOfflineHeuristics(text);
      const hasFearFallacy = res.detectedFallacies.some(f => f.name === 'Appeal to Fear & Emotion');
      harness.assert(hasFearFallacy, 'Appeal to Fear & Emotion detected');
    });
  });

  // ----------------------------------------------------
  // Tier 1 & Tier 2: Epistemic Uncertainty & Style Metrics
  // ----------------------------------------------------
  await harness.describe('Tier 1 & Tier 2: Epistemic Hedging vs Certainty Inflation', async () => {
    await harness.it('Calculates Hedging Index on speculative claims', () => {
      const text = 'The diplomat allegedly traveled to Zurich, where sources say a meeting was reportedly conducted.';
      const res = VerdadEngine.runOfflineHeuristics(text);
      harness.assertGreaterOrEqual(res.epistemicMetrics.hedgingRatio, 0.05, 'Hedging ratio reflects speculative qualifiers');
    });

    await harness.it('Calculates Certainty Inflation on dogmatic claims', () => {
      const text = 'It is an indisputable fact and an absolute certainty that this secret doctrine is 100% proven beyond all doubt.';
      const res = VerdadEngine.runOfflineHeuristics(text);
      harness.assertGreaterOrEqual(res.epistemicMetrics.certaintyInflation, 50, 'Certainty inflation score >= 50');
    });

    await harness.it('Handles empty text input gracefully', () => {
      const res = VerdadEngine.runOfflineHeuristics('');
      harness.assertEqual(res.manipulationRisk, 0, 'Empty string has 0 manipulation risk');
      harness.assertEqual(res.detectedFallacies.length, 0, '0 detected fallacies for empty string');
      harness.assertEqual(res.veracityScore, 50, 'Empty string defaults to neutral veracity 50');
    });

    await harness.it('Sanitizes HTML/script tags safely without execution', () => {
      const text = '<script>alert("xss")</script> <b>BREAKING EMERGENCY:</b> Toxic hazard warning!';
      const res = VerdadEngine.runOfflineHeuristics(text);
      harness.assertGreaterOrEqual(res.emotionalTriggers.urgency, 40, 'Parsed text through HTML markup');
      harness.assert(res.manipulationRisk > 0, 'Valid manipulation score generated');
    });

    await harness.it('Processes long articles (5000+ words) under 100ms', () => {
      const paragraph = 'The regional infrastructure review board met today to evaluate municipal water systems. ';
      const longText = paragraph.repeat(500); // ~5500 words
      const t0 = performance.now();
      const res = VerdadEngine.runOfflineHeuristics(longText);
      const elapsed = performance.now() - t0;
      harness.assert(elapsed < 100, `Execution time (${elapsed.toFixed(2)}ms) < 100ms`);
      harness.assert(res.epistemicMetrics.wordCount >= 5000, 'Word count accurately counted');
    });

    await harness.it('Assigns accurate credibility tiers across manipulation gradient', () => {
      const lowRiskText = 'The seasonal temperature average was recorded at 22 degrees Celsius.';
      const medRiskText = 'Urgent update regarding municipal budget disagreements.';
      const highRiskText = 'BREAKING OUTRAGE! These corrupt traitors committed an abhorrent scandal!';

      const rLow = VerdadEngine.runOfflineHeuristics(lowRiskText);
      const rMed = VerdadEngine.runOfflineHeuristics(medRiskText);
      const rHigh = VerdadEngine.runOfflineHeuristics(highRiskText);

      harness.assertEqual(rLow.credibilityTier, 'High Credibility / Low Manipulation', 'Low risk tier');
      harness.assert(rMed.manipulationRisk >= 0, 'Med risk has valid number');
      harness.assert(rHigh.manipulationRisk >= 40, 'High risk reflects intense affect');
    });
  });

  // ----------------------------------------------------
  // Tier 3: BYOK Gemini API & Offline Fallback Architecture
  // ----------------------------------------------------
  await harness.describe('Tier 3: Dual-Mode BYOK Gemini & Heuristic Fallback', async () => {
    const claim = 'Breaking: State agency secretly dumping toxic chemical into municipal reservoir!';

    await harness.it('Executes offline heuristic engine when apiKey is null', async () => {
      const res = await VerdadEngine.analyzeClaim(claim, { apiKey: null, mode: 'auto' });
      harness.assertEqual(res.isLiveApi, false, 'isLiveApi is false when apiKey is null');
      harness.assert(res.veracityScore > 0, 'Veracity score computed');
      harness.assert(Array.isArray(res.detectedFallacies), 'Fallacies array returned');
      harness.assert(res.sources[0].includes('Offline'), 'Sources specifies offline engine');
    });

    await harness.it('Executes offline heuristic engine when apiKey is empty string', async () => {
      const res = await VerdadEngine.analyzeClaim(claim, { apiKey: '   ', mode: 'auto' });
      harness.assertEqual(res.isLiveApi, false, 'isLiveApi is false for empty API key');
    });

    await harness.it('Forces offline mode when mode: "offline" is specified regardless of key', async () => {
      const res = await VerdadEngine.analyzeClaim(claim, { apiKey: 'valid_looking_key_123', mode: 'offline' });
      harness.assertEqual(res.isLiveApi, false, 'isLiveApi is false when mode: "offline"');
    });

    await harness.it('Executes live API mode when apiKey is provided and mode is live/auto', async () => {
      // Transport is stubbed at the seam (VerdadEngine.fetchImpl) rather than via a magic
      // API key recognised by production code. This exercises the real request builder,
      // the real response parser, and the real sanitisation step.
      let capturedUrl = null;
      let capturedBody = null;
      VerdadEngine.fetchImpl = async (url, init) => {
        capturedUrl = url;
        capturedBody = JSON.parse(init.body);
        return {
          ok: true,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: JSON.stringify({
              veracityScore: 75,
              manipulationRisk: 25,
              confidence: 88,
              sources: ['Gemini Cognitive Security Knowledge Graph'],
              reasoning: 'API verification evaluated claim against consensus benchmarks.',
              prebunkSummary: 'Independent cross-source evaluation found no supporting evidence.'
            }) }] } }]
          })
        };
      };
      try {
        const res = await VerdadEngine.analyzeClaim(claim, { apiKey: 'AIzaSy-test-key', mode: 'auto' });
        harness.assertEqual(res.isLiveApi, true, 'isLiveApi is true with valid API key in auto mode');
        harness.assertEqual(res.veracityScore, 75, 'Live API response veracity score parsed');
        harness.assert(res.sources[0].includes('Gemini'), 'Sources reflects Gemini engine');
        harness.assert(capturedUrl.includes('generativelanguage.googleapis.com'), 'Request targets the Gemini endpoint');
        harness.assert(capturedUrl.includes('key=AIzaSy-test-key'), 'API key is passed as the key query parameter');
        harness.assert(capturedBody.contents[0].parts[0].text.includes(claim), 'Claim text is embedded in the prompt unmodified');
      } finally {
        VerdadEngine.fetchImpl = null;
      }
    });

    await harness.it('Requests the operator-selected model from settings, not a hardcoded one', async () => {
      let capturedUrl = null;
      VerdadEngine.fetchImpl = async (url) => {
        capturedUrl = url;
        return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ veracityScore: 60 }) }] } }] }) };
      };
      try {
        await VerdadEngine.analyzeClaim(claim, { apiKey: 'AIzaSy-test-key', mode: 'auto', model: 'gemini-1.5-pro' });
        harness.assert(capturedUrl.includes('/models/gemini-1.5-pro:'), 'Selected model reaches the endpoint path');
        await VerdadEngine.analyzeClaim(claim, { apiKey: 'AIzaSy-test-key', mode: 'auto', model: 'not-a-real-model' });
        harness.assert(capturedUrl.includes('/models/gemini-2.0-flash:'), 'Unknown model falls back to the default, never interpolated raw');
        await VerdadEngine.analyzeClaim(claim, { apiKey: 'AIzaSy-test-key', mode: 'auto' });
        harness.assert(capturedUrl.includes('/models/gemini-2.0-flash:'), 'Missing model defaults to gemini-2.0-flash');
      } finally {
        VerdadEngine.fetchImpl = null;
      }
    });

    await harness.it('Neutralises markup smuggled through the live API response (prompt injection)', async () => {
      VerdadEngine.fetchImpl = async () => ({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify({
            veracityScore: 50,
            reasoning: '<img src=x onerror="steal()">',
            prebunkSummary: '<script>steal()</script>'
          }) }] } }]
        })
      });
      try {
        const res = await VerdadEngine.analyzeClaim(claim, { apiKey: 'AIzaSy-test-key', mode: 'auto' });
        harness.assert(!res.reasoning.includes('<'), 'Angle brackets stripped from LLM reasoning field');
        harness.assert(!res.prebunkSummary.includes('<script'), 'Script tag neutralised in prebunkSummary');
      } finally {
        VerdadEngine.fetchImpl = null;
      }
    });

    await harness.it('Propagates API failure instead of silently fabricating a live result', async () => {
      VerdadEngine.fetchImpl = async () => ({ ok: false, status: 429, json: async () => ({}) });
      try {
        const res = await VerdadEngine.analyzeClaim(claim, { apiKey: 'AIzaSy-test-key', mode: 'auto' });
        harness.assertEqual(res.isLiveApi, false, 'Falls back to offline heuristics on API error, flagged honestly');
      } finally {
        VerdadEngine.fetchImpl = null;
      }
    });

    await harness.it('Produces complete schema adhering to PROJECT.md interface contract', async () => {
      const res = await VerdadEngine.analyzeClaim(claim, { apiKey: null });
      harness.assertEqual(res.claimText, claim, 'claimText preserved');
      harness.assert(typeof res.veracityScore === 'number', 'veracityScore is number');
      harness.assert(typeof res.confidence === 'number', 'confidence is number');
      harness.assert(typeof res.reasoning === 'string' && res.reasoning.length > 0, 'reasoning is non-empty string');
      harness.assert(Array.isArray(res.biasIndicators), 'biasIndicators is array');
      harness.assert(Array.isArray(res.sources), 'sources is array');
      harness.assert(typeof res.emotionalTriggers === 'object', 'emotionalTriggers is object');
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
  console.error('Fatal error running verdad test suite:', err);
  process.exit(1);
});
