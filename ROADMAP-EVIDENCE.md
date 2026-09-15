# SOVEREIGN // AEGIS — Evidence quality & interaction
### Priority order, most critical first

This document supersedes the ordering in `ROADMAP.md` for the next stretch of work. The phase
plan there (Phases 2–7) is still the longer arc; this is what comes first and why.

**Decisions taken (2026-08-17):**

| Decision | Choice |
|---|---|
| Evidence quality | Record **confidence** on every answer |
| First interactive mode | **Predict-then-measure** forensics drill |
| Content volume | **Author a batch by hand now**; pack/authoring plumbing later |
| Where new modes live | **Upgrade existing subtabs in place** — no new nav, no new pillar |

The UI constraint still holds: nothing moves, nothing is renamed, no new navigation tier. Every
item below states what it does to the interface.

---

## How this list is ordered

Criticality here is not "how much I want it". It is three tests, applied in order:

1. **Is it irreversible?** Data not captured today cannot be captured retroactively. Every session
   the operator plays without confidence recording produces attempts that can *never* be used for
   calibration. That makes confidence capture more urgent than anything more visible.
2. **Does everything else depend on it?** A drill built before there is content to feed it gets
   tuned against 80 items and then breaks at 200.
3. **Does it fix something currently wrong?** As opposed to adding something currently absent.

---

## P0 — Confidence capture (attempt schema v2) — **BUILT**

Shipped as described below, plus three things the plan did not anticipate. See
"§ P0 as built" at the end of this document.

---

## P0 — Confidence capture (attempt schema v2)

**Why first:** it is the only item on this list that gets *worse the longer it waits*. Correctness
alone cannot distinguish a confident correct answer from a lucky guess, and for an application about
epistemic calibration that is the central measurement, not a refinement. Attempts logged before this
lands are permanently uncalibratable.

**What changes**

- `js/attempts.js` gains a `confidence` field: `'sure' | 'unsure' | 'guess'`. Attempt records go to
  `v: 2`. Additive — v1 records stay valid and read as `confidence: null`, so this is a recompute,
  not a migration. `normaliseAttempt()` accepts both.
- All six recording sites pass it through: Arena, SM-2, fallacy drills, SIFT Labs, Prebunking, Sandbox.
- `js/competency.js` gains `calibration(attempts)` → Brier score, reliability bins, and an
  over/under-confidence figure.

**The design decision that matters here:** confidence must **not** be folded into the mastery number.

Mastery means "probability this person answers correctly". If a self-reported confidence tap starts
moving it, mastery stops meaning anything you can state in a sentence, and it becomes gameable —
tap "guess" on everything and watch your scores improve. So:

- `mastery` stays correctness-only, exactly as it is now.
- `calibration` is a **separate** measure, reported separately.
- Confidence *does* change one thing: `rank()`. A **confidently wrong** answer is the highest-value
  practice signal in the entire system — it marks a belief held firmly and incorrectly, which is the
  precise thing this app exists to fix. Those items should be surfaced first.

**UI (in place, no new surfaces):** a three-state segmented control sitting above the answer options
on every answering surface, styled to match the existing subtab pills (but deliberately not built from them — see § P0 as built). **It remembers your last
setting**, so the common case costs zero extra taps — it is a modifier you adjust when your certainty
changes, not a second question you must answer every time. This matters most in the Arena, where the
whole point is rapid fire; a mandatory second tap per question would wreck it.

**Done when:** a browser run shows records at `v: 2` carrying confidence from all six modules; a
simulated learner with known calibration (deliberately overconfident) is recovered by
`calibration()` to within tolerance; `rank()` demonstrably surfaces confidently-wrong items first;
mastery numbers are **unchanged** for the same answer sequence, proving confidence did not leak into
them.

**Effort:** ~1 session. **Risk:** low, additive. **Reversible:** yes — stop writing the field.

---

## P1 — Author ~60–100 items by hand — **BUILT**

91 Arena questions and 9 SIFT scenarios. **Every one of the 24 skills now has at least 8 items**
(minimum was 1). Review sheet: `P1-BATCH-REVIEW.md` — veto anything and I will remove it.

