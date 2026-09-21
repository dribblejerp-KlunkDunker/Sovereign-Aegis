# Project: SOVEREIGN // AEGIS — Offline Epistemic Defense Training Suite

## What this is

An offline-first, browser-native intelligence and cognitive-defense training suite.
Vanilla ES modules, WebCrypto, Web Audio, Canvas, pure mathematical estimators —
zero build tools for the multi-file app, zero runtime dependencies, zero telemetry.
Local-first by design: assessment data never leaves the device
(`DESIGN-product-decision.md` D1).

Posture (2026-09-20): an auditable, local-first instrument suite and curriculum for
epistemic defense. It measures what it says it measures, states what it cannot
conclude, and keeps its data on your machine. It is not yet *demonstrably* a training
system that builds detection capability — the transfer study
(`docs/transfer-study-preregistration.md`) is written but not yet run. That gap is
tracked in `ROADMAP.md` §0 (Critique B).

## Architecture

```
                      ┌────────────────────────────────────────┐
                      │        SOVEREIGN // AEGIS UI           │
                      │ (Dark Granite / Bronze / Garamond /    │
                      │  Cinzel / JetBrains Mono)              │
                      └───────────────────┬────────────────────┘
                                          │
    ┌──────────────────┬──────────────────┼──────────────────┬──────────────────┐
    ▼                  ▼                  ▼                  ▼                  ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│   PILLAR I    │ │   PILLAR II   │ │  PILLAR III   │ │  PILLAR IV    │ │  FOUNDATION   │
│ Cognitive     │ │ Real-Time     │ │ Signal & OSINT│ │ Collective    │ │ State, Crypto │
│ Fortification │ │ Protection    │ │ Forensics     │ │ Defense       │ │ & Assessment  │
├───────────────┤ ├───────────────┤ ├───────────────┤ ├───────────────┤ ├───────────────┤
│ • SIFT Labs   │ │ • VERDAD      │ │ • Web Audio   │ │ • InfoWar     │ │ • StateStore  │
│   + Triage    │ │   Dialectic   │ │   STFT DSP    │ │   10 AP Sim   │ │ • Persist IDB │
│ • SM-2 Memory │ │ • Adversarial │ │ • 2D FFT, ELA │ │ • Epistemic   │ │ • WebCrypto   │
│   Vault       │ │   Sandbox     │ │ • C2PA Parser │ │   Commons     │ │ • AttemptLog  │
│ • Rhetorical  │ │ • Source      │ │ • Heuer ACH   │ │ • Operator    │ │ • Bayesian    │
│   Sandbox     │ │   Dossiers    │ │   Matrix      │ │   Profile     │ │   Competency  │
│ • Fallacy     │ │ • Prebunking  │ │ • OSINT Desk  │ │ • Attestations│ │ • Confidence  │
│   Gauntlet    │ │ • Keybinding  │ │ • Forensics   │ │ • Narrative   │ │   capture     │
└───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘
```

## Feature inventory

