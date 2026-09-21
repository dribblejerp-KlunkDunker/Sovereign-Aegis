# SOVEREIGN // AEGIS — Session Handoff & Roadmap

**Prepared:** 2026-08-22, at the end of the "Memory Vault answer-before-reveal" session.
**Purpose:** enough context for a fresh session to continue without this conversation.
**One-line state:** the app is an honest, local-first epistemic-defense training suite with a
fully-built competency spine, calibration and confidence capture; the remaining work is making
retention bite (Phase 2), demonstrating transfer (Phase 4), and closing the independent-review
hardening leftovers.

---

## 1. What this is

- Local-first, browser-native cognitive-defense training suite. Vanilla ES modules + WebCrypto.
  No build step for the multi-file app (that property is a deliberate, audited asset). Zero
  runtime dependencies. ~24 skills, ~119 arena questions, 24 fallacies, 39 DISARM techniques.
- Lives at `sovereign-aegis/` inside the blackvault repo. The repo root also contains an
  unrelated Electron dashboard (orbital / blackvault) and an unrelated HF "Reverse-Face-Search"
  static Space task done earlier — do not confuse those with AEGIS work.
- Docs of record (all in `sovereign-aegis/`):
  - `ROADMAP.md` — the phase plan (Phases 1–7) + independent-review remediation (§8).
  - `ROADMAP-EVIDENCE.md` — priority re-cut P0–P4 + detailed "as built" notes (very thorough).
  - `ROADMAP-messenger.md` — the Reema messenger seam (largely built).
  - `docs/manual-improvement.md` — research-backed recommendations R1–R12.
  - `docs/transfer-study-preregistration.md` — ready-to-submit transfer study protocol.
  - `DESIGN-competency-spine.md`, `DESIGN-aegis-reema-seam.md`, `DESIGN-product-decision.md` (D1 resolved).

## 2. Working-tree state — READ FIRST

- The ENTIRE tree is a heavily modified, **UNCOMMITTED** working tree. Last commit:
  `e93d1b6` "Checkpoint seven days of work, and fix the startup profile/port collision".
- Do **not** `git checkout`, `git stash`, `git reset`, or `git add -A`. Many modified and
  untracked files are intentional (`.gitignore` added; `.agents/` untracked; backup files like
  `*.pre-fatalguard` exist). Leave ownership as-is; commit only what a task explicitly touches.
- Everything described below is on disk and uncommitted.

## 3. Competency spine (roadmap Phase 1) — BUILT & VERIFIED

- `data/skills.json` — 24 skills with prerequisites and held-out item ids.
- All content tagged (`teaches`/`tests`) — fallacies, DISARM, SIFT, arena, SM-2, inoculation,
  rhetorical arguments. Gate: `node tools/tag-skills.mjs` fails the build on anything untagged
  or on a lab where every item shares the same correct answer.
- `js/competency.js` — Bayesian mastery estimates, `calibration()` (Brier, reliability bins,
  over/under-confidence), `transfer()`, `rank()` (confidently-wrong boosted 2.5x, keyed on itemId).
- `js/attemptlog.js` — append-only IndexedDB log, `SCHEMA_VERSION = 3` (v1→v2 added
  `confidence`; v2→v3 added `chosen`). Additive; no migrations.
- `js/attempts.js` — the one recorder every module calls. CONTEXTS include `arena`, `sm2`,
  `sift`, `fallacy-drill`, `inoculation`, `sandbox`, `forensics`, `messenger`, `infowar`,
  `sm2-diagnosis`.
- `js/confidence.js` — sticky 3-state control (sure/unsure/guess), defaults to `unsure`,
  never `sure`. Frozen at reveal where a prediction is scored.
- Six+ recording surfaces wired; practice-log export/import in Identity → Keypair & DID Profile.
- At the time of Phase 1: 18 suites / 3,405 assertions green. Today: 36 suites / 12,033 green.

---

## 4. This session's work — Memory Vault answer-before-reveal (roadmap N2)

**Status: implemented, tested, green — but NOT committed, and the standalone build is stale.**

The feature itself already existed in the uncommitted tree (a prior agent built it): a
forced-choice diagnosis guess before the flip, four options drawn from other cards'
`diagnosis` fields, recorded under its own context `sm2-diagnosis` with the `chosen` option,
confidence frozen at reveal. What THIS session did:

