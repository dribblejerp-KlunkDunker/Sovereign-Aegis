/**
 * SOVEREIGN // AEGIS — Test Suite: New playable drills (Fallacy Gauntlet & 60-Second Triage)
 *
 * These two games are DOM renderers built on top of pure, deterministic assemblers —
 * buildGauntlet() and buildTriagePool(). The value of testing them is that the game's
 * invariants can be checked against the real content files without a browser:
 *
 *   - every gauntlet question has >=2 options, exactly one correct index, no duplicate option
 *     text, and a skill tag to record against (so a wrong option feeds the confusion matrix and
 *     a right answer moves real mastery, not a phantom one);
 *   - the triage pool is a mixed feed of "stop" and "continue" scenarios — because scoring both
 *     directions equally is the whole point, a pool that were all-stops would quietly turn the
 *     game into a cynicism trainer.
 *
 * Both assemblers are deterministic (seeded string shuffle), so the same content yields the same
 * order — replayable, testable, and free of RNG flakiness.
 *
 * Zero external runtime dependencies (reads the data files with node:fs).
 */

import { readFileSync } from 'node:fs';
import { buildGauntlet } from '../js/modules/cognitive.js';
import { buildTriagePool } from '../js/modules/siftLabs.js';

const fallacies = JSON.parse(readFileSync(new URL('../data/fallacies.json', import.meta.url), 'utf8'));
const scenarios = JSON.parse(readFileSync(new URL('../data/sift_scenarios.json', import.meta.url), 'utf8'));

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

const harness = new TestHarness('Playable Drills Suite (Gauntlet & Triage)');

