/**
 * SOVEREIGN // AEGIS — Personal Defense Profile (pure scoring)
 *
 * WHY THIS MODULE DOES NO I/O
 * ---------------------------
 * Same load-bearing decision as js/competency.js: every function here takes its data as an
 * argument and returns values. It never reads storage, never fetches. That makes every
 * scoring claim testable against synthetic responses of known value — the difference between
 * a scoring rule that works and one that merely looks plausible.
 *
 * WHAT THIS MODULE WILL NOT COMPUTE, AND WHY
 * ------------------------------------------
 * No aggregate score. No percentile. No "type". No manipulability index. The moment a single
 * number summarises this profile, it will be read as "how manipulable am I", and neither the
 * dimensional research nor the technique-recognition research licenses that reading. Levels
 * are bands with explicit tie rules, the watchpoint layer is about SITUATIONS rather than
 * identity, and buildGuide returns its own evidence note so the honest qualifier travels
 * with the output (house precedent: Competency.transfer).
 *
 * THE ONLY ALGORITHM HERE IS COUNTED, NOT WEIGHTED
 * ------------------------------------------------
 * Salience (which watchpoints rise to the top) is two integer comparisons:
 *   (1) the context mini-check averages >= MINI_SALIENCE (3.5) on the latest retake, AND
 *   (2) supporting observations: (recent favorable-minus-unfavorable count >= 2)
 *       OR (any observation with resisted === false inside OBSERVATION_WINDOW days).
 * A disconfirming observation (resisted === true, confidence >= 2) subtracts one count.
 * Every input is auditable from the UI; nothing is hidden in a weight.
 *
 * @module profile
 */

/** Mean coded value above which a lens reads "more pronounced in this reflection". */
export const LENS_BAND_HIGH = 3.5;
/** Mean coded value below which a lens reads "less pronounced in this reflection". */
export const LENS_BAND_LOW = 2.5;
/** Context mini-check mean at or above which a pressure context is self-reported as active. */
export const MINI_SALIENCE = 3.5;
/** Observations newer than this many days are counted as recent evidence. */
export const OBSERVATION_WINDOW_DAYS = 30;
/** Supporting recent observations needed (net of disconfirming) to promote a watchpoint. */
export const SALIENCE_MIN_COUNT = 2;
/** Per-answer confidence >= this counts as a confident statement. */
export const CONFIDENT_ANSWER = 2;
/** Minimum observations needed before ANY watchpoint is promoted. */
export const SALIENCE_MIN_OBSERVATIONS = 1;

const DAY_MS = 86400000;

/**
 * Apply an item's reverse-coding. `record: -1` items are worded so agreement marks the
 * vulnerability direction; flip them. Anything that is not an integer 1..5 returns null —
 * including numeric strings, which a corrupt record could smuggle in and a silent Number()
 * would happily score — and null never averages: an unanswered item is not a midpoint
 * answer, and a malformed one is not an answer at all.
 * @param {{record?: number}} item
 * @param {*} value
 * @returns {number|null}
 */
export function applyRecord(item, value) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) return null;
  return item && item.record === -1 ? 6 - value : value;
}

/**
 * Score one retake's responses into lens bands and context levels.
 *
 * Zero responses is a valid, well-defined state: every lens reads `level: null, n: 0` —
 * "unknown", never "bad" (house precedent: competency.estimate cold start).
 *
 * @param {object[]} responses - records from ProfileStore (itemIds from the latest retake,
 *                                or any subset; unrecognised itemIds are ignored)
 * @param {object[]} items      - data/profile-items.json items
 * @returns {Map<string, {level: 'less'|'mixed'|'more'|null, n: number, mean: number|null}>}
 */
export function compute(responses, items) {
  const byLens = new Map();
  for (const item of items || []) {
    if (!item || !item.lens || !item.id) continue;
    if (!byLens.has(item.lens)) byLens.set(item.lens, []);
    byLens.get(item.lens).push(item);
  }

  const byItem = new Map((responses || []).map((r) => [r && r.itemId, r]));

  const out = new Map();
  for (const [lens, lensItems] of byLens) {
    let sum = 0;
    let n = 0;
    for (const item of lensItems) {
      const r = byItem.get(item.id);
      if (!r || r.value === null || r.value === undefined) continue;
      const coded = applyRecord(item, r.value);
      if (coded === null) continue;
      sum += coded;
      n++;
    }
    const mean = n ? sum / n : null;
    let level = null;
    if (n > 0) {
      if (mean > LENS_BAND_HIGH) level = 'more';
      else if (mean < LENS_BAND_LOW) level = 'less';
      else level = 'mixed';
    }
    out.set(lens, { level, n, mean });
  }
  return out;
}

