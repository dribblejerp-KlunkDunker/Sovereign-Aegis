/**
 * SOVEREIGN // AEGIS — P1 item batch
 *
 * Hand-authored practice items for the ten skills that were resting on two items or fewer.
 * An estimate built on one question is not an estimate, and `confidence = n/(n+5)` correctly
 * reported those skills as near-worthless no matter how much the operator practised.
 *
 * THE THREE RULES THESE ITEMS ARE WRITTEN TO
 * -----------------------------------------
 * 1. DISTRACTORS ARE PLAUSIBLE NEIGHBOURS. Genetic fallacy vs circumstantial ad hominem vs
 *    poisoning the well. An item with three obviously-wrong options measures recognition, not
 *    discrimination, and inflates mastery without teaching anything.
 * 2. NO STRUCTURAL TELL. If every ad hominem item mentions a divorce, the operator learns the
 *    template and the curve rises while nothing is learned. Domains, sentence shapes, whether a
 *    person is named, and the position of the correct answer all vary deliberately.
 * 3. THE EXPLANATION SAYS WHAT IT ISN'T. Naming the fallacy teaches a label; contrasting it with
 *    the option the operator probably chose teaches the distinction.
 *
 * `skills` here is the single source of truth: tools/merge-p1.mjs writes the questions AND
 * regenerates the answer→skill map from this array, so the two cannot drift.
 */

