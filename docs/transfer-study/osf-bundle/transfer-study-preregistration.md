# SOVEREIGN // AEGIS — Transfer Study Preregistration Protocol

**Version:** 1.0 · **Prepared:** 2026-08-21 · **Status:** ready to submit for independent review and preregistration

This protocol turns the transfer-study hook in [`manual-improvement.md`](manual-improvement.md) into a falsifiable, reproducible study plan. It is intentionally stricter than the application's local progress display. The app's built-in `transfer()` report is a useful within-device diagnostic; it is not, by itself, a controlled trial.

---

## 1. Research question and estimand

**Primary question:** Does structured practice with SOVEREIGN // AEGIS improve performance on information-verification items that participants have not practiced, relative to an active control condition?

**Primary estimand:** the between-group difference in change in held-out item accuracy from baseline to post-test:

\[
\tau = E[(P_{post} - P_{base})_{AEGIS}] - E[(P_{post} - P_{base})_{control}]
\]

where each `P` is a participant's proportion correct on a fixed, scored, held-out form. The estimand is reported in **percentage points**, with a two-sided 95% confidence interval. A positive value favours AEGIS.

This is a transfer claim, not a claim that the app proves a specific item false. Item ground truth must be established before enrollment and frozen with the study materials.

## 2. Design

A two-arm, parallel, randomized, active-controlled trial:

- **Arm A — AEGIS:** participants complete the prescribed practice route across SIFT, fallacy/bias discrimination, inoculation, DISARM, ACH, and media-forensics measurement-literacy drills.
- **Arm B — active control:** participants spend the same scheduled time reading neutral information-literacy material and answering comprehension questions, without AEGIS's technique-practice, confidence feedback, or held-out measurement loop.
- **Allocation:** 1:1, computer-generated randomization, stratified by study site or recruitment wave if more than one site is used. The allocation sequence is generated before the first participant and not changed after outcome data are inspected.
- **Blinding:** participants cannot be blinded to the interface. Outcome scoring and the analyst's arm labels are blinded until the primary model and cleaning rules are frozen.

The study has three scored sessions: baseline (`T0`), post-test (`T1`), and an optional four-week follow-up (`T2`). `T2` is secondary and does not affect the primary endpoint.

## 3. Participants and sample size

**Target enrollment:** 400 participants, 200 per arm. The primary analysis aims to retain at least 320 participants with valid baseline and post-test forms; attrition is reported, not silently replaced.

Eligibility: adults able to provide consent, able to read the study language, and without prior AEGIS participation. Exclude only before randomization for failed consent, duplicate enrollment, or inability to complete the baseline interface. After randomization, retain participants in the intention-to-treat set wherever a valid outcome exists. Do not exclude a participant for poor performance, low confidence, or non-completion of the preferred practice dose; those are outcomes or adherence variables.

The target is deliberately conservative: it is powered around a practically meaningful 15-point difference in change under a simple two-proportion approximation, while allowing for attrition and the fact that item difficulty and participant ability are clustered. Before recruitment, publish a simulation using the frozen item counts and a range of participant/item correlations. If that simulation says 400 is inadequate for 80% power at two-sided α=.05, increase enrollment **before** the first participant; do not lower the effect threshold after seeing results.

The primary report gives the observed estimate and CI regardless of whether the target effect is detected. A null or imprecise result is a valid result.

## 4. Materials and held-out construction

Freeze and hash three material bundles before enrollment:

1. **Practice bundle:** the items available to Arm A during training. These may include the app's existing scenarios, Fallacy Gauntlet, 60-Second Triage, forensics drills, and Memory Vault cards.
2. **Baseline transfer form (`T0`):** items not present in the practice bundle and not shown during onboarding. Each item has a stable item ID, domain/skill tags, answer key, rationale, and a difficulty/content review record.
3. **Post-test transfer form (`T1`):** a non-overlapping parallel form, also absent from practice. It must cover the same predeclared skill strata and response formats as `T0`. If parallel-form equivalence is uncertain, reviewers rate and document it before enrollment; no post-hoc item removal based on treatment differences is permitted.

The same item is never scored as both practice and held-out evidence. Form order, item order, and answer-option order are randomized using a predeclared seed policy. The randomization seed, item manifests, answer keys, and content hashes are archived with the preregistration.

Each scored decision records: participant pseudonym, session, stable item ID, skill/domain, correctness, response latency if collected, and confidence if the interface requests it. The exported `heldOut` flag is a data field, not an analyst's after-the-fact classification.

## 5. Procedure and dose

1. Consent, eligibility, and demographic minimums required by the ethics review.
2. `T0`: complete the held-out baseline form before any AEGIS practice. For each item, answer first, then state confidence using the app's three-level control (`sure`, `unsure`, `guess`) when available.
3. Randomize to Arm A or B.
4. Over 14 days, complete five sessions of 15–20 minutes. The AEGIS arm follows the same route for every participant; adaptive practice may choose among predeclared items but may not expose `T0`/`T1` items. The control arm receives matched contact time and session count.
5. `T1`: complete the new held-out form within 48 hours of the fifth session, before any post-test feedback or review.
6. `T2` (secondary): repeat a third, non-overlapping held-out form four weeks later without booster practice during the measurement window, if feasible.

The app may remain offline. At each scored session, the study operator exports the minimum research file using the study's pseudonymous participant code. No names, email addresses, DID documents, private keys, dossier prose, raw uploaded media, or free-text case notes enter the analysis dataset.

## 6. Outcomes

### Primary outcome

Participant mean accuracy on the held-out transfer form, and the difference-in-differences estimand `τ` above.

