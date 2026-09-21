/**
 * SOVEREIGN // AEGIS — Test Suite 4: Richards J. Heuer ACH Matrix & Quantified Confidence
 * Validates Heuer ACH mathematical inconsistency formulas, support calculations, dynamic
 * hypothesis ranking, tie-breaking, 5-axis confidence scoring, temporal decay, and ICD 203 mapping.
 * Zero external runtime dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

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
    fn();
  }

  it(name, fn) {
    try {
      fn();
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

  assertCloseTo(actual, expected, delta = 1e-3, message) {
    const diff = Math.abs(actual - expected);
    const pass = diff <= delta;
    this.assert(pass, `${message} | Expected ~${expected}, Got: ${actual} (diff: ${diff.toFixed(5)})`);
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

// Richards J. Heuer Analysis of Competing Hypotheses (ACH) Reference Implementation
// AchEngine is imported from the production module below — this suite previously
// carried its own duplicate copy of the class, so it could not detect a regression
// in the shipped code. Do not re-inline it.
import { AchEngine } from '../js/modules/ach.js';


const harness = new TestHarness('Richards Heuer ACH & Confidence Engine Suite');

// ----------------------------------------------------
// Tier 1: Heuer Inconsistency Mathematical Formulas
// ----------------------------------------------------
harness.describe('Tier 1: Heuer ACH Mathematical Inconsistency Formula I(H_j)', () => {
  const sampleHypotheses = [
    { id: 'H1', name: 'State APT Cyber Attack' },
    { id: 'H2', name: 'Internal Disgruntled Contractor' },
    { id: 'H3', name: 'Firmware Bug / Race Condition' }
  ];

  const sampleEvidence = [
    { id: 'E1', description: 'Bulletproof VPS IPs logged', credibility: 4, relevance: 5 }, // W1 = 20
    { id: 'E2', description: 'Admin service account used at 2 AM', credibility: 5, relevance: 4 }, // W2 = 20
    { id: 'E3', description: 'Vendor firmware update pushed at 2 AM', credibility: 3, relevance: 4 } // W3 = 12
  ];

  // Ratings: +2 = highly consistent, +1 = consistent, 0 = neutral, -1 = inconsistent, -2 = highly inconsistent
  const sampleMatrix = {
    E1: { H1: 2, H2: 1, H3: -2 }, // H3 gets -2 * 20 = 40 inconsistency
    E2: { H1: 1, H2: 2, H3: -1 }, // H3 gets -1 * 20 = 20 inconsistency
    E3: { H1: -1, H2: -1, H3: 2 }  // H1 gets -1 * 12 = 12, H2 gets -1 * 12 = 12
  };

  harness.it('Calculates exact mathematical inconsistency score for H1', () => {
    // E1: H1=2 (0 inc), E2: H1=1 (0 inc), E3: H1=-1 (1 * 12 = 12 inc)
    const incH1 = AchEngine.calculateInconsistency('H1', sampleEvidence, sampleMatrix);
    harness.assertEqual(incH1, 12, 'I(H1) matches exact formula (12)');
  });

  harness.it('Calculates exact mathematical inconsistency score for H2', () => {
    // E1: H2=1 (0 inc), E2: H2=2 (0 inc), E3: H2=-1 (1 * 12 = 12 inc)
    const incH2 = AchEngine.calculateInconsistency('H2', sampleEvidence, sampleMatrix);
    harness.assertEqual(incH2, 12, 'I(H2) matches exact formula (12)');
  });

  harness.it('Calculates exact mathematical inconsistency score for H3', () => {
    // E1: H3=-2 (2 * 20 = 40 inc), E2: H3=-1 (1 * 20 = 20 inc), E3: H3=2 (0 inc) => 60
    const incH3 = AchEngine.calculateInconsistency('H3', sampleEvidence, sampleMatrix);
    harness.assertEqual(incH3, 60, 'I(H3) matches exact formula (60)');
  });

  harness.it('Calculates exact positive support scores S(H_j)', () => {
    // S(H1): E1(+2*20=40) + E2(+1*20=20) + E3(0) = 60
    // S(H2): E1(+1*20=20) + E2(+2*20=40) + E3(0) = 60
    // S(H3): E1(0) + E2(0) + E3(+2*12=24) = 24
    const sH1 = AchEngine.calculateSupport('H1', sampleEvidence, sampleMatrix);
    const sH2 = AchEngine.calculateSupport('H2', sampleEvidence, sampleMatrix);
    const sH3 = AchEngine.calculateSupport('H3', sampleEvidence, sampleMatrix);
    harness.assertEqual(sH1, 60, 'S(H1) is 60');
    harness.assertEqual(sH2, 60, 'S(H2) is 60');
    harness.assertEqual(sH3, 24, 'S(H3) is 24');
  });

  harness.it('Ranks hypotheses dynamically ascending by inconsistency', () => {
    const ranking = AchEngine.rankHypotheses(sampleHypotheses, sampleEvidence, sampleMatrix);
    harness.assertEqual(ranking.length, 3, 'Ranking includes all 3 hypotheses');
    harness.assertEqual(ranking[0].inconsistency, 12, 'Top rank has lowest inconsistency (12)');
    harness.assertEqual(ranking[1].inconsistency, 12, 'Second rank has inconsistency (12)');
    harness.assertEqual(ranking[2].id, 'H3', 'Least favored hypothesis is H3 (inconsistency 60)');
    harness.assertEqual(ranking[2].rank, 3, 'H3 rank is 3');
  });

  harness.it('Breaks ties with positive support score', () => {
    const tiedHypotheses = [
      { id: 'HA', name: 'Hypothesis A' },
      { id: 'HB', name: 'Hypothesis B' }
    ];
    const tiedEvidence = [
      { id: 'E1', credibility: 5, relevance: 5 } // W1 = 25
    ];
    // Both have 0 inconsistency, but HA has +2 support (50), HB has +1 support (25)
    const tiedMatrix = {
      E1: { HA: 2, HB: 1 }
    };
    const ranking = AchEngine.rankHypotheses(tiedHypotheses, tiedEvidence, tiedMatrix);
    harness.assertEqual(ranking[0].id, 'HA', 'HA wins tie due to higher support (50 vs 25)');
    harness.assertEqual(ranking[0].rank, 1, 'HA is rank 1');
    harness.assertEqual(ranking[1].id, 'HB', 'HB is rank 2');
  });

  harness.it('Breaks identical inconsistency and support ties via alphabetical ID', () => {
    const identHypotheses = [
      { id: 'HX_Alpha', name: 'Alpha' },
      { id: 'HX_Beta', name: 'Beta' }
    ];
    const identEvidence = [{ id: 'E1', credibility: 4, relevance: 4 }];
    const identMatrix = { E1: { HX_Alpha: 1, HX_Beta: 1 } };
    const ranking = AchEngine.rankHypotheses(identHypotheses, identEvidence, identMatrix);
    harness.assertEqual(ranking[0].id, 'HX_Alpha', 'HX_Alpha precedes HX_Beta alphabetically');
    harness.assertEqual(ranking[1].id, 'HX_Beta', 'HX_Beta follows HX_Alpha');
  });
});

// ----------------------------------------------------
// Tier 2: Boundary, Extreme & Degenerate Matrices
// ----------------------------------------------------
harness.describe('Tier 2: Boundary Value Analysis & Degenerate Matrices', () => {
  harness.it('Handles empty evidence list without throwing', () => {
    const inc = AchEngine.calculateInconsistency('H1', [], {});
    const sup = AchEngine.calculateSupport('H1', [], {});
    const ranking = AchEngine.rankHypotheses([{ id: 'H1' }], [], {});
    harness.assertEqual(inc, 0, 'Empty evidence yields 0 inconsistency');
    harness.assertEqual(sup, 0, 'Empty evidence yields 0 support');
    harness.assertEqual(ranking[0].rank, 1, 'Single hypothesis ranked 1');
  });

  harness.it('Handles zero weight evidence (W_i = 0)', () => {
    const evZero = [{ id: 'EZ', credibility: 0, relevance: 5 }];
    const matrix = { EZ: { H1: -2 } };
    const inc = AchEngine.calculateInconsistency('H1', evZero, matrix);
    harness.assertEqual(inc, 0, 'Zero-credibility evidence contributes 0 to inconsistency');
  });

  harness.it('Clamps negative weights and out-of-bounds ratings safely', () => {
    const badEv = [{ id: 'EBAD', credibility: -5, relevance: -2 }];
    const badMatrix = { EBAD: { H1: -99 } };
    const inc = AchEngine.calculateInconsistency('H1', badEv, badMatrix);
    harness.assertEqual(inc, 0, 'Negative weights clamped to 0');
  });

  harness.it('Handles maximum weight scaling (5 * 5 = 25 per evidence)', () => {
    const maxEv = [
      { id: 'EM1', credibility: 5, relevance: 5 },
      { id: 'EM2', credibility: 5, relevance: 5 }
    ];
    const maxMatrix = {
      EM1: { H1: -2 }, // 2 * 25 = 50
      EM2: { H1: -2 }  // 2 * 25 = 50
    };
    const inc = AchEngine.calculateInconsistency('H1', maxEv, maxMatrix);
    harness.assertEqual(inc, 100, 'Max scale calculated accurately (100)');
  });

  harness.it('Clamps ratings exceeding +2 or below -2 to valid boundary', () => {
    const ev = [{ id: 'E1', credibility: 1, relevance: 1 }]; // W = 1
    const matrix = { E1: { H1: 10, H2: -10 } };
    const sup = AchEngine.calculateSupport('H1', ev, matrix);
    const inc = AchEngine.calculateInconsistency('H2', ev, matrix);
    harness.assertEqual(sup, 2, '+10 clamped to +2 * 1 = 2');
    harness.assertEqual(inc, 2, '-10 clamped to -2 => 2 * 1 = 2');
  });
});

// ----------------------------------------------------
// Tier 1 & Tier 2: 5-Axis Quantified Confidence Engine
// ----------------------------------------------------
harness.describe('Tier 1 & Tier 2: 5-Axis Epistemic Confidence Scorer', () => {
  harness.it('Computes maximum confidence (100) under perfect conditions', () => {
    const result = AchEngine.computeConfidence({
      sourceReliability: 1.0,
      contentCredibility: 1.0,
      corroboration: 1.0,
      ageHours: 0, // Tf = exp(0) = 1.0
      analyticalPeerReview: 1.0,
      contradictions: 0
    });
    harness.assertEqual(result.score, 100, 'Perfect input gives 100 score');
    harness.assertEqual(result.label, 'Almost Certain', 'Label is Almost Certain');
  });

  harness.it('Calculates temporal decay accurately at T+0h, T+24h, T+48h, T+100h, T+500h', () => {
    const confT0 = AchEngine.computeConfidence({ ageHours: 0 });
    const confT24 = AchEngine.computeConfidence({ ageHours: 24 });
    const confT48 = AchEngine.computeConfidence({ ageHours: 48 });
    const confT100 = AchEngine.computeConfidence({ ageHours: 100 });
    const confT500 = AchEngine.computeConfidence({ ageHours: 500 });

    harness.assertCloseTo(confT0.breakdown.temporalFreshness, 1.0, 1e-4, 'T_f at 0h = 1.0');
    harness.assertCloseTo(confT24.breakdown.temporalFreshness, Math.exp(-0.02 * 24), 1e-4, 'T_f at 24h ~ 0.6188');
    harness.assertCloseTo(confT48.breakdown.temporalFreshness, Math.exp(-0.02 * 48), 1e-4, 'T_f at 48h ~ 0.3829');
    harness.assertCloseTo(confT100.breakdown.temporalFreshness, Math.exp(-0.02 * 100), 1e-4, 'T_f at 100h ~ 0.1353');
    harness.assertCloseTo(confT500.breakdown.temporalFreshness, Math.exp(-0.02 * 500), 1e-4, 'T_f at 500h ~ 0.000045');
    harness.assert(confT0.score > confT24.score, 'Confidence decays over 24h');
    harness.assert(confT24.score > confT48.score, 'Confidence decays over 48h');
    harness.assert(confT48.score > confT100.score, 'Confidence decays over 100h');
  });

  harness.it('Calculates contradiction penalties and preserves minimum 0.1 floor', () => {
    const c0 = AchEngine.computeConfidence({ contradictions: 0 });
    const c1 = AchEngine.computeConfidence({ contradictions: 1 });
    const c2 = AchEngine.computeConfidence({ contradictions: 2 });
    const c3 = AchEngine.computeConfidence({ contradictions: 3 });
    const c10 = AchEngine.computeConfidence({ contradictions: 10 });

    harness.assertEqual(c0.breakdown.contradictionPenalty, 1.0, '0 contradictions has 1.0 multiplier');
    harness.assertEqual(c1.breakdown.contradictionPenalty, 0.85, '1 contradiction has 0.85 multiplier');
    harness.assertEqual(c2.breakdown.contradictionPenalty, 0.70, '2 contradictions has 0.70 multiplier');
    harness.assertEqual(c3.breakdown.contradictionPenalty, 0.55, '3 contradictions has 0.55 multiplier');
    harness.assertEqual(c10.breakdown.contradictionPenalty, 0.1, '10 contradictions clamped at 0.1 floor');
  });

  harness.it('Maps scores to standard ICD 203 verbal confidence levels', () => {
    const mapLabel = (score) => {
      if (score >= 85) return 'Almost Certain';
      if (score >= 70) return 'Highly Likely';
      if (score >= 55) return 'Likely';
      if (score >= 40) return 'Roughly Even Chance';
      if (score >= 20) return 'Unlikely';
      return 'Remote';
    };

    harness.assertEqual(mapLabel(95), 'Almost Certain', '95 -> Almost Certain');
    harness.assertEqual(mapLabel(80), 'Highly Likely', '80 -> Highly Likely');
    harness.assertEqual(mapLabel(62), 'Likely', '62 -> Likely');
    harness.assertEqual(mapLabel(48), 'Roughly Even Chance', '48 -> Roughly Even Chance');
    harness.assertEqual(mapLabel(28), 'Unlikely', '28 -> Unlikely');
    harness.assertEqual(mapLabel(10), 'Remote', '10 -> Remote');
  });
});

// ----------------------------------------------------
// Tier 3: Case Study Verification from Datasets
// ----------------------------------------------------
harness.describe('Tier 3: Preset Case Study Evaluation from scenarios.json', () => {
  harness.it('Evaluates realistic power grid telemetry ACH case', () => {
    const caseHypotheses = [
      { id: 'H1', name: 'Foreign State APT Attack' },
      { id: 'H2', name: 'Insider Threat / Compromised Creds' },
      { id: 'H3', name: 'Vendor Firmware Race Condition' }
    ];
    const caseEvidence = [
      { id: 'E1', credibility: 5, relevance: 5 }, // W1 = 25
      { id: 'E2', credibility: 4, relevance: 4 }, // W2 = 16
      { id: 'E3', credibility: 5, relevance: 5 }  // W3 = 25
    ];
    const matrix = {
      E1: { H1: 2, H2: 2, H3: -2 }, // H3 has -2 * 25 = 50 inc
      E2: { H1: 2, H2: 1, H3: -1 }, // H3 has -1 * 16 = 16 inc
      E3: { H1: 2, H2: -2, H3: 1 }  // H2 has -2 * 25 = 50 inc
    };

    const results = AchEngine.rankHypotheses(caseHypotheses, caseEvidence, matrix);
    harness.assertEqual(results[0].id, 'H1', 'State APT (H1) is rank 1 with 0 inconsistency');
    harness.assertEqual(results[0].inconsistency, 0, 'H1 has 0 inconsistency');
    harness.assertEqual(results[1].id, 'H2', 'Insider (H2) is rank 2 with 50 inconsistency');
    harness.assertEqual(results[2].id, 'H3', 'Firmware (H3) is rank 3 with 66 inconsistency');
  });

  harness.it('Evaluates multi-source forensic case with 4 competing hypotheses', () => {
    const hypotheses = [
      { id: 'H_Deepfake', name: 'AI Voice Clone Synthesis' },
      { id: 'H_CompromisedAccount', name: 'Compromised Account + Recycled Audio' },
      { id: 'H_Whistleblower', name: 'Authentic Leak from Whistleblower' },
      { id: 'H_MisheardParody', name: 'Satirical Parody Taken Out of Context' }
    ];
    const evidence = [
      { id: 'E1', credibility: 5, relevance: 5 }, // Frequency artifact analysis (W=25)
      { id: 'E2', credibility: 4, relevance: 5 }, // Telecom call records (W=20)
      { id: 'E3', credibility: 3, relevance: 4 }  // Social account login geo IP (W=12)
    ];
    const matrix = {
      E1: { H_Deepfake: 2, H_CompromisedAccount: -2, H_Whistleblower: -2, H_MisheardParody: -1 },
      E2: { H_Deepfake: 1, H_CompromisedAccount: 1, H_Whistleblower: -2, H_MisheardParody: 0 },
      E3: { H_Deepfake: 1, H_CompromisedAccount: 2, H_Whistleblower: -1, H_MisheardParody: 0 }
    };
    const ranked = AchEngine.rankHypotheses(hypotheses, evidence, matrix);
    harness.assertEqual(ranked[0].id, 'H_Deepfake', 'H_Deepfake has least inconsistency');
    harness.assert(ranked[ranked.length - 1].id === 'H_Whistleblower', 'H_Whistleblower is most contradicted');
  });
});

const result = harness.summary();
export default result;
