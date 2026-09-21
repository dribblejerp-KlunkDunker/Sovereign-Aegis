# SOVEREIGN // AEGIS — Operator Manual

A field guide for the operator: what every view does, how to use it, what it trains, and what
it will honestly tell you. The app is offline-first and account-free — everything you produce
stays on your machine unless you explicitly export it.

---

## 1. What this app is

SOVEREIGN // AEGIS is a training suite for **cognitive sovereignty** — the ability to think
clearly and act deliberately in an information environment engineered to manipulate you. It is
organized around **Four Pillars**:

| Pillar | Name | What it defends |
|---|---|---|
| I | **Cognitive Fortification** | Your own reasoning: biases, fallacies, memory, argumentation |
| II | **Real-Time Protection** | The moment of encounter: analyzing a claim before you react or share |
| III | **Signal & OSINT Forensics** | Evidence: media provenance, audio/image forensics, structured analysis |
| IV | **Collective Defense** | The social immune system: influence-operation simulation, countermeasures |

Everything you do that has a right/wrong answer is recorded against one of **24 named skills**
and feeds two honest numbers: **mastery** (can you do it?) and **calibration** (do you know
when you can?).

---

## 2. Getting started

1. **On first run** the app shows a **5-step onboarding** that introduces the Four Pillars
   doctrine and ends by generating your operator profile.
2. **Your identity** is created automatically — a `did:key` identity with a P-256 keypair, kept
   in a non-extractable crypto key. You can see and back it up in **10 // Sovereign DID**.
3. **Start at the Command Center.** The **"Daily Inoculation"** micro-drill and the **Memory
   Queue** are designed to be your 2-minute daily habit. The **Next Action** engine points you
   at the highest-value single step based on your own weak skills.
4. **Take the confidence taps seriously.** Every answering surface has a three-state control —
   **sure / unsure / guess**. It remembers your last setting, so it costs nothing when your
   certainty hasn't changed. It is the raw material for the calibration panel, the app's most
   important mirror.

> **The core loop:** encounter a claim → run it through VERDAD or a lab → get scored → the
> app schedules your *weakest* skills for spaced review → the calibration panel shows whether
> your confidence tracks your accuracy.

---

## 3. Interface anatomy

- **Masthead** — the app's identity and its organizing claim.
- **Topbar** — status pills: **Sentinel**, **Threat level**, **BYOK** (offline heuristics vs.
  your own Gemini key), a UTC clock, **📋 Clipboard** (route clipboard text to VERDAD), and
  **Quick Calm** (a 4-7-8 breathing pause).
- **Telemetry ribbon** — EPOCH, your **DID**, **Immunity Index**, **AP**, storage size, and
  latency.
- **Sidebar** — the ten numbered views plus footer actions (Quick Calm, Quick Sign Claim).

---

## 4. Views, in order

### 00 // Command Center

Your dashboard. Shows the Four Pillars hero, real product statistics (4 pillars / 24 skills /
119 arena questions), the **Daily Inoculation micro-drill**, a **streak** counter, the **Memory
Queue due count**, your **operator profile spiderchart** (a five-axis SVG pentagon: SIFT,
pattern, memory, theory, practice → a single **Resilience Index**), and the **calibration
panel** (see §6). Use this as home base; it recomputes from your attempt log every time you
return.

### 01 // Cognitive Lab

Ten subtabs. This is the "gym."

1. **Masterclasses (4)** — in-depth courses: computational propaganda, epistemic health &
   debiasing, OSINT tradecraft, and decentralized provenance. Reading a section schedules its
   skills for review rather than merely marking a checkbox.
2. **Fallacies Taxonomy (22+)** — the reference library of logical fallacies, each with name,
   Latin form, mechanism, and countermeasure. This is where you look up *what you just fell for*.
3. **AI Media Forensics & C2PA** — upload or drop an image/audio/video and read real
   measurements: ELA (error-level analysis), a 2D FFT spectrum, an STFT spectrogram with
   8 kHz/16 kHz vocoder flags, and the C2PA manifest tree. **Important:** the panel is withheld
   behind a **predict-then-measure** commit — predict what the measurement will show *before*
   you see it. This is the drill, and the second question ("what does this *establish*?") is the
   real lesson: a measurement is not a verdict.