/**
 * Latest retake number present in a response set.
 * @param {object[]} responses
 * @returns {number|null}
 */
export function latestRetake(responses) {
  let max = null;
  for (const r of responses || []) {
    const k = Number(r && r.retake);
    if (Number.isFinite(k) && (max === null || k > max)) max = k;
  }
  return max;
}

/**
 * Salience inputs for one pressure context.
 *
 * @param {string} context          e.g. 'urgency'
 * @param {object[]} responses      all responses (any retake)
 * @param {object[]} observations   all observations
 * @param {object[]} items          inventory items
 * @param {{now?: number}} [opts]
 * @returns {{
 *   miniAvg: number|null,
 *   domains: string[],      // life domains marked on the mini answers that cleared the bar
 *   miniAnswered: number,
 *   recentCount: number,
 *   disconfirmCount: number,
 *   unfavorableCount: number,
 *   netCount: number,
 *   totalObservations: number,
 *   salient: boolean,
 *   reason: string
 * }}
 */
export function salience(context, responses, observations, items, opts = {}) {
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  const byItem = new Map((responses || []).map((r) => [r && r.itemId, r]));

  const miniItems = (items || []).filter((it) => it && it.lens === `ctx-${context}`);
  let sum = 0;
  let answered = 0;
  // Life domains the operator marked on the mini-check answers that cleared the salience
  // bar — read from the response's recorded scope marks (what the checkboxes captured),
  // never from the item's full offer vocabulary and never inferred. An answer without
  // marks contributes none, so an event-only watchpoint claims no domains.
  const domains = [];
  for (const item of miniItems) {
    const r = byItem.get(item.id);
    if (!r) continue;
    const coded = applyRecord(item, r.value);
    if (coded === null) continue;
    sum += coded;
    answered++;
    if (coded >= MINI_SALIENCE && Array.isArray(r.scope)) {
      for (const d of r.scope) if (typeof d === 'string' && !domains.includes(d)) domains.push(d);
    }
  }
  const miniAvg = answered ? sum / answered : null;

  const windowMs = OBSERVATION_WINDOW_DAYS * DAY_MS;
  const recent = (observations || []).filter(
    (o) => o && o.contextTag === context && Number.isFinite(o.ts) && now - o.ts <= windowMs
  );

  // Favorable outcomes count toward salience; a resisted one counts against it — but only
  // when the user was confident enough in the record for the disconfirmation to carry weight.
  const favorable = recent.filter((o) => o.resisted !== false);
  const disconfirm = recent.filter(
    (o) => o.resisted === true && Number(o.confidence) >= CONFIDENT_ANSWER
  );
  const unfavorable = recent.filter((o) => o.resisted === false);

  const netCount = favorable.length - disconfirm.length;
  const salient =
    miniAvg !== null &&
    miniAvg >= MINI_SALIENCE &&
    recent.length >= SALIENCE_MIN_OBSERVATIONS &&
    (netCount >= SALIENCE_MIN_COUNT || unfavorable.length >= 1);

  const reasons = [];
  if (miniAvg === null) reasons.push('context mini-check unanswered');
  else if (miniAvg < MINI_SALIENCE) reasons.push(`mini-check mean ${miniAvg.toFixed(1)} < ${MINI_SALIENCE}`);
  if (recent.length < SALIENCE_MIN_OBSERVATIONS) reasons.push('no observations logged in window');
  if (netCount < SALIENCE_MIN_COUNT && unfavorable.length < 1) {
    reasons.push(`net supporting observations ${netCount} < ${SALIENCE_MIN_COUNT} and no resisted:false`);
  }

  return {
    miniAvg,
    domains,
    miniAnswered: answered,
    recentCount: recent.length,
    disconfirmCount: disconfirm.length,
    unfavorableCount: unfavorable.length,
    netCount,
    totalObservations: (observations || []).filter((o) => o && o.contextTag === context).length,
    salient,
    reason: reasons.length ? reasons.join('; ') : 'mini-check active and observations support it'
  };
}

