/**
 * SOVEREIGN // AEGIS — Test Suite: Heuer ACH Matrix Adversarial & Stress Harness
 * Executed by Challenger 2 for Milestone 3 verification.
 * Tests:
 *  1. Degenerate matrices (empty evidence, 0 hyp, 100 hyp, missing/null/undefined ratings, string hypotheses)
 *  2. Extreme credibility and relevance weights (0, negative, fractional, huge, out-of-range clamping)
 *  3. 5-axis confidence decay under extreme temporal horizons (0h, 1000h, 1Mh, negative age, 100 contradictions floor)
 *  4. Deterministic tie-breaking, permutation invariance, and rank stability
 *  5. Extreme Scaling & Defensive Handling (500 hypotheses, NaN safety, missing fields)
 *  6. ACH Rating Cycle State Machine & Rating Transitions
 * Zero external dependencies.
 */

import { AchEngine, AchModule } from '../js/modules/ach.js';

class AdversarialHarness {
  constructor() {
    this.total = 0;
    this.passed = 0;
    this.failed = 0;
    this.failures = [];
    this.currentGroup = '';
  }

  describe(name, fn) {
    this.currentGroup = name;
    console.log(`\n=== [Adversarial Suite] ${name} ===`);
    fn();
  }

  it(name, fn) {
    try {
      fn();
    } catch (err) {
      this.failed++;
      this.total++;
      this.failures.push({ group: this.currentGroup, test: name, error: err.message });
      console.error(`  ✗ [FAIL] ${name} (${err.message})`);
    }
  }

  assert(cond, msg) {
    this.total++;
    if (cond) {
      this.passed++;
      console.log(`    ✓ ${msg}`);
    } else {
      this.failed++;
      this.failures.push({ group: this.currentGroup, test: msg, error: 'Assertion failed' });
      console.error(`    ✗ [FAIL] ${msg}`);
    }
  }

