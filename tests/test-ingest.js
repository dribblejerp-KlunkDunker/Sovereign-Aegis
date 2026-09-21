/**
 * SOVEREIGN // AEGIS — Zero-Click Ingestion Suite
 * Validates the ?verify= deep-link parser and the bookmarklet builder. Pure functions
 * only — these are the rules an attacker can reach with a crafted URL, so they are
 * tested here against malformed, oversized, and hostile inputs.
 * Zero external runtime dependencies.
 */

import { parseVerify, decodeVerifyText, buildBookmarklet, VERIFY_MAX_CHARS } from '../js/ingest.js';

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

const harness = new TestHarness('Zero-Click Ingestion Suite');

// ----------------------------------------------------
// parseVerify
// ----------------------------------------------------
harness.describe('parseVerify — plain text', () => {
  harness.it('reads a plain query value', () => {
    harness.assertEqual(parseVerify('?verify=hello%20world'), 'hello world', 'decodes a URL-encoded value');
  });

  harness.it('trims surrounding whitespace', () => {
    harness.assertEqual(parseVerify('?verify=%20%20a%20claim%20%20'), 'a claim', 'whitespace is trimmed');
  });

  harness.it('returns null when the parameter is absent', () => {
    harness.assertEqual(parseVerify('?other=1'), null, 'no verify param → null');
  });

  harness.it('returns null for an empty value', () => {
    harness.assertEqual(parseVerify('?verify='), null, 'empty value → null');
    harness.assertEqual(parseVerify('?verify=%20%20'), null, 'whitespace-only value → null');
  });

  harness.it('returns null for non-string input', () => {
    harness.assertEqual(parseVerify(null), null, 'null → null');
    harness.assertEqual(parseVerify(undefined), null, 'undefined → null');
  });

  harness.it('preserves hostile markup as inert text', () => {
    const got = parseVerify('?verify=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E');
    harness.assertEqual(got, '<img src=x onerror=alert(1)>', 'markup survives as plain text, not executed');
  });
});

// ----------------------------------------------------
// parseVerify — b64: prefix
// ----------------------------------------------------
harness.describe('parseVerify — b64: prefix', () => {
  harness.it('decodes a base64url payload', () => {
    const b64 = Buffer.from('a claim with a 💣 character', 'utf8').toString('base64url');
    harness.assertEqual(parseVerify(`?verify=b64:${b64}`), 'a claim with a 💣 character', 'UTF-8 round-trips');
  });

  harness.it('returns null for malformed base64', () => {
    harness.assertEqual(parseVerify('?verify=b64:!!!not-base64!!!'), null, 'malformed base64 → null, never a guess');
  });

  harness.it('treats the b64: prefix as an explicit decoder, not a literal', () => {
    harness.assertEqual(parseVerify('?verify=b64:hello'), null, 'undecodable b64: payload → null, never silently literal');
  });
});

// ----------------------------------------------------
// decodeVerifyText — size cap
// ----------------------------------------------------
harness.describe('decodeVerifyText — size cap', () => {
  harness.it('caps oversized claims at VERIFY_MAX_CHARS', () => {
    const big = 'x'.repeat(VERIFY_MAX_CHARS + 500);
    const got = decodeVerifyText(big);
    harness.assertEqual(got.length, VERIFY_MAX_CHARS, 'oversized text is truncated to the cap');
  });

  harness.it('leaves short claims untouched', () => {
    harness.assertEqual(decodeVerifyText('short claim'), 'short claim', 'short text unchanged');
  });

  harness.it('returns null for null input', () => {
    harness.assertEqual(decodeVerifyText(null), null, 'null → null');
  });
});

// ----------------------------------------------------
// buildBookmarklet
// ----------------------------------------------------
harness.describe('buildBookmarklet', () => {
  harness.it('produces a javascript: bookmarklet that targets the given base URL', () => {
    const snippet = buildBookmarklet('http://127.0.0.1:8000/index.html');
    harness.assert(snippet.startsWith('javascript:'), 'snippet is a javascript: URL');
    harness.assert(snippet.includes("location.href='http://127.0.0.1:8000/index.html?verify='"), 'navigates to the app with the verify param');
    harness.assert(snippet.includes('encodeURIComponent(s)'), 'encodes the selection');
  });

  harness.it('strips an existing query/hash from the base URL', () => {
    const snippet = buildBookmarklet('http://127.0.0.1:8000/index.html?foo=1#bar');
    harness.assert(!snippet.includes('?foo=1'), 'existing query is stripped');
    harness.assert(snippet.includes('?verify='), 'the verify param is still added');
  });

  harness.it('guards against an empty selection', () => {
    const snippet = buildBookmarklet('http://localhost/');
    harness.assert(snippet.includes("alert('Select the claim text first, then run this bookmarklet.')"), 'empty selection is handled');
  });
});

const result = harness.summary();
export default result;
