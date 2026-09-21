/**
 * SOVEREIGN // AEGIS — Cryptographic Competency Attestations (W3C Verifiable Credentials)
 *
 * Implements privacy-preserving, verifiable competency credentials signed locally
 * using WebCrypto ECDSA P-256 did:key keypairs.
 *
 * PRIVACY GUARANTEE:
 * ------------------
 * Raw attempt logs contain sensitive behavioral data (individual question attempts,
 * timestamps, error patterns, and specific choices). This module calculates and asserts
 * only high-level aggregate competencies, Brier calibration scores, and generalization
 * metrics. Zero raw attempt rows, question texts, or option choices are ever leaked into
 * the Verifiable Credential or sent over any network.
 *
 * TRUSTLESS ADJUDICATION:
 * -----------------------
 * Every credential is self-contained. The embedded publicKeyJwk must deterministically
 * hash to the issuer's did:key identifier, preventing key-substitution attacks. Any
 * recipient can verify mathematical authenticity and tamper-resistance completely offline.
 *
 * Pure module: headless safe, zero DOM dependencies.
 *
 * @module attestation
 */

import { AegisCrypto } from '../crypto.js';
import { estimateAll, calibration, transfer } from '../competency.js';

export const COMPETENCY_CREDENTIAL_TYPE = 'CompetencyAttestationCredential';
export const COMPETENCY_SUBJECT_TYPE = 'CompetencyAttestation';
export const COMPETENCY_CONTEXT = 'https://sovereign-aegis.org/contexts/competency-v1.jsonld';

/**
 * Helper to return uniform failure descriptors.
 * @param {string} reason 
 * @returns {{ok: false, reason: string}}
 */
function fail(reason) {
  return { ok: false, reason };
}

/**
 * Builds a privacy-preserving competency attestation subject object.
 *
 * Aggregates skill mastery and calibration without embedding raw attempt logs.
 *
 * @param {object} args
 * @param {string} args.did - Operator's did:key identifier
 * @param {object[]} [args.attempts] - Raw attempt records from AttemptLog
 * @param {object[]} [args.skills] - Skill catalogue from data/skills.json
 * @param {object} [args.options]
 * @param {number} [args.options.minEvidence] - Minimum attempts required to attest a skill (default: 1)
 * @param {boolean} [args.options.includeAllSkills] - Include unassessed skills as baseline (default: false)
 * @param {string} [args.options.issuedAt] - Optional ISO timestamp
 * @returns {object} Standardized credentialSubject
 */