1. **Fixed a semantic bug** in `js/modules/spacedRepetition.js`: `_qualityToCorrect(2)` (Hard)
   returned `false` while the scheduler's `qMap {1:1, 2:3, 3:4, 4:5}` schedules Hard as a PASS
   (SM-2 quality 3, repetitions advance, interval grows) and the UI previews treat Hard as a
   pass. The attempt log and the scheduler disagreed — exactly the "two notions of knew it"
   the roadmap forbids. Fix: one shared `SM2_QUALITY_MAP` constant used by both
   `_calculateSM2` and `_qualityToCorrect`; Hard is now recorded as recalled.
2. **Rewrote `tests/test-sm2-semantics.js`** (was a log-only probe with zero assertions) into a
   **66-assertion suite**: scheduling semantics; option building (4 distinct options, answer +
   3 distractors from other cards, deterministic per card id, fallback padding for thin decks);
   diagnosis recording (correct / wrong / recorded-once guard / no-selection records nothing /
   untagged warns once / multi-skill fan-out / heldOut carried); and the demonstrated-vs-felt
   gap (`sm2-diagnosis` vs `sm2` records kept separate and allowed to disagree). Uses the house
   in-memory IndexedDB stub + a minimal `document` stub.
3. **Registered the suite** in `tests/run-all.js` (36th suite, `SM-2 Semantics &
   Answer-Before-Reveal Suite`).
