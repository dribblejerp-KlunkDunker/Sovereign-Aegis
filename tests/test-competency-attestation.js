/**
 * SOVEREIGN // AEGIS — Suite 43: Competency Attestations & W3C DID Verifiable Credentials
 *
 * Tests:
 * 1. Attestation Subject Construction & Privacy Invariants:
 *    - Asserts mastery estimation, Brier score calculation, and reliability bins.
 *    - Strict Privacy Invariant: NO raw attempt IDs, question texts, timestamps, or chosen options
 *      are leaked into the credential.
 * 2. Cryptographic Signing & W3C JSON-LD Structure:
 *    - WebCrypto ECDSA P-256 signing produces valid W3C Verifiable Credential.
 *    - Proof purpose is 'assertionMethod', verification method binds issuer DID.
 * 3. Independent Offline Verification:
 *    - Self-contained verification: public key JWK matches issuer did:key.
 *    - Digital signature passes cryptographic verification against canonical subject.
 * 4. Adversarial Tamper Resistance (Fails Closed):
 *    - Inflated mastery score fails verification.
 *    - Falsified Brier calibration score fails verification.
 *    - Attacker key substitution fails verification.
 *    - Corrupted signature fails verification.
 *    - Attacker DID substitution fails verification.
 * 5. Third-Party Independent Adjudication:
 *    - Cross-operator verification without shared secrets or network connection.
 * 6. Edge Cases & Cold-Start:
 *    - Zero attempts produces valid baseline attestation with neutral indicators.
 *
 * Zero external runtime dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

import { AegisCrypto } from '../js/crypto.js';
import {
  buildCompetencySubject,
  signCompetencyAttestation,
  verifyCompetencyAttestation,
  formatAttestationSummary,
  COMPETENCY_CREDENTIAL_TYPE,
  COMPETENCY_SUBJECT_TYPE,
  COMPETENCY_CONTEXT
} from '../js/modules/attestation.js';

class TestHarness {
  constructor(suiteName) {
    this.suiteName = suiteName;
    this.totalAssertions = 0;
    this.passed = 0;
    this.failed = 0;
    this.failures = [];
    this.currentGroup = '';
  }

  describe(name, fn) {
    this.currentGroup = name;
    console.log(`\n--- ${name} ---`);
    return fn();
  }

  async it(name, fn) {
    try {
      await fn();
    } catch (err) {
      this.failed++;
      this.totalAssertions++;
      this.failures.push({ group: this.currentGroup, test: name, error: err.message });
      console.error(`  ✗ [FAIL] ${name} (${err.message})`);
    }
  }

  assert(condition, message) {
    this.totalAssertions++;
    if (condition) {
      this.passed++;
      console.log(`  ✓ ${message}`);
    } else {
      this.failed++;
      this.failures.push({ group: this.currentGroup, test: message, error: 'Assertion failed' });
      console.error(`  ✗ [FAIL] ${message}`);
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
      this.failures.forEach(f => console.error(` - [${f.group}] ${f.test}: ${f.error}`));
      process.exitCode = 1;
    }
    return { passed: this.passed, failed: this.failed, total: this.totalAssertions };
  }
}

const harness = new TestHarness('Suite 43: Competency Attestation & Verifiable Credential');

async function runTests() {
  console.log('========================================================================');
  console.log('  Suite 43: Cryptographic Competency Attestations (W3C DID VCs)');
  console.log('========================================================================');

  // Load skills catalogue
  const skillsRaw = fs.readFileSync(path.join(ROOT_DIR, 'data', 'skills.json'), 'utf8');
  const skills = JSON.parse(skillsRaw);

  // Generate test keypairs
  const alice = await AegisCrypto.generateKeyPair({ extractable: true });
  const bob = await AegisCrypto.generateKeyPair({ extractable: true });
  const mallory = await AegisCrypto.generateKeyPair({ extractable: true });

  // Synthesize realistic practice attempt history for Alice
  const now = Date.now();
  const DAY = 86400000;
  const attempts = [
    // Skill 1: Relevance fallacies (high mastery)
    { id: 'att_01', skillId: 'skill.fallacy.relevance', itemId: 'q1', correct: true, confidence: 'sure', ts: now - DAY * 2, chosen: 'Ad Hominem' },
    { id: 'att_02', skillId: 'skill.fallacy.relevance', itemId: 'q8', correct: true, confidence: 'sure', ts: now - DAY * 1, chosen: 'Red Herring' },
    { id: 'att_03', skillId: 'skill.fallacy.relevance', itemId: 'q12', correct: true, confidence: 'unsure', ts: now, chosen: 'Straw Man' },
    { id: 'att_04', skillId: 'skill.fallacy.relevance', itemId: 'q15', correct: true, confidence: 'sure', ts: now, chosen: 'Tu Quoque' },

    // Skill 2: Scope fallacies (moderate mastery, some miscalibration)
    { id: 'att_05', skillId: 'skill.fallacy.scope', itemId: 'q2', correct: true, confidence: 'sure', ts: now - DAY * 3, chosen: 'Hasty Generalization' },
    { id: 'att_06', skillId: 'skill.fallacy.scope', itemId: 'q16', correct: false, confidence: 'sure', ts: now - DAY * 2, chosen: 'Texas Sharpshooter' }, // miscalibrated
    { id: 'att_07', skillId: 'skill.fallacy.scope', itemId: 'q22', correct: false, confidence: 'guess', ts: now - DAY * 1, chosen: 'Post Hoc' },
    { id: 'att_08', skillId: 'skill.fallacy.scope', itemId: 'q25', correct: true, confidence: 'unsure', ts: now, chosen: 'Slippery Slope' },

    // Skill 3: SIFT Stop (proficient)
    { id: 'att_09', skillId: 'skill.sift.stop', itemId: 'sift_1', correct: true, confidence: 'sure', ts: now - DAY * 1, chosen: 'Pause and reflect' },
    { id: 'att_10', skillId: 'skill.sift.stop', itemId: 'sift_2', correct: true, confidence: 'sure', ts: now, chosen: 'Check emotional trigger' },

    // Held-out attempts for transfer testing
    { id: 'att_11', skillId: 'skill.fallacy.relevance', itemId: 'q1_held', correct: true, confidence: 'sure', ts: now - DAY * 5, heldOut: true, chosen: 'Ad Hominem' },
    { id: 'att_12', skillId: 'skill.fallacy.relevance', itemId: 'q8_held', correct: true, confidence: 'sure', ts: now - DAY * 4, heldOut: true, chosen: 'Red Herring' },
    { id: 'att_13', skillId: 'skill.fallacy.scope', itemId: 'q2_held', correct: false, confidence: 'unsure', ts: now - DAY * 5, heldOut: true, chosen: 'Wrong' },
    { id: 'att_14', skillId: 'skill.fallacy.scope', itemId: 'q16_held', correct: true, confidence: 'sure', ts: now - DAY * 1, heldOut: true, chosen: 'Right' },
    { id: 'att_15', skillId: 'skill.sift.stop', itemId: 'sift_h1', correct: true, confidence: 'sure', ts: now - DAY * 4, heldOut: true, chosen: 'Right' },
    { id: 'att_16', skillId: 'skill.sift.stop', itemId: 'sift_h2', correct: true, confidence: 'sure', ts: now, heldOut: true, chosen: 'Right' }
  ];

  // ----------------------------------------------------
  // GROUP 1: Privacy Preservation & Subject Construction
  // ----------------------------------------------------
  await harness.describe('Group 1: Attestation Subject & Zero-Leakage Privacy Invariants', async () => {
    await harness.it('builds a privacy-preserving credentialSubject', () => {
      const subject = buildCompetencySubject({
        did: alice.did,
        attempts,
        skills,
        options: { minEvidence: 1 }
      });

      harness.assertEqual(subject.id, alice.did, 'Subject ID matches issuer DID');
      harness.assertEqual(subject.type, COMPETENCY_SUBJECT_TYPE, 'Subject type is CompetencyAttestation');
      harness.assert(subject.summary.totalAttemptsEvaluated === attempts.length, 'Records total attempts evaluated');
      harness.assert(subject.summary.skillsAssessed >= 3, 'Assessed at least 3 skills');
      harness.assert(subject.summary.averageMastery > 0.5, 'Average mastery exceeds cold baseline');
      harness.assert(Array.isArray(subject.competencies) && subject.competencies.length >= 3, 'Includes competency list');

      // Calibration evaluation
      harness.assert(subject.calibration.available === true, 'Calibration is available');
      harness.assert(typeof subject.calibration.brierScore === 'number', 'Brier score computed');
      harness.assert(subject.calibration.brierScore >= 0 && subject.calibration.brierScore <= 1, 'Brier score within [0, 1]');
      harness.assert(typeof subject.calibration.overconfidence === 'number', 'Overconfidence computed');

      // Transfer evaluation
      harness.assert(subject.transfer.available === true, 'Transfer evaluation available');
      harness.assert(typeof subject.transfer.generalizationDelta === 'number', 'Generalization delta computed');
    });

    await harness.it('STRICT PRIVACY INVARIANT: No raw attempt events or choices leak into subject', () => {
      const subject = buildCompetencySubject({
        did: alice.did,
        attempts,
        skills
      });

      const subjectJson = JSON.stringify(subject);

      // Check that raw item IDs do NOT appear
      harness.assert(!subjectJson.includes('att_01') && !subjectJson.includes('att_06'), 'No attempt IDs in credential subject');
      harness.assert(!subjectJson.includes('q1') && !subjectJson.includes('q16'), 'No question item IDs in credential subject');
      harness.assert(!subjectJson.includes('Ad Hominem') && !subjectJson.includes('Texas Sharpshooter'), 'No specific chosen options in subject');
      harness.assert(!subjectJson.includes('chosen'), 'No chosen key in subject');
      harness.assert(!subjectJson.includes('latencyMs'), 'No latency telemetry in subject');
      harness.assert(subjectJson.includes('Zero raw attempt logs'), 'Privacy guarantee is explicitly attested');
    });
  });

  // ----------------------------------------------------
  // GROUP 2: Cryptographic Signing & W3C JSON-LD Conformity
  // ----------------------------------------------------
  let signedAliceCredential = null;

  await harness.describe('Group 2: Cryptographic Signing & W3C JSON-LD Schema', async () => {
    await harness.it('signs a valid W3C Verifiable Credential', async () => {
      signedAliceCredential = await signCompetencyAttestation(alice.keyPair.privateKey, {
        did: alice.did,
        publicKeyJwk: alice.publicKeyJwk,
        attempts,
        skills
      });

      harness.assert(typeof signedAliceCredential === 'object' && signedAliceCredential !== null, 'Credential generated');
      harness.assert(signedAliceCredential.id.startsWith('urn:uuid:'), 'Credential ID has standard urn:uuid: format');
      harness.assert(Array.isArray(signedAliceCredential['@context']), 'Has @context array');
      harness.assert(signedAliceCredential['@context'].includes(COMPETENCY_CONTEXT), 'Includes competency JSON-LD context');
      harness.assert(signedAliceCredential.type.includes('VerifiableCredential'), 'Type includes VerifiableCredential');
      harness.assert(signedAliceCredential.type.includes(COMPETENCY_CREDENTIAL_TYPE), 'Type includes CompetencyAttestationCredential');
      harness.assertEqual(signedAliceCredential.issuer, alice.did, 'Issuer is Alice did:key');
      harness.assert(typeof signedAliceCredential.issuanceDate === 'string', 'Has issuanceDate string');

      // Proof envelope
      harness.assert(signedAliceCredential.proof.type === 'JsonWebSignature2020', 'Proof type is JsonWebSignature2020');
      harness.assert(signedAliceCredential.proof.proofPurpose === 'assertionMethod', 'proofPurpose is assertionMethod');
      harness.assert(signedAliceCredential.proof.verificationMethod.startsWith(alice.did), 'verificationMethod binds issuer DID');
      harness.assert(typeof signedAliceCredential.proof.jws === 'string' && signedAliceCredential.proof.jws.length > 30, 'jws signature string is non-empty');
    });

    await harness.it('rejects signing when publicKeyJwk does not match issuer DID', async () => {
      let threw = false;
      try {
        await signCompetencyAttestation(alice.keyPair.privateKey, {
          did: alice.did,
          publicKeyJwk: bob.publicKeyJwk, // Bob's JWK under Alice's DID
          attempts,
          skills
        });
      } catch {
        threw = true;
      }
      harness.assert(threw, 'Mismatched publicKeyJwk throws during attestation signing');
    });
  });

  // ----------------------------------------------------
  // GROUP 3: Independent Offline Verification
  // ----------------------------------------------------
  await harness.describe('Group 3: Independent Offline Verification', async () => {
    await harness.it('successfully verifies genuine signed credential', async () => {
      const result = await verifyCompetencyAttestation(signedAliceCredential);
      harness.assertEqual(result.ok, true, 'Verification succeeds for genuine credential');
      harness.assertEqual(result.did, alice.did, 'Verified issuer matches Alice DID');
      harness.assert(result.summary.skillsAssessed >= 3, 'Verified summary includes skills count');
    });

    await harness.it('generates readable markdown report from verified credential', () => {
      const markdown = formatAttestationSummary(signedAliceCredential);
      harness.assert(markdown.includes('Cryptographic Competency Attestation'), 'Summary includes title');
      harness.assert(markdown.includes(alice.did), 'Summary includes Alice DID');
      harness.assert(markdown.includes('Verified Competency Breakdown'), 'Summary includes breakdown table');
    });
  });

  // ----------------------------------------------------
  // GROUP 4: Adversarial Tamper Resistance (Fails Closed)
  // ----------------------------------------------------
  await harness.describe('Group 4: Adversarial Tamper Resistance', async () => {
    await harness.it('fails closed when mastery score is inflated', async () => {
      // Mallory tries to inflate her mastery from 0.70 to 0.99
      const tampered = JSON.parse(JSON.stringify(signedAliceCredential));
      tampered.credentialSubject.summary.averageMastery = 0.999;

      const result = await verifyCompetencyAttestation(tampered);
      harness.assertEqual(result.ok, false, 'Inflated summary mastery fails verification');
      harness.assert(result.reason.includes('invalid') || result.reason.includes('tampered'), 'Rejects with tamper explanation');
    });

    await harness.it('fails closed when an individual skill mastery is modified', async () => {
      const tampered = JSON.parse(JSON.stringify(signedAliceCredential));
      if (tampered.credentialSubject.competencies.length > 0) {
        tampered.credentialSubject.competencies[0].mastery = 0.999;
      }

      const result = await verifyCompetencyAttestation(tampered);
      harness.assertEqual(result.ok, false, 'Mutated individual competency fails verification');
    });

    await harness.it('fails closed when Brier calibration score is altered', async () => {
      const tampered = JSON.parse(JSON.stringify(signedAliceCredential));
      tampered.credentialSubject.calibration.brierScore = 0.001; // claim superhuman calibration

      const result = await verifyCompetencyAttestation(tampered);
      harness.assertEqual(result.ok, false, 'Altered Brier score fails verification');
    });

    await harness.it('fails closed when attacker substitutes their own public key', async () => {
      const tampered = JSON.parse(JSON.stringify(signedAliceCredential));
      tampered.publicKeyJwk = mallory.publicKeyJwk; // Mallory swaps in her public key

      const result = await verifyCompetencyAttestation(tampered);
      harness.assertEqual(result.ok, false, 'Key substitution attack fails verification');
      harness.assert(result.reason.includes('does not hash to issuer DID'), 'Rejects because JWK does not match issuer DID');
    });

    await harness.it('fails closed when attacker swaps issuer DID', async () => {
      const tampered = JSON.parse(JSON.stringify(signedAliceCredential));
      tampered.issuer = mallory.did; // Mallory claims she is the issuer

      const result = await verifyCompetencyAttestation(tampered);
      harness.assertEqual(result.ok, false, 'Issuer DID swap fails verification');
    });

    await harness.it('fails closed when signature bits are corrupted', async () => {
      const tampered = JSON.parse(JSON.stringify(signedAliceCredential));
      tampered.proof.jws = tampered.proof.jws.slice(0, -4) + 'AAAA';

      const result = await verifyCompetencyAttestation(tampered);
      harness.assertEqual(result.ok, false, 'Corrupted signature fails verification');
    });
  });

  // ----------------------------------------------------
  // GROUP 5: Third-Party Cross-Operator Adjudication
  // ----------------------------------------------------
  await harness.describe('Group 5: Third-Party Offline Cross-Operator Adjudication', async () => {
    await harness.it('Bob can verify Alice credential using only the portable JSON-LD payload', async () => {
      // Simulate serializing to file and transmitting over wire
      const serializedJson = JSON.stringify(signedAliceCredential);
      const receivedByBob = JSON.parse(serializedJson);

      const verification = await verifyCompetencyAttestation(receivedByBob);
      harness.assertEqual(verification.ok, true, 'Bob confirms Alice cryptographic attestation offline');
      harness.assertEqual(verification.did, alice.did, 'Bob confirms Alice DID identity');
    });
  });

  // ----------------------------------------------------
  // GROUP 6: Cold-Start Baseline
  // ----------------------------------------------------
  await harness.describe('Group 6: Cold-Start & Edge Cases', async () => {
    await harness.it('produces valid baseline attestation when operator has zero attempts', async () => {
      const coldCredential = await signCompetencyAttestation(bob.keyPair.privateKey, {
        did: bob.did,
        publicKeyJwk: bob.publicKeyJwk,
        attempts: [],
        skills,
        options: { includeAllSkills: true }
      });

      harness.assert(typeof coldCredential === 'object', 'Cold baseline credential created');
      harness.assertEqual(coldCredential.credentialSubject.summary.totalAttemptsEvaluated, 0, 'Zero attempts recorded');
      harness.assertEqual(coldCredential.credentialSubject.calibration.available, false, 'Calibration marked unavailable');

      const coldVerification = await verifyCompetencyAttestation(coldCredential);
      harness.assertEqual(coldVerification.ok, true, 'Cold baseline credential verifies cryptographically');
    });
  });

  harness.summary();
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