| # | Feature | Description | Status | Where |
|---|---------|-------------|--------|-------|
| 1 | SIFT Labs (4 labs) + 60-Second Triage | Stop/Investigate/Coverage/Trace drills with diagnostic feedback; arcade triage scored without a cynicism bonus | BUILT | `js/modules/siftLabs.js` |
| 2 | SM-2 Memory Vault | SuperMemo SM-2 scheduler with answer-before-reveal diagnosis; 208-card deck from `data/spaced_repetition_cards.json` | BUILT | `js/modules/spacedRepetition.js` |
| 3 | Rhetorical Sandbox | Premise/conclusion dissection, enthymeme drill, Socratic steel-manning | BUILT | `js/modules/rhetoricalSandbox.js` |
| 4 | Fallacy Gauntlet | Timed rapid-fire fallacy identification over `data/fallacies.json` quizzes | BUILT | `js/modules/cognitive.js` |
| 5 | VERDAD dialectic | 5-step epistemic CoT panel, adversarial challenge mode, source dossiers, offline pre-send gate (`js/verdad-service.js`) shared with the messenger | BUILT | `js/modules/verdad.js` |
| 6 | Prebunking / inoculation | 6 branching scenarios × 3 stages, every choice non-zero `resilienceDelta` | BUILT | `js/modules/cognitive.js` + `data/inoculation.json` |
| 7 | Media forensics | ELA, 2D FFT, STFT spectrogram, C2PA JUMBF/CBOR parse (parse-only, honestly labelled), video temporal/noise analysis | BUILT | `js/modules/mediaForensics.js`, `js/dsp.js`, `js/c2pa.js` |
| 8 | Heuer ACH matrix | Inconsistency/support math with credibility×relevance weights, 5-axis confidence | BUILT | `js/modules/ach.js` |
| 9 | OSINT Analyst's Desk | Methodology walkthrough + case drills (rapid pivot gauntlet) | BUILT | `js/modules/osint.js` |
| 10 | InfoWar simulator | Turn-based 10 AP wargame, SEIR contagion physics, AAR with DISARM diagnostics | BUILT | `js/modules/infowar.js` |
| 11 | Epistemic Commons | XSS-hardened community case packs (import sanitised, re-sanitised on load) | BUILT | `js/modules/epistemicCommons.js` |
| 12 | Competency spine | 24 skills, all content tagged, append-only attempt log, Bayesian mastery + calibration + transfer, held-out probing | BUILT | `js/competency.js`, `js/attemptlog.js`, `js/attempts.js` |
| 13 | Adaptive routing | 4-probe diagnostic placement, weak-skill drill routing, advisory (non-blocking) subtab prerequisites | BUILT | `js/modules/adaptiveRouting.js`, `js/modules/onboarding.js` |
| 14 | Transfer evaluation | T0 baseline / T1 follow-up on held-out items, 95% CI, honest caveat | BUILT | `js/modules/transferEval.js`, `js/transferPanel.js` |
| 15 | DID attestations | W3C VC issuance/verification, privacy-preserving claims, offline adjudication | BUILT | `js/modules/attestation.js`, `js/modules/identity.js` |
| 16 | Personal Defense Profile | 38-item dimensional inventory, bands-not-scores, observation log, salience-driven practice map, framework atlas | BUILT | `js/profile.js`, `js/profilestore.js`, `js/modules/profile.js` |
| 17 | Operator profile | 5-axis spiderchart, Resilience Index composite, next-action engine | BUILT | `js/modules/onboarding.js` |
| 18 | Standalone build | Single-file offline bundle with hashed CSP | BUILT (~2.1 MB, regenerated per feature) | `build-standalone.mjs`, `sovereign-aegis-standalone.html` |

Known gaps the roadmap tracks (not silently missing): Phase 2 retention *coverage*
(SM-2 deck is now **274 cards**, derived from every tagged practice arena question
with held-out items excluded at both the generator and the file gate; masterclass
section completion schedules review cards), the transfer study itself, and the §8
hardening leftovers. See `ROADMAP.md`.

## Milestones (historical record)

| # | Name | Status |
|---|------|--------|
| 1 | Pillar I: SIFT Labs, SM-2 bridge, Rhetorical Sandbox | DONE |
| 2 | Pillar II: VERDAD CoT, Adversarial Sandbox, Source Dossiers | DONE |
| 3 | Pillar III: STFT/FFT DSP, ACH, provenance labelling | DONE |
| 4 | Pillar IV: InfoWar, Operator Profile, Onboarding | DONE |
| 5 | Dataset validation & verification gate | DONE |
| 6 | Audit remediation (stored XSS, non-extractable keys, CSP, fonts) | DONE 2026-08-17 (`AUDIT.md`) |
| 7 | Second-review remediation (headers, BYOK memory-only, honesty of numbers) | DONE, leftovers tracked (`ROADMAP.md` §8) |
| 8 | Competency spine (Phase 1) | DONE 2026-08-17 |
| 9 | Evidence batch: confidence capture, item authoring, forensics drill, calibration panel | DONE (`ROADMAP-EVIDENCE.md`) |
| 10 | Phase 3 adaptive routing; Phase 5 simulation retirement; Phase 7 attestations | DONE 2026-09-06/07 |
| 11 | Retention machinery part 1 (enqueueCards, masterclass→card bridge, inoculation 3-stage) | DONE (Track 1/3/4) |
| 12 | Phase 4 transfer study | NOT RUN — protocol written, awaiting execution |
| 13 | Phase 2 retention part 2 (deck coverage from all tagged content; per-section masterclass review) | PLANNED — see `ROADMAP.md` Phase 2 |

