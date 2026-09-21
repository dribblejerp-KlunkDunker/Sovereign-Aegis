/**
 * SOVEREIGN // AEGIS — Test Suite: Competency estimation (js/competency.js)
 *
 * THE TEST THAT MATTERS
 * ---------------------
 * "Simulated learner of known ability converges" — a synthetic learner answers correctly
 * with a fixed probability p, and the estimator must recover p. Without that, a learning
 * model is only plausible; with it, it is measured. Every other assertion here defends a
 * specific behaviour the UI depends on: cold start reading "unknown" rather than "bad",
 * held-out items staying out of mastery, and the transfer report refusing to report when
 * it lacks data.
 *
 * Deterministic throughout — a seeded PRNG, and timestamps passed explicitly. A flaky
 * learning test is worse than none, because it teaches you to ignore it.
 *
 * Zero external runtime dependencies.
 */

import {
  estimate, estimateAll, rank, transfer, gates, calibration, miscalibrated, confusionMatrix,
  DECAY, CONFIDENCE_K, CONFIDENCE_LEVELS, MISCALIBRATION_BOOST
} from '../js/competency.js';
import { normaliseAttempt, normaliseConfidence, SCHEMA_VERSION, CONFIDENCE_VALUES } from '../js/attemptlog.js';

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
  assertClose(a, e, tol, m) { this.assert(Math.abs(a - e) <= tol, `${m} | got ${Number(a).toFixed(4)}, expected ${e} ±${tol}`); }
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

/* ---------------------------------------------------------- deterministic helpers */

function makeRng(seed) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

const T0 = 1786000000000; // fixed epoch; never Date.now()

/** A learner who answers correctly with probability p. */
function simulate({ p, n, skillId = 'skill.test', seed = 42, startTs = T0, spacingMs = 60000, heldOut = false, tag = 'sim' }) {
  const rng = makeRng(seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      v: SCHEMA_VERSION,
      id: `att_${tag}_${skillId}_${i}`,
      ts: startTs + i * spacingMs,
      skillId,
      itemId: `item-${i % 12}`,
      correct: rng() < p,
      latencyMs: 3000,
      context: 'test',
      heldOut
    });
  }
  return out;
}

const harness = new TestHarness('Competency Estimation Suite');

