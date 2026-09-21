/**
 * SOVEREIGN // AEGIS — Adversarial Stress Test Harness: Milestone 4
 * Focus: Operator Profile, Spiderchart, Resilience Index, Recommended Actions, and Onboarding State
 */

import { OnboardingModule } from '../js/modules/onboarding.js';
import { InfoWarEngine, getContainmentGrade, DISARM_DIAGNOSTICS } from '../js/modules/infowar.js';
import { StateStore, SEED_STATE } from '../js/state.js';

class AdversarialHarness {
  constructor(name) {
    this.suiteName = name;
    this.totalAssertions = 0;
    this.passed = 0;
    this.failed = 0;
    this.failures = [];
    this.currentSection = '';
  }

  describe(name, fn) {
    this.currentSection = name;
    console.log(`\n=== [STRESS SECTION] ${name} ===`);
    return fn();
  }

  async it(name, fn) {
    try {
      await fn();
    } catch (err) {
      this.failed++;
      this.totalAssertions++;
      this.failures.push({ section: this.currentSection, test: name, error: err.message });
      console.error(`  ✗ [STRESS FAIL] ${name} (${err.message})`);
    }
  }

  assert(condition, message) {
    this.totalAssertions++;
    if (condition) {
      this.passed++;
      console.log(`    ✓ ${message}`);
    } else {
      this.failed++;
      this.failures.push({ section: this.currentSection, test: message, error: 'Assertion failed' });
      console.error(`    ✗ [STRESS FAIL] ${message}`);
    }
  }

  assertEqual(actual, expected, message) {
    this.assert(actual === expected, `${message} | Got: ${JSON.stringify(actual)}, Expected: ${JSON.stringify(expected)}`);
  }

  assertCloseTo(actual, expected, delta = 1e-3, message) {
    const diff = Math.abs(actual - expected);
    this.assert(diff <= delta, `${message} | Got: ${actual}, Expected: ~${expected} (diff: ${diff.toFixed(5)})`);
  }

  summary() {
    console.log('\n====================================================');
    console.log(`[${this.suiteName}] Summary: ${this.passed}/${this.totalAssertions} Passed (${this.failed} Failed)`);
    console.log('====================================================');
    if (this.failed > 0) {
      console.error('\nFailures Recorded:');
      this.failures.forEach(f => console.error(` - [${f.section}] ${f.test}: ${f.error}`));
    }
    return { passed: this.passed, failed: this.failed, total: this.totalAssertions };
  }
}

const harness = new AdversarialHarness('Milestone 4 Adversarial Stress Test');