4. **DISARM Framework** — the influence-operation taxonomy (Plan → Prepare → Execute → Assess).
   Learn to map real-world manipulation to its TTPs, the vocabulary analysts actually use.
5. **Inoculation Prebunking** — scenario-based inoculation: you are shown a weakened dose of a
   manipulation technique *before* you meet it in the wild, and score how well you resist it.
6. **Rhetorical Sandbox** — dissect an argument into premise/conclusion, then work the
   **enthymeme drill** (name the unstated assumption) and **Socratic steel-manning** (build the
   strongest *charitable* counter-argument). This trains reasoning against *your own* side too.
7. **Infinite Arena** — rapid-fire question gauntlet with an ELO rank and modes:
   **blitz** (60-second bursts), **suddendeath** (streak ends on a miss), and **zen** (untimed).
   Every 8th question is a **held-out probe** — an item you haven't practiced — so the app can
   measure whether practice transfers to new material.
8. **Daily Memory Queue** — your SM-2 spaced-repetition deck. Reveal, self-grade, and the
   scheduler decides when you'll see it again. SIFT mistakes auto-queue new cards here.
9. **SIFT Labs** — the four moves as four scored labs: **Stop** (notice the emotional pull —
   and learn that some claims are legitimately fine to continue on), **Investigate the source**,
   **Find better coverage**, **Trace to origin**. Missed concepts flow straight into the Memory
   Queue.
10. **Epistemic Commons** — shared, importable case packs (community-contributed scenarios).
    Export and import packs to study how others frame and rebut manipulation.

### 02 // InfoWar Simulator

A turn-based **network defense serious game** with a 10-action-point economy. You command a
network under an influence-operation campaign: allocate AP to inoculate nodes, quarantine
seeded accounts, and counter amplification as a **contagion wavefront** propagates. Breaking
**crisis dilemmas** force hard trade-offs. At the end, the **After-Action Review (AAR)** lets
you scrub turn-by-turn, grades your containment (S/A/B/C/D/F), and unlocks the **DISARM
diagnostics** — which TTPs the adversary used and the proportionate countermeasure you should
have selected. This is the app's deepest game and its collective-defense training.

### 03 // System 2 Pacer

Deliberate-slowing tools, six subtabs: a **4-7-8 breathing pacer**, a **15-second friction
interlock** (a pause between impulse and action), a **bias susceptibility audit**,
**epistemic reframing drills**, an **incident post-mortem debrief**, and a **debiasing journal
deck**. Use these when you feel the emotional pull the app keeps warning you about.

### 04 // VERDAD Engine

The real-time protection pillar. Paste or type a claim (or use 📋 Clipboard / drag-drop / a
`?verify=` deep link / the bookmarklet). VERDAD runs a five-step epistemic audit:

1. **Affect** — the emotional triggers (outrage, fear, urgency, tribalism, conspiracy,
   fatalism).
2. **Fallacies** — detected fallacies with quotes and explanations.
3. **Epistemics** — hedging ratio, certainty inflation, reading level.
4. **Sources** — domain extraction with inline credibility dossiers from the Source Directory.
5. **Synthesis** — a manipulation-risk score and a **share / caution / block** recommendation.

By default this is **offline heuristics** (private, no network). With your own **BYOK Gemini
key** it can add LLM analysis — but the LLM is *never* authoritative; the recommendation keys
off the measured manipulation risk, not the model's opinion. A published **fact-check**
citation path (Google Fact Check Tools) is available when configured.

### 05 // OSINT Suite

Four subtabs: a **Universal Query Console**, an **SVG relationship graph**, a **forensic pivot
timeline**, and an **epistemic dossier**. ⚠️ The query console currently renders *mock* pivots —
it is a **methodology walkthrough**, not a live tool. Treat it as training in how an analyst
pivots between sources; see `manual-improvement.md` for the plan to make it honest.

### 06 // ACH Matrix Lab

Analysis of Competing Hypotheses (Richards Heuer). List the possible explanations of a body of
evidence, score each piece of evidence for/against each hypothesis, and read the
**inconsistency** and **support** scores — which rank hypotheses by how well the *evidence*
fits them, not by which one you already believed. This is the antidote to confirmation bias,
made mechanical.

### 07 // Narrative Topology

A visualization of how a narrative moves through a network — from fringe seeder to botnet
amplifier to bridge influencer to mainstream outlet. ⚠️ The animation is currently *scripted*,
not a live diffusion simulation; read it as an illustration of the amplification pattern the
InfoWar Simulator's contagion engine models for real.