async function runTests() {
  // ============================================================ THE decisive test
  await harness.describe('Tier 1: Convergence on a simulated learner of known ability', async () => {
    // All attempts land inside one day, so decay is negligible and the estimate should
    // recover the underlying probability.
    const NOW = T0 + 60 * 60 * 1000;

    for (const p of [0.3, 0.5, 0.8]) {
      await harness.it(`p=${p} learner converges to mastery approximately ${p} within 40 attempts`, () => {
        const attempts = simulate({ p, n: 40, seed: 7 + Math.round(p * 100) });
        const e = estimate(attempts, 'skill.test', { now: NOW });
        harness.assertEqual(e.n, 40, 'all 40 attempts counted');
        harness.assertClose(e.mastery, p, 0.12, `mastery recovers p=${p}`);
        harness.assert(e.confidence > 0.85, `confidence is high after 40 attempts (${e.confidence.toFixed(3)})`);
      });
    }

    await harness.it('More evidence does not move the estimate away from the truth', () => {
      const short = estimate(simulate({ p: 0.7, n: 10, seed: 3 }), 'skill.test', { now: NOW });
      const long = estimate(simulate({ p: 0.7, n: 200, seed: 3, spacingMs: 1000 }), 'skill.test', { now: NOW });
      harness.assert(Math.abs(long.mastery - 0.7) <= Math.abs(short.mastery - 0.7) + 0.08,
        `200 attempts is at least as accurate as 10 (${long.mastery.toFixed(3)} vs ${short.mastery.toFixed(3)})`);
      harness.assert(long.confidence > short.confidence,
        `confidence grows with n (${long.confidence.toFixed(3)} > ${short.confidence.toFixed(3)})`);
    });

    await harness.it('A perfect and a hopeless learner are separated decisively', () => {
      const perfect = estimate(simulate({ p: 1.0, n: 30, seed: 11 }), 'skill.test', { now: NOW });
      const hopeless = estimate(simulate({ p: 0.0, n: 30, seed: 11 }), 'skill.test', { now: NOW });
      harness.assert(perfect.mastery > 0.9, `all-correct reads high (${perfect.mastery.toFixed(3)})`);
      harness.assert(hopeless.mastery < 0.1, `all-wrong reads low (${hopeless.mastery.toFixed(3)})`);
    });
  });

  // ============================================================ cold start
  await harness.describe('Tier 2: Cold start reads "unknown", never "bad"', async () => {
    await harness.it('Zero attempts gives mastery 0.5 at confidence 0', () => {
      const e = estimate([], 'skill.never-tried', { now: T0 });
      harness.assertEqual(e.mastery, 0.5, 'mastery is the neutral prior');
      harness.assertEqual(e.confidence, 0, 'confidence is zero');
      harness.assertEqual(e.n, 0, 'n is zero');
      harness.assertEqual(e.lastSeen, null, 'lastSeen is null');
      harness.assertEqual(e.trend, 'unknown', 'trend is unknown, not flat');
    });

    await harness.it('One correct answer does not claim mastery', () => {
      const e = estimate(simulate({ p: 1, n: 1 }), 'skill.test', { now: T0 + 1000 });
      harness.assert(e.mastery < 0.8, `a single success stays modest (${e.mastery.toFixed(3)})`);
      harness.assert(e.confidence < 0.25, `confidence stays low (${e.confidence.toFixed(3)})`);
    });

    await harness.it('Attempts for other skills do not leak in', () => {
      const mixed = [
        ...simulate({ p: 1, n: 20, skillId: 'skill.a', tag: 'a' }),
        ...simulate({ p: 0, n: 20, skillId: 'skill.b', tag: 'b' })
      ];
      const a = estimate(mixed, 'skill.a', { now: T0 + 3600000 });
      const b = estimate(mixed, 'skill.b', { now: T0 + 3600000 });
      harness.assert(a.mastery > 0.9, `skill.a high (${a.mastery.toFixed(3)})`);
      harness.assert(b.mastery < 0.1, `skill.b low (${b.mastery.toFixed(3)})`);
      harness.assertEqual(a.n, 20, 'skill.a counted only its own attempts');
    });
  });

  // ============================================================ decay and trend
  await harness.describe('Tier 3: Recency weighting and trend', async () => {
    await harness.it('Stale competence decays toward unknown', () => {
      const old = simulate({ p: 1, n: 20, startTs: T0, spacingMs: 60000 });
      const fresh = estimate(old, 'skill.test', { now: T0 + 3600000 });
      const stale = estimate(old, 'skill.test', { now: T0 + 400 * 86400000 });
      harness.assert(fresh.mastery > 0.9, `fresh evidence reads high (${fresh.mastery.toFixed(3)})`);
      harness.assert(stale.mastery < fresh.mastery - 0.2,
        `year-old evidence decays (${stale.mastery.toFixed(3)} vs ${fresh.mastery.toFixed(3)})`);
      harness.assert(stale.mastery > 0.3 && stale.mastery < 0.8,
        `decays toward the neutral prior, not to zero (${stale.mastery.toFixed(3)})`);
    });

    await harness.it('Recent evidence outweighs old evidence of the same size', () => {
      const attempts = [
        ...simulate({ p: 0, n: 15, startTs: T0, spacingMs: 60000, tag: 'oldfail' }),
        ...simulate({ p: 1, n: 15, startTs: T0 + 300 * 86400000, spacingMs: 60000, seed: 99, tag: 'newpass' })
      ];
      const e = estimate(attempts, 'skill.test', { now: T0 + 300 * 86400000 + 3600000 });
      harness.assert(e.mastery > 0.6, `recent success dominates (${e.mastery.toFixed(3)})`);
    });

    await harness.it('Improvement is detected as a trend', () => {
      const attempts = [
        ...simulate({ p: 0.05, n: 12, startTs: T0, spacingMs: 60000, seed: 5, tag: 'early' }),
        ...simulate({ p: 0.98, n: 12, startTs: T0 + 12 * 60000, spacingMs: 60000, seed: 6, tag: 'late' })
      ];
      const e = estimate(attempts, 'skill.test', { now: T0 + 30 * 60000 });
      harness.assertEqual(e.trend, 'improving', 'trend reports improving');
    });

    await harness.it('Trend stays unknown below the evidence threshold', () => {
      const e = estimate(simulate({ p: 0.5, n: 4 }), 'skill.test', { now: T0 + 60000 });
      harness.assertEqual(e.trend, 'unknown', 'fewer than 6 attempts gives no trend claim');
    });
  });

  // ============================================================ held-out isolation
  await harness.describe('Tier 4: Held-out items stay out of mastery', async () => {
    await harness.it('Held-out attempts are excluded from the mastery estimate', () => {
      const practice = simulate({ p: 1, n: 10, seed: 1, tag: 'p' });
      const held = simulate({ p: 0, n: 10, seed: 2, heldOut: true, tag: 'h' });
      const e = estimate([...practice, ...held], 'skill.test', { now: T0 + 3600000 });
      harness.assertEqual(e.n, 10, 'only the 10 practice attempts counted');
      harness.assert(e.mastery > 0.9, `held-out failures do not drag mastery down (${e.mastery.toFixed(3)})`);
    });

    await harness.it('includeHeldOut lets the caller opt in explicitly', () => {
      const practice = simulate({ p: 1, n: 10, seed: 1, tag: 'p2' });
      const held = simulate({ p: 0, n: 10, seed: 2, heldOut: true, tag: 'h2' });
      const e = estimate([...practice, ...held], 'skill.test', { now: T0 + 3600000, includeHeldOut: true });
      harness.assertEqual(e.n, 20, 'both sets counted when requested');
      harness.assert(e.mastery < 0.7, `mixed record lands lower (${e.mastery.toFixed(3)})`);
    });
  });

  // ============================================================ transfer report
  await harness.describe('Tier 5: Transfer report', async () => {
    await harness.it('Refuses to report without enough held-out evidence', () => {
      const t = transfer(simulate({ p: 0.5, n: 4, heldOut: true }));
      harness.assertEqual(t.available, false, 'not available');
      harness.assertEqual(t.delta, null, 'no delta invented');
      harness.assert(/not a measurement of zero/i.test(t.caveat),
        'says absence of measurement is not a measurement of zero');
    });

    await harness.it('Detects real improvement on unpracticed items', () => {
      const attempts = [
        ...simulate({ p: 0.15, n: 10, startTs: T0, heldOut: true, seed: 21, tag: 'base' }),
        ...simulate({ p: 0.95, n: 10, startTs: T0 + 40 * 86400000, heldOut: true, seed: 22, tag: 'now' })
      ];
      const t = transfer(attempts);
      harness.assertEqual(t.available, true, 'report available');
      harness.assert(t.current.accuracy > t.baseline.accuracy,
        `current beats baseline (${t.current.accuracy.toFixed(2)} > ${t.baseline.accuracy.toFixed(2)})`);
      harness.assert(t.delta > 0.3, `delta is substantial (${t.delta.toFixed(2)})`);
      harness.assert(Array.isArray(t.ci95) && t.ci95[0] < t.delta && t.ci95[1] > t.delta,
        `confidence interval brackets the estimate [${t.ci95[0].toFixed(2)}, ${t.ci95[1].toFixed(2)}]`);
    });

    await harness.it('Reports no improvement honestly when there is none', () => {
      const attempts = simulate({ p: 0.5, n: 40, heldOut: true, seed: 31, spacingMs: 86400000 });
      const t = transfer(attempts);
      harness.assertEqual(t.available, true, 'report available');
      harness.assert(Math.abs(t.delta) < 0.4, `delta is near zero (${t.delta.toFixed(2)})`);
      harness.assert(t.ci95[0] < 0 && t.ci95[1] > 0,
        'confidence interval includes zero — no claim of improvement');
    });

    await harness.it('The caveat travels with the numbers as data', () => {
      const t = transfer(simulate({ p: 0.6, n: 20, heldOut: true, seed: 41 }));
      harness.assert(/no control group/i.test(t.caveat), 'caveat names the absence of a control group');
      harness.assert(/within-subject/i.test(t.caveat), 'caveat names the study design');
    });
  });

  // ============================================================ ranking
  await harness.describe('Tier 6: Practice ranking by expected learning gain', async () => {
    const items = [
      { id: 'i-mastered', skillIds: ['skill.mastered'] },
      { id: 'i-midzone', skillIds: ['skill.midzone'] },
      { id: 'i-untried', skillIds: ['skill.untried'] }
    ];
    const NOW = T0 + 30 * 86400000;

    await harness.it('Never-attempted skills surface rather than staying invisible', () => {
      const attempts = [
        ...simulate({ p: 1.0, n: 30, skillId: 'skill.mastered', startTs: T0, seed: 51, tag: 'm' }),
        ...simulate({ p: 0.7, n: 8, skillId: 'skill.midzone', startTs: T0, seed: 52, tag: 'z' })
      ];
      const mm = estimateAll(attempts, [
        { id: 'skill.mastered' }, { id: 'skill.midzone' }, { id: 'skill.untried' }
      ], { now: NOW });
      const ranked = rank(items, mm, { now: NOW });
      const ids = ranked.map((r) => r.item.id);
      harness.assert(ids.includes('i-untried'), 'the untried item appears in the queue');
      harness.assert(ids.indexOf('i-untried') < ids.indexOf('i-mastered'),
        `untried outranks mastered (${ids.join(' > ')})`);
    });

    await harness.it('Items with no skill tags are skipped, not guessed at', () => {
      const mm = estimateAll([], [{ id: 'skill.x' }], { now: NOW });
      const ranked = rank([{ id: 'untagged' }, { id: 'tagged', skillIds: ['skill.x'] }], mm, { now: NOW });
      harness.assertEqual(ranked.length, 1, 'only the tagged item is ranked');
      harness.assertEqual(ranked[0].item.id, 'tagged', 'and it is the tagged one');
    });

    await harness.it('An item testing several skills is scored by its weakest', () => {
      const attempts = [
        ...simulate({ p: 1.0, n: 20, skillId: 'skill.strong', startTs: T0, seed: 61, tag: 's' }),
        ...simulate({ p: 0.65, n: 6, skillId: 'skill.weak', startTs: T0, seed: 62, tag: 'w' })
      ];
      const mm = estimateAll(attempts, [{ id: 'skill.strong' }, { id: 'skill.weak' }], { now: NOW });
      const ranked = rank([{ id: 'multi', skillIds: ['skill.strong', 'skill.weak'] }], mm, { now: NOW });
      harness.assertEqual(ranked[0].skillId, 'skill.weak', 'scored via the weaker skill');
    });

    await harness.it('The limit is respected', () => {
      const many = Array.from({ length: 50 }, (_, i) => ({ id: `x${i}`, skillIds: ['skill.x'] }));
      const mm = estimateAll([], [{ id: 'skill.x' }], { now: NOW });
      harness.assertEqual(rank(many, mm, { now: NOW, limit: 7 }).length, 7, 'returns exactly 7');
    });
  });

  // ============================================================ gates
  await harness.describe('Tier 7: Prerequisite gates', async () => {
    const skills = [
      { id: 'skill.base', prerequisites: [] },
      { id: 'skill.next', prerequisites: ['skill.base'] }
    ];
    const NOW = T0 + 3600000;

    await harness.it('A skill with unmet prerequisites is locked and says why', () => {
      const mm = estimateAll([], skills, { now: NOW });
      const g = gates(skills, mm);
      harness.assertEqual(g.get('skill.base').unlocked, true, 'base has no prerequisites');
      harness.assertEqual(g.get('skill.next').unlocked, false, 'next is locked');
      harness.assert(g.get('skill.next').blockedBy.includes('skill.base'), 'names the blocking skill');
    });

    await harness.it('Demonstrated mastery unlocks the dependent skill', () => {
      const attempts = simulate({ p: 0.95, n: 20, skillId: 'skill.base', startTs: T0, seed: 71, tag: 'g' });
      const mm = estimateAll(attempts, skills, { now: NOW });
      const g = gates(skills, mm);
      harness.assertEqual(g.get('skill.next').unlocked, true, 'next unlocks');
      harness.assertEqual(g.get('skill.next').blockedBy.length, 0, 'nothing blocking');
    });

    await harness.it('High mastery on thin evidence does not unlock', () => {
      const attempts = simulate({ p: 1, n: 2, skillId: 'skill.base', startTs: T0, seed: 81, tag: 'thin' });
      const mm = estimateAll(attempts, skills, { now: NOW });
      const g = gates(skills, mm);
      harness.assertEqual(g.get('skill.next').unlocked, false,
        'confidence floor prevents unlocking on two lucky answers');
    });
  });

  // ============================================================ record validation
  await harness.describe('Tier 8: Attempt record validation', async () => {
    await harness.it('Well-formed attempts are accepted and stamped', () => {
      const n = normaliseAttempt({ skillId: 's', itemId: 'i', correct: true, ts: T0 });
      harness.assertEqual(n.ok, true, 'accepted');
      harness.assertEqual(n.record.v, SCHEMA_VERSION, 'schema version stamped');
      harness.assert(n.record.id.startsWith('att_'), 'id generated');
      harness.assertEqual(n.record.heldOut, false, 'heldOut defaults to false');
      harness.assertEqual(n.record.context, 'unknown', 'context defaults rather than being dropped');
    });

    await harness.it('Malformed attempts are rejected with a reason', () => {
      const cases = [
        [{}, 'skillId'],
        [{ skillId: 's' }, 'itemId'],
        [{ skillId: 's', itemId: 'i' }, 'correct'],
        [{ skillId: 's', itemId: 'i', correct: 'yes' }, 'correct'],
        [null, 'object']
      ];
      for (const [input, expect] of cases) {
        const n = normaliseAttempt(input);
        harness.assert(n.ok === false && n.reason.includes(expect),
          `rejects ${JSON.stringify(input)} citing ${expect}`);
      }
    });

    await harness.it('Ids sort chronologically, so a time range is a key range', () => {
      const a = normaliseAttempt({ skillId: 's', itemId: 'i', correct: true, ts: T0 }).record;
      const b = normaliseAttempt({ skillId: 's', itemId: 'i', correct: true, ts: T0 + 100000 }).record;
      harness.assert(a.id < b.id, `earlier id sorts first (${a.id} < ${b.id})`);
    });
  });

  // ====================================================== confidence must not leak into mastery
  await harness.describe('Tier 10: Confidence is quarantined from mastery', async () => {
    // This is the load-bearing test for the whole confidence feature. Mastery means "probability
    // this person answers correctly". If a self-reported tap can move it, the number stops being
    // interpretable AND becomes gameable — claim ignorance on everything and watch it rise. So the
    // same answer sequence must produce the SAME mastery regardless of what was claimed.
    const base = simulate({ p: 0.65, n: 30, skillId: 'skill.q', seed: 7 });
    const now = T0 + 30 * 60000;
    const withConf = (level) => base.map((a) => ({ ...a, v: 2, confidence: level }));

    await harness.it('mastery is identical whatever confidence was claimed', () => {
      const bare = estimate(base, 'skill.q', { now });
      const allSure = estimate(withConf('sure'), 'skill.q', { now });
      const allGuess = estimate(withConf('guess'), 'skill.q', { now });
      harness.assertEqual(allSure.mastery, bare.mastery, 'claiming "sure" throughout changes nothing');
      harness.assertEqual(allGuess.mastery, bare.mastery, 'claiming "guessing" throughout changes nothing');
      harness.assertEqual(allGuess.confidence, bare.confidence,
        'estimate().confidence is still evidence-quantity, not stated certainty');
      harness.assert(allGuess.mastery > 0.5, `and it is still a real estimate (${allGuess.mastery.toFixed(3)})`);
    });

    await harness.it('the two "confidence" concepts are not confusable', () => {
      // estimate().confidence = how much evidence there is. attempt.confidence = what the operator
      // claimed. Same word, different things — worth an assertion so a future refactor cannot
      // quietly join them.
      const e = estimate(withConf('sure'), 'skill.q', { now });
      harness.assertClose(e.confidence, 30 / (30 + CONFIDENCE_K), 0.0001,
        'estimate().confidence is n/(n+k) and nothing else');
    });
  });

  // ============================================================ calibration
  await harness.describe('Tier 11: Calibration recovers a known miscalibration', async () => {
    await harness.it('refuses to report on zero confidence-rated answers', () => {
      const c = calibration(simulate({ p: 0.7, n: 20 }));  // v1-style, no confidence
      harness.assertEqual(c.available, false, 'unavailable rather than a fabricated zero');
      harness.assertEqual(c.n, 0, 'no rated answers counted');
      harness.assertEqual(c.brier, null, 'Brier is null, not 0');
      harness.assert(c.caveat.length > 40, 'caveat travels with the result');
    });

    await harness.it('v1 records are excluded, not assumed to be 50%', () => {
      const mixed = [
        ...simulate({ p: 0.5, n: 20, seed: 3 }),                                    // v1, unrated
        ...simulate({ p: 0.9, n: 10, seed: 4 }).map((a) => ({ ...a, v: 2, confidence: 'sure' }))
      ];
      const c = calibration(mixed);
      harness.assertEqual(c.n, 10, 'only the 10 rated answers are scored');
    });

    await harness.it('detects an overconfident learner', () => {
      // Claims "sure" (0.9) on everything but is only right 50% of the time.
      const over = simulate({ p: 0.5, n: 40, seed: 11 }).map((a) => ({ ...a, v: 2, confidence: 'sure' }));
      const c = calibration(over);
      harness.assert(c.available, 'report is available');
      harness.assert(c.overconfidence > 0.25,
        `overconfidence is large and positive (${c.overconfidence.toFixed(3)})`);
      const sure = c.bins.find((b) => b.level === 'sure');
      harness.assert(sure.gap > 0.25, `the "sure" bin's gap exposes it (${sure.gap.toFixed(3)})`);
      harness.assert(/right \d+% of the time/.test(c.headline), `headline states the number: "${c.headline}"`);
      // A Brier score of 0.25 is what claiming 50% on everything gets you. Claiming 90% while
      // being right 50% of the time must score WORSE than that, or the metric is not working.
      harness.assert(c.brier > 0.25, `Brier is worse than the no-information baseline (${c.brier.toFixed(3)})`);
    });

    await harness.it('detects an underconfident learner', () => {
      const under = simulate({ p: 0.95, n: 40, seed: 12 }).map((a) => ({ ...a, v: 2, confidence: 'guess' }));
      const c = calibration(under);
      harness.assert(c.overconfidence < -0.4,
        `underconfidence reads negative (${c.overconfidence.toFixed(3)})`);
    });

    await harness.it('scores a well-calibrated learner best of the three', () => {
      // Right ~90% when claiming sure, ~60% when unsure, ~25% when guessing.
      const good = [
        ...simulate({ p: 0.9, n: 30, seed: 21 }).map((a) => ({ ...a, v: 2, confidence: 'sure' })),
        ...simulate({ p: 0.6, n: 30, seed: 22 }).map((a) => ({ ...a, v: 2, confidence: 'unsure', id: a.id + 'b' })),
        ...simulate({ p: 0.25, n: 30, seed: 23 }).map((a) => ({ ...a, v: 2, confidence: 'guess', id: a.id + 'c' }))
      ];
      const wellCalibrated = calibration(good);
      const overconfident = calibration(
        simulate({ p: 0.5, n: 90, seed: 24 }).map((a) => ({ ...a, v: 2, confidence: 'sure' }))
      );
      harness.assert(wellCalibrated.brier < overconfident.brier,
        `calibrated Brier ${wellCalibrated.brier.toFixed(3)} beats overconfident ${overconfident.brier.toFixed(3)}`);
      harness.assert(Math.abs(wellCalibrated.overconfidence) < 0.12,
        `calibrated learner reads as roughly honest (${wellCalibrated.overconfidence.toFixed(3)})`);
      harness.assert(wellCalibrated.bins.every((b) => b.n === 30), 'all three bins populated');
      harness.assert(wellCalibrated.bins.every((b) => b.reliable), 'all three bins above the thin-data threshold');
    });

    await harness.it('flags thin bins rather than hiding them', () => {
      const thin = simulate({ p: 0.5, n: 2, seed: 31 }).map((a) => ({ ...a, v: 2, confidence: 'sure' }));
      const c = calibration(thin);
      const sure = c.bins.find((b) => b.level === 'sure');
      harness.assertEqual(sure.reliable, false, 'a 2-answer bin is marked unreliable');
      harness.assertEqual(sure.n, 2, 'but its count is still reported, not suppressed');
      harness.assert(/Not enough/.test(c.headline), 'headline declines to make a claim');
    });

    await harness.it('nominal probabilities are exported for later fitting', () => {
      harness.assertEqual(Object.keys(CONFIDENCE_LEVELS).length, 3, 'three levels');
      harness.assertEqual(JSON.stringify(Object.keys(CONFIDENCE_LEVELS)), JSON.stringify(CONFIDENCE_VALUES),
        'the estimator and the log agree on the vocabulary');
      harness.assert(CONFIDENCE_LEVELS.sure > CONFIDENCE_LEVELS.unsure, 'sure claims more than unsure');
      harness.assert(CONFIDENCE_LEVELS.unsure > CONFIDENCE_LEVELS.guess, 'unsure claims more than guessing');
    });
  });

  // ============================================================ miscalibration drives practice
  await harness.describe('Tier 12: Confidently-wrong items are surfaced first', async () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ id: `item-${i}`, skillIds: ['skill.q'] }));

    await harness.it('a confidently-wrong item outranks its identical peers', () => {
      const attempts = simulate({ p: 0.7, n: 24, skillId: 'skill.q', seed: 5 })
        .map((a) => ({ ...a, v: 2, confidence: 'unsure' }));
      // One item was answered wrongly while claiming certainty.
      attempts.push({
        v: 2, id: 'att_bad', ts: T0 + 25 * 60000, skillId: 'skill.q', itemId: 'item-3',
        correct: false, latencyMs: 1200, context: 'test', heldOut: false, confidence: 'sure'
      });
      const map = estimateAll(attempts, [{ id: 'skill.q' }], { now: T0 + 26 * 60000 });

      const plain = rank(items, map, { now: T0 + 26 * 60000 });
      const aware = rank(items, map, { now: T0 + 26 * 60000, attempts });

      harness.assert(!plain[0].miscalibrated, 'without attempts, ranking is unchanged from before');
      harness.assertEqual(aware[0].item.id, 'item-3', 'with attempts, the confidently-wrong item is first');
      harness.assertEqual(aware[0].miscalibrated, true, 'and it is flagged as such for the UI');
      harness.assertClose(aware[0].gain / plain.find((r) => r.item.id === 'item-3').gain,
        MISCALIBRATION_BOOST, 0.0001, 'boosted by exactly MISCALIBRATION_BOOST');
      harness.assertEqual(aware.filter((r) => r.miscalibrated).length, 1, 'only that item is boosted');
    });

    await harness.it('the boost follows the item, not the whole skill', () => {
      // Being certain and wrong about one question says nothing about the others testing the same
      // skill. If the boost smeared across the skill, every item would tie and the signal would be
      // lost in exactly the case it matters.
      const attempts = [{
        v: 2, id: 'att_x', ts: T0, skillId: 'skill.q', itemId: 'item-0',
        correct: false, latencyMs: 900, context: 'test', heldOut: false, confidence: 'sure'
      }];
      const map = estimateAll(attempts, [{ id: 'skill.q' }], { now: T0 + 86400000 });
      const out = rank(items, map, { now: T0 + 86400000, attempts });
      harness.assertEqual(out.filter((r) => r.miscalibrated).length, 1, 'one item boosted, not six');
      harness.assertEqual(out[0].item.id, 'item-0', 'and it is the right one');
    });

    await harness.it('a merely-wrong answer gets no boost', () => {
      const attempts = [{
        v: 2, id: 'att_y', ts: T0, skillId: 'skill.q', itemId: 'item-0',
        correct: false, latencyMs: 900, context: 'test', heldOut: false, confidence: 'guess'
      }];
      const map = estimateAll(attempts, [{ id: 'skill.q' }], { now: T0 + 86400000 });
      const out = rank(items, map, { now: T0 + 86400000, attempts });
      harness.assertEqual(out.filter((r) => r.miscalibrated).length, 0,
        'wrong-while-guessing is a known gap, not a false belief');
    });

    await harness.it('miscalibrated() lists them most recent first', () => {
      const mk = (itemId, ts, correct, confidence) => ({
        v: 2, id: `att_${itemId}_${ts}`, ts, skillId: 'skill.q', itemId,
        correct, latencyMs: 900, context: 'test', heldOut: false, confidence
      });
      const rows = miscalibrated([
        mk('a', T0, false, 'sure'),
        mk('b', T0 + 1000, false, 'guess'),
        mk('c', T0 + 2000, true, 'sure'),
        mk('d', T0 + 3000, false, 'sure')
      ]);
      harness.assertEqual(rows.length, 2, 'only confident-and-wrong qualify');
      harness.assertEqual(rows[0].itemId, 'd', 'most recent first');
      harness.assertEqual(rows[1].itemId, 'a', 'then the older one');
    });
  });

  // ============================================================ schema v2 vocabulary
  await harness.describe('Tier 13: Schema v2 vocabulary is closed', async () => {
    await harness.it('only the three levels are accepted', () => {
      for (const v of CONFIDENCE_VALUES) {
        harness.assertEqual(normaliseConfidence(v), v, `"${v}" accepted`);
      }
      for (const bad of ['certain', 'SURE', '', null, undefined, 0.9, true, {}]) {
        harness.assertEqual(normaliseConfidence(bad), null, `${JSON.stringify(bad)} → null (not stated)`);
      }
    });

    await harness.it('a v1 record keeps its version instead of being restamped', () => {
      // Restamping would claim a confidence measurement was taken when it was not — the one lie
      // this schema must not tell, because calibration() trusts `confidence` to mean something.
      const v1 = normaliseAttempt({ v: 1, skillId: 's', itemId: 'i', correct: true }).record;
      harness.assertEqual(v1.v, 1, 'imported v1 record stays v1');
      harness.assertEqual(v1.confidence, null, 'and reads as not-stated');
      const fresh = normaliseAttempt({ skillId: 's', itemId: 'i', correct: true, confidence: 'sure' }).record;
      harness.assertEqual(fresh.v, SCHEMA_VERSION, 'a new record is stamped v2');
      harness.assertEqual(fresh.confidence, 'sure', 'and carries what was claimed');
    });

    await harness.it('an unrecognised confidence is stored as null, not rejected', () => {
      // Dropping the record would lose a real answer over a UI bug. Storing the answer with an
      // honest null loses only the calibration datum.
      const r = normaliseAttempt({ skillId: 's', itemId: 'i', correct: true, confidence: 'very sure' });
      harness.assert(r.ok, 'the attempt is still recorded');
      harness.assertEqual(r.record.confidence, null, 'with confidence null');
    });
  });

  // ============================================================ confusion matrix
  await harness.describe('Tier 10: confusionMatrix() — chosen options, not just scores', async () => {
    await harness.it('groups wrong choices into a confusion matrix, with correct labels when supplied', () => {
      const attempts = [
        { skillId: 'skill.fallacy.relevance', chosen: 'Ad Hominem', correct: false, itemId: 'q1' },
        { skillId: 'skill.fallacy.relevance', chosen: 'Ad Hominem', correct: false, itemId: 'q2' },
        { skillId: 'skill.fallacy.relevance', chosen: 'Straw Man', correct: false, itemId: 'q3' },
        { skillId: 'skill.fallacy.relevance', chosen: 'Straw Man', correct: true, itemId: 'q4' },
        { skillId: 'skill.fallacy.relevance', correct: false, itemId: 'q5' } // graded — no chosen option
      ];
      const correctLabel = (a) => (a.itemId === 'q1' || a.itemId === 'q2') ? 'Tu Quoque' : 'Straw Man';
      const m = confusionMatrix(attempts, { correctLabel });
      harness.assertEqual(m.n, 4, 'only attempts with a chosen option are counted');
      const top = m.byChoice[0];
      harness.assertEqual(top.chosen, 'Ad Hominem', 'the most-wrong choice sorts first');
      harness.assertEqual(top.wrong, 2, 'its two misses are aggregated');
      harness.assertEqual(top.correctLabel, 'Tu Quoque', 'the correct label is attached when supplied');
    });

    await harness.it('degrades honestly without a correct-label resolver', () => {
      const m = confusionMatrix([{ skillId: 's', chosen: 'X', correct: false }]);
      harness.assertEqual(m.n, 1, 'one chosen attempt');
      harness.assertEqual(m.byChoice[0].correctLabel, null, 'no fabricated correct label');
      harness.assertEqual(m.byChoice[0].wrong, 1, 'wrong count correct');
    });

    await harness.it('ignores non-string and empty chosen values', () => {
      const m = confusionMatrix([
        { skillId: 's', chosen: '', correct: false },
        { skillId: 's', chosen: 7, correct: false },
        { skillId: 's', correct: false }
      ]);
      harness.assertEqual(m.n, 0, 'nothing counted without a real chosen string');
      harness.assertEqual(m.byChoice.length, 0, 'and no rows');
    });
  });

  // ============================================================ constants documented
  await harness.describe('Tier 9: Tunable constants are exported for later fitting', async () => {
    await harness.it('DECAY and CONFIDENCE_K are exposed with a documented half-life', () => {
      harness.assert(DECAY > 0 && DECAY < 1, `DECAY is a sane daily weight (${DECAY})`);
      harness.assert(CONFIDENCE_K > 0, `CONFIDENCE_K is positive (${CONFIDENCE_K})`);
      const halfLife = Math.log(0.5) / Math.log(DECAY);
      harness.assert(halfLife > 10 && halfLife < 40,
        `evidence half-life is ${halfLife.toFixed(1)} days — plausible for spaced practice`);
    });
  });

  return harness.summary();
}

runTests().then(r => { if (r.failed > 0) process.exitCode = 1; });