New tooling, because a batch this size needs gates a dev tool cannot provide:

- `tools/p1-batch.mjs` — the authored items, with `skills` as the single source of truth.
- `tools/merge-p1.mjs` — merges them AND regenerates `data/answer_skill_map.json`, so the questions
  and the answer→skill map cannot drift. It refused the first three runs: one answer string mapped
  to two different skill sets, and two would have silently re-tagged questions already in the bank.
- `tools/balance-option-lengths.mjs` — see the length tell below.
- A **question-bank quality gate** in the test suite. There was none: `test-datasets.js` never
  looked at `arena_questions.json` at all, so 91 items shipped with nothing checking them.

### Two exploits the new gate found immediately

**1. Every question in the bank stores its answer at `correctIndex 0` — all 119 — and options were
rendered in storage order.** The Arena was passable at **100% by pressing "1" every time**: full
accuracy, rising ELO, and mastery estimates built on a single keypress. This affected the strongest
evidence source in the application and the one that administers the held-out probes, so it was
quietly corrupting the transfer measurement too.

Fixed by shuffling at **presentation**, not by editing the data — a data fix could be undone by the
next content edit and would not cover future items. The order is deterministic per question id, so
re-encountering a question does not reshuffle the options under someone mid-thought.

The first shuffle was itself biased: `seed % (i+1)` takes the low bits of a linear congruential
generator, which are famously non-random, and produced 0/61/29/29 across the bank — the answer never
in position 1 and in position 2 half the time. A biased shuffle is a subtler version of the tell it
was written to remove. Using the high bits gives 31/28/34/26 against a chance expectation of ~30.

Verified in a browser: pressing "1" twenty-four times now scores **20%**; clicking the option whose
*text* is the correct answer scores **100%** twenty times out of twenty.

**2. The correct answer was the longest option in 60 of 119 questions**, so "always pick the longest"
scored ~50% against a 25% baseline — again without reading a claim. Present in the original bank
(64%) as well as the new batch (46%), and present among short label-style options too, so it was not
an artefact of item type.

Fixed meaning-preservingly: distractors are expanded to their fuller canonical names
("Slippery Slope" → "Slippery Slope (Continuum Fallacy)"), never padded, and only distractors are
touched — expanding the correct answer would move the tell rather than remove it. Now 26%, at chance.

### Known residual, tracked rather than forgotten

The original 28 questions' explanations contrast the answer with what it *isn't* only ~7% of the
time, against ~60% for the new batch. The whole-bank figure is 48% and the test holds a **ratchet**
at 45% so it can only improve. Rewriting those 28 explanations is follow-up work.

---

## P1 — Author ~60–100 items by hand *(original plan)*

**Why second:** ten of the twenty-four skills currently rest on **two items or fewer**, and two rest
on exactly one. An estimate built on one question is not an estimate; the confidence figure
(`n/(n+5)`) correctly reports it as near-worthless, which means a third of the taxonomy is
permanently reading "unknown" no matter how much the operator practises. Everything downstream —
adaptive routing, the calibration curve, Phase 2's card generation — is only as good as this.

The current distribution:

| Items | Skills |
|---|---|
| 1 | `fallacy.formal-vs-informal`, `bias.attribution`, `tactic.false-balance` |
| 2 | `fallacy.appeals`, `bias.confirmation`, `bias.availability`, `bias.anchoring`, `tactic.equivocation`, `disarm.seed-amplify`, `forensics.provenance` |
| 4–9 | the remaining fourteen |

**What changes:** new records in `data/arena_questions.json` (and a few SM-2 cards), targeting the
ten thin skills first — roughly 6–8 items each to bring every skill to a minimum of 8. Then re-run
`tools/tag-skills.mjs`, which already fails the build on anything untagged.

**The quality bar, stated explicitly**, because this is where item-writing usually goes wrong:

- Distractors must be **plausible neighbours** of the correct answer — genetic fallacy vs
  circumstantial ad hominem vs poisoning the well — so the item measures *discrimination*, not
  recognition. An item with three obviously-wrong options measures nothing.