## Interface contracts

All contracts below were verified against the code on 2026-09-20.

### Spaced repetition event (Pillar I → Memory Vault)
- **Event**: `window.dispatchEvent(new CustomEvent('aegis:sift-cards', { detail: { cards: Array<object> } }))`
- **Card schema**: `{ id, domain, prompt, diagnosis, latin?, mechanism, countermeasure, tests: string[], heldOut? }`
- **State path**: `sm2.deck` (JSON string in StateStore)
- **Behavior**: `SpacedRepetition.enqueueCards()` dedupes by id, seeds SM-2 parameters, and refreshes the Memory Vault UI live. Listeners: SIFT Labs (missed concepts), daily drill (misses), masterclass completion (per-skill review cards).

### Competency spine (all recording modules → estimator)
- `js/attempts.js` `recordAttempt({ skillIds, itemId, correct, context, latencyMs?, heldOut?, chosen?, confidence? })` — fire-and-forget, one record per tested skill, untagged items warn once and are dropped.
- **Contexts** (`js/attempts.js`): `arena`, `sm2`, `sift`, `fallacy-drill`, `inoculation`, `sandbox`, `forensics`, `messenger`, `infowar`, `sm2-diagnosis`, `masterclass`, `osint`, `osint-drill`, `diagnostic`.
- `js/attemptlog.js` — append-only IndexedDB store `sovereign-aegis-attempts`, `SCHEMA_VERSION = 3` (v2 added `confidence`, v3 added `chosen`; additive, no migrations).
- `js/competency.js` — pure: `estimate/estimateAll` (exponentially-weighted accuracy, Beta prior, DECAY=0.97), `calibration()` (Brier, reliability bins), `transfer()`, `rank()` (confidently-wrong boosted 2.5×), `confusionMatrix()`.

### PDP scoring (pure → view)
- `js/profile.js` — `compute(responses, items)`, `salience(context, responses, observations, items, {now})`, `buildGuide(...)`, `needsSupport(observation, supportCard)`. No I/O.
- `js/profilestore.js` — IndexedDB `sovereign-aegis-profile` (`responses` + `observations` stores), append-only, `SCHEMA_VERSION = 1`, scope vocabulary `['online','work','close','money','health','civic']`, wholesale reject on corrupt import.

### Heuer ACH (Pillar III)
- `I(H_j) = Σ max(0, −R_ij) × credibility_i × relevance_i`, ratings clamped to [−2,+2]
- `S(H_j) = Σ max(0, R_ij) × credibility_i × relevance_i`
- 5-axis confidence: `100 × (0.25·S_r + 0.25·C_c + 0.25·C_b + 0.15·T_f + 0.10·A_p) × max(0.1, 1 − 0.15·contra)`
- Implementation: `js/modules/ach.js`; ground-truth-tested (the `TEST_READY.md` restatement `Σ w_i × (rating × weight)` is wrong; the code is the source of truth).

### Operator profile 5-axis mapping
1. `siftVerification` — SIFT accuracy (`sift.stats`, written by `siftLabs.js`)
2. `patternRecognition` — Arena accuracy (**reads `arena.stats` — currently a dead key; nothing writes it. Tracked as an honesty-audit finding; treat that axis as 0 until fixed.**)
3. `memoryRetention` — SM-2 deck coverage with reps > 2 (`sm2.deck`)
4. `theoreticalDepth` — masterclass completions (`cognitive.progress`)
5. `analyticalPractice` — ACH analyses + VERDAD audits + InfoWar victories
- Resilience Index: `0.30·sift + 0.20·pattern + 0.20·memory + 0.15·theory + 0.15·practice`
- Implementation: `js/modules/onboarding.js` `_computeCompetencyScores()`.

