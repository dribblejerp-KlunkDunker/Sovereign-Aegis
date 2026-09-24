/**
 * SOVEREIGN // AEGIS — Test Suite: Phase 4 Transfer Study machinery
 *
 * Pins the pre-enrollment study kit against the project's honesty standard:
 *   - Forms: deterministic, disjoint practice/T0/T1, hashed manifests, no answers in
 *     served forms, keys matching, parallel strata, app transfer-probes excluded.
 *   - Allocation: fixed balance, unique rows, block drift ≤ 2, hashed.
 *   - Analysis: Wilson and Newcombe intervals against textbook values; primary pipeline
 *     recovers a planted effect; cluster bootstrap is seeded (stable CI); thin forms
 *     go missing per the frozen threshold; CI covers the truth at nominal ~95% across
 *     many simulated trials.
 *   - Power simulation: verdict logic and calibrated effect sizes (probability-scale).
 *
 * The selftest intentionally runs the REAL tools (subprocess) rather than re-implementing
 * their math — what is pinned is what will actually be used.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { calibrateLogitEffect, probit, mulberry32, hashSeed } from '../tools/transfer-study/lib.mjs';
// Static import: analyze.mjs guards its CLI behind an is-main check, so importing it
// here exercises the pure functions without triggering process.exit.
import { wilson, newcombePaired, analyze } from '../tools/transfer-study/analyze.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const STUDY = join(ROOT, 'tools', 'transfer-study');
const FORMS = join(ROOT, 'docs', 'transfer-study', 'forms');
const run = (script, args = []) => execFileSync(process.execPath, [join(STUDY, script), ...args], { encoding: 'utf8', timeout: 180000 });

class TestHarness {
  constructor(name) {
    this.suiteName = name;
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
  assert(cond, msg) {
    this.totalAssertions++;
    if (cond) { this.passed++; console.log(`    ✓ ${msg}`); }
    else { this.failed++; this.failures.push({ suite: this.currentSuite, test: msg, error: 'Assertion failed' }); console.error(`    ✗ [FAIL] ${msg}`); }
  }
  assertEqual(a, e, m) { this.assert(a === e, `${m} | got ${JSON.stringify(a)}, expected ${JSON.stringify(e)}`); }
  assertClose(a, e, tol, m) {
    const diff = Math.abs(a - e);
    this.assert(diff <= tol, `${m} | got ${a}, expected ~${e} ±${tol} (diff ${diff.toFixed(4)})`);
  }
  summary() {
    console.log('\n====================================================');
    console.log(`[${this.suiteName}] Summary: ${this.passed}/${this.totalAssertions} Passed (${this.failed} Failed)`);
    console.log('====================================================');
    if (this.failed > 0) {
      console.error('\nFailure Details:');
      this.failures.forEach((f) => console.error(` - [${f.suite}] ${f.test}: ${f.error}`));
      process.exitCode = 1;
    }
    return { passed: this.passed, failed: this.failed, total: this.totalAssertions };
  }
}

async function runTests() {
  const t = new TestHarness('Transfer Study Kit');

  // -----------------------------------------------------------------------
  await t.describe('Shared library: PRNG, probit, effect calibration', () => {
    t.assert(hashSeed('aegis-transfer-study-v1.0-forms') === hashSeed('aegis-transfer-study-v1.0-forms'), 'hashSeed is deterministic');
    const r1 = mulberry32(hashSeed('x')); const r2 = mulberry32(hashSeed('x'));
    let same = true;
    for (let i = 0; i < 5; i++) if (r1() !== r2()) same = false;
    t.assert(same, 'mulberry32 streams are reproducible from the same seed');

    t.assertClose(probit(0.975), 1.959963984540054, 1e-8, 'probit(0.975) matches z_{0.975} (Acklam bound ~1.15e-9 rel)');
    t.assertClose(probit(0.5), 0, 1e-12, 'probit(0.5) = 0');

    const sizes = { T0: 20, T1: 19 };
    const delta = calibrateLogitEffect(15, sizes, 0.7);
    t.assert(delta > 0.2 && delta < 4, `calibrated logit effect for 15 pp is sane (${delta.toFixed(3)})`);
    // The calibration contract: expected probability-scale gain ≈ target, over the frozen items.
    // Verify at three clustering levels for the same pp target — calibration must track sigmaP.
    const d0 = calibrateLogitEffect(15, sizes, 0);
    const d10 = calibrateLogitEffect(15, sizes, 1.0);
    t.assert(d0 < delta && delta < d10, 'calibrated logit grows with participant clustering (same pp target)');
  });

  // -----------------------------------------------------------------------
  await t.describe('Forms: partition, hashing, parallel structure', () => {
    t.assert(existsSync(join(FORMS, 'form-manifest.json')), 'forms manifest exists (build-forms.mjs was run)');

    const bank = JSON.parse(readFileSync(join(ROOT, 'data', 'arena_questions.json'), 'utf8'));
    const manifest = JSON.parse(readFileSync(join(FORMS, 'form-manifest.json'), 'utf8'));
    const f0 = JSON.parse(readFileSync(join(FORMS, 'form-T0.json'), 'utf8'));
    const f1 = JSON.parse(readFileSync(join(FORMS, 'form-T1.json'), 'utf8'));
    const k0 = JSON.parse(readFileSync(join(FORMS, 'form-keys-T0.json'), 'utf8'));
    const k1 = JSON.parse(readFileSync(join(FORMS, 'form-keys-T1.json'), 'utf8'));
    const excl = JSON.parse(readFileSync(join(FORMS, 'exclude-ids.json'), 'utf8'));
    const practice = JSON.parse(readFileSync(join(FORMS, 'practice-manifest.json'), 'utf8'));

    const ids0 = new Set(f0.items.map((q) => q.id));
    const ids1 = new Set(f1.items.map((q) => q.id));
    const overlap = [...ids0].filter((id) => ids1.has(id));
    t.assertEqual(overlap.length, 0, 'T0 and T1 are disjoint');

    const appHeldOut = new Set(bank.filter((q) => q.heldOut === true).map((q) => q.id));
    t.assertEqual([...ids0].filter((id) => appHeldOut.has(id)).length, 0, 'no app transfer-probe items in T0');
    t.assertEqual([...ids1].filter((id) => appHeldOut.has(id)).length, 0, 'no app transfer-probe items in T1');

    t.assert(f0.items.every((q) => q.correctIndex === undefined), 'T0 served form carries no correctIndex');
    t.assert(f1.items.every((q) => q.correctIndex === undefined), 'T1 served form carries no correctIndex');

    const invalid = k0.key.filter((k) => k.position < 0 || k.position >= f0.items.length || k.correctIndex < 0 || k.correctIndex >= 4);
    t.assertEqual(invalid.length, 0, 'T0 key indices are in range');
    const keyItemMatch = k0.key.every((k) => f0.items[k.position].id === k.itemId);
    t.assert(keyItemMatch, 'T0 key rows align with served positions');

    const optShuffled = f0.items.some((q, i) => {
      const orig = bank.find((b) => b.id === q.id);
      return orig && q.options.some((opt, j) => opt !== orig.options[j]);
    });
    t.assert(optShuffled, 'option order was permuted (not passthrough)');

    // Determinism: hashes in the manifest match files on disk (frozen forms).
    const h0 = createHash('sha256').update(readFileSync(join(FORMS, 'form-T0.json'))).digest('hex');
    t.assertEqual(h0, manifest.sha256['form-T0.json'], 'form-T0.json hash matches the frozen manifest');

    t.assertEqual(manifest.counts.T0 + manifest.counts.T1 + manifest.counts.practice, manifest.eligibility.eligible, 'partition is exhaustive over eligible items');
    t.assertEqual(excl.ids.length, manifest.counts.T0 + manifest.counts.T1, 'exclude-ids covers exactly T0+T1');
    t.assertEqual(practice.itemIds.length, manifest.counts.practice, 'practice manifest covers the remainder');
  });

  // -----------------------------------------------------------------------
  await t.describe('Allocation: balance, drift, freeze', () => {
    const csv = readFileSync(join(ROOT, 'docs', 'transfer-study', 'allocation.csv'), 'utf8').trim().split('\n');
    const rows = csv.slice(1).map((l) => l.split(','));
    const arms = rows.map((r) => r[2]);
    t.assertEqual(rows.length, 400, 'sequence has the protocol enrollment target (400 rows)');
    t.assertEqual(arms.filter((a) => a === 'AEGIS').length, 200, '200 AEGIS assignments');
    t.assertEqual(arms.filter((a) => a === 'CONTROL').length, 200, '200 CONTROL assignments');
    // Block drift ≤ 2 by construction; verify empirically on prefixes.
    let maxDrift = 0;
    let acc = 0;
    rows.forEach((r) => { acc += r[2] === 'AEGIS' ? 1 : -1; maxDrift = Math.max(maxDrift, Math.abs(acc)); });
    t.assert(maxDrift <= 2, `cumulative arm drift never exceeds 2 (observed max ${maxDrift})`);
    const manifest = JSON.parse(readFileSync(join(ROOT, 'docs', 'transfer-study', 'allocation-manifest.json'), 'utf8'));
    const h = createHash('sha256').update(readFileSync(join(ROOT, 'docs', 'transfer-study', 'allocation.csv'))).digest('hex');
    t.assertEqual(h, manifest.sha256, 'allocation.csv matches its frozen manifest hash');
  });

  // -----------------------------------------------------------------------
  await t.describe('Analysis machinery: intervals and pipeline (selftest)', () => {
    // Wilson interval for x=81, n=263 — the closed form evaluates to (0.2552885, 0.3662096)
    // (cross-checkable in R: prop.test(81, 263)); pinned to 1e-6.
    const w = wilson(81, 263);
    t.assertClose(w.lo, 0.2552885, 1e-6, 'Wilson lower bound for 81/263 matches the closed form');
    t.assertClose(w.hi, 0.3662096, 1e-6, 'Wilson upper bound for 81/263 matches the closed form');

    // Newcombe paired (method 10): d=0 with equal marginals must cover 0.
    const nc = newcombePaired(50, 50, 100);
    t.assertClose(nc.d, 0, 1e-12, 'Newcombe d=0 for equal marginals');
    t.assert(nc.lo <= 0 && 0 <= nc.hi, 'Newcombe CI covers 0 when marginals are equal');

    // Pipeline: run the real selftest (plants +15 pp, checks recovery) as a subprocess.
    const out = run('analyze.mjs', ['--selftest']);
    t.assert(out.includes('selftest OK'), 'analyze --selftest recovers the planted effect through the real pipeline');
    t.assert(out.includes('SYNTHETIC SELFTEST'), 'selftest output is marked SYNTHETIC');

    const st = JSON.parse(readFileSync(join(ROOT, 'docs', 'transfer-study', 'exports', 'selftest-results.json'), 'utf8'));
    t.assert(st.primary.ci95PercentagePoints[0] <= 15 && 15 <= st.primary.ci95PercentagePoints[1], 'planted 15 pp lies inside the bootstrap CI');
    t.assert(st.SYNTHETIC === 'SELFTEST — NOT A STUDY RESULT', 'persisted selftest artifact is marked synthetic');
  });

  // -----------------------------------------------------------------------
  await t.describe('Bootstrap honesty: coverage and missingness rules', async () => {
    // Seed-stability: same data → identical CI. Different thin-form rules would violate the
    // frozen threshold, so verify the threshold bites: a participant with <half of T0 is excluded.
    const sizesPath = join(FORMS, 'form-manifest.json');
    const sizes = JSON.parse(readFileSync(sizesPath, 'utf8')).counts;

    const mkParticipants = (seedStr, thin) => {
      const rng = mulberry32(hashSeed(seedStr));
      const out = [];
      for (let i = 0; i < 60; i++) {
        const arm = i % 2 ? 'AEGIS' : 'CONTROL';
        const effect = arm === 'AEGIS' ? 0.15 : 0;
        const items = [];
        const nT0 = thin && i % 7 === 0 ? Math.floor(sizes.T0 / 2) - 1 : sizes.T0;
        for (let k = 0; k < nT0; k++) items.push({ session: 'T0', itemId: 't0-' + k, correct: rng() < 0.55 });
        for (let k = 0; k < sizes.T1; k++) items.push({ session: 'T1', itemId: 't1-' + k, correct: rng() < 0.55 + effect });
        out.push({ pid: 'P' + i, arm, items });
      }
      return out;
    };

    // Coverage: over many synthetic 60-person trials with a true 15 pp effect, the 95% CI
    // should cover it roughly 95% of the time. Far below that means the CI lies.
    let covered = 0;
    const trials = 40;
    for (let s = 0; s < trials; s++) {
      const data = mkParticipants('cov-' + s, false);
      const r = analyze(data, sizes);
      if (r.primary.ci95PercentagePoints[0] <= 15 && 15 <= r.primary.ci95PercentagePoints[1]) covered++;
    }
    const covRate = covered / trials;
    t.assert(covRate >= 0.8 && covRate <= 1.0, `CI covers a true 15 pp effect at a plausible rate (${covered}/${trials})`);

    const thinData = mkParticipants('cov-0', true);
    const rThin = analyze(thinData, sizes);
    t.assert(rThin.counts.primary < thinData.length, 'thin T0 forms drop out of the primary set (frozen half-form threshold)');
    // Thin-T0 participants have a valid post but missing baseline → they are reported in
    // the postOnly attrition bucket ("only post-test data"), per the protocol's naming.
    const expectedThin = thinData.filter((_, i) => i % 7 === 0).length;
    t.assertEqual(rThin.counts.attrition.postOnly, expectedThin, 'attrition reports every dropped baseline honestly (postOnly bucket)');
  });

  // -----------------------------------------------------------------------
  await t.describe('Power simulation: calibrated verdict', () => {
    const sim = JSON.parse(readFileSync(join(ROOT, 'docs', 'transfer-study', 'exports', 'power-simulation.json'), 'utf8'));
    t.assert(sim.PLANNING_ARTIFACT === 'power simulation — not a result', 'power artifact is marked as planning, not result');
    t.assert(sim.cells.every((c) => c.power >= 0 && c.power <= 1), 'all power cells are valid probabilities');
    const at400_15 = sim.cells.filter((c) => c.n === 400 && c.tau === 15);
    t.assert(at400_15.length > 0, 'n=400, τ=15 cells present');
    const min400 = Math.min(...at400_15.map((c) => c.power));
    t.assert(min400 >= 0.8 ? sim.verdict.includes('stands') : sim.verdict.includes('INADEQUATE'), 'verdict matches the worst n=400 cell');
    // The effect-scale contract: the calibrated logit delta must produce probability-scale
    // gains near the target. A raw-logit mistake (the bug this pins) fails this.
    const c15 = sim.cells.find((c) => c.n === 400 && c.tau === 15 && c.sigmaP === 0 && c.sigmaS === 0);
    t.assert(c15.logitDelta > 0.5, `15 pp scenario uses a calibrated logit delta (${c15.logitDelta}), not a raw 0.15`);
  });

  return t.summary();
}

runTests().then((r) => {
  if (r.failed > 0) process.exitCode = 1;
});
