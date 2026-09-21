/**
 * SOVEREIGN // AEGIS — Mission Chain Panel (pure)
 *
 * Renders the mission panel on the Overview. Four visual states:
 *   1. No active mission — shows the mission catalog with "Start" buttons
 *   2. In progress — breadcrumb trail, current stage highlighted, "Continue →" button
 *   3. Mission complete — summary with DISARM tags covered, "Start Next →" options
 *   4. No attempts yet — a nudge to start
 *
 * All routing uses `data-aegis-action="start-mission"` / `data-aegis-action="continue-mission"`
 * with the mission ID and stage index as data attributes. The delegated click handler in app.js
 * resolves these — no inline onclick, no CSP violations.
 *
 * Pure: takes data, returns HTML. Every interpolated string passes through esc().
 *
 * @module missionPanel
 */

import { esc } from './security.js';

/**
 * Render the mission panel for the Overview.
 *
 * @param {object} opts
 * @param {object[]} opts.missions          — full missions catalogue
 * @param {object|null} opts.activeMission  — the active mission object or null
 * @param {object|null} opts.currentStage   — { stage, index, done } from currentStage()
 * @param {object|null} opts.progress       — { completed, total, done } from stageProgress()
 * @param {boolean} opts.hasAttempts        — whether any attempt log records exist
 * @returns {string} escaped HTML
 */
export function missionPanel(opts = {}) {
  const { missions = [], activeMission: active, currentStage: cur, progress: prog, hasAttempts } = opts;

  // ── State 1: No mission active, show catalogue ──
  if (!active) {
    return renderCatalogue(missions, hasAttempts);
  }

  // ── State 2: Mission active, in progress ──
  if (!cur || !cur.done) {
    return renderInProgress(active, cur, prog);
  }

  // ── State 3: Mission complete ──
  return renderComplete(active, missions);
}

/* ────────────────────────────────────── catalogue ──────────────────────────────── */

function renderCatalogue(missions, hasAttempts) {
  if (!Array.isArray(missions) || !missions.length) return '';

  const cards = missions.map((m) =>
    `<div class="card card-granite-inset" style="flex:1;min-width:220px;padding:16px 18px;display:flex;flex-direction:column;justify-content:space-between;gap:12px;">
      <div>
        <span class="badge badge-bronze" style="font-size:0.65rem;margin-bottom:6px;display:inline-block;">${esc(m.badge || 'MISSION')}</span>
        <div style="font-weight:700;font-size:0.9rem;color:var(--parchment-bright,#ece7de);margin-top:4px;">${esc(m.title)}</div>
        <div style="font-size:0.72rem;color:var(--stone-muted,#8b8f99);margin-top:4px;line-height:1.4;">${esc(m.description)}</div>
        <div style="margin-top:8px;font-size:0.68rem;color:var(--stone-warm,#a8a29e);">${m.stages ? m.stages.length : 0} stages</div>
      </div>
      <button class="btn btn-primary btn-sm"
              data-aegis-action="start-mission"
              data-aegis-mission="${esc(m.id)}"
              style="width:100%;justify-content:center;">
        Start Mission →
      </button>
    </div>`
  ).join('');

  const nudge = !hasAttempts
    ? `<p style="font-size:0.74rem;color:var(--stone-warm,#a8a29e);margin:8px 0 0 0;font-style:italic;">
         Missions guide you through all four pillars — start with VERDAD analysis, then drill, review, and defend.
       </p>`
    : '';

  return `<div class="card card-bronze card-granite-inset" style="padding:14px 16px;margin-bottom:var(--space-6,24px);border-left:4px solid var(--bronze-primary,#d2a64d);">
    <div class="status-label" style="color:var(--bronze-primary,#d2a64d);margin-bottom:10px;">MISSION CHAINS — GUIDED TRAINING</div>
    <div style="display:flex;flex-wrap:wrap;gap:12px;">
      ${cards}
    </div>
    ${nudge}
  </div>`;
}

/* ──────────────────────────────────── in progress ──────────────────────────────── */

