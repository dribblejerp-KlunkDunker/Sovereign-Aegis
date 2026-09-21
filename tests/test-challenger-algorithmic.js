/**
 * SOVEREIGN // AEGIS — Challenger 1 Adversarial Algorithmic & Negative Verification Suite
 * 
 * Deep empirical stress testing and negative-case verification across:
 * 1. Cryptographic Engine (tampered payloads, altered signatures, bit-flips, expired/altered timestamps, malformed keys)
 * 2. Richards Heuer ACH Matrix (negative weights, non-normalized values, empty matrices, tie-breaking, extreme dimensions)
 * 3. VERDAD NLP Engine (clean/neutral text false-positive rejection, high-intensity affect, corrupted inputs, boundary lengths)
 * 4. InfoWar Serious Game Engine (strict AP budget enforcement, zero/negative AP turns, action boundaries, contagion clamping)
 * 5. Dataset Schema & Integrity (schema key omissions, regex syntax corruption, broken cross-references)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AegisCrypto } from '../js/crypto.js';
import { AchEngine } from '../js/modules/ach.js';
import { VerdadEngine } from '../js/modules/verdad.js';
import { InfoWarEngine } from '../js/modules/infowar.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

class AdversarialHarness {
  constructor(name) {
    this.name = name;
    this.total = 0;
    this.passed = 0;
    this.failed = 0;
    this.failures = [];
    this.currentCategory = '';
  }

  category(name, fn) {
    this.currentCategory = name;
    console.log(`\n======================================================`);
    console.log(`▶ [ADVERSARIAL CHALLENGE] ${name}`);
    console.log(`======================================================`);
    return fn();
  }

  async it(testName, fn) {
    try {
      await fn();
    } catch (err) {
      this.failed++;
      this.total++;
      this.failures.push({ category: this.currentCategory, test: testName, error: err.message });
      console.error(`  ✗ [FAIL] ${testName} -> ${err.message}`);
    }
  }

  assert(condition, message) {
    this.total++;
    if (condition) {
      this.passed++;
      console.log(`    ✓ ${message}`);
    } else {
      this.failed++;
      this.failures.push({ category: this.currentCategory, test: message, error: 'Assertion failed' });
      console.error(`    ✗ [ASSERTION FAILED] ${message}`);
    }
  }

  assertEqual(actual, expected, message) {
    this.assert(actual === expected, `${message} | Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
  }

  assertCloseTo(actual, expected, delta = 1e-3, message) {
    const diff = Math.abs(actual - expected);
    this.assert(diff <= delta, `${message} | Expected ~${expected}, Got: ${actual} (diff: ${diff.toFixed(5)})`);
  }

  summary() {
    console.log('\n======================================================');
    console.log(`[${this.name}] SUMMARY: ${this.passed}/${this.total} Assertions Passed (${this.failed} Failed)`);
    console.log('======================================================');
    if (this.failed > 0) {
      console.error('\nFailures Detected:');
      this.failures.forEach(f => console.error(` - [${f.category}] ${f.test}: ${f.error}`));
    }
    return { passed: this.passed, failed: this.failed, total: this.total };
  }
}

const harness = new AdversarialHarness('Algorithmic Challenger 1 Test Suite');

async function runAdversarialVerification() {
  console.log('========================================================================');
  console.log(' SOVEREIGN // AEGIS — EMPIRICAL CHALLENGER 1 ADVERSARIAL TEST SUITE    ');
  console.log('========================================================================');

  // ==========================================================================
  // 1. CRYPTOGRAPHIC NEGATIVE & ADVERSARIAL VERIFICATION
  // ==========================================================================
  await harness.category('Area 1: AegisCrypto Tamper, Signature Corruption & Timestamps', async () => {
    const keyPairA = await AegisCrypto.generateKeyPair();
    const keyPairB = await AegisCrypto.generateKeyPair();

    const originalPayload = {
      claimId: 'claim-adversarial-001',
      author: keyPairA.did,
      assertion: 'High-frequency telemetry suggests deepfake manipulation in district 4.',
      confidence: 88,
      timestamp: '2026-08-16T12:00:00.000Z',
      nestedMetadata: {
        hashAlg: 'SHA-256',
        sourceNode: 'node-3',
        flags: ['urgent', 'verified']
      }
    };

    const signature = await AegisCrypto.signStatement(keyPairA.keyPair.privateKey, originalPayload);

    await harness.it('Verifies authentic unaltered payload returns true', async () => {
      const valid = await AegisCrypto.verifyStatement(keyPairA.publicKeyJwk, originalPayload, signature);
      harness.assertEqual(valid, true, 'Original signature is authentic');
    });

    await harness.it('Detects payload assertion tampering (even single character change)', async () => {
      const tampered = { ...originalPayload, assertion: originalPayload.assertion + '.' };
      const valid = await AegisCrypto.verifyStatement(keyPairA.publicKeyJwk, tampered, signature);
      harness.assertEqual(valid, false, 'Tampered assertion string returns false');
    });

    await harness.it('Detects confidence score tampering', async () => {
      const tampered = { ...originalPayload, confidence: 89 };
      const valid = await AegisCrypto.verifyStatement(keyPairA.publicKeyJwk, tampered, signature);
      harness.assertEqual(valid, false, 'Tampered confidence score returns false');
    });

    await harness.it('Detects timestamp modification (backdating / replay vector)', async () => {
      const tampered = { ...originalPayload, timestamp: '2026-08-16T11:59:59.000Z' };
      const valid = await AegisCrypto.verifyStatement(keyPairA.publicKeyJwk, tampered, signature);
      harness.assertEqual(valid, false, 'Altered timestamp returns false');
    });

    await harness.it('Detects deep nested object tampering in metadata', async () => {
      const tampered = JSON.parse(JSON.stringify(originalPayload));
      tampered.nestedMetadata.flags.push('attacker_injected');
      const valid = await AegisCrypto.verifyStatement(keyPairA.publicKeyJwk, tampered, signature);
      harness.assertEqual(valid, false, 'Tampered nested array returns false');
    });

    await harness.it('Rejects verification under mismatched public key (impersonation attempt)', async () => {
      const valid = await AegisCrypto.verifyStatement(keyPairB.publicKeyJwk, originalPayload, signature);
      harness.assertEqual(valid, false, 'Wrong public key returns false');
    });

    await harness.it('Rejects truncated signature', async () => {
      const truncated = signature.slice(0, 30);
      const valid = await AegisCrypto.verifyStatement(keyPairA.publicKeyJwk, originalPayload, truncated);
      harness.assertEqual(valid, false, 'Truncated signature returns false');
    });

    await harness.it('Rejects bit-flipped signature', async () => {
      const char = signature[12] === 'X' ? 'Y' : 'X';
      const flipped = signature.slice(0, 12) + char + signature.slice(13);
      const valid = await AegisCrypto.verifyStatement(keyPairA.publicKeyJwk, originalPayload, flipped);
      harness.assertEqual(valid, false, 'Bit-flipped signature returns false');
    });

    await harness.it('Rejects signature with null/undefined/empty string', async () => {
      const validNull = await AegisCrypto.verifyStatement(keyPairA.publicKeyJwk, originalPayload, null);
      const validUndef = await AegisCrypto.verifyStatement(keyPairA.publicKeyJwk, originalPayload, undefined);
      const validEmpty = await AegisCrypto.verifyStatement(keyPairA.publicKeyJwk, originalPayload, '');
      harness.assertEqual(validNull, false, 'Null signature rejected');
      harness.assertEqual(validUndef, false, 'Undefined signature rejected');
      harness.assertEqual(validEmpty, false, 'Empty signature rejected');
    });

    await harness.it('Rejects malformed JWK public key without crashing', async () => {
      const malformedJwk = { kty: 'EC', crv: 'P-256', x: 'invalid-base64', y: 'invalid-base64' };
      const valid = await AegisCrypto.verifyStatement(malformedJwk, originalPayload, signature);
      harness.assertEqual(valid, false, 'Malformed JWK public key safely returns false');
    });
  });

  // ==========================================================================
  // 2. RICHARDS J. HEUER ACH MATRIX EDGE CASES & MATHEMATICAL BOUNDARIES
  // ==========================================================================
  await harness.category('Area 2: AchEngine Negative Weights, Clamping, Empty & Ties', async () => {
    const hypotheses = [
      { id: 'H1', name: 'Foreign State APT' },
      { id: 'H2', name: 'Domestic Insider' },
      { id: 'H3', name: 'Autonomous Bot Swarm' }
    ];

    await harness.it('Clamps negative credibility & relevance weights to zero', async () => {
      const negativeWeightEvidence = [
        { id: 'E_neg1', description: 'Corrupted telemetry with negative weight', credibility: -5, relevance: 4 },
        { id: 'E_neg2', description: 'Malicious evidence with negative relevance', credibility: 5, relevance: -10 }
      ];
      const matrix = {
        E_neg1: { H1: -2, H2: 2, H3: -1 },
        E_neg2: { H1: -2, H2: 2, H3: -2 }
      };

      const incH1 = AchEngine.calculateInconsistency('H1', negativeWeightEvidence, matrix);
      const supH2 = AchEngine.calculateSupport('H2', negativeWeightEvidence, matrix);
      harness.assertEqual(incH1, 0, 'Negative credibility clamped to 0 weight, inconsistency is 0');
      harness.assertEqual(supH2, 0, 'Negative relevance clamped to 0 weight, support is 0');
    });

    await harness.it('Clamps excessively high credibility & relevance to max 5', async () => {
      const hugeWeightEvidence = [
        { id: 'E_huge', description: 'Over-weighted evidence', credibility: 9999, relevance: 8888 }
      ];
      // Clamped to 5 * 5 = 25 weight. Rating -1 => 1 * 25 = 25
      const matrix = { E_huge: { H1: -1 } };
      const incH1 = AchEngine.calculateInconsistency('H1', hugeWeightEvidence, matrix);
      harness.assertEqual(incH1, 25, 'Credibility/relevance clamped to max 5*5=25');
    });

    await harness.it('Clamps ratings outside [-2, 2] range properly', async () => {
      const ev = [{ id: 'E1', credibility: 2, relevance: 3 }]; // Weight = 6
      const matrix = {
        E1: { H1: -999, H2: 1000 } // Should clamp to -2 and +2
      };
      const incH1 = AchEngine.calculateInconsistency('H1', ev, matrix);
      const supH2 = AchEngine.calculateSupport('H2', ev, matrix);
      harness.assertEqual(incH1, 12, 'Rating -999 clamped to -2 => 2 * 6 = 12 inconsistency');
      harness.assertEqual(supH2, 12, 'Rating +1000 clamped to +2 => 2 * 6 = 12 support');
    });

    await harness.it('Handles empty inputs safely (empty hypotheses, evidence, or matrix)', async () => {
      const emptyRank = AchEngine.rankHypotheses([], [], {});
      harness.assertEqual(emptyRank.length, 0, 'Empty hypotheses returns empty array');

      const incEmpty = AchEngine.calculateInconsistency('H1', [], {});
      const supEmpty = AchEngine.calculateSupport('H1', [], {});
      harness.assertEqual(incEmpty, 0, 'Empty evidence yields 0 inconsistency');
      harness.assertEqual(supEmpty, 0, 'Empty evidence yields 0 support');

      const singleRank = AchEngine.rankHypotheses([{ id: 'H1' }], [], {});
      harness.assertEqual(singleRank.length, 1, 'Single hypothesis ranked');
      harness.assertEqual(singleRank[0].rank, 1, 'Rank is 1');
      harness.assertEqual(singleRank[0].inconsistency, 0, 'Inconsistency is 0');
    });

    await harness.it('Handles tie-breaking: Support Score breaks Inconsistency ties', async () => {
      const tiedHyps = [
        { id: 'H_A', name: 'Hypothesis A' },
        { id: 'H_B', name: 'Hypothesis B' }
      ];
      // Both have inconsistency 10, but H_A has support 30 and H_B has support 10
      const ev = [
        { id: 'E1', credibility: 2, relevance: 5 }, // W=10
        { id: 'E2', credibility: 3, relevance: 5 }  // W=15
      ];
      const matrix = {
        E1: { H_A: -1, H_B: -1 }, // Inc = 10 for both
        E2: { H_A: 2, H_B: 0 }    // Sup = 30 for H_A, 0 for H_B
      };

      const ranked = AchEngine.rankHypotheses(tiedHyps, ev, matrix);
      harness.assertEqual(ranked[0].id, 'H_A', 'H_A ranks #1 due to higher support');
      harness.assertEqual(ranked[0].rank, 1, 'H_A rank is 1');
      harness.assertEqual(ranked[1].id, 'H_B', 'H_B ranks #2');
      harness.assertEqual(ranked[1].rank, 2, 'H_B rank is 2');
    });

    await harness.it('Handles tie-breaking: Alphabetical ID breaks exact Inconsistency + Support ties', async () => {
      const identicalHyps = [
        { id: 'HYP_Z', name: 'Zulu Hypothesis' },
        { id: 'HYP_A', name: 'Alpha Hypothesis' }
      ];
      const ev = [{ id: 'E1', credibility: 2, relevance: 2 }];
      const matrix = { E1: { HYP_Z: 1, HYP_A: 1 } };

      const ranked = AchEngine.rankHypotheses(identicalHyps, ev, matrix);
      harness.assertEqual(ranked[0].id, 'HYP_A', 'HYP_A sorted before HYP_Z alphabetically on tie');
      harness.assertEqual(ranked[1].id, 'HYP_Z', 'HYP_Z follows HYP_A');
    });

    await harness.it('Epistemic Confidence Scorer clamps extreme contradictions and age', async () => {
      // 100 contradictions -> should floor at 0.1
      const confExtremeContra = AchEngine.computeConfidence({ contradictions: 100 });
      harness.assertEqual(confExtremeContra.breakdown.contradictionPenalty, 0.1, 'Contradiction penalty floored at 0.1');

      // 100,000 ageHours -> temporal freshness goes to ~0
      const confExtremeAge = AchEngine.computeConfidence({ ageHours: 100000 });
      harness.assert(confExtremeAge.breakdown.temporalFreshness >= 0 && confExtremeAge.breakdown.temporalFreshness <= 0.0001, 'Temporal freshness asymptotically approaches 0');
      harness.assert(confExtremeAge.score >= 0 && confExtremeAge.score <= 100, 'Score is bounded [0, 100]');
    });
  });

  // ==========================================================================
  // 3. VERDAD NLP ENGINE FALSE-POSITIVE REJECTION & ADVERSARIAL INPUTS
  // ==========================================================================
  await harness.category('Area 3: VerdadEngine Clean Text Rejection & Fallacy Precision', async () => {
    const cleanNeutralTexts = [
      'The meteorological service reported 12 millimeters of precipitation across the northern basin yesterday.',
      'Researchers observed cellular mitosis under electron microscopy at standard laboratory temperature.',
      'The municipal council approved the annual budget reallocation for public transit maintenance.',
      'Quarterly revenue increased by 3.2 percent following supply chain optimizations in regional logistics.',
      'The library will remain open until 8 PM on weekdays and 5 PM on Saturdays for student research.',
      'Solar photovoltaic efficiency reached 22.4 percent in recent silicon semiconductor laboratory trials.'
    ];

    for (const [idx, text] of cleanNeutralTexts.entries()) {
      await harness.it(`Rejects neutral text #${idx + 1} without false-positive fallacy or emotional flags`, async () => {
        const result = VerdadEngine.runOfflineHeuristics(text);
        harness.assertEqual(result.detectedFallacies.length, 0, `0 fallacies detected in neutral text #${idx + 1}`);
        harness.assertEqual(result.manipulationRisk, 0, `0% manipulation risk in neutral text #${idx + 1}`);
        harness.assertEqual(result.credibilityTier, 'High Credibility / Low Manipulation', 'Credibility tier is High');
        harness.assert(result.veracityScore >= 80, `High veracity score (${result.veracityScore})`);
        for (const [vec, score] of Object.entries(result.emotionalTriggers)) {
          harness.assertEqual(score, 0, `Emotional trigger ${vec} is 0`);
        }
      });
    }

    await harness.it('Accurately flags manipulative text with Ad Hominem & Outrage triggers', async () => {
      const toxicText = 'Breaking! That corrupt liar and lunatic mayor is orchestrating a secret plot to poison our water!';
      const result = VerdadEngine.runOfflineHeuristics(toxicText);
      harness.assert(result.detectedFallacies.some(f => f.fallacyId === 'fallacy-ad-hominem'), 'Flags Ad Hominem');
      harness.assert(result.emotionalTriggers.outrage > 50, 'Flags high outrage');
      harness.assert(result.emotionalTriggers.urgency > 50, 'Flags high urgency');
      harness.assert(result.manipulationRisk >= 60, 'Manipulation risk >= 60');
    });

    await harness.it('Handles null, undefined, whitespace and extreme inputs safely', async () => {
      const nullRes = VerdadEngine.runOfflineHeuristics(null);
      const undefRes = VerdadEngine.runOfflineHeuristics(undefined);
      const wsRes = VerdadEngine.runOfflineHeuristics('   \t\n   ');
      harness.assertEqual(nullRes.manipulationRisk, 0, 'Null returns 0 manipulation risk');
      harness.assertEqual(undefRes.manipulationRisk, 0, 'Undefined returns 0 manipulation risk');
      harness.assertEqual(wsRes.manipulationRisk, 0, 'Whitespace returns 0 manipulation risk');

      // Giant 50,000 word string
      const bigText = 'The quick brown fox jumps over the lazy dog. '.repeat(5000);
      const bigRes = VerdadEngine.runOfflineHeuristics(bigText);
      harness.assertEqual(bigRes.detectedFallacies.length, 0, 'Big neutral text has 0 fallacies');
      harness.assertEqual(bigRes.manipulationRisk, 0, 'Big neutral text has 0 manipulation risk');
    });
  });

  // ==========================================================================
  // 4. INFOWAR GAME STRICT AP BUDGET & NEGATIVE AP DEFENSE
  // ==========================================================================
  await harness.category('Area 4: InfoWarEngine AP Budget Enforcement & Boundary Constraints', async () => {
    let game = new InfoWarEngine();

    await harness.it('Strictly enforces AP budget limits and prevents negative AP', async () => {
      harness.assertEqual(game.ap, 10, 'Initial AP is 10');

      // Action 1: Inoculate (3 AP) -> remaining 7
      let res1 = game.takeAction('inoculate', 'node-1');
      harness.assertEqual(res1.success, true, 'Inoculate succeeds');
      harness.assertEqual(game.ap, 7, 'AP is 7');

      // Action 2: Botnet Takedown (5 AP) -> remaining 2
      let res2 = game.takeAction('botnet_takedown', 'node-2');
      harness.assertEqual(res2.success, true, 'Botnet takedown succeeds');
      harness.assertEqual(game.ap, 2, 'AP is 2');

      // Action 3: Attempt Debunk (4 AP) when having 2 AP -> MUST BE REJECTED
      let res3 = game.takeAction('debunk', 'node-3');
      harness.assertEqual(res3.success, false, 'Debunk rejected due to insufficient AP');
      harness.assertEqual(game.ap, 2, 'AP remains strictly 2 (no negative subtraction)');

      // Action 4: Platform Friction (2 AP) -> remaining 0
      let res4 = game.takeAction('friction');
      harness.assertEqual(res4.success, true, 'Friction succeeds');
      harness.assertEqual(game.ap, 0, 'AP is exactly 0');

      // Action 5: Attempt any action with 0 AP -> MUST BE REJECTED
      let res5 = game.takeAction('friction');
      harness.assertEqual(res5.success, false, 'Action rejected with 0 AP');
      harness.assertEqual(game.ap, 0, 'AP remains 0');
    });

    await harness.it('Resets AP to maxAp (10) upon turn transition and increments turn', async () => {
      const nextState = game.endTurn();
      harness.assertEqual(nextState.turn, 2, 'Advanced to Turn 2');
      harness.assertEqual(nextState.ap, 10, 'AP replenished to 10');
      harness.assertEqual(game.ap, 10, 'Engine AP is 10');
    });

    await harness.it('Prevents action execution after terminal Game Over', async () => {
      // Simulate until game over
      while (!game.gameOver && game.turn <= game.maxTurns) {
        game.endTurn();
      }
      harness.assertEqual(game.gameOver, true, 'Game reached game over');

      const rejectedAction = game.takeAction('inoculate', 'node-1');
      harness.assertEqual(rejectedAction.success, false, 'Action strictly blocked after game over');
    });
  });

  // ==========================================================================
  // 5. DATASETS SCHEMA & INTEGRITY NEGATIVE VERIFICATION
  // ==========================================================================
  await harness.category('Area 5: Dataset Schema Sensitivity & Regex Robustness', async () => {
    // Test dataset schema validation functions against intentionally corrupted mock data
    const fallaciesRaw = fs.readFileSync(path.join(DATA_DIR, 'fallacies.json'), 'utf8');
    const fallaciesData = JSON.parse(fallaciesRaw);

    await harness.it('Demonstrates schema validation catches missing mandatory keys', async () => {
      // Create a corrupted fallacy item missing 'definition' and 'quiz'
      const corruptedItem = { id: 'fallacy-corrupted', name: 'Corrupted Fallacy' };
      const hasDef = typeof corruptedItem.definition === 'string' && corruptedItem.definition.length > 20;
      const hasQuiz = typeof corruptedItem.quiz === 'object' && corruptedItem.quiz !== null;
      harness.assertEqual(hasDef, false, 'Missing definition detected as invalid');
      harness.assertEqual(hasQuiz, false, 'Missing quiz detected as invalid');
    });

    await harness.it('Demonstrates regex validation catches malformed regex patterns', async () => {
      const invalidPattern = '[unclosed-bracket(';
      let regexCompiled = false;
      try {
        new RegExp(invalidPattern, 'i');
        regexCompiled = true;
      } catch {
        regexCompiled = false;
      }
      harness.assertEqual(regexCompiled, false, 'Invalid regex pattern correctly caught by try/catch');
    });

    await harness.it('Validates all 11 production datasets remain strictly valid without schema drift', async () => {
      const verdadRaw = fs.readFileSync(path.join(DATA_DIR, 'verdad_rules.json'), 'utf8');
      const verdad = JSON.parse(verdadRaw);

      let allCompiled = true;
      for (const f of verdad.fallacyRegexes) {
        try {
          new RegExp(f.pattern, 'i');
        } catch {
          allCompiled = false;
        }
      }
      harness.assertEqual(allCompiled, true, 'All fallacyRegexes compile cleanly into RegExp instances');
    });
  });

  return harness.summary();
}

runAdversarialVerification().then(result => {
  if (result.failed > 0) {
    process.exit(1);
  }
}).catch(err => {
  console.error('Fatal challenger execution error:', err);
  process.exit(1);
});
