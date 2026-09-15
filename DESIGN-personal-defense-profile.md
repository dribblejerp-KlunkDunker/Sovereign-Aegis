# Design — Personal Defense Profile (evidence-first self-profiling)

**Status:** approved in conversation 2026-09-03; not built.
**Problem it solves:** the request was "a personalized manipulation-resistance guide for every
personality type, including profiling yourself with real-world data." The research pass (cached in
`.firecrawl/search-personality-*.json` and friends) supports a *dimensional, self-referential,
practice-oriented* layer — and does **not** support type-determinism ("this type is easy to
manipulate"), third-party profiling, or a susceptibility score. This document is the contract for
what gets built and the boundaries it will not cross.

---

## 0. What was asked vs. what gets built

| Request | Product answer |
|---|---|
| "All personality types" | 6 dimensional lenses (Big Five + one HEXACO-informed) + 7 pressure contexts + 8 framework atlas cards (incl. MBTI, Enneagram, DiSC labeled as comparison lenses) |
| "How each type is manipulated" | tactic-family → pressure-context mapping, framed as **situations** ("when the deadline is manufactured"), never as identity |
| "Deep dive into their psyche" | a 30-item self-reflection inventory with per-answer confidence, plus a real-world observation log |
| "Profiling yourself with real-world data" | the observation log and existing drill/attempt history are the evidence that strengthens or retires a watchpoint |
| "Personalized guide per type" | a **practice map**: assets, watchpoints, if-then countermeasures, drill routes, disconfirmation prompt, evidence note |

Out of scope for this slice: per-type guides for the 16 MBTI / 9 Enneagram labels (slice 2, as
labeled lenses), an adaptive inoculation scenario engine (slice 3), any network inference, any
assessment of other people.

---

## 1. Requirements

### Functional
- Reflection inventory: 30 items, 5-point agreement, per-answer confidence. The 14
  pressure-context items additionally carry per-answer life-domain marks (online / work / close
  relationships / money / health / civic) that annotate the watchpoint they fire (§5).
- Produce a **practice map**: assets, watchpoints, countermeasures (if-then plans), drill routes,
  disconfirmation prompt, evidence note.
- Observation log: user records real pressure events (tactic, context, reaction, action, outcome).
- Re-take at any time; history lives in the raw responses themselves (see §3).
- Framework atlas: 8 cards with an explicit evidence tier.
- Export / import / delete of all profile data.

### Non-functional
| Requirement | Target | Why this number |
|---|---|---|
| Guide computation | < 5 ms | recomputed on view render, like `Competency.estimateAll` |
| Network | none, ever | the product premise; also the research finding (psychological targeting is the threat) |
| Data location | IndexedDB, device only | `DESIGN-product-decision.md` D1: assessment data never syncs |
| Testability | pure functions + ground-truth tests | house standard set by `dsp.js` / `competency.js` |
| Inventory length | ≤ 6 minutes median | completion is the bottleneck for a self-reflection feature |

### Constraints
- No build step; plain ES modules; follow the `competency.js` / `attemptlog.js` seam exactly.
- No clinical, diagnostic, or forensic language anywhere in content or UI strings.
- No composite "resilience" or "manipulability" number. Bands only.

---

## 2. High-level design

```
  data/profile-items.json ────┐   items + reverse-coding + context tags
  data/profile-guides.json ───┤   countermeasure copy, placeholder-driven
  data/framework-notes.json ──┘   atlas cards, evidence tiers
                     │
        ┌────────────▼───────────────────────────────┐
        │  js/profile.js            PURE, no I/O     │
        │    compute(responses, items) -> LevelMap   │
        │    buildGuide(map, obs, guides) -> Guide   │
        └──────────────┬─────────────────────────────┘
                       │ takes data as arguments; never reads storage
        ┌──────────────▼─────────────────────────────┐
        │  js/profilestore.js       I/O, versioned   │
        │    saveResponse / readResponses            │
        │    appendObservation / readObservations    │
        │    export / import / clear                 │
        └──────────────┬─────────────────────────────┘
                       │ IndexedDB via existing persist.js seam
        js/app.js renders; routes point at skillIds owned by the competency spine
```

**Load-bearing decisions.** One: `profile.js` performs no I/O — same standard as
`DESIGN-competency-spine.md` §2, for the same reason: every scoring claim must be testable against
synthetic responses of known value. Two: there is deliberately **no aggregate score**. The moment a
single number exists, it will be read as "how manipulable am I," and the evidence does not license
that reading. Three: `profilestore.js` never accepts free-text *about another person* — observation
records describe the user's own reaction; there is no field where a third party's name belongs.

---

## 3. Data model

### Response record — append-only, never updated
```json
{
  "v": 1,
  "id": "presp_01JQ...",
  "ts": 1786930000000,
  "itemId": "pitem.openness.03",
  "value": 4,
  "confidence": 2,
  "scope": ["online", "money"],
  "retake": 2
}
```
`retake` is an integer the user advances by starting a fresh pass; history is queryable by it, so
trends come free without storing any derived snapshot. ~90 bytes × 30 items × retakes — trivial for
IndexedDB.

### Observation record
```json
{
  "v": 1,
  "id": "pobs_01JQ...",
  "ts": 1786930000000,
  "tactic": "false-urgency",
  "contextTag": "urgency",
  "initialReaction": "felt pulled to act now",
  "action": "paused and verified independently",
  "outcome": "claim was false",
  "confidence": 3
}
```

### What is deliberately not stored
Derived levels, bands, guides. Recomputed from responses + observations on load, exactly as mastery
is recomputed from the attempt log. The banding rules will be revised; the raw answers should not
have to be migrated when they are.

### Content versioning
Every data file carries `contentVersion`. A stored `acknowledgedVersion` lets the UI say "the
research notes behind this guide changed" instead of silently rewriting history.

---

## 4. Inventory design

**6 dimension lenses** (4 items each = 24 items, ~⅓ reverse-coded via item `record: -1`):

| Lens | Anchors | Research basis |
|---|---|---|
| `openness` | novelty-seeking, epistemic curiosity | Big Five; replicated cross-culturally |
| `conscientiousness` | follow-through, verification habits | Big Five; negatively correlated with sharing misinformation across studies |
| `extraversion` | social energy, sharing drive | Big Five; sharing-behavior correlate |
| `agreeableness` | conflict avoidance, trust default | Big Five / HEXACO overlap |
| `emotional-stability` | composure under strain (reverse-coded neuroticism) | Big Five |
| `fairness-reciprocity` | self-report honesty norms | HEXACO Honesty-Humility, hexaco.org instrument docs |

**7 pressure contexts** (urgency, authority, social-approval, scarcity, conflict, isolation,
fatigue): each gets a 2-item mini-check (`pitem.ctx.*`), bringing the total to 38 items ≈ 6 minutes.
Contexts are **not traits**; they are conditions under which anyone's judgment narrows.

**Language rules for items:** behavioral and recent ("In the last month, when a message said the
offer expired today, I…"), never trait-verdicts ("You are a trusting person"). No item may imply a
deficit; both poles are phrased as trade-offs.

**Bands, not percentiles.** Each lens reports one of `less pronounced / mixed / more pronounced in
this reflection` plus a confidence label (`single pass / repeated`). Confidence comes from n retakes
and per-answer confidence, mirroring `confidence = n / (n + k)` from the competency spine.

---

## 5. API contracts

```js
// js/profile.js — pure
Profile.compute(responses, items) -> Map<lensId, {
  level: 'less' | 'mixed' | 'more',     // band, not a number
  n: 12,                                 // contributing answers
  repeated: false                        // ≥2 retakes?
}>

Profile.buildGuide(levelMap, observations, guides, skills) -> {
  assets:         [ { lensId, text } ],
  watchpoints:    [ { contextTag, salience, text, domains } ],
                    // domains: the operator's marked life domains from the ctx answers that
                    // cleared the salience bar; [] when the watchpoint shows on lived evidence alone
  countermeasures:[ { contextTag, plan } ],      // if-then, from profile-guides.json
  routes:         [ { contextTag, skillId } ],   // must exist in data/skills.json
  disconfirmation: '...record one example that does not fit...',
  evidenceNote:   '...technique-recognition findings; not a trait prediction...'
}

// js/profilestore.js — I/O only
await ProfileStore.saveResponse(r);   await ProfileStore.readResponses(retake?);
await ProfileStore.appendObservation(o); await ProfileStore.readObservations();
await ProfileStore.export();          await ProfileStore.import(json, {merge:true});
await ProfileStore.clear();           // wired to Hard Reset alongside AttemptLog.clear()
```

`buildGuide` returning `evidenceNote` follows the house precedent from `Competency.transfer`: the
honest qualifier travels with the output instead of depending on the UI remembering it.

**Salience rule (the only "algorithm" here):** a watchpoint for context *c* becomes prominent when
(c₁) the context mini-check averages ≥ 3.5, **and** (c₂) ≥ 2 observations tagged *c* exist within 30
days, or ≥ 1 observation where `outcome` was unfavorable. A disconfirming observation (favorable
outcome, `confidence ≥ 2`) subtracts one count. Two inputs, one integer comparison each — fully
deterministic and unit-testable; no hidden weighting.

**Domain annotation:** when a context watchpoint shows, it carries the life domains recorded on
that context's mini-check ANSWERS that cleared the salience bar (coded ≥ `MINI_SALIENCE` each).
The marks are read from the response's `scope` field — what the checkboxes actually captured, not
the item's full offer vocabulary and never inferred — so the annotation is exactly "the areas
where you said this pressure finds you". An answer can fire with zero marks and claims none. Trait
items carry no scope row at all; their records carry `scope: []`.

---

## 6. Watchpoint → countermeasure → route map

| Context | Tactic family it arms against | Countermeasure (if-then) | Route (skillId) |
|---|---|---|---|
| urgency | false deadlines, manufactured scarcity | "If a deadline appears, restate the claim aloud and verify one independent source before responding" | `skill.sift.stop` |
| authority | fake credentials, appeal to authority | "If authority is claimed, name the credential and check it at the primary source" | `skill.sift.investigate-source` |
| social-approval | consensus pressure, social proof | "If everyone is said to agree, find one named dissenter before deciding" | `skill.disarm.countermeasures` |
| scarcity | FOMO framing | "If it may run out, decide what decision I would make if it didn't" | `skill.bias.anchoring` |
| conflict | aggression-as-leverage, DARVO | "If conflict spikes, defer the decision one business day by default" | `skill.fallacy.appeals` |
| isolation | divide-and-isolate | "If I'm asked to keep it secret, that itself is the flag — name one trusted person" | `skill.tactic.astroturfing` (nearest drill) + support card from §8 |
| fatigue | late-night persuasion, cognitive load | "If tired, no irreversible decisions; schedule the reply" | `skill.sift.stop` |

Every `skillId` in the routes column (before the `+` caveat, where present) **must** exist in
`data/skills.json`; the test suite enforces this, so the map cannot rot when skills are re-tagged.

---

## 7. Framework atlas cards

Eight cards in `data/framework-notes.json`, each with: what it measures, **evidence tier**
(`strong` / `moderate` / `popular-weak`), common misuse, and which practices here are compatible:

Big Five/FFM (`strong`), HEXACO (`strong`), adult attachment anxiety/avoidance (`moderate`,
dimensional by Fraley et al. 2015), child temperament (`moderate`), MBTI (`popular-weak`, citing
the mixed reliability findings), Enneagram (`popular-weak`), DiSC (`popular-weak`, citing the
predictive-validity criticism), Dark Triad (`moderate` as trait measures — rendered strictly as
*behavior recognition*: what exploitative patterns look like, boundaries, documentation, support —
never as a tool for labeling someone else).

Popular types (16 MBTI codes, 9 Enneagram numbers) are named only as *lenses other people use*, with
a one-line validity caveat. Per-type practice guides are slice 2 and will carry the same labeling.

---

## 8. Privacy & safety

- D1 applies verbatim: responses and observations are **device-local forever**; no sync, no escape
  hatch (`DESIGN-product-decision.md`).
- The UI offers no way to build a profile of another person; the atlas and guides describe
  *recognizing* manipulation, and nothing beyond recognition level. No offense-side content.
- **High-risk disclosure path:** if an observation or reflection answer indicates coercive control,
  threats, stalking, enforced isolation, or financial control, the UI shows a support card
  (trusted-person + local professional and emergency resources) and stops short of any danger
  assessment. Static routing; no scoring of user text.
- Deletion removes responses, observations, and settings; export/import validates every record and
  rejects malformed files wholesale (matching pack-import behavior hardened during the audit).

---

## 9. Testing & acceptance

**Unit (pure, no browser):** scoring determinism; reverse-coding correctness against hand-computed
levels; band edges (3.5 boundary, exact ties → `mixed`); salience rule truth table; every route
`skillId` exists in `skills.json`; export/import round-trip; corrupt-file rejection; `v` migration
reader accepts v1 and rejects unknown future `v`.

**Browser E2E:** acknowledge boundaries → complete inventory offline → map renders with bands and
evidence note → log one observation → salience changes → click a route → attempt appears in the
existing competency log → export → delete → empty state. Keyboard-reachable, mobile-width.

**Success metric** (per the intervention research): improved technique recognition and decision
quality on held-out items via the existing calibration/transfer measures — **not** confidence in a
personality label, which the design deliberately declines to produce.

---

## 10. Trade-offs made explicit

| Decision | Cost | Why anyway |
|---|---|---|
| Bands, no composite score | less satisfying visually | any single number will be misread as "manipulability"; research doesn't license it |
| Original 38-item inventory, not a licensed instrument | no normed percentiles | licensing constraints + house "no network, no vendor" premise; norms add false precision |
| Contexts as separate lens, not traits | one more concept in UI | the evidence is far stronger for situational narrowing than for stable vulnerability |
| Popular systems as labeled lenses only | doesn't fully match "every type" phrasing | honesty; per-type guides arrive in slice 2 with labels |
| Salience = simple counted rule | misses nuance | deterministic, explainable, testable; revisit when observation volume exists |
| Recompute, never store derived levels | CPU on load | banding rules will change; raw answers shouldn't migrate |

---

## 11. What I would revisit

- After ~50 completed inventories (single-user app: months, not years): whether 38 items is right,
  and whether any lens is redundant with the others in *this* user's answers.
- The 3.5 salience threshold and 30-day window are guesses; they're two constants in one function,
  trivially tunable once observations accumulate.
- If calibration/transfer shows the routes don't move recognition, that is the finding — change the
  routes or the countermeasures, not the metric.
- Slice 3 (adaptive inoculation) may want observation tags aligned to a taxonomy like DISARM's
  manipulation techniques; if so, re-tagging is a data edit, not a schema change.

---

## 12. First commit's worth of work

1. `data/profile-items.json` — all 38 items with `record` coding and context tags.
2. `data/profile-guides.json` + `data/framework-notes.json` — countermeasure copy and 8 atlas cards,
   each card citing its sources from the `.firecrawl` research cache.
3. `js/profile.js` + `tests/test-profile.js` — **synthetic responses of known values must produce
   known bands and salience states** (the ground-truth test that makes scoring trustworthy).
4. `js/profilestore.js` + persistence tests — save/read/export/import/delete, corruption rejection.
5. Wire the boundary acknowledgement + inventory + map into `js/app.js` navigation; routes deep-link
   into existing drills. One flow end to end before any atlas UI polish.
