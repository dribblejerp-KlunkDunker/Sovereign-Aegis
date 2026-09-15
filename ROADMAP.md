# SOVEREIGN // AEGIS — Roadmap

**Written:** 2026-08-17, after the security audit (`AUDIT.md`) and the forensics realness work.
**Constraint accepted as a design premise, not a gap:** local-first, no backend, no accounts.

---

## 0. Where it actually stands

Two different critiques have been made of this project. They are not the same critique, and
conflating them has been costing you effort.

**Critique A — "it claims more than it does."** This was accurate and is now largely closed:

| Was | Now |
|---|---|
| "2D FFT" painted a radial gradient; the luminance array was computed and discarded | Real separable 2D DFT, verified against analytic signals (38 assertions) |
| "Spectrogram" drew `Math.sin(i*0.2)` bars; `getChannelData` was never called | Real STFT from PCM; measured band edge, HF share, spectral flatness |
| C2PA "parsing" was `text.includes('gemini')` over 250 KB decoded as UTF-8 | Real JPEG APP11 / PNG `caBX` / ISOBMFF walk → JUMBF tree → CBOR decode (31 assertions) |
| "Verified" was set from a substring match | `cryptographicallyVerified` is hardcoded `false`, with the four missing validation steps enumerated in the UI |
| Verdicts read off `sample.isSynthetic` in a JSON file | Verdicts removed; measurements shown, with "why there is no score here" |
| VERDAD's "live mode" asked an LLM whether a claim was true | Google Fact Check Tools API returns citations to human fact-checkers; LLM output no longer authoritative |
| All state in one `localStorage` key | Mirrored to IndexedDB; survives a localStorage wipe (verified) |

**Critique B — "it informs, it does not train."** This is the real problem and it is *not* closed.
It is also not what it was diagnosed as. The claim was "no onboarding, no guided first-run, SIFT
labs are a roadmap item." All three are wrong — `onboarding.js` is a 25 KB five-step guided flow,
and `siftLabs.js` is 49 KB with four labs and 20 scenarios. The machinery of a training system is
already built.

The actual defect is structural, and one query finds it:

```
content items (fallacies + DISARM + SIFT + masterclasses): 87
assessable items (SM-2 cards + arena questions):           48
records of an attempt against a content item:               0
```

**Nothing in this codebase records whether a person got anything right.** SM-2 has an ease factor
and an interval, Arena has an ELO, and neither is connected to the 87 things the app teaches. There
is no path by which reading the Ad Hominem entry, failing an Ad Hominem question, and being shown
Ad Hominem again are the same event about the same skill.

That is why it feels like an encyclopedia. Not because of the subtab count.

---

## 1. Requirements

### Functional
- A person who cannot currently identify a false-dilemma frame can, after using this, identify one
  in text they have not seen before.
- That improvement is **measurable inside the app**, from held-out items.
- Practice concentrates on what the individual is weak at, not on what they click.

### Non-functional
- **Local-first, no server.** Every requirement above must be met with no network dependency and no
  account. This is the product's premise; a backend would contradict it.
- **No build step.** The project's zero-dependency, no-bundler property is a real asset — it means
  the whole thing is auditable by reading it. Preserve it. (`build-standalone.mjs` is dev-only.)
- **Honest by construction.** Any new inference must ship with its limitations in the UI, and any
  new computation must ship with a test against ground truth. This is now the house standard; both
  new modules follow it.
- Assessment data is sensitive (it is a record of what someone is bad at). It must never leave the
  device without an explicit export.

### Constraints
- One developer, working with agents.
- ~400 KB of hand-authored domain content already exists and is good. The roadmap must exploit it,
  not require rewriting it.
- 20 modules, ~500 KB of JS. Adding a 21st module is cheap; changing the contract between all of
  them is not.

---

## 2. The one architectural addition that matters

Everything in Phase 1 below exists to add a **competency spine**: one place where content, items,
attempts, and skill estimates meet. Today each module owns its own progress notion and writes it to
an unrelated corner of the state tree.

