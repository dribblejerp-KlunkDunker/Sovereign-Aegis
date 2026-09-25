/**
 * SOVEREIGN // AEGIS — Competency estimation (pure)
 *
 * WHY THIS MODULE DOES NO I/O
 * ---------------------------
 * Every function here takes attempts as an argument and returns numbers. It never reads
 * storage. That is the load-bearing design decision: it means the estimator can be tested
 * against a simulated learner whose true ability is known, which is the only way to
 * establish that a learning model works rather than merely looks reasonable. The previous
 * "progress" notions in this codebase were untestable because they were entangled with
 * the modules that wrote them.
 *
 * js/attemptlog.js owns all storage and has no opinions about learning. This module has
 * all the opinions and touches no storage.
 *
 * WHAT THE ESTIMATOR IS, AND IS NOT
 * ---------------------------------
 * Exponentially-weighted accuracy with a Beta prior. Deliberately simpler than BKT or
 * IRT: no guess/slip parameters, no per-item difficulty. Item difficulty cannot be
 * estimated without cross-user data, and there is no cross-user data here by design —
 * the application is local-first with no backend. Adding parameters that cannot be fitted
 * would add complexity and no accuracy.
 *
 * Two constants (DECAY, CONFIDENCE_K) are honest guesses. Once real attempt logs exist
 * they should be fitted against observed retention. Because the log stores raw events,
 * that is a recompute rather than a migration.
 *
 * @module competency
 */

/** Daily retention weight. 0.97 ⇒ evidence ~23 days old carries half the weight. */
export const DECAY = 0.97;

/**
 * What each stated confidence level is taken to CLAIM, as a probability.
 *
 * These live here rather than in js/attemptlog.js on purpose. The log's job is to validate the
 * vocabulary — three permitted strings — and it should hold no opinion about what they are worth.
 * Turning "sure" into 0.9 is a scoring judgement, and every scoring judgement in this application
 * belongs in this module, where it can be changed and re-run against the raw log without a
 * migration. It also keeps this module import-free, which is what makes it testable in isolation.
 *
 * The numbers are midpoints a reasonable person means by these words, not measured values. Once
 * there are real logs they should be fitted: if the operator is right 71% of the time when they say
 * "sure", then 0.9 is the wrong claim to score them against.
 */
export const CONFIDENCE_LEVELS = Object.freeze({
  sure: 0.9,
  unsure: 0.6,
  guess: 0.25
});

/** Confidence rises as n/(n+k). k=5 ⇒ 5 attempts gives 0.5 confidence. */
export const CONFIDENCE_K = 5;

/** Beta(1,1) — a skill with no evidence reads 0.5 mastery at 0.0 confidence: "unknown". */
export const PRIOR_ALPHA = 1;
export const PRIOR_BETA = 1;

/**
 * How much a confidently-wrong answer multiplies an item's practice priority.
 *
 * 2.5 is a judgement, not a measurement: enough that miscalibrated items reliably reach the top of
 * a queue, not so much that they crowd out never-attempted skills entirely. Exported so it can be
 * fitted once there are real logs to fit against.
 */
export const MISCALIBRATION_BOOST = 2.5;

const DAY_MS = 86400000;

/**
 * Estimate mastery of one skill.
 *
 * Zero attempts is a valid, well-defined state: mastery 0.5, confidence 0. That reads as
 * "unknown", never as "bad" — which matters, because a cold-start user must not be told
 * they are failing at things they have not attempted.
 *
 * @param {object[]} attempts - any attempts; filtered internally by skillId
 * @param {string} skillId
 * @param {{now?: number, includeHeldOut?: boolean}} [opts]
 * @returns {{mastery: number, confidence: number, n: number, lastSeen: number|null, trend: 'improving'|'flat'|'declining'|'unknown'}}
 */
