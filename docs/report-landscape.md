# Research Report — The Landscape Around SOVEREIGN // AEGIS

**Prepared:** 2026-08-21 · **Method:** full codebase survey + web search and primary-source
scraping via Firecrawl (16 discovery queries across 13 subject areas, plus targeted reads of
primary sources). All external claims are cited; a consolidated bibliography is in
[`sources.md`](sources.md).

---

## Executive summary

SOVEREIGN // AEGIS sits at the intersection of four movements that are all live, well-funded,
and actively producing research: **media/information literacy**, **psychological inoculation
against misinformation**, **open-source intelligence & media forensics**, and **self-sovereign
identity / local-first computing**. It is unusual in one important way: most of the field is
split across these silos, while AEGIS deliberately welds them into a single instrument suite
with a shared competency model. That is the app's clearest differentiator — and the research
shows it is also the app's clearest opportunity.

Three findings matter most:

1. **The "game" approach is the proven one.** Inoculation games — *Bad News*, *Go Viral!*,
   *Harmony Square*, *Cat Park*, *Cranky Uncle* — have published, randomized-trial evidence that
   playing them reduces perceived reliability of manipulative content, raises confidence in
   spotting it, and lowers self-reported sharing. AEGIS already contains the building blocks of
   exactly this mechanic (perspective-taking, weakened doses, technique badges) and would
   benefit from adopting their specific design patterns more deliberately.
2. **The app's "honest-by-construction" stance is aligned with, and slightly ahead of, the
   field's maturity.** The professional counter-disinformation community (DISARM, EDMO, the
   C2PA provenance standard) has converged on the same principle the audit forced onto AEGIS:
   *measure and label, don't claim a verdict the instrument can't support*. The app's
   "measurements without verdicts" forensics discipline and its refusal to let an LLM be
   authoritative are, in 2026, best practice rather than a limitation.
3. **The community the app is "like-minded" with is real and reachable.** It spans
   educators (News Literacy Project, Checkology), researchers (Cambridge's Social
   Decision-Making Lab, the DISARM Foundation, EU DisinfoLab, DFRLab), practitioners
   (Bellingcat's volunteer community), and rationalist/self-improvement forums (LessWrong,
   Street Epistemology). The strongest alignment is with the **inoculation / prebunking**
   community and the **DISARM / FIMI** community — both of which already use the app's exact
   vocabulary.

---

## Part 1 — What this app projects

To find like-minded communities, it is first necessary to state what the app is *for* and what
it *believes*. Read from the code and the design documents, the worldview is:

- **Cognitive sovereignty is a thing that can be defended.** The app's organizing claim is that
  "the manipulation of human belief is the oldest weapon of power," and that individuals and
  societies can erect deliberate defenses against it (`index.html`, `PROJECT.md`).
- **Defense is training, not just information.** The roadmap is explicit that informing is not
  the same as training, and that the product's failure mode is being an encyclopedia rather than
  a gym (`ROADMAP.md` §0).
- **Skepticism must not become reflexive cynicism.** The Stop-lab fix — adding legitimate
  "continue" scenarios so the app does not train distrust of everything — is a core, deliberate
  value (`ROADMAP-EVIDENCE.md` P0-as-built).
- **Honesty is a hard constraint.** Measurements are shown without invented verdicts; the
  forensics view explicitly says "why there is no score here"; the LLM is never authoritative;
  the calibration panel refuses to draw a curve from insufficient data. This is "honest by
  construction" and it is treated as load-bearing, not decorative (`ROADMAP.md`, `AUDIT.md`).
- **The record of a person's weaknesses must never leave their device.** The attempt log is
  described as "the most sensitive data in the app" and is deliberately excluded from any sync
  design (`DESIGN-product-decision.md`, decision D1).
- **Identity should be self-sovereign.** The app mints a `did:key` identity, signs statements
  and credentials with WebCrypto ECDSA P-256, and treats "no accounts, no backend" as a premise,
  not a gap (`PROJECT.md`, `DESIGN-aegis-reema-seam.md`).
