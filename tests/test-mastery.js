/**
 * SOVEREIGN // AEGIS — Test Suite: Competency spine mastery panel + messenger wiring
 *
 * This is the proof for "the messenger's near-share misses visibly move the stop-skill
 * mastery number." The estimator (js/competency.js) and the panel (js/masteryPanel.js) are
 * both pure, so the full loop is exercised here without a browser:
 *
 *   near-share miss (skill.sift.stop, correct:false, context:'messenger')
 *     -> estimate() lowers mastery below the 0.5 prior and raises confidence
 *     -> masteryPanel() renders that number and the near-share count.
 *
 * The browser side of the loop — the messenger writing that exact record into
 * `sovereign-aegis-attempts` — is asserted in BlackVault-Reema's src/messenger-verdad.js.
 * Zero external runtime dependencies.
 */

import { estimate, estimateAll } from '../js/competency.js';
import { masteryPanel, STOP_SKILL_ID } from '../js/masteryPanel.js';

const fsMod = await import('node:fs');
const urlMod = await import('node:url');
const readData = (rel) =>
  JSON.parse(fsMod.readFileSync(urlMod.fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8'));
const SKILLS = readData('data/skills.json');

const NOW = 1787000000000;
const DAY_MS = 86400000;

class TestHarness {
  constructor(name) { this.name = name; this.total = 0; this.passed = 0; this.failed = 0; this.failures = []; this.suite = ''; }
  describe(name, fn) { this.suite = name; console.log(`\n  --- ${name} ---`); return fn(); }
  async it(name, fn) {
    try { await fn(); }
    catch (err) { this.failed++; this.total++; this.failures.push({ suite: this.suite, test: name, error: err.message }); console.error(`  ✗ [FAIL] ${name} (${err.message})`); }
  }
  assert(cond, msg) {
    this.total++;
    if (cond) { this.passed++; console.log(`    ✓ ${msg}`); }
    else { this.failed++; this.failures.push({ suite: this.suite, test: msg, error: 'Assertion failed' }); console.error(`    ✗ [FAIL] ${msg}`); }
  }
  assertEqual(a, e, m) { this.assert(a === e, `${m} | got ${JSON.stringify(a)}, expected ${JSON.stringify(e)}`); }
  close(delta, msg) { const ok = Math.abs(delta) < 1e-9; this.assert(ok, `${msg} (Δ=${delta.toExponential(2)})`); return ok; }
  summary() {
    console.log('\n====================================================');
    console.log(`[${this.name}] Summary: ${this.passed}/${this.total} Passed (${this.failed} Failed)`);
    console.log('====================================================');
    if (this.failed) {
      this.failures.forEach((f) => console.error(` - [${f.suite}] ${f.test}: ${f.error}`));
      process.exitCode = 1;
    }
  }
}

const t = new TestHarness('Mastery Panel & Messenger Wiring Suite');

const nearShare = (over = {}) => ({
  v: 2,
  id: 'att_m1',
  ts: NOW,
  skillId: STOP_SKILL_ID,
  itemId: 'messenger.near-share',
  correct: false,
  context: 'messenger',
  heldOut: false,
  confidence: null,
  ...over
});

await t.describe('estimate() — the messenger near-share moves the stop-skill number', async () => {
  await t.it('empty log reads 0.5 mastery at 0 confidence (unknown, never bad)', () => {
    const e = estimate([], STOP_SKILL_ID, { now: NOW });
    t.close(e.mastery - 0.5, 'cold-start mastery is exactly the 0.5 prior');
    t.assertEqual(e.confidence, 0, 'cold-start confidence is 0');
    t.assertEqual(e.n, 0, 'cold-start n is 0');
    t.assertEqual(e.trend, 'unknown', 'cold-start trend is unknown');
  });

  await t.it('one near-share miss drops mastery below the prior and raises confidence', () => {
    const e = estimate([nearShare()], STOP_SKILL_ID, { now: NOW });
    t.close(e.mastery - 1 / 3, `one miss -> mastery 1/3 (${e.mastery.toFixed(4)}), below the 0.5 prior`);
    t.assertEqual(e.n, 1, 'one attempt counted');
    t.close(e.confidence - 1 / 6, `confidence 1/6 from n=1 (${e.confidence.toFixed(4)})`);
  });

  await t.it('a near-share miss is weighted identically to any other context miss', () => {
    const arena = { ...nearShare(), context: 'arena', itemId: 'q1' };
    const messenger = nearShare();
    const eA = estimate([arena], STOP_SKILL_ID, { now: NOW });
    const eM = estimate([messenger], STOP_SKILL_ID, { now: NOW });
    t.close(eA.mastery - eM.mastery, 'context does not change mastery');
    t.assertEqual(eA.n, eM.n, 'context does not change n');
  });

  await t.it('correct stops recover mastery — the signal is not a ratchet down', () => {
    const attempts = [nearShare()];
    for (let i = 1; i <= 6; i++) {
      attempts.push({ ...nearShare(), id: `att_c${i}`, ts: NOW + i * DAY_MS, correct: true, context: 'arena', itemId: `c${i}` });
    }
    const e = estimate(attempts, STOP_SKILL_ID, { now: NOW + 6 * DAY_MS });
    t.assert(e.mastery > 0.5, `six correct stops lift mastery back above 0.5 (${e.mastery.toFixed(3)})`);
    t.assertEqual(e.n, 7, 'seven attempts counted');
  });

  await t.it('estimateAll keys every skill, including stop, off the same log', () => {
    const m = estimateAll([nearShare()], SKILLS, { now: NOW });
    t.assertEqual(m.size, SKILLS.length, `one estimate per skill (${m.size})`);
    t.close(m.get(STOP_SKILL_ID).mastery - 1 / 3, 'stop is in the map with the lowered estimate');
    t.close(m.get('skill.fallacy.relevance').mastery - 0.5, 'an untouched skill stays at the prior');
  });
});

await t.describe('masteryPanel() — the number is visible, escaped, and names the messenger', async () => {
  await t.it('renders the stop-skill hero with the lowered number and near-share count', () => {
    const estimates = estimateAll([nearShare()], SKILLS, { now: NOW });
    const html = masteryPanel(estimates, { skills: SKILLS, messengerNearShares: 1 });
    t.assert(html.includes('STOP BEFORE REACTING'), 'stop label is the hero');
    t.assert(html.includes('33%'), 'the lowered mastery (33%) is on the panel');
    t.assert(html.includes('MESSENGER NEAR-SHARES CAUGHT BY THE GATE: 1'), 'the messenger near-share count is named');
    t.assert(html.includes('CONFIDENCE 17%'), 'confidence is shown beside mastery');
    t.assert(html.includes('1 ATTEMPT'), 'n is shown beside mastery');
  });

  await t.it('renders every skill in the catalogue', () => {
    const estimates = estimateAll([], SKILLS, { now: NOW });
    const html = masteryPanel(estimates, { skills: SKILLS, messengerNearShares: 0 });
    for (const s of SKILLS) t.assert(html.includes(s.label), `${s.id} row present`);
    t.assert(html.includes('No messenger near-shares recorded yet'), 'honest zero state for the messenger count');
  });

  await t.it('escapes hostile skill text — no markup can enter the panel', () => {
    const hostile = [{ id: 'skill.x', label: '<img src=x onerror=alert(1)>', detail: '<script>' }];
    const estimates = new Map([['skill.x', { mastery: 0.5, confidence: 0, n: 0, trend: 'unknown' }]]);
    const html = masteryPanel(estimates, { skills: hostile, messengerNearShares: 0 });
    t.assert(!html.includes('<img src=x'), 'no live img tag');
    t.assert(!html.includes('<script>'), 'no live script tag');
    t.assert(html.includes('&lt;img'), 'hostile label escaped as text');
  });

  await t.it('unknown skills render the prior as muted "unknown", not as failure', () => {
    const estimates = estimateAll([], SKILLS, { now: NOW });
    const html = masteryPanel(estimates, { skills: SKILLS, messengerNearShares: 0 });
    t.assert(html.includes('50%'), 'unknown skills show the 50% prior');
    t.assert(!html.includes('declining'), 'no fabricated "declining" trend for zero-evidence skills');
    t.assert(html.includes('var(--stone-muted, #8b8f99)'), 'unknown skills use the muted colour, not a status colour');
  });
});

t.summary();
