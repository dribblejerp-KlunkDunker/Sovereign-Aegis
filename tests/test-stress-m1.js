/**
 * SOVEREIGN // AEGIS — Milestone 1 Adversarial Fuzzing & Empirical Stress Test Suite
 * Exhaustive challenge tests for StateStore (js/state.js) and AegisCrypto (js/crypto.js)
 */

import { StateStore, SEED_STATE } from '../js/state.js';
import { AegisCrypto } from '../js/crypto.js';

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, testName, details = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ ${testName}`);
  } else {
    failed++;
    const errMsg = `✕ FAIL: ${testName} ${details ? '(' + details + ')' : ''}`;
    failures.push(errMsg);
    console.error(`  ${errMsg}`);
  }
}

async function runAdversarialStressSuite() {
  console.log('================================================================');
  console.log('SOVEREIGN // AEGIS — MILESTONE 1 ADVERSARIAL STRESS & FUZZ SUITE');
  console.log('Empirical verification of StateStore & AegisCrypto resilience');
  console.log('================================================================\n');

  // ==========================================================================
  // SECTION 1: STATE STORE ADVERSARIAL STRESS TESTS
  // ==========================================================================
  console.log('--- SECTION 1: StateStore Adversarial & Edge Case Tests ---');

  const store = new StateStore();

  // 1.1 Null, Undefined, Empty, & Non-String Path Handling
  console.log('\n[1.1] Path Resolution Boundary Testing:');
  assert(store.get(null, 'FB') === 'FB', 'store.get(null) returns fallback');
  assert(store.get(undefined, 'FB') === 'FB', 'store.get(undefined) returns fallback');
  assert(store.get('', 'FB') === 'FB', 'store.get("") returns fallback');
  assert(store.get(12345, 'FB') === 'FB', 'store.get(number) returns fallback');
  assert(store.get({}, 'FB') === 'FB', 'store.get(object) returns fallback');
  assert(store.get([], 'FB') === 'FB', 'store.get(array) returns fallback');

  assert(store.set(null, 'val') === false, 'store.set(null) safely returns false');
  assert(store.set(undefined, 'val') === false, 'store.set(undefined) safely returns false');
  assert(store.set('', 'val') === false, 'store.set("") safely returns false');
  assert(store.set(999, 'val') === false, 'store.set(number) safely returns false');

  // 1.2 Deep Non-Existent Path Traversal Through Primitives
  console.log('\n[1.2] Deep Traversal Through Non-Object Primitives:');
  store.set('telemetry.blockHeight', 123456); // Number primitive
  assert(store.get('telemetry.blockHeight.sub.field', 'DEF') === 'DEF', 'get traversing through number returns fallback');
  
  store.set('test.primitiveStr', 'hello');
  assert(store.get('test.primitiveStr.nested.leaf', 'FALLBACK') === 'FALLBACK', 'get traversing through string returns fallback');

  store.set('test.primitiveBool', false);
  assert(store.get('test.primitiveBool.deep.property', null) === null, 'get traversing through boolean returns fallback');

  store.set('test.nullVal', null);
  assert(store.get('test.nullVal.deep.property', 'NULL_FB') === 'NULL_FB', 'get traversing through null returns fallback');

  // Deep set overwriting primitive parent to object
  const setOverwrote = store.set('test.primitiveStr.nested.leaf', 'overwritten_value');
  assert(setOverwrote === true, 'set traversing through primitive creates intermediate object');
  assert(store.get('test.primitiveStr.nested.leaf') === 'overwritten_value', 'nested value correctly retrieved after overwriting primitive');

  // Array index traversal
  assert(store.get('consensus.peers.0.id') === 'peer-alpha-01', 'Array index path traversal returns array element property');
  store.set('consensus.peers.0.trust', 100);
  assert(store.get('consensus.peers.0.trust') === 100, 'Array index path update sets property correctly');

  // 1.3 Wildcard Subscriptions & Subscription Storm
  console.log('\n[1.3] Wildcard Subscriptions & Storm Testing:');
  let rootWildcardCalls = 0;
  let branchWildcardCalls = 0;
  let exactCalls = 0;

  const unsubRoot = store.subscribe('*', () => { rootWildcardCalls++; });
  const unsubBranch = store.subscribe('storm.*', () => { branchWildcardCalls++; });
  const unsubExact = store.subscribe('storm.node1', () => { exactCalls++; });

  store.set('storm.node1', 'alpha');
  store.set('storm.node2', 'beta');
  store.set('other.branch', 'gamma');

  assert(exactCalls === 1, 'Exact subscriber fired exactly 1 time');
  assert(branchWildcardCalls === 2, 'Branch wildcard storm.* fired exactly 2 times');
  assert(rootWildcardCalls === 3, 'Root wildcard * fired exactly 3 times');

  unsubRoot();
  unsubBranch();
  unsubExact();

  // Subscriber lifecycle inside callback (unsubscribing self during callback)
  let selfUnsubTriggered = 0;
  let unsubSelf;
  unsubSelf = store.subscribe('lifecycle.test', () => {
    selfUnsubTriggered++;
    unsubSelf(); // Unsubscribe during execution
  });
  store.set('lifecycle.test', 1);
  store.set('lifecycle.test', 2);
  assert(selfUnsubTriggered === 1, 'Subscriber safely unsubs itself during execution without error');

  // Cascading / Re-entrant updates inside subscriber callback
  let cascadeCallCount = 0;
  const unsubCascade = store.subscribe('cascade.trigger', (val) => {
    if (val < 5) {
      cascadeCallCount++;
      store.set('cascade.trigger', val + 1);
    }
  });
  store.set('cascade.trigger', 1);
  assert(cascadeCallCount === 4, `Re-entrant cascading updates executed cleanly (${cascadeCallCount} iterations)`);
  unsubCascade();

  // Exception isolation in subscriber callbacks
  let survivorCalled = false;
  store.subscribe('fault.test', () => {
    throw new Error('Adversarial subscriber deliberate error');
  });
  store.subscribe('fault.test', () => {
    survivorCalled = true;
  });
  store.set('fault.test', 'trigger');
  assert(survivorCalled === true, 'Subscriber exception does not prevent subsequent subscribers from firing');

  // Subscription Storm: 500 wildcard subscribers + 500 exact subscribers
  console.log('\n[1.4] Subscription Storm (1,000 Concurrent Listeners):');
  const stormCount = 500;
  let stormWildcardHits = 0;
  let stormExactHits = 0;
  const unsubList = [];

  for (let i = 0; i < stormCount; i++) {
    unsubList.push(store.subscribe('storm_bench.*', () => { stormWildcardHits++; }));
    unsubList.push(store.subscribe('storm_bench.target', () => { stormExactHits++; }));
  }

  const stormStart = Date.now();
  store.set('storm_bench.target', 'hit');
  const stormDuration = Date.now() - stormStart;

  assert(stormExactHits === 500, `Exact storm listeners fired 500 times (actual: ${stormExactHits})`);
  assert(stormWildcardHits === 500, `Wildcard storm listeners fired 500 times (actual: ${stormWildcardHits})`);
  assert(stormDuration < 500, `1,000 listener storm processed in ${stormDuration}ms (<500ms)`);

  // Clean up storm listeners
  for (const unsub of unsubList) unsub();

  // 1.5 Rapid High-Frequency Updates (10,000 updates stress test)
  console.log('\n[1.5] Rapid High-Frequency Updates (10,000 iterations):');
  const storeFast = new StateStore({}, { autoPersist: false });
  const startRapid = Date.now();
  for (let i = 0; i < 10000; i++) {
    storeFast.set('benchmark.counter', i);
  }
  const rapidDuration = Date.now() - startRapid;
  assert(storeFast.get('benchmark.counter') === 9999, 'Rapid updates final counter state is 9999');
  assert(rapidDuration < 1000, `10,000 rapid updates completed in ${rapidDuration}ms (<1000ms)`);

  // 1.6 State Reset & SEED_STATE Isolation
  console.log('\n[1.6] State Reset & Seed Isolation:');
  const initialSeedSentinel = SEED_STATE.telemetry.sentinelMode;
  store.set('telemetry.sentinelMode', 'ISOLATED_MUTATED');
  assert(store.get('telemetry.sentinelMode') === 'ISOLATED_MUTATED', 'State mutated before reset');
  
  store.reset(false);
  assert(store.get('telemetry.sentinelMode') === initialSeedSentinel, 'State reset restores SEED_STATE default');
  assert(SEED_STATE.telemetry.sentinelMode === 'ARMED', 'SEED_STATE object remains unpolluted (immutability preserved)');

  // Hard reset test
  store.set('custom.volatileKey', 'temporary');
  store.reset(true);
  assert(store.get('custom.volatileKey') === null, 'Hard reset purges custom keys and restores seed');

  // 1.7 Deep Clone & State Immutability via getState()
  console.log('\n[1.7] State Immutability via getState():');
  const extractedState = store.getState();
  extractedState.app.name = 'POLLUTED_NAME';
  assert(store.get('app.name') === 'SOVEREIGN // AEGIS', 'Mutating getState() return value does NOT pollute internal state');

  // 1.8 Circular Reference Resilience in Storage Sanitization
  console.log('\n[1.8] Circular Reference Handling:');
  const storeCirc = new StateStore({}, { autoPersist: true });
  const circularObj = { name: 'circular_root' };
  circularObj.self = circularObj;

  // Setting circular object without crash in save()
  let setCircThrew = false;
  try {
    storeCirc.set('test.circularRef', circularObj);
  } catch (err) {
    setCircThrew = true;
  }
  assert(setCircThrew === false, 'Setting circular object does not throw uncaught error (save catches warning safely)');

  // ==========================================================================
  // SECTION 2: CRYPTOGRAPHIC ENGINE (AEGISCRYPTO) ADVERSARIAL STRESS TESTS
  // ==========================================================================
  console.log('\n--- SECTION 2: AegisCrypto Adversarial & Fuzz Tests ---');

  // 2.1 Keypair Generation Resilience & Identity Verification
  console.log('\n[2.1] Keypair Generation & Formatting:');
  const keypairs = [];
  const dids = new Set();
  const fingerprints = new Set();

  for (let i = 0; i < 10; i++) {
    const kp = await AegisCrypto.generateKeyPair();
    keypairs.push(kp);
    dids.add(kp.did);
    fingerprints.add(kp.fingerprint);
  }

  assert(dids.size === 10, '10 consecutively generated keypairs yield 10 unique DIDs');
  assert(fingerprints.size === 10, '10 consecutively generated keypairs yield 10 unique fingerprints');
  for (const kp of keypairs) {
    assert(kp.did.startsWith('did:key:z'), `DID ${kp.did.slice(0, 18)}... starts with did:key:z`);
    assert(kp.publicKeyJwk.crv === 'P-256', 'Public key JWK curve is P-256');
    assert(kp.publicKeyJwk.kty === 'EC', 'Public key JWK type is EC');
    assert(typeof kp.publicKeyJwk.x === 'string' && kp.publicKeyJwk.x.length > 0, 'JWK contains valid x coordinate');
    assert(typeof kp.publicKeyJwk.y === 'string' && kp.publicKeyJwk.y.length > 0, 'JWK contains valid y coordinate');
  }

  const primaryKey = keypairs[0];

  // 2.2 Multi-Byte UTF-8 & Unicode Payload Signing & Verification
  console.log('\n[2.2] Multi-Byte UTF-8 & Unicode Statement Signing:');
  const complexUnicodePayloads = [
    { type: 'Empty String', statement: '' },
    { type: 'Whitespace Only', statement: '   \t\r\n   ' },
    { type: 'CJK Ideographs', statement: '认知主权与认识论防御体系：真相验证与反虚假信息' },
    { type: 'Arabic & Hebrew (RTL)', statement: 'السيادة المعرفية والدفاع المعرفي - ריבונות הכרתית' },
    { type: 'Cyrillic & Greek', statement: 'Суверенная Эгида — Γνῶθι σεαυτόν & Ἐπιστήμη' },
    { type: 'Complex Emojis & Modifiers', statement: '🛡️ Sovereign Aegis ⚔️ 👨‍👩‍👧‍👦 🏳️‍🌈 🎯 🧠 👁️‍🗨️' },
    { type: 'Control & Null Bytes', statement: 'Null\u0000Byte\u001FControl\u007FDel' },
    { type: 'Maximum Unicode Astral Plane', statement: 'Astral \u{10FFFF} Symbol \u{1F985} Gryphon' },
    {
      type: 'Deeply Nested Complex Object',
      nested: {
        layer1: {
          array: [1, null, false, true, { inner: '✨ deep text' }],
          score: 99.987654321
        }
      }
    }
  ];

  for (const item of complexUnicodePayloads) {
    const sig = await AegisCrypto.signStatement(primaryKey.keyPair.privateKey, item);
    assert(typeof sig === 'string' && sig.length > 40, `Signed ${item.type} producing valid base64url signature`);

    const verifiedWithCryptoKey = await AegisCrypto.verifyStatement(primaryKey.keyPair.publicKey, item, sig);
    assert(verifiedWithCryptoKey === true, `Verified ${item.type} with CryptoKey`);

    const verifiedWithJwk = await AegisCrypto.verifyStatement(primaryKey.publicKeyJwk, item, sig);
    assert(verifiedWithJwk === true, `Verified ${item.type} with JWK`);
  }

  // 2.3 Strict Rejection of Tampered & Adversarial Signatures
  console.log('\n[2.3] Adversarial Signature Tampering & Bit-Flip Fuzzing:');

  const baseStatement = {
    claimId: 'CLAIM-98721',
    veracity: 'CONFIRMED_DISINFORMATION',
    confidence: 0.994,
    tags: ['deepfake', 'synthetic_audio', 'election_tampering']
  };

  const validSig = await AegisCrypto.signStatement(primaryKey.keyPair.privateKey, baseStatement);
  assert(await AegisCrypto.verifyStatement(primaryKey.publicKeyJwk, baseStatement, validSig) === true, 'Baseline signature verifies true');

  // Tamper Payload - single character change
  const tamperedStatement = { ...baseStatement, confidence: 0.995 };
  assert(await AegisCrypto.verifyStatement(primaryKey.publicKeyJwk, tamperedStatement, validSig) === false, 'Tampered float in payload rejected strictly');

  const tamperedTagStatement = { ...baseStatement, tags: ['deepfake', 'synthetic_audio', 'election_tampering_mod'] };
  assert(await AegisCrypto.verifyStatement(primaryKey.publicKeyJwk, tamperedTagStatement, validSig) === false, 'Tampered array item rejected strictly');

  // Cross-Key Attack: signature verified against different keypair
  const attackerKey = keypairs[1];
  assert(await AegisCrypto.verifyStatement(attackerKey.publicKeyJwk, baseStatement, validSig) === false, 'Cross-key verification strictly rejected');

  // Bit-Flip Fuzzing across 64-byte signature
  console.log('\n[2.4] Signature Bit-Flip Fuzzing (64 byte offsets):');
  const rawSigBytes = AegisCrypto.base64UrlDecode(validSig);
  let bitFlipRejections = 0;
  const bitFlipTrials = 20;

  for (let step = 0; step < bitFlipTrials; step++) {
    const byteIndex = Math.floor((step / bitFlipTrials) * rawSigBytes.length);
    const corruptedBytes = new Uint8Array(rawSigBytes);
    corruptedBytes[byteIndex] ^= 0x01; // Flip lowest bit

    const corruptedSigStr = AegisCrypto.base64UrlEncode(corruptedBytes);
    const isValid = await AegisCrypto.verifyStatement(primaryKey.publicKeyJwk, baseStatement, corruptedSigStr);
    if (!isValid) bitFlipRejections++;
  }
  assert(bitFlipRejections === bitFlipTrials, `All ${bitFlipTrials} bit-flipped signatures strictly rejected`);

  // Truncated, Expanded, Corrupted Base64url Strings
  console.log('\n[2.5] Malformed Signature Strings & Encodings:');
  assert(await AegisCrypto.verifyStatement(primaryKey.publicKeyJwk, baseStatement, '') === false, 'Empty signature string rejected');
  assert(await AegisCrypto.verifyStatement(primaryKey.publicKeyJwk, baseStatement, 'AAAA') === false, 'Short 4-byte signature rejected');
  assert(await AegisCrypto.verifyStatement(primaryKey.publicKeyJwk, baseStatement, validSig.slice(0, 32)) === false, 'Truncated signature rejected');
  assert(await AegisCrypto.verifyStatement(primaryKey.publicKeyJwk, baseStatement, validSig + validSig) === false, 'Double-length signature rejected');
  assert(await AegisCrypto.verifyStatement(primaryKey.publicKeyJwk, baseStatement, '!!!INVALID_CHARS@@@===') === false, 'Illegal character signature rejected');
  assert(await AegisCrypto.verifyStatement(primaryKey.publicKeyJwk, baseStatement, validSig + '===') === false, 'Padded signature rejected');

  // 2.6 Malformed & Corrupted JWK Import Fuzzing
  console.log('\n[2.6] Malformed JWK Import & Curve Fuzzing:');

  // Missing coordinates
  const jwkNoX = { kty: 'EC', crv: 'P-256', y: primaryKey.publicKeyJwk.y };
  assert(await AegisCrypto.verifyStatement(jwkNoX, baseStatement, validSig) === false, 'JWK missing x coordinate rejected');

  const jwkNoY = { kty: 'EC', crv: 'P-256', x: primaryKey.publicKeyJwk.x };
  assert(await AegisCrypto.verifyStatement(jwkNoY, baseStatement, validSig) === false, 'JWK missing y coordinate rejected');

  // Wrong Curve
  const jwkP384 = { ...primaryKey.publicKeyJwk, crv: 'P-384' };
  assert(await AegisCrypto.verifyStatement(jwkP384, baseStatement, validSig) === false, 'JWK with wrong curve P-384 rejected');

  const jwkEd25519 = { ...primaryKey.publicKeyJwk, crv: 'Ed25519' };
  assert(await AegisCrypto.verifyStatement(jwkEd25519, baseStatement, validSig) === false, 'JWK with Ed25519 rejected');

  // Wrong Key Type
  const jwkRSA = { ...primaryKey.publicKeyJwk, kty: 'RSA' };
  assert(await AegisCrypto.verifyStatement(jwkRSA, baseStatement, validSig) === false, 'JWK with RSA type rejected');

  // Corrupt base64 in coordinates
  const jwkCorruptX = { ...primaryKey.publicKeyJwk, x: '??not_base64url!!' };
  assert(await AegisCrypto.verifyStatement(jwkCorruptX, baseStatement, validSig) === false, 'JWK with corrupt x coordinate rejected');

  // Completely invalid input types
  assert(await AegisCrypto.verifyStatement(null, baseStatement, validSig) === false, 'Null public key rejected');
  assert(await AegisCrypto.verifyStatement(undefined, baseStatement, validSig) === false, 'Undefined public key rejected');
  assert(await AegisCrypto.verifyStatement({}, baseStatement, validSig) === false, 'Empty object public key rejected');
  assert(await AegisCrypto.verifyStatement('not a key', baseStatement, validSig) === false, 'String public key rejected');

  // 2.7 Canonicalization Deep Permutation Testing:
  console.log('\n[2.7] Canonicalization Deep Permutation Testing:');
  const objA = {
    zeta: 100,
    alpha: { gamma: [3, 2, 1], beta: 'test' },
    mu: null,
    delta: true
  };
  const objB = {
    delta: true,
    alpha: { beta: 'test', gamma: [3, 2, 1] },
    zeta: 100,
    mu: null
  };

  const canonA = AegisCrypto.canonicalize(objA);
  const canonB = AegisCrypto.canonicalize(objB);
  assert(canonA === canonB, 'Different key-ordered objects produce identical canonical JSON string');

  const hashA = await AegisCrypto.computeHash(objA);
  const hashB = await AegisCrypto.computeHash(objB);
  assert(hashA === hashB, 'Hashes of permuted objects are strictly identical');

  // 2.8 Base58BTC & Base64url Boundary & Roundtrip Testing
  console.log('\n[2.8] Base58BTC & Base64url Boundary Testing:');
  
  // Empty byte array
  assert(AegisCrypto.base58Encode(new Uint8Array(0)) === '', 'Base58 encode 0 bytes produces empty string');
  assert(AegisCrypto.base58Decode('').length === 0, 'Base58 decode empty string produces 0 bytes');

  // Leading zeros preservation in Base58
  const leadingZeroBytes = new Uint8Array([0, 0, 0, 0, 42, 99]);
  const b58Leading = AegisCrypto.base58Encode(leadingZeroBytes);
  assert(b58Leading.startsWith('1111'), `Base58 encodes 4 leading zeroes as '1111': ${b58Leading}`);
  const b58DecLeading = AegisCrypto.base58Decode(b58Leading);
  let leadingMatch = b58DecLeading.length === leadingZeroBytes.length;
  for (let i = 0; i < leadingZeroBytes.length; i++) {
    if (leadingZeroBytes[i] !== b58DecLeading[i]) leadingMatch = false;
  }
  assert(leadingMatch, 'Base58 decode accurately restores leading zero bytes');

  // Base58 decode invalid characters throws error
  let b58Threw = false;
  try {
    AegisCrypto.base58Decode('111000OOOlll'); // '0', 'O', 'I', 'l' are forbidden in Base58
  } catch (err) {
    b58Threw = true;
  }
  assert(b58Threw === true, 'Base58 decode throws on forbidden characters (0, O, I, l)');

  // Base64url 256-byte roundtrip
  const allBytes = new Uint8Array(256);
  for (let i = 0; i < 256; i++) allBytes[i] = i;
  const b64All = AegisCrypto.base64UrlEncode(allBytes);
  const b64AllDec = AegisCrypto.base64UrlDecode(b64All);
  let allBytesMatch = b64AllDec.length === 256;
  for (let i = 0; i < 256; i++) {
    if (b64AllDec[i] !== i) allBytesMatch = false;
  }
  assert(allBytesMatch && !b64All.includes('+') && !b64All.includes('/') && !b64All.includes('='), 'Base64url encodes/decodes all 256 byte values cleanly');

  // 2.9 SHA-256 Standard Vector Verification
  console.log('\n[2.9] SHA-256 Standard Vectors:');
  const emptyHash = await AegisCrypto.computeHash('');
  assert(emptyHash === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'SHA-256 empty string matches NIST standard hash');

  const knownHash = await AegisCrypto.computeHash('The quick brown fox jumps over the lazy dog');
  assert(knownHash === 'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592', 'SHA-256 standard pangram matches standard hash');

  // 2.10 W3C JSON-LD Verifiable Credential Structure & Proof Integrity
  console.log('\n[2.10] W3C JSON-LD Verifiable Credential Verification:');
  const claimPayload = {
    epistemicClaim: 'Source Outlier-9 identified as synchronized bot farm',
    confidenceScore: 0.99,
    disarmTactics: ['T0043', 'T0088']
  };
  const claimSig = await AegisCrypto.signStatement(primaryKey.keyPair.privateKey, claimPayload);
  const vc = AegisCrypto.exportVerifiableCredential(primaryKey.did, primaryKey.publicKeyJwk, claimPayload, claimSig);

  assert(Array.isArray(vc['@context']) && vc['@context'].length === 3, 'VC @context contains 3 ontology URIs');
  assert(vc.type.includes('VerifiableCredential') && vc.type.includes('EpistemicAttestationCredential'), 'VC type array contains required schema types');
  assert(vc.issuer === primaryKey.did, 'VC issuer matches signer DID');
  assert(vc.credentialSubject.epistemicClaim === claimPayload.epistemicClaim, 'VC credentialSubject contains claim payload');
  assert(vc.proof.type === 'JsonWebSignature2020', 'VC proof type is JsonWebSignature2020');
  assert(vc.proof.jws === claimSig, 'VC proof jws matches statement signature');
  assert(vc.proof.verificationMethod.startsWith(primaryKey.did), 'VC verificationMethod references issuer DID');

  // Verify signature embedded in VC proof against credentialSubject
  const { id: subId, ...subjectClaims } = vc.credentialSubject;
  const isVcValid = await AegisCrypto.verifyStatement(primaryKey.publicKeyJwk, subjectClaims, vc.proof.jws);
  assert(isVcValid === true, 'Signature extracted directly from W3C VC proof verifies validly against credentialSubject');

  // ==========================================================================
  // FINAL SUMMARY
  // ==========================================================================
  console.log('\n================================================================');
  console.log(`STRESS TEST SUMMARY: ${passed} PASSED, ${failed} FAILED.`);
  console.log('================================================================');

  if (failed > 0) {
    console.error('\nFAILURES ENCOUNTERED:');
    for (const f of failures) {
      console.error(`  - ${f}`);
    }
    process.exit(1);
  }
}

runAdversarialStressSuite().catch(err => {
  console.error('\nUNCAUGHT ERROR DURING STRESS SUITE:', err);
  process.exit(1);
});
