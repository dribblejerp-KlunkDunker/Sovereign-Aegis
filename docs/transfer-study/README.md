# SOVEREIGN // AEGIS — Phase 4 Transfer Study Kit

This directory holds the **pre-enrollment machinery** for the transfer study defined in
[`../transfer-study-preregistration.md`](../transfer-study-preregistration.md). Everything
the protocol requires to exist *before the first participant* is built, deterministic,
hash-frozen, and pinned by `tests/test-transfer-study.js` (part of the headless gate).

**What this is not:** study results. No participant data exists. Nothing here may be
presented as evidence that AEGIS training transfers — that claim is exactly what the
study exists to test.

## What is frozen (protocol §9 checklist coverage)

| Artifact | Tool | Protocol § |
|---|---|---|
| Held-out forms `T0` (20 items) / `T1` (19), parallel by skill stratum, answer-stripped, option-permuted | `tools/transfer-study/build-forms.mjs` | §4 |
| Practice pool (66 items) + `exclude-ids.json` (items that must not be practiced) | same | §4 |
| SHA-256 manifest of every form artifact | same | §4/§9 |
| Allocation sequence: 400 rows, 1:1 permuted blocks of 4, hashed | `tools/transfer-study/randomize.mjs` | §2/§3 |
| Power simulation over τ × clustering × session-noise | `tools/transfer-study/power-sim.mjs` | §3 |
| Frozen primary analysis: τ + 10k participant cluster bootstrap, Wilson, Newcombe | `tools/transfer-study/analyze.mjs` | §7 |

Key outputs live here: `forms/` (six hashed files), `allocation.csv` +
`allocation-manifest.json`, and `exports/` (analysis outputs only — never hand-edited).

Seeds are predeclared in the tool headers (`aegis-transfer-study-v1.0-*`). Changing any
seed or form content **after outcome data exist** invalidates the trial; the pinned test
suite will catch accidental regeneration because the manifest hashes would no longer match.

## The power verdict (already run, §3-mandated)

At the frozen form sizes, n=400 holds **≥99.3% power at the 15 pp target** across the
whole pessimistic corner (participant clustering σ_p ≤ 1.0, session noise σ_s = 0.5), and
≈88–96% at 8 pp. At 5 pp the trial is underpowered (~55%) — the report states this rather
than hiding it. See `exports/power-simulation.json`. The enrollment target of 400 stands.

## Human-only prerequisites (cannot be done by software)

1. Ethics review and consent materials (§8).
2. OSF (or equivalent) preregistration upload: this kit + the protocol + hashes (§8/§9).
3. Recruitment, consent, and scheduling of the three scored sessions (§5).
4. Study operators running the sessions and exporting `exports/participants.json`.
5. Independent review of item ground truth (§9 item 3) — content sign-off.

## Operator workflow (once humans clear the prerequisites)

```bash
# 0. Verify the kit is intact (also part of the headless gate):
node tests/test-transfer-study.js

# 1. Enrollment: draw rows from allocation.csv strictly in seq order.

# 2. Sessions: T0 form → 14 days of practice (arena MUST exclude exclude-ids.json
#    for study participants) → T1 form within 48h of session five → optional T2 at 4 weeks.

# 3. Export per participant the minimum research fields (schema in analyze.mjs header):
#    pid, arm, items[{session, itemId, correct, confidence?, latencyMs?}]
#    → docs/transfer-study/exports/participants.json

# 4. Freeze the analysis script and inputs BEFORE opening arm labels, then:
node tools/transfer-study/analyze.mjs exports/participants.json
#    → prints τ in percentage points with the pre-registered 95% bootstrap CI,
#      writes exports/primary-results.json

# 5. Report per §8: CONSORT flow, attrition, estimate + CI, and the scope caveat.
```

## Machinery self-check

`node tools/transfer-study/analyze.mjs --selftest` plants a +15 pp effect in synthetic
data and verifies the pipeline recovers it inside the CI. Its output is loudly marked
`SYNTHETIC — NOT A STUDY RESULT` and is written to `exports/selftest-results.json`.
