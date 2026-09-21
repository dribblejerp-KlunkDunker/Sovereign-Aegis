/**
 * SOVEREIGN // AEGIS — Adaptive Inoculation Scenario Engine (pure selection)
 *
 * WHY THIS MODULE DOES NO I/O
 * ---------------------------
 * Same load-bearing decision as js/profile.js and js/competency.js: every function takes its
 * data as arguments and returns values. It never reads storage, never fetches, never touches
 * the DOM. The view (js/modules/*.js) gathers the inputs — the inoculation dataset, the
 * Defense Profile's responses and observation log, the attempt log — and hands them in; this
 * module decides which (scenario, stage) pairs a run serves and says why, in strings an
 * operator can audit in the UI.
 *
 * WHAT "ADAPTIVE" MEANS HERE, EXACTLY
 * -----------------------------------
 * A run is three stages. Each stage is ranked by one counted priority:
 *
 *     priority = 2 x contextSalience + 1.5 x (1 - mastery) + freshness
 *
 * - contextSalience (0 / 1 / 2): does the operator's Defense Profile show this stage's
 *   pressure context as an active watchpoint? The rule is profile.js's own: shown when the
 *   context mini-check cleared the bar OR an unfavorable event is logged in the window;
 *   "promoted" when observations also support it. Nothing hidden in a weight.
 * - mastery: competency.estimate() on the stage's primary skill, computed from attempts with
 *   held-out records excluded (estimate's own default) — a weak or unpracticed skill raises
 *   the stage's priority, so practice lands where the operator is least proven.
 * - freshness: a stage served by the adaptive engine within the window drops out entirely
 *   (and only backfills if fewer than three fresh candidates exist); one served long ago
 *   counts half; a never-served stage counts fully. Held-out stages additionally require
 *   zero prior servings ever — a measurement probe is served once.
 *
 * HELD-OUT RUNS
 * -------------
 * Every HELD_OUT_EVERY-th run is a measurement run: unserved held-out stages take its
 * slots first (the content marks them heldOut, data-side flag, same doctrine as
 * arena_questions.json) and any remainder backfills with practice stages. The attempt log
 * records probe attempts heldOut:true, which is exactly what competency.transfer()
 * aggregates — so adaptive runs strengthen the transfer measurement instead of
 * contaminating it. Until the
 * dataset reserves held-out stages, runs stay practice runs and the shortfall is reported,
 * not hidden.
 *
 * NOTHING HERE INVENTS A NUMBER
 * -----------------------------
 * No vulnerability score, no readiness index. The priority is a selection ordering, internal
 * to the engine; the UI shows the reasons, never the number.
 *
 * @module inoculation
 */

import { estimate } from './competency.js';
import { salience as profileSalience, MINI_SALIENCE } from './profile.js';

/** Every Nth run is a held-out measurement run. */
export const HELD_OUT_EVERY = 3;
/** A stage served by the adaptive engine within this many days is not re-served. */
export const FRESH_WINDOW_DAYS = 30;

const DAY_MS = 86400000;

/**
 * Flatten scenarios into (scenario, stage) candidate pairs.
 * Malformed entries are skipped, not crashed on — a bad pack import must not brick the run.
 * @param {object[]} scenarios - data/inoculation.json
 * @returns {{scenario: object, stage: object, stageIndex: number}[]}
 */
export function flattenStages(scenarios) {
  const out = [];
  for (const s of scenarios || []) {
    if (!s || !s.id || !Array.isArray(s.branchingStages)) continue;
    s.branchingStages.forEach((stage, stageIndex) => {
      if (!stage || !stage.stageId || !Array.isArray(stage.choices) || !stage.choices.length) return;
      out.push({ scenario: s, stage, stageIndex });
    });
  }
  return out;
}

/** Stable key for a stage candidate: also the attempt-log itemId for adaptive attempts. */
export function stageKey(scenarioId, stageId) {
  return `${scenarioId}::${stageId}`;
}

/**
 * Freshness class for one stage key against prior adaptive attempts.
 * @param {string} key
 * @param {{itemId: string, ts: number}[]} adaptiveLog - prior attempts under this engine's context
 * @param {{now?: number}} [opts]
 * @returns {{tier: 'never'|'stale'|'recent', score: number, timesServed: number, lastServed: number|null, reason: string}}
 */
