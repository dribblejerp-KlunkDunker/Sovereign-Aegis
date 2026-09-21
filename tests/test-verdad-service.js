/**
 * SOVEREIGN // AEGIS — VERDAD Service Suite
 * Validates the message-oriented analysis service: the classifier thresholds, the
 * pre-send gate, and the load-bearing invariant that a recommendation keys off
 * manipulation risk — never off a score an LLM could inflate.
 * Zero external runtime dependencies.
 */

import {
  analyzeMessage,
  shouldShare,
  classify,
  headlineFor,
  reasonFor,
  THRESHOLDS
} from '../js/verdad-service.js';

// Standardized Zero-Dependency Test Harness (same shape as the sibling suites).
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

const harness = new TestHarness('VERDAD Service Suite');

// A claim engineered to hit urgency, outrage, conspiracy, fear, a fallacy pattern,
// and certainty markers — the full manipulation profile.
const HOSTILE = 'URGENT BREAKING: the corrupt deep state cabal is covering up a deadly poison in the water that will kill your innocent children! Share immediately before it is too late, traitor! 100% proven beyond all doubt!';

// A neutral, ordinary-news sentence with no manipulation markers.
const NEUTRAL = 'The city council approved the quarterly budget on Tuesday by a vote of six to three.';

async function runTests() {
  // ----------------------------------------------------
  // classify — deterministic thresholds
  // ----------------------------------------------------
  await harness.describe('classify — recommendation derives from manipulation risk only', async () => {
    await harness.it('blocks at and above the block threshold', () => {
      harness.assertEqual(classify({ manipulationRisk: THRESHOLDS.blockRisk }).recommendation, 'block', 'blockRisk → block');
      harness.assertEqual(classify({ manipulationRisk: 95 }).recommendation, 'block', '95 → block');
    });

    await harness.it('cautions between the thresholds', () => {
      harness.assertEqual(classify({ manipulationRisk: THRESHOLDS.cautionRisk }).recommendation, 'caution', 'cautionRisk → caution');
      harness.assertEqual(classify({ manipulationRisk: 55 }).recommendation, 'caution', '55 → caution');
    });

    await harness.it('shares below the caution threshold', () => {
      harness.assertEqual(classify({ manipulationRisk: 0 }).recommendation, 'share', '0 → share');
      harness.assertEqual(classify({ manipulationRisk: 39 }).recommendation, 'share', '39 → share');
    });

    await harness.it('clamps out-of-range and non-finite risk', () => {
      harness.assertEqual(classify({ manipulationRisk: 150 }).risk, 100, '150 clamps to 100');
      harness.assertEqual(classify({ manipulationRisk: -7 }).risk, 0, '-7 clamps to 0');
      harness.assertEqual(classify({}).risk, 0, 'missing risk reads as 0');
      harness.assertEqual(classify({ manipulationRisk: NaN }).risk, 0, 'NaN reads as 0');
    });

    await harness.it('never keys the recommendation off veracityScore', () => {
      // A puffed LLM score cannot rescue a high-risk claim, and a low score cannot condemn
      // a low-risk one: the gate is risk, not the model's opinion.
      harness.assertEqual(classify({ manipulationRisk: 90, veracityScore: 95 }).recommendation, 'block', 'high risk + high score still blocks');
      harness.assertEqual(classify({ manipulationRisk: 5, veracityScore: 10 }).recommendation, 'share', 'low risk + low score still shares');
    });
  });

  // ----------------------------------------------------
  // analyzeMessage / shouldShare — end to end over the real engine
  // ----------------------------------------------------
  await harness.describe('analyzeMessage / shouldShare — offline, deterministic, DOM-free', async () => {
    await harness.it('flags the hostile claim and passes the neutral one', async () => {
      const hostile = await analyzeMessage(HOSTILE);
      harness.assert(hostile.manipulationRisk >= THRESHOLDS.cautionRisk, `hostile risk ${hostile.manipulationRisk} >= caution threshold ${THRESHOLDS.cautionRisk}`);
      harness.assert(['block', 'caution'].includes(hostile.recommendation), `hostile → ${hostile.recommendation}`);

      const neutral = await analyzeMessage(NEUTRAL);
      harness.assertEqual(neutral.recommendation, 'share', `neutral → share (risk ${neutral.manipulationRisk})`);
      harness.assert(neutral.manipulationRisk < THRESHOLDS.cautionRisk, 'neutral risk stays below caution');
    });

    await harness.it('shouldShare defaults to offline and returns a gate decision', async () => {
      const gate = await shouldShare(HOSTILE);
      harness.assert(gate.result.isLiveApi === false, 'offline default → isLiveApi false');
      harness.assert(gate.result.factChecks === null, 'no fact-check fetch in the gate');
      harness.assert(typeof gate.allow === 'boolean', 'allow is a boolean');
      harness.assert(gate.headline.length > 0 && gate.reason.length > 0, 'headline and reason are populated');
    });

    await harness.it('a hostile claim that reaches block denies the share', async () => {
      const gate = await shouldShare(HOSTILE);
      harness.assertEqual(gate.recommendation, 'block', `hostile claim blocks (risk ${gate.result.manipulationRisk})`);
      harness.assertEqual(gate.allow, false, 'block denies the share');
    });

    await harness.it('a neutral claim allows the share', async () => {
      const gate = await shouldShare(NEUTRAL);
      harness.assertEqual(gate.allow, true, 'neutral allows the share');
      harness.assertEqual(gate.recommendation, 'share', 'neutral → share');
    });
  });

  // ----------------------------------------------------
  // headline / reason — human-facing, not just a score
  // ----------------------------------------------------
  await harness.describe('headlineFor / reasonFor', async () => {
    await harness.it('headline follows the recommendation', () => {
      harness.assert(headlineFor({ recommendation: 'block' }).toLowerCase().includes('do not share'), 'block headline warns');
      harness.assert(headlineFor({ recommendation: 'share' }).toLowerCase().includes('no strong'), 'share headline is calm');
    });

    await harness.it('reason names concrete markers, not just the score', () => {
      const r = reasonFor({ recommendation: 'block', manipulationRisk: 80, emotionalTriggers: { urgency: 90 }, detectedFallacies: [{ name: 'x' }] });
      harness.assert(r.includes('urgency') && r.includes('fallacy'), 'reason cites urgency and a fallacy');
    });
  });

  return harness.summary();
}

// Standalone execution support
runTests().then(result => {
  if (result.failed > 0) process.exit(1);
}).catch(err => {
  console.error('Fatal error running VERDAD service suite:', err);
  process.exit(1);
});

export default runTests;