```
                        CURRENT (no spine)

  cognitive.js ──► store.set('cognitive.progress.*')      ─┐
  siftLabs.js  ──► store.set('sift.labCompletions')        ─┤  four unrelated
  arena.js     ──► store.set('arena.elo')                  ─┤  progress notions,
  memory.js    ──► store.set('sm2.deck')                   ─┘  no shared subject

  data/fallacies.json ····· read and rendered ····· never assessed


                        PROPOSED (spine)

  ┌───────────────────────────────────────────────────────────────┐
  │  skills.json         24 named competencies, e.g.              │
  │                      skill.fallacy.ad-hominem                 │
  │                      skill.disarm.recognise-T0035             │
  │                      skill.sift.lateral-read                  │
  └───────────────┬───────────────────────────────────────────────┘
                  │ every content item declares the skills it teaches
                  │ every question declares the skills it tests
                  ▼
  ┌───────────────────────────────────────────────────────────────┐
  │  js/competency.js  (new, ~300 lines, pure + testable)         │
  │                                                               │
  │   recordAttempt({skillId, itemId, correct, latencyMs, ctx})   │
  │   estimate(skillId) -> {mastery 0..1, confidence, n, lastSeen} │
  │   dueQueue(limit)   -> items ranked by expected learning gain  │
  │   transferReport()  -> held-out performance over time         │
  └───────────────┬───────────────────────────────────────────────┘
                  │ single append-only attempt log in IndexedDB
                  ▼
     every module calls recordAttempt(); every module reads dueQueue()
```

The append-only attempt log is the important part. An event log of
`(skillId, itemId, correct, timestamp)` is small, cheap, survives schema change, is trivially
exportable, and lets any future estimator be recomputed from history rather than migrated. Storing
derived mastery numbers instead would lock you into today's guess at the model.

**Trade-off:** this is a cross-cutting change touching ~8 modules. It is the only item on this
roadmap I would call architectural, and it is deliberately first, because Phases 2–5 are all
cheap once it exists and all impossible without it.

---

## 3. Phases

### Phase 1 — Competency spine *(foundational; ~2–3 focused sessions)*

1. `data/skills.json` — enumerate ~24 competencies. Derived from existing content, not invented.
2. Tag existing content: add `teaches: [skillId]` to fallacy/DISARM/SIFT/masterclass records, and
   `tests: [skillId]` to SM-2 cards and arena questions. Mechanical; agent-assistable.
3. `js/competency.js` + `tests/test-competency.js`. Pure functions, ground-truth tests: a simulated
   learner with known ability must produce mastery estimates that converge on it.
4. `js/attemptlog.js` — append-only IndexedDB log, reusing the `persist.js` pattern.
5. Retrofit `recordAttempt()` into the four modules that already have a right/wrong moment.

**Deliverable:** the app can answer "what is this person actually weak at?" It cannot today.

**Trade-off:** no user-visible feature ships in this phase. Resist the temptation to skip it — every
later phase either becomes trivial or stays impossible depending on it.

#### Phase 1 — status: **built and verified**

Design: `DESIGN-competency-spine.md`. What actually shipped, against the five items above:

| # | Planned | Shipped |
|---|---------|---------|
| 1 | `data/skills.json`, ~24 competencies | **done** — 24 skills, each with `pillar`, `prerequisites`, `heldOutItemIds` |
| 2 | Tag existing content | **done, all of it** — 24 fallacies + 39 DISARM techniques (`teaches`); 28 arena questions, 20 SM-2 cards, 20 SIFT scenarios, 6 inoculation scenarios, 6 rhetorical arguments (`tests` + `heldOut`) = **80 assessable items**, all via `tools/tag-skills.mjs` |
| 3 | `js/competency.js` + ground-truth tests | **done** — 71 assertions; a simulated learner of known ability p is recovered to ±0.12 |
| 4 | `js/attemptlog.js` | **done** — append-only IndexedDB log, plus `js/attempts.js`, the single recorder all modules call |
| 5 | Retrofit `recordAttempt()` into four modules | **done, into six** — Arena, SM-2 Memory Vault, fallacy drills, SIFT Labs, Prebunking, Rhetorical Sandbox |

All 24 skills now have content that can measure them; none is starved of practice items.

Verified rather than asserted:

