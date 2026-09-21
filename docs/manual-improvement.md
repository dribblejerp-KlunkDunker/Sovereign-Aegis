# SOVEREIGN // AEGIS — Improvement Guide

An honest state-of-the-app assessment plus a prioritized, research-backed set of
recommendations. Every recommendation is mapped to an existing roadmap item where one exists,
and to the research in [`report-landscape.md`](report-landscape.md) where it is new.

**How to read this:** recommendations are ordered by the same three tests the roadmap uses —
(1) is it *irreversible if delayed*? (2) does *everything else depend on it*? (3) does it *fix
something currently wrong*? — with felt value as the tiebreaker. Nothing here proposes a new
navigation tier, a rename, a backend, or a build step.

---

## 1. Where the app actually stands

**Strong, and ahead of the field on honesty:**

- The forensics discipline — *measurements without verdicts*, "a parsed C2PA manifest is not a
  verified one" — is the position the professional community itself converged on
  ([c2pa.org](https://c2pa.org/)).
- The **competency spine** (append-only attempt log → per-skill mastery → calibration) is the
  differentiator no researched competitor has: the field's games teach, but none measures
  transfer to held-out items.
- The **calibration panel** is a faithful implementation of the Good Judgment Project's Brier
  methodology ([goodjudgment.com](https://goodjudgment.com/about/the-science-of-superforecasting/)) —
  one of the few debiasing interventions with real evidence — and it correctly refuses to draw
  on insufficient data.
- The **DID-signed prebunk rebuttal** is a genuinely novel use of self-sovereign identity.

**Still weak, per the app's own documents:**

- **Transfer is not yet demonstrated.** Held-out probes exist only in the Arena (6 of 80 items,
  8% vs. the ~20% target). The roadmap's Phase 4 ("demonstrate transfer") is the honest test of
  whether the training works at all — the research reinforces that this is the highest-value
  measurement, because inoculation games show the *effect size* the app should aim to match.
- **SM-2 remains the weakest evidence.** It measures felt recall, and the answer was historically
  visible before reveal (fixed). Answer-before-reveal (roadmap N2) is the known fix.
- **OSINT, video, and narrative views are simulations.** The roadmap's relabel-or-make-real
  choice (Phase 5) is the right one; the research points to a free, honest answer (Bellingcat).
- **Three security/hygiene items remain** from the independent review: browser-CI for the e2e
  gate, legacy private-JWK rotation, and the inline-`style` CSP debt (`ROADMAP.md` §8).

---

## 2. The five principles the research says to follow

1. **Train techniques, not claims.** Inoculation works against *moves* (impersonation, emotional
   language, polarization, conspiracy, trolling, discrediting), not individual false stories
   ([Inoculation Science](https://inoculation.science/debunking-versus-prebunking/)). Keep
   authoring content at the technique level.
2. **Active > passive.** Perspective-taking ("create the misinformation") beats receiving
   counter-arguments. The InfoWar Simulator's adversary perspective and the Rhetorical
   Sandbox's steel-manning are the right shapes; deepen them rather than adding more reading.
3. **Humor and a weakened dose.** Fictional, exaggerated examples lower reactance and avoid
   teaching the real thing ([Harmony Square study](https://misinforeview.hks.harvard.edu/article/breaking-harmony-square-a-game-that-inoculates-against-political-misinformation/)).
4. **Boosters are required.** Immunity wanes; the daily micro-drill is structurally correct —
   make it the spine's front door, not a sidebar widget.
5. **Honesty compounds.** The app's "refuse to draw/score/claim" behaviors are what make its
   numbers credible. Any new feature must carry its limitation *with* the number (the
   `transfer()` caveat pattern).

---

## 3. Prioritized recommendations

### P0 — Do now (irreversible-if-delayed, or foundational)

**R1. Make the confidence→calibration loop the hero surface.**
*Effort:* small (mostly presentation). *Impact:* high. *Trade-off:* none real.
The calibration panel is the app's most novel, most evidence-backed feature and it is one panel
among many. Put "when you said sure, you were right N%" and the reliability curve on the
Command Center above the fold, and route the Next-Action engine to point new operators at their
first 12 confidence-rated answers so the panel can light up.
*Research basis:* Tetlock/Brier scoring ([Commoncog](https://commoncog.com/how-do-you-evaluate-your-own-predictions/)).

**R2. Ship answer-before-reveal in the Memory Vault (roadmap N2).**
*Effort:* ~1 session. *Impact:* converts the weakest evidence in the app into demonstrated
recall *plus* a self-grade — and the gap between the two is itself a calibration signal.
*Trade-off:* one extra interaction on a card. Acceptable because recall is the point.
*Research basis:* retrieval practice / spacing ([SuperMemo history](https://www.supermemo.com/en/blog/the-true-history-of-spaced-repetition)).

**R3. Record the chosen distractor (roadmap N1).**
*Effort:* one field at each recording site, zero UI. *Impact:* turns "relevance 60%" into
"you read tu quoque as ad hominem four times" — a confusion matrix. *Trade-off:* none.

### P1 — Next (highest felt-value + correctness)

**R4. Wire the honest C2PA adjudication path (endorse roadmap Phase 6b).**
Keep parse-only by default; add a "Verify externally" affordance that deep-links to
`contentcredentials.org/verify`. Zero cost, already truthful, and it closes the "parsed ≠
verified" loop for operators who need adjudication.

**R5. Make OSINT honest by pointing at Bellingcat's toolkit (endorse roadmap Phase 5).**
Relabel the OSINT query console a **methodology walkthrough** and link each mock pivot to the
corresponding real tool in Bellingcat's curated, caveat-bearing
[Online Investigation Toolkit](https://bellingcat.gitbook.io/toolkit). Cheapest path from
"looks like a live tool" to "truthful and still useful."

**R6. Adopt DISARM Blue countermeasures as data.**
*Effort:* medium (one dataset import + AAR rendering). *Impact:* the InfoWar AAR's DISARM
diagnostics become stage-matched and faithful to the actual framework, and the app can claim
real DISARM interop. *Trade-off:* none beyond data hygiene.
*Research basis:* [DISARM Red/Blue](https://github.com/DISARMFoundation/DISARMframeworks-20-observable),
[MISP Galaxy](https://www.disarm.foundation/framework).

**R7. Add a "key assumptions check" to the ACH lab.**
*Effort:* small (one more structured step). *Impact:* teaches the single most-used modern
SAT after ACH itself. *Trade-off:* another step; make it optional/toggleable.
*Research basis:* Pherson's Structured Analytic Techniques (Heuer's modern continuation).

### P2 — The credibility payoff (roadmap Phase 4, made concrete)

**R8. Run the transfer experiment properly.**
Administer a non-overlapping held-out baseline on first run, then a fresh set after N practice
sessions, and show baseline-vs-current with a wide, honest confidence interval and the exact
caveat the design already specifies. The research gives the app a benchmark to cite: inoculation
games move spotting by double-digit percentage points
([Cat Park: +19pts](https://www.tiltstudio.co/solutions/cases/cat-park/)). Matching a fraction
of that on *unpracticed* items is a publishable result — and if the app does *not* improve
transfer, that finding changes the product honestly.

**R9. Adopt inoculation-game design patterns across the suite.**
Badges (six manipulation techniques), humor, perspective-taking, and short booster sessions —
detailed per-game in [`playbook-games.md`](playbook-games.md). The app already has the building
blocks; this is about deliberate, evidence-aligned use rather than new machinery.

### P3 — Positioning, community, and the remaining hardening

**R10. State the "defend, don't abstain" stance in onboarding.**
One paragraph distinguishing AEGIS from digital-minimalism's "log off" advice. It clarifies who
the app is for (people who cannot leave the information environment) and preempts the
"why not just quit social media?" objection.

**R11. Position and interop as "DISARM for individuals."**
No researched project teaches ordinary users the professional influence-operation taxonomy with
measurement. Make that the one-line positioning, and make technique IDs exportable in the MISP
Galaxy shape so case packs could be read by analysts.

**R12. Close the independent-review leftovers.**
(a) Run `npm run test:e2e` in a browser CI job and report headless vs. browser separately;
(b) make legacy private-JWK rotation one-click; (c) move templates off inline `style=""` so
CSP `style-src` can drop `'unsafe-inline'`. These are the last hardening steps and the
precondition for the strongest CSP posture (`ROADMAP.md` §8).

---

## 4. What not to do (endorsed from the roadmap)

- **No backend/accounts.** The premise is the product; the research shows the like-minded field
  (inoculation, DISARM, C2PA) can all be adopted client-side.
- **No "confidence score" over uncalibrated forensic filters.** This is the exact overclaim the
  audit removed; the field agrees.
- **No neural deepfake detector in-browser.** No small model gives a defensible error rate on
  arbitrary media.
- **Don't rewrite the content.** ~400 KB of hand-authored domain content is the strongest asset.
- **Don't add a menu tier** for the cognitive subtabs; route by competency (roadmap Phase 3)
  instead.

---

## 5. One-line summary

The app's honest instrumentation is ahead of the field; its training is behind its own bar. The
highest-leverage moves are: **make calibration the hero (R1), fix SM-2's evidence quality (R2),
and run the transfer experiment (R8)** — everything else either feeds those three or is cheap
hygiene.