export function estimate(attempts, skillId, opts = {}) {
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  // Held-out items are excluded from mastery by default so that the transfer measurement
  // stays independent of the thing it is measuring.
  const relevant = (attempts || []).filter(
    (a) => a && a.skillId === skillId && (opts.includeHeldOut === true || a.heldOut !== true)
  );

  if (!relevant.length) {
    return { mastery: 0.5, confidence: 0, n: 0, lastSeen: null, trend: 'unknown' };
  }

  let weightedCorrect = 0;
  let weightSum = 0;
  let lastSeen = 0;
  for (const a of relevant) {
    const ageDays = Math.max(0, (now - a.ts) / DAY_MS);
    const w = Math.pow(DECAY, ageDays);
    weightSum += w;
    if (a.correct) weightedCorrect += w;
    if (a.ts > lastSeen) lastSeen = a.ts;
  }

  const mastery = (weightedCorrect + PRIOR_ALPHA) / (weightSum + PRIOR_ALPHA + PRIOR_BETA);
  const n = relevant.length;
  const confidence = n / (n + CONFIDENCE_K);

  return {
    mastery,
    confidence,
    n,
    lastSeen,
    trend: computeTrend(relevant)
  };
}

/**
 * Direction of travel: unweighted accuracy over the most recent third versus the
 * earliest third. Unweighted on purpose — a decay-weighted comparison would report
 * "improving" merely because recent attempts count for more.
 * @private
 */
function computeTrend(relevant) {
  if (relevant.length < 6) return 'unknown';
  const sorted = [...relevant].sort((a, b) => a.ts - b.ts);
  const third = Math.floor(sorted.length / 3);
  const early = sorted.slice(0, third);
  const late = sorted.slice(-third);
  const acc = (xs) => xs.filter((x) => x.correct).length / xs.length;
  const delta = acc(late) - acc(early);
  if (delta > 0.15) return 'improving';
  if (delta < -0.15) return 'declining';
  return 'flat';
}

/**
 * Estimate every skill at once.
 * @param {object[]} attempts
 * @param {{id: string}[]} skills
 * @param {{now?: number}} [opts]
 * @returns {Map<string, ReturnType<typeof estimate>>}
 */
export function estimateAll(attempts, skills, opts = {}) {
  const out = new Map();
  for (const s of skills || []) out.set(s.id, estimate(attempts, s.id, opts));
  return out;
}

/**
 * Rank practice items by expected learning gain.
 *
 * gain = zone × due × coverage
 *
 *   zone     peaks where mastery ≈ 0.7 — hard enough to learn from, not hard enough to
 *            demoralise. Mastered and hopeless items both fall away.
 *   due      spacing pressure: how overdue this skill is relative to how well it is known.
 *            Well-known skills wait longer, which is the SM-2 intuition.
 *   coverage 1/(1+n) — breaks ties toward skills with the least evidence, so
 *            never-attempted skills surface early instead of being invisible.
 *
 * A fourth factor applies when attempts are supplied: an item the operator got wrong while claiming
 * to be SURE is multiplied by MISCALIBRATION_BOOST. This is the only place in the estimator where
 * confidence changes anything, and it changes what to practise rather than what the numbers say.
 * The reasoning is in calibration()'s docstring: a confidently wrong answer is a belief held firmly
 * and incorrectly, which is a different and more urgent problem than a gap the operator already
 * knows they have.
 *
 * @param {{id: string, skillIds: string[]}[]} items
 * @param {Map<string, object>} masteryMap
 * @param {{now?: number, limit?: number, attempts?: object[]}} [opts]
 * @returns {Array<{item: object, gain: number, skillId: string, mastery: number, miscalibrated: boolean}>}
 */
