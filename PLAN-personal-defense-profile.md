# Implementation Plan — Personal Defense Profile (slice 1)

**Spec:** `DESIGN-personal-defense-profile.md` (committed, c8f71e7).
**Goal:** the seven acceptance criteria in spec §9, met end to end, with the house seams intact.

## Ordered steps

| # | Step | Files | Done when |
|---|---|---|---|
| 1 | Inventory data | `data/profile-items.json` | 38 items (24 lens + 14 context), `record` coding ±1, `contentVersion`, validates by inspection |
| 2 | Guide + atlas data | `data/profile-guides.json`, `data/framework-notes.json` | 7 contexts with tactic family / if-then plan / route skillId / watchpoint copy; 6 lenses with per-band asset copy; 8 atlas cards with evidence tiers |
| 3 | Pure scoring module | `js/profile.js` | `compute()` + `buildGuide()` + salience rule, zero I/O, zero imports |
| 4 | Scoring tests | `tests/test-profile.js` | band edges (2.5/3.5 ties → `mixed`), reverse-coding, salience truth table, **every route skillId exists in `data/skills.json`** |
| 5 | Store | `js/profilestore.js` | mirrors `attemptlog.js`: `normalise*` exported, append-only, `v: 1`, export/import wholesale-validate, `clear()` |
| 6 | Store tests | `tests/test-profilestore.js` | IDB-stub round-trip, dedupe by id, corrupt-file rejection, v1 record accepted / unknown `v` stamped current |
| 7 | Register suites | `tests/run-all.js` | both suites run in `npm test` |
| 8 | App wiring | `index.html`, `js/modules/profile.js`, `js/app.js` | nav tab + view section; module renders boundary-ack → inventory → map → log → atlas; Hard Reset calls `ProfileStore.clear()`; breadcrumb added |
| 9 | Full verification | — | `npm test` green, `npm run check` green, browser flow walks ack → answer → map → observation → route |

## Contracts (from the spec, with two noted deviations)

- `Profile.compute(responses, items) -> Map<lensId, {level: 'less'|'mixed'|'more', n, repeated}>`
  — coded value = `record === -1 ? 6 - value : value`; mean > 3.5 → `more`, mean < 2.5 → `less`, ties → `mixed`. No aggregate score, ever.
- `Profile.buildGuide(responses, levelMap, observations, guides, skills, {now})`
  — **deviation 1:** takes `responses` (spec omitted it) because the salience mini-check reads context answers; pure otherwise.
  **deviation 2:** observations gain a structured optional `resisted: true|false|null` field (spec §5 needs "unfavorable outcome" to be countable; free text alone is not). Null means not stated and never counts.
- Salience: `miniAvg(context, latest retake) >= 3.5 && (recentCount - disconfirmCount >= 2 || any resisted === false within 30d)`.
- Store record shapes per spec §3 (response: v/id/ts/itemId/value/confidence/scope/retake; observation: v/id/ts/tactic/contextTag/initialReaction/action/outcome/confidence/resisted).
- UI language: bands and conditions only; no percentile, no type assignment, no "manipulability".
