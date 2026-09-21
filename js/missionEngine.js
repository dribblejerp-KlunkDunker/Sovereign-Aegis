/**
 * SOVEREIGN // AEGIS — Mission Chain Engine (pure)
 *
 * Determines mission stage progression from the raw attempt log. Every function
 * here is pure: it takes data and returns computed values. No DOM, no storage.
 *
 * Missions are defined in data/missions.json. Each mission has stages. Each
 * stage has a completion criterion — a context string and a minimum record
 * count. Completion is detected by counting records in the attempt log with
 * that context that occurred after the mission started.
 *
 * The active mission and start time are stored in the StateStore under keys
 * `missions.activeId` and `missions.startedAt`. When no mission is active,
 * this module returns null / empty / 'none'.
 *
 * @module missionEngine
 */

/**
 * @param {object[]} missions - parsed missions.json
 * @param {string|null} activeId - current active mission id or null
 * @returns {object|null} the active mission object or null
 */
export function activeMission(missions, activeId) {
  if (!activeId || !Array.isArray(missions)) return null;
  return missions.find((m) => m.id === activeId) || null;
}

/**
 * Count attempts with a given context that occurred after a timestamp.
 * @param {object[]} attempts - raw attempt log
 * @param {string} context - e.g. 'arena', 'sm2', 'verdad'
 * @param {number} since - epoch ms timestamp
 * @returns {number}
 */
function countContextSince(attempts, context, since) {
  if (!Array.isArray(attempts)) return 0;
  return attempts.filter(
    (a) => a && a.context === context && a.ts >= since
  ).length;
}

/**
 * Is a single stage complete?
 * @param {object} stage - mission stage with completion criterion
 * @param {object[]} attempts - raw attempt log
 * @param {number} since - epoch ms timestamp (mission started at)
 * @returns {boolean}
 */
export function isStageComplete(stage, attempts, since) {
  if (!stage || !stage.completion) return true;
  const ctx = stage.completion.context;
  const min = stage.completion.minRecords || 1;
  return countContextSince(attempts, ctx, since) >= min;
}

/**
 * Get the current stage (the first incomplete one) and its index.
 * Returns null stage and the first incomplete index. If all stages are
 * complete, returns { stage: null, index: length, done: true }.
 *
 * @param {object} mission - mission with stages array
 * @param {object[]} attempts
 * @param {number} since
 * @returns {{ stage: object|null, index: number, done: boolean }}
 */
export function currentStage(mission, attempts, since) {
  if (!mission || !Array.isArray(mission.stages)) {
    return { stage: null, index: -1, done: true };
  }
  for (let i = 0; i < mission.stages.length; i++) {
    if (!isStageComplete(mission.stages[i], attempts, since)) {
      return { stage: mission.stages[i], index: i, done: false };
    }
  }
  return { stage: null, index: mission.stages.length, done: true };
}

/**
 * Get the next stage after the current (first incomplete, already the
 * current stage itself if it's incomplete).
 * @param {object} mission
 * @param {object[]} attempts
 * @param {number} since
 * @returns {object|null}
 */
export function nextStage(mission, attempts, since) {
  const cur = currentStage(mission, attempts, since);
  return cur.done ? null : cur.stage;
}

/**
 * Progress summary: stages completed so far, total, and the next action.
 * @param {object} mission
 * @param {object[]} attempts
 * @param {number} since
 * @returns {{ completed: number, total: number, done: boolean, currentLabel: string|null }}
 */
export function stageProgress(mission, attempts, since) {
  const cur = currentStage(mission, attempts, since);
  if (!mission || !Array.isArray(mission.stages)) {
    return { completed: 0, total: 0, done: true, currentLabel: null };
  }
  return {
    completed: cur.index,
    total: mission.stages.length,
    done: cur.done,
    currentLabel: cur.stage ? cur.stage.label : null
  };
}