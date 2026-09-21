/**
 * SOVEREIGN // AEGIS — Test Suite: C2PA / JUMBF manifest reader (js/c2pa.js)
 *
 * The previous implementation could not be tested meaningfully because it did not parse
 * anything — it ran `.includes('gemini')` over the file decoded as UTF-8. The decisive
 * test here is the FALSE POSITIVE case: a plain JPEG whose comment field mentions
 * "canon" and "gemini" must report NO manifest. The old code reported a hardware camera
 * capture for exactly that input.
 *
 * Fixtures are constructed byte-by-byte in this file, so there are no binary blobs to
 * trust and every structure under test is explicit.
 *
 * Zero external runtime dependencies.
 */

import { readC2paManifest } from '../js/c2pa.js';

class TestHarness {
  constructor(name) {
    this.suiteName = name; this.totalAssertions = 0; this.passed = 0;
    this.failed = 0; this.failures = []; this.currentSuite = '';
  }
  describe(name, fn) { this.currentSuite = name; console.log(`\n  --- ${name} ---`); return fn(); }
  async it(name, fn) {
    try { await fn(); } catch (err) {
      this.failed++; this.totalAssertions++;
      this.failures.push({ suite: this.currentSuite, test: name, error: err.message });
      console.error(`  ✗ [FAIL] ${name} (${err.message})`);
    }
  }
  assert(cond, msg) {
    this.totalAssertions++;
    if (cond) { this.passed++; console.log(`    ✓ ${msg}`); }
    else { this.failed++; this.failures.push({ suite: this.currentSuite, test: msg, error: 'Assertion failed' }); console.error(`    ✗ [FAIL] ${msg}`); }
  }
  assertEqual(a, e, m) { this.assert(a === e, `${m} | got ${JSON.stringify(a)}, expected ${JSON.stringify(e)}`); }
  summary() {
    console.log('\n====================================================');
    console.log(`[${this.suiteName}] Summary: ${this.passed}/${this.totalAssertions} Passed (${this.failed} Failed)`);
    console.log('====================================================');
    if (this.failed > 0) {
      console.error('\nFailure Details:');
      this.failures.forEach(f => console.error(` - [${f.suite}] ${f.test}: ${f.error}`));
      process.exitCode = 1;
    }
    return { passed: this.passed, failed: this.failed, total: this.totalAssertions };
  }
}

/* ---------------------------------------------------------- fixture builders */

const enc = (s) => new TextEncoder().encode(s);
const cat = (...parts) => {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
const u32 = (n) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const u16 = (n) => new Uint8Array([(n >> 8) & 255, n & 255]);

/** Minimal CBOR encoder — only what the fixtures need. */
function cbor(value) {
  const head = (major, len) => {
    if (len < 24) return new Uint8Array([(major << 5) | len]);
    if (len < 256) return new Uint8Array([(major << 5) | 24, len]);
    if (len < 65536) return cat(new Uint8Array([(major << 5) | 25]), u16(len));
    return cat(new Uint8Array([(major << 5) | 26]), u32(len));
  };
  if (typeof value === 'string') { const b = enc(value); return cat(head(3, b.length), b); }
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return head(0, value);
  if (value === true) return new Uint8Array([0xf5]);
  if (value === false) return new Uint8Array([0xf4]);
  if (value === null) return new Uint8Array([0xf6]);
  if (Array.isArray(value)) return cat(head(4, value.length), ...value.map(cbor));
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    return cat(head(5, keys.length), ...keys.flatMap(k => [cbor(k), cbor(value[k])]));
  }
  throw new Error('cbor fixture: unsupported ' + typeof value);
}

/** JUMBF description box. */
function jumd(typeStr, label) {
  const uuid = new Uint8Array(16);
  uuid.set(enc(typeStr).subarray(0, 4), 0);
  const toggles = new Uint8Array([label ? 0x03 : 0x01]);
  const lbl = label ? cat(enc(label), new Uint8Array([0])) : new Uint8Array(0);
  const content = cat(uuid, toggles, lbl);
  return cat(u32(content.length + 8), enc('jumd'), content);
}
/** Generic JUMBF box. */
function box(type, content) {
  return cat(u32(content.length + 8), enc(type), content);
}
/** JUMBF superbox. */
function jumb(typeStr, label, ...children) {
  return box('jumb', cat(jumd(typeStr, label), ...children));
}

