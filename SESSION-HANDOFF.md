# SOVEREIGN // AEGIS — Session Handoff

**Prepared:** 2026-09-20, from a verified tree audit (tests run, standalone checked,
git state probed). Replaces the 2026-08-22 handoff, whose "UNCOMMITTED" and
"standalone STALE" warnings are both obsolete — see `STATUS.md` for the snapshot.

**One-line state:** the app is an honest local-first epistemic-defense training suite
with a built competency spine, adaptive routing, attestations, retention coverage
(Phase 2) and the adaptive inoculation engine (PDP slice 3) both shipped, live-verified
in the browser and standalone bundle, and a green 45-suite headless gate; the remaining
work is running the transfer study (Phase 4), fixing the game-surface honesty findings
below, and getting browser E2E into CI. **The standalone is FRESH** (rebuilt 2026-09-20
during live verification; esbuild now available via npx).

---

## 1. What this is

- Local-first, browser-native cognitive-defense training suite. Vanilla ES modules +
  WebCrypto. No build step for the multi-file app (deliberate, audited asset). Zero
  runtime dependencies. ~24 skills, 145 arena questions, 24 fallacies, 41 DISARM
  techniques, 26 JSON datasets, 24 modules, 208-card SM-2 deck.
- Architecture, feature inventory, interface contracts: `PROJECT.md` (regenerated
  from the filesystem 2026-09-20).
- Docs of record: `ROADMAP.md` (phases 1–7 + review remediation §8),
  `ROADMAP-EVIDENCE.md` (P0–P4 as-built), `ROADMAP-messenger.md` (Reema seam, built),
  `AUDIT.md` (2026-08-17 audit + remediation log), `TEST_INFRA.md`, `TEST_READY.md`
  (⚠ its ACH-formula restatement is wrong; `PROJECT.md`/`ach.js` are right),
  `DESIGN-*.md` (5 specs, all shipped or explicitly slice-tracked),
  `docs/transfer-study-preregistration.md`.

## 2. Working-tree state

**Uncommitted feature work in the tree** (as of this handoff): Phase 2 retention
completion + PDP slice 3 (adaptive inoculation) — see §5/§6. `rustup-init.exe`
remains an unrelated untracked tooling file. Do not treat the 2026-08-22 handoff's
§2 ("ENTIRE tree heavily modified, UNCOMMITTED") as a description of *this* state —
that generation is long gone; HEAD `f49988c` (2026-09-20) was clean before this work.

## 3. Verification gate — measured 2026-09-20

- `node tests/run-all.js` → **45 suites, 17,350/17,350 assertions, 0 failed** (~9.1 s).
  Composition reported by the runner: 10,809 static dataset/schema checks (62%),
  6,541 logic/crypto/fuzz/static-HTML. Browser E2E is **not** in that number.
- `npm run test:e2e` exists as the separate browser gate (headless Chromium CDP);
  `npm run test:browser` is the Playwright suite; the reverse-face-search Playwright
  suite rides along with `npm test`.
- **No CI workflows exist** (no `.github/workflows/`). The headless gate is honest;
  the browser gate still has to actually run somewhere. This is open item #4.

## 4. Competency spine — BUILT & VERIFIED (unchanged conclusion, updated numbers)

- `data/skills.json` — 24 skills with prerequisites and held-out item ids (40
  held-out items across the bank).
- All content tagged via `tools/tag-skills.mjs` (fails the build on untagged or
  degenerate items): fallacies, DISARM, SIFT, arena, SM-2, inoculation, rhetorical
  arguments, OSINT cases, masterclasses.
- `js/competency.js` — mastery (exponentially-weighted accuracy, Beta prior,
  DECAY=0.97), `calibration()` (Brier, reliability bins, over/under-confidence),
  `transfer()`, `rank()` (confidently-wrong boosted 2.5×), `confusionMatrix()`.
- `js/attemptlog.js` — append-only, `SCHEMA_VERSION = 3`; `js/attempts.js` is the one
  recorder, with **15 contexts**: `arena`, `sm2`, `sift`, `fallacy-drill`,
  `inoculation`, `inoculation-adaptive`, `sandbox`, `forensics`, `messenger`,
  `infowar`, `sm2-diagnosis`, `masterclass`, `osint`, `osint-drill`, `diagnostic`.
- `js/confidence.js` — sticky 3-state control (sure/unsure/guess), frozen at reveal.
- Practice-log export/import in Identity → Keypair & DID Profile.

## 5. Personal Defense Profile — BUILT (all three slices shipped)

- `js/profile.js` (pure, no I/O), `js/profilestore.js` (append-only IDB, scope
  vocabulary frozen), `js/modules/profile.js` (view layer with ack gate, inventory,
  practice map, observation log, atlas, support card).
- All three data files exist: `profile-items.json` (38 items), `profile-guides.json`
  (7 contexts, each with `routeSkillId`), `framework-notes.json` (8 atlas cards with
  evidence tiers). Ground-truth suites `test-profile.js` / `test-profilestore.js`.
- **Slice 3 (adaptive inoculation scenario engine) SHIPPED (2026-09-20):** pure
  engine `js/inoculation.js` (120-assertion ground-truth suite) selecting
  (scenario, stage) candidates by counted priority = 2×contextSalience +
  1.5×(1−mastery) + freshness; view `js/modules/inoculationAdaptive.js` with the
  entry card in the Prebunking subtab; attempts under the new `inoculation-adaptive`
  context with real latency/choice/confidence; every 3rd run is a measurement run
  serving held-out probe stages (4 reserved in `inoculation.json` — the static player
  skips held-out stages so probes stay untrained); debrief ties outcomes to the
  operator's own watchpoint countermeasures. The static player's confidence-capture
  "bug" was retracted on verification — `recordAttempt` auto-fills from the sticky
  control when the caller omits it.

