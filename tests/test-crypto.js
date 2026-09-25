/**
 * SOVEREIGN // AEGIS — Test Suite 3: WebCrypto ECDSA P-256 & W3C DID Credential Engine
 * Validates key generation, digital signing, signature verification, tamper resistance,
 * Unicode/multilingual payloads, canonicalization, Base58/Base64url, and W3C JSON-LD schemas.
 * Zero external runtime dependencies.
 */

import { AegisCrypto } from '../js/crypto.js';

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

  assertDeepEqual(actual, expected, message) {
    const match = JSON.stringify(actual) === JSON.stringify(expected);
    this.assert(match, `${message} | Deep equality match`);
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

const harness = new TestHarness('WebCrypto ECDSA P-256 & DID Credential Suite');

async function runTests() {
  let senderKeys = null;
  let receiverKeys = null;

  // ----------------------------------------------------
  // Tier 1: WebCrypto Key Generation & DID Derivation
  // ----------------------------------------------------
  await harness.describe('Tier 1: Keypair Generation & Decentralized Identifier (DID)', async () => {
    await harness.it('Generates ECDSA P-256 keypair with extractable JWKs', async () => {
      senderKeys = await AegisCrypto.generateKeyPair();
      receiverKeys = await AegisCrypto.generateKeyPair();

      harness.assert(Boolean(senderKeys.keyPair), 'Keypair object exists');
      harness.assert(Boolean(senderKeys.keyPair.publicKey), 'Public CryptoKey exists');
      harness.assert(Boolean(senderKeys.keyPair.privateKey), 'Private CryptoKey exists');
      harness.assertEqual(senderKeys.keyPair.publicKey.algorithm.name, 'ECDSA', 'Algorithm is ECDSA');
      harness.assertEqual(senderKeys.keyPair.publicKey.algorithm.namedCurve, 'P-256', 'Curve is P-256 (secp256r1)');
    });

    await harness.it('Derives valid W3C did:key identifier using Multicodec/Base58', async () => {
      harness.assert(senderKeys.did.startsWith('did:key:z'), `DID starts with did:key:z (${senderKeys.did.slice(0, 20)}...)`);
      harness.assert(senderKeys.did.length >= 45, `DID length is sufficient (${senderKeys.did.length} chars)`);
      harness.assert(senderKeys.did !== receiverKeys.did, 'Distinct keypairs yield distinct DIDs');
    });

    await harness.it('Exports standard RFC 7517 JSON Web Key (JWK) structure', async () => {
      const jwk = senderKeys.publicKeyJwk;
      harness.assertEqual(jwk.kty, 'EC', 'JWK key type is EC');
      harness.assertEqual(jwk.crv, 'P-256', 'JWK curve is P-256');
      harness.assert(Boolean(jwk.x && jwk.y), 'JWK contains x and y coordinates');
      harness.assert(typeof jwk.x === 'string' && jwk.x.length > 20, 'JWK coordinate x is non-empty string');
      harness.assert(typeof jwk.y === 'string' && jwk.y.length > 20, 'JWK coordinate y is non-empty string');
    });
  });

  // ----------------------------------------------------
  // Tier 1: SHA-256 Hashing & Known Test Vectors
  // ----------------------------------------------------
  await harness.describe('Tier 1: Deterministic SHA-256 Hashing NIST Vectors', async () => {
    await harness.it('Computes SHA-256 of empty string matching NIST vector', async () => {
      const hash = await AegisCrypto.computeHash('');
      harness.assertEqual(hash, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'NIST SHA-256 empty string');
    });

    await harness.it('Computes SHA-256 of classic test string', async () => {
      const str = 'The quick brown fox jumps over the lazy dog';
      const hash = await AegisCrypto.computeHash(str);
      harness.assertEqual(hash, 'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592', 'NIST SHA-256 fox string');
    });

    await harness.it('Computes deterministic hash for JSON objects via canonicalization', async () => {
      const obj1 = { title: 'Operation Chimera', threat: 'Critical', confidence: 95 };
      const obj2 = { confidence: 95, threat: 'Critical', title: 'Operation Chimera' };
      const hash1 = await AegisCrypto.computeHash(obj1);
      const hash2 = await AegisCrypto.computeHash(obj2);
      harness.assertEqual(hash1, hash2, 'Hash of permuted JSON keys is strictly identical');
      harness.assertEqual(hash1.length, 64, 'Hexadecimal hash string is exactly 64 characters');
    });
  });

  // ----------------------------------------------------
  // Tier 1 & Tier 2: Digital Signing, Verification & Tamper Detection
  // ----------------------------------------------------
  await harness.describe('Tier 1 & Tier 2: Digital Signing, Verification & Tamper Resistance', async () => {
    const claimPayload = {
      claimId: 'claim-2026-0816-001',
      authorDid: senderKeys.did,
      assertion: 'Coordinated synthetic audio campaign identified targeting municipal grid.',
      veracityScore: 92,
      evidenceHashes: [
        '3f4e2a1b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f'
      ],
      timestamp: '2026-08-16T03:00:00.000Z'
    };

    let signature = null;

    await harness.it('Signs JSON claim statement using ECDSA P-256 private key', async () => {
      signature = await AegisCrypto.signStatement(senderKeys.keyPair.privateKey, claimPayload);
      harness.assert(typeof signature === 'string', 'Signature is a string');
      harness.assert(signature.length > 50, `Signature length is valid (${signature.length} chars)`);
      harness.assert(!signature.includes('+') && !signature.includes('/'), 'Signature is Base64url-encoded without + or /');
    });

    await harness.it('Verifies authentic statement against CryptoKey public key', async () => {
      const valid = await AegisCrypto.verifyStatement(senderKeys.keyPair.publicKey, claimPayload, signature);
      harness.assertEqual(valid, true, 'Original signature validates to true with CryptoKey');
    });

    await harness.it('Verifies authentic statement against exported JWK public key', async () => {
      const valid = await AegisCrypto.verifyStatement(senderKeys.publicKeyJwk, claimPayload, signature);
      harness.assertEqual(valid, true, 'Original signature validates to true with JWK');
    });

    await harness.it('Detects payload content tampering (text modification)', async () => {
      const tamperedPayload = { ...claimPayload, assertion: 'Authentic emergency broadcast confirmed.' };
      const valid = await AegisCrypto.verifyStatement(senderKeys.publicKeyJwk, tamperedPayload, signature);
      harness.assertEqual(valid, false, 'Tampered assertion returns false');
    });

    await harness.it('Detects payload metadata tampering (veracityScore change)', async () => {
      const tamperedPayload = { ...claimPayload, veracityScore: 93 };
      const valid = await AegisCrypto.verifyStatement(senderKeys.publicKeyJwk, tamperedPayload, signature);
      harness.assertEqual(valid, false, 'Tampered veracity score returns false');
    });

    await harness.it('Detects timestamp tampering (replay / backdating attack)', async () => {
      const tamperedPayload = { ...claimPayload, timestamp: '2026-08-16T02:59:59.000Z' };
      const valid = await AegisCrypto.verifyStatement(senderKeys.publicKeyJwk, tamperedPayload, signature);
      harness.assertEqual(valid, false, 'Tampered timestamp returns false');
    });

    await harness.it('Rejects signature verified against a different public key (impersonation check)', async () => {
      const valid = await AegisCrypto.verifyStatement(receiverKeys.publicKeyJwk, claimPayload, signature);
      harness.assertEqual(valid, false, 'Verification with wrong public key returns false');
    });

    await harness.it('Detects signature bit-flip corruption', async () => {
      const charToFlip = signature[10] === 'A' ? 'B' : 'A';
      const corruptedSig = signature.slice(0, 10) + charToFlip + signature.slice(11);
      const valid = await AegisCrypto.verifyStatement(senderKeys.publicKeyJwk, claimPayload, corruptedSig);
      harness.assertEqual(valid, false, 'Bit-flipped signature returns false');
    });

    await harness.it('Handles empty or malformed signature gracefully without unhandled crashes', async () => {
      const emptyValid = await AegisCrypto.verifyStatement(senderKeys.publicKeyJwk, claimPayload, '');
      const garbageValid = await AegisCrypto.verifyStatement(senderKeys.publicKeyJwk, claimPayload, 'not-a-signature');
      harness.assertEqual(emptyValid, false, 'Empty signature returns false');
      harness.assertEqual(garbageValid, false, 'Garbage signature returns false');
    });
  });

  // ----------------------------------------------------
  // Tier 2: Unicode, Multilingual & Extreme Payloads
  // ----------------------------------------------------
  await harness.describe('Tier 2: Multilingual Payloads & Boundary Sizes', async () => {
    const unicodeCases = [
      { lang: 'Cyrillic', text: 'Проверка суверенитета и защита от дезинформации' },
      { lang: 'Arabic', text: 'التحقق من التوقيع الرقمي للسيادة المعرفية والنزاهة' },
      { lang: 'Chinese', text: '认知主权与去中心化身份可验证凭证' },
      { lang: 'Greek', text: 'Συμμαχία Γνωστικής Κυριαρχίας και Αλήθειας' },
      { lang: 'Emojis', text: '🛡️ ⚡ 🔒 🧠 👁️ 🏛️ 📜 ✨ 💎 🚀' },
      { lang: 'Special Escapes', text: 'Line 1\r\nLine 2\t"Quotes" & \'Single\' \\Backslash\\ /Slash/ <xml>' }
    ];

    for (const testCase of unicodeCases) {
      await harness.it(`Signs and verifies ${testCase.lang} payload accurately`, async () => {
        const payload = { language: testCase.lang, text: testCase.text, count: 42 };
        const sig = await AegisCrypto.signStatement(senderKeys.keyPair.privateKey, payload);
        const pass = await AegisCrypto.verifyStatement(senderKeys.publicKeyJwk, payload, sig);
        harness.assertEqual(pass, true, `${testCase.lang} signing round-trip passed`);
      });
    }

    await harness.it('Signs and verifies large 100KB payload cleanly', async () => {
      const bigText = 'AegisCognitiveSovereigntyVerificationPayload-'.repeat(2500); // ~107 KB
      const bigPayload = { data: bigText, sizeBytes: bigText.length };
      const sig = await AegisCrypto.signStatement(senderKeys.keyPair.privateKey, bigPayload);
      const pass = await AegisCrypto.verifyStatement(senderKeys.publicKeyJwk, bigPayload, sig);
      harness.assert(pass, '100KB payload signed and verified successfully');
    });
  });

  // ----------------------------------------------------
  // Tier 3: W3C JSON-LD Verifiable Credential Schema Export
  // ----------------------------------------------------
  await harness.describe('Tier 3: W3C JSON-LD Verifiable Credential Architecture', async () => {
    const statement = {
      achievement: 'Masterclass: Computational Propaganda Inoculation',
      score: 100,
      badge: 'Epistemic Aegis Vanguard'
    };

    let vc = null;

    await harness.it('Builds compliant W3C JSON-LD Verifiable Credential', async () => {
      const sig = await AegisCrypto.signStatement(senderKeys.keyPair.privateKey, statement);
      vc = AegisCrypto.exportVerifiableCredential(senderKeys.did, senderKeys.publicKeyJwk, statement, sig);

      harness.assert(Array.isArray(vc['@context']), 'VC contains @context array');
      harness.assert(vc['@context'].includes('https://www.w3.org/2018/credentials/v1'), 'Includes W3C v1 context');
      harness.assert(vc.id.startsWith('urn:uuid:'), 'VC id is standard urn:uuid format');
      harness.assert(Array.isArray(vc.type) && vc.type.includes('VerifiableCredential'), 'VC type includes VerifiableCredential');
      harness.assertEqual(vc.issuer, senderKeys.did, 'VC issuer matches signer DID');
      harness.assertEqual(vc.credentialSubject.id, senderKeys.did, 'Subject ID matches DID');
      harness.assertEqual(vc.credentialSubject.achievement, statement.achievement, 'Subject claims preserved');
      harness.assertEqual(vc.proof.type, 'JsonWebSignature2020', 'Proof type is JsonWebSignature2020');
      harness.assertEqual(vc.proof.proofPurpose, 'assertionMethod', 'Proof purpose is assertionMethod');
      harness.assertEqual(vc.proof.jws, sig, 'Proof jws matches original signature');
    });

    await harness.it('Verifies credential subject signature embedded in proof', async () => {
      const { id, ...claims } = vc.credentialSubject;
      const valid = await AegisCrypto.verifyStatement(senderKeys.publicKeyJwk, claims, vc.proof.jws);
      harness.assertEqual(valid, true, 'Embedded VC claims verify against proof.jws');
    });
  });

  // ----------------------------------------------------
  // Tier 1: Canonicalization, Base58 & Base64url Utilities
  // ----------------------------------------------------
  await harness.describe('Tier 1: Canonicalization & Encoding Primitives', async () => {
    await harness.it('Recursively sorts object keys deterministically', () => {
      const input = { z: 1, a: { y: 2, b: 3 }, m: [ { d: 4, c: 5 } ] };
      const canonical = AegisCrypto.canonicalize(input);
      harness.assertEqual(canonical, '{"a":{"b":3,"y":2},"m":[{"c":5,"d":4}],"z":1}', 'Canonical string strictly sorted');
    });

    await harness.it('Base64url encode/decode round-trip matches byte-for-byte', () => {
      const originalBytes = new Uint8Array([0, 1, 255, 128, 64, 32, 16, 8, 4, 2, 1]);
      const encoded = AegisCrypto.base64UrlEncode(originalBytes);
      const decoded = AegisCrypto.base64UrlDecode(encoded);
      harness.assertDeepEqual(Array.from(decoded), Array.from(originalBytes), 'Base64url round-trip matches');
    });

    await harness.it('Base58BTC encode/decode round-trip matches byte-for-byte', () => {
      const originalBytes = new Uint8Array([18, 0, 150, 200, 75, 99, 12, 0, 44]);
      const encoded = AegisCrypto.base58Encode(originalBytes);
      const decoded = AegisCrypto.base58Decode(encoded);
      harness.assertDeepEqual(Array.from(decoded), Array.from(originalBytes), 'Base58BTC round-trip matches');
    });

    await harness.it('Generates cryptographically random entropy and UUID v4', () => {
      const entropy = AegisCrypto.getRandomEntropy(16);
      harness.assertEqual(entropy.length, 32, '16-byte entropy yields 32 hex chars');
      const uuid = AegisCrypto.generateUUID();
      harness.assert(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid), 'UUID matches v4 RFC 4122 regex');
    });
  });

  // ----------------------------------------------------
  // Key storage hardening — private scalar must not be extractable by default
  // ----------------------------------------------------
  await harness.describe('Key Storage Hardening: Non-Extractable Private Keys', async () => {
    await harness.it('generateKeyPair() produces a NON-extractable private key by default', async () => {
      const kp = await AegisCrypto.generateKeyPair();
      harness.assertEqual(kp.keyPair.privateKey.extractable, false, 'privateKey.extractable is false by default');
      harness.assertEqual(kp.privateKeyJwk, null, 'No private JWK is returned for a non-extractable key');
      harness.assertEqual(kp.extractable, false, 'Result reports extractable: false');
      harness.assert(kp.publicKeyJwk && kp.publicKeyJwk.kty === 'EC', 'Public JWK is still exported (it is published)');
      harness.assert(typeof kp.did === 'string' && kp.did.startsWith('did:key:z'), 'did:key still derived from public half');
    });

    await harness.it('The private scalar cannot be exported from a default keypair', async () => {
      const kp = await AegisCrypto.generateKeyPair();
      let threw = false;
      try {
        await crypto.subtle.exportKey('jwk', kp.keyPair.privateKey);
      } catch {
        threw = true;
      }
      harness.assert(threw, 'exportKey() on the private key is refused by WebCrypto');
    });

    await harness.it('A non-extractable key still signs, and its signature verifies', async () => {
      const kp = await AegisCrypto.generateKeyPair();
      const statement = { assertion: 'Non-extractable keys still sign.', issuer: kp.did };
      const sig = await AegisCrypto.signStatement(kp.keyPair.privateKey, statement);
      harness.assert(typeof sig === 'string' && sig.length > 50, 'Signature produced from vaulted CryptoKey');
      const ok = await AegisCrypto.verifyStatement(kp.publicKeyJwk, statement, sig);
      harness.assertEqual(ok, true, 'Signature verifies against the published public JWK');
    });

    await harness.it('Opt-in extractable mode is still available for explicit key backup', async () => {
      const kp = await AegisCrypto.generateKeyPair({ extractable: true });
      harness.assertEqual(kp.keyPair.privateKey.extractable, true, 'extractable: true is honoured when explicitly requested');
      harness.assert(kp.privateKeyJwk && typeof kp.privateKeyJwk.d === 'string', 'Private JWK with d parameter returned on request');
    });

    await harness.it('didKeyToJwk inverts jwkToDidKey exactly (lossless P-256 point recovery)', async () => {
      const kp = await AegisCrypto.generateKeyPair();
      const did = AegisCrypto.jwkToDidKey(kp.publicKeyJwk);
      const back = AegisCrypto.didKeyToJwk(did);
      harness.assertEqual(back.kty, 'EC', 'decoded key is EC');
      harness.assertEqual(back.crv, 'P-256', 'decoded key is P-256');
      harness.assertEqual(back.x, kp.publicKeyJwk.x, 'x coordinate survives the round-trip');
      harness.assertEqual(back.y, kp.publicKeyJwk.y, 'y coordinate survives the round-trip (parity pinned by prefix)');
      harness.assertEqual(AegisCrypto.jwkToDidKey(back), did, 're-encoded did:key is identical');
    });

    await harness.it('parsePublicKey accepts did:key and JWK JSON, rejects everything else', async () => {
      const kp = await AegisCrypto.generateKeyPair();
      const did = AegisCrypto.jwkToDidKey(kp.publicKeyJwk);
      const fromDid = AegisCrypto.parsePublicKey(did);
      const fromJwk = AegisCrypto.parsePublicKey(JSON.stringify(kp.publicKeyJwk));
      harness.assertEqual(fromDid.x, kp.publicKeyJwk.x, 'did:key parses to the same x');
      harness.assertEqual(fromJwk.y, kp.publicKeyJwk.y, 'JWK JSON parses to the same y');
      const cleaned = AegisCrypto.parsePublicKey(JSON.stringify({ ...kp.publicKeyJwk, d: 'cHJpdmF0ZS1tYXRlcmlhbA' }));
      harness.assert(!('d' in cleaned), 'private d parameter is stripped from a pasted JWK');
      for (const bad of ['', 'not a key', '{"kty":"RSA","n":"x","e":"AQAB"}', '{"kty":"EC","crv":"P-384","x":"AA","y":"AA"}', 'did:key:notbase58!!']) {
        let threw = false;
        try { AegisCrypto.parsePublicKey(bad); } catch (err) { threw = true; }
        harness.assert(threw, `parsePublicKey rejects: ${bad.slice(0, 28) || '(empty)'}`);
      }
    });

    await harness.it('A foreign statement verifies against the PASTED key alone (independent-verifier contract)', async () => {
      const issuer = await AegisCrypto.generateKeyPair();
      const verifier = await AegisCrypto.generateKeyPair();
      harness.assert(issuer.did !== verifier.did, 'issuer and verifier hold distinct identities');
      const stmt = { assertion: 'Issued on another device entirely.', issuer: issuer.did };
      const sig = await AegisCrypto.signStatement(issuer.keyPair.privateKey, stmt);
      const pastedDid = AegisCrypto.jwkToDidKey(issuer.publicKeyJwk);
      const okDid = await AegisCrypto.verifyStatement(AegisCrypto.parsePublicKey(pastedDid), stmt, sig);
      harness.assertEqual(okDid, true, 'foreign signature verifies with only the pasted did:key');
      const okJwk = await AegisCrypto.verifyStatement(AegisCrypto.parsePublicKey(JSON.stringify(issuer.publicKeyJwk)), stmt, sig);
      harness.assertEqual(okJwk, true, 'foreign signature verifies with only the pasted JWK JSON');
    });

    await harness.it('A wrong or corrupted pasted key FAILS verification (no false positives)', async () => {
      const issuer = await AegisCrypto.generateKeyPair();
      const stmt = { assertion: 'wrong-key probe', issuer: issuer.did };
      const sig = await AegisCrypto.signStatement(issuer.keyPair.privateKey, stmt);
      const other = await AegisCrypto.generateKeyPair();
      const wrongDid = await AegisCrypto.verifyStatement(AegisCrypto.parsePublicKey(AegisCrypto.jwkToDidKey(other.publicKeyJwk)), stmt, sig);
      harness.assertEqual(wrongDid, false, 'verification against the wrong did:key fails');
      const wrongJwk = await AegisCrypto.verifyStatement(other.publicKeyJwk, stmt, sig);
      harness.assertEqual(wrongJwk, false, 'verification against the wrong JWK fails');
      const did = AegisCrypto.jwkToDidKey(issuer.publicKeyJwk);
      for (let i = 0; i < 6; i++) {
        const corrupt = did.slice(0, did.length - 6) + 'kzMtQpXy'.slice(i, i + 6);
        let safe = true; // safe = throws or returns false; a false positive is the only failure
        try {
          safe = (await AegisCrypto.verifyStatement(AegisCrypto.parsePublicKey(corrupt), stmt, sig)) === false;
        } catch (err) { safe = true; }
        harness.assert(safe, `corrupted did:key #${i + 1} never verifies`);
      }
    });

    await harness.it('Panel symmetry: the signer statement reconstructs verbatim from pasted assertion text', async () => {
      const kp = await AegisCrypto.generateKeyPair();
      const assertion = 'Symmetry probe for the Independent Signature Verifier.';
      const signed = { assertion, issuer: kp.did };
      const sig = await AegisCrypto.signStatement(kp.keyPair.privateKey, signed);
      const reconstructed = { assertion, issuer: AegisCrypto.jwkToDidKey(kp.publicKeyJwk) };
      const ok = await AegisCrypto.verifyStatement(kp.publicKeyJwk, reconstructed, sig);
      harness.assertEqual(ok, true, 'text-paste round-trip verifies (statement carries no unverifiable fields)');
      const bad = await AegisCrypto.verifyStatement(kp.publicKeyJwk, { ...reconstructed, assertion: assertion + ' x' }, sig);
      harness.assertEqual(bad, false, 'a mutated assertion fails verification');
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
  console.error('Fatal error running crypto test suite:', err);
  process.exit(1);
});