/** Wrap a JUMBF payload into JPEG APP11 segments, splitting across two segments. */
function jpegWithJumbf(payload, { split = true } = {}) {
  const soi = new Uint8Array([0xff, 0xd8]);
  const eoi = new Uint8Array([0xff, 0xd9]);
  const halves = split
    ? [payload.subarray(0, Math.floor(payload.length / 2)), payload.subarray(Math.floor(payload.length / 2))]
    : [payload];
  const segs = halves.map((chunk, i) => {
    // 'JP' + instance(2) + sequence(4) + payload
    const body = cat(enc('JP'), u16(1), u32(i + 1), chunk);
    return cat(new Uint8Array([0xff, 0xeb]), u16(body.length + 2), body);
  });
  return cat(soi, ...segs, eoi).buffer;
}

/** A JPEG with only a COM comment — no manifest at all. */
function jpegWithComment(text) {
  const soi = new Uint8Array([0xff, 0xd8]);
  const body = enc(text);
  const com = cat(new Uint8Array([0xff, 0xfe]), u16(body.length + 2), body);
  const eoi = new Uint8Array([0xff, 0xd9]);
  return cat(soi, com, eoi).buffer;
}

/** PNG with a caBX chunk carrying a JUMBF payload. */
function pngWithCaBX(payload) {
  const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunk = (type, data) => cat(u32(data.length), enc(type), data, u32(0));
  const ihdr = chunk('IHDR', cat(u32(1), u32(1), new Uint8Array([8, 0, 0, 0, 0])));
  return cat(sig, ihdr, chunk('caBX', payload), chunk('IEND', new Uint8Array(0))).buffer;
}

/** A realistic-looking manifest store. */
function manifestPayload(generator, extra = {}) {
  const claim = cbor({
    claim_generator: generator,
    alg: 'ps256',
    assertions: [
      { label: 'c2pa.actions', data: { actions: [{ action: 'c2pa.created' }] } },
      { label: 'stds.schema-org.CreativeWork', data: { author: [{ name: 'Test Author' }] } },
      ...(extra.ai ? [{ label: 'c2pa.ai_generative', data: { digitalSourceType: 'trainedAlgorithmicMedia' } }] : [])
    ]
  });
  return jumb('c2pa', 'c2pa.manifest',
    jumb('c2cl', 'c2pa.claim', box('cbor', claim)),
    jumb('c2cs', 'c2pa.signature', box('cbor', cbor({ alg: 'ps256', sig: 'stub' })))
  );
}

const harness = new TestHarness('C2PA / JUMBF Manifest Reader Suite');

