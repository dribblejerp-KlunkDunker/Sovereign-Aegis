/**
 * SOVEREIGN // AEGIS — Next Drill panel (pure)
 *
 * Takes the output of competency.rank() — one or more ranked recommendations — and returns
 * markup for a call-to-action button on the Overview that routes the operator directly into
 * the highest-value practice session. The button name-drops the skill being trained so the
 * operator knows *why* they're being sent there.
 *
 * Pure: takes data, returns markup. No DOM, no storage. Every interpolated string passes
 * through esc().
 *
 * @module nextDrillPanel
 */

import { esc } from './security.js';

/**
 * Which module and subtab each skill is best practised on.
 *
 * "Best" means the practice surface with the strongest evidence quality: Arena
 * (multiple-choice with timer) beats Memory Vault (self-graded recall) beats
 * reading reference material.
 */
export const DESTINATIONS = {
  'skill.fallacy.relevance':           { tab: 'cognitive', subtab: 'arena', label: 'Arena Gauntlet' },
  'skill.fallacy.structure':           { tab: 'cognitive', subtab: 'arena', label: 'Arena Gauntlet' },
  'skill.fallacy.scope':               { tab: 'cognitive', subtab: 'arena', label: 'Arena Gauntlet' },
  'skill.fallacy.appeals':             { tab: 'cognitive', subtab: 'arena', label: 'Arena Gauntlet' },
  'skill.fallacy.formal-vs-informal':  { tab: 'cognitive', subtab: 'arena', label: 'Arena Gauntlet' },
  'skill.bias.confirmation':           { tab: 'cognitive', subtab: 'arena', label: 'Arena Gauntlet' },
  'skill.bias.availability':           { tab: 'cognitive', subtab: 'arena', label: 'Arena Gauntlet' },
  'skill.bias.anchoring':              { tab: 'cognitive', subtab: 'arena', label: 'Arena Gauntlet' },
  'skill.bias.attribution':            { tab: 'cognitive', subtab: 'arena', label: 'Arena Gauntlet' },
  'skill.bias.probability':            { tab: 'cognitive', subtab: 'arena', label: 'Arena Gauntlet' },
  'skill.tactic.astroturfing':         { tab: 'cognitive', subtab: 'arena', label: 'Arena Gauntlet' },
  'skill.tactic.flooding':             { tab: 'cognitive', subtab: 'arena', label: 'Arena Gauntlet' },
  'skill.tactic.false-balance':        { tab: 'cognitive', subtab: 'arena', label: 'Arena Gauntlet' },
  'skill.tactic.emotive-framing':      { tab: 'cognitive', subtab: 'arena', label: 'Arena Gauntlet' },
  'skill.tactic.equivocation':         { tab: 'cognitive', subtab: 'arena', label: 'Arena Gauntlet' },
  'skill.disarm.plan-prepare':         { tab: 'cognitive', subtab: 'disarm', label: 'DISARM Catalog' },
  'skill.disarm.seed-amplify':         { tab: 'cognitive', subtab: 'disarm', label: 'DISARM Catalog' },
  'skill.disarm.countermeasures':      { tab: 'cognitive', subtab: 'prebunking', label: 'Prebunking Simulator' },
  'skill.sift.stop':                   { tab: 'cognitive', subtab: 'sift-labs', label: 'SIFT Labs' },
  'skill.sift.investigate-source':     { tab: 'cognitive', subtab: 'sift-labs', label: 'SIFT Labs' },
  'skill.sift.find-coverage':          { tab: 'cognitive', subtab: 'sift-labs', label: 'SIFT Labs' },
  'skill.sift.trace-origin':           { tab: 'cognitive', subtab: 'sift-labs', label: 'SIFT Labs' },
  'skill.forensics.read-measurements': { tab: 'cognitive', subtab: 'forensics', label: 'Forensics Lab' },
  'skill.forensics.provenance':        { tab: 'cognitive', subtab: 'forensics', label: 'Forensics Lab' }
};