## Code layout

- `index.html` — single-page shell (2,956 lines; inline `style=""` templates are a known §8 hardening leftover).
- `css/` — `variables.css`, `typography.css`, `layout.css`, `components.css`, `views.css`, `theme.css`.
- `data/` — 26 JSON datasets (`skills.json`, `arena_questions.json`, `fallacies.json`, `disarm.json`, `disarm_blue.json`, `sift_scenarios.json`, `spaced_repetition_cards.json`, `inoculation.json`, `rhetorical_arguments.json`, `masterclass.json`, `sources.json`, `profile-items.json`, `profile-guides.json`, `framework-notes.json`, `missions.json`, `narratives.json`, `forensic_samples.json`, `osint_cases.json`, `early_warning.json`, `answer_skill_map.json`, `community_packs.json`, `lens-guides.json`, `media_forensics.json`, `reputation.json`, `scenarios.json`, `verdad_rules.json`).
- `js/` (top level):
  - `inoculation.js` — adaptive inoculation selector (pure; see `js/modules/inoculationAdaptive.js`).
  - `app.js` — router/bootstrap.
  - `state.js`, `persist.js` — StateStore + IndexedDB mirror.
  - `crypto.js`, `keystore.js`, `keybinding.js` — ECDSA P-256 non-extractable keys, W3C VC signatures, Reema binding credential.
  - `dsp.js`, `c2pa.js` — pure FFT/STFT and JUMBF/CBOR parsers.
  - `attemptlog.js`, `attempts.js`, `competency.js`, `confidence.js` — the spine (storage, recorder funnel, pure estimator, sticky confidence control).
  - `profile.js`, `profilestore.js` — PDP scoring + storage.
  - `calibrationPanel.js`, `masteryPanel.js`, `transferPanel.js`, `nextDrillPanel.js`, `missionPanel.js`, `missionEngine.js`, `forensicsDrill.js`, `lensRender.js`, `security.js`, `fonts.js`, `ingest.js`, `verdad-service.js`.
- `js/modules/` (25): `adaptiveRouting`, `aftercare`, `ach`, `attestation`, `cognitive`, `dossier`, `earlyWarning`, `epistemicCommons`, `identity`, `inoculationAdaptive`, `infiniteArena`, `infowar`, `lensLibrary`, `mediaForensics`, `narrative`, `onboarding`, `osint`, `profile`, `reputation`, `rhetoricalSandbox`, `siftLabs`, `spacedRepetition`, `tacticalAudio`, `transferEval`, `verdad`.
- `tests/` — 45 suites registered in `run-all.js` (17,350 assertions, 0 failures, headless) + browser suites run separately (`test-e2e.js`, `test-browser.js`, `test-reverse-face-search-upload.js`).
- `tools/` — `tag-skills.mjs` (content-tagging gate, fails the build), `gen-sm2-cards.mjs`, `balance-option-lengths.mjs`, `build-lens-guides.mjs`, `merge-p1.mjs`, `p1-batch.mjs`.
- `docs/` — `transfer-study-preregistration.md`, `manual-improvement.md` (R1–R12), `manual-user.md`, `playbook-games.md`, outreach/positioning notes, `sources.md`.
- `build-standalone.mjs` — dev-only single-file bundler (requires esbuild; see `SESSION-HANDOFF.md` for its Windows spawn caveat).

## How to run

```bash
npm test              # headless: 45 suites, 17,350 assertions + reverse-face-search Playwright suite
npm run test:e2e      # browser E2E (headless Chromium CDP) — separate gate, not yet in CI
npm run test:browser  # Playwright browser suite
node tools/tag-skills.mjs   # content-tagging gate (fails on untagged/degenerate items)
```

No build step for the multi-file app: serve statically (`serve.mjs` / `serve.cmd`)
and open. The standalone single-file build is generated by `build-standalone.mjs`
when needed.
