# SOVEREIGN // AEGIS — Phase 4 Minimal Pilot Design

**Date:** 2026-09-25. **Status:** design only. No participants enrolled, no data
collected, no results implied or presented.

This document specifies the smallest study that produces an honest, quantitative
answer to one question — *does measured skill move after the app's practice dose?* —
using the frozen Phase 4 kit exactly as it stands. It deliberately does NOT replace
the pre-registered trial (§8 prerequisites still apply before any recruitment);
it is the rung below it.

## 1. What this pilot can and cannot claim

**Can claim (if run as specified):**
- A within-person change estimate D with a 95% CI, per arm, on held-out items.
- Whether the measurement machinery works end-to-end (enrollment → export → frozen
  analysis) before the full trial's cost is incurred.
- Feasibility: completion rate, adherence, session latency, attrition causes.

**Cannot claim, at any pilot sample size used here:**
- A definitive causal effect of the app vs. alternatives (underpowered by design).
- Generalization beyond this convenience sample.
- Anything at τ = 5 pp — no honest pilot at these sizes resolves it (see §6).

A null or noisy result is a result and will be reported as such.

## 2. Design: two-arm pilot on the frozen kit, truncated

The frozen machinery already implements the trial: `allocation.csv` is a hashed
400-row 1:1 sequence in permuted blocks of 4, and `tools/transfer-study/analyze.mjs`
expects `{pid, arm: "AEGIS"|"CONTROL", items[]}` and computes τ with a
participant-cluster bootstrap. **The pilot consumes both unmodified:**

1. Enroll participants strictly in `allocation.csv` row order (frozen seq), drawing
   the first N rows. Arms are whatever the frozen sequence says — no new
   randomization, no peeking.
2. Run the protocol §5 dose verbatim per participant:
   `T0` (24 held-out items, answer-then-confidence) → five 15–20 min sessions over
   14 days (AEGIS arm: the app's practice route, minus `exclude-ids.json` items;
   control arm: matched contact time on non-practice surfaces) → `T1` within 48 h
   of session five → optional `T2` at ~4 weeks.
3. Export per §7 schema to `exports/participants.json` and run the frozen script
   unmodified. Nothing about the pipeline changes for the pilot.

A single-arm variant (everyone gets the app, τ̂ = mean of within-person D) is
possible but would require a new analysis path and loses the contact-time control.
**Not recommended.** The two-arm truncated design costs little more and keeps the
frozen script — and the frozen script is the integrity asset.

## 3. Eligibility and the contamination pre-check (mandatory)

- Each prospective participant's environment must not have practiced the held-out
  pool. Concretely: cross-reference every `itemId` in the candidate's local attempt
  log (`AttemptLog.export()`) against `forms/exclude-ids.json`. Any overlap →
  ineligible (or a fresh, clean browser profile must be used).
- **The operator's own install is almost certainly contaminated** by months of
  practice history; the operator participates, if at all, only on a virgin profile.
- Demographic minimums and consent per §8 — ethics review and consent materials
  come **before** the first participant, pilot included. This document does not
  authorize enrollment.

## 4. Outcomes

- **Primary (per arm):** mean within-person change D = P(T1) − P(T0) on the 24-item
  forms, with the frozen 95% participant-cluster bootstrap CI. Each P missing if
  < 12 valid items (frozen thin-form threshold — this is the main attrition lever).
- **Secondary (frozen script, exploratory):** pooled form accuracies with Wilson
  intervals; paired Newcombe analysis.
- **Pilot-added descriptive outcome (no new machinery):** calibration shift — the
  forms already record `sure/unsure/guess`; the gap between claimed and observed
  accuracy at T1 vs T0 is reportable as a table without touching the frozen script.
- **Feasibility:** enrollment→completion flow, sessions completed / sessions
  prescribed (the attempt log measures this for free), median session latency,
  dropout reasons, T1-within-48h compliance rate.

## 5. Sample size — honest arithmetic, not a power fantasy

