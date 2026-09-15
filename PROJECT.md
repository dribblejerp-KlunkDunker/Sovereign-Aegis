# Project: SOVEREIGN // AEGIS — 4-Pillar Pedagogical Enhancement & Code Hardening

## Architecture
SOVEREIGN // AEGIS is an offline-first, browser-native intelligence and cognitive defense training suite built with vanilla ES modules, WebCrypto, Web Audio API, Canvas, and pure mathematical estimators (Zero build tools, zero external dependencies).

```
                      ┌────────────────────────────────────────┐
                      │        SOVEREIGN // AEGIS UI           │
                      │ (Dark Granite / Bronze / Garamond /    │
                      │  Cinzel / JetBrains Mono)              │
                      └───────────────────┬────────────────────┘
                                          │
    ┌──────────────────┬──────────────────┼──────────────────┬──────────────────┐
    │                  │                  │                  │                  │
    ▼                  ▼                  ▼                  ▼                  ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│   PILLAR I    │ │   PILLAR II   │ │  PILLAR III   │ │   PILLAR IV   │ │  FOUNDATION   │
│ Cognitive     │ │ Real-Time     │ │ Signal & OSINT│ │ Collective    │ │ State, Crypto │
│ Fortification │ │ Protection    │ │ Forensics     │ │ Defense       │ │ & Assessment  │
├───────────────┤ ├───────────────┤ ├───────────────┤ ├───────────────┤ ├───────────────┤
│ • SIFT Labs   │ │ • VERDAD      │ │ • Web Audio   │ │ • InfoWar     │ │ • StateStore  │
│ • SM-2 Memory │ │   Dialectic   │ │   STFT DSP    │ │   10 AP Sim   │ │ • Persist IDB │
│ • Rhetorical  │ │ • Adversarial │ │ • 2D FFT, ELA │ │ • Operator    │ │ • WebCrypto   │
│   Sandbox     │ │   Challenge   │ │ • C2PA Parser │ │   Spiderchart │ │ • AttemptLog  │
│ • Cognitive   │ │ • Source      │ │ • Heuer ACH   │ │ • 5-Step      │ │ • Bayesian    │
│   Classes     │ │   Dossiers    │ │   Matrix      │ │   Onboarding  │ │   Competency  │
└───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | SIFT Labs Scenarios & Timed Scoring | 4 interactive sub-labs (Stop, Investigate, Coverage, Trace) with diagnostic feedback | M1 (DONE) | ORIGINAL_REQUEST §R1 |
| 2 | SM-2 Live Sync Bridge | Auto-queue spaced repetition flashcards on SIFT mistakes with instant deck reload | M1 (DONE) | ORIGINAL_REQUEST §R1 |
| 3 | Rhetorical Sandbox Premise/Conclusion | Clause identification and tagging for logical argument structure | M1 (DONE) | ORIGINAL_REQUEST §R1 |
| 4 | Rhetorical Sandbox Enthymeme Drill | Interactive deduction drill to identify unstated assumptions before formal unlock | M1 (DONE) | ORIGINAL_REQUEST §R1 |
| 5 | Rhetorical Sandbox Socratic Steel-Manning | Active formulation drill constructing strongest charitable counter-arguments | M1 (DONE) | ORIGINAL_REQUEST §R1 |
| 6 | VERDAD Epistemic CoT Dialectic Panel | 5-step transparent reasoning panel (Affect, Fallacies, Epistemics, Sources, Verdict) | M2 (DONE) | ORIGINAL_REQUEST §R2 |
| 7 | Adversarial Sandbox Challenge Mode | 3 manipulative re-framings (Outrage, False Consensus, In-Group) with counter-briefs | M2 (DONE) | ORIGINAL_REQUEST §R2 |
| 8 | Source Credibility Inline Dossiers | Domain extraction and inline dossier cards from `data/sources.json` in VERDAD | M2 (DONE) | ORIGINAL_REQUEST §R2 |
| 9 | Web Audio STFT & Brickwall Detection | Client-side Cooley-Tukey STFT spectrogram with 8kHz & 16kHz vocoder cutoff flags | M3 (DONE) | ORIGINAL_REQUEST §R3 |
| 10| Richards J. Heuer ACH Matrix Engine | Mathematical inconsistency $I(H_j)$, support $S(H_j)$, and 5-axis confidence decay | M3 (DONE) | ORIGINAL_REQUEST §R3 |
| 11| Signal Forensics Provenance Labeling | Honest evidential provenance across ELA, 2D FFT, and C2PA JUMBF container views | M3 (DONE) | ORIGINAL_REQUEST §R3 |
| 12| InfoWar Tactical Simulator & AP Economy | Turn-based 10 AP wargame, contagion physics, network graphs, dilemma modals | M4 (DONE) | ORIGINAL_REQUEST §R4 |
| 13| InfoWar After-Action Review (AAR) | Turn-by-turn historical scrubber, containment grading, and DISARM failure unlock | M4 (DONE) | ORIGINAL_REQUEST §R4 |
| 14| Operator Profile 5-Axis Spiderchart | Dynamic SVG pentagon spiderchart, Resilience Index, and Next Action engine | M4 (DONE) | ORIGINAL_REQUEST §R4 |
| 15| Guided 5-Step Onboarding System | First-run onboarding modal presenting Four Pillars doctrine with solemn gravitas | M4 (DONE) | ORIGINAL_REQUEST §R4 |
| 16| Dataset Integrity & Schema Expansion | Formal JSON schema and referential integrity tests for all 19 datasets | M5 (DONE) | ORIGINAL_REQUEST §Verification |
| 17| Verification Suite & Hardening Gate | Zero-failure validation across all 33 core suites, challenger, stress & E2E tests | M5 (DONE) | ORIGINAL_REQUEST §Verification |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Pillar I: SIFT Labs, SM-2 Bridge & Rhetorical Sandbox | Harden SIFT Labs interactive scoring, fix SM-2 live queue sync on `aegis:sift-cards`, implement interactive enthymeme deduction and Socratic steel-manning in Rhetorical Sandbox | none | DONE |
| 2 | Pillar II: VERDAD CoT Dialectic, Adversarial Sandbox & Source Dossiers | Implement 5-step Epistemic Chain-of-Thought panel, 3-vector Adversarial Challenge Mode with counter-brief scoring, domain extraction with inline source dossiers | M1 | DONE |
| 3 | Pillar III: Web Audio STFT, Heuer ACH & Provenance | Verify & harden STFT spectrogram pipeline, 8kHz/16kHz vocoder cutoff detection, Heuer ACH inconsistency math, and C2PA/ELA/FFT forensic provenance | none | DONE |
| 4 | Pillar IV: InfoWar Simulator, Operator Profile & Onboarding | Verify & harden InfoWar 10 AP economy, contagion physics, AAR turn scrubber, 5-axis SVG spiderchart, Resilience Index, and 5-step onboarding | none | DONE |
| 5 | E2E Integration, Dataset Expansion & Final Verification Gate | Expand dataset schema validation to all 19 JSON files, add targeted unit tests, execute full test battery, verify anti-dark-pattern compliance | M1, M2, M3, M4 | DONE |

## Interface Contracts

### Pillar I ↔ Spaced Repetition (SM-2)
- **Event**: `window.dispatchEvent(new CustomEvent('aegis:sift-cards', { detail: { cards: Array<object> } }))`
- **Card Schema**: `{ id: string, prompt: string, diagnosis: string, latin?: string, mechanism: string, countermeasure: string, tests: string[] }`
- **State Path**: `sm2.deck` (JSON stringified array in `StateStore`)
- **Behavior**: SpacedRepetition module listens for `aegis:sift-cards` and re-hydrates `this._deck` on `onMount()` to immediately surface new cards in active review queue.

### Pillar I ↔ Rhetorical Sandbox
- **Argument Schema (`data/rhetorical_arguments.json`)**:
  - `id`: string
  - `rawText`: string
  - `clauses`: `Array<{ id: string, text: string, type: 'premise' | 'conclusion', label: string }>`
  - `unstatedAssumption`: `{ text: string, distractors: string[], explanation: string }`
  - `structuralFlaw`: `{ name: string, latin: string, category: string, analysis: string }`
  - `steelMannedVersion`: `{ text: string, improvements: string[], exercises: object[] }`

### Pillar II ↔ VERDAD Dialectic & Source Directory
- **Dialectic Chain-of-Thought Output**:
  - `step1_affect`: `{ outrage, fear, urgency, tribalism, conspiracy, fatalism }`
  - `step2_fallacies`: `Array<{ name, latin, quote, explanation }>`
  - `step3_epistemics`: `{ hedgingRatio, certaintyInflation, wordCount, readingLevel }`
  - `step4_sources`: `Array<{ domain, source: object | null, factuality, bias, credibilityScore }>`
  - `step5_synthesis`: `{ manipulationRisk, veracityScore, recommendation: 'block'|'caution'|'share', rationale }`
- **Adversarial Sandbox Generator**:
  - Ingests analyzed claim and returns:
    1. `outrageMaximizer`: `{ headline, text, targetedVulnerability, countermeasure }`
    2. `falseConsensus`: `{ headline, text, targetedVulnerability, countermeasure }`
    3. `inGroupThreat`: `{ headline, text, targetedVulnerability, countermeasure }`

### Pillar III ↔ Heuer ACH Matrix
- **Inconsistency Formula**: $I(H_j) = \sum \max(0, -R_{ij}) \times (\text{credibility}_i \times \text{relevance}_i)$
- **Support Formula**: $S(H_j) = \sum \max(0, R_{ij}) \times (\text{credibility}_i \times \text{relevance}_i)$
- **5-Axis Confidence Formula**: $\text{Conf} = 100 \times (0.25 S_r + 0.25 C_c + 0.25 C_b + 0.15 T_f + 0.10 A_p) \times \max(0.1, 1 - 0.15 \cdot \text{contra})$

### Pillar IV ↔ Operator Competency Spine
- **5-Axis Metric Mapping**:
  1. `sift`: SIFT Labs accuracy (`sift.stats`)
  2. `pattern`: Infinite Arena accuracy (`arena.stats`)
  3. `memory`: SM-2 retention with reps > 2 (`sm2.deck`)
  4. `theory`: Masterclass progress (`cognitive.progress`)
  5. `practice`: ACH & VERDAD audit completions
- **Resilience Index**: $0.30 \times \text{sift} + 0.20 \times \text{pattern} + 0.20 \times \text{memory} + 0.15 \times \text{theory} + 0.15 \times \text{practice}$

## Code Layout
- `index.html`: Main single-page application shell, navigation, modals, and view containers.
- `css/`: Styling sheets (`variables.css`, `typography.css`, `layout.css`, `components.css`, `views.css`, `theme.css`).
- `data/`: JSON datasets (19 datasets: `sift_scenarios.json`, `rhetorical_arguments.json`, `sources.json`, `fallacies.json`, `ach-scenarios.json`, `infowar-scenarios.json`, `skills.json`, etc.).
- `js/`:
  - `app.js`: Main router and bootstrap orchestrator.
  - `state.js`, `persist.js`: StateStore and durable IndexedDB snapshot mirror.
  - `crypto.js`, `keybinding.js`: WebCrypto ECDSA P-256 and W3C VC signatures.
  - `dsp.js`, `c2pa.js`: Pure FFT/STFT and JUMBF/CBOR container parser.
  - `attemptlog.js`, `competency.js`: Append-only attempt log and Bayesian competency estimator.
  - `calibrationPanel.js`, `masteryPanel.js`: Pure SVG reliability diagram and mastery panel.
  - `modules/`:
    - `siftLabs.js`: 4 interactive SIFT Labs.
    - `spacedRepetition.js`: SuperMemo SM-2 spaced repetition engine.
    - `rhetoricalSandbox.js`: Premise-conclusion dissection, enthymeme drill, Socratic steel-manning.
    - `verdad.js`: VERDAD NLP heuristics, Epistemic CoT panel, Adversarial Sandbox, Source Dossiers.
    - `mediaForensics.js`: ELA, 2D FFT, STFT spectrogram, C2PA manifest inspection.
    - `ach.js`: Richards J. Heuer ACH Matrix Lab.
    - `infowar.js`: InfoWar Serious Game 10 AP simulator & AAR.
    - `onboarding.js`: 5-step modal, 5-axis SVG spiderchart, Resilience Index.
- `tests/`: Zero-dependency test suites (`run-all.js`, `test-syntax.js`, `test-datasets.js`, `test-ach.js`, `test-verdad.js`, `test-infowar.js`, `test-crypto.js`, `test-dsp.js`, `test-c2pa.js`, `test-attemptlog.js`, `test-competency.js`, `test-e2e.js`, `test-m1.js`, `test-m2.js`, etc.).
