/**
 * SOVEREIGN // AEGIS — Calibration panel (pure SVG builder)
 *
 * WHY A RELIABILITY DIAGRAM AND NOT A STREAK COUNTER
 * -------------------------------------------------
 * This is the payoff that makes P0's extra tap worth making, and it is the one progress artefact
 * in the application that is defensible. A streak says you kept showing up. A reliability diagram
 * says: when you claimed to be sure, here is how often you were right. That is a claim about the
 * operator that can be checked, and it is the specific claim this application exists to improve.
 *
 * WHAT IT REFUSES TO DO
 * --------------------
 * Draw a line through two data points and call it a curve. Below a threshold of rated answers the
 * panel reports that it cannot yet say anything, and thin bins are drawn hollow and excluded from
 * the fitted line. A confident-looking curve built from four answers would be worse than no panel:
 * it would be the application committing the error it teaches against.
 *
 * CHART DECISIONS, AND THE REASONS
 * --------------------------------
 * - ONE data series, so one hue. The curve is not coloured good/bad — status colours are reserved
 *   for status, and colouring the line by whether the operator looks good would encode a judgement
 *   the diagram is supposed to let them make for themselves.
 * - The diagonal is a REFERENCE, not a gridline, so it is dashed and labelled. Axes are solid
 *   hairlines one shade off the surface; there are no gridlines, so nothing else is dashed.
 * - Marker AREA encodes sample size, which puts "how much evidence" on the same mark as "what it
 *   says" — a thin bin looks thin instead of looking like a firm result.
 * - Direct-labelled selectively: only the "sure" bin, the claim with consequences. Every other
 *   number lives in the table beneath, which is also the accessible view.
 *
 * Pure: takes a calibration report and returns markup. No DOM, no storage, and no colour literals —
 * every colour is a CSS custom property, so the panel follows the app's theme rather than pinning
 * a second palette beside it.
 *
 * @module calibrationPanel
 */

import { esc } from './security.js';

/** Below this many confidence-rated answers, no curve is drawn at all. */
export const MIN_RATED = 12;

/** A bin with fewer than this many answers is drawn hollow and left out of the fitted line. */
export const MIN_BIN = 3;

