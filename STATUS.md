# SOVEREIGN // AEGIS — Status Snapshot

**Date:** 2026-09-25 (amended; original snapshot 2026-09-20, previously amended 2026-09-24)
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
  (Amended 2026-09-24: **46 suites, 18,527 assertions, 0 failures** — the transfer-study
  suite joined the gate and the verifier fix added 19 pins. Amended twice on 2026-09-25:
  **47 suites, 18,627** — the honesty-chrome work in item 3 added 48 pins and two legacy
  M1 seeds were de-theatricalized; then **48 suites, 18,644** — the CI notification
  guards in item 4 added 17 pins.)
  Browser E2E is a separate gate (`npm run test:e2e`) and is **not included** in
  that number — CI triggers it only on demand via workflow_dispatch (see open items).
- **The standalone single-file build is FRESH** — rebuilt 2026-09-20 with the retention
  wiring and the adaptive inoculation engine (esbuild resolved via npx during live
  verification), again 2026-09-24 carrying the signature-verifier fix, and again
  2026-09-25 carrying the honesty-chrome replacements.
- **Milestones 1–5 complete.** Historical chapter closed; the four original
  milestones plus the Phase 1–3 / Phase 5 / Phase 7 work and the retention part-1
  tracks are all DONE. Phase 4 (transfer study) has a written protocol and has not
  been run; Phase 2 (retention coverage) is done, PDP slice 3 shipped (2026-09-20).

## Open items (priority order)

1. **Phase 4 — demonstrate transfer.** Protocol written
   (`docs/transfer-study-preregistration.md`); the study has not been run. The entire
   pre-enrollment machinery is now BUILT AND PINNED (2026-09-23, see
   `docs/transfer-study/README.md`): hashed held-out forms (T0=24/T1=24, one item
   per skill stratum across all 24 skills, app transfer-probes excluded), the 400-row
   hashed allocation sequence, the §3-mandated power simulation (n=400 stands: ≥99%
   power at 15 pp across the whole clustering range; 5 pp honestly underpowered at
   ~74–87%), and the frozen primary-analysis script (participant cluster bootstrap,
   Wilson/Newcombe secondaries).
   **   PILOT DESIGNED 2026-09-25 (`docs/transfer-study/pilot-design.md`): the smallest
   honest rung below the trial — two arms on the FROZEN kit, unmodified (allocation
   rows 1–24 in seq order, §5 dose verbatim, frozen analyze.mjs untouched). Enroll 24
   (16 = floor; 12+ measures machinery, not effect), expect ~9 per arm complete at
   75%, CI half-width ≈ 9–10 pp → τ = 15 pp detectable, 8 pp suggestive, 5 pp
   honestly out of reach at any pilot size. Per-participant burden ≈ 2 h (T0 + five
   15–20 min sessions over 14 days + T1 within 48 h); ~4 weeks for one wave,
   6–8 weeks solo-operator with two waves. Adds a descriptive calibration-shift
   table and feasibility metrics; small-sample bootstrap undercoverage is stated and
   mitigated by reporting per-participant D + sign test alongside the CI. Mandatory
   pre-checks restated: ethics/consent BEFORE enrollment, and a contamination
   pre-check (candidate attempt log × exclude-ids.json — the operator's own install
   is almost certainly contaminated). Kit integrity re-verified (44/44) and analysis
   selftest still recovers a planted effect.
   FROZEN 2026-09-23, REVISED SAME DAY**: the original 20/19 forms covered only 20
   of 24 skill strata — the four SIFT strata had zero eligible items. 40 new held-out-
   eligible items (q146–q185) were authored to widen coverage: forms are now 24/24
   with every skill represented in both, the review packet is a 48-item worksheet,
   and the OSF bundle was re-frozen under `MANIFEST.sha256` rooted at
   `b632ee84d304b5d5…` (superseding `8df2056506e1c336…`). All hashes re-anchored; the
   remaining work is human-only: complete the ground-truth review, ethics
   review, OSF registration, recruitment, sessions, and the real export → analyze run.
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
   - OSINT confidence fabrication — FIXED 2026-09-23: the Rapid Pivot Gauntlet no longer
     records `confidence: 'sure'` for every answer; it mounts the shared sticky control and
     records what the operator actually claimed. `evaluateCaseAnswer` fails closed (score 0)
     when confidence is not explicitly stated. Pinned by `tests/test-analyst-desk.js` Tier 4b.