- **The aesthetic is institutional and grave, not gamified-lite.** Dark granite/bronze,
  Cinzel/Garamond, "solemn gravitas," an "Aegis" military-civilizational frame. The tone is a
  deliberate counterweight to the trivializing register of the platforms being defended against.

This positions the app in a specific, identifiable family of projects and people, mapped below.

---

## Part 2 — Like-minded communities and forums

Organized by movement. Each entry notes *why* the community is aligned and *where* its energy
currently is.

### 2.1 Media & information literacy educators

The closest institutional cousins. These communities teach the same skills the app trains
(SIFT, source evaluation, lateral reading) and are its most natural distribution and content
channel.

- **News Literacy Project (NLP) / Checkology** — the largest US news-literacy non-profit; its
  Checkology platform reached ~22,800 educators and ~890,000 students in 2025–26
  ([newslit.org](https://newslit.org/)). Checkology is a browser classroom with lessons,
  activities, and assessments — the same "curriculum + assessable items" shape as AEGIS.
- **MediaWise (Poynter Institute)** — teen-and-elder-focused fact-checking education, the
  source of much of the public-facing SIFT material.
- **Stanford Digital Inquiry Group (formerly SHEG / COR)** — the "lateral reading" and
  "civic online reasoning" research line by Sam Wineburg and Mike Caulfield; the evidence base
  behind SIFT's claim that expert fact-checkers read *across* sources rather than *into* them
  ([Aft](https://www.aft.org/ae/spring2025/caulfield_wineburg)).
- **Center for an Informed Public (University of Washington)** and **First Draft** — research
  and practitioner communities on misinformation ecosystems and newsroom verification.

*Alignment:* identical pedagogy (SIFT is literally one of the app's four labs), shared enemy
(misinformation), shared commitment to non-partisan epistemic skills. *Gap:* these communities
teach; AEGIS's differentiator is that it *trains and measures*.

### 2.2 Inoculation & prebunking researchers

The scientifically most-aligned community — and the one whose language the app already speaks
("prebunking," "inoculation," "weakened doses," "counter-argue").

- **Cambridge Social Decision-Making Lab** (Sander van der Linden, Jon Roozenbeek) and the
  **Inoculation Science** hub ([inoculation.science](https://inoculation.science/debunking-versus-prebunking/)).
  This is the intellectual home of *Bad News*, *Go Viral!*, *Harmony Square*, and the
  prebunking framework the app's Prebunking module implements.
- **Jigsaw (Google)** — ran platform-scale prebunking video campaigns and published the
  prebunking taxonomy (technique-based, not claim-based).
- **John Cook / Cranky Uncle** — climate-misinformation inoculation via cartoons and critical
  thinking ([crankyuncle.com](https://crankyuncle.com/)); runs an active multilingual,
  co-design research program.

*Alignment:* near-total — same theory, same "active inoculation via perspective-taking" mechanic,
same technique-level (not claim-level) framing. This is the community AEGIS should cite, learn
from, and potentially co-publish with.

### 2.3 Counter-disinformation / FIMI practitioners

The "professional defenders" community. Uses structured taxonomies and shares intelligence in a
common language — which is exactly what AEGIS's DISARM module teaches.

- **DISARM Foundation** — the open-source framework (CC-BY-SA-4.0) for documenting influence
  operations; the app's 39-technique DISARM content is a direct implementation of it
  ([disarm.foundation](https://www.disarm.foundation/framework)). A DISARM v2.0 is in prototype.
- **EU DisinfoLab, DFRLab (Atlantic Council), Institute for Strategic Dialogue (ISD),
  Global Disinformation Index, NewsGuard** — the main analytic NGOs. EDMO (the European Digital
  Media Observatory) is the EU's hub network.
- **MISP** — the threat-intel platform whose Galaxy library bundles the DISARM taxonomies;
  relevant if the app's influence-operation tagging ever wants to interoperate with real
  analysts' tooling.

*Alignment:* identical taxonomy (DISARM TTPs), identical "share intelligence in common terms"
ethos, identical honesty about what a signal can and cannot establish. *Gap:* these are
professional tools with teams; AEGIS is a single-operator trainer. The app is, in effect, the
"DISARM for individuals."

### 2.4 Open-source intelligence (OSINT) practitioners

- **Bellingcat** — the flagship open-source investigation collective; maintains the
  collaborative **Online Investigation Toolkit** ([gitbook](https://bellingcat.gitbook.io/toolkit))
  and runs a large volunteer community across Discord, Reddit, and Mastodon.
- **OSINT Framework, IntelTechniques (Michael Bazzell), Trace Labs, OSINT Curious** — tools,
  handbooks, and communities. `r/OSINT` is the active practitioner forum.

*Alignment:* shares the forensics and verification half of the app. Bellingcat's toolkit is the
obvious candidate for the app's OSINT module to honestly point at (see
`manual-improvement.md` §5.5 — the roadmap already flags the OSINT module's mock pivots).

### 2.5 Rationality, skepticism, and epistemic self-improvement

The "defended mind" half of the app, in community form.

- **LessWrong / the rationalist community** — home of bias-and-debiasing writing, Bayesian
  reasoning, calibration, and epistemic norms
  ([LessWrong](https://www.lesswrong.com/w/rationality)).
- **Street Epistemology** — a grassroots movement for respectfully probing the *method* behind
  beliefs; deeply aligned with the app's Socratic steel-manning drill.
- **Clearer Thinking (Spencer Greenberg)** and **Center for Applied Rationality (CFAR)** —
  debiasing tools and rationality training; CFAR's "calibration training" is a direct ancestor
  of the app's confidence panel.
- **r/ChangeMyView, r/skeptic** — large public forums practicing the exact skill set (charity,
  steel-manning, fallacy-spotting).

*Alignment:* the app's cognitive pillar, confidence capture, and steel-manning are all drawn
from this tradition. *Gap:* this community skews abstract/individual; AEGIS's contribution is to
tie these skills to *real disinformation in the wild*.

### 2.6 Provenance, media forensics, and content authenticity

- **C2PA / Content Authenticity Initiative (CAI)** — the open standard (Content Credentials)
  for attaching cryptographically signed provenance to media; backed by Adobe, Microsoft,
  Intel, Truepic, the BBC, and others ([c2pa.org](https://c2pa.org/)). The app's C2PA parser is
  an implementation of this exact spec.
- **Truepic, InVID/WeVerify, WITNESS Media Lab, Hive** — verification tooling and deepfake
  detection.

*Alignment:* identical problem (synthetic media and stripped context) and identical
solution-shape (provenance + honest labeling). The app's "parsed ≠ verified" discipline is
precisely the C2PA community's own warning about conflating a manifest with a guarantee.

### 2.7 Self-sovereign identity & local-first computing

- **W3C Decentralized Identifiers Working Group** and the **Decentralized Identity Foundation
  (DIF)** — the standards bodies behind `did:key` and Verifiable Credentials
  ([W3C DID spec](https://www.w3.org/TR/did-core/)).
- **The local-first software movement** (Ink & Switch) and **self-hosting / privacy
  communities** — the "your data never leaves your machine" premise.

*Alignment:* the app's identity pillar is a working, honest implementation of the SSI story the
industry mostly talks about. Its DID-signed prebunk rebuttals (`DESIGN-aegis-reema-seam.md`) are
a genuinely novel use of self-sovereign identity for *collective* defense.

### 2.8 Attention economy & cognitive-sovereignty culture

- **Center for Humane Technology** (Tristan Harris), **Cal Newport** (*Digital Minimalism*),
  **Johann Hari** (*Stolen Focus*), and communities like `r/digitalminimalism` and `r/nosurf`.
- This is the cultural, "the attention is being farmed" framing the app's masthead speaks from.

*Alignment:* shared diagnosis. *Divergence:* this movement tends toward *abstinence* (leave the
platforms); AEGIS argues for *armed presence* (stay, but defend). Both are legitimate; the
difference is worth stating in onboarding so the app's stance is clear.

---

## Part 3 — Projects that share common ideas

The closest existing projects, with what AEGIS can learn from each.

| Project | What it is | Overlap with AEGIS | What AEGIS can adopt |
|---|---|---|---|
| **Bad News** ([getbadnews.com](https://www.getbadnews.com)) | Perspective-taking "fake-news creator" game; six manipulation badges | Active inoculation; technique badges | Badge/technique structure; humor as a reactance-reducer |
| **Go Viral!** | 5-minute COVID-misinfo inoculation game (WHO/UN/UK Gov) | Prebunking | Short-session pacing; mobile-first |
| **Harmony Square** ([harmonysquare.game](https://www.harmonysquare.game)) | 4-level election-misinfo game (trolling, emotion, amplification, escalation); RCT n=681 | InfoWar Simulator's adversary-perspective | Four-act campaign structure; "likes" as a seductive score |
| **Cat Park** ([Tilt](https://www.tiltstudio.co/solutions/cases/cat-park/)) | 15–20 min disinfo game; Cambridge found +19pts spotting, −15pts sharing | Prebunking + countermeasure teaching | Explicit "after you spread it, learn the countermeasures" beat; lesson plans |
| **Cranky Uncle** ([crankyuncle.com](https://crankyuncle.com/)) | Cartoon + critical-thinking inoculation vs climate denial; multilingual | Fallacy/technique spotting | Humor + cartoons to lower the stakes; FLICC taxonomy |
| **Checkology** ([NLP](https://newslit.org/)) | Browser classroom, lessons + assessments | Curriculum + assessable items | Lesson structuring; educator distribution |
| **DISARM Framework** ([disarm.foundation](https://www.disarm.foundation/framework)) | Open taxonomy of influence-operation TTPs (Red/Blue) | The app's DISARM content | Blue (countermeasure) framework; v2.0 "Observations" model; MISP interop |
| **Bellingcat Toolkit** ([gitbook](https://bellingcat.gitbook.io/toolkit)) | Curated OSINT tool directory with reviews | OSINT/verification pillar | Real-tool links to make the OSINT module honest |
| **C2PA / Content Credentials** ([c2pa.org](https://c2pa.org/)) | Signed media provenance standard | The app's C2PA parser | `contentcredentials.org/verify` as the honest adjudication path |
| **LessWrong / CFAR / Clearer Thinking** | Rationality & debiasing training | Cognitive pillar, calibration | Calibration-training exercises; "Inside View vs Outside View" drills |
| **Good Judgment Project** ([goodjudgment.com](https://goodjudgment.com/about/the-science-of-superforecasting/)) | Forecasting tournaments; Brier scoring | The app's confidence/Brier panel | Probabilistic-forecast scoring rules; the "60% means 60%" discipline |
| **Anki / SuperMemo (SM-2)** | Spaced-repetition engines | The app's Memory Vault | SM-2 is already used; consider answer-before-reveal (roadmap N2) |
| **W3C DID / DIF** | Decentralized identity standards | The app's `did:key` identity | Verifiable Credentials for signed assessments |

**The unifying observation:** every one of these projects does *one* of the app's pillars well.
None of them, as of this research, ties the pillars together with a shared **competency spine**
that records attempts, estimates mastery, and reports transfer. That is the white space AEGIS
occupies. The risk is not competition; it is that the app reinvents a wheel where a mature,
well-cited project already exists (inoculation mechanics, DISARM taxonomy, C2PA, SM-2) instead
of interoperating with it.

---

## Part 4 — Per-subject findings

### 4.1 (Core) Logical fallacies & informal logic

The app's fallacy taxonomy (relevance, structure, scope, appeals, formal-vs-informal) maps
cleanly onto the standard reference taxonomies in the
[Internet Encyclopedia of Philosophy](https://iep.utm.edu/fallacy/), the
[Stanford Encyclopedia of Philosophy](https://plato.stanford.edu/entries/fallacies/), and
[The Fallacy Files](https://www.fallacyfiles.org/resource.html).

**Research notes for improvement:**

- The field distinguishes **formal** (form-invalid: affirming the consequent) from **informal**
  (context-dependent: ad hominem) fallacies. The app already teaches this split
  (`skill.fallacy.formal-vs-informal`) — it is the pedagogically correct seam to keep.
- The single highest-value teaching pattern in this domain is **contrastive explanation**: an
  item's explanation should say what the fallacy is *not* (ad hominem vs. poisoning the well vs.
  genetic fallacy). `ROADMAP-EVIDENCE.md` P1 already adopted this as a ratcheted quality bar; the
  research confirms it is the right bar (discrimination, not recognition, is what transfers).
- **"Name the fallacy" is the weak form of the skill.** The strong form is *"name the fallacy,
  state the charitably reconstructed argument, and give the counter-move"* — which is exactly the
  app's three-part Rhetorical Sandbox (premise/conclusion → enthymeme → steel-man). That
  ordering is sound and should be preserved.

### 4.2 (Core) Cognitive biases & heuristics

The app's bias model follows the **System 1 / System 2** dual-process account popularized by
Kahneman's *Thinking, Fast and Slow* ([Decision Lab reference](https://thedecisionlab.com/reference-guide/philosophy/system-1-and-system-2-thinking)).
Its skill set — confirmation, availability, anchoring, attribution, probability/sunk-cost — is a
subset of the larger bias catalogs ([Decision Lab biases](https://thedecisionlab.com/biases)).

**Research notes for improvement:**

- Debiasing is **hard and mostly fails when taught as abstract knowledge**; it transfers best as
  *situated practice* (bias in a realistic claim, then a correction) and as *process rules* (e.g.,
  "consider the opposite," "think of the outside view"). AEGIS's design of presenting biases
  *inside* disinformation scenarios is the correct, evidence-aligned form.
- The app's **confidence capture → calibration panel** is the field's most defensible debiasing
  tool. Tetlock's forecasting program and the Brier-score literature show that *scoring your own
  confidence against outcomes* is one of the few interventions that measurably improves judgement
  ([Commoncog on Brier scoring](https://commoncog.com/how-do-you-evaluate-your-own-predictions/),
  [Good Judgment Project](https://goodjudgment.com/about/the-science-of-superforecasting/)). This
  is AEGIS's most novel asset and should be surfaced more prominently (see
  `manual-improvement.md`).

### 4.3 (Core) SIFT & lateral reading

SIFT (**S**top, **I**nvestigate the source, **F**ind better coverage, **T**race claims) is Mike
Caulfield's four-moves framework ([Hapgood](https://hapgood.us/2019/06/19/sift-the-four-moves/)).
Its evidence base is the Stanford/Wineburg finding that fact-checkers read **laterally** (across
the web) rather than **vertically** (into the page) — the behavioral difference that predicts
verification skill.

**Research notes for improvement:**

- The app's four SIFT labs are the **exact** right decomposition. The one thing the literature
  emphasizes that the app should foreground: **Stop is the habit, not a step** — it is the
  emotional-pull detection that must fire *before* the other three. The app already encodes this
  ("notice the emotional pull … before sharing") and already fixed the risk of training reflexive
  cynicism by including legitimate "continue" scenarios. Keep that invariant.
- "**Boosting**" (Hertwig) is the adjacent concept: teaching the *competence* (how to search,
  how to trace) rather than merely warning about the *bias*. SIFT is a boosting intervention, and
  the app's OSINT + trace labs are where this could deepen.

### 4.4 (Core) Inoculation theory & prebunking

The strongest evidence base in this entire report. Inoculation theory (McGuire, 1961) treats
resistance to persuasion like immunity: a **forewarning** plus a **weakened dose** plus
**counter-arguing practice** produces "mental antibodies." The modern revival (van der Linden,
Roozenbeek) turned it into **prebunking** — inoculating against *techniques* rather than
individual claims ([Inoculation Science](https://inoculation.science/debunking-versus-prebunking/)).

Randomized-trial findings, consistently replicated across the game suite:

- *Bad News* significantly reduces perceived credibility of manipulative content, raises
  confidence in spotting it, and lowers self-reported sharing
  ([HKS Misinformation Review](https://misinforeview.hks.harvard.edu/article/global-vaccination-badnews/)).
- *Harmony Square* (n=681, international) reproduces all three effects for election
  misinformation ([HKS Misinformation Review](https://misinforeview.hks.harvard.edu/article/breaking-harmony-square-a-game-that-inoculates-against-political-misinformation/)).
- *Cat Park*: +19 percentage points on spotting disinformation, −15 on intent to share, vs.
  control ([Tilt case study](https://www.tiltstudio.co/solutions/cases/cat-park/)).

**Design implications (this is the heart of the game playbook):**

1. **Perspective-taking is the active ingredient** — players *create* the misinformation, which
   is more effective than passively receiving counter-arguments ("active > passive" inoculation).
2. **Weakened dose + humor** — fictional, exaggerated examples reduce the risk of "inoculating"
   people into the real thing, and humor lowers *reactance* (resistance to being taught).
3. **Technique badges > fact lists** — all four games teach *moves* (impersonation, emotional
   language, polarization, conspiracy, trolling, discrediting), not individual false claims.
4. **Boosters** — the immunity wanes; repeated short exposures are needed (the app's daily
   "micro-dose" drill is the correct structure).

### 4.5 (Core) DISARM & foreign information manipulation (FIMI)

The app's 39 DISARM techniques are a direct implementation of the
**DISARM Red Framework** — the open, CC-BY-SA-4.0 taxonomy of influence-operation
TTPs organized by the attacker's kill chain (Plan → Prepare → Execute → Assess …)
([disarm.foundation](https://www.disarm.foundation/framework),
[GitHub](https://github.com/DISARMFoundation/DISARMframeworks-20-observable)).

**Research notes for improvement:**

- DISARM ships as **Red** (attacker), **Blue** (responder/countermeasure), and now a **v2.0
  "Observations"** framework in prototype. The app currently teaches Red TTPs plus a
  countermeasure-selection skill. Adopting the **Blue framework's** stage-matched countermeasures
  as a data source would make the InfoWar AAR's DISARM diagnostics richer and more faithful.
- The framework is bundled in **MISP Galaxy**, so AEGIS's technique IDs (T0002, T0004, …) can be
  made machine-interoperable with the professional tooling — a cheap credibility win if the app
  ever exports case packs to analysts.
- The EU's term of art is **FIMI** (foreign information manipulation and interference); the app's
  "InfoWar" framing is the public-facing cousin of this professional vocabulary. Both are worth
  teaching, because a learner who can map a TTP to DISARM can also read a FIMI report.

### 4.6 (Core) ACH & structured analytic techniques

Analysis of Competing Hypotheses (Richards Heuer) is the CIA-toolkit method the app's ACH Matrix
Lab implements: enumerate hypotheses, score evidence for/against each, then read the
**inconsistency** and **support** scores instead of your favorite hypothesis
([Heuer, Wikipedia](https://en.wikipedia.org/wiki/Richards_Heuer);
[SANS ACH intro](https://isc.sans.edu/diary/22460)).

**Research notes for improvement:**

- Heuer's whole argument is that intelligence failures are **cognitive** (mindset, satisficing,
  confirmation) before they are informational — which is *why* ACH belongs in the same suite as
  the bias and fallacy labs. The app's pillar structure is theoretically coherent.
- The modern extension is **Pherson's Structured Analytic Techniques** (multiple hypothesis
  generation, key assumptions check, red-teaming). A "key assumptions check" or a
  "devil's advocate" drill would be a cheap, high-value addition to the ACH lab (see
  `playbook-games.md`).

### 4.7 (Medium) Media forensics & provenance

The app's stack — ELA (error-level analysis), 2D FFT, STFT spectrogram, C2PA manifest parsing —
maps to the standard verification toolkit: FotoForensics (ELA), InVID/WeVerify (video), and the
**C2PA/Content Credentials** standard for signed provenance ([c2pa.org](https://c2pa.org/)).

**Research notes for improvement:**

- The field's own consensus is the app's already-implemented discipline: **a parsed manifest is
  not a verified one**, and absence of a manifest is not evidence of tampering. C2PA verification
  requires signature validation the app currently defers to
  `contentcredentials.org/verify` — the honest and correct default (roadmap Phase 6b).
- The published deepfake-detection literature is explicit that **no single filter (ELA, FFT, or a
  classifier) yields a defensible verdict on arbitrary media**; the app's "measurements without
  verdicts" design is the responsible ceiling, and the forensics *drill* (predict what the
  measurement will show, then commit) is a genuinely good training design not seen in the
  competitor set.

### 4.8 (Medium) OSINT tradecraft

Bellingcat's methodology and its **Online Investigation Toolkit** (maps/satellites, geolocation,
image/video verification, archiving) are the canonical reference
([gitbook](https://bellingcat.gitbook.io/toolkit)). The app's OSINT module currently renders mock
pivots; the roadmap already flags relabeling it as a *methodology walkthrough* or wiring real
CORS-permitting endpoints (`ROADMAP.md` Phase 5). The research endorses the "relabel + link to
Bellingcat's toolkit" path as the honest, low-cost option.

### 4.9 (Medium) Epistemic calibration

The Brier score and reliability diagrams the app's calibration panel draws are the
**Good Judgment Project** methodology ([Tetlock's science](https://goodjudgment.com/about/the-science-of-superforecasting/);
[Brier scoring explained](https://commoncog.com/how-do-you-evaluate-your-own-predictions/)).
The literature's headline result — "when you said you were sure, you were right N% of the time"
— is *precisely* the sentence the app's panel already surfaces. This is the app's single most
evidence-aligned feature and deserves top billing in the Overview (see `manual-improvement.md`).

### 4.10 (Medium) Spaced repetition (SM-2)

The app's Memory Vault is a correct SM-2 implementation (ease factor, interval, quality
self-grade). The evidence base — retrieval practice and spacing are among the most robust effects
in learning science
([SuperMemo history](https://www.supermemo.com/en/blog/the-true-history-of-spaced-repetition);
[Wikipedia](https://en.wikipedia.org/wiki/Spaced_repetition)) — fully supports the roadmap's
direction: **auto-generate cards from every tagged content item** and **add answer-before-reveal**
so SM-2 measures demonstrated recall, not felt recall (roadmap P4 and N2).

### 4.11 (Medium) Self-sovereign identity

The app's `did:key` identity and ECDSA P-256 signing are a faithful, minimal implementation of
the **W3C Decentralized Identifiers** spec ([W3C DID Core](https://www.w3.org/TR/did-core/)).
Its genuinely novel move — DID-signed **prebunk rebuttal cards** that a recipient verifies in
place — has no direct equivalent in the researched landscape and is a defensible "novel
contribution" claim.

### 4.12 (Medium) Attention economy & cognitive sovereignty

*Digital Minimalism* (Newport), *Stolen Focus* (Hari), and the Center for Humane Technology
supply the cultural frame. The app's distinctive stance — **defend rather than abstain** — is a
coherent position to state explicitly, because it differs from the dominant "log off" advice and
that difference is a feature (it serves people who cannot simply leave the information
environment).

---

## Part 5 — Gaps and opportunities (summary)

1. **Interoperate with, don't reinvent, the mature pieces.** DISARM Blue framework, C2PA verify,
   Bellingcat's toolkit, and the inoculation-game evidence are all free to adopt and would each
   close a known honest gap with minimal code.
2. **Make the confidence/calibration panel the hero.** It is the app's most novel, most
   evidence-backed feature, and it is currently one panel among many.
3. **Adopt inoculation-game design patterns deliberately.** Badge structure, humor,
   perspective-taking, boosters — the app already has the pieces; the playbook shows how to use
   them.
4. **State the "defend, don't abstain" stance.** It is the app's clearest philosophical
   differentiator from the attention-economy movement.
5. **Position as "DISARM for individuals."** The app is the only researched project that teaches
   ordinary users the professional influence-operation taxonomy with measurement.

The detailed, actionable version of each of these lives in
[`manual-improvement.md`](manual-improvement.md) and [`playbook-games.md`](playbook-games.md).
