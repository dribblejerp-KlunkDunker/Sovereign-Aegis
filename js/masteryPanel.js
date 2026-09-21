/**
 * SOVEREIGN // AEGIS — Competency spine panel (pure)
 *
 * This is the place the per-skill mastery number becomes VISIBLE. competency.js computes
 * it (estimate / estimateAll); this module renders it. Until now only calibration was
 * wired into the Overview, so a skill like `skill.sift.stop` — the one the messenger's
 * share gate tests in the real world — had a number but no surface.
 *
 * Pure: takes the estimateAll() Map (plus the skills and a messenger near-share count) and
 * returns markup. No DOM, no storage, no colour literals — theme tokens only, and every
 * interpolated string passes through esc() so nothing from skills.json or an attempt can
 * reach the DOM unescaped.
 *
 * @module masteryPanel
 */

import { esc } from './security.js';

/** The skill the messenger's pre-send gate exercises. Kept named so it can't drift. */
export const STOP_SKILL_ID = 'skill.sift.stop';

/** A colour for a mastery number, but only when there is evidence behind it. */
function masteryColour(e) {
  if (!e || e.confidence === 0) return 'var(--stone-muted, #8b8f99)';
  if (e.mastery < 0.4) return 'var(--disinfo-crimson, #f87171)';
  if (e.mastery < 0.6) return 'var(--suspicion-amber, #f59e0b)';
  return 'var(--veracity-green, #34d399)';
}

function trendText(e) {
  return (e && e.trend && e.trend !== 'unknown') ? e.trend : '·';
}

function pct(x) {
  return `${Math.round((Number.isFinite(x) ? x : 0) * 100)}%`;
}

/**
 * Render the whole spine.
 *
 * @param {Map<string, {mastery:number, confidence:number, n:number, trend:string}>} estimates
 * @param {{skills?: {id:string,label?:string,detail?:string}[], messengerNearShares?: number}} [opts]
 * @returns {string} escaped HTML
 */
export function masteryPanel(estimates, opts = {}) {
  const skills = Array.isArray(opts.skills) ? opts.skills : [];
  const nearShares = Number.isFinite(opts.messengerNearShares) ? opts.messengerNearShares : 0;

  const stop = estimates.get(STOP_SKILL_ID) || { mastery: 0.5, confidence: 0, n: 0, trend: 'unknown' };
  const stopLabel = (skills.find((s) => s.id === STOP_SKILL_ID) || {}).label || 'Stop before reacting';

  const rows = skills.map((s) => {
    const e = estimates.get(s.id) || { mastery: 0.5, confidence: 0, n: 0, trend: 'unknown' };
    const colour = masteryColour(e);
    return `<tr>
      <td style="padding:4px 8px;font-size:0.76rem;color:var(--stone-light,#d6d3d1);" title="${esc(s.detail || '')}">${esc(s.label || s.id)}</td>
      <td style="padding:4px 8px;font-size:0.76rem;color:${colour};font-family:var(--font-mono,monospace);text-align:right;">${pct(e.mastery)}</td>
      <td style="padding:4px 8px;font-size:0.76rem;color:var(--stone-warm,#a8a29e);font-family:var(--font-mono,monospace);text-align:right;">${e.n}</td>
      <td style="padding:4px 8px;font-size:0.76rem;color:var(--stone-warm,#a8a29e);font-family:var(--font-mono,monospace);text-align:right;">${pct(e.confidence)}</td>
      <td style="padding:4px 8px;font-size:0.72rem;color:var(--stone-muted,#8b8f99);text-align:right;">${esc(trendText(e))}</td>
    </tr>`;
  }).join('');

  const stopColour = masteryColour(stop);
  const nearSharesLine = nearShares > 0
    ? `<div style="margin-top:8px;font-size:0.72rem;color:var(--disinfo-crimson,#f87171);font-family:var(--font-mono,monospace);">
         MESSENGER NEAR-SHARES CAUGHT BY THE GATE: ${nearShares}
       </div>`
    : `<div style="margin-top:8px;font-size:0.72rem;color:var(--stone-muted,#8b8f99);font-family:var(--font-mono,monospace);">
         No messenger near-shares recorded yet.
       </div>`;

  return `
    <div class="card-granite-inset" style="padding:14px 16px;">
      <div class="status-label" style="color:var(--bronze-primary,#d2a64d);">COMPETENCY SPINE — MASTERY FROM YOUR LOCAL ATTEMPT LOG</div>

      <div style="margin-top:12px;padding:12px 14px;border:1px solid var(--border-subtle,#2c2e36);border-radius:6px;background:var(--bg-surface-inset,#12141a);">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;">
          <div>
            <div class="heading-4" style="color:var(--parchment-bright,#ece7de);margin:0;">${esc(stopLabel.toUpperCase())}</div>
            <div style="margin-top:4px;font-size:0.74rem;color:var(--stone-warm,#a8a29e);">The step the share gate tests: notice the pull, pause before sharing.</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:1.9rem;font-family:var(--font-sans,sans-serif);color:${stopColour};line-height:1;">${pct(stop.mastery)}</div>
            <div style="font-size:0.68rem;color:var(--stone-muted,#8b8f99);font-family:var(--font-mono,monospace);">MASTERY</div>
          </div>
        </div>
        <div style="margin-top:8px;display:flex;gap:18px;flex-wrap:wrap;font-size:0.72rem;color:var(--stone-warm,#a8a29e);font-family:var(--font-mono,monospace);">
          <span>CONFIDENCE ${pct(stop.confidence)}</span>
          <span>${stop.n} ATTEMPT${stop.n === 1 ? '' : 'S'}</span>
          <span>TREND ${esc(trendText(stop))}</span>
        </div>
        ${nearSharesLine}
      </div>

      <div style="margin-top:12px;max-height:280px;overflow-y:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="text-align:right;color:var(--stone-muted,#8b8f99);font-size:0.66rem;font-family:var(--font-mono,monospace);">
              <th style="text-align:left;padding:4px 8px;font-weight:600;">SKILL</th>
              <th style="padding:4px 8px;font-weight:600;">MASTERY</th>
              <th style="padding:4px 8px;font-weight:600;">N</th>
              <th style="padding:4px 8px;font-weight:600;">CONF</th>
              <th style="padding:4px 8px;font-weight:600;">TREND</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <p style="margin:10px 0 0 0;font-size:0.7rem;color:var(--stone-warm,#a8a29e);">
        Mastery is decay-weighted accuracy over your local log (0.5 = unknown, no evidence yet).
        It never syncs — the messenger's near-share misses land here only when the two apps share one origin.
      </p>
    </div>`;
}

export default { masteryPanel, STOP_SKILL_ID };