export function nextDrillPanel(topItem, opts = {}) {
  const skills = Array.isArray(opts.skills) ? opts.skills : [];

  // Phase 2: due Memory Vault reviews outrank every competency recommendation — the
  // scheduler exists precisely so that what is due now IS the highest-value practice.
  // Rendered before any other branch, including the placement router.
  const dueReview = opts.dueReview || null;
  if (dueReview && Number.isFinite(dueReview.count) && dueReview.count > 0 && dueReview.tab && dueReview.subtab) {
    return `<div class="card card-bronze card-granite-inset" style="padding:14px 16px;margin-bottom:var(--space-6);border-left:4px solid var(--veracity-green,#4ade80);">
      <div class="status-label" style="color:var(--veracity-green,#4ade80);">DUE NOW — SPACED REPETITION REVIEW</div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:8px;">
        <div style="flex:1;min-width:200px;">
          <div class="heading-4" style="color:var(--parchment-bright,#ece7de);margin:0;">${esc(String(dueReview.count))} Memory Vault card${dueReview.count === 1 ? '' : 's'} due today</div>
          <div style="margin-top:4px;font-size:0.74rem;color:var(--stone-warm,#a8a29e);">
            Scheduled reviews come before new material — clearing the queue is what makes the schedule mean anything.
          </div>
        </div>
        <button class="btn btn-primary"
                data-aegis-action="switch-tab"
                data-aegis-tab="${esc(dueReview.tab)}"
                data-aegis-subtab="${esc(dueReview.subtab)}"
                style="flex-shrink:0;white-space:nowrap;"
                title="Open the Memory Vault and clear the due queue.">
          🧠 Review Now → Memory Vault
        </button>
      </div>
    </div>`;
  }

  if (!topItem || !topItem.skillId) {
    const placement = opts.placement || null;
    if (placement && placement.placedAt) {
      const dest = placement.placedAt;
      return `<div class="card card-bronze card-granite-inset" style="padding:14px 16px;margin-bottom:var(--space-6);border-left:4px solid var(--bronze-primary,#d2a64d);">
        <div class="status-label" style="color:var(--bronze-primary,#d2a64d);">RECOMMENDED STARTING DRILL — PLACEMENT ROUTED</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:8px;">
          <div style="flex:1;min-width:200px;">
            <div class="heading-4" style="color:var(--parchment-bright,#ece7de);margin:0;">${esc(placement.track || 'Foundational Training')}</div>
            <div style="margin-top:4px;font-size:0.74rem;color:var(--stone-warm,#a8a29e);">
              Based on your Diagnostic Placement (${esc(placement.score)}/${esc(placement.total)} probes correct) · Recommended start: <strong>${esc(dest.label)}</strong>
            </div>
          </div>
          <button class="btn btn-primary"
                  data-aegis-action="switch-tab"
                  data-aegis-tab="${esc(dest.tab)}"
                  data-aegis-subtab="${esc(dest.subtab)}"
                  style="flex-shrink:0;white-space:nowrap;"
                  title="Go to ${esc(dest.label)} to begin placed training.">
            ⚔️ Begin Training → ${esc(dest.label)}
          </button>
        </div>
      </div>`;
    }

    return `<div class="card card-bronze card-granite-inset" style="padding:14px 16px;margin-bottom:var(--space-6);">
      <div class="status-label" style="color:var(--bronze-primary,#d2a64d);">NEXT DRILL — WHERE TO PRACTISE</div>
      <p style="margin:8px 0 0 0;font-size:0.78rem;color:var(--stone-muted,#8b8f99);">
        Answer a few Arena questions first — the system needs evidence before it can recommend where to focus.
      </p>
    </div>`;
  }

  const dest = DESTINATIONS[topItem.skillId] || { tab: 'cognitive', subtab: 'arena', label: 'Arena Gauntlet' };
  const skillDef = skills.find((s) => s.id === topItem.skillId);
  const skillLabel = skillDef ? skillDef.label : topItem.skillId;

  const miscalibratedMark = topItem.miscalibrated
    ? `<span style="font-size:0.68rem;color:var(--disinfo-crimson,#f87171);font-family:var(--font-mono,monospace);margin-left:6px;">⛔ MISCALIBRATED</span>`
    : '';

  // The button's data-aegis-action is handled by the delegated click handler in
  // app.js _bindDelegatedActions — no inline onclick needed, so no CSP violation.
  return `<div class="card card-bronze card-granite-inset" style="padding:14px 16px;margin-bottom:var(--space-6);border-left:4px solid var(--bronze-primary,#d2a64d);">
    <div class="status-label" style="color:var(--bronze-primary,#d2a64d);">NEXT DRILL — HIGHEST-VALUE PRACTICE</div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:8px;">
      <div style="flex:1;min-width:200px;">
        <div class="heading-4" style="color:var(--parchment-bright,#ece7de);margin:0;">${esc(skillLabel)}${miscalibratedMark}</div>
        <div style="margin-top:4px;font-size:0.74rem;color:var(--stone-warm,#a8a29e);">
          Mastery ${Math.round(topItem.mastery * 100)}% · The ${esc(dest.label)} is the best practice surface for this skill.
        </div>
      </div>
      <button class="btn btn-primary"
              data-aegis-action="switch-tab"
              data-aegis-tab="${esc(dest.tab)}"
              data-aegis-subtab="${esc(dest.subtab)}"
              style="flex-shrink:0;white-space:nowrap;"
              title="Go directly to ${esc(dest.label)} to train ${esc(skillLabel)}.">
        ⚔️ Practise Now → ${esc(dest.label)}
      </button>
    </div>
  </div>`;
}

export default { nextDrillPanel };