4. **Fixed the now-contradicting assertion** in `tests/test-attemptlog.js` (the "Hard (2) is
   not recalled" test encoded the old bug; updated to the corrected mapping).
5. **Verified:** `npm test` → 36 suites, **12,033/12,033 assertions, 0 failed** + Reverse Face
   Search Playwright suite 23/23.

### PENDING — standalone single-file build is STALE

- `sovereign-aegis-standalone.html` is a tracked artifact that predates the feature — it has
  **zero** occurrences of `sm2-diagnosis` (verified). The multi-file app is fine; the
  single-file `file://` build is not in sync.
- Regenerate with `node build-standalone.mjs`. Two blockers:
  - esbuild is not installed (dev-only dependency, documented in the script header).
  - On Windows the script's `execFileSync('npx', ...)` fails with `ENOENT` because `npx` is a
    `.cmd` shim — needs `shell: true` or spawning `npx.cmd`.
- Options for next session: (a) `npm i -D esbuild` + fix the npx spawn, rebuild, verify
  `sm2-diagnosis` appears; or (b) leave stale and regenerate later. The user was asked and
  skipped — recommend (a) with explicit permission.

### Files touched this session

- `js/modules/spacedRepetition.js` — `SM2_QUALITY_MAP`, `_qualityToCorrect` fix, comment updates.
- `tests/test-sm2-semantics.js` — rewritten (new, 66 assertions).
- `tests/run-all.js` — one-line suite registration.
- `tests/test-attemptlog.js` — one assertion block updated to the corrected mapping.

---

## 5. Remaining roadmap (priority order)

### 5.1 Next build: Phase 2 / P4 — make the retention machinery bite (~1 session)

The single biggest felt change from "encyclopedia" to "training". All wiring already exists:

- Auto-generate SM-2 cards from every tagged content item (~180 cards, up from 20).
- The Arena draws by weak skill via `rank()` instead of at random (confidently-wrong items
  first — the P0 boost).
- Finishing a masterclass section schedules its skills for review instead of setting a
  `completed` flag.

**Deliverable:** reading something now has downstream consequences.

### 5.2 Then: demonstrate transfer (roadmap Phase 4 / manual-improvement R8) — highest credibility payoff

- Reserve ~20% of items as a held-out set (today: only the Arena's 8% probe cadence — the
  documented limitation).
- On first run, a 10-item baseline from the held-out set; after N practice sessions, a fresh
  non-overlapping held-out set.
- Results view: baseline vs current on unpracticed items, sample size, honest confidence
  interval, and the caveat "within-subject on a small n, not a controlled trial".
- The protocol is already written: `docs/transfer-study-preregistration.md` (remaining
  checkboxes: timestamping/hashes before recruitment, T0/T1/T2 item disjointness, frozen
  ground truth, randomization policy, enrollment targets 400/320, CI rules, privacy review).

**Deliverable:** the app can show evidence it works — or discover it does not. Both are worth
more than the current state.

### 5.3 The four evidence items (ROADMAP-EVIDENCE.md) — status

| Item | Status |
|---|---|
| P0 confidence capture (schema v2, sticky control, calibration(), rank()) | **BUILT** |
| P1 author 60–100 items (91 arena + 9 SIFT; shuffle/length-tell fixes; quality gates) | **BUILT** |
| P2 forensics predict-then-measure drill (`forensicsDrill.js`) | **BUILT** |
| P3 calibration dashboard (`calibrationPanel.js`, refuses <12 rated answers) | **BUILT** |
| P4 Phase-2 retention | **NOT BUILT** — see 5.1 |

### 5.4 Unapproved proposals (N1–N3) — status after this session

- **N1** record chosen distractor — **DONE** (`chosen` field, schema v3; used by `sm2-diagnosis`).
- **N2** SM-2 answer-before-reveal — **DONE** this session.
- **N3** score the mute Prebunking choices — **OPEN**. Content edit: give every branching
  choice a non-zero `resilienceDelta` (neutral = delta 0 currently records nothing) and extend
  scenarios past two stages.

### 5.5 Independent-review hardening leftovers (ROADMAP.md §8) — OPEN

1. Run `npm run test:e2e` in a browser CI job; report headless vs browser numbers separately.
2. Make legacy private-JWK rotation one-click (Identity view already prompts; new identities
   are non-extractable/vaulted).
3. Move templates off inline `style=""` in `index.html` (2,507 lines) so CSP `style-src` can
   drop `'unsafe-inline'` — the last hardening step and precondition for the strongest CSP.

### 5.6 Cheap / quality items (docs/manual-improvement.md R4–R12)

- **R4** C2PA "Verify externally" link to `contentcredentials.org/verify` — zero cost, truthful
  (endorses roadmap Phase 6b).
- **R5** OSINT relabel as a *methodology walkthrough* + link each mock pivot to Bellingcat's
  Online Investigation Toolkit.
- **R6** DISARM Blue countermeasures as data — dataset already exists
  (`data/disarm_blue.json`, suite `test-disarm-blue.js`); wire into InfoWar AAR rendering.
- **R7** Key-assumptions check in the ACH lab — small, optional step.
- **R9** Inoculation-game design patterns (badges, humor, perspective-taking, short boosters).
- **R10/R11** Positioning: "defend, don't abstain" in onboarding; "DISARM for individuals".

### 5.7 Phase 5 — retire the remaining simulations (do AFTER Phase 4's data tells you whether they matter)

- **Video mode** (`_drawForensicVideo` paints ellipses). Real option: per-frame ELA/FFT via
  `requestVideoFrameCallback` over a `<video>` + temporal-consistency measurement. Cheap
  option: relabel. DSP module is already in place.
- **OSINT module** (4.3 KB, entirely mock pivots). Relabel as methodology walkthrough (cheap,
  truthful) or wire real CORS-permitting endpoints. Do not leave it looking like a live tool.
- **Narrative topology** — scripted animation; reuse `infowar.js`'s real contagion engine.

### 5.8 Phase 6 — real C2PA verification (discrete, ~1 session + a size decision)

- `js/c2pa.js` parses manifests but cannot validate signatures (the four missing steps are
  named in the module header and in the UI).
- Decision already made in the roadmap: **(b) parse-only + link to
  `contentcredentials.org/verify` now; (a) lazy-load `c2pa-js` WASM only when someone actually
  needs in-app verification.** The WASM bundle is multi-MB and breaks the no-build-step
  property — do not ship it by default.

### 5.9 Phase 7 — sharing / sync (ONLY if it becomes a real need)

- Case packs already import/export (the collective-defense primitive, XSS-safe).
- Multi-device: end-to-end encrypted sync keyed off the existing DID, through a relay that
  cannot read plaintext. D1 (attempt-log sync) resolved to **never** — do not erode that
  without revisiting the premise explicitly.
- Publishing a signed competency attestation (DID-signed) is a natural, novel fit.

### 5.10 Messenger roadmap (ROADMAP-messenger.md) — largely BUILT

- Phase 0 (D1 resolved) — done. Phase 1 (verdad-service) — done. Phase 2 (binding credential)
  — done. Phase 3 (messenger wiring: pre-send gate, inbound flags, signed rebuttal) — done.
  Phase 4 (messenger also trains: near-share records `context: 'messenger'` locally) — done.
  Phase 5 (relay mixing — built 2026-08-19) — done.
- Remaining messenger work: relabel OSINT/video/narrative simulations if they appear in the
  messenger; C2PA verification only if media messages ship. Mixing is defense-in-depth
  metadata protection, NOT a mixnet — keep that claim honest.

---

## 6. Commands

```bash
# from sovereign-aegis/
npm test                 # run-all.js (36 suites, 12,033 assertions) + Reverse Face Search Playwright suite
npm run test:e2e         # browser E2E (headless Chrome CDP) — separate from npm test
npm run test:browser     # Playwright browser suite
node tests/test-sm2-semantics.js   # the new suite alone
node tools/tag-skills.mjs          # content-tagging gate (fails on untagged / same-answer labs)
node build-standalone.mjs          # single-file build — NEEDS esbuild; npx spawn broken on Windows
```

## 7. Key files

| File | Role |
|---|---|
| `js/modules/spacedRepetition.js` | Memory Vault. `SM2_QUALITY_MAP` at top; `_buildDiagnosisOptions`, `_recordDiagnosisAttempt`, `_revealDiagnosisOutcome`, `rateCard` |
| `js/attempts.js` | `recordAttempt` funnel; `CONTEXTS` incl. `SM2_DIAGNOSIS` |
| `js/attemptlog.js` | Append-only log; `SCHEMA_VERSION = 3` |
| `js/confidence.js` | Sticky sure/unsure/guess control |
| `js/competency.js` | Mastery, `calibration()`, `transfer()`, `rank()` |
| `js/calibrationPanel.js`, `js/forensicsDrill.js` | P3 / P2 deliverables |
| `index.html` (~1126–1131) | `sm2-diagnosis-options` / `sm2-diagnosis-choices` markup |
| `tests/test-sm2-semantics.js` | NEW 66-assertion suite (this session) |
| `tests/run-all.js` | Suite registry — 36 entries |
| `tests/test-attemptlog.js` | Attempt log suite (Hard-mapping assertion updated) |
| `sovereign-aegis-standalone.html` | **STALE** — needs rebuild to include `sm2-diagnosis` |

## 8. Unrelated but in this repo's history — Reverse Face Search task

- A Hugging Face **static** Space downloaded earlier to
  `C:\Users\dribb\.cache\huggingface\hub\spaces--ReverseFaceSearch--Reverse-Face-Search\snapshots\86581f8e...`
  (index.html / script.js / style.css / README.md; no backend).
- Fixed its invalid-file state (a rejected selection no longer leaves a previous image ready to
  submit); added Playwright coverage `sovereign-aegis/tests/test-reverse-face-search-upload.js`
  (23 checks, local mock handoff endpoint, no real uploads) — wired into `npm test`.
- The Space is only a frontend handoff: clicking START SEARCH POSTs the image to
  `https://www.socialsleuth.xyz/api/face-search/handoff`. The search itself is not local.
  Audit findings (privacy/security) were delivered earlier; not part of the AEGIS roadmap.

---

## 9. Recent Update: Tactical Arcade & Game-Feel Engine (Game Juice & Epistemic Engagement)
- **Tactical Audio Synthesizer (`js/modules/tacticalAudio.js`)**:
  - `playStreakHit(streak)`: 11-step harmonic C-pentatonic pitch-climbing chime with overtone shimmer (streak >= 3) and dual chord resonance (streak >= 5).
  - `playCriticalHit()`: Crisp high-frequency impact snap + triumphant C6-E6-G6 triad chime for rapid refutations.
  - `playStreakBust()`: Descending sawtooth sub-thud (160Hz -> 50Hz) providing weighty tactile feedback when combos break.
  - `playTimerWarning()`: Tension-building radar tick during final 10 seconds of round timers.
- **Infinite Arena (`js/modules/infiniteArena.js`)**:
  - Sub-2.8s **Critical Refutations** granting +40% score bonus, +4s Blitz extension, and golden flash.
  - Dynamic timer bar with color transitions (bronze -> amber -> fiery pulse under 25%).
  - Escalating tactical tiers: 1.5x Tactical Momentum, 2.0x Dialectic Focus, 3.0x Cognitive Overdrive, 4.0x Hyper-Sentinel Apex.
  - Overdrive card aura (`.arena-card-overdrive`) on streaks >= 5.
  - Post-round AAR tracking and displaying total Critical Refutations.
- **Fallacy Gauntlet (`js/modules/cognitive.js`)**:
  - Sub-2.5s Critical fallacy identification (+2 pts, +3s time).
  - Real-time animated top progress bar, dynamic combo titles, and Overdrive card glow.
- **60-Second SIFT Triage (`js/modules/siftLabs.js`)**:
  - Sub-1.8s Lightning Triage (+2 pts, +3s time) and rapid triage count in AAR.
- **Kinetic Game Feel (`css/components.css`)**:
  - Animations: `.combat-float-tag`, `.aegis-shake`, `.crit-hit-pulse`, `.combo-pop-scale`, `.timer-danger`.