export function buildCompetencySubject({ did, attempts = [], skills = [], options = {} }) {
  if (typeof did !== 'string' || !did.startsWith('did:key:')) {
    throw new Error('[attestation] did must be a valid did:key string');
  }

  const minEvidence = Number.isFinite(options.minEvidence) ? options.minEvidence : 1;
  const issuedAt = options.issuedAt || new Date().toISOString();

  // 1. Calculate mastery across all skills
  const masteryMap = estimateAll(attempts, skills);
  const skillList = Array.isArray(skills) ? skills : [];

  const attestedCompetencies = [];
  let totalMasterySum = 0;
  let assessedCount = 0;

  for (const s of skillList) {
    const est = masteryMap.get(s.id);
    if (!est) continue;

    const hasEvidence = est.n >= minEvidence;
    if (!hasEvidence && !options.includeAllSkills) {
      continue;
    }

    const masteryScore = Math.round(est.mastery * 1000) / 1000;
    const confidenceScore = Math.round(est.confidence * 1000) / 1000;

    let status = 'developing';
    if (est.mastery >= 0.75 && est.confidence >= 0.4) {
      status = 'mastered';
    } else if (est.mastery >= 0.60 && est.confidence >= 0.25) {
      status = 'proficient';
    }

    if (hasEvidence) {
      totalMasterySum += est.mastery;
      assessedCount++;
    }

    attestedCompetencies.push({
      skillId: s.id,
      label: s.label || s.id,
      pillar: s.pillar || 'cognitive',
      mastery: masteryScore,
      confidence: confidenceScore,
      evidenceCount: est.n,
      status,
      trend: est.trend
    });
  }

  const averageMastery = assessedCount > 0
    ? Math.round((totalMasterySum / assessedCount) * 1000) / 1000
    : 0.500;

  // 2. Metacognitive Calibration calculation
  const cal = calibration(attempts);
  const calibrationReport = {
    available: cal.available,
    totalEvaluated: cal.n,
    brierScore: cal.brier !== null ? Math.round(cal.brier * 1000) / 1000 : null,
    overconfidence: cal.overconfidence !== null ? Math.round(cal.overconfidence * 1000) / 1000 : null,
    headline: cal.headline,
    reliabilityBins: (cal.bins || []).map(b => ({
      level: b.level,
      claimed: b.claimed,
      count: b.n,
      accuracy: b.accuracy !== null ? Math.round(b.accuracy * 1000) / 1000 : null
    }))
  };

  // 3. Held-Out Generalization / Transfer measurement
  const tr = transfer(attempts, { halfSize: 3 });
  const transferReport = {
    available: tr.available,
    baselineAccuracy: tr.baseline ? Math.round(tr.baseline.accuracy * 1000) / 1000 : null,
    currentAccuracy: tr.current ? Math.round(tr.current.accuracy * 1000) / 1000 : null,
    generalizationDelta: tr.delta !== null ? Math.round(tr.delta * 1000) / 1000 : null,
    caveat: tr.caveat
  };

  // 4. Synthesize privacy-preserving subject
  return {
    id: did,
    type: COMPETENCY_SUBJECT_TYPE,
    issuedAt,
    summary: {
      totalAttemptsEvaluated: attempts.length,
      skillsAssessed: assessedCount,
      totalCatalogueSkills: skillList.length,
      averageMastery,
      calibrationGrade: calibrationReport.brierScore !== null
        ? (calibrationReport.brierScore <= 0.15 ? 'calibrated' : 'miscalibrated')
        : 'uncalibrated'
    },
    competencies: attestedCompetencies,
    calibration: calibrationReport,
    transfer: transferReport,
    privacyGuarantee: 'Zero raw attempt logs, item identifiers, or timestamps are exposed. '
      + 'All metrics are aggregated on-device under operator sovereign control.'
  };
}

/**
 * Cryptographically signs a Competency Attestation into a W3C JSON-LD Verifiable Credential.
 *
 * @param {CryptoKey|JsonWebKey} privateKey - Signing key (CryptoKey or JWK)
 * @param {object} args
 * @param {string} args.did - Issuer did:key string
 * @param {JsonWebKey} args.publicKeyJwk - Public key JWK matching the did:key
 * @param {object[]} [args.attempts] - Raw practice attempts
 * @param {object[]} [args.skills] - Skill catalogue
 * @param {object} [args.options] - Subject building options
 * @returns {Promise<object>} Signed W3C Verifiable Credential
 */
export async function signCompetencyAttestation(privateKey, { did, publicKeyJwk, attempts = [], skills = [], options = {} }) {
  if (!publicKeyJwk || typeof publicKeyJwk !== 'object') {
    throw new Error('[attestation] publicKeyJwk is required for verifiable credential publication');
  }

  const derivedDid = AegisCrypto.jwkToDidKey(publicKeyJwk);
  if (derivedDid !== did) {
    throw new Error(`[attestation] publicKeyJwk does not match issuer DID (${derivedDid} vs ${did})`);
  }

  const subject = buildCompetencySubject({ did, attempts, skills, options });
  const signature = await AegisCrypto.signStatement(privateKey, subject);
  const issuanceDate = subject.issuedAt;
  const credId = `urn:uuid:${AegisCrypto.generateUUID()}`;

  const credential = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://w3id.org/security/suites/jws-2020/v1',
      COMPETENCY_CONTEXT
    ],
    id: credId,
    type: ['VerifiableCredential', COMPETENCY_CREDENTIAL_TYPE],
    issuer: did,
    issuanceDate,
    credentialSubject: subject,
    publicKeyJwk,
    proof: {
      type: 'JsonWebSignature2020',
      created: issuanceDate,
      proofPurpose: 'assertionMethod',
      verificationMethod: `${did}#${did.slice(-8)}`,
      jws: signature
    }
  };

  return credential;
}

