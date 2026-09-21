# SOVEREIGN // AEGIS — Research, Manual & Game-Design Library

This folder is the research and documentation layer for **SOVEREIGN // AEGIS**, an
offline-first, browser-native intelligence and cognitive-defense training suite. It was
produced from a full survey of the codebase plus an external web-research pass over the
communities, projects, and bodies of knowledge the app draws on.

The documents are written to be read independently, but they cross-reference each other
heavily. Suggested reading order:

| # | Document | What it is for |
|---|----------|----------------|
| 1 | [`report-landscape.md`](report-landscape.md) | The enriched research report: who feels the way this app feels, which projects share its ideas, and what the current best knowledge is for every subject the app teaches. |
| 2 | [`manual-user.md`](manual-user.md) | The operator manual: how to use every view, lab, and game, and what each one actually trains. |
| 3 | [`manual-improvement.md`](manual-improvement.md) | The improvement guide: an honest state-of-the-app assessment and a prioritized, research-backed set of recommendations mapped to `ROADMAP.md` and `ROADMAP-EVIDENCE.md`. |
| 4 | [`playbook-games.md`](playbook-games.md) | The game-development playbook: why inoculation and serious games work, how to make each existing game better, and new game concepts per subject. |
| 5 | [`sources.md`](sources.md) | Consolidated citations, grouped by subject, with the date each was retrieved. |
| 6 | [`outreach-positioning.md`](outreach-positioning.md) | One-page positioning and outreach brief for the inoculation and DISARM research communities. |
| 7 | [`outreach-osint-forensics.md`](outreach-osint-forensics.md) | Sibling one-pager for OSINT investigators, newsroom verification teams, and media-forensics practitioners. |
| 8 | [`transfer-study-preregistration.md`](transfer-study-preregistration.md) | Preregistration-ready randomized transfer protocol, including the exact confidence-interval methods. |
| 9 | [`misp-case-pack.md`](misp-case-pack.md) | Privacy-preserving MISP core JSON profile for DISARM-tagged AEGIS analyses and InfoWar AARs. |
| 10 | [`guides/mbti-comparison-lens.md`](guides/mbti-comparison-lens.md) · [`guides/enneagram-comparison-lens.md`](guides/enneagram-comparison-lens.md) · [`guides/dark-triad-behavior-recognition.md`](guides/dark-triad-behavior-recognition.md) | Reference guides from `DESIGN-personal-defense-profile.md`: the 16 MBTI and 9 Enneagram types as explicitly labeled comparison lenses (`popular-weak` tier), and a Dark Triad behavior-recognition guide (observable exploitative patterns, boundaries, documentation, support paths — trait names used for zero person-level labeling). Self-profiling only; never a tool for assessing another person. |

## How to use this library

- **New to the app?** Start with `manual-user.md`. It walks the Four Pillars and every
  view in navigation order.
- **Want to know who else is doing this work?** Start with Part 2 and Part 3 of
  `report-landscape.md` — the community and project maps.
- **Planning the next milestone?** Start with `manual-improvement.md`. Its recommendations
  are ordered by the same logic the roadmap uses: irreversibility first, then dependency,
  then felt value.
- **Making the games better?** `playbook-games.md` is the whole answer.
- **Planning a credible evaluation?** Start with `transfer-study-preregistration.md`; it separates the app's local diagnostic from a controlled study result.
- **Wondering what your "personality type" has to do with manipulation?** Read the two
  `guides/` lenses *after* the three rules at their top: they are self-reflection vocabularies,
  not validated predictors, and the dimensional evidence layer comes first.
- **Sharing an AAR with analysts?** Read `misp-case-pack.md` before exporting; it keeps training data, private identity, and unverified claims out of the MISP event by default.

## A note on tone and truth

The app holds itself to an "honest-by-construction" standard: measurements are shown with
their limitations, and verdicts are not invented where evidence is absent. These documents
adopt the same discipline. Where a recommendation is proven by peer-reviewed or
large-sample evidence, it is labelled as such; where it is a design judgement or a bet, it
is labelled as a judgement. Every external claim carries a source in `sources.md`.

## Scope

This library describes and improves the app. It does **not** modify code, introduce
dependencies, or change the zero-build, offline-first property of the product. Any change
suggested here still has to pass the existing verification gates before it ships.