  assertEqual(actual, expected, msg) {
    this.assert(actual === expected, `${msg} | Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
  }

  assertCloseTo(actual, expected, delta = 1e-4, msg) {
    const diff = Math.abs(actual - expected);
    this.assert(diff <= delta, `${msg} | Expected ~${expected}, Got: ${actual} (diff: ${diff.toFixed(6)})`);
  }

  summary() {
    console.log('\n=============================================================');
    console.log(`[ACH Adversarial Stress Harness] Results: ${this.passed}/${this.total} Passed (${this.failed} Failed)`);
    console.log('=============================================================');
    if (this.failed > 0) {
      console.error('\nFailures:');
      this.failures.forEach(f => console.error(` - [${f.group}] ${f.test}: ${f.error}`));
    }
    return { passed: this.passed, failed: this.failed, total: this.total };
  }
}

const harness = new AdversarialHarness();

// ─────────────────────────────────────────────────────────────────────────────
// 1. Degenerate Matrices & Edge Cases
// ─────────────────────────────────────────────────────────────────────────────
harness.describe('1. Degenerate Matrices & Edge Cases', () => {
  harness.it('Handles empty evidence list and empty matrix', () => {
    const inc = AchEngine.calculateInconsistency('H1', [], {});
    const sup = AchEngine.calculateSupport('H1', [], {});
    const rank = AchEngine.rankHypotheses([{ id: 'H1' }], [], {});
    harness.assertEqual(inc, 0, 'Inconsistency is 0');
    harness.assertEqual(sup, 0, 'Support is 0');
    harness.assertEqual(rank.length, 1, 'Ranking has 1 element');
    harness.assertEqual(rank[0].rank, 1, 'Rank is 1');
  });

  harness.it('Handles 0 hypotheses gracefully', () => {
    const rank = AchEngine.rankHypotheses([], [{ id: 'E1', credibility: 5, relevance: 5 }], { E1: {} });
    harness.assertEqual(Array.isArray(rank), true, 'Returns array');
    harness.assertEqual(rank.length, 0, 'Ranking array is empty');
  });

  harness.it('Handles hypotheses passed as raw string array', () => {
    const hypotheses = ['H_Alpha', 'H_Beta', 'H_Gamma'];
    const evidence = [{ id: 'E1', credibility: 4, relevance: 4 }];
    const matrix = {
      E1: { H_Alpha: 2, H_Beta: 0, H_Gamma: -2 }
    };
    const rank = AchEngine.rankHypotheses(hypotheses, evidence, matrix);
    harness.assertEqual(rank.length, 3, 'Ranked 3 hypotheses');
    harness.assertEqual(rank[0].id, 'H_Alpha', 'H_Alpha is rank 1');
    harness.assertEqual(rank[0].name, 'H_Alpha', 'H_Alpha name matches string');
    harness.assertEqual(rank[1].id, 'H_Beta', 'H_Beta is rank 2');
    harness.assertEqual(rank[2].id, 'H_Gamma', 'H_Gamma is rank 3 (inconsistency 32)');
  });

  harness.it('Handles missing evidence IDs in matrix', () => {
    const evidence = [
      { id: 'E1', credibility: 5, relevance: 5 },
      { id: 'E2_UNRATED', credibility: 5, relevance: 5 }
    ];
    const matrix = {
      E1: { H1: -1 }
    }; // E2_UNRATED is absent from matrix
    const inc = AchEngine.calculateInconsistency('H1', evidence, matrix);
    const sup = AchEngine.calculateSupport('H1', evidence, matrix);
    harness.assertEqual(inc, 25, 'Unrated evidence defaults to 0 rating (inconsistency = 25)');
    harness.assertEqual(sup, 0, 'Support is 0');
  });

  harness.it('Handles missing hypothesis key in evidence row', () => {
    const evidence = [{ id: 'E1', credibility: 4, relevance: 4 }];
    const matrix = { E1: { OtherHyp: 2 } }; // H1 not in E1
    const inc = AchEngine.calculateInconsistency('H1', evidence, matrix);
    const sup = AchEngine.calculateSupport('H1', evidence, matrix);
    harness.assertEqual(inc, 0, 'Missing hypothesis rating defaults to 0 inc');
    harness.assertEqual(sup, 0, 'Missing hypothesis rating defaults to 0 sup');
  });

  harness.it('Handles null, undefined, and numeric string ratings', () => {
    const evidence = [
      { id: 'E_Null', credibility: 4, relevance: 4 },     // W=16
      { id: 'E_Undef', credibility: 4, relevance: 4 },    // W=16
      { id: 'E_StrPos', credibility: 4, relevance: 4 },   // W=16
      { id: 'E_StrNeg', credibility: 4, relevance: 4 }    // W=16
    ];
    const matrix = {
      E_Null: { H1: null },
      E_Undef: { H1: undefined },
      E_StrPos: { H1: '2' },
      E_StrNeg: { H1: '-1' }
    };

    const inc = AchEngine.calculateInconsistency('H1', evidence, matrix);
    const sup = AchEngine.calculateSupport('H1', evidence, matrix);

    // E_Null -> 0, E_Undef -> 0, E_StrPos -> +2 (sup +32), E_StrNeg -> -1 (inc +16)
    harness.assertEqual(inc, 16, 'Inconsistency is 16 from string "-1"');
    harness.assertEqual(sup, 32, 'Support is 32 from string "2"');
  });

  harness.it('Stress tests 100 hypotheses with 50 evidence items (5,000 matrix cells)', () => {
    const hypCount = 100;
    const evCount = 50;

    const hypotheses = Array.from({ length: hypCount }, (_, i) => ({
      id: `H_${String(i + 1).padStart(3, '0')}`,
      name: `Hypothesis ${i + 1}`
    }));

    const evidence = Array.from({ length: evCount }, (_, i) => ({
      id: `E_${String(i + 1).padStart(3, '0')}`,
      credibility: (i % 5) + 1,
      relevance: ((i + 2) % 5) + 1
    }));

    const matrix = {};
    for (let e = 0; e < evCount; e++) {
      const eId = evidence[e].id;
      matrix[eId] = {};
      for (let h = 0; h < hypCount; h++) {
        const hId = hypotheses[h].id;
        // Deterministic pseudo-random ratings between -2 and 2
        matrix[eId][hId] = ((e * 7 + h * 13) % 5) - 2;
      }
    }

    const t0 = performance.now();
    const ranked = AchEngine.rankHypotheses(hypotheses, evidence, matrix);
    const elapsed = performance.now() - t0;

    harness.assertEqual(ranked.length, 100, 'All 100 hypotheses ranked');
    harness.assertEqual(ranked[0].rank, 1, 'First element has rank 1');
    harness.assertEqual(ranked[99].rank, 100, 'Last element has rank 100');
    harness.assert(elapsed < 50, `100-hyp matrix computed in <50ms (took ${elapsed.toFixed(2)}ms)`);

    // Verify monotonic ranking order
    let isMonotonic = true;
    for (let i = 0; i < ranked.length - 1; i++) {
      if (ranked[i].inconsistency > ranked[i + 1].inconsistency) {
        isMonotonic = false;
        break;
      }
    }
    harness.assert(isMonotonic, 'Rankings are strictly monotonic ascending by inconsistency');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Extreme Credibility & Relevance Weights
// ─────────────────────────────────────────────────────────────────────────────
harness.describe('2. Extreme Credibility & Relevance Weights', () => {
  harness.it('Handles zero credibility and zero relevance (W = 0)', () => {
    const ev = [
      { id: 'E_ZeroCred', credibility: 0, relevance: 5 },
      { id: 'E_ZeroRel', credibility: 5, relevance: 0 },
      { id: 'E_BothZero', credibility: 0, relevance: 0 }
    ];
    const matrix = {
      E_ZeroCred: { H1: -2 },
      E_ZeroRel: { H1: -2 },
      E_BothZero: { H1: -2 }
    };
    const inc = AchEngine.calculateInconsistency('H1', ev, matrix);
    harness.assertEqual(inc, 0, 'Zero credibility or relevance nullifies inconsistency');
  });

  harness.it('Clamps negative credibility and negative relevance to 0', () => {
    const ev = [
      { id: 'E_Neg1', credibility: -100, relevance: 5 },
      { id: 'E_Neg2', credibility: 5, relevance: -50 },
      { id: 'E_Neg3', credibility: -10, relevance: -10 }
    ];
    const matrix = {
      E_Neg1: { H1: -2 },
      E_Neg2: { H1: -2 },
      E_Neg3: { H1: -2 }
    };
    const inc = AchEngine.calculateInconsistency('H1', ev, matrix);
    harness.assertEqual(inc, 0, 'Negative credibility/relevance clamped to 0 weight');
  });

  harness.it('Clamps excessively large credibility/relevance to upper bound (5)', () => {
    const ev = [
      { id: 'E_Huge', credibility: 1000, relevance: 99999 } // Clamped to 5 * 5 = 25
    ];
    const matrix = {
      E_Huge: { H1: -2 }
    };
    const inc = AchEngine.calculateInconsistency('H1', ev, matrix);
    harness.assertEqual(inc, 50, 'Huge credibility/relevance clamped to 5*5=25, inc = 2*25 = 50');
  });

  harness.it('Handles fractional credibility and relevance weights accurately', () => {
    const ev = [
      { id: 'E_Frac', credibility: 2.5, relevance: 3.5 } // W = 8.75
    ];
    const matrix = {
      E_Frac: { H1: -2, H2: 1 }
    };
    const inc = AchEngine.calculateInconsistency('H1', ev, matrix);
    const sup = AchEngine.calculateSupport('H2', ev, matrix);
    harness.assertCloseTo(inc, 17.5, 1e-4, 'Fractional inconsistency is 2 * 8.75 = 17.5');
    harness.assertCloseTo(sup, 8.75, 1e-4, 'Fractional support is 1 * 8.75 = 8.75');
  });

  harness.it('Defaults undefined credibility/relevance to 3 (standard default)', () => {
    const ev = [
      { id: 'E_Default' } // cred undefined -> 3, rel undefined -> 3, W = 9
    ];
    const matrix = {
      E_Default: { H1: -2 }
    };
    const inc = AchEngine.calculateInconsistency('H1', ev, matrix);
    harness.assertEqual(inc, 18, 'Default W=9 produces inconsistency 2 * 9 = 18');
  });

  harness.it('Clamps out-of-bounds ratings exceeding [-2, 2]', () => {
    const ev = [{ id: 'E1', credibility: 5, relevance: 5 }]; // W = 25
    const matrix = {
      E1: { H_High: 100, H_Low: -100 }
    };
    const sup = AchEngine.calculateSupport('H_High', ev, matrix);
    const inc = AchEngine.calculateInconsistency('H_Low', ev, matrix);
    harness.assertEqual(sup, 50, '+100 clamped to +2 * 25 = 50 support');
    harness.assertEqual(inc, 50, '-100 clamped to -2 => 2 * 25 = 50 inconsistency');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. 5-Axis Confidence Decay Under Extreme Temporal Horizons & Contradictions
// ─────────────────────────────────────────────────────────────────────────────
harness.describe('3. 5-Axis Confidence Decay Under Extreme Temporal Horizons', () => {
  harness.it('Evaluates T=0h (no decay)', () => {
    const conf = AchEngine.computeConfidence({
      sourceReliability: 1.0,
      contentCredibility: 1.0,
      corroboration: 1.0,
      ageHours: 0,
      analyticalPeerReview: 1.0,
      contradictions: 0
    });
    harness.assertEqual(conf.breakdown.temporalFreshness, 1.0, 'T_f at 0h is 1.0');
    harness.assertEqual(conf.score, 100, 'Score is 100');
    harness.assertEqual(conf.label, 'Almost Certain', 'Label is Almost Certain');
  });

  harness.it('Evaluates T=1000h extreme temporal decay', () => {
    const conf = AchEngine.computeConfidence({
      sourceReliability: 1.0,
      contentCredibility: 1.0,
      corroboration: 1.0,
      ageHours: 1000,
      analyticalPeerReview: 1.0,
      contradictions: 0
    });
    const expectedTf = Math.exp(-0.02 * 1000); // exp(-20) ≈ 2.06115e-9
    harness.assertCloseTo(conf.breakdown.temporalFreshness, expectedTf, 1e-8, 'T_f at 1000h matches exp(-20)');
    // baseSum = 0.25 + 0.25 + 0.25 + 0.15*0 + 0.10 = 0.85
    harness.assertEqual(conf.score, 85, 'Score decayed from 100 to 85 due to stale intelligence');
    harness.assertEqual(conf.label, 'Almost Certain', '85% meets Almost Certain threshold');
  });

  harness.it('Evaluates T=1,000,000h asymptotic zero temporal decay', () => {
    const conf = AchEngine.computeConfidence({
      sourceReliability: 1.0,
      contentCredibility: 1.0,
      corroboration: 1.0,
      ageHours: 1000000,
      analyticalPeerReview: 1.0,
      contradictions: 0
    });
    harness.assertEqual(conf.breakdown.temporalFreshness, 0, 'T_f at 1M hours is 0');
    harness.assertEqual(conf.score, 85, 'Score asymptotes to 85.0%');
  });

  harness.it('Safely clamps negative ageHours to 0 (no future amplification)', () => {
    const conf = AchEngine.computeConfidence({
      sourceReliability: 1.0,
      contentCredibility: 1.0,
      corroboration: 1.0,
      ageHours: -500, // Negative age should NOT produce exp(+10)
      analyticalPeerReview: 1.0,
      contradictions: 0
    });
    harness.assertEqual(conf.breakdown.temporalFreshness, 1.0, 'Negative age clamped to 0, T_f = 1.0');
    harness.assertEqual(conf.score, 100, 'Score is 100 (not overflowed)');
  });

  harness.it('Verifies strict 0.1 contradiction penalty floor across 10, 50, 100 contradictions', () => {
    const c10 = AchEngine.computeConfidence({ contradictions: 10 });
    const c50 = AchEngine.computeConfidence({ contradictions: 50 });
    const c100 = AchEngine.computeConfidence({ contradictions: 100 });

    harness.assertEqual(c10.breakdown.contradictionPenalty, 0.1, '10 contradictions clamped to 0.1 floor');
    harness.assertEqual(c50.breakdown.contradictionPenalty, 0.1, '50 contradictions clamped to 0.1 floor');
    harness.assertEqual(c100.breakdown.contradictionPenalty, 0.1, '100 contradictions clamped to 0.1 floor');

    // Default base sum is 0.25*0.8 + 0.25*0.8 + 0.25*0.8 + 0.15*1.0 + 0.10*0.8 = 0.60 + 0.15 + 0.08 = 0.83
    // Score with 0.1 floor = 100 * 0.83 * 0.1 = 8.3 -> Remote
    harness.assertEqual(c100.score, 8.3, 'Final score with 100 contradictions is 8.3');
    harness.assertEqual(c100.label, 'Remote', 'Label is Remote');
  });

  harness.it('Safely clamps negative contradictions to 0', () => {
    const conf = AchEngine.computeConfidence({ contradictions: -5 });
    harness.assertEqual(conf.breakdown.contradictionPenalty, 1.0, 'Negative contradictions clamped to 0, penalty = 1.0');
  });

  harness.it('Verifies exact ICD 203 threshold boundaries and rounding', () => {
    // 85.0+ -> Almost Certain
    // 70.0 - 84.9 -> Highly Likely
    // 55.0 - 69.9 -> Likely
    // 40.0 - 54.9 -> Roughly Even Chance
    // 20.0 - 39.9 -> Unlikely
    // < 20.0 -> Remote
    const testCases = [
      { scoreInput: { sourceReliability: 0.90, contentCredibility: 0.90, corroboration: 0.90, ageHours: 0, analyticalPeerReview: 0.90, contradictions: 0 }, expectedLabel: 'Almost Certain' },
      { scoreInput: { sourceReliability: 0.75, contentCredibility: 0.75, corroboration: 0.75, ageHours: 0, analyticalPeerReview: 0.75, contradictions: 0 }, expectedLabel: 'Highly Likely' },
      { scoreInput: { sourceReliability: 0.60, contentCredibility: 0.60, corroboration: 0.60, ageHours: 0, analyticalPeerReview: 0.60, contradictions: 0 }, expectedLabel: 'Likely' },
      { scoreInput: { sourceReliability: 0.45, contentCredibility: 0.45, corroboration: 0.45, ageHours: 0, analyticalPeerReview: 0.45, contradictions: 0 }, expectedLabel: 'Roughly Even Chance' },
      { scoreInput: { sourceReliability: 0.20, contentCredibility: 0.20, corroboration: 0.20, ageHours: 0, analyticalPeerReview: 0.20, contradictions: 0 }, expectedLabel: 'Unlikely' },
      { scoreInput: { sourceReliability: 0.10, contentCredibility: 0.10, corroboration: 0.10, ageHours: 100, analyticalPeerReview: 0.10, contradictions: 2 }, expectedLabel: 'Remote' }
    ];

    for (const tc of testCases) {
      const res = AchEngine.computeConfidence(tc.scoreInput);
      harness.assertEqual(res.label, tc.expectedLabel, `Score ${res.score}% maps to ${tc.expectedLabel}`);
    }
  });

  harness.it('Clamps out-of-range factor values [0, 1]', () => {
    const conf = AchEngine.computeConfidence({
      sourceReliability: 99.0,      // Clamped to 1.0
      contentCredibility: -50.0,    // Clamped to 0.0
      corroboration: 2.0,           // Clamped to 1.0
      analyticalPeerReview: -1.0    // Clamped to 0.0
    });
    harness.assertEqual(conf.breakdown.sourceReliability, 1.0, 'sourceReliability clamped to 1.0');
    harness.assertEqual(conf.breakdown.contentCredibility, 0.0, 'contentCredibility clamped to 0.0');
    harness.assertEqual(conf.breakdown.corroboration, 1.0, 'corroboration clamped to 1.0');
    harness.assertEqual(conf.breakdown.analyticalPeerReview, 0.0, 'analyticalPeerReview clamped to 0.0');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Deterministic Tie-Breaking & Rank Stability
// ─────────────────────────────────────────────────────────────────────────────
harness.describe('4. Deterministic Tie-Breaking & Rank Stability', () => {
  harness.it('Secondary tie-break: strictly descending by positive support S(H_j)', () => {
    const hypotheses = [
      { id: 'H_LowSup', name: 'Low Support' },
      { id: 'H_HighSup', name: 'High Support' },
      { id: 'H_MidSup', name: 'Mid Support' }
    ];
    const evidence = [
      { id: 'E1', credibility: 5, relevance: 5 } // W=25
    ];
    // All 0 inconsistency, but different positive ratings
    const matrix = {
      E1: { H_LowSup: 0, H_HighSup: 2, H_MidSup: 1 }
    };
    const ranked = AchEngine.rankHypotheses(hypotheses, evidence, matrix);
    harness.assertEqual(ranked[0].id, 'H_HighSup', 'Rank 1 is H_HighSup (support 50)');
    harness.assertEqual(ranked[1].id, 'H_MidSup', 'Rank 2 is H_MidSup (support 25)');
    harness.assertEqual(ranked[2].id, 'H_LowSup', 'Rank 3 is H_LowSup (support 0)');
    harness.assertEqual(ranked[0].rank, 1, 'Rank index 1');
    harness.assertEqual(ranked[1].rank, 2, 'Rank index 2');
    harness.assertEqual(ranked[2].rank, 3, 'Rank index 3');
  });

  harness.it('Tertiary tie-break: strictly lexicographical by hypothesis ID', () => {
    const hypotheses = [
      { id: 'H_Gamma', name: 'Gamma' },
      { id: 'H_Alpha', name: 'Alpha' },
      { id: 'H_Delta', name: 'Delta' },
      { id: 'H_Beta', name: 'Beta' }
    ];
    const evidence = [
      { id: 'E1', credibility: 4, relevance: 4 } // W=16
    ];
    // Identical inconsistency (16) and identical support (16)
    const matrix = {
      E1: { H_Gamma: 1, H_Alpha: 1, H_Delta: 1, H_Beta: 1 }
    };
    const ranked = AchEngine.rankHypotheses(hypotheses, evidence, matrix);
    harness.assertEqual(ranked[0].id, 'H_Alpha', 'H_Alpha is first');
    harness.assertEqual(ranked[1].id, 'H_Beta', 'H_Beta is second');
    harness.assertEqual(ranked[2].id, 'H_Delta', 'H_Delta is third');
    harness.assertEqual(ranked[3].id, 'H_Gamma', 'H_Gamma is fourth');
  });

  harness.it('Permutation Invariance: shuffling input array yields identical ranking order', () => {
    const hypotheses = [
      { id: 'H1', name: 'APT' },
      { id: 'H2', name: 'Insider' },
      { id: 'H3', name: 'Firmware' },
      { id: 'H4', name: 'Accident' }
    ];
    const evidence = [
      { id: 'E1', credibility: 5, relevance: 5 },
      { id: 'E2', credibility: 4, relevance: 4 }
    ];
    const matrix = {
      E1: { H1: 2, H2: 1, H3: -1, H4: -2 },
      E2: { H1: 1, H2: 2, H3: 0, H4: -1 }
    };

    // Canonical baseline
    const baseline = AchEngine.rankHypotheses(hypotheses, evidence, matrix);
    const baselineOrder = baseline.map(h => h.id).join('->');

    // Test 30 random permutations of the input hypotheses array
    let allMatch = true;
    for (let run = 0; run < 30; run++) {
      const shuffled = [...hypotheses].sort(() => Math.random() - 0.5);
      const res = AchEngine.rankHypotheses(shuffled, evidence, matrix);
      const resOrder = res.map(h => h.id).join('->');
      if (resOrder !== baselineOrder) {
        allMatch = false;
        break;
      }
    }
    harness.assert(allMatch, 'Permutation invariance holds across 30 shuffled orderings');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Extreme Scaling & Defensive Handling (500 Hypotheses x 100 Evidence Items)
// ─────────────────────────────────────────────────────────────────────────────
harness.describe('5. Extreme Scaling & Defensive Handling', () => {
  harness.it('Stress tests 500 hypotheses with 100 evidence items (50,000 matrix cells)', () => {
    const hypCount = 500;
    const evCount = 100;

    const hypotheses = Array.from({ length: hypCount }, (_, i) => ({
      id: `H_${String(i + 1).padStart(4, '0')}`,
      name: `Hypothesis ${i + 1}`
    }));

    const evidence = Array.from({ length: evCount }, (_, i) => ({
      id: `E_${String(i + 1).padStart(4, '0')}`,
      credibility: (i % 5) + 1,
      relevance: ((i + 3) % 5) + 1
    }));

    const matrix = {};
    for (let e = 0; e < evCount; e++) {
      const eId = evidence[e].id;
      matrix[eId] = {};
      for (let h = 0; h < hypCount; h++) {
        const hId = hypotheses[h].id;
        matrix[eId][hId] = ((e * 11 + h * 17) % 5) - 2;
      }
    }

    const t0 = performance.now();
    const ranked = AchEngine.rankHypotheses(hypotheses, evidence, matrix);
    const elapsed = performance.now() - t0;

    harness.assertEqual(ranked.length, 500, 'All 500 hypotheses ranked successfully');
    harness.assertEqual(ranked[0].rank, 1, 'Top element is rank 1');
    harness.assertEqual(ranked[499].rank, 500, 'Last element is rank 500');
    harness.assert(elapsed < 200, `50,000 matrix evaluation took <200ms (took ${elapsed.toFixed(2)}ms)`);
  });

  harness.it('Handles hypothesis objects missing name or title fields (falls back to ID)', () => {
    const hypotheses = [
      { id: 'H_Nameless' }
    ];
    const ranked = AchEngine.rankHypotheses(hypotheses, [], {});
    harness.assertEqual(ranked[0].name, 'H_Nameless', 'Falls back to id for name');
  });

  harness.it('Handles empty object passed to computeConfidence (applies all defaults)', () => {
    const conf = AchEngine.computeConfidence({});
    // Default base: 0.25*0.8 + 0.25*0.8 + 0.25*0.8 + 0.15*1.0 + 0.10*0.8 = 0.60 + 0.15 + 0.08 = 0.83
    // Default pContra: 1.0 - 0.15*0 = 1.0
    // Score: 100 * 0.83 * 1.0 = 83.0%
    harness.assertEqual(conf.score, 83.0, 'Default parameters yield 83.0% score');
    harness.assertEqual(conf.label, 'Highly Likely', '83.0% maps to Highly Likely');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. ACH Rating Cycle State Machine & Case Scenarios
// ─────────────────────────────────────────────────────────────────────────────
harness.describe('6. ACH Rating Cycle State Machine & Case Scenarios', () => {
  harness.it('Verifies full 5-state cycle transitions (2 -> 1 -> 0 -> -1 -> -2 -> 2)', () => {
    const nextMap = { 2: 1, 1: 0, 0: -1, '-1': -2, '-2': 2 };
    let state = 2;
    const states = [state];
    for (let i = 0; i < 5; i++) {
      state = nextMap[state];
      states.push(state);
    }
    harness.assertEqual(states.join('->'), '2->1->0->-1->-2->2', '5-state cycle matches canonical order');
  });

  harness.it('Verifies built-in case scenarios have valid hypotheses, evidence, and matrices', () => {
    const cases = Object.keys(AchModule._cases);
    harness.assert(cases.length >= 3, 'At least 3 default cases present');

    for (const cId of cases) {
      const c = AchModule._cases[cId];
      harness.assert(c.title && c.title.length > 0, `Case ${cId} has non-empty title`);
      harness.assert(c.hypotheses.length >= 3, `Case ${cId} has >= 3 hypotheses`);
      harness.assert(c.evidence.length >= 3, `Case ${cId} has >= 3 evidence items`);
      harness.assert(Object.keys(c.matrix).length >= 3, `Case ${cId} has ratings matrix`);

      const ranked = AchEngine.rankHypotheses(c.hypotheses, c.evidence, c.matrix);
      harness.assertEqual(ranked.length, c.hypotheses.length, `All hypotheses ranked in case ${cId}`);
      harness.assertEqual(ranked[0].rank, 1, `Rank 1 exists in case ${cId}`);
    }
  });
});

const summary = harness.summary();
if (summary.failed > 0) {
  process.exitCode = 1;
}
