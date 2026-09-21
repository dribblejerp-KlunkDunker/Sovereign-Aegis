/**
 * SOVEREIGN // AEGIS — one-off content tagger (dev tool, re-runnable)
 *
 * Adds the skill vocabulary to existing content:
 *   - data/fallacies.json      gains `teaches: [skillId]`
 *   - data/arena_questions.json gains `tests: [skillId]` and `heldOut: boolean`
 *
 * Idempotent: re-running produces the same result, so it can be used to re-tag after the
 * taxonomy changes (which the roadmap expects after ~1,000 attempts).
 *
 * Prints a coverage report and EXITS NON-ZERO if any assessable item ends up untagged —
 * an untagged question is invisible to the estimator, which is exactly the failure this
 * whole phase exists to fix, so it must not pass silently.
 *
 *     node tools/tag-skills.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const write = (p, v) => fs.writeFileSync(path.join(ROOT, p), JSON.stringify(v, null, 2) + '\n', 'utf8');

const skills = read('data/skills.json');
const skillIds = new Set(skills.map((s) => s.id));

// Every item id named as held-out in skills.json, collected once.
const heldOutIds = new Set(skills.flatMap((s) => s.heldOutItemIds || []));

/* ------------------------------------------------------ fallacies: by category */

const CATEGORY_TO_SKILL = {
  'Relevance & Distraction': 'skill.fallacy.relevance',
  'Presumption & Structure': 'skill.fallacy.structure',
  'Scope & Quantity': 'skill.fallacy.scope',
  'Authority & Appeals': 'skill.fallacy.appeals'
};

// A few fallacies additionally teach the formal/informal distinction.
const EXTRA_BY_FALLACY_ID = {
  'fallacy-affirming-consequent': ['skill.fallacy.formal-vs-informal'],
  'fallacy-denying-antecedent': ['skill.fallacy.formal-vs-informal'],
  'fallacy-begging-the-question': ['skill.tactic.equivocation'],
  'fallacy-circular-reasoning': ['skill.fallacy.formal-vs-informal'],
  'fallacy-appeal-to-emotion': ['skill.tactic.emotive-framing'],
  'fallacy-appeal-to-popularity': ['skill.tactic.astroturfing']
};

const fallacies = read('data/fallacies.json');
const untaggedFallacies = [];
for (const f of fallacies) {
  const base = CATEGORY_TO_SKILL[f.category];
  const extra = EXTRA_BY_FALLACY_ID[f.id] || [];
  const teaches = [...new Set([base, ...extra].filter(Boolean))];
  if (!teaches.length) untaggedFallacies.push(f.id);
  f.teaches = teaches;
}

/* ------------------------------------------------- arena questions: by answer */

// Keyed on the TEXT OF THE CORRECT ANSWER, because that is what the question actually
// assesses — not the loose `domain` label, which lumps nine different competencies into
// "Logical Fallacy".
//
// The map lives in data/answer_skill_map.json rather than as a literal here. It was inline until
// the P1 batch added ~70 new answer strings, at which point hand-maintaining it would have
// reintroduced exactly the per-item drift that deriving tags from the answer was meant to prevent.
// tools/merge-p1.mjs emits the map from the same array that emits the questions, so the two cannot
// disagree; this file only consumes it.
const ANSWER_TO_SKILLS = read('data/answer_skill_map.json');

const arena = read('data/arena_questions.json');
const untaggedArena = [];
for (const q of arena) {
  const answer = q.options?.[q.correctIndex];
  const tests = ANSWER_TO_SKILLS[answer] || [];
  if (!tests.length) untaggedArena.push({ id: q.id, answer });
  q.tests = tests;
  q.heldOut = heldOutIds.has(q.id);
}

/* ------------------------------------------------- SM-2 cards: by diagnosis */

