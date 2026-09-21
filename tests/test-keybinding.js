/**
 * SOVEREIGN // AEGIS — Key-Binding Credential Suite
 * Validates that a DID can bind a Reema routing address, that the signature verifies,
 * that tampering fails closed, and that a hostile credential (attacker's own key under
 * the victim's DID) is rejected.
 * Zero external runtime dependencies (WebCrypto is native in Node).
 */

import { AegisCrypto } from '../js/crypto.js';
import { signKeyBinding, verifyKeyBinding, buildBindingSubject, KEYBINDING_TYPE } from '../js/keybinding.js';

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

const harness = new TestHarness('Key-Binding Credential Suite');

// Reema routing addresses are 44-char base64; the exact value is opaque to this test.
const ROUTING = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdEfGh';
const SIGN_PK = 'base64-ml-dsa-65-public-key-payload';

async function runTests() {
  // ----------------------------------------------------
  // buildBindingSubject — input validation
  // ----------------------------------------------------
  await harness.describe('buildBindingSubject — validates its inputs', async () => {
    const throws = (fn) => {
      try { fn(); return false; } catch { return true; }
    };

    await harness.it('requires a did:key issuer', () => {
      harness.assert(throws(() => buildBindingSubject({ did: 'did:example:123', routingAddress: ROUTING, signPk: SIGN_PK })), 'non-did:key issuer throws');
    });

    await harness.it('requires a routing address and signPk', () => {
      harness.assert(throws(() => buildBindingSubject({ did: 'did:key:zabc', routingAddress: 'short', signPk: SIGN_PK })), 'short routing address throws');
      harness.assert(throws(() => buildBindingSubject({ did: 'did:key:zabc', routingAddress: ROUTING, signPk: '' })), 'empty signPk throws');
    });
  });

  // ----------------------------------------------------
  // sign + verify round-trip, tampering, hostile credential
  // ----------------------------------------------------
  await harness.describe('signKeyBinding / verifyKeyBinding', async () => {
    await harness.it('round-trips: a valid binding verifies against the right public key', async () => {
      const { keyPair, did, publicKeyJwk } = await AegisCrypto.generateKeyPair({ extractable: true });
      const credential = await signKeyBinding(keyPair.privateKey, { did, publicKeyJwk, routingAddress: ROUTING, signPk: SIGN_PK });

      harness.assertEqual(credential.type.includes(KEYBINDING_TYPE), true, 'credential carries the KeyBindingCredential type');
      const result = await verifyKeyBinding(credential);
      harness.assertEqual(result.ok, true, `valid binding verifies (reason: ${result.reason || 'none'})`);
    });

    await harness.it('tampering the routing address fails closed', async () => {
      const { keyPair, did, publicKeyJwk } = await AegisCrypto.generateKeyPair({ extractable: true });
      const credential = await signKeyBinding(keyPair.privateKey, { did, publicKeyJwk, routingAddress: ROUTING, signPk: SIGN_PK });

      credential.credentialSubject.routingAddress = 'EvilAddress' + ROUTING.slice(11);
      const result = await verifyKeyBinding(credential);
      harness.assertEqual(result.ok, false, 'tampered routingAddress is rejected');
    });

    await harness.it('tampering the bound signPk fails closed', async () => {
      const { keyPair, did, publicKeyJwk } = await AegisCrypto.generateKeyPair({ extractable: true });
      const credential = await signKeyBinding(keyPair.privateKey, { did, publicKeyJwk, routingAddress: ROUTING, signPk: SIGN_PK });

      credential.credentialSubject.signPk = 'attacker-ml-dsa-key';
      const result = await verifyKeyBinding(credential);
      harness.assertEqual(result.ok, false, 'tampered signPk is rejected');
    });

    await harness.it('a hostile credential with the attacker\'s own key under the victim\'s DID is rejected', async () => {
      // Victim's DID is the claimed issuer.
      const victim = await AegisCrypto.generateKeyPair({ extractable: true });
      // Attacker signs the victim's binding claims with their own key, and embeds their
      // own JWK — exactly the swap a hostile credential would perform. Constructed by hand
      // because signKeyBinding() correctly refuses to sign an inconsistent credential.
      const attacker = await AegisCrypto.generateKeyPair({ extractable: true });
      const subject = buildBindingSubject({ did: victim.did, routingAddress: ROUTING, signPk: SIGN_PK });
      const signature = await AegisCrypto.signStatement(attacker.keyPair.privateKey, subject);
      const credential = AegisCrypto.exportVerifiableCredential(victim.did, attacker.publicKeyJwk, subject, signature);
      credential.type = ['VerifiableCredential', KEYBINDING_TYPE];
      credential.publicKeyJwk = attacker.publicKeyJwk;

      const result = await verifyKeyBinding(credential);
      harness.assertEqual(result.ok, false, 'attacker key under victim DID is rejected');
      harness.assert((result.reason || '').toLowerCase().includes('did'), `rejection names the DID mismatch (${result.reason})`);
    });

    await harness.it('a credential whose subject id does not match the issuer is rejected', async () => {
      const { keyPair, did, publicKeyJwk } = await AegisCrypto.generateKeyPair({ extractable: true });
      const credential = await signKeyBinding(keyPair.privateKey, { did, publicKeyJwk, routingAddress: ROUTING, signPk: SIGN_PK });

      credential.credentialSubject.id = 'did:key:zSomeOtherIdentity';
      const result = await verifyKeyBinding(credential);
      harness.assertEqual(result.ok, false, 'subject/issuer mismatch is rejected');
    });

    await harness.it('verifies with an explicitly trusted JWK instead of the embedded one', async () => {
      const { keyPair, did, publicKeyJwk } = await AegisCrypto.generateKeyPair({ extractable: true });
      const credential = await signKeyBinding(keyPair.privateKey, { did, publicKeyJwk, routingAddress: ROUTING, signPk: SIGN_PK });

      const result = await verifyKeyBinding(credential, { publicKeyJwk });
      harness.assertEqual(result.ok, true, 'explicit trusted JWK verifies');
    });

    await harness.it('rejects a credential that is not a KeyBinding', async () => {
      const { keyPair, did, publicKeyJwk } = await AegisCrypto.generateKeyPair({ extractable: true });
      const credential = await signKeyBinding(keyPair.privateKey, { did, publicKeyJwk, routingAddress: ROUTING, signPk: SIGN_PK });

      credential.credentialSubject.type = 'SomethingElse';
      const result = await verifyKeyBinding(credential);
      harness.assertEqual(result.ok, false, 'wrong subject type is rejected');
    });
  });

  return harness.summary();
}

// Standalone execution support
runTests().then(result => {
  if (result.failed > 0) process.exit(1);
}).catch(err => {
  console.error('Fatal error running key-binding suite:', err);
  process.exit(1);
});

export default runTests;
