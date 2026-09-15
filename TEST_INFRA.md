# E2E Test Infra: SOVEREIGN // AEGIS

## Test Philosophy
- **Opaque-Box & Requirement-Driven**: Tests are designed directly from `ORIGINAL_REQUEST.md` and user specifications, evaluating external interfaces, DOM state, cryptographic verification, mathematical formulas, and simulation loops without relying on internal hacks.
- **Multi-Tier Methodology**: Category-Partition + Boundary Value Analysis + Combinatorial Pairwise + Real-World Workload Testing across 5 rigorous tiers.
- **Zero-Dependency Core Testability**: Native Node.js test runners evaluate data schemas, WebCrypto digital signatures, ACH inconsistency algorithms, and VERDAD NLP heuristics, while Puppeteer drives browser E2E interaction flows.

---

## Feature Inventory

| # | Feature | Source | Tier 1 (Unit) | Tier 2 (Boundary) | Tier 3 (Pairwise) | Tier 4 (Scenario) |
|---|---------|--------|:-------------:|:-----------------:|:-----------------:|:-----------------:|
| 1 | Dark Granite & Bronze Theming | R5 | 5 | 5 | ✓ | ✓ |
| 2 | Modular Shell Navigation | R5 | 5 | 5 | ✓ | ✓ |
| 3 | Reactive State Persistence | R1-R5 | 5 | 5 | ✓ | ✓ |
| 4 | WebCrypto ECDSA P-256 DID Signer | R4 | 5 | 5 | ✓ | ✓ |
| 5 | Masterclass Curriculum & Quizzes | R1 | 5 | 5 | ✓ | ✓ |
| 6 | 22+ Fallacy Taxonomy & Filtering | R1 | 5 | 5 | ✓ | ✓ |
| 7 | AI Forensics & Media Lab | R1 | 5 | 5 | ✓ | ✓ |
| 8 | DISARM T-Codes Catalog | R1 | 5 | 5 | ✓ | ✓ |
| 9 | Prebunking Branching Simulator | R1 | 5 | 5 | ✓ | ✓ |
| 10 | System 2 Breathing & Journaling | R1 | 5 | 5 | ✓ | ✓ |
| 11 | InfoWar AP Tactical Network Game | R1 | 5 | 5 | ✓ | ✓ |
| 12 | VERDAD Multi-Modal Claim NLP | R2 | 5 | 5 | ✓ | ✓ |
| 13 | BYOK Gemini & Offline Heuristics | R2 | 5 | 5 | ✓ | ✓ |
| 14 | OSINT Multi-Platform Workflow | R3 | 5 | 5 | ✓ | ✓ |
| 15 | Interactive SVG Network Graph | R3 | 5 | 5 | ✓ | ✓ |
| 16 | Richards Heuer ACH Matrix Math | R3 | 5 | 5 | ✓ | ✓ |
| 17 | 5-Axis Quantified Confidence Scorer | R3 | 5 | 5 | ✓ | ✓ |
| 18 | Narrative Topology & Timeline Slider | R3 | 5 | 5 | ✓ | ✓ |
| 19 | Early Warning Radar & Checklists | R4 | 5 | 5 | ✓ | ✓ |
| 20 | Source Reputation Database | R4 | 5 | 5 | ✓ | ✓ |
| 21 | W3C JSON-LD DID Credential Exporter | R4 | 5 | 5 | ✓ | ✓ |

---

## Test Architecture

### 1. Test Runner Scripts
- `node tests/test-syntax.js`: Validates all `.js` and `.json` files for syntax errors and schema validity.
- `node tests/test-datasets.js`: Verifies record counts, required fields, and data integrity across all 11 JSON datasets in `data/`.
- `node tests/test-crypto.js`: Tests WebCrypto ECDSA P-256 key generation, base64url signing, signature verification, tamper detection, and JSON-LD export format.
- `node tests/test-ach.js`: Validates Richards Heuer ACH mathematical inconsistency formulas ($I(H_j)$), edge cases with zero/negative weights, and dynamic hypothesis re-ranking.
- `node tests/test-verdad.js`: Tests offline NLP heuristic parser, emotional intensity scoring, fallacy detection regexes, and BYOK fallback logic.
- `node tests/test-infowar.js`: Simulates complete game loops, AP deduction, contagion physics, victory/loss states, and turn boundaries.
- `node tests/test-e2e.js`: Headless browser integration test validating full DOM rendering, tab switching, interactive sliders, SVG graph interactions, and modal dialogs.

---

## Real-World Application Scenarios (Tier 4)

1. **Scenario 1 — High-Stakes Disinformation Triage**:
   User encounters a viral sensational claim -> inputs into VERDAD -> analyzes emotional manipulation triggers & fallacy indicators -> pivots to OSINT suite -> maps entity network graph -> enters hypotheses into ACH matrix -> recalculates inconsistency rankings -> signs final verified assessment with WebCrypto DID key.
2. **Scenario 2 — Inoculation & Tactical Network Defense**:
   User completes Masterclass on Computational Propaganda -> runs Prebunking inoculation simulator -> enters InfoWar Tactical Game -> manages 10 AP budget -> deploys Fact-Check and Inoculate countermeasures across 7 nodes -> halts viral disinformation cascade by Turn 6 -> achieves victory state.
3. **Scenario 3 — Epistemic Friction & Cognitive Aftercare**:
   User experiences epistemic distress from disinformation exposure -> triggers System 2 friction pacer -> completes 4-7-8 breathing cycle -> logs reflective debiasing journal entry -> exports cryptographic statement to local storage.
4. **Scenario 4 — Early Warning & DISARM Response**:
   User monitors Early Warning Radar for financial/election domain spikes -> inspects DISARM T-codes (T0014, T0043) -> activates interactive mitigation checklist -> verifies source reputation scores in directory.

---

## Coverage Thresholds
- **Tier 1 (Feature Coverage)**: $\ge 5 \times 21 = 105$ test assertions.
- **Tier 2 (Boundary & Corner Cases)**: $\ge 5 \times 21 = 105$ test assertions.
- **Tier 3 (Cross-Feature Combinations)**: $\ge 21$ integration tests.
- **Tier 4 (Real-World Scenarios)**: $\ge 4$ complete end-to-end workflows.
- **Minimum Total Test Assertions**: $\ge 235$ assertions with 100% pass rate.
