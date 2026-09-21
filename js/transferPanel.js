/**
 * SOVEREIGN // AEGIS — Transfer panel (pure)
 *
 * Renders the held-out transfer measurement: baseline accuracy on first-run items
 * vs current accuracy on unpracticed items, with an honest CI and the caveat that
 * this is a within-subject measure, not a controlled trial.
 *
 * The numbers come from competency.transfer(), which splits held-out attempts in
 * half by time and compares early vs late accuracy. This is the only measurement
 * in the application that can support the claim of building capability rather
 * than familiarity.
 *
 * Pure: takes a transfer report and returns markup. No DOM, no storage.
 * Every interpolated string passes through esc().
 *
 * @module transferPanel
 */

import { esc } from './security.js';

/**
 * Render the transfer panel.
 *
 * @param {object} report - output of competency.transfer()
 * @param {{heldOutCount?: number}} [opts]
 * @returns {string} escaped HTML
 */
export function transferPanel(report, opts = {}) {
  if (!report || !report.available) {
    const have = report && report.caveat ? report.caveat : 'Not enough held-out attempts yet.';
    return `<div class="card card-granite-inset" style="padding:14px 16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div class="status-label" style="color:var(--bronze-primary,#d2a64d);">TRANSFER — CAN PRACTICE GENERALISE?</div>
        <button type="button" class="btn btn-primary btn-sm" id="btn-transfer-baseline" style="font-size:0.75rem;padding:4px 10px;">
          🔬 Run Baseline Diagnostic (10 Probes)
        </button>
      </div>
      <p class="body-muted" style="margin:8px 0 0 0;font-size:0.78rem;">${esc(have)}</p>
    </div>`;
  }

  const delta = report.delta;
  const [lo, hi] = report.ci95 || [null, null];
  const direction = delta > 0.05 ? 'IMPROVING' : delta < -0.05 ? 'DECLINING' : 'FLAT';
  const colour = delta > 0.05 ? 'var(--veracity-green,#34d399)' : delta < -0.05 ? 'var(--disinfo-crimson,#f87171)' : 'var(--stone-warm,#a8a29e)';

  const pct = (x) => Number.isFinite(x) ? `${Math.round(x * 100)}%` : '—';
  const ciStr = Number.isFinite(lo) && Number.isFinite(hi)
    ? `[${Math.round(lo * 100)}, ${Math.round(hi * 100)}]`
    : '—';

  return `<div class="card card-bronze card-granite-inset" style="padding:14px 16px;border-left:4px solid ${colour};">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
      <div class="status-label" style="color:var(--bronze-primary,#d2a64d);">TRANSFER — CAN PRACTICE GENERALISE?</div>
      <button type="button" class="btn btn-secondary btn-sm" id="btn-transfer-followup" style="font-size:0.75rem;padding:4px 10px;">
        ⚡ Run Follow-Up Evaluation (10 Probes)
      </button>
    </div>

    <div style="display:flex;gap:20px;flex-wrap:wrap;margin-top:12px;">
      <div style="flex:1;min-width:120px;text-align:center;">
        <div style="font-size:2rem;font-family:var(--font-mono,monospace);color:var(--parchment-bright,#ece7de);">${pct(report.baseline.accuracy)}</div>
        <div style="font-size:0.68rem;color:var(--stone-muted,#8b8f99);font-family:var(--font-mono,monospace);">BASELINE<br>${esc(report.baseline.n)} ITEMS</div>
      </div>
      <div style="flex:1;min-width:120px;text-align:center;">
        <div style="font-size:2rem;font-family:var(--font-mono,monospace);color:${colour};">${pct(report.current.accuracy)}</div>
        <div style="font-size:0.68rem;color:var(--stone-muted,#8b8f99);font-family:var(--font-mono,monospace);">CURRENT<br>${esc(report.current.n)} ITEMS</div>
      </div>
      <div style="flex:1;min-width:140px;text-align:center;">
        <div style="font-size:2rem;font-family:var(--font-mono,monospace);color:${colour};">
          ${delta > 0 ? '+' : ''}${Math.round(delta * 100)}
        </div>
        <div style="font-size:0.68rem;color:var(--stone-muted,#8b8f99);font-family:var(--font-mono,monospace);">
          Δ ${direction}<br>95% CI ${ciStr}pp
        </div>
      </div>
    </div>

    <p class="body-muted" style="margin:12px 0 0 0;font-size:0.72rem;color:var(--stone-warm,#a8a29e);">
      ${esc(report.caveat)}
    </p>
  </div>`;
}

export default { transferPanel };