export function rank(items, masteryMap, opts = {}) {
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  const limit = Number.isFinite(opts.limit) ? opts.limit : 20;

  // Item ids the operator has been confidently wrong about. Keyed by itemId, so the boost follows
  // the specific question rather than smearing across a whole skill — being certain and wrong about
  // one item says nothing about the others that test the same skill.
  const confidentlyWrong = new Set(
    (opts.attempts || [])
      .filter((a) => a && a.correct === false && a.confidence === 'sure')
      .map((a) => a.itemId)
  );

  const scored = [];
  for (const item of items || []) {
    const skillIds = Array.isArray(item.skillIds) ? item.skillIds : [];
    if (!skillIds.length) continue;

    // An item testing several skills is scored by its weakest — that is where the
    // learning is.
    let best = null;
    for (const sid of skillIds) {
      const m = masteryMap.get(sid) || { mastery: 0.5, n: 0, lastSeen: null };
      const zone = 1 - Math.abs(m.mastery - 0.7) / 0.7;
      const daysSince = m.lastSeen === null ? 999 : Math.max(0, (now - m.lastSeen) / DAY_MS);
      // Interval grows with mastery: 1 day when unknown, ~10 days when mastered.
      const interval = 1 + m.mastery * 9;
      const due = Math.min(2, daysSince / interval);
      const coverage = 1 / (1 + m.n);
      const gain = Math.max(0, zone) * due * (0.5 + coverage);
      if (!best || gain > best.gain) best = { gain, skillId: sid, mastery: m.mastery };
    }
    if (!best) continue;
    const isMiscalibrated = confidentlyWrong.has(item.id);
    if (isMiscalibrated) best.gain *= MISCALIBRATION_BOOST;
    scored.push({ item, ...best, miscalibrated: isMiscalibrated });
  }

  scored.sort((a, b) => b.gain - a.gain);
  return scored.slice(0, limit);
}

/**
 * Recognised competency clusters for transfer and generalization analysis.
 */
export const TRANSFER_CLUSTERS = Object.freeze({
  fallacy: {
    id: 'fallacy',
    name: 'Logical Fallacies',
    icon: '🏛️',
    description: 'Relevance, structure, scope, appeal & formal validity',
    matches: (skillId) => typeof skillId === 'string' && skillId.startsWith('skill.fallacy.')
  },
  sift: {
    id: 'sift',
    name: 'SIFT Verification',
    icon: '🔍',
    description: 'Stop, investigate source, find coverage & trace origin',
    matches: (skillId) => typeof skillId === 'string' && skillId.startsWith('skill.sift.')
  },
  bias: {
    id: 'bias',
    name: 'Cognitive Biases',
    icon: '🧠',
    description: 'Confirmation, availability, anchoring & attribution',
    matches: (skillId) => typeof skillId === 'string' && skillId.startsWith('skill.bias.')
  },
  tactics: {
    id: 'tactics',
    name: 'Adversarial & DISARM',
    icon: '⚔️',
    description: 'DISARM techniques, astroturfing, flooding & framing',
    matches: (skillId) => typeof skillId === 'string' && (skillId.startsWith('skill.tactic.') || skillId.startsWith('skill.disarm.'))
  }
});

/**
 * Transfer report — performance on HELD-OUT items over time.
 *
 * Held-out items are never used for practice, so improvement here is improvement on
 * unpracticed material. That is the only measurement in this application that can support
 * the claim that it builds capability rather than familiarity.
 *
 * Computes:
 *   - Global baseline vs current held-out accuracy and 95% Wald CI
 *   - Per-cluster transfer deltas (Logical Fallacies, SIFT, Biases, Tactics)
 *   - Longitudinal cohort trajectory over chronological sessions
 *
 * The caveat string is returned as data, deliberately: the qualifier travels with the
 * number instead of depending on whoever writes the UI remembering to add it.
 *
 * @param {object[]} attempts
 * @param {{halfSize?: number}} [opts]
 * @returns {{available: boolean, baseline: object|null, current: object|null, delta: number|null, ci95: [number, number]|null, caveat: string, clusters: object, timeline: object[]}}
 */