async function runAdversarialBattery() {
  // =========================================================================
  // 1. DEGENERATE SCORE INPUTS TO SPIDERCHART
  // =========================================================================
  await harness.describe('1. Degenerate & Adversarial Score Inputs to Spiderchart', async () => {
    const defaultColors = [
      'var(--disinfo-crimson)',
      'var(--suspicion-amber)',
      'var(--emerald-bright)',
      'var(--bronze-bright)',
      'var(--intel-cyan)'
    ];

    const makeAxes = (values) => [
      { key: 'sift', label: 'SIFT', value: values[0], color: defaultColors[0] },
      { key: 'pattern', label: 'Pattern', value: values[1], color: defaultColors[1] },
      { key: 'memory', label: 'Memory', value: values[2], color: defaultColors[2] },
      { key: 'theory', label: 'Theory', value: values[3], color: defaultColors[3] },
      { key: 'practice', label: 'Practice', value: values[4], color: defaultColors[4] }
    ];

    await harness.it('Case 1.1: All Zeros ([0, 0, 0, 0, 0])', () => {
      const svg = OnboardingModule._buildSpiderchart(makeAxes([0, 0, 0, 0, 0]));
      harness.assert(typeof svg === 'string' && svg.length > 0, 'Generates valid SVG string');
      harness.assert(svg.includes('viewBox="0 0 160 160"'), 'Has 160x160 viewBox');
      harness.assert(svg.includes('d="M 80.0 80.0 L 80.0 80.0 L 80.0 80.0 L 80.0 80.0 L 80.0 80.0 Z"'), 'Data polygon collapses cleanly to center');
      harness.assert(!svg.includes('NaN'), 'Contains no NaN coordinates');
      harness.assert(!svg.includes('Infinity'), 'Contains no Infinity');
    });

    await harness.it('Case 1.2: All 100s ([100, 100, 100, 100, 100])', () => {
      const svg = OnboardingModule._buildSpiderchart(makeAxes([100, 100, 100, 100, 100]));
      harness.assert(typeof svg === 'string', 'Generates valid SVG');
      harness.assert(svg.includes('80.0 20.0'), 'Vertex 0 reaches max radius (80, 20)');
      harness.assert(!svg.includes('NaN'), 'Contains no NaN');
    });

    await harness.it('Case 1.3: Negative values ([-50, -100, -20, -10, -0.5])', () => {
      const svg = OnboardingModule._buildSpiderchart(makeAxes([-50, -100, -20, -10, -0.5]));
      harness.assert(typeof svg === 'string', 'Generates SVG string without throwing');
      harness.assert(!svg.includes('NaN'), 'Coordinates are real numbers (inverted polar)');
      harness.assert(svg.includes('-50%') && svg.includes('-100%'), 'Labels reflect negative percentages cleanly');
    });

    await harness.it('Case 1.4: Fractional values ([33.33333, 66.66666, 12.34567, 99.99999, 0.00001])', () => {
      const svg = OnboardingModule._buildSpiderchart(makeAxes([33.33333, 66.66666, 12.34567, 99.99999, 0.00001]));
      harness.assert(typeof svg === 'string', 'Generates SVG string');
      harness.assert(!svg.includes('NaN'), 'No NaN in fractional values');
      harness.assert(/M \d+\.\d \d+\.\d/.test(svg), 'Formatted coordinates with 1 decimal precision');
    });

    await harness.it('Case 1.5: Huge values ([10000, 50000, 999999, 100000, 88888])', () => {
      const svg = OnboardingModule._buildSpiderchart(makeAxes([10000, 50000, 999999, 100000, 88888]));
      harness.assert(typeof svg === 'string', 'Generates SVG string');
      harness.assert(!svg.includes('NaN'), 'No NaN in huge values');
      harness.assert(svg.includes('style="overflow: visible;"'), 'SVG has overflow:visible allowing out-of-bounds rendering');
    });

    await harness.it('Case 1.6: String & numeric coercion values ([\'80\', \'50\', \'100\', \'0\', \'25\'])', () => {
      const svg = OnboardingModule._buildSpiderchart(makeAxes(['80', '50', '100', '0', '25']));
      harness.assert(typeof svg === 'string', 'Generates SVG string');
      harness.assert(!svg.includes('NaN'), 'String numbers coerced to valid coordinates');
    });

    await harness.it('Case 1.7: NaN, undefined, and non-numeric string values', () => {
      const svg = OnboardingModule._buildSpiderchart(makeAxes([NaN, undefined, 'corrupted', null, false]));
      harness.assert(typeof svg === 'string', 'Generates SVG string without throwing uncaught exception');
    });

    await harness.it('Case 1.8: XSS and injection payload in labels and colors', () => {
      const maliciousAxes = [
        { key: 'k1', label: '<script>alert("xss")</script>', value: 50, color: 'var(--bronze)" onclick="alert(1)' },
        { key: 'k2', label: '"><img src=x onerror=alert(1)>', value: 75, color: '#ff0000' }
      ];
      const svg = OnboardingModule._buildSpiderchart(maliciousAxes);
      harness.assert(!svg.includes('<script>'), 'Script tags are escaped');
      harness.assert(!svg.includes('<img'), 'Img injection tags are escaped');
      harness.assert(svg.includes('&lt;script&gt;') || svg.includes('&quot;'), 'Injection properly entity-encoded');
    });

    await harness.it('Case 1.9: Variable polygon axis counts (3-gon, 4-gon, 6-gon, 8-gon)', () => {
      for (const n of [3, 4, 6, 8]) {
        const testAxes = Array.from({ length: n }, (_, i) => ({
          key: `axis-${i}`,
          label: `A${i}`,
          value: 50,
          color: '#fff'
        }));
        const svg = OnboardingModule._buildSpiderchart(testAxes);
        harness.assert((svg.match(/<line/g) || []).length === n, `${n}-gon renders exactly ${n} radial spokes`);
        harness.assert((svg.match(/<circle/g) || []).length === n, `${n}-gon renders exactly ${n} data point circles`);
      }
    });
  });

  // =========================================================================
  // 2. RESILIENCE INDEX FORMULA BOUNDARY CONDITIONS & WEIGHT INVARIANCE
  // =========================================================================
  await harness.describe('2. Resilience Index Formula Boundary Conditions & Weight Invariance', async () => {
    const W_SIFT = 0.30;
    const W_ARENA = 0.20;
    const W_MEM = 0.20;
    const W_THEORY = 0.15;
    const W_PRAC = 0.15;

    await harness.it('Weights sum identically to 1.000000', () => {
      const totalWeight = W_SIFT + W_ARENA + W_MEM + W_THEORY + W_PRAC;
      harness.assertCloseTo(totalWeight, 1.0, 1e-12, 'Weight sum is 1.0');
    });

    const computeResilience = (sift, arena, mem, theory, prac) => {
      return Math.min(100, Math.round(
        (sift * W_SIFT) +
        (arena * W_ARENA) +
        (mem * W_MEM) +
        (theory * W_THEORY) +
        (prac * W_PRAC)
      ));
    };

    await harness.it('Boundary: All 0 -> 0%, All 100 -> 100%', () => {
      harness.assertEqual(computeResilience(0, 0, 0, 0, 0), 0, 'All 0 gives 0');
      harness.assertEqual(computeResilience(100, 100, 100, 100, 100), 100, 'All 100 gives 100');
    });

    await harness.it('Isolated individual pillar contributions at 100%', () => {
      harness.assertEqual(computeResilience(100, 0, 0, 0, 0), 30, 'SIFT alone = 30%');
      harness.assertEqual(computeResilience(0, 100, 0, 0, 0), 20, 'Pattern alone = 20%');
      harness.assertEqual(computeResilience(0, 0, 100, 0, 0), 20, 'Memory alone = 20%');
      harness.assertEqual(computeResilience(0, 0, 0, 100, 0), 15, 'Theory alone = 15%');
      harness.assertEqual(computeResilience(0, 0, 0, 0, 100), 15, 'Practice alone = 15%');
    });

    await harness.it('Sub-total combinations sum linearly', () => {
      harness.assertEqual(computeResilience(100, 100, 0, 0, 0), 50, 'SIFT + Pattern = 50%');
      harness.assertEqual(computeResilience(0, 0, 100, 100, 100), 50, 'Memory + Theory + Practice = 50%');
      harness.assertEqual(computeResilience(50, 50, 50, 50, 50), 50, 'All at 50% gives 50%');
      harness.assertEqual(computeResilience(25, 25, 25, 25, 25), 25, 'All at 25% gives 25%');
      harness.assertEqual(computeResilience(75, 75, 75, 75, 75), 75, 'All at 75% gives 75%');
    });

    await harness.it('Monotonicity invariant: Increasing any score never decreases Resilience Index', () => {
      const base = [40, 50, 60, 30, 20];
      const baseRes = computeResilience(...base);

      for (let i = 0; i < 5; i++) {
        const boosted = [...base];
        boosted[i] += 10;
        const boostedRes = computeResilience(...boosted);
        harness.assert(boostedRes >= baseRes, `Boosting axis ${i} by +10 maintains monotonicity (${boostedRes} >= ${baseRes})`);
      }
    });

    await harness.it('Clamping invariant: Overflowing scores clamp at 100%', () => {
      const clampedRes = computeResilience(150, 200, 120, 300, 500);
      harness.assertEqual(clampedRes, 100, 'Score above 100% clamps to 100%');
    });

    await harness.it('Analytical Practice sub-formula clamping (ach*15 + verdad*5 + infowar*20)', () => {
      const ach = 100;
      const verdad = 200;
      const infowar = 50;
      const analyticalPractice = Math.min(100, (ach * 15) + (verdad * 5) + (infowar * 20));
      harness.assertEqual(analyticalPractice, 100, 'Analytical practice clamps to 100 despite large counts');
    });
  });

  // =========================================================================
  // 3. NEXT RECOMMENDED ACTION RULE PRIORITY CONFLICTS & TIE-BREAKING
  // =========================================================================
  await harness.describe('3. Next Recommended Action Priority Conflicts & Tie-Breaking', async () => {
    await harness.it('All-failing profile (P10, P9, P8, P7, P6 all triggered simultaneously)', () => {
      const scores = {
        siftVerification: 10,
        patternRecognition: 10,
        theoreticalDepth: 10,
        memoryRetention: 10,
        analyticalPractice: 10
      };
      const act = OnboardingModule._computeNextAction(scores);
      harness.assertEqual(act.priority, 10, 'Priority 10 strictly wins when all conditions trigger');
      harness.assertEqual(act.label, 'Complete a SIFT Lab drill', 'Action is SIFT Lab');
    });

    await harness.it('P9 wins over P8, P7, P6 when SIFT >= 40', () => {
      const scores = {
        siftVerification: 45,
        patternRecognition: 20,
        theoreticalDepth: 15,
        memoryRetention: 10,
        analyticalPractice: 10
      };
      const act = OnboardingModule._computeNextAction(scores);
      harness.assertEqual(act.priority, 9, 'Priority 9 wins');
      harness.assertEqual(act.label, 'Run an Infinite Arena session', 'Action is Arena');
    });

    await harness.it('P8 wins over P7, P6 when SIFT >= 40 and Arena >= 30', () => {
      const scores = {
        siftVerification: 45,
        patternRecognition: 35,
        theoreticalDepth: 20,
        memoryRetention: 10,
        analyticalPractice: 10
      };
      const act = OnboardingModule._computeNextAction(scores);
      harness.assertEqual(act.priority, 8, 'Priority 8 wins');
      harness.assertEqual(act.label, 'Start Masterclass I', 'Action is Masterclass');
    });

    await harness.it('P7 wins over P6 when SIFT, Arena, Theory are satisfied', () => {
      const scores = {
        siftVerification: 45,
        patternRecognition: 35,
        theoreticalDepth: 30,
        memoryRetention: 15,
        analyticalPractice: 10
      };
      const act = OnboardingModule._computeNextAction(scores);
      harness.assertEqual(act.priority, 7, 'Priority 7 wins');
      harness.assertEqual(act.label, 'Review your Memory Queue', 'Action is Memory Queue');
    });

    await harness.it('P6 wins when only Analytical Practice < 20', () => {
      const scores = {
        siftVerification: 50,
        patternRecognition: 50,
        theoreticalDepth: 50,
        memoryRetention: 50,
        analyticalPractice: 15
      };
      const act = OnboardingModule._computeNextAction(scores);
      harness.assertEqual(act.priority, 6, 'Priority 6 wins');
      harness.assertEqual(act.label, 'Run a VERDAD claim audit', 'Action is VERDAD');
    });

    await harness.it('P5 triggers when SIFT > 60 and Analytical Practice is between 20 and 39', () => {
      const scores = {
        siftVerification: 75,
        patternRecognition: 50,
        theoreticalDepth: 50,
        memoryRetention: 50,
        analyticalPractice: 30
      };
      const act = OnboardingModule._computeNextAction(scores);
      harness.assertEqual(act.priority, 5, 'Priority 5 wins');
      harness.assertEqual(act.label, 'Build an ACH Matrix analysis', 'Action is ACH');
    });

    await harness.it('Boundary threshold analysis for all priority triggers', () => {
      // siftVerification boundary: 39 vs 40
      harness.assertEqual(OnboardingModule._computeNextAction({ siftVerification: 39, patternRecognition: 50, theoreticalDepth: 50, memoryRetention: 50, analyticalPractice: 50 }).priority, 10, 'SIFT 39 triggers P10');
      harness.assertEqual(OnboardingModule._computeNextAction({ siftVerification: 40, patternRecognition: 50, theoreticalDepth: 50, memoryRetention: 50, analyticalPractice: 50 }).priority, 1, 'SIFT 40 passes P10 to fallback');

      // patternRecognition boundary: 29 vs 30
      harness.assertEqual(OnboardingModule._computeNextAction({ siftVerification: 50, patternRecognition: 29, theoreticalDepth: 50, memoryRetention: 50, analyticalPractice: 50 }).priority, 9, 'Pattern 29 triggers P9');
      harness.assertEqual(OnboardingModule._computeNextAction({ siftVerification: 50, patternRecognition: 30, theoreticalDepth: 50, memoryRetention: 50, analyticalPractice: 50 }).priority, 1, 'Pattern 30 passes P9 to fallback');

      // theoreticalDepth boundary: 24 vs 25
      harness.assertEqual(OnboardingModule._computeNextAction({ siftVerification: 50, patternRecognition: 50, theoreticalDepth: 24, memoryRetention: 50, analyticalPractice: 50 }).priority, 8, 'Theory 24 triggers P8');
      harness.assertEqual(OnboardingModule._computeNextAction({ siftVerification: 50, patternRecognition: 50, theoreticalDepth: 25, memoryRetention: 50, analyticalPractice: 50 }).priority, 1, 'Theory 25 passes P8 to fallback');

      // memoryRetention boundary: 19 vs 20
      harness.assertEqual(OnboardingModule._computeNextAction({ siftVerification: 50, patternRecognition: 50, theoreticalDepth: 50, memoryRetention: 19, analyticalPractice: 50 }).priority, 7, 'Memory 19 triggers P7');
      harness.assertEqual(OnboardingModule._computeNextAction({ siftVerification: 50, patternRecognition: 50, theoreticalDepth: 50, memoryRetention: 20, analyticalPractice: 50 }).priority, 1, 'Memory 20 passes P7 to fallback');

      // analyticalPractice boundary: 19 vs 20 (with SIFT <= 60)
      harness.assertEqual(OnboardingModule._computeNextAction({ siftVerification: 50, patternRecognition: 50, theoreticalDepth: 50, memoryRetention: 50, analyticalPractice: 19 }).priority, 6, 'Practice 19 triggers P6');
      harness.assertEqual(OnboardingModule._computeNextAction({ siftVerification: 50, patternRecognition: 50, theoreticalDepth: 50, memoryRetention: 50, analyticalPractice: 20 }).priority, 1, 'Practice 20 with SIFT 50 passes to fallback');

      // ACH boundary: SIFT 60 vs 61 (with Practice = 30)
      harness.assertEqual(OnboardingModule._computeNextAction({ siftVerification: 60, patternRecognition: 50, theoreticalDepth: 50, memoryRetention: 50, analyticalPractice: 30 }).priority, 1, 'SIFT 60 does not trigger P5');
      harness.assertEqual(OnboardingModule._computeNextAction({ siftVerification: 61, patternRecognition: 50, theoreticalDepth: 50, memoryRetention: 50, analyticalPractice: 30 }).priority, 5, 'SIFT 61 with Practice 30 triggers P5');

      // ACH boundary: Practice 39 vs 40 (with SIFT = 70)
      harness.assertEqual(OnboardingModule._computeNextAction({ siftVerification: 70, patternRecognition: 50, theoreticalDepth: 50, memoryRetention: 50, analyticalPractice: 39 }).priority, 5, 'Practice 39 triggers P5');
      harness.assertEqual(OnboardingModule._computeNextAction({ siftVerification: 70, patternRecognition: 50, theoreticalDepth: 50, memoryRetention: 50, analyticalPractice: 40 }).priority, 1, 'Practice 40 passes P5 to fallback');
    });
  });

  // =========================================================================
  // 4. ONBOARDING STATE STORAGE RESILIENCE UNDER CORRUPTED/MISSING KEYS
  // =========================================================================
  await harness.describe('4. Onboarding State Storage Resilience Under Corrupted / Missing Keys', async () => {
    await harness.it('Case 4.1: Completely empty / missing store keys', () => {
      const mockApp = {
        store: {
          get: (k, def) => def || null
        }
      };
      const mod = Object.create(OnboardingModule);
      mod._app = mockApp;

      const scores = mod._computeCompetencyScores();
      harness.assertEqual(scores.siftVerification, 0, 'SIFT is 0');
      harness.assertEqual(scores.patternRecognition, 0, 'Pattern is 0');
      harness.assertEqual(scores.memoryRetention, 0, 'Memory is 0');
      harness.assertEqual(scores.theoreticalDepth, 0, 'Theory is 0');
      harness.assertEqual(scores.analyticalPractice, 0, 'Practice is 0');
      harness.assertEqual(scores.overallResilience, 0, 'Resilience is 0');
      harness.assertEqual(scores.siftPoints, 0, 'Points is 0');
    });

    await harness.it('Case 4.2: Malformed sm2.deck JSON string in computeCompetencyScores', () => {
      const mockApp = {
        store: {
          get: (k) => {
            if (k === 'sm2.deck') return '{"invalid_json: [unclosed';
            return null;
          }
        }
      };
      const mod = Object.create(OnboardingModule);
      mod._app = mockApp;

      const scores = mod._computeCompetencyScores();
      harness.assertEqual(scores.memoryRetention, 0, 'Recovers gracefully to 0% memory coverage on JSON parse error');
    });

    await harness.it('Case 4.3: sm2.deck already an Object / Array (not stringified)', () => {
      const mockApp = {
        store: {
          get: (k) => {
            if (k === 'sm2.deck') return [{ id: 'c1', repetitions: 4 }, { id: 'c2', repetitions: 1 }];
            return null;
          }
        }
      };
      const mod = Object.create(OnboardingModule);
      mod._app = mockApp;

      const scores = mod._computeCompetencyScores();
      harness.assertEqual(scores.memoryRetention, 50, 'Handles raw Array object without double parsing: 50%');
    });

    await harness.it('Case 4.4: Corrupted sift.stats with division by zero or negative counts', () => {
      const mockApp = {
        store: {
          get: (k) => {
            if (k === 'sift.stats') return { correct: 0, total: 0 };
            return null;
          }
        }
      };
      const mod = Object.create(OnboardingModule);
      mod._app = mockApp;

      const scores = mod._computeCompetencyScores();
      harness.assertEqual(scores.siftVerification, 0, 'Division by zero avoided, returns 0');
    });

    await harness.it('Case 4.5: Corrupted cognitive.progress non-object or missing keys', () => {
      const mockApp = {
        store: {
          get: (k) => {
            if (k === 'cognitive.progress') return 'corrupted string';
            return null;
          }
        }
      };
      const mod = Object.create(OnboardingModule);
      mod._app = mockApp;

      const scores = mod._computeCompetencyScores();
      harness.assertEqual(scores.theoreticalDepth, 0, 'Handles non-object cognitive.progress without throwing');
    });

    await harness.it('Case 4.6: StateStore persistence round-trip with corrupted localStorage strings', () => {
      const store = new StateStore({}, { storageKey: 'test_corrupt_store' });
      store._storage.setItem('test_corrupt_store', '{{corrupt json syntax');
      store.load();
      harness.assertEqual(typeof store.getState(), 'object', 'Store survives corrupted raw storage and preserves defaults');
    });

    await harness.it('Case 4.7: SIFT Bridge _enqueueSiftCards behavior in browser-like environment with valid/existing deck', () => {
      let savedKey = null;
      let savedVal = null;
      let badgeUpdated = false;

      // Provide mock DOM for browser environment simulation
      globalThis.document = {
        getElementById: (id) => {
          if (id === 'overview-memory-due-count') {
            return {
              set textContent(v) {
                badgeUpdated = true;
              }
            };
          }
          return null;
        }
      };

      const mockApp = {
        store: {
          get: (k) => {
            if (k === 'sm2.deck') return JSON.stringify([{ id: 'existing-card-1', prompt: 'test', dueDate: '2026-01-01' }]);
            return null;
          },
          set: (k, v) => {
            savedKey = k;
            savedVal = v;
          }
        },
        showToast: () => {}
      };

      const mod = Object.create(OnboardingModule);
      mod._app = mockApp;

      // Enqueue 1 existing and 1 new card
      mod._enqueueSiftCards([
        { id: 'existing-card-1', prompt: 'test' },
        { id: 'new-card-2', prompt: 'new test' }
      ]);

      harness.assertEqual(savedKey, 'sm2.deck', 'sm2.deck updated');
      const parsedDeck = JSON.parse(savedVal);
      harness.assertEqual(parsedDeck.length, 2, 'Deduplication preserved: only 1 new card added');
      harness.assertEqual(parsedDeck[1].id, 'new-card-2', 'New card properly appended');
      harness.assert(badgeUpdated, 'Overview memory due count badge updated');

      // Cleanup
      delete globalThis.document;
    });

    await harness.it('Case 4.8: SIFT Bridge _enqueueSiftCards resilience when sm2.deck in store is null or uninitialized', () => {
      let savedVal = null;
      globalThis.document = {
        getElementById: () => ({ textContent: '' })
      };

      const mockApp = {
        store: {
          get: (k) => null, // empty/null
          set: (k, v) => { savedVal = v; }
        },
        showToast: () => {}
      };

      const mod = Object.create(OnboardingModule);
      mod._app = mockApp;

      mod._enqueueSiftCards([{ id: 'card-1', prompt: 'test' }]);
      const parsed = JSON.parse(savedVal);
      harness.assertEqual(parsed.length, 1, 'Initializes fresh deck array from null');
      harness.assertEqual(parsed[0].id, 'card-1', 'Card added to new deck');

      delete globalThis.document;
    });
  });

  return harness.summary();
}

runAdversarialBattery().then(r => {
  if (r.failed > 0) process.exit(1);
}).catch(err => {
  console.error('Fatal failure running adversarial battery:', err);
  process.exit(1);
});