export function freshness(key, adaptiveLog, opts = {}) {
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  const served = (adaptiveLog || []).filter((a) => a && a.itemId === key && Number.isFinite(a.ts));
  const timesServed = served.length;
  const lastServed = timesServed ? Math.max(...served.map((a) => a.ts)) : null;

  if (!timesServed) {
    return { tier: 'never', score: 1, timesServed, lastServed, reason: 'never served by the adaptive engine' };
  }
  const ageDays = (now - lastServed) / DAY_MS;
  if (ageDays > FRESH_WINDOW_DAYS) {
    return {
      tier: 'stale',
      score: 0.5,
      timesServed,
      lastServed,
      reason: `served ${timesServed}x, last ${Math.floor(ageDays)} days ago`
    };
  }
  return {
    tier: 'recent',
    score: 0,
    timesServed,
    lastServed,
    reason: `served ${timesServed}x in the last ${FRESH_WINDOW_DAYS} days`
  };
}

/**
 * Context salience score for a stage, reusing profile.js's own watchpoint rule.
 * @param {object} stage
 * @param {object[]} responses - ProfileStore responses
 * @param {object[]} observations - ProfileStore observations
 * @param {object[]} items - data/profile-items.json (mini-check inventory)
 * @param {{now?: number}} [opts]
 * @returns {{score: number, salient: boolean, reason: string}}
 */
export function contextScore(stage, responses, observations, items, opts = {}) {
  const contexts = Array.isArray(stage.contexts) ? stage.contexts : [];
  if (!contexts.length) {
    return { score: 0, salient: false, reason: 'stage has no pressure-context tagging' };
  }
  // The stage's most active context carries its score; all active contexts are named in the reason.
  let best = { score: 0, salient: false, reason: 'no active watchpoint for this stage' };
  let bestContext = null;
  const active = [];
  for (const context of contexts) {
    const s = profileSalience(context, responses, observations, items, opts);
    const shown = (s.miniAvg !== null && s.miniAvg >= MINI_SALIENCE) || s.unfavorableCount >= 1;
    if (!shown) continue;
    active.push(context);
    const score = s.salient ? 2 : 1;
    if (score > best.score) {
      // Name only the conditions that actually fired — never claim the mini-check
      // contributed when it sat below the bar.
      const how = [];
      if (s.miniAvg !== null && s.miniAvg >= MINI_SALIENCE) how.push('mini-check');
      if (s.unfavorableCount >= 1) how.push('an unfavorable event logged');
      best = {
        score,
        salient: s.salient,
        reason: s.salient
          ? `profile watchpoint promoted for "${context}" (mini-check + logged events)`
          : `profile watchpoint active for "${context}" (${how.join(' + ')})`
      };
      bestContext = context;
    }
  }
  const others = active.filter((c) => c !== bestContext);
  if (others.length) best.reason += `; also active: ${others.join(', ')}`;
  return best;
}

/**
 * Skill-need score for a stage's primary skill: weaker mastery ranks higher.
 * @param {object} stage
 * @param {object[]} attempts - AttemptLog records (held-out records are excluded inside estimate)
 * @param {{now?: number}} [opts]
 * @returns {{score: number, primarySkill: string|null, reason: string}}
 */
export function skillScore(stage, attempts, opts = {}) {
  const primary = Array.isArray(stage.stageSkills) && stage.stageSkills.length ? stage.stageSkills[0] : null;
  if (!primary) {
    return { score: 0.75, primarySkill: null, reason: 'stage has no skill tagging' };
  }
  const est = estimate(attempts, primary, opts);
  const pct = Math.round(est.mastery * 100) / 100;
  return {
    score: 1.5 * (1 - est.mastery),
    primarySkill: primary,
    reason: est.n === 0
      ? `no attempts yet on ${primary} (mastery unknown)`
      : `mastery ${pct} on ${primary} over ${est.n} attempt${est.n === 1 ? '' : 's'}`
  };
}

/**
 * Build one adaptive run: three ranked stages with auditable reasons.
 *
 * @param {object} inputs
 * @param {object[]} inputs.scenarios       - data/inoculation.json
 * @param {object[]} inputs.attempts        - AttemptLog records (all contexts)
 * @param {object[]} inputs.responses       - ProfileStore responses
 * @param {object[]} inputs.observations    - ProfileStore observations
 * @param {object[]} inputs.items           - data/profile-items.json
 * @param {{itemId: string, ts: number}[]} [inputs.adaptiveLog] - prior attempts under the
 *        adaptive context, for freshness
 * @param {number} [inputs.runNumber]       - 1-based count including this run
 * @param {{now?: number}} [opts]
 * @returns {{
 *   runNumber: number, isHeldOutRun: boolean,
 *   stages: Array<{scenarioId: string, scenarioTitle: string, stageId: string, stageIndex: number,
 *                  itemId: string, prompt: string, evidenceSnippets: string[], choices: object[],
 *                  contexts: string[], stageSkills: string[], primarySkill: string|null,
 *                  isHeldOut: boolean, priority: number, reasons: string[]}>,
 *   heldOutServed: number, heldOutShortfall: number, note: string
 * }}
 */