export function transfer(attempts, opts = {}) {
  const heldOut = (attempts || [])
    .filter((a) => a && a.heldOut === true)
    .sort((a, b) => a.ts - b.ts);

  const caveat = 'Within-subject comparison on held-out items. Small n, no control group — '
    + 'this is evidence of change in you, not a controlled trial of the method.';

  const minPerHalf = Number.isFinite(opts.halfSize) ? opts.halfSize : 5;
  if (heldOut.length < minPerHalf * 2) {
    return {
      available: false,
      baseline: null,
      current: null,
      delta: null,
      ci95: null,
      caveat: `Not enough held-out attempts yet (${heldOut.length}; need ${minPerHalf * 2}). `
        + 'Absence of a measurement is not a measurement of zero.',
      clusters: {},
      timeline: []
    };
  }

  const half = Math.floor(heldOut.length / 2);
  const early = heldOut.slice(0, half);
  const late = heldOut.slice(-half);
  const summarise = (xs) => ({
    n: xs.length,
    accuracy: xs.length ? xs.filter((x) => x.correct).length / xs.length : 0,
    at: xs.length ? xs[xs.length - 1].ts : null
  });

  const baseline = summarise(early);
  const current = summarise(late);
  const delta = current.accuracy - baseline.accuracy;

  // Wald interval on the difference of two proportions. Wide at these sample sizes,
  // and shown wide on purpose.
  const se = Math.sqrt(
    (baseline.accuracy * (1 - baseline.accuracy)) / Math.max(1, baseline.n) +
    (current.accuracy * (1 - current.accuracy)) / Math.max(1, current.n)
  );
  const margin = 1.96 * se;

  // Per-cluster transfer calculation
  const clusters = {};
  for (const [key, clusterDef] of Object.entries(TRANSFER_CLUSTERS)) {
    const earlyCluster = early.filter((a) => clusterDef.matches(a.skillId));
    const lateCluster = late.filter((a) => clusterDef.matches(a.skillId));

    const bSummary = summarise(earlyCluster);
    const cSummary = summarise(lateCluster);
    const clusterDelta = (earlyCluster.length > 0 && lateCluster.length > 0)
      ? cSummary.accuracy - bSummary.accuracy
      : null;

    clusters[key] = {
      id: clusterDef.id,
      name: clusterDef.name,
      icon: clusterDef.icon,
      description: clusterDef.description,
      baseline: bSummary,
      current: cSummary,
      delta: clusterDelta,
      available: earlyCluster.length > 0 && lateCluster.length > 0
    };
  }

  // Longitudinal cohort trajectory
  const timeline = [];
  if (heldOut.length >= 6) {
    const chunkSize = Math.max(3, Math.min(10, Math.floor(heldOut.length / 2)));
    const numCohorts = Math.max(2, Math.floor(heldOut.length / chunkSize));
    for (let c = 0; c < numCohorts; c++) {
      const start = c * chunkSize;
      const end = (c === numCohorts - 1) ? heldOut.length : (c + 1) * chunkSize;
      const cohortItems = heldOut.slice(start, end);
      const cohortSummary = summarise(cohortItems);
      const clusterAccs = {};
      for (const [key, clusterDef] of Object.entries(TRANSFER_CLUSTERS)) {
        const cItems = cohortItems.filter((a) => clusterDef.matches(a.skillId));
        clusterAccs[key] = cItems.length ? cItems.filter((x) => x.correct).length / cItems.length : null;
      }
      timeline.push({
        cohort: c === 0 ? 'T0 (Baseline)' : `T${c} (Follow-Up)`,
        at: cohortSummary.at,
        n: cohortSummary.n,
        accuracy: cohortSummary.accuracy,
        clusters: clusterAccs
      });
    }
  }

  return {
    available: true,
    baseline,
    current,
    delta,
    ci95: [delta - margin, delta + margin],
    caveat,
    clusters,
    timeline
  };
}