- **The loop closes in a real browser, from all six modules.** Driving each right/wrong moment
  produces records under its own `context` (`arena`, `sm2`, `fallacy-drill`, `sift`, `inoculation`,
  `sandbox`), with real latencies, correct skill fan-out, and survival across a full reload.
  0 CSP violations, 0 page errors, 0 untagged-item warnings. Also proven inside the single-file
  `file://` build.
- **Export/import round-trips through the real UI.** Export downloads a valid log; re-importing it
  into a wiped store restores every record with its original id; a file with one bad record is
  rejected whole, leaving the existing log untouched.
- **No UI regression.** The Arena lobby renders **byte-identical** to the pristine pre-audit tree
  (md5 match, 1440×3352). The only visual change anywhere is the two new practice-log buttons, which
  fit inside existing whitespace — the Identity page is the **same height** as before. 9 of 11
  top-level views are bit-stable across runs; the two that are not (`identity`, `ach`) differ only in
  a freshly generated DID and one glyph, and were noisy before this work. 0 markup-as-text leaks
  across 11 views + 24 subtabs.
- **18/18 test suites, 3,405 assertions, 0 failures.**

### Judgement calls worth knowing about

Recording an attempt requires deciding what counts as correct, and the six modules do not all offer
the same quality of evidence. Rather than flatten that, each mapping is stated where it happens and
carries its own `context` so it can be weighted differently later:

| Module | What is recorded | Why it is weaker or stronger evidence |
|--------|------------------|--------------------------------------|
| Arena | answer vs `correctIndex` | strongest: unambiguous, timed, four options |
| Fallacy drill | answer vs `correctIndex` | same, but the answer sits on the page being read |
| SIFT Labs | decision vs `correctAnswer` | strong; already timed by the module |
| SM-2 | self-grade ≥ Good(3) | **weakest** — measures *felt* recall, not demonstrated recall. Threshold is SM-2's own lapse boundary, so the app holds one notion of "knew it", not two |
| Prebunking | `resilienceDelta > 0` | graded, not binary. A **neutral** choice (delta 0) is recorded as nothing — forcing a tie into a binary would manufacture evidence the content author declined to give |
| Sandbox | one record per **clause** | per-clause, because scoring 2-of-3 as a single failure throws away most of the signal. Untagged clauses are non-answers, not wrong answers |

Three decisions taken during the build that were not in the design:

1. **Held-out items are administered as probes, not drawn as practice.** Selection was uniform, so
   ~21% of everything answered would have been a held-out item — with the explanation shown each
   time. Improvement on them would then have measured practice, not transfer, which would have
   quietly invalidated the one measurement Phase 4 depends on. The Arena now draws from practice
   items only and administers one held-out item every 8th question (~12% exposure, scheduled rather
   than accidental). Remaining honest limitation, documented in the code: probes still show their
   explanation, so held-out items are rarely practiced rather than never.
2. **Hard Reset now names the practice history and clears it.** The confirm text said "keys, progress
   and journal entries"; the attempt log is the one thing here that cannot be regenerated, so
   destroying it silently was not acceptable. Text-only change, no new controls.
3. **The SM-2 deck is re-tagged from source on every load.** A deck serialised before the content
   was tagged has no `tests`, so its reviews would have gone unrecorded forever — and a missing
   attempt is indistinguishable from an unattempted skill, so nothing would ever have surfaced the
   loss. Re-tagging is a recompute by design; this is where that recompute lands for SM-2.

**Held-out items remain Arena-only (6 of 80 assessable items, 8%).** The design targeted ~20%, and
that gap is deliberate: a held-out item still has to be *administered*, which needs a scheduler that
can probe it, and only the Arena has one. Declaring held-out items in the modules the operator
browses by hand — the SIFT list, the scenario list, the sandbox presets — would simply delete that
content from the app. `tools/tag-skills.mjs` now fails the build if a held-out item is declared
anywhere it cannot be reached. Phase 4 ("Demonstrate transfer") is where the baseline/follow-up
protocol gets designed properly and this percentage should rise.