3. **Dead-control audit (2026-09-24) — ALL FIVE FINDINGS FIXED 2026-09-24.**
   Every `store.set`/`get`/`subscribe` key and every DOM control id was inventoried and
   traced to the code that should act on it; a control counts as dead only when nothing
   that reads it changes feature behavior (pill labels and modal-echo reads don't).
   Findings, each with a fail-loud pin in `tests/test-dead-controls.js` (52 assertions,
   registered in the gate):
   - **FIXED 2026-09-24** — Signature Verifier ignored the pasted public key
     (`#input-verify-pubkey`): the handler verified everything against the operator's
     own key while the UI advertised independent verification. `AegisCrypto.parsePublicKey()`
     and the new `didKeyToJwk()` (multicodec parse + P-256 point decompression via
     Tonelli–Shanks) accept a pasted `did:key:z…` or JWK JSON; the result toast names the
     trust anchor used; an empty field falls back to the own key. The pre-existing
     signer/verifier asymmetry (a self-asserted `timestamp` in the signed statement) is
     also fixed — the panel's sign→verify round-trip now succeeds. 19 new pins in
     `tests/test-crypto.js`; gate 18,527/18,527; verified live through the real UI
     (foreign signature verifies, wrong key fails, garbage rejected, fallback works).
     **Strengthened 2026-09-25 (E2E assertion):** the browser E2E check for this control
     no longer accepts any feedback toast as pass evidence. It now mints a genuinely
     foreign P-256 keypair in-page with the app's own `AegisCrypto`, signs a fresh claim
     with it, and requires the exact `SIGNATURE VALID` toast against the PASTED foreign
     key — plus `SIGNATURE INVALID` for that same signature against the operator's own
     key, the exact false-pass this fix removed. Proven to bite via a mutation drill:
     with the own-key bug temporarily reintroduced on a scratch copy, exactly the
     foreign-key assertion failed ("valid" expected, "invalid" got) until the real code
     was restored byte-identically. E2E suite is now **128/128** (was 126).
   - **FIXED 2026-09-24** — Arena TRANSFER PROBE badge never shown: `#arena-active-probe`
     was hardcoded `hidden` and no JS toggled it, so the operator could never see when a
     held-out probe was measuring them. `InfiniteArena._updateProbeBadge()` now toggles
     the badge from `q.heldOut` on every question render. Verified live: badge appears on
     a probe draw, hides on practice draws.
   - **FIXED 2026-09-24** — `#check-include-custom-cards` was a no-op: the Epistemic
     Commons pack builder read only the dossier checkbox, so custom Memory Vault cards
     were never included either way. Pack assembly is extracted to a testable
     `_assemblePack()`; checked, it maps every `card-custom-*` Vault card into the pack
     and the declared `stats.cards` always matches the pack body. Verified live against
     the real store and a real Vault-shaped card.
   - **FIXED 2026-09-24** — "Calibrated Mode" card was unbound: `#btn-mode-calibrated`
     had no click handler while the other three mode cards each wired `startRound`.
     It now starts a real mode under an explicit-calibration contract: an answer (pointer
     OR keyboard) is refused until the shared confidence control is tapped THIS question,
     the tapped level rides both the attempt log and the round history (never defaulted),
     and each new question re-locks until a fresh statement. This also feeds the
     previously-orphaned `arena-confidence-host` control with real consequence.
     Verified live: locked → tap `unsure` → unlocked → answer → attempt logged with
     `confidence: 'unsure'`.
   - **FIXED 2026-09-24** — DID-export modal was a static prop: `#modal-did-export`
     rendered a hardcoded example credential (`did:key:z6MkuA9vR7q…`) and
     `#btn-copy-jsonld` had no handler. The opener now populates the modal from the
     operator's LIVE identity via `IdentityModule._buildDidExport()` — a W3C DID Document
     (public coordinates only) plus a self-signed Verifiable Credential whose signed
     material IS the credentialSubject, matching the app's own verifier contract, so the
     displayed credential verifies with the app's verify path (proven in the pin suite);
     copy exports exactly what is displayed; no identity → the modal says so; a missing
     signing key still exports the DID Document with the credential visibly absent.
     Verified live: modal opens carrying the real DID and a credential that verifies.
   - **No action** (recorded so a future auditor doesn't re-flag them): state keys
     written but read by nothing (`identity.keyStorage`, `identity.created`,
     `app.initialized`, `app.drawerOpen`, `app.activeModal` — bookkeeping or natural
     future display surfaces); the ticker statics (THREAT pill, EPOCH, IMMUNITY INDEX)
     are deliberate theatrical chrome; the `telemetry.*` suspects are alive via
     `store.subscribe`; the `identity.privateKeyJwk` write is the deliberate null-scrub.
   - **AMENDED 2026-09-25 — the ticker statics are no longer theatrical chrome.** The
     "No action" verdict above stands only for the 2026-09-24 snapshot. On 2026-09-25
     the three statics were replaced with honest derivations (owner-approved):
     - **THREAT pill** (`#threat-index-val`): renders `THREAT: UNAUDITED` (amber) until a
       completed, operator-submitted VERDAD audit exists, then `THREAT: <LEVEL> (<risk>%)`
       from `VerdadEngine.deriveThreat()` — pure, using Verdad's own credibility bands
       (≥70 CRITICAL / ≥40 HIGH / ≥25 MODERATE, else LOW; clamps, fails closed to null).
       `executeAudit` publishes to `verdad.lastAudit`; the shell subscribes the pill to it
       and the hover tooltip names the audited claim. The mount-time preset analysis is
       deliberately excluded — the operator never submitted that claim.
     - **IMMUNITY INDEX** (`#telemetry-immunity-val`): `UNMEASURED` until attempts exist,
       then the mean decay-weighted mastery over ATTEMPTED skills only
       (`competency.estimateAggregate()` — new, pure, held-out probes excluded, cold-start
       prior never scored) with n and skill count attached, e.g. `52% RESILIENT (n=35,
       10 skills)`. Recomputed from the raw log on boot, tab entry, log import, and arena
       round end — never cached, never seeded.
     - **EPOCH** (`#telemetry-epoch`): relabeled `PRACTICE EPOCH`; `D+<days>` since the
       first logged attempt via `competency.practiceDaySpan()` (new, pure), ticking on the
       1 s clock; before any history it renders the labeled session age `SESSION hh:mm:ss`
       so it cannot masquerade as a project epoch.
     - The fictional seed values (`telemetry.threatLevel`, `epistemicHealth`,
       `blockHeight`, `syncStatus`, `sentinelMode`, `uptimeSeconds`) are deleted from
       `state.js` — no code path can resurrect them; the telemetry heartbeat keeps only
       measured keys. Two legacy M1 pins that enshrined the old seeds were updated.
     - Evidence: 48 new pins in `tests/test-dead-controls.js` (52→100; statics-regression,
       boundary math, and shell-wiring pins against the real `AegisApp` object); gate
       **18,627/18,627** (47 suites); browser E2E **126/126**; verified live — a real
       audit moved the pill to `THREAT: CRITICAL (94%)` with the claim in the tooltip, and
       the derived values restored from the persisted record after a cold reload; the
       standalone was rebuilt carrying all of it.
   - Audit trail: full gate after all fixes **18,579/18,579** (46 suites + the new
     Dead-Control Regression Suite); every fix also exercised through the running app.
     Bonus finding folded into the Calibrated Mode fix: `arena-confidence-host` existed
     in the markup but nothing mounted into it.
   - **AMENDED 2026-09-26 — honesty purge II: the remaining theatrical telemetry.** The
     chrome fix above covered the ticker statics; a final pass removed the last
     simulated numbers, applying the same standard — every displayed value measured or
     derived from real state, fail-loud when there is nothing to show:
     - **Heartbeat latency** no longer jitters. It used to render `Math.random()`
       milliseconds against a fictional peer list; it now measures a real round-trip —
       a JSON probe written to and read back from `localStorage` under
       `aegis-latency-probe`, timed with `performance.now()`, on the same cadence the
       old jitter ran. No sample yet → `MEASURING…`; a real result on a local origin →
       `<1ms (LOCAL)` or `Nms (LOCAL)`. Verified live: `<1ms (LOCAL)`.
     - **Seed fiction deleted at the root.** `state.js`'s SEED_STATE lost its
       `attestation` view, `consensus` peer list, `alerts` feed, and
       `identity.reputationScore`; `telemetry` now seeds exactly three keys —
       `networkLatencyMs`, `lastTick`, `activeAp` — all `null`. No code path can
       resurrect the removed blocks; a comment at each deletion site records why.
     - **SENTINEL pill is now a derived posture**, not a stored string:
       `_computeSentinelPosture()` renders `ARMED` only when a real identity exists AND
       the vault/session key is live AND AttemptLog is available — otherwise `UNPROVEN`,
       with the specific missing precondition(s) in the hover title. Recomputed on boot
       and on every identity/vault/attempt-log change via the chrome-honesty
       subscriber.
     - **AP ticker renders campaign reality.** `AP: — (NO CAMPAIGN)` until an infowar
       campaign mounts, then the campaign's real `apPerTurn`; `infowar.onUnmount` nulls
       `telemetry.activeAp` so the ticker cannot outlive its campaign. The in-game
       `#infowar-ap-badge` was already real game state and is untouched.
     - **Boot migration purges persisted fiction** (state-migration step 3.45): profiles
       saved before this purge carry the old theatrical blobs, so boot deletes the
       `attestation`, `consensus`, and `alerts` paths, the legacy telemetry keys
       (`activeNodes`, `blockHeight`, `syncStatus`, `threatLevel`, `sentinelMode`,
       `epistemicHealth`, `uptimeSeconds`), and `identity.reputationScore` before the
       UI ever sees them. Verified live on a contaminated profile: the three blocks
       report ABSENT after reload.
     - Pins re-pointed, not deleted: the two M1/stress pins that traversed the removed
       seed paths now exercise real ones (`identity.credentials`, `telemetry.lastTick`,
       `telemetry.activeAp`); the E2E posture pins accept the derived ARMED/UNPROVEN
       pair; the Dead-Control Regression Suite gained an "Honest chrome II" describe
       (seed-absence checks, heartbeat-measurement regex pins, sentinel/AP/latency
       derivation pins with a localStorage stub) — **122 pins**, suite total unchanged
       in count only.
     - Evidence: gate **18,684/18,684** (48 suites); browser E2E **128/128**; live
       browser check confirmed SENTINEL derived from real state, honest AP, measured
       latency, and the migration scrub; standalone rebuilt and grep-verified to carry
       zero traces of the fiction (`peer-alpha-01`, `HARDWARE_SECURE`, `24ms (EDGE)`,
       random jitter) while carrying all honest placeholders.
   - **AMENDED 2026-09-26 (later) — honest chrome III: the audit of everything else
     that displays.** A full-UI audit (dynamic DOM sweep + static grep) found three
     remaining theatrical surfaces, all now fixed to the same standard:
     - **Nav-rail stat badges were hardcoded copy, and one was wrong.** `4 COURSES`,
       `10 AP`, `50+ SITES`, `5 ACTIVE`, `60+ DOSSIERS`, `38 ITEMS` were static strings
       masquerading as counts. Each is now derived by its owning module from the real
       loaded dataset (cognitive `masterclass.json`, infowar `scenarios.json` max
       `apPerTurn`, osint platform-template count, early-warning domain/incident
       counts, reputation `sources.json`, defense `profile-items.json`), with a labeled
       `N/A` fallback if the dataset fails to load. The live app now shows `4 COURSES`,
       `3 SCEN · 10 AP MAX`, `8 SITES`, `6 DOM · 12 INC`, **`55 DOSSIERS`** (the old
       copy claimed 60+ — wrong), and `38 ITEMS` — every one a real count.
     - **The OSINT recon flow fabricated results end-to-end.** A hardcoded platform
       table shipped simulated `FOUND` / `VERIFIED PGP` / `CLEAN` statuses, an 800 ms
       fake scan delay claimed "SCANNING 50+ NODES...", then "RECON COMPLETE (5
       FOUND)" and a toast inventing "2 active infrastructure ties". The app is
       offline-only, so none of that could be real. The pivot now renders an honest
       PLAN: the 8 platform URL templates with `NOT CHECKED` badges, a prominent
       "NO LIVE SCAN PERFORMED" brief explaining that the operator performs the
       lookups and records what they observe — no delay, no invented results, no
       fake toast.
     - **View 08 (Threat Radar) ignored its own dataset.** `early_warning.json`
       carries 6 domains with polar coordinates, threat levels, 12 active incidents
       and 6 DISARM playbooks — but the module rendered 3 hardcoded blips, a
       hardcoded incident card, a fictional 3-alert fallback if the fetch failed, and
       a "360° POLAR SWEEP ACTIVE / Real-time threat monitoring" claim. Now: blips
       plot from the dataset's own `radarAngle`/`radarDistance`/threat fields, the
       dossier renders the selected domain's real first incident with its real 4-step
       playbook, a failed load renders a labeled `DATASET: UNAVAILABLE` (no substitute
       fiction), and the header badge reports the true `DATASET: N DOMAINS / M
       INCIDENTS`. The reputation module's hardcoded fake-ratings fallback list
       (Reuters/AP/RT with invented scores) and the profile view's invented "~6 MIN"
       estimate were removed in the same pass — `|| 90` credibility defaults no longer
       fabricate ratings either.
     - Pins: "Honest chrome III" describe added to the Dead-Control Regression Suite
       (badge derivation + fail-loud, radar geometry, dossier container, recon-truth,
       no-fictional-fallbacks, view-08 copy); M1 nav-badge pins re-pointed; E2E now
       asserts the dataset badge and that `early_warning.json` actually loads; tier-4
       asserts the pivot PLAN and the absence of any `FOUND` badge. Gate
       **18,732/18,732** (48 suites); browser E2E **129/129**; verified live — all six
       badges derived, radar renders 6 data-plotted blips, dossier shows a real
       incident with its 4-action checklist, pivot grid shows the honest plan.
   - **AMENDED 2026-09-26 (same audit, follow-up sweep) — inflated view-header counts.**
     A second pass over visible copy caught three more count claims: the cognitive
     header's "4 MASTERCLASSES • 22+ FALLACIES" (the dataset actually ships 24 — "22+"
     was stale), the OSINT header's "50+ PLATFORMS • INTERACTIVE GRAPH" and the
     Sherlock card title's "(50+ Sites)" (the toolkit ships 8 templates), and the
     reputation header's "60+ SOURCE DOSSIERS" (the dataset ships 55). The two
     count-bearing headers are now derived live from the loaded datasets
     (`#cognitive-header-badge`, `#reputation-header-badge` — fail-loud on load
     failure); the OSINT header and Sherlock title no longer cite invented reach.
     Live-verified: `4 MASTERCLASSES • 24 FALLACIES`, `55 SOURCE DOSSIERS`. Gate
     **18,738/18,738**; browser E2E **129/129**.
