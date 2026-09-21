/**
 * SOVEREIGN // AEGIS — Adaptive Inoculation Selector Suite (Personal Defense Profile, slice 3)
 *
 * Tests the pure engine in js/inoculation.js against fixtures with known answers:
 * 1. Candidate flattening and stage keys (malformed entries skipped, never crashed on).
 * 2. Freshness tiers from prior adaptive attempts (never / recent / stale).
 * 3. Context salience wiring — the engine must reproduce profile.js's own shown/promoted
 *    rule and name only the conditions that actually fired.
 * 4. Skill-need scoring — unpracticed or weak skills rank higher; cold start reads 0.75.
 * 5. Practice-run selection order, freshness gating, and backfill.
 * 6. Held-out mechanics — probes serve only on measurement runs, exactly once, and never
 *    leak into practice; shortfall is reported, never hidden.
 * 7. Real-dataset invariants — probes exist, stay outnumbered by practice stages, and
 *    every stage carries context and skill tagging.
 *
 * Zero external runtime dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  flattenStages, stageKey, freshness, contextScore, skillScore, buildRun,
  HELD_OUT_EVERY, FRESH_WINDOW_DAYS
} from '../js/inoculation.js';
import { MINI_SALIENCE } from '../js/profile.js';
import { SCHEMA_VERSION } from '../js/attemptlog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT_DIR, rel), 'utf8'));

const REAL_SCENARIOS = readJson('data/inoculation.json');
const PROFILE_ITEMS = readJson('data/profile-items.json').items;

/* --------------------------------------------------------------- fixtures */

const T0 = 1786000000000; // fixed epoch; never Date.now()
const NOW = T0 + 5 * 86400000;
const DAY = 86400000;

/** A well-formed stage with two choices (one inoculating, one reactive). */
function mkStage(stageId, opts = {}) {
  return {
    stageId,
    prompt: `prompt-${stageId}`,
    evidenceSnippets: [],
    choices: [
      { choiceId: `${stageId}-a`, text: 'Hold and verify', type: 'Inoculate', resilienceDelta: 8, feedback: 'good' },
      { choiceId: `${stageId}-b`, text: 'Amplify now', type: 'Reactive', resilienceDelta: -6, feedback: 'bad' }
    ],
    contexts: opts.contexts || ['urgency'],
    stageSkills: opts.stageSkills || ['skill.alpha'],
    ...(opts.heldOut ? { heldOut: true } : {})
  };
}

function mkScenario(id, stages) {
  return { id, title: `Title ${id}`, category: 'Test', branchingStages: stages, tests: ['skill.alpha'] };
}

/** Attempt-log fixture in the real record shape (estimate-compatible). */
function mkAttempt(skillId, itemId, correct, ts, extra = {}) {
  return {
    v: SCHEMA_VERSION, id: `att-${skillId}-${itemId}-${ts}`, ts, skillId, itemId,
    correct, latencyMs: 3000, context: 'test', heldOut: false, ...extra
  };
}

/** Responses that clear the urgency mini-check bar regardless of per-item coding direction. */
function miniClearedResponses(context = 'urgency') {
  return PROFILE_ITEMS
    .filter((it) => it.lens === `ctx-${context}`)
    .map((it) => ({ itemId: it.id, value: it.record === -1 ? 1 : 5, scope: [], ts: NOW }));
}

const OBS = {
  /** A favorable, low-confidence event: counts toward net, not toward disconfirmation. */
  favorable: (context, ts) => ({ id: `obs-${context}-${ts}`, contextTag: context, ts, resisted: true, confidence: 1 }),
  /** An unfavorable event: shows the watchpoint on its own. */
  unfavorable: (context, ts) => ({ id: `obs-${context}-${ts}`, contextTag: context, ts, resisted: false, confidence: 5 })
};

const EMPTY = { responses: [], observations: [], items: PROFILE_ITEMS, attempts: [], adaptiveLog: [] };

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

const harness = new TestHarness('Adaptive Inoculation Selector Suite');