- No structural tell. If every ad hominem item mentions a divorce, the operator learns the template
  and the mastery curve rises while nothing is learned. This is the single failure mode that would
  invalidate the whole spine.
- Every item's `explanation` must say what the fallacy *isn't*, not just what it is — that is what
  makes a wrong answer instructive rather than merely marked.

**Done when:** no skill has fewer than 8 items; the tagger exits zero; and a spot-check by you
confirms the distractors are genuinely hard. I will hand you the batch for review before it lands —
item quality is a judgement call and I would rather you veto twenty than have the app teach a
pattern instead of a skill.

**Effort:** 1–2 sessions. **Risk:** the only real risk is bad items, which is why you review them.

---

## P2 — Predict-then-measure forensics drill — **BUILT**

`js/forensicsDrill.js` (pure, no DOM) generates **10 drills / 20 questions** from the 5 samples —
each sample's own medium plus provenance. The Forensics viewport is now withheld behind a commit
panel: the operator predicts what the measurement will show, *then* it renders.

**The second question is the point.** Every drill has two parts — what will it SHOW, and what does
it ESTABLISH — and on the second the correct answer is always the hedged one, with the three
confident over-reads as distractors. The failure this app exists to correct is not missing an
artefact, it is over-reading one, and an operator who predicts every indicator correctly and then
concludes "therefore it is fake" has learned the easy half. A test asserts that property across all
ten drills, so no future drill can ship with a confident answer marked correct.

**It refuses to drill a user upload.** An uploaded file's `isSynthetic` is a default, not a known
fact; scoring a prediction against it would manufacture evidence.

Questions are derived from the sample's own ground-truth fields, so they cannot drift from what the
viewport displays — and a test checks each derivation against the raw data rather than trusting it.

Verified in a browser: panel shown and viewport hidden on arrival; **zero of the sample's
ground-truth strings appear in the panel** (5 checked); committing reveals the measurement and asks
the second question; a completed drill is not re-asked; records land under `context: 'forensics'` at
`v: 2` with confidence, tagged to `forensics.read-measurements` and `forensics.provenance`.

---

## P2 — Predict-then-measure forensics drill *(original plan)*

**Why third:** this is the first thing that makes the app *playable*, and it is cheap because the
hard part already exists. You have real FFT, real spectrograms, real STFT features and a real C2PA
manifest walker — currently sitting behind a viewer that shows you the answer the moment you upload.
As built, it cannot produce a single attempt record, which is why `forensics.provenance` has two
items and both come from Prebunking.

**The mechanic:** the operator commits a prediction **before** the measurement renders.

1. Sample loads. Claim shown ("this recording is authentic"). Measurement is *not* yet drawn.
2. Operator predicts: which artefact will the spectrum show? Is there a manifest? Confident or not?
3. Measurement renders. Prediction is scored against ground truth from `forensic_samples.json`.
4. Explanation states what the measurement **cannot** establish — preserving the "NO VERDICT"
   discipline built during the audit, which is itself the skill being trained.

This turns a viewer into a drill with no new analysis code, and it directly trains
`forensics.read-measurements` (reading an indicator without over-reading it) and
`forensics.provenance` (a parsed manifest is not a verified one).

**UI (in place):** the existing Forensics subtab gains a pre-reveal state. The viewport, controls and
scorecard all stay exactly where they are — the change is that the canvas starts covered and the
prediction panel occupies that space until you commit. Nothing is added to the navigation.

**Done when:** predicting in a real browser writes `context: 'forensics'` records with confidence;
the drill is replayable across every sample; and the pixel baseline for every *other* view is
unchanged.

**Effort:** ~1–2 sessions. **Risk:** medium — this is the first genuine interaction change, so it
gets a screenshot review before it lands.

---

## P3 — Calibration dashboard — **BUILT**

`js/calibrationPanel.js` (pure — takes a report, returns markup) renders a reliability diagram,
a hero direction, the Brier score with its baseline, the per-bin table and the caveat, into the
Overview command centre. No new navigation.