/**
 * Calibration — how well stated confidence matches observed accuracy.
 *
 * WHY THIS IS A SEPARATE FUNCTION AND NOT PART OF estimate()
 * ---------------------------------------------------------
 * It would have been easy to weight mastery by confidence: count a confident correct answer for
 * more, a guessed one for less. That was rejected, deliberately, for two reasons.
 *
 * First, interpretability. `mastery` currently means one thing that can be said in a sentence:
 * "the probability this person answers correctly". Fold a self-report into it and the number means
 * "correctness, adjusted by how the operator felt, by a formula" — which nobody can reason about,
 * and which makes the transfer measurement incomparable across time if the formula ever changes.
 *
 * Second, and more seriously: confidence is SELF-REPORTED, and therefore gameable. If tapping
 * "guessing" softened the penalty for a wrong answer, the optimal strategy would be to claim
 * ignorance on everything and watch mastery rise. An assessment you can improve by lying to it is
 * not an assessment.
 *
 * So: correctness drives mastery, confidence drives calibration, and the two are reported side by
 * side. A person can be accurate and badly calibrated, or well calibrated and weak — those are
 * different problems with different remedies, and collapsing them into one number would hide both.
 *
 * WHAT IT MEASURES
 * ----------------
 * A Brier score (mean squared error between claimed probability and outcome; lower is better,
 * 0.25 is what you get by claiming 50% on everything) plus a reliability table — for each stated
 * level, how often the operator was actually right. The gap between the two is the interesting
 * number, and its sign is what matters: positive means overconfident.
 *
 * v1 records carry no confidence and are excluded rather than assumed. Absence of a stated
 * confidence is not a stated confidence of 50%.
 *
 * @param {object[]} attempts
 * @param {{minPerBin?: number}} [opts]
 * @returns {{available: boolean, n: number, brier: number|null, bins: object[], overconfidence: number|null, headline: string, caveat: string}}
 */
export function calibration(attempts, opts = {}) {
  const minPerBin = Number.isFinite(opts.minPerBin) ? opts.minPerBin : 3;
  const scored = (attempts || []).filter(
    (a) => a && typeof a.correct === 'boolean' && Object.prototype.hasOwnProperty.call(CONFIDENCE_LEVELS, a.confidence)
  );

  const caveat = 'Calibration is measured against your own stated certainty, which you control. '
    + 'It says whether your confidence tracks your accuracy — not whether either is good.';

  if (!scored.length) {
    return {
      available: false,
      n: 0,
      brier: null,
      bins: [],
      overconfidence: null,
      headline: 'No confidence-rated answers yet.',
      caveat
    };
  }

  // Brier score over the nominal probability each level claims.
  let sq = 0;
  for (const a of scored) {
    const p = CONFIDENCE_LEVELS[a.confidence];
    const outcome = a.correct ? 1 : 0;
    sq += (p - outcome) * (p - outcome);
  }
  const brier = sq / scored.length;

  // Reliability table, one row per level. Rows below minPerBin are reported but flagged, never
  // silently dropped — a thin bin is information, and hiding it would make the curve look firmer
  // than the data supports.
  const bins = Object.keys(CONFIDENCE_LEVELS).map((level) => {
    const rows = scored.filter((a) => a.confidence === level);
    const claimed = CONFIDENCE_LEVELS[level];
    const accuracy = rows.length ? rows.filter((a) => a.correct).length / rows.length : null;
    return {
      level,
      claimed,
      n: rows.length,
      accuracy,
      gap: accuracy === null ? null : claimed - accuracy,
      reliable: rows.length >= minPerBin
    };
  });

  // One overall over/underconfidence figure: mean claimed probability minus observed accuracy.
  // Positive = claims more than delivered.
  const meanClaimed = scored.reduce((s, a) => s + CONFIDENCE_LEVELS[a.confidence], 0) / scored.length;
  const observed = scored.filter((a) => a.correct).length / scored.length;
  const overconfidence = meanClaimed - observed;

  // The single sentence most worth showing an operator. Built from the 'sure' bin because that is
  // the claim with consequences — being wrong while certain is the failure this app is about.
  const sureBin = bins.find((b) => b.level === 'sure');
  const headline = sureBin && sureBin.reliable
    ? `When you said you were sure, you were right ${Math.round(sureBin.accuracy * 100)}% of the time (${sureBin.n} answers).`
    : `Not enough "sure" answers yet to say how reliable your certainty is (${sureBin ? sureBin.n : 0} so far).`;

  return { available: true, n: scored.length, brier, bins, overconfidence, headline, caveat };
}