/**
 * Build the practice map: assets, watchpoints, countermeasures, routes, prompts, evidence note.
 *
 * Routes reference skillIds owned by the competency spine; the caller is expected to have
 * validated them against data/skills.json (the test suite enforces this at build time, so the
 * map cannot rot when skills are re-tagged).
 *
 * @param {object[]} responses
 * @param {Map<string, {level: string|null, n: number, mean: number|null}>} levelMap - from compute()
 * @param {object[]} observations
 * @param {{lensAssets: object, contexts: object, disconfirmationPrompt: string, evidenceNote: string}} guides
 * @param {{id: string}[]} skills - data/skills.json, for label lookup only
 * @param {{now?: number, repeated?: boolean, items?: object[]}} [opts]
 *        opts.items (data/profile-items.json) is required for the watchpoint layer: the
 *        context mini-check needs the inventory to know which items belong to which context.
 * @returns {{assets: object[], watchpoints: object[], countermeasures: object[], routes: object[],
 *            disconfirmation: string, evidenceNote: string}}
 *          watchpoints entries: {context, label, salience, evidence, domains, text}
 */
export function buildGuide(responses, levelMap, observations, guides, skills, opts = {}) {
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  const repeated = opts.repeated === true;
  const skillLabel = (id) => {
    const s = (skills || []).find((x) => x && x.id === id);
    return s ? s.label || s.id : id;
  };

  // ---------- assets: per-lens copy for the band the user actually landed in
  const assets = [];
  if (guides && guides.lensAssets) {
    for (const [lens, copies] of Object.entries(guides.lensAssets)) {
      const level = levelMap.get(lens);
      if (!level || level.level !== 'more') continue;
      for (const text of copies) assets.push({ lens, text });
    }
  }

  // ---------- watchpoints: self-reported context + observation evidence, or high mini-check alone
  const watchpoints = [];
  const countermeasures = [];
  const routes = [];
  const contexts = (guides && guides.contexts) || {};

  for (const [context, guide] of Object.entries(contexts)) {
    const s = salience(context, responses, observations, opts.items || [], { now });
    // A context is shown when either signal fires: self-report (mini-check active) or
    // lived evidence (an unfavorable event inside the window). Both absent → not shown.
    const shown = (s.miniAvg !== null && s.miniAvg >= MINI_SALIENCE) || s.unfavorableCount >= 1;
    if (!shown) continue;

    const evidence = s.unfavorableCount >= 1
      ? 'logged event'
      : s.recentCount >= 1 ? 'mini-check + logged events' : 'mini-check only';

    watchpoints.push({
      context,
      label: guide.label || context,
      salience: s.salient ? 'promoted' : 'noted',
      evidence,
      domains: s.domains,
      text: guide.watchpoint
    });

    countermeasures.push({
      context,
      tacticFamily: guide.tacticFamily,
      plan: guide.countermeasure
    });

    routes.push({
      context,
      skillId: guide.routeSkillId,
      skillLabel: skillLabel(guide.routeSkillId)
    });
  }

  return {
    assets,
    watchpoints,
    countermeasures,
    routes,
    disconfirmation: (guides && guides.disconfirmationPrompt) || '',
    evidenceNote: (guides && guides.evidenceNote) || ''
  };
}

/**
 * High-risk disclosure check. Static keyword routing on the user's OWN text — no scoring,
 * no assessment of danger. Returns the support card when a coercive-control marker appears
 * in an observation, so the UI can offer human support instead of more drills.
 *
 * @param {object} observation
 * @param {{keywords?: string[]}} [supportCard] - from profile-guides.json
 * @returns {boolean}
 */
export function needsSupport(observation, supportCard) {
  if (!observation || !supportCard || !Array.isArray(supportCard.keywords)) return false;
  const haystack = [
    observation.initialReaction,
    observation.action,
    observation.outcome,
    observation.tactic
  ].filter((x) => typeof x === 'string').join(' ').toLowerCase();
  return supportCard.keywords.some((k) => typeof k === 'string' && haystack.includes(k.toLowerCase()));
}

export default {
  applyRecord, compute, latestRetake, salience, buildGuide, needsSupport,
  LENS_BAND_HIGH, LENS_BAND_LOW, MINI_SALIENCE, OBSERVATION_WINDOW_DAYS,
  SALIENCE_MIN_COUNT, CONFIDENT_ANSWER, SALIENCE_MIN_OBSERVATIONS
};