With 24-item forms, the binomial standard error of a single form proportion near
p = 0.5 is √(0.25/24) ≈ **10.2 pp**. The within-person difference inherits
`SD_D ≈ 10.2 × √(2(1−ρ))`, where ρ is the T0–T1 correlation of per-person
accuracy. ρ = 0.5 gives the planning value **SD_D ≈ 10–11 pp** (band 8–13 pp for
ρ ∈ 0.3–0.7). Expected CI half-width for a two-arm mean difference is then
≈ 1.96 × SD_D × √(2/n_per_arm):

| Enrolled (start) | Complete (assume 75%) | Per arm | CI half-width | What this resolves |
|---|---|---|---|---|
| 8 | 6 | 3 | ~18 pp | Nothing useful. Machinery smoke-test only. |
| 12 | 9 | 4–5 | ~14 pp | Only τ ≈ 15 pp, barely. |
| 16 | 12 | 6 | ~12 pp | τ ≈ 15 pp; 8 pp not bounded. |
| **24** | **18** | **9** | **~9–10 pp** | τ = 15 pp solid; 8 pp suggestive. |
| 32 | 24 | 12 | ~8.2 pp | 8 pp excluded from 0 if observed. |
| 48 | 36 | 18 | ~6.7 pp | 8 pp solid; 5 pp still not (needs ~70/arm). |

**Recommendation: enroll 24** (draw rows 1–24 of `allocation.csv`). It is the
smallest size at which a positive 15 pp result would be clearly visible and an
8 pp effect at least suggestively bounded, while remaining realistic for one
operator to recruit and run. If recruitment disappoints, 16 is the floor below
which the pilot measures machinery, not effect.

**Small-sample caveat, stated up front:** percentile bootstrap CIs with 6–12
clusters per arm undercover. The pilot therefore also reports the per-participant
D values individually (dot plot) and the sign test on D, and interprets the CI as
approximate. The full trial's n = 400 remains the only configuration where the
frozen power verdict (§3 of the kit README) applies.

## 6. Duration

- Per participant: Day 0 T0 (~15 min) → sessions on ~days 1, 4, 7, 10, 13 →
  T1 by day 16 → optional T2 by day ~44. Participant burden ≈ 2 h total.
- One wave of 24: ~3 weeks of data collection + 1 week buffer = **~4 weeks
  calendar**, assuming participants start within the same fortnight.
- Solo-operator reality: recruitment and scheduling dominate. Realistic plan:
  two staggered waves over **6–8 weeks**, analysis of the first wave at week 4
  (feasibility read), frozen-script analysis of all waves at week 8.
- Analysis itself is minutes: `node tools/transfer-study/analyze.mjs
  exports/participants.json` — run only after the analysis inputs are frozen
  (§7 below).

## 7. Integrity rules (inherited, restated)

1. The kit stays frozen: no form edits, no seed changes, no manifest regeneration.
   `node tests/test-transfer-study.js` must pass before and after the pilot; any
   hash mismatch invalidates everything.
2. Analysis inputs (`exports/participants.json`) are frozen (hashed) **before**
   arm labels are examined by anyone; the frozen script then runs unmodified.
3. No p-hacking surface exists in the pre-registered pipeline (no p-value on the
   primary estimand); the pilot adds none.
4. Pilot data, however small, are never presented as trial results. Any write-up
   carries the scope caveat from §1 verbatim.
5. `exclude-ids.json` items are excluded from practice for all study participants,
   arms alike — for pilot purposes this is an operator procedure (the app does not
   yet enforce it); verify it in the exported logs (no excluded `itemId` may
   appear in any practice attempt).

## 8. Minimal operator checklist

- [ ] Ethics review + consent materials (§8 prerequisite — unchanged)
- [ ] Contamination pre-check per candidate (attempt log × exclude-ids)
- [ ] Enroll rows 1–24 of `allocation.csv`, strictly in order
- [ ] Run §5 dose per participant; log sessions via the app (free adherence data)
- [ ] Export `participants.json` (schema per analyze.mjs header); hash-freeze it
- [ ] Run frozen analysis; report per §1 scope + §7 report structure
- [ ] Publish feasibility numbers (completion, adherence, latency) alongside τ