export function buildRun(inputs, opts = {}) {
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  const {
    scenarios, attempts = [], responses = [], observations = [], items = [],
    adaptiveLog = [], runNumber = 1
  } = inputs;

  const isHeldOutRun = Number.isFinite(runNumber) && runNumber > 0 && runNumber % HELD_OUT_EVERY === 0;

  const ranked = flattenStages(scenarios)
    .map(({ scenario, stage, stageIndex }) => {
      const ctx = contextScore(stage, responses, observations, items, { now });
      const skill = skillScore(stage, attempts, { now });
      const key = stageKey(scenario.id, stage.stageId);
      const fresh = freshness(key, adaptiveLog, { now });
      const isHeldOut = stage.heldOut === true;
      const priority = 2 * ctx.score + skill.score + fresh.score;
      return {
        scenarioId: scenario.id,
        scenarioTitle: scenario.title || scenario.id,
        stageId: stage.stageId,
        stageIndex,
        itemId: key,
        prompt: stage.prompt || '',
        evidenceSnippets: Array.isArray(stage.evidenceSnippets) ? stage.evidenceSnippets : [],
        choices: stage.choices,
        contexts: Array.isArray(stage.contexts) ? stage.contexts : [],
        stageSkills: Array.isArray(stage.stageSkills) ? stage.stageSkills : [],
        primarySkill: skill.primarySkill,
        isHeldOut,
        priority,
        freshTier: fresh.tier,
        reasons: [ctx.reason, skill.reason, fresh.reason]
      };
    })
    .sort((a, b) =>
      b.priority - a.priority ||
      a.freshTier.localeCompare(b.freshTier) ||
      a.itemId.localeCompare(b.itemId)
    );

  // Held-out stages may only serve as measurement, never as practice: they are excluded
  // from practice runs entirely, and from measurement runs once served (a probe is served
  // exactly once — the same integrity rule that keeps arena's held-out set clean).
  const eligible = ranked.filter((c) => !c.isHeldOut || !(adaptiveLog || []).some((a) => a && a.itemId === c.itemId));

  // Fresh or long-ago-served candidates fill the slots first, in ranked order; recently
  // served ones backfill only the remainder — a serving can never leapfrog a fresh
  // candidate, on either run kind. (Candidates partition by freshTier, so no dedupe.)
  const freshFirst = (candidates, slots) => [
    ...candidates.filter((c) => c.freshTier !== 'recent'),
    ...candidates.filter((c) => c.freshTier === 'recent')
  ].slice(0, slots);

  const probes = eligible.filter((c) => c.isHeldOut);
  const poolable = eligible.filter((c) => !c.isHeldOut);
  const stages = isHeldOutRun
    ? // Measurement: unserved probes take the slots first; practice stages backfill under
      // the same fresh-first rule, so a measurement run cannot re-serve a just-served stage.
      [...probes, ...freshFirst(poolable, Math.max(0, 3 - probes.length))].slice(0, 3)
    : freshFirst(poolable, 3);

  const heldOutServed = stages.filter((s) => s.isHeldOut).length;
  // On a measurement run, how many of the three slots could not be filled with held-out
  // stages — zero once the dataset reserves enough probes, reported rather than hidden
  // until then.
  const heldOutShortfall = isHeldOutRun ? 3 - heldOutServed : 0;

  const note = isHeldOutRun
    ? `Measurement run #${runNumber}: stages come from the held-out probe pool where the dataset reserves them${heldOutServed ? ` (${heldOutServed} of 3 this run)` : ''}. These attempts are recorded held-out and feed the transfer measurement.`
    : `Run #${runNumber}: stages chosen by your Defense Profile and competency spine. The reason under each stage says exactly why it was served.`;

  return { runNumber, isHeldOutRun, stages, heldOutServed, heldOutShortfall, note };
}

export default {
  HELD_OUT_EVERY, FRESH_WINDOW_DAYS,
  flattenStages, stageKey, freshness, contextScore, skillScore, buildRun
};