**What it refuses to do is the design.** Below 12 confidence-rated answers it draws nothing and says
how many are needed and why; a bin under 3 answers is drawn hollow, excluded from the fitted line,
and labelled "too few" in the table. A firm-looking curve from four answers would be the application
committing the exact error it teaches against, so the refusal is asserted in the suite rather than
left to judgement.

Chart decisions, each with a reason rather than a taste:

- **One series, one hue.** The curve is *not* coloured good/bad. Status colours are reserved for
  status, and colouring the line by whether the operator looks good would encode the judgement the
  diagram exists to let them make for themselves. A test asserts no status colour appears in the plot.
- **The diagonal is a reference, not a gridline** — so it is the only dashed rule and it is
  labelled; axes are solid hairlines and there are no gridlines. Dashed *gridlines* read as
  "projection"; a dashed *threshold* reads as a threshold.
- **Marker area encodes n**, putting "how much evidence" on the same mark as "what it says", so a
  thin bin looks thin instead of looking like a result.
- **One direct label**, on the `sure` bin — the claim with consequences. Every other number is in
  the table, which is also the accessible view, so no value is reachable only inside a chart.
- **No hex literals** — every colour is a CSS custom property, so the panel follows the theme rather
  than pinning a second palette beside it. Asserted.

The palette validator was run and its categorical checks correctly rejected pairing the data hue
with the reference grey — they are not two series. The diagonal is recessive furniture distinguished
by dash pattern and a direct label, not by colour, so identity never rests on hue alone.

Verified in a browser against the real log: refuses at 0 rated, draws at 60, names the seeded
overconfident learner as **OVERCONFIDENT** with Brier 0.357 against the stated 0.250 baseline, three
table rows, one dashed rule, hover titles on every marker, and it recomputes on navigation back to
the Overview (60 → 66). Pixel baselines: only the Overview changed, by exactly the height of the new
panel.

---

## P3 — Calibration dashboard *(original plan)*

**Why fourth:** it is the payoff that makes P0's extra tap feel worth making, and it is the most
credible "you are actually improving" artefact the app can show — a reliability diagram is a claim
you can defend, unlike a streak counter. But it needs P0 shipped and a few sessions of real data
behind it, so it cannot come earlier.

**What it shows:** predicted confidence on one axis, observed accuracy on the other, with the
diagonal marked. Overconfidence reads as points below the line. Plus a Brier score and the single
most useful sentence the app could tell an operator: *"When you said you were sure, you were right
71% of the time."*

**UI (in place):** the Overview command centre already has metric cards and a spider chart. This
becomes one more panel there, or an extension of the existing competency visual — no new screen.

**Done when:** the diagram is driven entirely by real logged attempts, refuses to render on
insufficient data rather than drawing a misleading line, and carries the same
`transfer()`-style caveat as data rather than as decoration.

**Effort:** ~1 session.

---

## P4 — Phase 2: make the retention machinery bite

Now the original `ROADMAP.md` Phase 2, and it is much stronger after P1:

- Auto-generate SM-2 cards from every tagged item — with P1 done that is ~180 cards, up from 20.
- The Arena draws by weak skill via `rank()` instead of at random, with the confidently-wrong
  weighting from P0.
- Finishing a masterclass section schedules its skills for review instead of setting a
  `completed` flag.

This is the point at which reading something has consequences, which is the change from
encyclopedia to training. It is P4 rather than P1 only because feeding a scheduler 80 items and then
tripling the corpus underneath it means tuning it twice.

**Effort:** ~1 session, mostly wiring that already exists.

---

# Not yet approved — proposed, ranked by value

You chose confidence recording from the four evidence fixes. These are the other three, kept here
rather than dropped, because **SM-2 remains the weakest evidence in the app** and I do not want that
to quietly become permanent.

## N1 — Record which wrong option was chosen *(free)*

One extra field, **zero UI change**, no extra tap. It turns "relevance: 60%" into *"you read tu
quoque as ad hominem four times"* — a confusion matrix instead of a score. Given the cost is
literally one line at each recording site, this is the best value-per-effort item on either list.

## N2 — Answer-before-reveal in SM-2

