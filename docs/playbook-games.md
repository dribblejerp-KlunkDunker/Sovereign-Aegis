# SOVEREIGN // AEGIS — Game-Design Playbook

How to make the app's existing games better, and how to design new, more fun games for each
subject. Grounded in the inoculation-game literature, serious-game design science, and the
mechanics already in the code.

---

## 1. What the evidence says about games like this

Inoculation games are the best-evidenced intervention in the app's whole domain. Across
*Bad News*, *Go Viral!*, *Harmony Square*, *Cat Park*, and *Cranky Uncle*, randomized trials
repeatedly find three effects: players rate manipulative content **less reliable**, are **more
confident** in spotting it, and are **less willing to share** it
([Bad News](https://misinforeview.hks.harvard.edu/article/global-vaccination-badnews/),
[Harmony Square](https://misinforeview.hks.harvard.edu/article/breaking-harmony-square-a-game-that-inoculates-against-political-misinformation/),
[Cat Park](https://www.tiltstudio.co/solutions/cases/cat-park/) — the last reports +19 points on
spotting and −15 on sharing vs. control).

The mechanism, per the researchers ([Inoculation Science](https://inoculation.science/debunking-versus-prebunking/)):

1. **Forewarning** — you're told manipulation is coming (threat activates defenses).
2. **Weakened dose** — you meet an exaggerated, fictional example, not the real thing.
3. **Counter-arguing** — you generate the resistance yourself (this is the "active" part).
4. **Perspective-taking** — you play *as* the manipulator, which is more effective than being
   lectured at.

Every one of these maps to something the app already has. The playbook's job is to make the
mapping deliberate.

---

## 2. Ten design principles

1. **Technique, not claim.** Teach *moves* (impersonation, polarization, trolling, emotional
   language, conspiracy, discrediting), never "this specific story is false." Badges for moves,
   not fact-lists.
2. **Perspective-taking is the active ingredient.** Let the player *do* the manipulation, then
   feel its consequences.
3. **Weakened dose + humor.** Exaggeration and jokes lower reactance (the "don't lecture me"
   reflex) and avoid accidentally teaching the real technique.
4. **Boosters.** Immunity wanes. Short, repeated sessions beat one long one — the app's daily
   micro-drill is correct; make everything feed it.
5. **Competence, autonomy, relatedness (self-determination theory).** Players stay engaged when
   they feel capable, in control, and part of something. The app's ranks, choice of mode, and
   "collective defense" framing serve these three needs
   ([SDT, University XP](https://www.universityxp.com/blog/2021/2/9/what-is-self-determination-theory)).
6. **Flow via matched difficulty.** The Arena's ELO and the spine's `zone()` ranking already do
   this; keep the challenge at the edge of skill (peak learning gain ≈ 70% mastery).
7. **Feedback that teaches, not just judges.** An explanation should say what the answer *isn't*
   (the app's P1 quality bar) — contrastive feedback is what transfers.
8. **Score what you want trained.** If you score speed, you train speed; if you score
   *calibrated confidence*, you train calibration. Prefer scoring confidence over raw speed
   except where reflex genuinely matters (the Stop move).
9. **Consequence, not just correctness.** The InfoWar Simulator is the template: a wrong move
   should visibly *propagate* — the player should see the contagion they failed to contain.
10. **Honesty is a game feature.** The "refuse to draw / refuse to score" behaviors are load-
    bearing: a game that lies about your progress destroys the trust the whole product needs.

---

## 3. The current games, mapped

| Game | Mechanic | Skill trained | Closest evidence base |
|---|---|---|---|
| **InfoWar Simulator** | Turn-based AP economy, contagion physics, dilemmas, AAR | DISARM countermeasures, collective defense | Harmony Square's "escalation" act; wargaming |
| **Infinite Arena** | ELO, 3 modes, held-out probes every 8th question | Recall + discrimination across 24 skills | Retrieval practice; adaptive testing |
| **SIFT Labs** | 4 scenario labs, timed decisions | SIFT moves | SIFT/lateral reading (Caulfield) |
| **Rhetorical Sandbox** | Premise/conclusion, enthymeme, steel-man | Argument structure | Steel-manning / Street Epistemology |
| **Forensics drill** | Predict-then-measure commit | Reading measurements without over-reading | Provenance/C2PA honesty |
| **Prebunking** | Inoculation scenarios | Resistance to techniques | Bad News / Go Viral! / Cat Park |
| **Memory Vault** | SM-2 self-grade | Retention | Spaced repetition / retrieval practice |

---

## 4. Making each existing game better

### InfoWar Simulator → make consequence legible and stakes personal
- **Show the human cost of each node.** A node is a community, not a blob. When a node is
  "infected," show one concrete consequence (a retracted health advisory, a harassed clerk, a
  shut-down clinic). Consequence, not abstraction, drives the lesson home.
- **Add the "false balance" dilemma.** A recurring dilemma where the tempting cheap action is
  amplifying a debunk by repeating it — teaching that some countermeasures amplify what they
  target (the app already names this skill).
- **Wire DISARM Blue countermeasures** as the actual AAR options (recommendation R6 in
  `manual-improvement.md`), so the grade is earned against the real framework, not a hand-written
  match.

### Infinite Arena → split speed from judgement, and lean into probes
- **Add a "calibrated" mode** where the score is the Brier score of (confidence, correctness),
  not just correctness. This trains the app's central skill inside its fastest game.
- **Explain probes.** When a held-out question appears, the app should *say* it's a probe and
  why (this is how we measure transfer). Transparency here is on-brand and educational.
- **Keep the ratchet.** Preserve the "longest option isn't the answer" and shuffle bias checks —
  they are what make the score mean anything.

### SIFT Labs → shorten the loop, then add a triage gauntlet
- **Add a "60-Second Triage" arcade:** a feed of mixed claims (some legitimate, some
  manipulation) — the player's one move is Stop / Investigate / Continue, under a soft timer.
  The Stop lab's "legitimate continue" fix is the exact content model; this just makes it rapid
  and replayable. Scoring rewards *correct* stops and *correct* continues equally (no cynicism
  bonus).

### Rhetorical Sandbox → make steel-manning competitive
- **"Steelman vs. Strawman" round:** show the argument, show two reconstructions (one charitable,
  one a straw man), the player picks the steelman. Fast, teachable, and it directly trains the
  app's hardest skill — arguing against yourself.
- **Add an adversarial finale:** after steel-manning, the player writes (or picks) the *strongest
  objection to their own position*. This is Street Epistemology's core move, gamified.

### Forensics drill → add a "provenance court"
- **Provenance Court:** given a measurement + a claim, the player rules "admissible / not
  established / inadmissible" and must state *what the measurement cannot establish*. The correct
  answer is always the hedged one (the existing invariant). Framing it as a ruling makes the
  honesty skill feel like power, not a caveat.

### Prebunking → adopt the badge structure explicitly
- **Six manipulation badges** (impersonation, emotion, polarization, conspiracy, trolling,
  discrediting — the canonical list from *Bad News*). Each prebunking scenario awards/withholds
  the badge it trains. Badges are the field's proven retention device.

### Memory Vault → answer-before-reveal (the known fix)
- Four forced-choice options before the flip, drawn from other cards' diagnoses (roadmap N2).
  The demonstrated answer + the self-grade together are two signals where the app currently has
  one weak one.

---

## 5. New game concepts per subject

| Subject | Game idea | Core mechanic | Why it works |
|---|---|---|---|
| **Fallacies** | *Fallacy Gauntlet* | Timed "name the move" against *consequence*, not label — a wrong answer shows the real-world argument that slipped through | Contrastive, fast, feeds the Arena |
| **Biases** | *Inside/Outside View* | Predict an outcome, then a prompt forces the base-rate ("how often does this actually happen?") before you revise | Trains base-rate neglect directly (Tetlock's "outside view") |
| **Calibration** | *Forecast the Headline* | Predict near-term real outcomes as probabilities; Brier-scored over days/weeks | The Good Judgment Project loop, made a habit |
| **ACH** | *Hypothesis Hunt* | Build the matrix, then a "devil's advocate" beats on your top hypothesis; score = how much your ranking moved | Makes ACH adversarial, not arithmetic |
| **OSINT** | *The Analyst's Desk* | A guided geolocation/verification challenge that links out to Bellingcat's real tools | Turns the mock OSINT view into honest, hands-on tradecraft |
| **Provenance** | *Chain of Custody* | Reorder the steps of a media item's provenance; identify the broken link | Teaches "parsed ≠ verified" as a *process* |
| **Collective defense** | *Herd Immunity* | A population model where each correct prebunk "vaccinates" neighbors — the player tunes coverage to reach herd immunity | Directly teaches the field's open question (what % must be vaccinated) |

---

## 6. What "fun" means here, concretely

For a serious game, "fun" is mostly **competence + consequence + choice**:

- **Competence** — visible rank, streak, mastery. The Arena already does ELO well; surface rank
  progress everywhere.
- **Consequence** — the InfoWar contagion is the model. A miss should visibly *spread*.
- **Choice** — modes, loadouts, which skill to drill next. Autonomy is the cheapest fun there is;
  the Next-Action engine should always offer a *choice*, never a single forced task.

The app's **institutional, grave aesthetic is an asset, not a bug** — it is the counterweight to
the trivializing register of the platforms it defends against. Keep the gravity; add consequence,
not confetti. (No points-bling; the app's bronze/Cinzel identity is doing real tonal work.)

---

## 7. Anti-patterns to avoid

- **Gamifying the wrong thing.** XP for *reading* trains clicking, not skill (the roadmap's own
  "encyclopedia vs. gym" critique). Every reward must attach to a *scored judgement*.
- **Reflexive-cynicism rewards.** Do not score "distrust everything" — the Stop-lab fix
  (legitimate "continue" scenarios) is the model. Selective skepticism is the skill.
- **Confidence-gaming.** Never let self-reported confidence move mastery (already guaranteed and
  asserted in code) — keep it that way.
- **Hidden lies.** Never fabricate a leaderboard, telemetry, or "live" feed (the audit removed
  exactly this). An honest game beats a convincing illusion.

---

## 8. How to know a game works

Adopt the app's own measurement bar for any new game:

1. **Attempt-recording from day one** — every right/wrong moment writes to the spine with a
   `context`, or the game produces no evidence and is not worth shipping.
2. **Held-out probes** — a new game should declare held-out items it never uses for practice,
   so transfer (not familiarity) is what gets measured.
3. **Ground-truth tests** — a simulated learner of known ability must produce the expected
   mastery/calibration result (the house standard).
4. **A stated limitation** — each game's efficacy claim ships with its caveat, exactly like
   `transfer()`.

The end-state is the one the whole project is aimed at: **a game the app can prove builds the
skill it claims to build**, on material the player has never seen before.