/**
 * Attempts where the operator was CONFIDENT AND WRONG, most recent first.
 *
 * This is the highest-value signal in the entire system. A wrong answer given tentatively is a
 * known gap; a wrong answer given with certainty is a belief held firmly and incorrectly, which is
 * precisely what this application exists to correct. Practice should go here first.
 *
 * @param {object[]} attempts
 * @returns {object[]}
 */
export function miscalibrated(attempts) {
  return (attempts || [])
    .filter((a) => a && a.correct === false && a.confidence === 'sure')
    .sort((a, b) => b.ts - a.ts);
}

/**
 * Confusion matrix over recorded choices — the data that turns "you were wrong 60% of the
 * time" into "you read X as the answer N times, and N of those were wrong".
 *
 * Only attempts that carry a `chosen` option are included: a graded decision (SIFT stop/continue,
 * a self-grade) has no chosen option and is not a confusion. The correct option's text is not
 * stored on the record, so callers may supply `correctLabel(attempt)` to resolve it from the
 * item's content (itemId → correct option). Without it each row still reports the chosen option
 * and how often it was right or wrong.
 *
 * @param {object[]} attempts
 * @param {{correctLabel?: (a: object) => string|null}} [opts]
 * @returns {{n: number, byChoice: Array<{skillId: string, chosen: string, correctLabel: string|null, correct: number, wrong: number}>}}
 */
export function confusionMatrix(attempts, opts = {}) {
  const resolve = typeof opts.correctLabel === 'function' ? opts.correctLabel : () => null;
  const rows = new Map();
  let n = 0;
  for (const a of attempts || []) {
    if (!a || typeof a.chosen !== 'string' || !a.chosen) continue;
    n++;
    const label = resolve(a);
    const key = `${a.skillId}\u0000${a.chosen}\u0000${label === null ? '' : label}`;
    const row = rows.get(key) || {
      skillId: a.skillId,
      chosen: a.chosen,
      correctLabel: label === null ? null : String(label),
      correct: 0,
      wrong: 0
    };
    if (a.correct) row.correct++; else row.wrong++;
    rows.set(key, row);
  }
  // Most instructive first: the choice most often selected while wrong.
  const byChoice = [...rows.values()].sort((x, y) => (y.wrong - x.wrong) || (y.correct - x.correct));
  return { n, byChoice };
}

/**
 * One honest number for the whole practice history.
 *
 * The mean of estimate() across the skills the operator has actually attempted —
 * never across all skills, because an unattempted skill is UNKNOWN, not bad: folding the
 * cold-start prior (0.5) into an average would let the suite "score" the operator on
 * material they have never touched, which is exactly the fabricated-metrics failure this
 * application exists to end. Every other consumer of estimateAll() already scopes to
 * attempted skills; this is the same rule applied to the headline number.
 *
 * The result is measured, not simulated — but it is an ESTIMATE over a decay-weighted
 * sample of self-graded practice, so it travels with its caveats: the skill count and
 * attempt count ride along as data, and the UI renders them next to the percentage
 * (e.g. "61% RESILIENT (n=214, 12 skills)"). No attempts at all is a distinct, stated
 * state: { available: false, value: null, reason: 'no attempts recorded' } — callers
 * render "UNMEASURED", never 0.5 and never 50.
 *
 * Held-out attempts are excluded by default, matching estimate(): the transfer probes
 * measure the operator, they do not inflate the headline.
 *
 * @param {object[]} attempts
 * @param {{id: string}[]} skills - the skill catalogue; attempts on unlisted skillIds are ignored
 * @param {{now?: number, includeHeldOut?: boolean}} [opts]
 * @returns {{available: boolean, value: number|null, n: number, skills: number,
 *            skillsAttempted: number, reason: string}}
 */