The honest fix for the weakest measurement in the app. Today the operator reveals the card and grades
themselves, so it measures *felt* recall. Adding a forced-choice diagnosis before the flip — four
options drawn from other cards' `diagnosis` fields, which already exist and cost nothing to
assemble — produces a demonstrated answer **and** the self-grade, and the gap between the two is
itself a calibration signal.

**UI cost:** the Memory Vault card gains four option buttons above the existing reveal button. In
place, no new surfaces. This is the item I would most like you to reconsider.

## N3 — Score the mute Prebunking choices

A content edit: some branching choices carry `resilienceDelta: 0`, and the module correctly refuses
to invent a verdict for them — so those decisions produce no evidence at all. Giving every choice a
non-zero verdict, and extending scenarios past two stages, would make Prebunking a real measurement
rather than a mostly-silent one.

---

## Sequencing at a glance

```
P0  confidence capture        ██████████  irreversible if delayed — do first
P1  author 60-100 items       ████████    ten skills are running on ≤2 items
P2  forensics predict drill   ██████      first genuinely playable mode
P3  calibration dashboard     ████        the payoff that justifies P0's tap
P4  Phase 2 retention         ███         wiring, much stronger after P1
--
N1  chosen-distractor field   (free, unapproved)
N2  SM-2 answer-before-reveal (unapproved — the weakest link)
N3  Prebunking scoring        (unapproved)
```

**Invariants for every item above:** no navigation changes; no renames; the three dangling CSS tokens
(`--bg-surface-card`, `--amber-mid`, `--border-primary`) stay as they are; every change ships with the
markup-leak scan, the pixel baselines and the full 18-suite run green.

---

# § P0 as built

## What shipped

- **`js/attemptlog.js` → schema v2.** `confidence: 'sure' | 'unsure' | 'guess' | null`. Additive:
  v1 records stay valid, read as `null`, and are **excluded** from calibration rather than assumed
  to mean 50%. An imported v1 record keeps its own `v` — restamping it as v2 would claim a
  measurement was taken when it was not.
- **`js/confidence.js`** — one shared control. Sticky across questions, modules and reloads, so the
  common case costs zero extra taps. Defaults to `unsure`, never `sure`: an unset control must not
  manufacture an overconfidence signal from people who never touched it.
- **`js/competency.js` → `calibration()` and `miscalibrated()`.** Brier score, a reliability table
  with per-bin sample sizes, and a single sentence worth showing: *"When you said you were sure, you
  were right N% of the time."* Thin bins are flagged, never hidden.
- **`rank({attempts})`** — a confidently-wrong item is boosted by `MISCALIBRATION_BOOST` (2.5). The
  boost is keyed on **itemId**, not skill: being certain and wrong about one question says nothing
  about the others testing the same skill, and smearing it would destroy the signal in exactly the
  case that matters.
- All six surfaces mount the control; SM-2 mounts it **above the reveal button** and freezes the
  claim at reveal time, because a certainty stated after seeing the answer is hindsight and cannot
  be scored.

## Mastery is provably untouched

`estimate()` was not modified. The suite asserts that the *same answer sequence* yields
**bit-identical** mastery whether every answer claimed "sure" or every answer claimed "guessing"
(`0.5937527068161756` both ways). That is the guarantee that makes confidence safe to collect: it
cannot be gamed, because there is nothing to game.

## Three things the plan missed

**1. Borrowing `.subtab-btn` cost the selection state.** The control was first built from the app's
existing subtab pill class for visual consistency. The selected pill then silently un-selected
itself, because `AegisApp.switchSubTab()` runs
`viewContainer.querySelectorAll('.subtab-btn') → remove 'active'` on every subtab switch, and
`_bindDOM()` binds subtab *navigation* to every `.subtab-btn` in the document. Borrowing a class
inherits its behaviour, not just its appearance. Fixed with own classes, own CSS block in
`css/components.css`, and selection tracked through `aria-checked` — which is the correct radio
semantics anyway and which nothing else in the app touches.

**2. Two SIFT labs were recording fabricated mastery.** Found while wiring confidence into them.
This is worse than the weak evidence documented earlier — weak evidence is a measurement with
error, and these were not measurements at all:

