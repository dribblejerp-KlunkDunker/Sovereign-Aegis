# SOVEREIGN // AEGIS — Status Snapshot

**Date:** 2026-09-20
**Purpose:** a dated, point-in-time record of where the project stands. The living
handoff remains `SESSION-HANDOFF.md`; this file captures what changed since it was
written and what is true right now, so future sessions can verify rather than assume.

---

## What this is

An offline-first, browser-native intelligence and cognitive-defense training suite.
Vanilla ES modules, WebCrypto, Web Audio, Canvas, pure mathematical estimators —
zero build tools, zero runtime dependencies. Four pillars (Cognitive Fortification,
Real-Time Protection, Signal & OSINT Forensics, Collective Defense) on a shared
foundation (StateStore, persistence, WebCrypto, attempt logging, Bayesian
competency estimation). Full architecture and feature inventory: `PROJECT.md`.

## Current state

- **Fully versioned and on GitHub, working tree clean.** All AEGIS work is committed
  to `master` and pushed to `origin` (Black-Vault-Backup-V2). HEAD is `f49988c`
  (2026-09-20, a merge of a new remote into master). The only untracked file is a
  stray `rustup-init.exe` (tooling, unrelated to AEGIS — safe to delete or ignore).
  The 2026-08-22 handoff's "heavily modified, UNCOMMITTED" state is long gone.
- **Verification gate, measured 2026-09-20:** `node tests/run-all.js` →
  **45 suites, 17,350 assertions, 0 failures** (~9.1 s). Composition: 10,809 (62%)
  static dataset/schema validation, 6,541 logic/crypto/fuzz/static-HTML checks.
  Browser E2E is a separate gate (`npm run test:e2e`) and is **not included** in
  that number — and still has no CI job to run it (see open items).
- **The standalone single-file build is FRESH** — rebuilt 2026-09-20 with the retention
  wiring and the adaptive inoculation engine (esbuild resolved via npx during live
  verification).
- **Milestones 1–5 complete.** Historical chapter closed; the four original
  milestones plus the Phase 1–3 / Phase 5 / Phase 7 work and the retention part-1
  tracks are all DONE. Phase 4 (transfer study) has a written protocol and has not
  been run; Phase 2 (retention coverage) is done, PDP slice 3 shipped (2026-09-20).

## Open items (priority order)

1. **Phase 4 — demonstrate transfer.** Protocol written
   (`docs/transfer-study-preregistration.md`); the study has not been run.
2. **Honesty-audit findings on the game surfaces** — FIXED 2026-09-21:
   - "Pattern Recognition" now measures real arena attempts from the local attempt log
     (`onboarding.js arenaAccuracyFromAttempts()`, held-out excluded; the dead `arena.stats`
     read is gone). Resilience Index reweighted to 0.30/0.30/0.15/0.15/0.10 (sums to 1).
   - Fallacy Gauntlet end screen now tracks a real correct-count: shows Points (game score),
     Accuracy = correct÷answered, and the denominator. (60-Second Triage end screen was
     already accurate.)
   - InfoWar's guaranteed-correct AAR-diagnostic attempt is removed — selecting a diagnostic
     is reading, not answering. The campaign-completion attempt remains (correct = won/lost).
   - Dead `_renderForensics()` with its fabricated "72/88/95% SUSPECT" presets is deleted;
     the forensics subtab is rendered by `mediaForensics.js` as designed.
   - Bonus (found during live verification, pre-existing): `_answerGauntlet` referenced an
     undefined `host` — every Gauntlet answer threw before scoring/feedback. Fixed; the
     click path now works end-to-end (verified live: 4 answered → honest debrief).
3. **Browser E2E in CI.** Still no CI workflows exist. The headless gate is honest;
   the browser gate has to actually run somewhere.
4. **§8 hardening leftovers** (`ROADMAP.md` §8): one-click legacy private-JWK
   rotation, and moving `index.html`'s 486 inline `style=""` occurrences off inline
   styles so CSP `style-src` can drop `'unsafe-inline'`. (The "2,507 lines" figure
   in the old §8 is stale — the file is 2,956 lines now; the *finding* stands.)

## Standards that stay in force

Every displayed number must be measured or estimated from real attempts — never
simulated to look alive. The host repo enforces this via its check suite
(`check-fabricated-metrics.js`); AEGIS shares the rule — the 2026-09-20 game-surface
violations (open item 2) are now fixed. Any new feature inherits the rule before the
first commit.

## How to run

```bash
npm test                 # headless gate (45 suites) + reverse-face-search Playwright suite
npm run test:e2e         # browser E2E — separate gate, no CI yet
node tools/tag-skills.mjs  # content-tagging gate
node build-standalone.mjs  # single-file build (needs esbuild; npx spawn is broken on Windows — spawn npx.cmd or set shell:true)
```

No build step for the multi-file app: serve statically (`serve.mjs` / `serve.cmd`)
and open.