async function runTests() {
  // ============================================================ Tier 1: candidates
  await harness.describe('Tier 1: flattenStages and stageKey', async () => {
    await harness.it('flattens well-formed (scenario, stage) pairs', () => {
      const pairs = flattenStages([mkScenario('s1', [mkStage('a'), mkStage('b')])]);
      harness.assertEqual(pairs.length, 2, 'two stages flatten to two pairs');
      harness.assertEqual(pairs[1].stageIndex, 1, 'stage index preserved');
    });
    await harness.it('skips malformed scenarios and stages without throwing', () => {
      const pairs = flattenStages([
        null,
        { title: 'no id' },
        { id: 's-empty' },
        { id: 's-badstage', branchingStages: [{ stageId: 'no-choices' }, null] },
        mkScenario('s-ok', [mkStage('ok')])
      ]);
      harness.assertEqual(pairs.length, 1, 'only the well-formed pair survives');
      harness.assertEqual(pairs[0].scenario.id, 's-ok', 'and it is the right one');
    });
    await harness.it('stageKey joins scenario and stage ids with ::', () => {
      harness.assertEqual(stageKey('scen', 'stage'), 'scen::stage', 'key format');
    });
  });

  // ============================================================ Tier 2: freshness
  await harness.describe('Tier 2: freshness tiers from prior adaptive attempts', async () => {
    await harness.it('a never-served stage reads tier never with full score', () => {
      const f = freshness('x::y', [], { now: NOW });
      harness.assertEqual(f.tier, 'never', 'tier');
      harness.assertEqual(f.score, 1, 'full freshness score');
      harness.assertEqual(f.timesServed, 0, 'no servings counted');
    });
    await harness.it('a stage served inside the window is recent with zero score', () => {
      const log = [{ itemId: 'x::y', ts: NOW - 2 * DAY }];
      const f = freshness('x::y', log, { now: NOW });
      harness.assertEqual(f.tier, 'recent', 'tier');
      harness.assertEqual(f.score, 0, 'zero score');
      harness.assertEqual(f.timesServed, 1, 'serving counted');
    });
    await harness.it(`a stage served beyond ${FRESH_WINDOW_DAYS} days is stale at half score`, () => {
      const f = freshness('x::y', [{ itemId: 'x::y', ts: NOW - (FRESH_WINDOW_DAYS + 10) * DAY }], { now: NOW });
      harness.assertEqual(f.tier, 'stale', 'tier');
      harness.assertEqual(f.score, 0.5, 'half score');
      harness.assert(/days ago/.test(f.reason), `reason names the age (${f.reason})`);
    });
    await harness.it('matching is by exact itemId — other stages never interfere', () => {
      const log = [{ itemId: 'other::key', ts: NOW - DAY }];
      harness.assertEqual(freshness('x::y', log, { now: NOW }).tier, 'never', 'different key ignored');
    });
  });

  // ============================================================ Tier 3: context salience
  await harness.describe('Tier 3: contextScore reproduces profile.js watchpoint rule', async () => {
    await harness.it('a stage with no context tagging scores 0 and says so', () => {
      const r = contextScore({ contexts: [] }, EMPTY.responses, EMPTY.observations, PROFILE_ITEMS, { now: NOW });
      harness.assertEqual(r.score, 0, 'zero score');
      harness.assert(/no pressure-context/.test(r.reason), `honest reason (${r.reason})`);
    });
    await harness.it('no profile data means no active watchpoint — not a fake one', () => {
      const r = contextScore({ contexts: ['urgency'] }, [], [], PROFILE_ITEMS, { now: NOW });
      harness.assertEqual(r.score, 0, 'zero score');
      harness.assertEqual(r.salient, false, 'not salient');
    });
    await harness.it('a cleared mini-check alone shows the watchpoint at score 1', () => {
      const r = contextScore({ contexts: ['urgency'] }, miniClearedResponses(), [], PROFILE_ITEMS, { now: NOW });
      harness.assertEqual(r.score, 1, 'shown but not promoted');
      harness.assert(r.reason.includes('mini-check'), `reason names the mini-check (${r.reason})`);
      harness.assert(!/event/.test(r.reason), `and does not claim logged events (${r.reason})`);
    });
    await harness.it('one unfavorable logged event alone shows the watchpoint at score 1', () => {
      const r = contextScore({ contexts: ['urgency'] }, [], [OBS.unfavorable('urgency', NOW - DAY)], PROFILE_ITEMS, { now: NOW });
      harness.assertEqual(r.score, 1, 'shown but not promoted');
      harness.assert(/unfavorable event/.test(r.reason), `reason names the event (${r.reason})`);
      harness.assert(!r.reason.includes('mini-check'), 'and does not claim the mini-check');
    });
    await harness.it('mini-check plus net supporting observations promotes to score 2', () => {
      const obs = [OBS.favorable('urgency', NOW - DAY), OBS.favorable('urgency', NOW - 2 * DAY)];
      const r = contextScore({ contexts: ['urgency'] }, miniClearedResponses(), obs, PROFILE_ITEMS, { now: NOW });
      harness.assertEqual(r.score, 2, 'promoted');
      harness.assertEqual(r.salient, true, 'salient flag set');
      harness.assert(/promoted/.test(r.reason), `reason says promoted (${r.reason})`);
    });
    await harness.it('an unfavorable event plus a cleared mini-check also promotes', () => {
      const r = contextScore(
        { contexts: ['urgency'] }, miniClearedResponses(), [OBS.unfavorable('urgency', NOW - DAY)], PROFILE_ITEMS, { now: NOW }
      );
      harness.assertEqual(r.score, 2, 'promoted');
    });
    await harness.it(`observations outside the ${30}-day window never count`, () => {
      const r = contextScore({ contexts: ['urgency'] }, [], [OBS.unfavorable('urgency', NOW - 40 * DAY)], PROFILE_ITEMS, { now: NOW });
      harness.assertEqual(r.score, 0, 'stale event ignored');
    });
    await harness.it(`mini-check must clear the ${MINI_SALIENCE} bar — a low mean shows nothing`, () => {
      const low = PROFILE_ITEMS.filter((it) => it.lens === 'ctx-urgency')
        .map((it) => ({ itemId: it.id, value: it.record === -1 ? 5 : 1, scope: [], ts: NOW }));
      const r = contextScore({ contexts: ['urgency'] }, low, [], PROFILE_ITEMS, { now: NOW });
      harness.assertEqual(r.score, 0, 'below-bar mini-check ignored');
    });
  });

  // ============================================================ Tier 4: skill need
  await harness.describe('Tier 4: skillScore ranks weak practice honestly', async () => {
    await harness.it('an untagged stage falls back to 0.75 and says so', () => {
      const r = skillScore({ stageSkills: [] }, [], { now: NOW });
      harnessClose(r.score, 0.75, 'fallback score');
      harness.assert(/no skill tagging/.test(r.reason), `honest reason (${r.reason})`);
    });
    await harness.it('a cold skill reads mastery 0.5, so its score is 0.75', () => {
      const r = skillScore({ stageSkills: ['skill.alpha'] }, [], { now: NOW });
      harnessClose(r.score, 0.75, 'cold-start score');
      harness.assert(/no attempts yet/.test(r.reason), `cold-start reason (${r.reason})`);
      harness.assertEqual(r.primarySkill, 'skill.alpha', 'primary skill named');
    });
    await harness.it('a strong skill lowers the score', () => {
      const attempts = Array.from({ length: 20 }, (_, i) => mkAttempt('skill.alpha', 'item-1', i < 18, T0 + i * 1000));
      const r = skillScore({ stageSkills: ['skill.alpha'] }, attempts, { now: NOW });
      harness.assert(r.score < 0.4, `strong mastery deflates need (score ${r.score.toFixed(3)})`);
      harness.assert(/mastery 0\.\d+ on skill\.alpha/.test(r.reason), `reason names the estimate (${r.reason})`);
    });
    await harness.it('held-out attempts never inflate or deflate the need signal', () => {
      const attempts = [
        mkAttempt('skill.alpha', 'item-1', true, T0, { heldOut: true }),
        mkAttempt('skill.alpha', 'item-1', true, T0 + 1, { heldOut: true })
      ];
      const r = skillScore({ stageSkills: ['skill.alpha'] }, attempts, { now: NOW });
      harnessClose(r.score, 0.75, 'held-out records excluded from mastery');
    });
  });

  // ============================================================ Tier 5: practice ordering
  await harness.describe('Tier 5: buildRun practice selection is ranked and explainable', async () => {
    // Five practice stages with known priorities (2*ctx + skill + freshness):
    //   promoted ctx (2*2) + cold skill (0.75) + never-served (1)     = 5.75
    //   mini-only ctx (2*1) + strong skill (~0.19) + never-served (1)  ≈ 3.19
    //   no ctx signal (0)  + weak skill (~1.17) + never-served (1)     ≈ 2.17
    //   no ctx signal (0)  + cold skill (0.75) + stale-served (0.5)    = 1.25
    //   no ctx signal (0)  + strong skill (~0.19) + never-served (1)   ≈ 1.19
    const SCEN = [
      mkScenario('syn-a', [mkStage('st-promoted', { contexts: ['urgency'], stageSkills: ['skill.cold'] })]),
      mkScenario('syn-b', [mkStage('st-mini', { contexts: ['authority'], stageSkills: ['skill.strong'] })]),
      mkScenario('syn-c', [mkStage('st-weak', { contexts: ['scarcity'], stageSkills: ['skill.weak'] })]),
      mkScenario('syn-d', [mkStage('st-strong', { contexts: ['conflict'], stageSkills: ['skill.strong'] })]),
      mkScenario('syn-e', [mkStage('st-stale', { contexts: ['isolation'], stageSkills: ['skill.cold'] })])
    ];
    const strong = Array.from({ length: 30 }, (_, i) => mkAttempt('skill.strong', `i${i}`, i < 27, T0 + i * 1000));
    const weak = Array.from({ length: 30 }, (_, i) => mkAttempt('skill.weak', `i${i}`, i < 6, T0 + i * 1000));
    const INPUTS = {
      ...EMPTY,
      scenarios: SCEN,
      attempts: [...strong, ...weak],
      responses: [...miniClearedResponses('urgency'), ...miniClearedResponses('authority')],
      observations: [OBS.favorable('urgency', NOW - DAY), OBS.favorable('urgency', NOW - 2 * DAY)]
    };
    const W = { now: NOW };

    await harness.it('practice run serves exactly three stages', () => {
      const run = buildRun({ ...INPUTS, runNumber: 1 }, W);
      harness.assertEqual(run.stages.length, 3, 'three stages');
      harness.assertEqual(run.isHeldOutRun, false, 'practice run');
    });
    await harness.it('rank order follows the counted priority: promoted > mini-only > weak-skill', () => {
      const run = buildRun({ ...INPUTS, runNumber: 1 }, W);
      const ids = run.stages.map((s) => s.itemId);
      harness.assertEqual(ids[0], 'syn-a::st-promoted', 'promoted watchpoint first');
      harness.assertEqual(ids[1], 'syn-b::st-mini', 'mini-only watchpoint second');
      harness.assertEqual(ids[2], 'syn-c::st-weak', 'weak unpracticed skill third');
      const losers = buildRun({ ...INPUTS, runNumber: 1 }, W);
      harness.assert(losers.stages.every((s) => s.itemId !== 'syn-d::st-strong'), 'strong fresh skill ranks last of five');
    });
    await harness.it('every served stage carries its three auditable reasons', () => {
      const run = buildRun({ ...INPUTS, runNumber: 1 }, W);
      for (const s of run.stages) {
        harness.assertEqual(s.reasons.length, 3, `${s.itemId} has three reasons`);
        harness.assert(s.reasons.every((r) => typeof r === 'string' && r.length > 0), `${s.itemId} reasons are non-empty strings`);
      }
      harness.assert(/promoted/.test(run.stages[0].reasons[0]), 'top stage names its promotion');
      harness.assert(/no attempts yet/.test(run.stages[0].reasons[1]), 'top stage names its cold skill');
    });
    await harness.it('a recently served stage drops out when fresh candidates exist', () => {
      const log = [{ itemId: 'syn-a::st-promoted', ts: NOW - DAY }];
      const run = buildRun({ ...INPUTS, adaptiveLog: log, runNumber: 1 }, W);
      const ids = run.stages.map((s) => s.itemId);
      harness.assert(!ids.includes('syn-a::st-promoted'), 'recent stage not re-served');
      harness.assertEqual(ids[0], 'syn-b::st-mini', 'next-ranked takes the slot');
      harness.assertEqual(ids[2], 'syn-e::st-stale', 'cold skill last served long ago completes the run');
    });
    await harness.it('a recently served stage backfills only when fewer than three fresh exist', () => {
      const log = [
        { itemId: 'syn-a::st-promoted', ts: NOW - DAY },
        { itemId: 'syn-b::st-mini', ts: NOW - DAY },
        { itemId: 'syn-c::st-weak', ts: NOW - DAY }
      ];
      const run = buildRun({ ...INPUTS, adaptiveLog: log, runNumber: 1 }, W);
      const ids = run.stages.map((s) => s.itemId);
      harness.assertEqual(ids.length, 3, 'run still fills three slots');
      harness.assert(ids.includes('syn-a::st-promoted'), 'recent stage backfilled');
      harness.assert(ids.includes('syn-e::st-stale') && ids.includes('syn-d::st-strong'), 'fresh stages fill first');
    });
    await harness.it('between equal-need stages, the never-served one outranks the stale-served one', () => {
      const twin = [
        mkScenario('syn-f1', [mkStage('twin', { contexts: ['fatigue'], stageSkills: ['skill.cold'] })]),
        mkScenario('syn-f2', [mkStage('twin', { contexts: ['fatigue'], stageSkills: ['skill.cold'] })])
      ];
      const log = [{ itemId: 'syn-f1::twin', ts: NOW - (FRESH_WINDOW_DAYS + 5) * DAY }];
      const run = buildRun({ ...EMPTY, scenarios: twin, adaptiveLog: log, runNumber: 1 }, W);
      const ids = run.stages.map((s) => s.itemId);
      harness.assert(ids.indexOf('syn-f2::twin') < ids.indexOf('syn-f1::twin'),
        `never-served first (${ids.join(', ')})`);
    });
    await harness.it('ties break deterministically by itemId', () => {
      const twin = [mkScenario('syn-t1', [mkStage('twin', { contexts: ['fatigue'] })]), mkScenario('syn-t2', [mkStage('twin', { contexts: ['fatigue'] })])];
      const run = buildRun({ ...EMPTY, scenarios: twin, runNumber: 1 }, W);
      const ids = run.stages.map((s) => s.itemId);
      harness.assert(ids.indexOf('syn-t1::twin') < ids.indexOf('syn-t2::twin'), `stable order (${ids.join(', ')})`);
    });
  });

  // ============================================================ Tier 6: held-out mechanics
  await harness.describe('Tier 6: held-out probes serve once, on measurement runs only', async () => {
    const HELD = ['h1', 'h2', 'h3'];
    const SCEN = [
      mkScenario('syn-h', HELD.map((s) => mkStage(s, { heldOut: true }))),
      mkScenario('syn-p', [mkStage('p1'), mkStage('p2'), mkStage('p3')])
    ];
    const W = { now: NOW };

    await harness.it(`every ${HELD_OUT_EVERY}th run is a measurement run`, () => {
      harness.assertEqual(HELD_OUT_EVERY, 3, 'cadence constant');
      harness.assertEqual(buildRun({ scenarios: SCEN, runNumber: 2 }, W).isHeldOutRun, false, 'run 2 practices');
      harness.assertEqual(buildRun({ scenarios: SCEN, runNumber: 3 }, W).isHeldOutRun, true, 'run 3 measures');
    });
    await harness.it('held-out stages never appear in a practice run — even to fill slots', () => {
      const run = buildRun({ scenarios: SCEN, runNumber: 1 }, W);
      harness.assert(run.stages.every((s) => !s.isHeldOut), 'no probe served as practice');
      harness.assert(run.stages.length <= 3, 'run respects slot count');
    });
    await harness.it('a measurement run serves the held-out pool with zero shortfall', () => {
      const run = buildRun({ scenarios: SCEN, runNumber: 3 }, W);
      harness.assertEqual(run.heldOutServed, 3, 'all three probes served');
      harness.assertEqual(run.heldOutShortfall, 0, 'no shortfall');
      harness.assert(run.stages.every((s) => s.isHeldOut), 'measurement slots go to probes');
    });
    await harness.it('a served probe never serves again — the shortfall is reported, not hidden', () => {
      const log = HELD.map((s) => ({ itemId: stageKey('syn-h', s), ts: NOW - DAY }));
      const run = buildRun({ scenarios: SCEN, adaptiveLog: log, runNumber: 6 }, W);
      harness.assert(run.stages.every((s) => !s.isHeldOut), 'served probes excluded');
      harness.assertEqual(run.heldOutShortfall, 3, 'shortfall owned honestly');
      harness.assert(/Measurement run/.test(run.note), `note explains the measurement intent (${run.note})`);
    });
    await harness.it('an unserved probe keeps priority over backfill on measurement runs', () => {
      const log = [{ itemId: stageKey('syn-h', 'h1'), ts: NOW - DAY }];
      const run = buildRun({ scenarios: SCEN, adaptiveLog: log, runNumber: 6 }, W);
      const served = run.stages.filter((s) => s.isHeldOut).map((s) => s.itemId);
      harness.assert(served.includes('syn-h::h2') && served.includes('syn-h::h3'), 'unserved probes first');
      harness.assert(!served.includes('syn-h::h1'), 'served probe excluded');
    });
    await harness.it('measurement backfill is fresh-first, not raw priority', () => {
      // p1 was served moments ago but carries an active watchpoint, so its raw priority
      // beats never-served p4 — the backfill must still take p4 first, exactly as a
      // practice run would.
      const run = buildRun({
        scenarios: [
          mkScenario('syn-h', [mkStage('h1', { heldOut: true })]),
          mkScenario('syn-p', [mkStage('p1', { contexts: ['urgency'] }), mkStage('p4')])
        ],
        responses: miniClearedResponses('urgency'),
        items: PROFILE_ITEMS,
        adaptiveLog: [{ itemId: 'syn-p::p1', ts: NOW - 1000 }],
        runNumber: 6
      }, W);
      harness.assertEqual(run.stages.length, 3, 'run serves exactly three stages');
      const backfill = run.stages.filter((s) => !s.isHeldOut).map((s) => s.itemId);
      harness.assertEqual(backfill[0], 'syn-p::p4', 'a just-served stage never leapfrogs a fresh one');
      harness.assert(backfill.includes('syn-p::p1'), 'the remaining backfill slot goes by priority');
    });
  });

  // ============================================================ Tier 7: real dataset invariants
  await harness.describe('Tier 7: the shipped dataset keeps its probe contract', async () => {
    const probes = [];
    for (const s of REAL_SCENARIOS) {
      for (const st of s.branchingStages || []) {
        if (st && st.heldOut === true) probes.push({ scenario: s, stage: st });
      }
    }
    await harness.it('at least one full measurement run of probes is reserved', () => {
      harness.assert(probes.length >= HELD_OUT_EVERY, `probes reserved (${probes.length} >= ${HELD_OUT_EVERY})`);
    });
    await harness.it('probe stage ids are unique across the dataset', () => {
      const ids = probes.map((p) => stageKey(p.scenario.id, p.stage.stageId));
      harness.assertEqual(new Set(ids).size, ids.length, 'no duplicate probe keys');
    });
    await harness.it('every probe leaves its scenario statically playable', () => {
      for (const p of probes) {
        const practice = (p.scenario.branchingStages || []).filter((st) => !(st && st.heldOut === true));
        harness.assert(practice.length >= 1, `${p.scenario.id} keeps ${practice.length} practice stage(s)`);
      }
    });
    await harness.it('every real stage carries context and skill tagging', () => {
      let stages = 0;
      for (const s of REAL_SCENARIOS) {
        for (const st of s.branchingStages || []) {
          stages++;
          harness.assert(Array.isArray(st.contexts) && st.contexts.length >= 1, `${s.id}::${st.stageId} has contexts`);
          harness.assert(Array.isArray(st.stageSkills) && st.stageSkills.length >= 1, `${s.id}::${st.stageId} has skills`);
        }
      }
      harness.assert(stages >= 15, `dataset size sane (${stages} stages)`);
    });
    await harness.it('a cold-start practice run on real data serves three unheld stages with reasons', () => {
      const run = buildRun({ ...EMPTY, scenarios: REAL_SCENARIOS, runNumber: 1 }, { now: NOW });
      harness.assertEqual(run.stages.length, 3, 'three stages');
      harness.assert(run.stages.every((s) => !s.isHeldOut), 'no probe leaks into practice');
      harness.assert(run.stages.every((s) => /^.+::.+$/.test(s.itemId)), 'item ids are scenario::stage keys');
    });
  });

  return harness.summary();
}

function harnessClose(a, e, m) { harness.assertClose(a, e, 0.005, m); }

runTests().then((r) => { if (r.failed > 0) process.exitCode = 1; });
