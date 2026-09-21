# SOVEREIGN // AEGIS — Positioning & Community Outreach

**Audience:** OSINT investigators, open-source researchers, newsroom verification teams, media-forensics practitioners, and content-authenticity engineers.  **Prepared:** 2026-08-21.

---

## One line

SOVEREIGN // AEGIS is a local-first practice instrument for the judgment that sits *before* an OSINT finding: preserve the source, inspect the signal, trace the claim, and state exactly what the evidence does — and does not — establish.

## What it is

AEGIS combines a SIFT/lateral-reading lab, an OSINT methodology walkthrough, a media-forensics studio, C2PA manifest parsing, a predict-then-measure drill, an ACH matrix, and a DISARM-mapped network-defense simulation. It runs as a static browser application or single file: no account, backend, or telemetry is required, and a learner's attempt history stays on-device.

It is not a replacement for Bellingcat's toolkit, InVID/WeVerify, a newsroom verification desk, or a C2PA validator. It is the training layer that makes the analyst's *next* action more deliberate.

## Why practitioners should care

- **It trains workflow, not tool worship.** SIFT's Stop / Investigate / Find better coverage / Trace moves are practiced as decisions. The OSINT surface points toward real tools and caveats instead of pretending a mock query is a live lookup.
- **It makes measurement literacy a skill.** ELA, 2-D FFT, high-pass residuals, spectrograms, and temporal indicators are computed in-browser where possible. A prediction is recorded before the result appears; the learner must then answer what the result establishes. This targets the common failure of turning an interesting artefact into a verdict.
- **It treats provenance as evidence, not a blessing.** The C2PA reader parses a manifest and explicitly reports that parsing is not cryptographic verification. For a consequential decision, the interface links to the external Content Credentials verifier. Absence of a manifest is not treated as evidence of tampering.
- **It has a shared measurement spine.** Attempts are tagged to skills, chosen distractors can expose recurring category errors, and held-out probes separate familiarity with a training item from transfer to unseen material. Confidence is used for calibration, never to inflate mastery.
- **It is safe to use with sensitive practice.** The default export boundary is local. A practitioner can train on a case without silently uploading the case, their uncertainty, or their weaknesses to a service.

## The honest claim

AEGIS does not claim to identify a deepfake from one filter, authenticate a source from a blue check, or establish attribution from a network pattern. Its strongest claim is narrower: it can provide repeatable practice in evidence handling and record the learner's decisions. Whether that practice improves performance on held-out material is an empirical question; the proposed study protocol is [`transfer-study-preregistration.md`](transfer-study-preregistration.md).

That ceiling is deliberate. Bellingcat's [Online Investigation Toolkit](https://bellingcat.gitbook.io/toolkit) itself warns that inclusion does not equal endorsement and that listed tools can carry significant caveats. The C2PA community likewise frames Content Credentials as a way to expose provenance, not as a universal authenticity oracle ([C2PA](https://c2pa.org/), [Content Credentials](https://contentcredentials.org/)). AEGIS adopts the same posture and makes it playable.

## Ways to engage

1. **Audit a drill.** Ask whether the displayed measurement, ground truth, and explanation support one another; report where a learner could still over-read a signal.
2. **Contribute a case or workflow.** Add a source-preserving OSINT scenario, a media-forensics contrast pair, or a provenance chain with an explicit limitation. Keep claims and assets licensed for redistribution.
3. **Run the transfer protocol.** Use fixed, held-out forms and the pre-registered confidence interval method rather than treating an in-app progress number as causal evidence.
4. **Test interoperability.** Export a DISARM-tagged AAR through the [`misp-case-pack.md`](misp-case-pack.md) profile and tell us where a real analyst's MISP instance needs a stricter mapping.

**The ask:** a red-team review from someone who has had to defend an OSINT conclusion under scrutiny. We want the app to make analysts slower at the right moment, faster at the routine parts, and more precise about the boundary between a lead and a finding.

*Related: [`report-landscape.md`](report-landscape.md) · [`manual-improvement.md`](manual-improvement.md) · [`sources.md`](sources.md)*