// Keyed on `diagnosis`, the card's answer — same reasoning as ANSWER_TO_SKILLS above.
const DIAGNOSIS_TO_SKILLS = {
  'Ad Hominem (Argumentum ad Hominem)': ['skill.fallacy.relevance'],
  'Straw Man (Ignoratio Elenchi)': ['skill.fallacy.relevance'],
  'Whataboutism (Tu Quoque)': ['skill.fallacy.relevance'],
  'False Dilemma (Bifurcation)': ['skill.fallacy.structure'],
  'Slippery Slope': ['skill.fallacy.scope'],
  'Post Hoc Ergo Propter Hoc': ['skill.fallacy.scope'],
  'Fallacy of Composition': ['skill.fallacy.scope'],
  'Appeal to Nature (Naturalistic Fallacy)': ['skill.fallacy.appeals'],
  'Confirmation Bias': ['skill.bias.confirmation'],
  'Availability Heuristic': ['skill.bias.availability'],
  'Anchoring Effect': ['skill.bias.anchoring'],
  'Sunk Cost Fallacy': ['skill.bias.probability'],
  'Astroturfing / Coordinated Inauthentic Amplification': ['skill.tactic.astroturfing'],
  'Gish Gallop': ['skill.tactic.flooding'],
  'Corneal Specular Reflection Asymmetry': ['skill.forensics.read-measurements'],
  'GAN Deconvolution / Upsampling Grid Artifact': ['skill.forensics.read-measurements'],
  'Gingival & Dentition Repetition Hallucination': ['skill.forensics.read-measurements'],
  'DISARM Tactic T0001: Target Profiling': ['skill.disarm.plan-prepare'],
  'DISARM Tactic T0004: Establish Inauthentic Assets / Masthead Spoofing': ['skill.disarm.plan-prepare', 'skill.tactic.astroturfing'],
  'DISARM Tactic T0048: Flood the Information Space / Epistemic Fog': ['skill.disarm.seed-amplify', 'skill.tactic.flooding']
};

const cards = read('data/spaced_repetition_cards.json');
const untaggedCards = [];
for (const c of cards) {
  // Prefer the curated map; fall back to the card's own tests field (set by gen-sm2-cards.mjs).
  const tests = DIAGNOSIS_TO_SKILLS[c.diagnosis] || c.tests || [];
  if (!tests.length) untaggedCards.push({ id: c.id, diagnosis: c.diagnosis });
  c.tests = tests;
  c.heldOut = heldOutIds.has(c.id);
}

/* ------------------------------------------------------- SIFT scenarios: by lab */

const LAB_TO_SKILL = {
  stop: 'skill.sift.stop',
  investigate: 'skill.sift.investigate-source',
  coverage: 'skill.sift.find-coverage',
  trace: 'skill.sift.trace-origin'
};

const sift = read('data/sift_scenarios.json');
const untaggedSift = [];
for (const sc of sift) {
  const base = LAB_TO_SKILL[sc.lab];
  const tests = base ? [base] : [];
  if (!tests.length) untaggedSift.push({ id: sc.id, lab: sc.lab });
  sc.tests = tests;
  sc.heldOut = heldOutIds.has(sc.id);
}

/* ------------------------------------------- inoculation scenarios: branching drills */

// Every branching stage is a "choose a proportionate response" decision, which is exactly
// skill.disarm.countermeasures. The second skill is what the scenario's cover story requires
// the operator to see through.
const INOCULATION_EXTRA = {
  'inoc-biosecurity-panic': ['skill.tactic.emotive-framing'],
  'inoc-financial-run-rumor': ['skill.tactic.emotive-framing'],
  'inoc-election-ballot-deepfake': ['skill.forensics.provenance'],
  'inoc-grid-failure-sabotage': ['skill.tactic.astroturfing'],
  'inoc-synthetic-diplomatic-scandal': ['skill.forensics.provenance'],
  'inoc-algorithmic-polarization-trap': ['skill.tactic.emotive-framing']
};

const inoculation = read('data/inoculation.json');
const untaggedInoculation = [];
for (const sc of inoculation) {
  const tests = [...new Set(['skill.disarm.countermeasures', ...(INOCULATION_EXTRA[sc.id] || [])])];
  if (!INOCULATION_EXTRA[sc.id]) untaggedInoculation.push({ id: sc.id, category: sc.category });
  sc.tests = tests;
  sc.heldOut = heldOutIds.has(sc.id);
}

/* ---------------------------------------------- DISARM techniques: reference content */

// `teaches`, not `tests` — the DISARM browser is reference material with no drill. Tagging it
// anyway is what lets Phase 2 generate review cards from it, and stops three DISARM skills
// reading as "no content" when 39 records describe them.
const PHASE_TO_SKILL = {
  Plan: 'skill.disarm.plan-prepare',
  Prepare: 'skill.disarm.plan-prepare',
  Seed: 'skill.disarm.seed-amplify',
  Amplify: 'skill.disarm.seed-amplify',
  'Measure & Adapt': 'skill.disarm.countermeasures'
};

const disarm = read('data/disarm.json');
const untaggedDisarm = [];
for (const t of disarm) {
  const base = PHASE_TO_SKILL[t.phase];
  const teaches = base ? [base] : [];
  if (!teaches.length) untaggedDisarm.push({ id: t.id, phase: t.phase });
  t.teaches = teaches;
}