async function runTests() {
  await harness.describe('Tier 1: False positives — the failure mode of the old scanner', async () => {
    await harness.it('A plain JPEG mentioning "canon" and "gemini" reports NO manifest', () => {
      const buf = jpegWithComment('Shot on canon EOS. Processed with gemini tooling. jumb c2pa synthid midjourney');
      const r = readC2paManifest(buf);
      harness.assertEqual(r.manifestPresent, false, 'manifestPresent is false despite the trigger words');
      harness.assertEqual(r.claimGenerator, null, 'no claim generator invented');
      harness.assertEqual(r.container, 'JPEG', 'container still identified correctly');
      harness.assert(r.assertions.length === 0, 'no assertions fabricated');
    });

    await harness.it('Random binary noise reports no manifest and does not throw', () => {
      const n = new Uint8Array(4096);
      let seed = 99;
      for (let i = 0; i < n.length; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; n[i] = seed & 255; }
      const r = readC2paManifest(n.buffer);
      harness.assertEqual(r.manifestPresent, false, 'no manifest in noise');
      harness.assert(Array.isArray(r.parseErrors), 'parseErrors is an array');
    });

    await harness.it('An empty buffer degrades safely', () => {
      const r = readC2paManifest(new Uint8Array(0).buffer);
      harness.assertEqual(r.manifestPresent, false, 'no manifest');
      harness.assertEqual(r.bytesScanned, 0, 'bytesScanned reported as 0');
    });
  });

  await harness.describe('Tier 2: Real JUMBF + CBOR parsing', async () => {
    await harness.it('Reads a claim generator out of a JPEG APP11 JUMBF manifest', () => {
      const buf = jpegWithJumbf(manifestPayload('Adobe Photoshop 25.0'));
      const r = readC2paManifest(buf);
      harness.assertEqual(r.container, 'JPEG', 'JPEG detected');
      harness.assertEqual(r.manifestPresent, true, 'manifest found via real box walk');
      harness.assertEqual(r.claimGenerator, 'Adobe Photoshop 25.0', 'claim_generator decoded from CBOR');
      harness.assertEqual(r.signatureAlgorithm, 'ps256', 'signature algorithm read from the claim');
      harness.assert(r.assertions.length >= 2, `assertions decoded (${r.assertions.length})`);
      harness.assert(r.assertions.some(a => a.label === 'c2pa.actions'), 'c2pa.actions assertion present');
      harness.assert(r.jumbfLabels.includes('c2pa.manifest'), 'JUMBF labels read from description boxes');
      harness.assertEqual(r.signaturePresent, true, 'signature box detected');
    });

    await harness.it('Reassembles a manifest split across multiple APP11 segments', () => {
      const payload = manifestPayload('Split Segment Generator 1.2');
      const single = readC2paManifest(jpegWithJumbf(payload, { split: false }));
      const split = readC2paManifest(jpegWithJumbf(payload, { split: true }));
      harness.assertEqual(single.claimGenerator, 'Split Segment Generator 1.2', 'single-segment parses');
      harness.assertEqual(split.claimGenerator, 'Split Segment Generator 1.2', 'two-segment reassembly matches');
      harness.assertEqual(split.assertions.length, single.assertions.length, 'same assertion count either way');
    });

    await harness.it('Reads a PNG caBX chunk', () => {
      const r = readC2paManifest(pngWithCaBX(manifestPayload('Firefly 3.0')));
      harness.assertEqual(r.container, 'PNG', 'PNG detected');
      harness.assertEqual(r.manifestPresent, true, 'manifest found in caBX chunk');
      harness.assertEqual(r.claimGenerator, 'Firefly 3.0', 'claim generator decoded');
    });

    await harness.it('Detects a genuine AI-generative assertion (not a substring match)', () => {
      const ai = readC2paManifest(jpegWithJumbf(manifestPayload('Imagen 3', { ai: true })));
      const notAi = readC2paManifest(jpegWithJumbf(manifestPayload('Leica M11')));
      harness.assertEqual(ai.aiGenerated, 'yes', 'trainedAlgorithmicMedia assertion detected');
      harness.assert(notAi.aiGenerated !== 'yes', `camera manifest not flagged as AI (got ${notAi.aiGenerated})`);
    });

    await harness.it('Malformed JUMBF is reported, not silently accepted', () => {
      // A truncated box: declared size far larger than the data present.
      const bogus = cat(u32(9999), new TextEncoder().encode('jumb'), new Uint8Array([1, 2, 3]));
      const r = readC2paManifest(jpegWithJumbf(bogus, { split: false }));
      harness.assertEqual(r.manifestPresent, false, 'oversized box rejected rather than trusted');
    });
  });

  await harness.describe('Tier 3: Honesty of the verification claim', async () => {
    await harness.it('cryptographicallyVerified is always false, even for a well-formed manifest', () => {
      const r = readC2paManifest(jpegWithJumbf(manifestPayload('Adobe Photoshop 25.0')));
      harness.assertEqual(r.cryptographicallyVerified, false,
        'a parsed manifest is never reported as cryptographically verified');
      harness.assert(r.verificationLimitations.length >= 4,
        `limitations enumerated for the UI (${r.verificationLimitations.length})`);
      harness.assert(r.verificationLimitations.some(l => /trust list/i.test(l)),
        'trust-list gap stated explicitly');
      harness.assert(r.verificationLimitations.some(l => /hash binding/i.test(l)),
        'hash-binding gap stated explicitly');
    });

    await harness.it('signaturePresent and cryptographicallyVerified are distinct fields', () => {
      const r = readC2paManifest(jpegWithJumbf(manifestPayload('Test')));
      harness.assertEqual(r.signaturePresent, true, 'a signature box exists');
      harness.assertEqual(r.cryptographicallyVerified, false, 'which is not the same as it being valid');
    });
  });

  return harness.summary();
}

runTests().then(r => { if (r.failed > 0) process.exitCode = 1; });