const W = 320, H = 300;
const PAD = { top: 18, right: 18, bottom: 46, left: 46 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const px = (p) => PAD.left + p * PLOT_W;
const py = (p) => PAD.top + (1 - p) * PLOT_H;

/** Marker radius from sample size — area-proportional, floored so it stays hittable. */
function radiusFor(n, maxN) {
  const t = maxN > 0 ? Math.sqrt(n / maxN) : 0;
  return 5 + t * 4; // 10–18px diameter, above the 8px minimum
}

/**
 * Build the reliability diagram.
 * @param {object} report - output of Competency.calibration()
 * @returns {string} SVG markup, or '' when there is nothing honest to draw
 */
export function reliabilitySvg(report) {
  if (!report || !report.available || report.n < MIN_RATED) return '';
  const bins = [...report.bins].sort((a, b) => a.claimed - b.claimed);
  const maxN = Math.max(...bins.map((b) => b.n), 1);
  const plotted = bins.filter((b) => b.accuracy !== null);
  const solid = plotted.filter((b) => b.n >= MIN_BIN);

  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const axisTicks = ticks.map((t) => `
    <text x="${px(t).toFixed(1)}" y="${(H - PAD.bottom + 16).toFixed(1)}" text-anchor="middle"
          font-size="9" fill="var(--stone-warm)" font-family="var(--font-mono)">${Math.round(t * 100)}</text>
    <text x="${(PAD.left - 8).toFixed(1)}" y="${(py(t) + 3).toFixed(1)}" text-anchor="end"
          font-size="9" fill="var(--stone-warm)" font-family="var(--font-mono)">${Math.round(t * 100)}</text>
  `).join('');

  // Fitted line through the reliable bins only. Two points make a segment, not a curve; one makes
  // nothing — in both cases the markers still stand on their own.
  const line = solid.length >= 2
    ? `<polyline points="${solid.map((b) => `${px(b.claimed).toFixed(1)},${py(b.accuracy).toFixed(1)}`).join(' ')}"
                 fill="none" stroke="var(--bronze-primary)" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" />`
    : '';

  const marks = plotted.map((b) => {
    const r = radiusFor(b.n, maxN);
    const reliable = b.n >= MIN_BIN;
    return `
      <circle cx="${px(b.claimed).toFixed(1)}" cy="${py(b.accuracy).toFixed(1)}" r="${(r + 2).toFixed(1)}"
              fill="var(--bg-surface-inset)" />
      <circle cx="${px(b.claimed).toFixed(1)}" cy="${py(b.accuracy).toFixed(1)}" r="${r.toFixed(1)}"
              fill="${reliable ? 'var(--bronze-primary)' : 'none'}"
              stroke="var(--bronze-primary)" stroke-width="2"
              ${reliable ? '' : 'stroke-dasharray="3 3"'}>
        <title>${esc(b.level)}: claimed ${Math.round(b.claimed * 100)}%, actually right ${Math.round(b.accuracy * 100)}% of the time over ${esc(b.n)} answers${reliable ? '' : ' — too few to rely on'}</title>
      </circle>`;
  }).join('');

  // One direct label: the "sure" bin. Every other value is in the table below.
  const sure = plotted.find((b) => b.level === 'sure');
  const sureLabel = sure ? `
    <text x="${(px(sure.claimed) - 14).toFixed(1)}" y="${(py(sure.accuracy) - 13).toFixed(1)}"
          text-anchor="end" font-size="10" font-family="var(--font-mono)" fill="var(--parchment-bright)">
      ${Math.round(sure.accuracy * 100)}% when sure
    </text>` : '';

  return `
    <!-- width + viewBox alone give the correct responsive height (aspect ratio);
         the removed height attribute was an invalid SVG length that logged a
         console error on every boot -->
    <svg viewBox="0 0 ${W} ${H}" width="100%" role="img"
         aria-label="Reliability diagram: stated confidence against observed accuracy. The table beside it carries every value."
         style="max-width:${W}px;display:block;margin:0 auto;">
      <!-- Reference: perfect calibration. Dashed because it is a threshold, not a gridline. -->
      <line x1="${px(0)}" y1="${py(0)}" x2="${px(1)}" y2="${py(1)}"
            stroke="var(--stone-warm)" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.7" />
      <text x="${px(0.98).toFixed(1)}" y="${(py(0.98) + 15).toFixed(1)}" text-anchor="end"
            font-size="9" font-family="var(--font-mono)" fill="var(--stone-warm)">PERFECTLY CALIBRATED</text>

      <!-- Axes: solid hairlines, one shade off the surface. No gridlines. -->
      <line x1="${px(0)}" y1="${py(0)}" x2="${px(1)}" y2="${py(0)}" stroke="var(--border-subtle)" stroke-width="1" />
      <line x1="${px(0)}" y1="${py(0)}" x2="${px(0)}" y2="${py(1)}" stroke="var(--border-subtle)" stroke-width="1" />
      ${axisTicks}
      <text x="${(PAD.left + PLOT_W / 2).toFixed(1)}" y="${(H - 6).toFixed(1)}" text-anchor="middle"
            font-size="9" font-family="var(--font-mono)" fill="var(--stone-warm)"
            letter-spacing="0.08em">CONFIDENCE YOU CLAIMED (%)</text>
      <text transform="translate(12,${(PAD.top + PLOT_H / 2).toFixed(1)}) rotate(-90)" text-anchor="middle"
            font-size="9" font-family="var(--font-mono)" fill="var(--stone-warm)"
            letter-spacing="0.08em">HOW OFTEN RIGHT (%)</text>

      ${line}
      ${marks}
      ${sureLabel}
    </svg>`;
}

/**
 * The accessible table. Present always, not a fallback — every number in the diagram is here,
 * because a value reachable only inside a chart is a value some readers cannot reach.
 * @param {object} report
 * @returns {string}
 */
export function reliabilityTable(report) {
  if (!report || !report.bins || !report.bins.length) return '';
  const gapColour = (g) => g === null ? 'var(--stone-warm)'
    : g > 0.1 ? 'var(--disinfo-crimson)' : g < -0.1 ? 'var(--intel-cyan)' : 'var(--veracity-green)';
  const rows = report.bins.map((b) => `
    <tr>
      <td style="padding:5px 8px;font-family:var(--font-mono);color:var(--parchment-bright);">${esc(b.level.toUpperCase())}</td>
      <td style="padding:5px 8px;text-align:right;font-variant-numeric:tabular-nums;">${Math.round(b.claimed * 100)}%</td>
      <td style="padding:5px 8px;text-align:right;font-variant-numeric:tabular-nums;">${b.accuracy === null ? '—' : Math.round(b.accuracy * 100) + '%'}</td>
      <td style="padding:5px 8px;text-align:right;font-variant-numeric:tabular-nums;">${esc(b.n)}</td>
      <td style="padding:5px 8px;text-align:right;font-variant-numeric:tabular-nums;color:${esc(gapColour(b.gap))};">
        ${b.gap === null ? '—' : (b.gap > 0 ? '+' : '') + Math.round(b.gap * 100)}
      </td>
      <td style="padding:5px 8px;font-size:0.72rem;color:var(--stone-warm);">${esc(b.reliable ? '' : 'too few')}</td>
    </tr>`).join('');
  return `
    <table style="width:100%;border-collapse:collapse;font-size:0.78rem;color:var(--parchment-secondary);">
      <caption style="text-align:left;padding-bottom:6px;" class="status-label text-bronze">RELIABILITY BY STATED CONFIDENCE</caption>
      <thead>
        <tr style="border-bottom:1px solid var(--border-subtle);">
          <th style="padding:5px 8px;text-align:left;font-weight:600;">You said</th>
          <th style="padding:5px 8px;text-align:right;font-weight:600;">Claimed</th>
          <th style="padding:5px 8px;text-align:right;font-weight:600;">Actual</th>
          <th style="padding:5px 8px;text-align:right;font-weight:600;">n</th>
          <th style="padding:5px 8px;text-align:right;font-weight:600;">Gap</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/**
 * The whole panel: headline, diagram, table, caveat — or an honest refusal.
 * @param {object} report - output of Competency.calibration()
 * @returns {string}
 */
export function calibrationPanel(report) {
  const enough = report && report.available && report.n >= MIN_RATED;

  if (!enough) {
    const have = report && report.n ? report.n : 0;
    return `
      <div class="card">
        <div class="card-header"><h3 class="card-title">Calibration</h3></div>
        <p class="body-muted" style="margin:0;">
          ${esc(have)} of ${esc(MIN_RATED)} confidence-rated answers so far. A reliability curve drawn from
          fewer would look firm and mean nothing — which is the error this panel exists to detect, so
          it is not one to commit here.
        </p>
      </div>`;
  }

  // Hero figure in the sans face with proportional figures — tabular-nums belongs in the table.
  const over = report.overconfidence;
  const direction = over > 0.05 ? 'OVERCONFIDENT' : over < -0.05 ? 'UNDERCONFIDENT' : 'WELL CALIBRATED';
  return `
    <div class="card card-bronze">
      <div class="card-header">
        <h3 class="card-title">Calibration</h3>
        <span class="badge badge-bronze">${esc(report.n)} RATED ANSWERS</span>
      </div>
      <p class="body-lead" style="margin-bottom:var(--space-3);">${esc(report.headline)}</p>
      <div class="grid-split-2-1" style="gap:var(--space-4);align-items:start;">
        <div>${reliabilitySvg(report)}</div>
        <div>
          <div class="metric-card" style="margin-bottom:var(--space-3);">
            <span class="metric-label">Calibration</span>
            <span class="metric-value" style="font-family:var(--font-sans);">${esc(direction)}</span>
            <span class="metric-subtext">Brier ${esc(report.brier.toFixed(3))} · lower is better · 0.250 is what claiming 50% on everything scores</span>
          </div>
          ${reliabilityTable(report)}
        </div>
      </div>
      <p class="body-muted" style="margin:var(--space-4) 0 0;font-size:0.78rem;">${esc(report.caveat)}</p>
    </div>`;
}

export default { calibrationPanel, reliabilitySvg, reliabilityTable, MIN_RATED, MIN_BIN };