### 08 // Threat Radar

Early-warning playbooks (election integrity, biosecurity, financial markets, infrastructure,
autonomous-AI disinformation) with indicators and response protocols. Static, labelled
illustrative — not live telemetry.

### 09 // Source Directory

Dossiers on 60+ outlets and organizations: factuality, bias, credibility score. This is the
"who am I reading?" lookup that SIFT's "Investigate the source" move points to.

### 10 // Sovereign DID

Your self-sovereign identity, four subtabs: **Keypair & DID Profile** (view and export your
`did:key` and backup the practice log), **Cryptographic Statement Signer** (sign a claim),
**Independent Signature Verifier** (verify someone else's), and **W3C JSON-LD Credentials**
(issue/verify verifiable credentials). Signing a prebunk/rebuttal card here is how collective
defense gets cryptographic, not just rhetorical.

---

## 5. The confidence control and why it matters

Every right/wrong surface carries **sure / unsure / guess**. Two distinct numbers come out of it:

- **Mastery** uses *correctness only*. Confidence never moves it — so there is no way to game
  it by tapping "guess."
- **Calibration** uses *confidence vs. outcome*: a **Brier score**, a reliability curve, and
  the single most useful sentence the app can say — *"When you said you were sure, you were
  right N% of the time."*

A **confidently wrong** answer is treated as the highest-value signal in the system (a firmly
held false belief is precisely what the app exists to fix) and is surfaced first in review.

---

## 6. Reading the Command Center mirrors

- **Operator profile spiderchart** — five axes → Resilience Index. Tracks *activity and
  accuracy* across pillars.
- **Calibration panel** — only draws once you have enough confidence-rated answers (it refuses
  to draw a misleading curve from noise; thin bins are shown hollow and labelled "too few").
  Points **below the diagonal = overconfident**; the panel will name it.
- **Mastery** is per-skill and honest about sample size: few attempts = "unknown," not "bad."

---

## 7. Privacy, security, and your data

- **Local-first.** No accounts, no backend. State is mirrored to IndexedDB so it survives a
  `localStorage` wipe.
- **The attempt log is the sensitive part** — it is literally a record of what you are bad at.
  It never leaves the device except via your own explicit export. Export/import buttons live in
  **10 // Sovereign DID → Keypair & DID Profile** (⭳ Export Practice Log / ⭱ Import).
- **BYOK keys are memory-only** — never persisted to disk.
- **Hard Reset** names the practice history and clears it deliberately; there is no silent
  destruction.
- The app sets a strict **Content-Security-Policy**; injected scripts cannot execute.

---

## 8. Glossary

- **ACH** — Analysis of Competing Hypotheses (Heuer).
- **AP** — Action Points; the InfoWar Simulator's per-turn resource.
- **BYOK** — Bring Your Own Key; optional user-supplied Gemini API key.
- **C2PA** — Coalition for Content Provenance and Authenticity; the signed-media standard.
- **DID** — Decentralized Identifier (W3C); your `did:key` identity.
- **DISARM** — the open framework of disinformation tactics/techniques/procedures.
- **ELA / FFT / STFT** — error-level analysis, 2D Fourier transform, short-time Fourier
  transform; the forensic measurements.
- **FIMI** — foreign information manipulation and interference (EU term).
- **SIFT** — Stop, Investigate the source, Find better coverage, Trace claims (Caulfield).
- **SM-2** — the SuperMemo spaced-repetition algorithm behind the Memory Queue.
- **Steel-manning** — constructing the strongest charitable version of an opposing argument.

---

## 9. Troubleshooting

- **Fonts don't load (air-gapped/censored network)** — the app is designed to boot anyway; the
  webfonts are non-blocking and a local fallback stack holds the layout.
- **Clipboard analyze does nothing** — clipboard read needs a secure context and permission;
  paste instead (the app will offer).
- **The calibration panel is blank** — that is the refusal, not a bug: it needs ~12
  confidence-rated answers before it will draw.
- **`?verify=` deep links** work on the HTTP/HTTPS-served app; the single-file `file://` build
  may not follow a query string in every browser.
- **Forensics view is covered** — that's the predict-then-measure drill. Commit your prediction
  to reveal the measurement.