**Practice-log backup shipped** — `⭳ Export Practice Log` / `⭱ Import Practice Log` in
Identity → Keypair & DID Profile, alongside the DID export, with a live attempt count. IndexedDB
dies with the browser profile, so a console-only export was not a backup.

> **Ordering note (2026-08-17):** Phases 2–7 below remain the longer arc, but the immediate priority
> order has been re-cut — see **`ROADMAP-EVIDENCE.md`**. Confidence capture, a content batch and the
> first playable drill come before Phase 2, because Phase 2 tunes a scheduler and doing that against
> 80 items and then tripling the corpus underneath it means tuning it twice.

### Phase 2 — Make the retention machinery bite *(~1 session)*

SM-2 and Arena already work; they just have nothing to work *on*. With skills tagged:
- Auto-generate SM-2 cards from every tagged content item (87 items → ~87 cards, up from 20).
- Arena draws questions weighted by weak skills instead of at random.
- Finishing a masterclass section schedules its skills for review rather than setting a `completed` flag.

**Deliverable:** reading something now has downstream consequences. This is the single biggest
felt change from "encyclopedia" to "training".

### Phase 3 — Adaptive routing, and fix the IA as a side effect *(Completed 2026-09-07)*

Routed operators by demonstrated competency rather than arbitrary navigation hierarchy:
- **Diagnostic Placement**: Concluded the 5-step onboarding flow with a 4-probe scenario diagnostic (`js/modules/adaptiveRouting.js`) testing foundational skills (SIFT Stop, Relevance Fallacies, Structural Logic, and DISARM Coordination). Seeds initial competency priors and confidence ratings into `AttemptLog` (`context: 'diagnostic'`), calculates initial Brier calibration, and computes optimal starting placement.
- **Adaptive Decision Tree**: Assigns dedicated tracks (`SIFT Foundational`, `Logical Fortification`, `Adversarial Threat Intelligence`, or `Advanced Triage & Stress Gauntlet`) and immediately routes new operators to their weakest foundational skill drill.
- **Advisory Prerequisites**: Mapped advanced subtabs (`forensics`, `disarm`, `prebunking`, `sandbox`, `arena`, `commons`) to recommended prior skills using live competency estimates ($\ge 0.60$ mastery, $\ge 0.25$ confidence).
- **Open Access Principle**: Prerequisite locks are strictly **advisory** and non-blocking. Panels remain 100% accessible with a dismissible guidance banner offering a one-click shortcut to train the prerequisite first.
- **Next Drill Fallback**: Enhanced `nextDrillPanel.js` to route new operators directly into their placed starting point even before Arena questions are answered.

**Verification:** Suite 44 (`tests/test-adaptive-routing.js`) enforces 90 assertions covering diagnostic scoring, routing decision trees, Brier calibration, advisory gate evaluations, and backward compatibility. All 44 test suites pass (15,951 assertions).

### Phase 4 — Demonstrate transfer *(~1 session; highest credibility payoff)*

This is what would let you make the inoculation claim honestly.
- Reserve ~20% of items as a held-out set, never used for practice.
- On first run, a 10-item baseline from the held-out set. After N practice sessions, a fresh
  non-overlapping held-out set.
- A results view showing baseline vs current on *unpracticed* items, with the sample size and an
  honest confidence interval — and the words "this is a within-subject measure on a small n, not a
  controlled trial."

**Deliverable:** the app can show evidence it works, or discover that it does not. Both outcomes are
worth more than the current situation, which is that nobody can tell.

**Trade-off:** it may reveal that the training does not transfer. That is the point of measuring.

### Phase 5 — Retire the remaining simulations *(Completed 2026-09-06)*

Retired synthetic mock animations in favor of computed DSP primitives and epidemic diffusion mathematics:
- **Video mode** (`_drawForensicVideo` in `mediaForensics.js`): Replaced static ellipse painting with real frame-by-frame temporal consistency (MAD energy, boundary seam jitter index), spatial Laplacian noise-residual inspection, interactive 4-tab filtering (Composite, Temporal Diff, Noise Residual, Methodology), procedural comparative testbench (`sample-authentic-video` vs `sample-deepfake-video`), user video extraction via canvas, and an honest methodology walkthrough detailing DCT quantization limits.
- **OSINT module** (`osint.js`): Relabelled and structured as an Analyst's Desk methodology walkthrough with real schema validation and tactical investigative procedures.
- **Narrative topology** (`narrative.js`): Replaced scripted 4-node animation with a real multi-tier SEIR network epidemic contagion diffusion engine across 48 hours ($T+0\text{h}$ to $T+48\text{h}$), dynamic SVG rendering with infection-weighted radii and animated flux links, interactive campaign switcher for all 3 scenarios in `narratives.json`, and dynamic countermeasure node inspection.

