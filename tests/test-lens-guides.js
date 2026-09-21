/**
 * SOVEREIGN // AEGIS — Lens Library & Safe Renderer Suite
 *
 * The Resistance Library renders compiled lens guides (data/lens-guides.json) through the
 * pure renderer js/lensRender.js. This suite checks the facts the feature depends on:
 *
 *   1. the dataset is well-formed — 3 guides, three rules each, block arrays present;
 *   2. the renderer is an injection sink by design — hostile text is escaped, hostile
 *      schemes are blocked by escUrl, malformed blocks degrade instead of throwing;
 *   3. the real guides render safe — no raw script text, only https hrefs, no <h1>;
 *   4. every `skill.*` drill code referenced by a guide exists in data/skills.json.
 *
 * Zero external runtime dependencies.
 */

import { readFileSync } from 'node:fs';
import { renderInline, renderBlock, renderGuideDoc } from '../js/lensRender.js';

const data = JSON.parse(readFileSync(new URL('../data/lens-guides.json', import.meta.url), 'utf8'));
const skills = JSON.parse(readFileSync(new URL('../data/skills.json', import.meta.url), 'utf8'));
const skillIds = new Set((Array.isArray(skills) ? skills : []).map((s) => s.id));

class TestHarness {
  constructor(name) {
    this.suiteName = name; this.totalAssertions = 0; this.passed = 0;
    this.failed = 0; this.failures = []; this.currentSuite = '';
  }
  describe(name, fn) { this.currentSuite = name; console.log(`\n  --- ${name} ---`); return fn(); }
  async it(name, fn) {
    try { await fn(); this.passed++; this.totalAssertions++; console.log(`    ✓ ${name}`); } catch (err) {
      this.failed++; this.totalAssertions++;
      this.failures.push({ suite: this.currentSuite, test: name, error: err.message });
      console.error(`    ✗ [FAIL] ${name} (${err.message})`);
    }
  }
  assert(cond, msg) {
    if (!cond) throw new Error(msg || 'Assertion failed');
  }
  summary() {
    console.log(`\nSummary: ${this.passed}/${this.totalAssertions} Passed (${this.failed} Failed)`);
    if (this.failures.length) {
      console.error('Failures:');
      for (const f of this.failures) console.error(`  - [${f.suite}] ${f.test}: ${f.error}`);
    }
    return this.failed === 0;
  }
}

const h = new TestHarness('Lens Library & Safe Renderer');

await h.describe('dataset shape', async () => {
  await h.it('payload has version and exactly 3 guides', () => {
    h.assert(data.version === 1, 'version missing');
    h.assert(Array.isArray(data.guides) && data.guides.length === 3, 'expected 3 guides');
  });
  await h.it('each guide has id, tier, 3 rules and blocks', () => {
    for (const g of data.guides) {
      h.assert(typeof g.id === 'string' && g.id.startsWith('lens.'), `bad id: ${g.id}`);
      h.assert(typeof g.title === 'string' && g.title.length > 10, `bad title: ${g.id}`);
      const expectedTier = { 'lens.mbti': 'popular-weak', 'lens.enneagram': 'popular-weak', 'lens.darktriad': 'moderate' }[g.id];
      h.assert(g.evidenceTier === expectedTier, `${g.id} tier: ${g.evidenceTier}, expected ${expectedTier}`);
      h.assert(Array.isArray(g.rules) && g.rules.length === 3, `${g.id} rules: ${g.rules?.length}`);
      h.assert(g.rules.every((r) => r.title && Array.isArray(r.body)), `${g.id} malformed rule`);
      h.assert(Array.isArray(g.blocks) && g.blocks.length > 20, `${g.id} blocks: ${g.blocks?.length}`);
    }
  });
  await h.it('guide ids are unique', () => {
    const ids = data.guides.map((g) => g.id);
    h.assert(new Set(ids).size === ids.length, 'duplicate ids');
  });
});

await h.describe('renderer security', async () => {
  await h.it('text ops are HTML-escaped', () => {
    const html = renderInline([['t', '<script>alert(1)</script>']]);
    h.assert(!html.includes('<script'), 'raw script tag survived: ' + html);
    h.assert(html.includes('&lt;script&gt;'), 'escaping not applied');
  });
  await h.it('javascript: hrefs are blocked by escUrl', () => {
    const html = renderInline([['a', 'javascript:alert(1)', [['t', 'click']]]]);
    h.assert(html.includes('href="#blocked"'), 'scheme not blocked: ' + html);
  });
  await h.it('event-handler injection in text cannot escape', () => {
    const html = renderInline([['t', '" onmouseover="alert(1)']]);
    h.assert(!html.includes('" onmouseover='), 'quote escaped incorrectly');
    h.assert(html.includes('&quot;'), 'quote not entity-encoded');
  });
  await h.it('malformed ops render as text, never throw', () => {
    h.assert(typeof renderInline(null) === 'string', 'null ops throw');
    h.assert(typeof renderInline([['x', 'junk'], 'raw', 42]) === 'string', 'malformed ops throw');
  });
  await h.it('unknown block types degrade to empty string', () => {
    h.assert(renderBlock({ type: 'mystery' }) === '', 'unknown block rendered');
    h.assert(renderBlock(null) === '' && renderBlock(42) === '', 'junk block rendered');
  });
  await h.it('tables pad ragged rows', () => {
    const html = renderBlock({ type: 'table', rows: [[['t', 'A'], ['t', 'B']], [['t', 'only']]] });
    h.assert((html.match(/<td>/g) || []).length === 2, 'ragged row not padded');
  });
});

await h.describe('real guides render safe', async () => {
  for (const g of data.guides) {
    await h.it(`${g.id}: no script text, https-only links, no h1`, () => {
      const html = renderGuideDoc(g).toString();
      h.assert(!html.includes('<script'), `${g.id}: raw script tag`);
      const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
      h.assert(hrefs.every((u) => u.startsWith('https://')), `${g.id}: non-https href: ${hrefs.find((u) => !u.startsWith('https://'))}`);
      h.assert(!/<h1[\s>]/.test(html), `${g.id}: h1 leaked into body`);
      h.assert(html.includes('lens-rule'), `${g.id}: rules block missing`);
    });
  }
  await h.it('every skill.* code referenced by a guide exists in skills.json', () => {
    const blob = JSON.stringify(data.guides);
    const codes = [...blob.matchAll(/skill\.[a-z0-9][a-z0-9.-]*/g)].map((m) => m[0].replace(/[.-]+$/, ''));
    h.assert(codes.length > 0, 'no skill references found — route table drifted?');
    const missing = [...new Set(codes)].filter((c) => !skillIds.has(c));
    h.assert(missing.length === 0, `unknown skill ids: ${missing.join(', ')}`);
  });
});

process.exitCode = h.summary() ? 0 : 1;