/**
 * Validates and cryptographically verifies a Competency Attestation Credential.
 *
 * Fails closed on:
 *   - Missing credential or subject
 *   - Non-did:key issuer
 *   - Public key mismatch (attacker key swapped into victim's DID)
 *   - Any tampering with attested competencies, mastery scores, or calibration figures
 *   - Corrupted or invalid ECDSA signature
 *
 * @param {object} credential - The JSON-LD Verifiable Credential to verify
 * @param {object} [opts]
 * @param {JsonWebKey} [opts.trustedPublicKeyJwk] - Optional external trusted JWK override
 * @returns {Promise<{ok: boolean, reason?: string, did?: string, issuanceDate?: string, subject?: object}>}
 */
export async function verifyCompetencyAttestation(credential, opts = {}) {
  try {
    if (!credential || typeof credential !== 'object') {
      return fail('Missing or invalid credential object');
    }

    const { issuer, credentialSubject, proof, publicKeyJwk } = credential;

    // 1. Basic structural checks
    if (typeof issuer !== 'string' || !issuer.startsWith('did:key:')) {
      return fail('Issuer is not a valid did:key identifier');
    }

    const types = Array.isArray(credential.type) ? credential.type : [credential.type];
    if (!types.includes('VerifiableCredential') || !types.includes(COMPETENCY_CREDENTIAL_TYPE)) {
      return fail(`Credential missing required types ('VerifiableCredential', '${COMPETENCY_CREDENTIAL_TYPE}')`);
    }

    if (!credentialSubject || typeof credentialSubject !== 'object') {
      return fail('Missing credentialSubject in attestation');
    }

    if (!proof || typeof proof !== 'object' || typeof proof.jws !== 'string' || !proof.jws) {
      return fail('Missing cryptographic proof or digital signature');
    }

    // 2. Key provenance check (Critical anti-tamper invariant)
    const keyToUse = opts.trustedPublicKeyJwk || publicKeyJwk;
    if (!keyToUse || typeof keyToUse !== 'object') {
      return fail('Missing public key for signature verification');
    }

    const derivedDid = AegisCrypto.jwkToDidKey(keyToUse);
    if (derivedDid !== issuer) {
      return fail(`Embedded public key does not hash to issuer DID (claimed: ${issuer}, key derives: ${derivedDid})`);
    }

    // 3. Mathematical signature verification
    const isValid = await AegisCrypto.verifyStatement(keyToUse, credentialSubject, proof.jws);
    if (!isValid) {
      return fail('ECDSA P-256 digital signature is invalid (claims have been tampered or signature corrupted)');
    }

    return {
      ok: true,
      did: issuer,
      issuanceDate: credential.issuanceDate,
      credentialId: credential.id,
      credentialSubject,
      summary: credentialSubject.summary
    };
  } catch (err) {
    return fail(`Verification exception: ${err.message}`);
  }
}

/**
 * Formats a verified competency attestation into a readable markdown summary report.
 * @param {object} credential 
 * @returns {string} Markdown text
 */
export function formatAttestationSummary(credential) {
  if (!credential || !credential.credentialSubject) return 'Invalid Credential';
  const sub = credential.credentialSubject;
  const sum = sub.summary || {};
  const cal = sub.calibration || {};

  const lines = [
    `# 📜 Cryptographic Competency Attestation`,
    `* **Issuer DID:** \`${credential.issuer}\``,
    `* **Issued Date:** ${credential.issuanceDate}`,
    `* **Credential ID:** \`${credential.id}\``,
    `* **Assessed Skills:** ${sum.skillsAssessed} / ${sum.totalCatalogueSkills}`,
    `* **Average Mastery:** ${(sum.averageMastery * 100).toFixed(1)}%`,
    `* **Brier Calibration Score:** ${cal.brierScore !== null ? cal.brierScore.toFixed(3) : 'N/A'} (${cal.headline || 'Unrated'})`,
    ``,
    `### Verified Competency Breakdown`,
    `| Skill | Pillar | Mastery | Confidence | Status |`,
    `|---|---|:---:|:---:|:---:|`
  ];

  for (const c of sub.competencies || []) {
    lines.push(`| ${c.label} | ${c.pillar} | ${(c.mastery * 100).toFixed(0)}% | ${(c.confidence * 100).toFixed(0)}% | ${c.status.toUpperCase()} |`);
  }

  lines.push(``);
  lines.push(`> 🔒 **Zero-Knowledge Privacy Note**: ${sub.privacyGuarantee}`);

  return lines.join('\n');
}