4. **Browser E2E in CI — DONE 2026-09-24.** `.github/workflows/ci.yml` (added 2026-09-23
   with the honesty-fix commit `1679630`) runs the headless gate on every push, and the
   browser E2E suite on demand via workflow_dispatch **and nightly via schedule**
   (`cron '30 3 * * *'`; GitHub runs scheduled workflows from the default branch only),
   so E2E regressions surface without a manual run. Note: the nightly job only
   exercises commits that are pushed to GitHub — local uncommitted work needs the
   usual local `npm run test:e2e` first.
   **AMENDED 2026-09-25 — nightly failures now notify.** A red scheduled run previously
   failed silently in the Actions tab. The workflow (needs `issues: write`) now:
   on `failure() && schedule`, opens or appends to a `nightly-failure` issue carrying
   the run link, the head, and the failure lines from both logs, assigned to and
   cc-ing the repo owner — GitHub's own notification email is the delivery channel,
   no external alerting service; on `success() && schedule`, any open tracking issues
   are auto-closed with the green run link, so an open issue always means "the last
   nightly was red" rather than accumulated cruft. The notify step deliberately has no
   `continue-on-error` — a broken notification fails the run loudly. Guarded by 17
   structural pins in `tests/test-ci-workflow.js` (registered as the 48th suite):
   removing the schedule, the permission, or either step fails the gate. YAML
   re-validated with pyyaml; both step scripts pass `bash -n`. Caveat: the nightly only
   runs from the pushed default branch, so the first real notification exercise happens
   on the first scheduled run after the next publish.
   **AMENDED 2026-09-25 (same day) — notifier drill.** Waiting for a real red nightly to
   learn whether the notifier works is the wrong test. `ci.yml` now takes two manual
   `workflow_dispatch` inputs: `drill_notifier` (skip the gates, exercise the EXACT
   notifier plumbing — label bootstrap, create-or-append, assignment — against a real
   GitHub context) and `drill_leave_open` (leave the drill issue open to verify the cc
   @mention email actually arrives, instead of closing it in the same run and exercising
   the auto-close mechanics too). Safety: the drill steps are reachable ONLY via an
   explicit manual dispatch — schedule and push can never reach them — and drill issues
   carry their own `notifier-drill` label, so a drill can never create, append to, or
   close the real `nightly-failure` tracker. Guard suite grew to 35 pins (drill
   reachability, label isolation, drill-scoped gate skipping); gate **18,662/18,662**.
   **Drill FIRED 2026-09-25 23:30 UTC** (run #10, `workflow_dispatch`, drill_notifier):
   completed `success` in ~31 s with the gates correctly skipped; it created issue #1
   (`[DRILL] Notifier exercise — 2026-09-25`, labeled `notifier-drill`, assigned to the
   owner, cc @mention in the body) and the same run's auto-close step closed it with a
   bot comment — create, assign, append-plumbing and close all proven live before the
   first real scheduled failure. Remaining unproven: actual email delivery of the cc
   (run a drill with `drill_leave_open` to check the inbox), and the nightly path's
   log-scraping body (it needs a real red run's logs).
   **EMAIL DELIVERY CONFIRMED 2026-09-25 ~23:50 UTC.** A leave-open drill (run #12,
   `drill_notifier` + `drill_leave_open`; create step succeeded, auto-close correctly
   skipped, a NEW issue #2 created rather than appending to the closed #1 — label
   isolation behaving as pinned) produced a notification email the operator actually
   received. The notifier's full chain is therefore proven end-to-end: issue creation,
   assignment, cc @mention, and email delivery to the owner's inbox. What remains
   nightly-only: the red-run log-scraping body, which still needs a real failing
   scheduled run to exercise. Both drill issues (#1, #2) were closed after the
   confirmation; the delivery proof lives in this record.
   **FIRST SCHEDULED NIGHTLY FIRED 2026-09-26 08:44 UTC — GREEN, NOTIFIER CORRECTLY
   SILENT (run #15, event `schedule`, head `808d6ee`).** Conclusion `success` in ~64 s.
   Timing caveat, recorded honestly: the cron slot is `30 3 * * *`, but GitHub queued
   the run ~5 h 14 m late (08:44 UTC) — scheduled workflows are best-effort, so the
   slot fires unpunctually but does fire; the run still checked out and gated the
   default-branch head at trigger time. Step-level results: checkout/setup green,
   **Headless gate green**, **Browser E2E green** (its nightly branch active), the
   `Open or update nightly-failure issue` step correctly **skipped on green**, the
   `Auto-close nightly-failure issue on green` step ran live for the first time as its
   designed no-op (nothing open to close — the real close branch was already proven in
   drill run #10), and both drill steps were unreachable by schedule and skipped, as
   pinned. Issue tracker confirms zero `nightly-failure` issues have ever been
   created — correct silence, no email on a green run. What this proves: the schedule
   path is now live-proven end-to-end for a green run, on top of the drill-proven
   create/assign/append/close/email chain. The only unproven branch left in the
   notifier is the red-path log-scraping body, which requires a genuinely red
   scheduled run to exercise. Follow-up CI run #16 (push, `415be1a`, the honesty-purge
   commit) also completed green, so the purged code passed CI on push as well.
5. **§8 hardening leftovers** (`ROADMAP.md` §8): one-click legacy private-JWK
   rotation, and moving `index.html`'s 486 inline `style=""` occurrences off inline
   styles so CSP `style-src` can drop `'unsafe-inline'`. (The "2,507 lines" figure   in the old §8 is stale — the file is 2,956 lines now; the *finding* stands.)

## Standards that stay in force

Every displayed number must be measured or estimated from real attempts — never
simulated to look alive. The host repo enforces this via its check suite
(`check-fabricated-metrics.js`); AEGIS shares the rule — the 2026-09-20 game-surface
violations (open item 2) are now fixed. Any new feature inherits the rule before the
first commit.

## How to run

```bash
npm test                 # headless gate (48 suites) + reverse-face-search Playwright suite
npm run test:e2e         # browser E2E — separate gate, no CI yet
node tools/tag-skills.mjs  # content-tagging gate
node build-standalone.mjs  # single-file build (needs esbuild; npx spawn is broken on Windows — spawn npx.cmd or set shell:true)
```

No build step for the multi-file app: serve statically (`serve.mjs` / `serve.cmd`)
and open.