- **Trace lab** called `_scoreResult(scenario, true, timeMs)` — `correct: true`, unconditionally,
  on a button reading *"I understand this verdict"*. Clicking through scored 100%, so
  `skill.sift.trace-origin` would have read as mastered without the operator ever making a
  judgement. **Fixed properly:** the verdict must now be predicted from the chain before it is
  revealed, with the other trace scenarios' real verdicts as distractors — plausible category
  confusions (recycled image vs fabricated composite) rather than throwaways. Options are shuffled
  deterministically per scenario id so re-entering does not reshuffle them mid-thought. This is the
  same predict-then-reveal mechanic P2 needs, so it is also a prototype for it.
- **Stop lab** had `correctDecision: "stop"` on all five scenarios. Mashing one button scored 100%.
  Worse, the lab *trained the reflex* — every reward came from distrusting — and reflexive cynicism
  is its own epistemic failure, not a safe default. The SIFT "stop" skill is noticing the emotional
  pull of a claim, not refusing every claim, and a lab containing no legitimate claims cannot teach
  the difference. **Fixed with content:** three `correctDecision: "continue"` scenarios (hedged
  science reporting, a mundane transit notice, a null-result meta-analysis with disclosed funding
  and stated limitations). One of them is deliberately about a claim the operator may not want to
  be true, because selective scepticism is the harder version of this skill.
- `_scoreResult` gained `assessed: false` for interactions with no right answer — session stats
  still update, the attempt log is not written. A fabricated 100% is indistinguishable from a real
  one, which is why silence is better.
- **`tools/tag-skills.mjs` now fails the build** when every item in a lab shares the same correct
  answer. That class of defect is invisible unless something checks for it, and it had already
  shipped once.

**3. `.hidden` was never defined.** Found by looking at a screenshot of the Memory Vault and
noticing the answer was already on screen. Roughly seventy places across `index.html` and `js/`
add and remove a `hidden` class, but **no CSS rule ever defined it**. Only three *scoped* variants
existed — `.view-container.hidden`, `.modal-backdrop.hidden`, `.omni-palette.hidden` — which is
exactly why navigation worked and nothing else did, and why it went unnoticed: the failure was
silent everywhere it mattered.

Measured consequences, all pre-existing and all confirmed in a browser before and after the fix:

| Where | What was actually happening |
|---|---|
| **Memory Vault** | The card back was never hidden. The diagnosis, mechanism and countermeasure were on screen *before* you pressed "Reveal" — **SM-2 has never tested recall**. Every self-grade in the app's history was given with the answer visible. |
| **Arena** | `nextQuestion()` hides the previous question's feedback via this class, so the previous answer and its explanation stayed on screen while the next question was displayed. |
| **SIFT / Sandbox** | Feedback panels and nav rows that appear after a decision were visible before it. |
| **Overview** | An empty `#daily-drill-feedback` reserved 40px of blank space. |

The fix is one rule in `css/base.css`. `!important` is required rather than decorative: several of
these elements carry an inline `display: flex` in the same tag (`#sm2-card-back`, the SIFT nav
rows) and inline styles beat a plain class selector. Every path that reveals such an element calls
`classList.remove('hidden')` first, so nothing depends on the class losing; the four feedback
panels toggled purely through `style.display` use inline `display:none` and never carry the class,
so they are untouched.

Verified: across 11 views and 24 subtabs, **no surface went blank**, and the full-page pixel
baselines are identical everywhere except the overview, which lost exactly that 40px empty gap.

This one matters beyond its size. The SM-2 self-grade was already the weakest evidence in the
app — and it turns out it was weaker still, because the operator could see the answer. It also made
the "BEFORE YOU LOOK — WILL YOU GET THIS?" prompt shipped in P0 misleading until fixed. It
strengthens the case for **N2 (answer-before-reveal)**: now that reveal actually conceals, adding a
forced choice before the flip is a small step rather than a rebuild.

## Consequence for P1

The Stop lab fix is the item-quality bar from P1 arriving early, and it sharpens what P1 has to do:
the thin skills need items whose correct answers *vary*, not just more items. `data/skills.json`'s
distribution and the tagger's new guard are both inputs to that batch.