**Verification:** Suite 42 (`tests/test-simulations-retired.js`) enforces mathematical and runtime invariants with 65 assertions. Zero uncalibrated single-number detector verdicts; all measurements display stated physical and compression limits.

### Phase 6 — Real C2PA verification *(discrete, ~1 session + a size decision)*

`js/c2pa.js` parses manifests but cannot validate signatures — the four missing steps are named in
the module header and shown in the UI. Closing it means `c2pa-rs` via WASM (`c2pa-js`).

**Trade-off, and it is a real one:** that WASM bundle is multiple megabytes and breaks both the
no-build-step property and the 0.99 MB single-file build. Options:
- (a) Lazy-load the WASM only when the operator asks to verify. Keeps the default path clean.
- (b) Ship parse-only and link to `contentcredentials.org/verify` for adjudication. Zero cost,
  already implemented, already honest.
Recommendation: **(b) now, (a) when someone actually needs in-app verification.** The current
labelling is truthful, which was the actual problem.

### Phase 7 — Cryptographic Competency Attestations & Sharing *(Completed 2026-09-06)*

Local-first, serverless credential issuance and offline trustless adjudication:
- **W3C Verifiable Credentials Engine** ([`js/modules/attestation.js`](file:///c:/Users/dribb/AI%20PROJECT%20FOLDER/blackvault-app/BLACKVAULT%20DASHBOARD/perimeter-suite/sovereign-aegis/js/modules/attestation.js)):
  - Implements `buildCompetencySubject()`, `signCompetencyAttestation()`, and `verifyCompetencyAttestation()`.
  - Attests to demonstrated skill mastery levels and metacognitive Brier calibration scores.
  - **Strict Privacy-Preserving Invariant**: Zero raw attempt logs, item IDs, timestamps, or chosen options leak into the credential. Only aggregated competencies and calibration curves are signed.
  - **Self-Contained Offline Verification**: Embedded `publicKeyJwk` is cryptographically validated to derive the issuer `did:key` identifier (multicodec `0x1200` + Base58BTC) before verifying ECDSA P-256 digital signature over canonicalized claims. Fails closed against key substitution, mastery inflation, and Brier falsification.
- **Interactive UI Workbench** ([`index.html`](file:///c:/Users/dribb/AI%20PROJECT%20FOLDER/blackvault-app/BLACKVAULT%20DASHBOARD/perimeter-suite/sovereign-aegis/index.html) & [`js/modules/identity.js`](file:///c:/Users/dribb/AI%20PROJECT%20FOLDER/blackvault-app/BLACKVAULT%20DASHBOARD/perimeter-suite/sovereign-aegis/js/modules/identity.js)):
  - Replaced mock credentials list with live Attestation Repository and Independent Third-Party Verifier.
  - Supports 1-click attestation issuance, JSON file import/export, clipboard copy, and full Claims Inspector modal (`#modal-credential-inspector`).
- **Verification**: Suite 43 (`tests/test-competency-attestation.js`) validates schema conformity, privacy guarantees, anti-tampering bounds, and cross-operator offline adjudication across 51 assertions. Master suite passed with 43/43 suites, 15,861 assertions, 0 failures.

---

## 4. What I would explicitly not do

- **Add accounts and a backend.** It contradicts the premise, and none of the requirements in §1
  need it.
- **Add a "confidence score" to the forensics.** Combining uncalibrated filters into one number is
  how the original overclaiming happened. The measurements-without-verdict design is correct.
- **Rewrite the content.** It is the strongest asset in the repo.
- **Add a menu tier for the nine subtabs.** Phase 3 dissolves that problem instead.
- **Chase a neural detector in-browser.** No credible small model gives a defensible error rate on
  arbitrary media. Measurement instruments with stated limits are the honest ceiling here.

---

## 5. Sequencing, and why

```
Phase 1  competency spine        █████████  foundational, no visible feature
Phase 2  wire retention          ████       biggest felt change per hour
Phase 3  adaptive routing + IA   █████      fixes the "where do I start" problem properly
Phase 4  demonstrate transfer    ████       lets you make the central claim honestly
Phase 5  retire simulations      ██████     scope decided by Phase 4's findings
Phase 6  C2PA crypto             ███        already honest; do when needed
Phase 7  sharing / sync          █████      only if it becomes a real need
```

Phases 1→2→4 are the spine of the whole thing: build the measurement, connect it, then use it to
find out whether the product works. Phases 5–7 are quality and reach, and are better decided with
Phase 4's data than without it.

---

## 6. What I would revisit as this grows

- **The attempt log will outgrow a single IndexedDB object.** Fine to ~10⁵ attempts. Past that,
  move to a keyed store with monthly buckets. The append-only design makes that a non-event.
- **The mastery estimator will need replacing.** Start with a simple Bayesian/BKT-style estimate;
  once there is real attempt data, revisit with Elo-per-skill or a small IRT model. Because the log
  is raw events, this is a recompute, not a migration — which is the entire reason for that choice.
- **Skill taxonomy granularity.** 24 competencies is a guess. Real data will show some are never
  separately failed (merge) and some conflate two things (split). Expect one revision after ~1,000
  attempts.
- **The single-file build will stop being viable** somewhere past ~3 MB. When it does, the honest
  move is a real build step, not deleting the guarantee quietly.
- **`localStorage` as the synchronous primary.** IndexedDB mirroring papers over it. If state grows
  much past a few hundred KB, invert it: IndexedDB primary, `localStorage` as a fast-path cache.
- **Whether "cognitive sovereignty" survives contact with any sync feature.** Revisit the premise
  explicitly if Phase 7 is ever taken up, rather than eroding it one convenience at a time.

---

## 7. The honest position statement

Today, post-audit and post-forensics work, this is defensible as:

> An auditable, local-first instrument suite and curriculum for epistemic defense. It measures what
> it says it measures, states what it cannot conclude, and keeps its data on your machine.

It is not yet defensible as:

> A training system that demonstrably builds detection capability.

Phases 1, 2 and 4 are precisely the distance between those two sentences. Nothing else on this list
moves that line.

---

## 8. Independent review remediation — priority order (2026-08-21)

A second, independent review (after the 2026-08-17 audit) re-checked the audit's claims against the
shipped tree. The audit's core fixes are real — verified in code, not just the doc — but six gaps
remained. Priority order, and status after this pass:

| # | Item | Severity | Status |
|---|---|---|---|
| 1 | "100% pass" headline excludes the only test that runs the app in a browser | High | **Fixed** — `run-all.js` now states headless scope, prints assertion composition, and `npm run test:e2e` is a named script |
| 2 | Assertion inflation (58% of the count is static JSON shape-checking) | High | **Fixed** — the runner now reports the dataset-share breakdown instead of an undifferentiated total |
| 3 | `serve.js` set no security headers (`frame-ancestors` only works as a header) | High | **Fixed** — CSP `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` on every response |
| 4 | Secrets in `localStorage` (BYOK API key; legacy private JWK) | High | **Partially fixed** — BYOK/Fact-Check keys are now memory-only and legacy persisted copies are purged on boot. Legacy `identity.privateKeyJwk` rotation remains a manual step (rotating changes the DID) |
| 5 | Fabricated "live" telemetry | Medium | **Fixed** — hero stats now show real product facts (4 pillars / 24 skills / 119 arena questions); the static threat table is labelled illustrative |
| 6 | Repo hygiene (`.agents/` 2.8 MB, `_to_delete/` committed) | Low | **Fixed** — `.gitignore` added; `.agents/` and `_to_delete/` untracked (files stay on disk) |

Remaining after this pass, in the same priority order:

1. **Run `npm run test:e2e` in a browser CI job** and report headless vs browser numbers separately.
   The headless gate is honest now; the browser gate still has to actually run somewhere.
2. **Force legacy private-JWK rotation.** New identities are non-extractable and vaulted; operators
   created before the hardening keep `identity.privateKeyJwk` (including the `d` parameter) in
   `localStorage` until they rotate. The Identity view already prompts; that notice could become a
   one-click rotation.
3. **`index.html` is 2,507 lines with pervasive inline `style=""`.** This is why CSP `style-src`
   still needs `'unsafe-inline'`. Moving templates to classes is the last hardening step and the
   precondition for dropping that directive.

Deliberately not changed:

- `frame-ancestors` is now delivered by `serve.js`; any *other* host serving the app must still set
  the header itself.
- Same-origin XSS can still *use* a memory-only BYOK key while the tab is open. The change reduces
  blast radius (no key at rest, no credential in the state blob); it does not eliminate it — only
  the CSP plus `esc()` output-encoding does that.

---

## 9. Active Delivery Tracks (Tracks 1–4)

**Adopted:** 2026-09-06 · **Execution Target:** Sovereign // Aegis Core

### Track 1: Phase 2 Retention Machinery (P4)
- **Problem**: Reading content and finishing masterclasses lacked downstream consequences because SM-2 card enqueueing was broken (`enqueueCards` missing on `SpacedRepetition`).
- **Implementation**:
  - Implement robust `SpacedRepetition.enqueueCards(cards)` with schema validation, ID deduplication, and SM-2 parameter seeding.
  - Wire masterclass course completion (`cognitive.js`) to dispatch review cards into the Memory Vault via `aegis:sift-cards`.
  - Maintain Arena's weak-skill biased question draw via `rank()` with 2.5x miscalibration boost.

### Track 2: Transfer Evaluation & Baseline Measurement (Phase 4 / R8)
- **Problem**: Proving capability growth requires an empirical, within-subject transfer measurement on unpracticed items, but held-out items were only administered at random every 8th Arena question.
- **Implementation**:
  - Implement a dedicated `TransferEval` diagnostic protocol (`js/modules/transferEval.js`) administering parallel 10-item forms ($T_0$ Baseline and $T_1$ Follow-Up) drawn exclusively from the 40 held-out items.
  - Wire pre/post accuracy comparison with empirical delta, 95% confidence interval, and honest scientific caveats into `transferPanel.js`.

### Track 3: Prebunking & Inoculation Deep Scoring (N3)
- **Problem**: Inoculation scenarios ended abruptly at Stage 2 and previously suffered from neutral choices with zero delta.
- **Implementation**:
  - Expand all 6 scenarios in `data/inoculation.json` to 3 distinct branching stages covering breaking alerts, secondary amplification, and post-crisis adjudication.
  - Ensure 100% of choices have explicit non-zero `resilienceDelta` values, capturing rich attempt telemetry under `context: 'inoculation'`.

### Track 4: Clean Checkpoint & Master Verification
- **Implementation**:
  - Maintain 100% pass rate across all 40+ test suites.
  - Add Suite 41 (`tests/test-retention-transfer.js`) validating SM-2 enqueueing, transfer evaluation protocols, and 3-stage inoculation integrity.
  - Rebuild offline single-file distribution bundle (`sovereign-aegis-standalone.html`).

### Track 5: Retire Remaining Simulations (Phase 5)
- **Problem**: Video forensics relied on static canvas ellipses without temporal or spatial DSP analysis, and the narrative topology graph was a static scripted animation disconnected from contagion diffusion mathematics.
- **Implementation**:
  - Implement real frame-by-frame video forensics DSP primitives: `computeFrameDifference()`, `computeSpatialNoiseResidual()`, `computeTemporalProfile()`, and `generateProceduralVideoFrames()`.
  - Introduce `sample-authentic-video` alongside `sample-deepfake-video` in `data/forensic_samples.json` demonstrating facial seam jitter ($1.08\times$ authentic vs $3.01\times$ deepfake) and latent noise residual smoothing ($1.21$ vs $0.80$).
  - Add interactive filter tabs (Composite, Temporal Diff, Noise Residual, Methodology) and temporal energy sparkline chart.
  - Implement full 48-hour SEIR network contagion diffusion model `simulateContagionDiffusion()` in `js/modules/narrative.js`.
  - Dynamically render multi-tier SVG topology graphs across all 3 campaigns in `data/narratives.json` with real-time HUD telemetry and node inspector modal.
  - Added Suite 42 (`tests/test-simulations-retired.js`) with 65 assertions; full suite passed with 15,810 / 15,810 assertions.
  - Rebuilt offline standalone bundle (`sovereign-aegis-standalone.html`, 1.90 MB).

### Track 6: Cryptographic Competency Attestations (Phase 7)
- **Problem**: Demonstrating mastery and calibration to third parties currently requires either trusting self-reports or sharing raw attempt logs that leak sensitive individual error histories and question-level responses.
- **Implementation**:
  - Implement W3C JSON-LD Verifiable Credential engine in `js/modules/attestation.js` with `buildCompetencySubject()`, `signCompetencyAttestation()`, and `verifyCompetencyAttestation()`.
  - Strict zero-leakage privacy guarantee: embeds only high-level skill mastery scores, Brier calibration metrics, and generalization deltas without exposing raw attempt events, item IDs, or specific choices.
  - Self-contained offline adjudication: binds issuer `did:key` to embedded `publicKeyJwk` and verifies ECDSA SHA-256 signatures with zero server dependency.
  - Upgraded Identity subtab 04 (`#subtab-credentials`) in `index.html` and `js/modules/identity.js` with 1-click issuance, JSON import/export, clipboard copying, claims inspector modal (`#modal-credential-inspector`), and an independent third-party verifier.
  - Added Suite 43 (`tests/test-competency-attestation.js`) with 51 assertions validating privacy invariants, schema conformity, and adversarial tamper resistance (fails closed on mastery inflation, Brier falsification, key substitution, and signature corruption).
  - Rebuilt offline standalone bundle (`sovereign-aegis-standalone.html`, 1.93 MB).

### Track 7: Adaptive Routing & Progressive Placement (Phase 3)
- **Problem**: New operators faced an overwhelming 10-subtab cognitive surface with no diagnostic assessment to identify an optimal entry point, and advanced subtabs had no guidance indicating prerequisite foundational skills.
- **Implementation**:
  - Implemented `js/modules/adaptiveRouting.js` exporting 4 canonical diagnostic scenario probes (`diag_sift_stop`, `diag_fallacy_relevance`, `diag_fallacy_structure`, `diag_disarm_coordination`), `computeDiagnosticPlacement()`, `SUBTAB_PREREQUISITES`, `evaluateAdvisoryPrerequisites()`, and `renderAdvisoryBanner()`.
  - Upgraded `OnboardingModule` (`js/modules/onboarding.js`): concluded the 5-step orientation tour with an interactive 4-probe Diagnostic Placement Stepper featuring selectable options, confidence rating bars (`sure`, `unsure`, `guess`), immediate diagnostic scoring, `AttemptLog` recording (`context: 'diagnostic'`), and track assignment (`SIFT Foundational`, `Logical Fortification`, `Adversarial Threat Intelligence`, `Advanced Triage & Stress Gauntlet`).
  - Added Diagnostic Placement Track display and "Retake Diagnostic ↺" action to the Operator Profile panel.
  - Implemented Open Access Advisory Prerequisites: mapped subtabs (`forensics`, `disarm`, `prebunking`, `sandbox`, `arena`, `commons`) to live competency estimates. When unmet, displays a non-blocking, dismissible guidance banner with a one-click shortcut (`⚔️ Train Prior in... →`) without ever disabling or gating panel interaction.
  - Updated `nextDrillPanel.js` and `app.js` to route new operators directly into their placed starting point even before Arena questions are answered.
  - Added Suite 44 (`tests/test-adaptive-routing.js`) with 90 assertions validating probe schemas, decision trees, Brier scores, advisory gates, open access guarantees, and backward compatibility.
  - Master test runner green: 44/44 suites, 15,951 assertions, 0 failures.
  - Rebuilt offline standalone bundle (`sovereign-aegis-standalone.html`, 1.96 MB).