/* -------------------------------------- rhetorical arguments: clause decomposition */

// Tagging premises and conclusions is argument-structure work, whatever the argument is
// about — so all six get the same skill rather than one per domain.
const rhetorical = read('data/rhetorical_arguments.json');
for (const a of rhetorical) {
  a.tests = ['skill.fallacy.structure'];
  a.heldOut = heldOutIds.has(a.id);
}

/* ------------------------------------------------------------------ validation */

const ASSESSED = [
  { label: 'arena questions', rows: arena, key: 'tests' },
  { label: 'SM-2 cards', rows: cards, key: 'tests' },
  { label: 'SIFT scenarios', rows: sift, key: 'tests' },
  { label: 'inoculation scenarios', rows: inoculation, key: 'tests' },
  { label: 'rhetorical arguments', rows: rhetorical, key: 'tests' }
];

const unknownRefs = [];
for (const f of fallacies) for (const s of f.teaches) if (!skillIds.has(s)) unknownRefs.push(`${f.id} -> ${s}`);
for (const t of disarm) for (const s of t.teaches) if (!skillIds.has(s)) unknownRefs.push(`${t.id} -> ${s}`);
for (const g of ASSESSED) for (const r of g.rows) for (const s of r[g.key]) if (!skillIds.has(s)) unknownRefs.push(`${r.id} -> ${s}`);

// Every assessable item across every module, for held-out accounting.
const allAssessed = ASSESSED.flatMap((g) => g.rows);
const missingHeldOut = [...heldOutIds].filter((id) => !allAssessed.some((r) => r.id === id));

/* --------------------------------------------------------------------- report */

console.log('\nSOVEREIGN // AEGIS — skill tagging\n');
console.log(`  skills defined              : ${skills.length}`);
console.log(`  fallacies tagged (teaches)  : ${fallacies.length - untaggedFallacies.length}/${fallacies.length}`);
console.log(`  DISARM tagged (teaches)     : ${disarm.length - untaggedDisarm.length}/${disarm.length}`);
for (const g of ASSESSED) {
  const untagged = g.rows.filter((r) => !r[g.key].length).length;
  console.log(`  ${g.label.padEnd(26)}: ${g.rows.length - untagged}/${g.rows.length} tested, ${g.rows.filter((r) => r.heldOut).length} held out`);
}
const heldCount = allAssessed.filter((r) => r.heldOut).length;
console.log(`  assessable items total      : ${allAssessed.length}`);
console.log(`  held out overall            : ${heldCount} (${((heldCount / allAssessed.length) * 100).toFixed(0)}%)`);
// Held-out items must still be ADMINISTERED, or they are simply deleted from the app. That
// requires a scheduler that can probe them, which today only the Arena has. So held-out ids
// are declared for Arena questions only, and the overall percentage is correspondingly low —
// Phase 4 ("Demonstrate transfer") designs the baseline/follow-up protocol that fixes this.
const heldOutside = allAssessed.filter((r) => r.heldOut && !arena.includes(r)).map((r) => r.id);
if (heldOutside.length) {
  console.log(`  NOTE: ${heldOutside.length} held-out item(s) live outside the Arena and have no`);
  console.log('        probe cadence to administer them — they are effectively unreachable:');
  heldOutside.forEach((id) => console.log(`      - ${id}`));
}

const covered = new Set([
  ...fallacies.flatMap((f) => f.teaches),
  ...disarm.flatMap((t) => t.teaches),
  ...allAssessed.flatMap((r) => r.tests)
]);
const uncoveredSkills = skills.filter((s) => !covered.has(s.id)).map((s) => s.id);
console.log(`  skills with content attached: ${covered.size}/${skills.length}`);
if (uncoveredSkills.length) {
  console.log(`  skills with NO content yet  : ${uncoveredSkills.length}`);
  uncoveredSkills.forEach((s) => console.log(`      - ${s}`));
}

// Which skills can actually be *measured* (have a drill, not just reading material).
const assessableSkills = new Set(allAssessed.flatMap((r) => r.tests));
const readOnly = skills.filter((s) => covered.has(s.id) && !assessableSkills.has(s.id)).map((s) => s.id);
if (readOnly.length) {
  console.log(`  skills with content but NO drill: ${readOnly.length}`);
  readOnly.forEach((s) => console.log(`      - ${s}  (reference material only — mastery will stay "unknown")`));
}