## 6. Open work, priority order

1. **Phase 2 retention — DONE (2026-09-20).** The deck is now **274 cards**
   (105/105 practice arena questions carded, held-out excluded at both the generator and
   the file gate; the 7 legacy leak cards are gone). New: held-out contamination purge +
   base-card merge in `spacedRepetition.js _loadDeck` (new releases reach existing stored
   decks), per-section masterclass review cards via `aegis:sift-cards` in `_mcNavigate`,
   generator owns the `card-arena-*` namespace. `test-retention-transfer.js` extended
   for the merge/purge/section-card behavior (280 assertions). Phase 2: DONE.
2. **Phase 4 transfer study** — protocol written, not run. Both outcomes are worth
   having; the app cannot claim "it trains" until this is measured.
3. **Game-surface honesty findings** (audit of 2026-09-20) — **FIXED 2026-09-21**:
   - Pattern Recognition axis: now measured from the attempt log (`context: 'arena'`,
     held-out excluded) via `onboarding.js arenaAccuracyFromAttempts()` + injected into
     `_computeCompetencyScores({ arenaAccuracy })`; Resilience Index reweighted
     0.30/0.30/0.15/0.15/0.10 (tests updated).
   - Gauntlet end screen: separate Points (game score) vs real correct-count;
     Accuracy = correct÷answered with the denominator shown.
   - InfoWar AAR-diagnostic guaranteed-correct attempt removed (campaign-completion
     attempt kept, `correct: Boolean(eng.won)`).
   - Dead `_renderForensics()` (fabricated SUSPECT percentages) deleted;
     `mediaForensics.js` owns the subtab.
   - Found & fixed during live verification (pre-existing): `_answerGauntlet` used an
     undefined `host` — every answer threw ReferenceError before feedback/scoring. The
     full live path now works (verified in-browser: answers, crit hits, honest debrief).
   - OSINT confidence fabrication — FIXED 2026-09-23: the pivot drill no longer hardcodes
     `confidence: 'sure'`; it mounts the shared sticky control (`#drill-confidence-host`)
     and `recordAttempt` reads the operator's actual claim. `evaluateCaseAnswer` also lost
     its `='sure'` default — an unstated level now fails closed with score 0. Pinned by
     Tier 4b of `tests/test-analyst-desk.js`.
4. **Browser E2E in CI.** Add a workflow; report headless vs browser numbers
   separately (the §8 review's own wording, still open).
5. **§8 hardening leftovers:** one-click legacy private-JWK rotation; move `index.html`'s
   inline `style=""` (486 occurrences, file now 2,956 lines) off inline styles so
   CSP `style-src` can drop `'unsafe-inline'`.

## 7. Unapproved proposals / small items (from `docs/manual-improvement.md`)

- **N1** record chosen distractor — **DONE** (schema v3 `chosen`).
- **N2** SM-2 answer-before-reveal — **DONE** (`sm2-diagnosis` context; the standalone
  build contains it — 10 occurrences — so the old "STALE" flag is resolved).
- **N3** score the mute Prebunking choices — **DONE** (all choices non-zero delta,
  3-stage scenarios, `test-retention-transfer.js` enforces it).
- R4–R11 cheap items remain open as listed in the old handoff §5.6 (C2PA external
  verify link, OSINT methodology relabel — partially done via the Analyst's Desk,
  DISARM Blue wiring — partially done via AAR, key-assumptions check, inoculation
  design patterns, positioning).

## 8. Commands

```bash
npm test                  # 44-suite headless gate + reverse-face-search Playwright suite
npm run test:e2e          # browser E2E (headless Chromium CDP) — separate, no CI yet
npm run test:browser      # Playwright browser suite
node tools/tag-skills.mjs # content-tagging gate (fails on untagged / held-out leakage once extended)
node build-standalone.mjs # single-file build — needs esbuild (NOT installed); on Windows spawn npx.cmd or set shell:true
```

## 9. Key files

| File | Role |
|---|---|
| `js/attempts.js` | The one recorder; 15 contexts |
| `js/attemptlog.js` | Append-only log, `SCHEMA_VERSION = 3` |
| `js/competency.js` | Mastery, calibration, transfer, rank (pure) |
| `js/confidence.js` | Sticky sure/unsure/guess control |
| `js/profile.js` / `js/profilestore.js` | PDP scoring / storage (pure / I-O) |
| `js/modules/spacedRepetition.js` | Memory Vault; `SM2_QUALITY_MAP`, enqueue, diagnosis |
| `js/modules/onboarding.js` | Operator profile composite (⚠ dead `arena.stats` key) |
| `js/inoculation.js` | PDP slice 3 selector (pure) — 120-assertion suite |
| `js/modules/inoculationAdaptive.js` | PDP slice 3 view + Prebunking entry card |
| `tools/tag-skills.mjs` | Tagging gate — also rejects held-out SM-2 cards |
| `tools/gen-sm2-cards.mjs` | Deck generator (274 cards; owns `card-arena-*`) |
| `tests/run-all.js` | Suite registry — 45 entries |
| `sovereign-aegis-standalone.html` | FRESH (rebuilt 2026-09-20 with slice 3 + retention) |

## 10. Unrelated but in this repo's history

- Reverse Face Search (Hugging Face static Space frontend handoff) — fixed state
  bug + Playwright coverage riding in `npm test`; not AEGIS roadmap work.
- The 2026-09-20 remote merge brought non-AEGIS work into the history (nexus /
  hardware-acceleration commits); AEGIS docs are unaffected.