### Secondary outcomes, labelled exploratory

- Within-arm and between-arm change in confidence calibration, summarized by Brier score and reliability bins.
- Domain-stratified transfer for SIFT, cognitive discrimination, inoculation/DISARM, ACH, and media-forensics measurement literacy.
- Post-test and follow-up retention.
- Adherence: sessions completed and scored practice decisions, reported descriptively and not substituted for random assignment.

Do not call a confidence increase an accuracy gain. Do not use raw speed as a primary outcome; latency is descriptive unless a separate speed hypothesis is registered before enrollment.

## 7. Analysis and confidence intervals

### Primary point estimate

For participant `i`, calculate:

- `P_base(i)` = correct baseline transfer items / valid baseline transfer items;
- `P_post(i)` = correct post-test transfer items / valid post-test transfer items;
- `D(i) = P_post(i) - P_base(i)`.

Then calculate the unweighted participant means `mean(D)` in each arm and `τ = mean(D_AEGIS) - mean(D_control)`. Equal item counts are preferred. If a participant has fewer than half of the form's valid items, their form score is missing for that session; the threshold is fixed before seeing outcomes.

### Primary 95% CI — stratified participant bootstrap

Use a two-sided **percentile cluster bootstrap**, with participants as the resampling unit:

1. Within each arm, sample participants with replacement until that arm has its observed randomized sample size.
2. Keep all of each selected participant's item responses together; never resample individual items independently.
3. Recompute `D` and `τ*` for the resampled data.
4. Repeat exactly 10,000 times using a published pseudo-random seed.
5. The 95% CI is the 2.5th and 97.5th percentiles of the 10,000 `τ*` values.

This preserves within-participant dependence and avoids pretending that dozens of item responses are dozens of independent people. The primary result is written as `τ` percentage points, 95% CI `[L, U]`, with the participant counts and missingness shown.

As a sensitivity analysis, fit a prespecified item-level logistic mixed model with fixed effects for time, arm, arm×time, and predeclared skill strata; include participant and item random intercepts where the model converges. Report the model-derived marginal risk difference and its 95% CI from the same participant-level bootstrap. The mixed model is supportive, not a license to change the primary estimand.

### Secondary CIs

- For within-arm `T0 → T1` change, use the same participant-bootstrap procedure on `D(i)`.
- For domain estimates, use 10,000 participant-level bootstrap replicates and display them as exploratory; do not rank domains by overlapping/non-overlapping CIs.
- For a single form's raw proportion, use a two-sided 95% **Wilson score interval** for a binomial proportion. Do not use the normal/Wald interval at small `n`.
- If a paired binary-item analysis is reported, use Newcombe's score interval for the difference between paired proportions, based on the discordant pairs; state the number of concordant and discordant pairs.

The current app-level `transfer()` diagnostic uses a simple Wald interval over early versus late held-out records. That display remains a transparent local heuristic, but it must not be presented as the preregistered trial CI. The study analysis recomputes the raw export with the method above.

### Missing data and multiplicity

The primary result is intention-to-treat among randomized participants with a valid outcome. Report baseline-only participants and reasons for missing post-test data by arm. Do not impute the primary endpoint in the main analysis. As sensitivity analyses, provide worst/best plausible bounds and a multiple-imputation analysis only if its model and seed are declared before unblinding.

There is one confirmatory primary endpoint. Secondary outcomes are exploratory; label their CIs as such and do not use them to rescue a failed primary endpoint. Any deviation from this plan is listed with rationale and timestamp in the final report.

## 8. Integrity, privacy, and stopping rules

- Register this document, the item manifests, scoring code, randomization procedure, and hashes on OSF or an equivalent preregistration service before enrollment.
- Freeze the primary analysis script before opening arm labels. A reviewer should be able to regenerate the estimate and CIs from pseudonymous exports without network access.
- The study is not stopped for an attractive interim result. Stop only for participant-safety, ethics, or technical-integrity reasons defined by the approving review body; no efficacy look is performed unless a sequential design is separately registered.
- Publish the full CONSORT-style flow, exclusions, attrition, primary estimate, CI, and the exact caveat that this is evidence about this study population and material set — not proof that every AEGIS drill or every real-world claim transfers.

## 9. Preregistration checklist

- [ ] Protocol, hypotheses, analysis script, item manifests, and hashes timestamped before recruitment.
- [ ] Practice, `T0`, `T1`, and optional `T2` item IDs are disjoint.
- [ ] Ground truth and rationales independently reviewed and frozen.
- [ ] Randomization seed policy and active-control materials frozen.
- [ ] Enrollment target (400), retention target (320), and valid-form threshold recorded.
- [ ] Primary estimand and participant-bootstrap CI (10,000 replicates; 2.5th/97.5th percentiles) recorded.
- [ ] Wilson and paired-Newcombe secondary interval rules recorded.
- [ ] Missing-data and multiplicity rules recorded.
- [ ] Privacy review confirms that only pseudonymous, minimum necessary research fields leave the device.

## 10. Sources and rationale

- [OSF preregistration](https://osf.io/prereg/) — archive the protocol, materials, and analysis plan before data collection.
- [CONSORT](https://www.consort-statement.org/) — transparent reporting structure for randomized trials.
- Newcombe, R. G. (1998), *Improved confidence intervals for the difference between binomial proportions based on paired data*, [PubMed record](https://pubmed.ncbi.nlm.nih.gov/9839354/).
- The intervention rationale and transfer claim are discussed in [`report-landscape.md`](report-landscape.md) and [`playbook-games.md`](playbook-games.md).