async function runTests() {
  // ============================================================ Fallacy Gauntlet
  await harness.describe('Tier 1: buildGauntlet() against data/fallacies.json', async () => {
    const eligible = fallacies.filter((f) =>
      f && f.quiz && typeof f.quiz.question === 'string' && f.quiz.question
      && Array.isArray(f.quiz.options) && f.quiz.options.length >= 2
      && Number.isInteger(f.quiz.correctIndex) && f.quiz.correctIndex >= 0
      && f.quiz.correctIndex < f.quiz.options.length
      && Array.isArray(f.teaches) && f.teaches.length > 0);

    await harness.it('every eligible fallacy becomes exactly one question', () => {
      const g = buildGauntlet(fallacies);
      harness.assert(g.length > 0, `non-empty (${g.length} questions)`);
      harness.assertEqual(g.length, eligible.length,
        `question count equals eligible fallacies (${eligible.length})`);
    });

    await harness.it('each question has >=2 options and exactly one in-range correct index', () => {
      const g = buildGauntlet(fallacies);
      let allGood = true;
      for (const q of g) {
        if (!Array.isArray(q.options) || q.options.length < 2) allGood = false;
        if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= q.options.length) allGood = false;
      }
      harness.assert(allGood, 'no question is single-option or has an out-of-range answer');
    });

    await harness.it('no question repeats option text (the confusion matrix depends on distinct options)', () => {
      const g = buildGauntlet(fallacies);
      const dupes = g.filter((q) => new Set(q.options).size !== q.options.length);
      harness.assertEqual(dupes.length, 0,
        `no duplicate options across ${g.length} questions${dupes.length ? ` — offending: ${dupes[0].fallacyId}` : ''}`);
    });

    await harness.it('every question carries at least one skill tag to record against', () => {
      const g = buildGauntlet(fallacies);
      const untagged = g.filter((q) => !Array.isArray(q.teaches) || q.teaches.length === 0
        || q.teaches.some((t) => typeof t !== 'string' || !t));
      harness.assertEqual(untagged.length, 0, 'no question is untagged');
    });

    await harness.it('shuffling preserves the correct answer, only its slot moves', () => {
      const g = buildGauntlet(fallacies);
      let allPreserved = true;
      for (const q of g) {
        const src = fallacies.find((f) => f.id === q.fallacyId);
        const correctText = src.quiz.options[src.quiz.correctIndex];
        if (q.options[q.correctIndex] !== correctText) allPreserved = false;
      }
      harness.assert(allPreserved, 'correctIndex always points at the original correct text after shuffle');
    });

    await harness.it('the same seed reproduces the same order; a different seed reshuffles', () => {
      const a = buildGauntlet(fallacies, 'fixed-seed');
      const b = buildGauntlet(fallacies, 'fixed-seed');
      const c = buildGauntlet(fallacies, 'other-seed');
      harness.assertEqual(JSON.stringify(a.map((q) => q.fallacyId)), JSON.stringify(b.map((q) => q.fallacyId)),
        'same seed → identical order');
      const sameSet = (x, y) => JSON.stringify([...x].sort()) === JSON.stringify([...y].sort());
      harness.assert(sameSet(a.map((q) => q.fallacyId), c.map((q) => q.fallacyId)),
        'both seeds cover the same question set');
      harness.assert(JSON.stringify(a.map((q) => q.fallacyId)) !== JSON.stringify(c.map((q) => q.fallacyId)),
        'different seeds actually reorder');
    });

    await harness.it('malformed input degrades to an empty list, never throws', () => {
      harness.assertEqual(buildGauntlet(null).length, 0, 'null → []');
      harness.assertEqual(buildGauntlet([]).length, 0, '[] → []');
      harness.assertEqual(buildGauntlet([{}, { quiz: { options: ['only-one'] } }]).length, 0,
        'invalid records are skipped, not guessed at');
    });
  });

  // ============================================================ 60-Second Triage
  await harness.describe('Tier 2: buildTriagePool() against data/sift_scenarios.json', async () => {
    const stopScenarios = scenarios.filter((s) => s.lab === 'stop');

    await harness.it('draws only from the Stop lab, and only from gradeable scenarios', () => {
      const pool = buildTriagePool(scenarios);
      harness.assert(pool.length > 0, `non-empty (${pool.length} claims)`);
      const bad = pool.filter((s) => s.lab !== 'stop'
        || (s.correctDecision !== 'stop' && s.correctDecision !== 'continue')
        || typeof s.claim !== 'string' || !s.claim);
      harness.assertEqual(bad.length, 0, 'every pool entry is a Stop-lab claim with a gradeable decision');
    });

    await harness.it('the feed is mixed — both directions are present, so no cynicism bonus', () => {
      const pool = buildTriagePool(scenarios);
      const stops = pool.filter((s) => s.correctDecision === 'stop').length;
      const continues = pool.filter((s) => s.correctDecision === 'continue').length;
      harness.assert(stops > 0, `${stops} claims need a stop`);
      harness.assert(continues > 0, `${continues} claims are safe to continue`);
      harness.assert(pool.length <= stopScenarios.length, 'the pool never invents scenarios beyond the data');
    });

    await harness.it('every claim carries the recording fields the spine needs', () => {
      const pool = buildTriagePool(scenarios);
      const incomplete = pool.filter((s) =>
        !Array.isArray(s.tests) || s.tests.length === 0
        || typeof s.explanation !== 'string' || !s.explanation);
      harness.assertEqual(incomplete.length, 0,
        `every claim has tests[] and an explanation (${pool.length} checked)`);
    });

    await harness.it('is deterministic per seed', () => {
      const a = buildTriagePool(scenarios, 'run');
      const b = buildTriagePool(scenarios, 'run');
      const c = buildTriagePool(scenarios, 'run-again');
      harness.assertEqual(JSON.stringify(a.map((s) => s.id)), JSON.stringify(b.map((s) => s.id)),
        'same seed → identical order');
      harness.assert(JSON.stringify(a.map((s) => s.id)) !== JSON.stringify(c.map((s) => s.id)),
        'different seed → reshuffled');
    });

    await harness.it('a deterministic seed keeps every stop scenario in play', () => {
      const pool = buildTriagePool(scenarios);
      const ids = pool.map((s) => s.id).sort();
      harness.assertEqual(JSON.stringify(ids), JSON.stringify(stopScenarios.map((s) => s.id).sort()),
        'the pool is a permutation of the full Stop-lab set');
    });

    await harness.it('empty or foreign input degrades gracefully', () => {
      harness.assertEqual(buildTriagePool(null).length, 0, 'null → []');
      harness.assertEqual(buildTriagePool([]).length, 0, '[] → []');
      const onlyForeign = scenarios.filter((s) => s.lab !== 'stop');
      harness.assertEqual(buildTriagePool(onlyForeign).length, 0, 'non-stop scenarios → []');
    });
  });

  return harness.summary();
}

runTests().then((r) => { if (r.failed > 0) process.exitCode = 1; });