function renderInProgress(mission, cur, prog) {
  const pct = prog && prog.total ? Math.round((prog.completed / prog.total) * 100) : 0;
  const stageEl = cur && cur.stage;
  const stageIndex = cur ? cur.index : 0;

  // Breadcrumb trail
  const breadcrumbs = (mission.stages || []).map((s, i) => {
    if (i < stageIndex) {
      return `<span style="font-size:0.72rem;color:var(--veracity-green,#34d399);">✓ ${esc(s.label)}</span>`;
    }
    if (i === stageIndex) {
      return `<span style="font-size:0.72rem;color:var(--bronze-bright,#d2a64d);font-weight:700;">→ ${esc(s.label)}</span>`;
    }
    return `<span style="font-size:0.72rem;color:var(--stone-muted,#8b8f99);">· ${esc(s.label)}</span>`;
  }).join(' <span style="color:var(--stone-muted);">▸</span> ');

  return `<div class="card card-bronze card-granite-inset" style="padding:14px 16px;margin-bottom:var(--space-6,24px);border-left:4px solid var(--bronze-primary,#d2a64d);">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
      <div>
        <div class="status-label" style="color:var(--bronze-primary,#d2a64d);">ACTIVE MISSION</div>
        <div class="heading-4" style="color:var(--parchment-bright,#ece7de);margin:4px 0 0 0;font-size:1rem;">${esc(mission.title)}</div>
      </div>
      <div style="font-family:var(--font-mono,monospace);font-size:0.78rem;color:var(--bronze-bright,#d2a64d);">${pct}% · Stage ${stageIndex + 1}/${mission.stages.length}</div>
    </div>

    <!-- Progress bar -->
    <div style="height:4px;background:var(--bg-surface-inset,#1a1e2b);border-radius:2px;margin:12px 0;overflow:hidden;">
      <div style="height:100%;width:${pct}%;background:var(--bronze-primary,#d2a64d);border-radius:2px;transition:width 0.3s ease;"></div>
    </div>

    <!-- Breadcrumbs -->
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;margin-bottom:12px;">
      ${breadcrumbs}
    </div>

    <!-- Current stage detail -->
    ${stageEl ? `<div style="font-size:0.78rem;color:var(--stone-light,#c4bfb5);margin-bottom:12px;line-height:1.5;">${esc(stageEl.description)}</div>` : ''}

    <button class="btn btn-primary"
            data-aegis-action="continue-mission"
            data-aegis-mission="${esc(mission.id)}"
            style="width:100%;justify-content:center;">
      ${stageEl ? `Continue to: ${esc(stageEl.label)} →` : 'Continue →'}
    </button>
  </div>`;
}

/* ─────────────────────────────────── complete ──────────────────────────────────── */

function renderComplete(mission, missions) {
  const tags = Array.isArray(mission.disarmTags) ? mission.disarmTags.join(', ') : '';

  // Find next mission not yet completed (simple: just pick the next in the list)
  const remaining = missions.filter(
    (m) => m.id !== (mission && mission.id)
  );
  const nextMission = remaining.length ? remaining[0] : null;

  return `<div class="card card-emerald card-granite-inset" style="padding:14px 16px;margin-bottom:var(--space-6,24px);border-left:4px solid var(--veracity-green,#34d399);">
    <div class="status-label" style="color:var(--veracity-green,#34d399);">MISSION COMPLETE ✓</div>
    <div style="font-weight:700;font-size:1rem;color:var(--parchment-bright,#ece7de);margin:6px 0;">${esc(mission ? mission.title : '')}</div>
    <div style="font-size:0.74rem;color:var(--stone-warm,#a8a29e);margin-bottom:10px;">
      All ${mission && mission.stages ? mission.stages.length : 0} stages completed${tags ? ' · DISARM: ' + esc(tags) : ''}.
    </div>
    ${nextMission ? `
      <button class="btn btn-primary btn-sm"
              data-aegis-action="start-mission"
              data-aegis-mission="${esc(nextMission.id)}"
              style="width:100%;justify-content:center;">
        Start Next Mission: ${esc(nextMission.title)} →
      </button>
    ` : `
      <div style="font-size:0.74rem;color:var(--veracity-green,#34d399);">All missions completed. New missions will appear here as they are added.</div>
    `}
  </div>`;
}

export default { missionPanel };