let failed = false;
if (untaggedFallacies.length) {
  console.error(`\n  FATAL: ${untaggedFallacies.length} fallacies untagged: ${untaggedFallacies.join(', ')}`);
  failed = true;
}
if (untaggedArena.length) {
  console.error(`\n  FATAL: ${untaggedArena.length} arena questions untagged — they would be invisible to the estimator:`);
  untaggedArena.forEach((u) => console.error(`      ${u.id}: answer "${u.answer}"`));
  failed = true;
}
if (untaggedCards.length) {
  console.error(`\n  FATAL: ${untaggedCards.length} SM-2 cards untagged:`);
  untaggedCards.forEach((u) => console.error(`      ${u.id}: diagnosis "${u.diagnosis}"`));
  failed = true;
}
if (untaggedSift.length) {
  console.error(`\n  FATAL: ${untaggedSift.length} SIFT scenarios untagged (unknown lab):`);
  untaggedSift.forEach((u) => console.error(`      ${u.id}: lab "${u.lab}"`));
  failed = true;
}
if (untaggedInoculation.length) {
  console.error(`\n  FATAL: ${untaggedInoculation.length} inoculation scenarios have no scenario-specific skill:`);
  untaggedInoculation.forEach((u) => console.error(`      ${u.id}: category "${u.category}"`));
  failed = true;
}
if (untaggedDisarm.length) {
  console.error(`\n  FATAL: ${untaggedDisarm.length} DISARM techniques untagged (unknown phase):`);
  untaggedDisarm.forEach((u) => console.error(`      ${u.id}: phase "${u.phase}"`));
  failed = true;
}
if (unknownRefs.length) {
  console.error(`\n  FATAL: references to skills not in skills.json:`);
  unknownRefs.forEach((r) => console.error(`      ${r}`));
  failed = true;
}
// A skill whose every question is held out has no practice items at all — the queue
// would never surface it, and the operator could never improve at it. Catch that here
// rather than discovering it as silence in the UI.
const starved = [];
for (const sk of skills) {
  const items = allAssessed.filter((r) => r.tests.includes(sk.id));
  if (items.length && items.every((r) => r.heldOut)) starved.push(`${sk.id} (${items.length} item(s), all held out)`);
}
if (starved.length) {
  console.error(`\n  FATAL: skills with no practice items left:`);
  starved.forEach((x) => console.error(`      ${x}`));
  failed = true;
}

// A set of items whose correct answer is ALWAYS the same value measures nothing: the operator
// presses one button forever and scores 100%, and the mastery curve rises while no discrimination
// is being demonstrated. This is the same failure as a structural tell in a question stem, and it
// is invisible unless something checks for it — so it is checked here.
const SINGLE_ANSWER_GROUPS = [
  { label: 'SIFT stop lab', rows: sift.filter((s) => s.lab === 'stop'), key: 'correctDecision' },
  { label: 'SIFT investigate lab', rows: sift.filter((s) => s.lab === 'investigate'), key: 'correctAnswer' },
  { label: 'SIFT coverage lab', rows: sift.filter((s) => s.lab === 'coverage'), key: 'correctAnswer' }
];
for (const g of SINGLE_ANSWER_GROUPS) {
  const answers = new Set(g.rows.map((r) => String(r[g.key])));
  if (g.rows.length >= 3 && answers.size === 1) {
    console.error(`\n  FATAL: ${g.label} — all ${g.rows.length} items have the same correct answer ("${[...answers][0]}").`);
    console.error('  Pressing one button would score 100%. Add items whose correct answer differs,');
    console.error('  or the skill this lab measures will read as mastered from reflex alone.');
    failed = true;
  }
}

const heldPct = (heldCount / allAssessed.length) * 100;
if (heldPct > 35) {
  console.error(`\n  FATAL: ${heldPct.toFixed(0)}% of assessable items held out — target is ~20%.`);
  console.error('  Too large a held-out set starves practice; reduce heldOutItemIds in data/skills.json.');
  failed = true;
}

if (missingHeldOut.length) {
  console.error(`\n  FATAL: skills.json declares held-out items that do not exist: ${missingHeldOut.join(', ')}`);
  failed = true;
}

if (failed) {
  console.error('\n  Nothing written.\n');
  process.exit(1);
}

const written = [
  ['data/fallacies.json', fallacies],
  ['data/arena_questions.json', arena],
  ['data/spaced_repetition_cards.json', cards],
  ['data/sift_scenarios.json', sift],
  ['data/inoculation.json', inoculation],
  ['data/disarm.json', disarm],
  ['data/rhetorical_arguments.json', rhetorical]
];
for (const [p, v] of written) write(p, v);
console.log(`\n  wrote ${written.length} data files\n`);