export const ITEMS = [
  /* ---------------------------------------------------- fallacy.relevance */
  {
    domain: 'Logical Fallacy', difficulty: 1120,
    claim: '"The transport committee proposed a 15 km/h speed reduction outside primary schools. So they think cars are evil and want us all walking to work in the rain."',
    options: ['Straw Man', 'Slippery Slope', 'False Dilemma', 'Hasty Generalisation'],
    correct: 'Straw Man',
    explanation: 'The actual proposal — a limited speed change near schools — is replaced by an absurd one that is easier to attack. This is not a slippery slope: no chain of consequences is claimed, the position itself has been swapped out.',
    skills: ['skill.fallacy.relevance']
  },
  {
    domain: 'Logical Fallacy', difficulty: 1340,
    claim: '"That statistical method was developed by a mathematician who later joined a eugenics society, so any result produced with it is tainted."',
    options: ['Genetic Fallacy', 'Ad Hominem (Circumstantial)', 'Poisoning the Well', 'Guilt by Association'],
    correct: 'Genetic Fallacy',
    explanation: 'The objection is to the ORIGIN of the method, not to a person currently making an argument — that is what separates it from ad hominem. A technique\'s validity does not inherit its inventor\'s politics; that has to be shown mathematically.',
    skills: ['skill.fallacy.relevance']
  },
  {
    domain: 'Logical Fallacy', difficulty: 1260,
    claim: 'Asked whether the audit found missing funds, the director replies: "What I will say is that this department has served this city for ninety years and our staff work incredibly hard."',
    options: ['Red Herring', 'Straw Man', 'Appeal to Emotion', 'Begging the Question'],
    correct: 'Red Herring',
    explanation: 'The reply is true, warm, and about something else — the audit question is never engaged. It is not an appeal to emotion in the strict sense: no feeling is offered as EVIDENCE, the subject is simply changed.',
    skills: ['skill.fallacy.relevance']
  },

  /* -------------------------------------------------------- fallacy.scope */
  {
    domain: 'Logical Fallacy', difficulty: 1180,
    claim: '"Both people I know who took that job quit within a year. It is clearly a terrible employer."',
    options: ['Hasty Generalisation', 'Anecdotal Evidence', 'Fallacy of Composition', 'Post Hoc Ergo Propter Hoc'],
    correct: 'Hasty Generalisation',
    explanation: 'A sample of two is generalised to an employer of unknown size. Anecdotal evidence is the close neighbour and would be the better answer if the anecdote were being used AGAINST statistics; here there are no statistics in play, only an over-broad leap.',
    skills: ['skill.fallacy.scope']
  },
  {
    domain: 'Logical Fallacy', difficulty: 1480,
    claim: 'An analyst reviews forty indicators, reports the three that moved together before the crash, and presents them as an early-warning signature.',
    options: ['Texas Sharpshooter', 'Cherry Picking', 'Post Hoc Ergo Propter Hoc', 'Survivorship Bias'],
    correct: 'Texas Sharpshooter',
    explanation: 'The pattern is drawn AFTER the data is seen — the target painted around the bullet holes. Cherry picking is the nearest miss: that would be selecting favourable data from a pre-existing claim, whereas here the claim itself is constructed from whichever indicators happened to align.',
    skills: ['skill.fallacy.scope']
  },

  /* ------------------------------------------------------ fallacy.appeals */
  {
    domain: 'Logical Fallacy', difficulty: 1210,
    claim: '"A Nobel laureate in chemistry has said the new monetary policy will cause hyperinflation, so the case is settled."',
    options: ['Appeal to False Authority', 'Appeal to Popularity', 'Ad Hominem', 'Appeal to Tradition'],
    correct: 'Appeal to False Authority',
    explanation: 'The credential is real but belongs to a different field. This is the harder version of the fallacy — the easy version cites someone with no expertise at all, while genuine authority misapplied is far more persuasive and far more common.',
    skills: ['skill.fallacy.appeals']
  },
  {
    domain: 'Logical Fallacy', difficulty: 1150,
    claim: '"This procedure has been standard practice in the guild for two hundred years. That is reason enough to keep it."',
    options: ['Appeal to Tradition', 'Appeal to Authority', 'Appeal to Popularity', 'Begging the Question'],
    correct: 'Appeal to Tradition',
    explanation: 'Age is offered in place of evidence of effectiveness. Note that longevity is weak evidence rather than none — a practice that survived two centuries of use may work — but "it is old" is not the same claim as "it works", and only the second is being defended.',
    skills: ['skill.fallacy.appeals']
  },
  {
    domain: 'Logical Fallacy', difficulty: 1290,
    claim: '"The compound is plant-derived and completely natural, so it cannot be harmful in the doses we sell."',
    options: ['Appeal to Nature', 'Appeal to Ignorance', 'False Dilemma', 'Equivocation'],
    correct: 'Appeal to Nature',
    explanation: 'Natural origin is treated as evidence of safety. Hemlock, asbestos and botulinum toxin are all natural; the property that matters is dose-response, which the claim quietly skips.',
    skills: ['skill.fallacy.appeals']
  },
  {
    domain: 'Logical Fallacy', difficulty: 1420,
    claim: '"No study has ever demonstrated that the additive is unsafe at these levels. Therefore it is safe."',
    options: ['Appeal to Ignorance', 'Appeal to False Authority', 'Shifting the Burden of Proof', 'Hasty Generalisation'],
    correct: 'Appeal to Ignorance',
    explanation: 'Absence of evidence of harm is converted into evidence of safety. Shifting the burden of proof is the near neighbour and is often bundled with it, but here nobody is being asked to disprove anything — the gap in the literature is itself being treated as a finding.',
    skills: ['skill.fallacy.appeals']
  },
  {
    domain: 'Logical Fallacy', difficulty: 1170,
    claim: '"Four million subscribers cannot be wrong about this trading strategy."',
    options: ['Argumentum ad Populum (Bandwagon)', 'Appeal to False Authority', 'Astroturfing', 'Availability Heuristic'],
    correct: 'Argumentum ad Populum (Bandwagon)',
    explanation: 'Headcount is offered as proof. Astroturfing is the distractor worth pausing on: that would require the crowd to be MANUFACTURED, and nothing here suggests the subscribers are inauthentic — only that their number is irrelevant to whether the strategy works.',
    skills: ['skill.fallacy.appeals']
  },
  {
    domain: 'Logical Fallacy', difficulty: 1380,
    claim: '"If this ordinance passes, ask yourself who will protect your children when the response times slip. Can you live with that?"',
    options: ['Appeal to Fear', 'Slippery Slope', 'False Dilemma', 'Loaded / Emotive Language'],
    correct: 'Appeal to Fear',
    explanation: 'A frightening consequence is asserted, not evidenced, and the question invites you to decide from dread. A slippery slope would need a CHAIN of steps to the bad outcome; this jumps straight to it, which is what makes fear the mechanism rather than the inference.',
    skills: ['skill.fallacy.appeals', 'skill.tactic.emotive-framing']
  },

  /* -------------------------------------------- fallacy.formal-vs-informal */
  {
    domain: 'Logical Fallacy', difficulty: 1450,
    claim: '"If the server were compromised, outbound traffic would spike. Outbound traffic has spiked. So the server is compromised."',
    options: ['Affirming the Consequent (Formal Fallacy)', 'Post Hoc Ergo Propter Hoc', 'Hasty Generalisation', 'Circular Reasoning'],
    correct: 'Affirming the Consequent (Formal Fallacy)',
    explanation: 'The argument fails by its FORM: many other causes produce a traffic spike. Post hoc is the tempting alternative, but nothing here rests on the order of events — even if the spike came first, the inference would still be invalid.',
    skills: ['skill.fallacy.formal-vs-informal', 'skill.fallacy.structure']
  },
  {
    domain: 'Logical Fallacy', difficulty: 1470,
    claim: '"If the account were a bot, it would post at machine-regular intervals. It does not post at regular intervals. So it is not a bot."',
    options: ['Denying the Antecedent (Formal Fallacy)', 'Affirming the Consequent (Formal Fallacy)', 'Appeal to Ignorance', 'False Dilemma'],
    correct: 'Denying the Antecedent (Formal Fallacy)',
    explanation: 'Ruling out one signature does not rule out the category — modern automation deliberately jitters its timing. Distinguish it from affirming the consequent by which half is negated: here the IF-part is denied, there the THEN-part is affirmed.',
    skills: ['skill.fallacy.formal-vs-informal', 'skill.fallacy.structure']
  },
  {
    domain: 'Logical Fallacy', difficulty: 1560,
    claim: '"Every state-run outlet amplified the story. This outlet amplified the story. Therefore this outlet is state-run."',
    options: ['Undistributed Middle (Formal Fallacy)', 'Affirming the Consequent (Formal Fallacy)', 'Guilt by Association', 'Hasty Generalisation'],
    correct: 'Undistributed Middle (Formal Fallacy)',
    explanation: 'Sharing one property does not establish membership — plenty of independent outlets amplified it too. It is a syllogistic form error, close to affirming the consequent but stated over categories rather than conditionals.',
    skills: ['skill.fallacy.formal-vs-informal', 'skill.fallacy.structure']
  },
  {
    domain: 'Logical Fallacy', difficulty: 1520,
    claim: '"Either the footage is authentic or the timestamp was altered. The timestamp was altered. So the footage is not authentic."',
    options: ['Affirming a Disjunct (Formal Fallacy)', 'False Dilemma (Bifurcation)', 'Denying the Antecedent (Formal Fallacy)', 'Equivocation (Semantic Shift)'],
    correct: 'Affirming a Disjunct (Formal Fallacy)',
    explanation: 'An inclusive "or" permits both to be true: real footage can carry a doctored timestamp. False dilemma is the close cousin — that would be an objection to the two options being the ONLY ones, whereas the error here is in what follows once one is affirmed.',
    skills: ['skill.fallacy.formal-vs-informal', 'skill.fallacy.structure']
  },
  {
    domain: 'Logical Fallacy', difficulty: 1600,
    claim: '"All verified accounts have a badge. This account has a badge. So it is verified." — the arguer insists the reasoning is fine because the conclusion happens to be true.',
    options: ['The form is invalid even though the conclusion is true', 'The argument is sound because the conclusion is true', 'The premises are false, which is the real problem', 'It is an informal fallacy of relevance'],
    correct: 'The form is invalid even though the conclusion is true',
    explanation: 'This is the point of the formal/informal distinction: validity is a property of STRUCTURE, not of outcome. A true conclusion reached by an invalid route gives you no reason to trust the route next time — which is exactly when it will mislead you.',
    skills: ['skill.fallacy.formal-vs-informal']
  },
  {
    domain: 'Logical Fallacy', difficulty: 1500,
    claim: 'A screening test flags 1 in 20 healthy people. A colleague reasons: "It flagged you, and it only flags 5% of healthy people, so there is a 95% chance you are ill."',
    options: ['Base-Rate Neglect dressed as a formal inference', 'Affirming the Consequent (Formal Fallacy)', 'Conjunction Fallacy', 'Appeal to False Authority'],
    correct: 'Base-Rate Neglect dressed as a formal inference',
    explanation: 'The false-positive RATE has been silently swapped for the probability of illness given a positive result. It looks like a formal move but the defect is in the content: without the prevalence of the disease, the conclusion cannot be computed at all.',
    skills: ['skill.fallacy.formal-vs-informal', 'skill.bias.probability']
  },
  {
    domain: 'Logical Fallacy', difficulty: 1400,
    claim: '"His argument commits a fallacy, so his conclusion is false."',
    options: ['Fallacy Fallacy (Argument from Fallacy)', 'Ad Hominem', 'Circular Reasoning', 'Appeal to Ignorance'],
    correct: 'Fallacy Fallacy (Argument from Fallacy)',
    explanation: 'A bad argument for a claim leaves the claim exactly where it was — unsupported, not refuted. This is the failure mode a fallacy taxonomy itself invites, which is why it belongs in one.',
    skills: ['skill.fallacy.formal-vs-informal']
  },
/* ----------------------------------------------------- bias.confirmation */
  {
    domain: 'Cognitive Bias', difficulty: 1230,
    claim: 'An investigator convinced the fire was arson spends the afternoon interviewing neighbours who reported seeing someone near the building, and never contacts the electrician who serviced the panel that week.',
    options: ['Confirmation Bias', 'Availability Heuristic', 'Anchoring Effect', 'Fundamental Attribution Error'],
    correct: 'Confirmation Bias',
    explanation: 'The search itself is shaped by the hypothesis — disconfirming evidence is not rejected, it is never gathered. That selective-search step is what separates it from the availability heuristic, where evidence comes to mind unbidden rather than being sought out.',
    skills: ['skill.bias.confirmation']
  },
  {
    domain: 'Cognitive Bias', difficulty: 1390,
    claim: 'Two readers are shown the same ambiguous polling table. Each reports that it supports the candidate they already preferred, and each can point to a column that does.',
    options: ['Biased Assimilation', 'Confirmation Bias', 'Anchoring Effect', 'False Balance (Bothsidesism)'],
    correct: 'Biased Assimilation',
    explanation: 'Both readers see all the data, so the bias is in INTERPRETATION rather than in what was collected — which predicts that shared evidence drives people apart rather than together. Plain confirmation bias is the broader family; this is the specific mechanism operating here.',
    skills: ['skill.bias.confirmation']
  },
  {
    domain: 'Cognitive Bias', difficulty: 1310,
    claim: 'A trader keeps a journal of every prediction that came true and remembers the losing calls as "the market being irrational that week".',
    options: ['Selective Recall', 'Hindsight Bias', 'Sunk Cost Fallacy', 'Survivorship Bias'],
    correct: 'Selective Recall',
    explanation: 'The record and the memory are curated after the fact. Hindsight bias is the neighbour — that would be misremembering how confident he WAS beforehand, whereas here the question is which events he retains at all.',
    skills: ['skill.bias.confirmation']
  },
  {
    domain: 'Cognitive Bias', difficulty: 1440,
    claim: 'Asked to discover the rule behind the sequence 2-4-6, a participant proposes 8-10-12, then 20-22-24, then 100-102-104, and concludes the rule is "add two".',
    options: ['Positive Test Strategy', 'Hasty Generalisation', 'Anchoring Effect', 'Conjunction Fallacy'],
    correct: 'Positive Test Strategy',
    explanation: 'Every probe is one the hypothesis predicts will succeed, so none could have falsified it. Hasty generalisation concerns too little evidence; the defect here is that no quantity of this KIND of evidence would help — the participant never tried 1-2-3.',
    skills: ['skill.bias.confirmation']
  },
  {
    domain: 'Cognitive Bias', difficulty: 1350,
    claim: 'A team reviewing a failed launch reads the pre-launch risk memo and finds that it "obviously flagged the problem", though at the time nobody acted on it.',
    options: ['Hindsight Bias', 'Confirmation Bias', 'Selective Recall', 'Fundamental Attribution Error / Ingroup Favoritism'],
    correct: 'Hindsight Bias',
    explanation: 'Knowing the outcome makes the warning legible in a way it was not beforehand. This is why post-incident reviews asking "who missed this" produce worse findings than ones asking "what was visible at the time".',
    skills: ['skill.bias.probability']
  },
  {
    domain: 'Cognitive Bias', difficulty: 1490,
    claim: 'A researcher pre-registers a hypothesis, collects the data, finds nothing, then reports a subgroup where the effect appears and describes it as the analysis she had planned.',
    options: ['HARKing (Hypothesising After Results are Known)', 'Texas Sharpshooter', 'Selective Recall', 'Confirmation Bias'],
    correct: 'HARKing (Hypothesising After Results are Known)',
    explanation: 'The move is presenting a post-hoc hypothesis as a pre-hoc one, which destroys the statistical guarantee the pre-registration existed to provide. Texas sharpshooter names the same shape informally; HARKing is what it is called inside a research protocol.',
    skills: ['skill.bias.confirmation']
  },

  /* ------------------------------------------------------ bias.availability */
  {
    domain: 'Cognitive Bias', difficulty: 1200,
    claim: 'After a week of coverage of a shark attack, beach visitors rate swimming as more dangerous than the drive to the coast.',
    options: ['Availability Heuristic', 'Anchoring Effect', 'Confirmation Bias', 'Base-Rate Neglect'],
    correct: 'Availability Heuristic',
    explanation: 'Ease of recall stands in for frequency, and coverage drives recall. Base-rate neglect is arguably also present, but the ENGINE is vividness and repetition — which is precisely what makes this exploitable by whoever controls the volume.',
    skills: ['skill.bias.availability']
  },
  {
    domain: 'Cognitive Bias', difficulty: 1330,
    claim: 'Asked whether more English words begin with R or have R as their third letter, most people answer "begin with R". The opposite is true.',
    options: ['Availability Heuristic', 'Anchoring Effect', 'Conjunction Fallacy', 'Confirmation Bias'],
    correct: 'Availability Heuristic',
    explanation: 'Words are indexed in memory by first letter, so first-letter examples are retrievable and third-letter ones are not. The judgement tracks the accessibility of examples rather than their number — a clean case, since no emotion or media coverage is involved.',
    skills: ['skill.bias.availability']
  },
  {
    domain: 'Cognitive Bias', difficulty: 1410,
    claim: 'A security team fresh from reviewing a phishing breach puts most of next quarter into email filtering, while an unpatched external service goes unfunded.',
    options: ['Availability Cascade', 'Confirmation Bias', 'Sunk Cost Fallacy', 'Anchoring Effect'],
    correct: 'Availability Cascade',
    explanation: 'The most recent and most discussed threat crowds out the assessed one. It is not sunk cost — no prior investment is being defended; the distortion is that recency has been mistaken for risk.',
    skills: ['skill.bias.availability']
  },
  {
    domain: 'Cognitive Bias', difficulty: 1270,
    claim: 'A local paper runs six stories in a month about assaults in one park. Reported crime there does not change, but residents petition to close it.',
    options: ['Availability Heuristic', 'Astroturfing', 'Hasty Generalisation', 'Loaded / Emotive Language'],
    correct: 'Availability Heuristic',
    explanation: 'The frequency of COVERAGE changed, not the frequency of events, and the two are being read as one signal. Note that this requires no bad actor at all — ordinary editorial choices produce it.',
    skills: ['skill.bias.availability']
  },
  {
    domain: 'Cognitive Bias', difficulty: 1360,
    claim: 'A drug described as having "90% survival" is accepted far more readily than the same drug described as having "10% mortality".',
    options: ['Framing Effect', 'Availability Heuristic', 'Anchoring Effect', 'Equivocation (Semantic Shift)'],
    correct: 'Framing Effect',
    explanation: 'The numbers are identical, so nothing about the evidence changed — only which outcome the wording makes easy to picture. It sits beside availability rather than inside it: availability concerns what comes to mind, framing what the phrasing puts there.',
    skills: ['skill.bias.availability', 'skill.tactic.emotive-framing']
  },
  {
    domain: 'Cognitive Bias', difficulty: 1460,
    claim: 'An executive says air travel has become far more dangerous, citing three crashes she can name from the past year — none of which she could have named a year ago.',
    options: ['Availability Heuristic', 'Hasty Generalisation', 'Confirmation Bias', 'Survivorship Bias'],
    correct: 'Availability Heuristic',
    explanation: 'That she can now name them is the whole of the evidence, and namability grew because coverage did. Hasty generalisation tempts, but the flaw is not sample SIZE — it is that the sample is drawn from memory, which is not a random sampler.',
    skills: ['skill.bias.availability']
  },
/* --------------------------------------------------------- bias.anchoring */
  {
    domain: 'Cognitive Bias', difficulty: 1190,
    claim: 'A negotiator opens with a figure far above any plausible settlement. The final agreement lands well above what either side privately expected.',
    options: ['Anchoring Effect', 'Framing Effect', 'Sunk Cost Fallacy', 'Appeal to Authority'],
    correct: 'Anchoring Effect',
    explanation: 'The opening number does not need to be credible to work; it only needs to be first. Framing is the neighbour — that would require the same value described differently, whereas here a single irrelevant number drags the whole scale.',
    skills: ['skill.bias.anchoring']
  },
  {
    domain: 'Cognitive Bias', difficulty: 1300,
    claim: 'Asked "was the population above or below 20 million?" and then to estimate it, respondents guess far higher than a group asked "above or below 2 million?" first.',
    options: ['Anchoring Effect', 'Availability Heuristic', 'Confirmation Bias', 'Conjunction Fallacy'],
    correct: 'Anchoring Effect',
    explanation: 'The comparison figure carries no information about the answer, yet it sets the range people adjust within — and adjustment is reliably insufficient. This is the cleanest demonstration precisely because the anchor is transparently arbitrary.',
    skills: ['skill.bias.anchoring']
  },
  {
    domain: 'Cognitive Bias', difficulty: 1420,
    claim: 'A headline reads "Department seeks $4bn — critics say $3.2bn is enough". Later coverage debates the gap. The prior year\'s budget was $900m.',
    options: ['Anchoring Effect', 'False Balance (Bothsidesism)', 'Loaded / Emotive Language', 'Availability Heuristic'],
    correct: 'Anchoring Effect',
    explanation: 'Both published figures sit far above the historical baseline, so the "sceptical" number still anchors the debate high. False balance is a real distractor here, but the two positions are not being presented as equally supported — the distortion is in the numeric range they jointly establish.',
    skills: ['skill.bias.anchoring']
  },
  {
    domain: 'Cognitive Bias', difficulty: 1250,
    claim: 'A menu lists a $180 tasting option at the top. Sales of the $95 option rise sharply, although it did not change.',
    options: ['Anchoring Effect', 'Framing Effect', 'Argumentum ad Populum (Bandwagon)', 'Appeal to Nature'],
    correct: 'Anchoring Effect',
    explanation: 'The expensive item may sell rarely and still earn its place by re-scaling every other price. Nothing about the $95 dish changed — only the reference point it is judged against.',
    skills: ['skill.bias.anchoring']
  },
  {
    domain: 'Cognitive Bias', difficulty: 1470,
    claim: 'An analyst\'s first estimate of a breach at 40,000 records is later shown to be far too low, but every subsequent revision lands between 45,000 and 60,000. The eventual figure is 2.1 million.',
    options: ['Insufficient Adjustment from an anchor', 'Confirmation Bias', 'Availability Heuristic', 'Hindsight Bias'],
    correct: 'Insufficient Adjustment from an anchor',
    explanation: 'Revisions crawl away from the initial figure instead of being re-derived from scratch. Confirmation bias is close, but the analyst is not defending a conclusion — she is updating, just far too slowly and always from the same starting point.',
    skills: ['skill.bias.anchoring']
  },
  {
    domain: 'Cognitive Bias', difficulty: 1380,
    claim: 'A survey asks "how much would you pay to avoid this outcome, given others paid around $50?" before recording the respondent\'s own figure.',
    options: ['Anchoring Effect', 'Argumentum ad Populum (Bandwagon)', 'Framing Effect', 'Astroturfing'],
    correct: 'Anchoring Effect',
    explanation: 'The reference is doing two jobs — social proof and numeric anchor — but the measurable distortion is the numeric one, which appears even when respondents are told the figure was randomly generated. Bandwagon would require the crowd itself to be the reason offered.',
    skills: ['skill.bias.anchoring']
  },

  /* ------------------------------------------------------- bias.attribution */
  {
    domain: 'Cognitive Bias', difficulty: 1220,
    claim: 'A driver cut off in traffic mutters "what a selfish idiot". When he does the same thing an hour later, it is because he is late for a hospital appointment.',
    options: ['Fundamental Attribution Error / Ingroup Favoritism', 'Confirmation Bias', 'Hindsight Bias', 'Availability Heuristic'],
    correct: 'Fundamental Attribution Error / Ingroup Favoritism',
    explanation: 'Others\' behaviour is explained by character, one\'s own by circumstance. The asymmetry is the diagnostic feature — either explanation alone could be reasonable; holding both at once is not.',
    skills: ['skill.bias.attribution']
  },
  {
    domain: 'Cognitive Bias', difficulty: 1340,
    claim: 'When our side\'s official misstates a figure it is "a briefing error under pressure". When theirs does, it is "a deliberate attempt to mislead the public".',
    options: ['Ingroup Attribution Asymmetry', 'Fundamental Attribution Error / Ingroup Favoritism', 'Loaded / Emotive Language', 'Whataboutism (Tu Quoque)'],
    correct: 'Ingroup Attribution Asymmetry',
    explanation: 'The same act receives a situational reading for the in-group and a dispositional one for the out-group. The general attribution error is the parent category; naming the in-group/out-group split matters because it is what makes the bias politically load-bearing.',
    skills: ['skill.bias.attribution']
  },
  {
    domain: 'Cognitive Bias', difficulty: 1450,
    claim: 'A manager reads a team\'s missed deadline as a motivation problem, without checking that the upstream dependency shipped three weeks late.',
    options: ['Fundamental Attribution Error / Ingroup Favoritism', 'Confirmation Bias', 'Base-Rate Neglect', 'Hindsight Bias'],
    correct: 'Fundamental Attribution Error / Ingroup Favoritism',
    explanation: 'Dispositional explanation is reached for first, and the situational one is never tested. Confirmation bias would require a prior hypothesis being defended; here the leap to character happens before any hypothesis exists.',
    skills: ['skill.bias.attribution']
  },
  {
    domain: 'Cognitive Bias', difficulty: 1290,
    claim: 'A profile explains a founder\'s success entirely through her discipline and vision, mentioning in passing that the family funded the first two years.',
    options: ['Dispositional Over-Attribution', 'Survivorship Bias', 'Availability Heuristic', 'Appeal to Authority'],
    correct: 'Dispositional Over-Attribution',
    explanation: 'Traits are credited with an outcome that had substantial situational support. Survivorship bias is the tempting alternative and would apply to a claim about founders in general; this is about the causal account of one case.',
    skills: ['skill.bias.attribution']
  },
  {
    domain: 'Cognitive Bias', difficulty: 1510,
    claim: 'A commentator argues that because a hostile state benefits from a protest movement, the protesters must be acting on its instructions.',
    options: ['Cui Bono Fallacy', 'Guilt by Association', 'Post Hoc Ergo Propter Hoc', 'Astroturfing'],
    correct: 'Cui Bono Fallacy',
    explanation: 'Benefit is treated as evidence of authorship. Astroturfing is the sharp distractor: that is a real phenomenon and would need evidence of coordination — account clustering, funding, synchronised messaging — none of which "someone benefits" supplies.',
    skills: ['skill.bias.attribution']
  },
  {
    domain: 'Cognitive Bias', difficulty: 1400,
    claim: 'A reviewer marks a colleague\'s error as carelessness and their own identical error, found the next day, as a symptom of an unclear spec.',
    options: ['Actor-Observer Asymmetry', 'Fundamental Attribution Error / Ingroup Favoritism', 'Selective Recall', 'Hindsight Bias'],
    correct: 'Actor-Observer Asymmetry',
    explanation: 'The precise form is the SELF versus other split, rather than in-group versus out-group. Both are attribution errors; distinguishing them matters because they have different remedies — one is fixed by perspective-taking, the other by rules applied before you know whose work it is.',
    skills: ['skill.bias.attribution']
  },
  {
    domain: 'Cognitive Bias', difficulty: 1330,
    claim: 'After an outage, the report concludes "human error by the on-call engineer" and closes. The runbook had been wrong since March.',
    options: ['Dispositional Over-Attribution', 'Hindsight Bias', 'Confirmation Bias', 'Appeal to Ignorance'],
    correct: 'Dispositional Over-Attribution',
    explanation: 'Attributing the failure to a person ends the investigation exactly where the systemic cause begins. Hindsight bias is likely present too, but the load-bearing error is locating the cause in a character rather than in the conditions.',
    skills: ['skill.bias.attribution']
  },

  /* ------------------------------------------------------- bias.probability */
  {
    domain: 'Cognitive Bias', difficulty: 1430,
    claim: '"She is quiet, reads constantly, and loves order. Is she more likely to be a librarian, or a librarian who plays in a band?"',
    options: ['Conjunction Fallacy', 'Base-Rate Neglect', 'Representativeness Heuristic', 'Availability Heuristic'],
    correct: 'Conjunction Fallacy',
    explanation: 'A conjunction can never be more probable than either of its parts, however well the extra detail fits the picture. Representativeness is the MECHANISM that produces the error; the conjunction violation is the error itself, which is what the question asks for.',
    skills: ['skill.bias.probability']
  },
  {
    domain: 'Cognitive Bias', difficulty: 1520,
    claim: 'A test is 99% accurate for a condition affecting 1 in 10,000 people. A positive result comes back. A colleague says "so it is 99% certain".',
    options: ['Base-Rate Neglect', 'Conjunction Fallacy', 'Anchoring Effect', 'Appeal to False Authority'],
    correct: 'Base-Rate Neglect',
    explanation: 'With that prevalence, the great majority of positives are false positives — roughly 1% of the healthy 9,999 outnumbers the single true case. The test\'s accuracy is real; the mistake is using it without the prior.',
    skills: ['skill.bias.probability']
  },
  {
    domain: 'Cognitive Bias', difficulty: 1280,
    claim: '"Red has come up six times in a row, so black is due."',
    options: ['Gambler\'s Fallacy', 'Base-Rate Neglect', 'Hindsight Bias', 'Availability Heuristic'],
    correct: 'Gambler\'s Fallacy',
    explanation: 'Independent trials have no memory. Note the mirror-image error is equally common — concluding that red is "hot" and will continue — and both come from expecting short runs to look like long-run averages.',
    skills: ['skill.bias.probability']
  },
  {
    domain: 'Cognitive Bias', difficulty: 1470,
    claim: 'A programme is judged effective because the schools that adopted it improved. Schools that adopted it and closed before the follow-up were not counted.',
    options: ['Survivorship Bias', 'Selective Recall', 'Base-Rate Neglect', 'Texas Sharpshooter'],
    correct: 'Survivorship Bias',
    explanation: 'The sample is defined by having survived to be measured, so the failures are structurally invisible. Cherry picking would require someone choosing which data to show; here nobody chose — the selection is done by the measurement itself, which makes it much harder to notice.',
    skills: ['skill.bias.probability']
  },
/* ------------------------------------------------------ tactic.astroturfing */
  {
    domain: 'Propaganda Tactics', difficulty: 1350,
    claim: 'Four hundred accounts supporting a zoning proposal were created within the same eleven-day window last year, and share a posting-time distribution unlike the platform baseline.',
    options: ['Astroturfing (Coordinated Account Creation)', 'Argumentum ad Populum (Bandwagon)', 'Brigading', 'Availability Heuristic'],
    correct: 'Astroturfing (Coordinated Account Creation)',
    explanation: 'Creation-date clustering plus an anomalous activity rhythm is coordination evidence, which is what separates this from bandwagon — bandwagon is a fallacy about crowd size being offered as a reason, astroturfing is a claim that the crowd is manufactured.',
    skills: ['skill.tactic.astroturfing', 'skill.disarm.seed-amplify']
  },
  {
    domain: 'Propaganda Tactics', difficulty: 1440,
    claim: 'A "grassroots parents\' coalition" launches with a professional website, a media kit, and a registered agent shared with an industry trade body.',
    options: ['Astroturfing (Front Group)', 'Appeal to False Authority', 'False Balance (Bothsidesism)', 'Coordinated Inauthentic Behaviour'],
    correct: 'Astroturfing (Front Group)',
    explanation: 'The tell is infrastructure appearing before membership — real grassroots groups accumulate capability slowly and messily. The shared registered agent is the documentary link that turns a suspicion into a finding.',
    skills: ['skill.tactic.astroturfing', 'skill.disarm.plan-prepare']
  },
  {
    domain: 'Propaganda Tactics', difficulty: 1500,
    claim: 'Two hundred reviews of a contested documentary use the phrase "finally someone said it" within a six-hour window, across accounts with no other overlap.',
    options: ['Coordinated Inauthentic Behaviour', 'Astroturfing', 'Argumentum ad Populum (Bandwagon)', 'Availability Cascade'],
    correct: 'Coordinated Inauthentic Behaviour',
    explanation: 'Near-identical phrasing in a tight window is the signature; the accounts need not be fake for the BEHAVIOUR to be coordinated, which is why this term is preferred to astroturfing when authorship is unproven. Choosing the stronger label without evidence of manufacture is itself an over-read.',
    skills: ['skill.tactic.astroturfing']
  },

  /* ----------------------------------------------------------- tactic.flooding */
  {
    domain: 'Propaganda Tactics', difficulty: 1310,
    claim: 'In a ninety-second answer, a speaker makes nineteen separate factual assertions, four of which are false and none of which the opponent has time to address.',
    options: ['Gish Gallop', 'Red Herring', 'Straw Man', 'Whataboutism (Tu Quoque)'],
    correct: 'Gish Gallop',
    explanation: 'The asymmetry between assertion cost and refutation cost is the weapon; the individual claims barely matter. A red herring diverts to ONE other topic, which is a different and much cheaper attack to answer.',
    skills: ['skill.tactic.flooding']
  },
  {
    domain: 'Propaganda Tactics', difficulty: 1480,
    claim: 'After a leak, a network publishes six mutually incompatible explanations within a day, none pushed harder than the others.',
    options: ['Firehose of Falsehood', 'Gish Gallop', 'False Balance (Bothsidesism)', 'Appeal to Ignorance'],
    correct: 'Firehose of Falsehood',
    explanation: 'The goal is not to be believed but to make belief feel arbitrary — mutual incompatibility is a feature, since a consistent lie could be refuted. A Gish gallop tries to WIN an exchange; this tries to exhaust the possibility of one.',
    skills: ['skill.tactic.flooding', 'skill.disarm.seed-amplify']
  },
  {
    domain: 'Propaganda Tactics', difficulty: 1390,
    claim: 'A records request is answered with 40,000 unsorted, unsearchable scanned pages within the statutory deadline.',
    options: ['Epistemic Flooding by Compliance', 'Gish Gallop', 'Red Herring', 'Appeal to Ignorance'],
    correct: 'Epistemic Flooding by Compliance',
    explanation: 'The request is technically satisfied while the answer is made unreachable. It shares its mechanism with the Gish gallop — cost asymmetry — but happens in a procedural rather than rhetorical setting, which is why it is rarely recognised as the same move.',
    skills: ['skill.tactic.flooding']
  },
  {
    domain: 'Propaganda Tactics', difficulty: 1420,
    claim: 'A moderator\'s queue receives 12,000 near-duplicate reports against one account in an hour, each individually plausible.',
    options: ['Brigading', 'Astroturfing', 'Gish Gallop', 'Coordinated Inauthentic Behaviour'],
    correct: 'Brigading',
    explanation: 'Volume is aimed at a process rather than at an audience — the target is the moderation system\'s capacity. It overlaps with coordinated inauthentic behaviour, but brigading can be entirely authentic people acting together, which is what makes it hard to police.',
    skills: ['skill.tactic.flooding']
  },

  /* ------------------------------------------------------ tactic.false-balance */
  {
    domain: 'Propaganda Tactics', difficulty: 1360,
    claim: 'A segment on a well-replicated finding gives equal airtime to the one researcher who disputes it and to the consensus position, without saying how many hold each.',
    options: ['False Balance (Bothsidesism)', 'Appeal to False Authority', 'Argumentum ad Populum (Bandwagon)', 'Manufactured Doubt'],
    correct: 'False Balance (Bothsidesism)',
    explanation: 'Equal time misrepresents the state of the evidence as an even split. Manufactured doubt is the strategy this often serves, but that names a deliberate campaign; false balance is the editorial artefact, which frequently occurs without one.',
    skills: ['skill.tactic.false-balance']
  },
  {
    domain: 'Propaganda Tactics', difficulty: 1550,
    claim: 'Internal documents show an industry planned to "establish doubt as the product" rather than to win the scientific argument outright.',
    options: ['Manufactured Doubt', 'False Balance (Bothsidesism)', 'Appeal to Ignorance', 'Firehose of Falsehood'],
    correct: 'Manufactured Doubt',
    explanation: 'The objective is uncertainty itself, because inaction follows from it — no positive counter-claim needs to survive scrutiny. False balance is the media surface this strategy exploits, not the strategy.',
    skills: ['skill.tactic.false-balance']
  },
  {
    domain: 'Propaganda Tactics', difficulty: 1280,
    claim: 'A debate on whether a bridge is structurally sound is staged between a structural engineer and a local columnist, introduced as "two views".',
    options: ['False Balance (Bothsidesism)', 'Appeal to False Authority', 'Red Herring', 'Ad Hominem'],
    correct: 'False Balance (Bothsidesism)',
    explanation: 'The pairing implies comparable standing on a question where it does not exist. Appeal to false authority is the near miss and would apply if the COLUMNIST\'S credentials were being cited as support; here the fallacy is committed by the framing, not by either speaker.',
    skills: ['skill.tactic.false-balance']
  },
  {
    domain: 'Propaganda Tactics', difficulty: 1470,
    claim: 'An article reports "scientists are divided" and cites two studies for and two against, from a literature containing several hundred.',
    options: ['False Balance (Bothsidesism)', 'Cherry Picking', 'Hasty Generalisation', 'Availability Heuristic'],
    correct: 'False Balance (Bothsidesism)',
    explanation: 'A 2-to-2 presentation of a lopsided literature manufactures a division. Cherry picking is genuinely also present, which is worth noticing: false balance is usually implemented THROUGH selective citation rather than being an alternative to it.',
    skills: ['skill.tactic.false-balance']
  },
  {
    domain: 'Propaganda Tactics', difficulty: 1400,
    claim: 'A broadcaster defends the pairing: "We do not take sides. We present both positions and let the audience decide."',
    options: ['Neutrality as an evasion of editorial judgement', 'False Balance (Bothsidesism)', 'Appeal to Ignorance', 'Argumentum ad Populum (Bandwagon)'],
    correct: 'Neutrality as an evasion of editorial judgement',
    explanation: 'Deciding what counts as a "position" worth airing is already an editorial judgement; declining to weigh evidence does not avoid influence, it just hides where the influence was applied. This is the defence that keeps false balance in place, which is why it is worth being able to name separately.',
    skills: ['skill.tactic.false-balance']
  },
  {
    domain: 'Propaganda Tactics', difficulty: 1520,
    claim: 'A journalist notes that on a question where evidence is genuinely unsettled, she gave both hypotheses equal weight and said so explicitly.',
    options: ['This is appropriate — balance matches the actual state of evidence', 'False Balance (Bothsidesism)', 'Manufactured Doubt', 'Appeal to Ignorance'],
    correct: 'This is appropriate — balance matches the actual state of evidence',
    explanation: 'False balance is not "presenting two sides", it is presenting them as more equal than the evidence warrants. When the evidence really is split, equal treatment is accurate — and an operator who has learned to shout "false balance" at every two-sided piece has acquired a reflex, not a skill.',
    skills: ['skill.tactic.false-balance']
  },
  {
    domain: 'Propaganda Tactics', difficulty: 1450,
    claim: 'A regulator\'s summary lists "arguments for" and "arguments against" in parallel columns of equal length, omitting that one column\'s entries were each rebutted in the evidence sessions.',
    options: ['False Balance (Bothsidesism)', 'Cherry Picking', 'Appeal to Ignorance', 'Straw Man'],
    correct: 'False Balance (Bothsidesism)',
    explanation: 'Symmetrical presentation carries an implicit claim about symmetrical strength, and the rebuttals were the load-bearing information. Layout is an argument, even when no sentence in the document makes one.',
    skills: ['skill.tactic.false-balance']
  },
/* --------------------------------------------------- tactic.emotive-framing */
  {
    domain: 'Propaganda Tactics', difficulty: 1240,
    claim: 'One outlet reports "the council seized the land"; another reports "the council acquired the land". The legal process described is identical.',
    options: ['Loaded / Emotive Language', 'Framing Effect', 'Equivocation (Semantic Shift)', 'Straw Man'],
    correct: 'Loaded / Emotive Language',
    explanation: 'The verb imports a verdict before any argument is made. It differs from equivocation in that no term shifts meaning WITHIN an argument — the word choice smuggles the conclusion in at the start.',
    skills: ['skill.tactic.emotive-framing']
  },
  {
    domain: 'Propaganda Tactics', difficulty: 1370,
    claim: 'A policy brief refers throughout to "the flood of arrivals" and "communities under strain", without citing a figure.',
    options: ['Loaded / Emotive Language', 'Appeal to Fear', 'Hasty Generalisation', 'Availability Heuristic'],
    correct: 'Loaded / Emotive Language',
    explanation: 'Metaphor does the work of evidence: "flood" implies volume, threat and lack of agency simultaneously. Appeal to fear is the neighbour — that names an explicit frightening consequence, whereas here the fear is carried by vocabulary alone.',
    skills: ['skill.tactic.emotive-framing']
  },
  {
    domain: 'Propaganda Tactics', difficulty: 1460,
    claim: 'A question in a survey reads: "Do you support the failed and wasteful subsidy programme?"',
    options: ['Complex Question (Loaded Question)', 'Loaded / Emotive Language', 'False Dilemma (Bifurcation)', 'Begging the Question'],
    correct: 'Complex Question (Loaded Question)',
    explanation: 'Both answers concede that the programme failed and was wasteful — the presupposition is unanswerable within the question. Loaded language is present too, but the structural defect is that there is no response that does not accept the premise.',
    skills: ['skill.tactic.emotive-framing', 'skill.fallacy.structure']
  },
  {
    domain: 'Propaganda Tactics', difficulty: 1330,
    claim: 'A campaign describes its own supporters as "concerned citizens" and its opponents\' identical activity as "agitators bussed in from outside".',
    options: ['Loaded / Emotive Language', 'Ingroup Attribution Asymmetry', 'Astroturfing', 'Whataboutism (Tu Quoque)'],
    correct: 'Loaded / Emotive Language',
    explanation: 'The same behaviour receives opposite labels. There is an attribution asymmetry underneath, which makes that a defensible second choice — but what is being asked about is the vocabulary doing the work, and the question is which lever is being pulled on the reader.',
    skills: ['skill.tactic.emotive-framing']
  },

  /* ------------------------------------------------------ tactic.equivocation */
  {
    domain: 'Propaganda Tactics', difficulty: 1350,
    claim: '"The report says the risk is not significant. So there is no meaningful risk to residents."',
    options: ['Equivocation (Semantic Shift)', 'Appeal to Ignorance', 'Hasty Generalisation', 'Straw Man'],
    correct: 'Equivocation (Semantic Shift)',
    explanation: '"Significant" moves from its statistical sense to its everyday one between the two sentences. A statistically non-significant result can describe a large and worrying effect measured imprecisely — the terms are not interchangeable, which is exactly what the argument relies on.',
    skills: ['skill.tactic.equivocation']
  },
  {
    domain: 'Propaganda Tactics', difficulty: 1490,
    claim: '"Every socialist regime has collapsed." Shown a counterexample: "That one was not truly socialist."',
    options: ['No True Scotsman', 'Equivocation (Semantic Shift)', 'Circular Reasoning', 'Begging the Question'],
    correct: 'No True Scotsman',
    explanation: 'The category is redefined mid-argument so the claim cannot be tested. It is a specific form of semantic shift, and worth distinguishing: ordinary equivocation exploits an existing ambiguity, while this one MANUFACTURES the ambiguity in response to evidence.',
    skills: ['skill.tactic.equivocation']
  },
  {
    domain: 'Propaganda Tactics', difficulty: 1420,
    claim: '"The data is anonymised — no names are stored. So the dataset cannot identify anyone."',
    options: ['Equivocation (Semantic Shift)', 'Appeal to Ignorance', 'Hasty Generalisation', 'Affirming the Consequent (Formal Fallacy)'],
    correct: 'Equivocation (Semantic Shift)',
    explanation: '"Anonymised" is used first in the narrow sense of name removal and then in the strong sense of non-identifiability, which are famously not the same — postcode, birth date and sex re-identify most people. The word is doing two different jobs in two consecutive clauses.',
    skills: ['skill.tactic.equivocation']
  },
  {
    domain: 'Propaganda Tactics', difficulty: 1300,
    claim: '"Of course the theory is only a theory — so it is hardly established fact."',
    options: ['Equivocation (Semantic Shift)', 'Appeal to Ignorance', 'Straw Man', 'False Dilemma (Bifurcation)'],
    correct: 'Equivocation (Semantic Shift)',
    explanation: 'The technical sense of "theory" — an explanatory framework supported by evidence — is swapped for the colloquial "guess". Note that the sentence contains no false statement, which is why equivocation is so much harder to answer than a lie.',
    skills: ['skill.tactic.equivocation']
  },
  {
    domain: 'Propaganda Tactics', difficulty: 1540,
    claim: 'A spokesperson: "We have never had a data breach." Later: incidents were logged as "security events" under an internal policy that reserves "breach" for confirmed exfiltration.',
    options: ['Equivocation (Semantic Shift)', 'Appeal to Ignorance', 'No True Scotsman', 'Loaded / Emotive Language'],
    correct: 'Equivocation (Semantic Shift)',
    explanation: 'A private definition is used to make a public claim that a listener will read under the ordinary definition. It is close to No True Scotsman, but nothing is being redefined in RESPONSE to a counterexample — the narrow definition was established in advance, which makes it more deliberate rather than less.',
    skills: ['skill.tactic.equivocation']
  },
  {
    domain: 'Propaganda Tactics', difficulty: 1380,
    claim: '"Free speech means I can say what I like. So a platform removing my post is a free speech violation."',
    options: ['Equivocation (Semantic Shift)', 'Straw Man', 'Appeal to Tradition', 'Slippery Slope'],
    correct: 'Equivocation (Semantic Shift)',
    explanation: 'The phrase shifts from a moral principle to a specific legal constraint on government action, and the conclusion only follows under the second reading while the premise is only plausible under the first.',
    skills: ['skill.tactic.equivocation']
  },
/* ----------------------------------------------------- disarm.plan-prepare */
  {
    domain: 'DISARM Framework', difficulty: 1330,
    claim: 'Six months before any content appears, an operator buys expired domains whose names resemble regional newspapers and lets them sit dormant.',
    options: ['T0004: Establish Inauthentic Assets / Spoofing', 'T0048: Flood the Information Environment / Epistemic Pollution', 'T0001: Target Profiling', 'Brigading'],
    correct: 'T0004: Establish Inauthentic Assets / Spoofing',
    explanation: 'Asset creation and ageing happen in the Prepare phase, long before anything is seeded — dormancy is the point, since domain age is a trust signal. Target profiling is the neighbouring Plan-phase activity and would involve studying an audience rather than building infrastructure.',
    skills: ['skill.disarm.plan-prepare', 'skill.tactic.astroturfing']
  },
  {
    domain: 'DISARM Framework', difficulty: 1420,
    claim: 'An adversary scrapes a year of a community\'s public posts to identify its most-shared grievances and the ten accounts everyone replies to.',
    options: ['T0001: Target Profiling', 'T0004: Establish Inauthentic Assets / Spoofing', 'T0048: Flood the Information Environment / Epistemic Pollution', 'Coordinated Inauthentic Behaviour'],
    correct: 'T0001: Target Profiling',
    explanation: 'Audience research precedes narrative development: you need to know which grievance exists before you can amplify it. Nothing has been created or published yet, which is what places this in Plan rather than Prepare.',
    skills: ['skill.disarm.plan-prepare']
  },
  {
    domain: 'DISARM Framework', difficulty: 1460,
    claim: 'A team drafts three variants of a narrative and quietly tests each with small ad buys to see which produces the most engagement, before any organic push.',
    options: ['Narrative Development and Pretesting', 'T0048: Flood the Information Environment / Epistemic Pollution', 'T0001: Target Profiling', 'Astroturfing'],
    correct: 'Narrative Development and Pretesting',
    explanation: 'This is message optimisation inside the Prepare phase — the same A/B discipline commercial marketing uses. It follows target profiling and precedes seeding, and its signature is small, cheap, low-visibility activity that looks like nothing much at the time.',
    skills: ['skill.disarm.plan-prepare']
  },
  {
    domain: 'DISARM Framework', difficulty: 1370,
    claim: 'Personas are built with two years of backdated ordinary posts — recipes, sport, holiday photographs — before ever mentioning politics.',
    options: ['T0004: Establish Inauthentic Assets / Spoofing', 'Coordinated Inauthentic Behaviour', 'T0001: Target Profiling', 'Astroturfing'],
    correct: 'T0004: Establish Inauthentic Assets / Spoofing',
    explanation: 'Legend-building is asset preparation; the mundane history exists to defeat exactly the account-age and content-mix checks a reviewer would run. It becomes a deployed astroturf campaign only once those assets are used to simulate a movement.',
    skills: ['skill.disarm.plan-prepare', 'skill.tactic.astroturfing']
  },

  /* --------------------------------------------------- disarm.seed-amplify */
  {
    domain: 'DISARM Framework', difficulty: 1340,
    claim: 'A fabricated claim is posted first to a small niche forum, then screenshotted into a mid-size channel as "people are saying", then covered by a national outlet as a controversy.',
    options: ['Narrative Laundering', 'T0048: Flood the Information Environment / Epistemic Pollution', 'Astroturfing', 'Firehose of Falsehood'],
    correct: 'Narrative Laundering',
    explanation: 'Each hop strips provenance and adds apparent credibility until the origin is unrecoverable. Flooding is a different mechanism — volume rather than laundering — and the tell here is the deliberate ladder of venues.',
    skills: ['skill.disarm.seed-amplify']
  },
  {
    domain: 'DISARM Framework', difficulty: 1400,
    claim: 'Prepared assets post a claim simultaneously across six platforms within a four-minute window.',
    options: ['Cross-Platform Amplification', 'T0004: Establish Inauthentic Assets / Spoofing', 'Brigading', 'T0001: Target Profiling'],
    correct: 'Cross-Platform Amplification',
    explanation: 'Simultaneity across platforms is the seeding signature — it manufactures the appearance of independent emergence, which is the single strongest trust cue an audience has. Brigading would target one venue or account rather than spreading across many.',
    skills: ['skill.disarm.seed-amplify']
  },
  {
    domain: 'DISARM Framework', difficulty: 1490,
    claim: 'Operators identify accounts that already believe a related claim and supply them with polished graphics, then step back entirely.',
    options: ['Useful-Idiot Recruitment / Organic Amplifier Seeding', 'Astroturfing', 'Coordinated Inauthentic Behaviour', 'Brigading'],
    correct: 'Useful-Idiot Recruitment / Organic Amplifier Seeding',
    explanation: 'The amplifiers are entirely authentic, which is what makes this so hard to counter — there is no inauthentic network to take down, and the sincerity of the spreaders is real. Astroturfing requires manufactured participants; this recruits genuine ones.',
    skills: ['skill.disarm.seed-amplify']
  },
  {
    domain: 'DISARM Framework', difficulty: 1450,
    claim: 'A campaign seeds a hashtag at 03:00 local time, when moderation staffing is thinnest, and lets it trend before review.',
    options: ['Timing Exploitation in Seeding', 'Brigading', 'T0048: Flood the Information Environment / Epistemic Pollution', 'Cross-Platform Amplification'],
    correct: 'Timing Exploitation in Seeding',
    explanation: 'Trending status acquired before human review converts into organic reach that survives the later takedown. The operational insight is that platform defences have a schedule, and schedules are targetable.',
    skills: ['skill.disarm.seed-amplify']
  },
  {
    domain: 'DISARM Framework', difficulty: 1310,
    claim: 'Thousands of low-quality posts on an unrelated topic bury a damaging story in every relevant feed within hours.',
    options: ['T0048: Flood the Information Environment / Epistemic Pollution', 'Narrative Laundering', 'Gish Gallop', 'Brigading'],
    correct: 'T0048: Flood the Information Environment / Epistemic Pollution',
    explanation: 'Nothing is argued and nothing is denied — attention is simply displaced. A Gish gallop floods a DEBATE with claims; this floods a channel with noise, and needs no engagement with the story at all.',
    skills: ['skill.disarm.seed-amplify', 'skill.tactic.flooding']
  },
  {
    domain: 'DISARM Framework', difficulty: 1520,
    claim: 'After a takedown removes 900 accounts, the same narrative reappears within a week through a different, previously dormant set.',
    options: ['Asset Rotation after Attrition', 'T0004: Establish Inauthentic Assets / Spoofing', 'Astroturfing', 'Cross-Platform Amplification'],
    correct: 'Asset Rotation after Attrition',
    explanation: 'Reserve assets prepared earlier are activated, which is why Prepare-phase stockpiling matters operationally. It shows that a takedown measured in accounts removed may be measuring the wrong thing.',
    skills: ['skill.disarm.seed-amplify', 'skill.disarm.countermeasures']
  },

  /* ------------------------------------------------ disarm.countermeasures */
  {
    domain: 'DISARM Framework', difficulty: 1470,
    claim: 'A small false claim is circulating in one niche forum. An agency issues a national press release naming and rebutting it.',
    options: ['The countermeasure amplifies what it targets', 'Prebunking', 'Strategic Silence', 'Narrative Laundering'],
    correct: 'The countermeasure amplifies what it targets',
    explanation: 'The rebuttal carries the claim to an audience that had never encountered it, and repetition increases familiarity, which increases believability. Proportionality is the whole skill — the right response to a contained claim is often containment.',
    skills: ['skill.disarm.countermeasures']
  },
  {
    domain: 'DISARM Framework', difficulty: 1430,
    claim: 'Before an expected influence operation, an outlet explains the TECHNIQUE likely to be used, without repeating any specific false claim.',
    options: ['Prebunking (Inoculation)', 'Debunking', 'Strategic Silence', 'Counter-Messaging'],
    correct: 'Prebunking (Inoculation)',
    explanation: 'Teaching the manipulation pattern in advance confers resistance without giving the specific falsehood any airtime. That is its advantage over debunking, which necessarily repeats the claim in order to correct it.',
    skills: ['skill.disarm.countermeasures']
  },
/* --------------------------------------------------- forensics.provenance */
  {
    domain: 'AI Media Forensics', difficulty: 1400,
    claim: 'An image carries a C2PA manifest that parses cleanly. The viewer shows the capture device, edit history and signer.',
    options: ['The manifest is parsed but not cryptographically verified', 'The image is proven authentic', 'The image is proven edited', 'The manifest proves the device model'],
    correct: 'The manifest is parsed but not cryptographically verified',
    explanation: 'Parsing reads what a file claims about itself; verification requires checking the COSE signature against a trusted certificate chain and confirming the asset hashes still match. A well-formed manifest can be copied wholesale onto a different image.',
    skills: ['skill.forensics.provenance']
  },
  {
    domain: 'AI Media Forensics', difficulty: 1330,
    claim: 'A photograph has no C2PA manifest at all.',
    options: ['This is not evidence of tampering', 'This indicates the image was manipulated', 'This indicates the image is synthetic', 'This proves the metadata was stripped deliberately'],
    correct: 'This is not evidence of tampering',
    explanation: 'The overwhelming majority of images ever made carry no manifest, and ordinary pipelines — screenshots, messaging apps, re-encodes — strip them routinely. Treating absence as suspicion would flag almost every real photograph in existence.',
    skills: ['skill.forensics.provenance']
  },
  {
    domain: 'AI Media Forensics', difficulty: 1550,
    claim: 'A manifest verifies cryptographically. The signing certificate chains to a certificate authority the analyst has never heard of.',
    options: ['The signature is valid but says nothing about the signer\'s trustworthiness', 'The image is authentic', 'The signature is invalid', 'The image was captured by the named device'],
    correct: 'The signature is valid but says nothing about the signer\'s trustworthiness',
    explanation: 'Cryptography establishes that a particular key signed particular bytes; whether that key belongs to anyone worth believing is a trust decision outside the mathematics. Anyone can stand up a CA and sign their own fabrications perfectly.',
    skills: ['skill.forensics.provenance']
  },
  {
    domain: 'AI Media Forensics', difficulty: 1480,
    claim: 'A manifest records that the asset was generated by a text-to-image model, and the signature verifies.',
    options: ['Strong evidence the image is synthetic, since a generator had no incentive to lie', 'Proof the image is synthetic', 'No information — manifests can be forged', 'Evidence the image is authentic'],
    correct: 'Strong evidence the image is synthetic, since a generator had no incentive to lie',
    explanation: 'A self-declared disclosure signed by the tool that made it is credible in the direction that costs the declarer something. Note the asymmetry: a manifest claiming CAMERA capture is far weaker evidence, because that is the claim an adversary would want to make.',
    skills: ['skill.forensics.provenance']
  },
  {
    domain: 'AI Media Forensics', difficulty: 1450,
    claim: 'Two copies of an image circulate. One carries a valid manifest; the other is pixel-identical with the manifest stripped.',
    options: ['Stripping a manifest is trivial and leaves the pixels untouched', 'The stripped copy has been manipulated', 'The manifest copy must be the original', 'The two files cannot be pixel-identical'],
    correct: 'Stripping a manifest is trivial and leaves the pixels untouched',
    explanation: 'Provenance is carried alongside the image data, not embedded in it, so removal changes nothing visible. This is why C2PA can raise confidence when present and can never lower it when absent.',
    skills: ['skill.forensics.provenance']
  },
  {
    domain: 'AI Media Forensics', difficulty: 1520,
    claim: 'A manifest verifies, but the recorded asset hash does not match the image bytes being examined.',
    options: ['The manifest belongs to a different asset than the one you are holding', 'The signature is forged', 'The image is authentic but re-encoded', 'The manifest is corrupt and should be ignored'],
    correct: 'The manifest belongs to a different asset than the one you are holding',
    explanation: 'A valid signature over a hash that does not match your bytes means exactly one thing: this provenance describes something else. That is the check that catches manifests transplanted from a genuine photograph onto a fabricated one.',
    skills: ['skill.forensics.provenance', 'skill.forensics.read-measurements']
  },

  /* --------------------------------------------- forensics.read-measurements */
  {
    domain: 'AI Media Forensics', difficulty: 1440,
    claim: 'An Error Level Analysis view shows one region markedly brighter than the rest of the frame.',
    options: ['An indicator with several innocent explanations, not a finding', 'Proof that region was pasted in', 'Proof the image is synthetic', 'Evidence the image is unedited'],
    correct: 'An indicator with several innocent explanations, not a finding',
    explanation: 'Differing JPEG compression history produces the same signature — a crop, a resave, text overlay, or a region of genuinely different texture will all light up. ELA locates something worth asking about; it does not answer the question.',
    skills: ['skill.forensics.read-measurements']
  },
{
    domain: 'Cognitive Bias', difficulty: 1420,
    claim: 'A hiring panel that liked a candidate\'s first answer spends the rest of the interview asking questions the candidate is likely to answer well.',
    options: ['Confirmation Bias', 'Anchoring Effect', 'Fundamental Attribution Error / Ingroup Favoritism', 'Availability Heuristic'],
    correct: 'Confirmation Bias',
    explanation: 'The interview stops being a test once the questions are chosen to be passed. Anchoring is a defensible second answer — the first answer did set an impression — but the diagnostic feature here is that the panel is now GATHERING evidence selectively rather than merely weighting it.',
    skills: ['skill.bias.confirmation']
  }
];