export function estimateAggregate(attempts, skills, opts = {}) {
  const known = new Set((skills || []).map((s) => s.id));
  const relevant = (attempts || []).filter(
    (a) => a && known.has(a.skillId) && (opts.includeHeldOut === true || a.heldOut !== true)
  );

  if (!relevant.length) {
    return { available: false, value: null, n: 0, skills: (skills || []).length, skillsAttempted: 0, reason: 'no attempts recorded' };
  }

  const touched = new Set(relevant.map((a) => a.skillId));
  const bySkill = estimateAll(relevant, [...touched].map((id) => ({ id })), opts);

  let sum = 0;
  for (const id of touched) sum += bySkill.get(id).mastery;

  return {
    available: true,
    value: sum / touched.size,
    n: relevant.length,
    skills: (skills || []).length,
    skillsAttempted: touched.size,
    reason: 'mean mastery over attempted skills, held-out probes excluded'
  };
}

/**
 * The span of the operator's real practice history, in whole days.
 *
 * "Day 0" is the first recorded attempt — the operator's actual epoch, not a hardcoded
 * project date. Attempts on skills absent from the catalogue are ignored, matching
 * estimateAggregate(). No history is a distinct state: { available: false, days: null }.
 *
 * @param {object[]} attempts
 * @param {{id: string}[]} skills - catalogue; unknown skillIds are excluded
 * @param {{now?: number}} [opts]
 * @returns {{available: boolean, days: number|null, firstAttemptAt: number|null, n: number}}
 */
export function practiceDaySpan(attempts, skills, opts = {}) {
  const known = new Set((skills || []).map((s) => s.id));
  const relevant = (attempts || []).filter((a) => a && known.has(a.skillId));
  if (!relevant.length) {
    return { available: false, days: null, firstAttemptAt: null, n: 0 };
  }
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  const firstAttemptAt = relevant.reduce((min, a) => Math.min(min, a.ts), Infinity);
  const days = Math.max(0, Math.floor((now - firstAttemptAt) / DAY_MS));
  return { available: true, days, firstAttemptAt, n: relevant.length };
}

/**
 * Which skills are unlocked, given prerequisites and a mastery threshold.
 * Used by Phase 3's progressive disclosure. Locks are advisory, never enforced.
 *
 * @param {{id: string, prerequisites: string[]}[]} skills
 * @param {Map<string, object>} masteryMap
 * @param {{threshold?: number, minConfidence?: number}} [opts]
 * @returns {Map<string, {unlocked: boolean, blockedBy: string[]}>}
 */
export function gates(skills, masteryMap, opts = {}) {
  const threshold = Number.isFinite(opts.threshold) ? opts.threshold : 0.6;
  const minConfidence = Number.isFinite(opts.minConfidence) ? opts.minConfidence : 0.3;
  const out = new Map();
  for (const s of skills || []) {
    const blockedBy = [];
    for (const p of s.prerequisites || []) {
      const m = masteryMap.get(p);
      const met = m && m.mastery >= threshold && m.confidence >= minConfidence;
      if (!met) blockedBy.push(p);
    }
    out.set(s.id, { unlocked: blockedBy.length === 0, blockedBy });
  }
  return out;
}

export default {
  estimate, estimateAll, rank, transfer, calibration, miscalibrated, confusionMatrix, gates,
  estimateAggregate, practiceDaySpan,
  DECAY, CONFIDENCE_K, CONFIDENCE_LEVELS, MISCALIBRATION_BOOST, TRANSFER_CLUSTERS
};
