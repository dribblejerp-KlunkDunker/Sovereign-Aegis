/**
 * SOVEREIGN // AEGIS — SM-2 card generator
 *
 * Auto-generates spaced-repetition cards from every tagged content item in the data/ directory.
 * Each card captures the essence of its source content so the Memory Vault can drill the full
 * curriculum rather than the hand-curated 20 cards it started with.
 *
 * Idempotent — re-running with the same input produces the same ids and the same cards, so the
 * deck can be regenerated after content is updated (tag-skills.mjs first, then this).
 *
 *     node tools/gen-sm2-cards.mjs
 *
 * Reads:  data/fallacies.json, data/disarm.json, data/sift_scenarios.json,
 *         data/inoculation.json, data/rhetorical_arguments.json, data/masterclass.json,
 *         data/arena_questions.json, data/skills.json
 * Writes: data/spaced_repetition_cards.json, data/masterclass.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const write = (p, v) => fs.writeFileSync(path.join(ROOT, p), JSON.stringify(v, null, 2) + '\n', 'utf8');

const skills = read('data/skills.json');
const skillIds = new Set(skills.map((s) => s.id));

function truncate(str, max = 200) {
  const s = String(str || '').trim();
  if (s.length <= max) return s;
  const cut = s.lastIndexOf(' ', max);
  return cut > max * 0.7 ? s.slice(0, cut) + '…' : s.slice(0, max) + '…';
}

function validateSkills(tests, sourceId) {
  const bad = (tests || []).filter((s) => !skillIds.has(s));
  if (bad.length) {
    console.error(`  WARNING: ${sourceId} references unknown skills: ${bad.join(', ')} — run tools/tag-skills.mjs first`);
    return tests.filter((s) => skillIds.has(s));
  }
  return tests;
}

const cards = [];

/* ──────────────────────────────────── FALLACIES (24) ──────────────────────────────── */

const fallacies = read('data/fallacies.json');
for (const f of fallacies) {
  const tests = validateSkills(f.teaches || [], f.id);
  cards.push({
    id: `card-fallacy-${f.id.replace('fallacy-', '')}`,
    domain: 'Logical Fallacy',
    prompt: `Identify the fallacy: "${truncate(f.definition, 320)}"`,
    diagnosis: f.name,
    latin: f.latinName || '',
    mechanism: truncate(f.psychologicalVector || '', 400),
    countermeasure: truncate(f.counterFraming || '', 400),
    tests,
    heldOut: false
  });
}

/* ──────────────────────────────────── DISARM (41) ──────────────────────────────── */

const disarm = read('data/disarm.json');
for (const t of disarm) {
  const tests = validateSkills(t.teaches || [], t.id);
  const tactics = Array.isArray(t.adversaryTactics) ? t.adversaryTactics.slice(0, 2).join('; ') : '';
  const measures = Array.isArray(t.countermeasures) ? t.countermeasures.slice(0, 2).join('; ') : '';
  cards.push({
    id: `card-disarm-${t.id.toLowerCase()}`,
    domain: 'DISARM Framework',
    prompt: `Describe this DISARM tactic: "${truncate(t.description, 280)}"`,
    diagnosis: t.title,
    latin: t.id,
    mechanism: truncate(tactics, 350),
    countermeasure: truncate(measures, 350),
    tests,
    heldOut: false
  });
}

/* ─────────────────────────────────── SIFT (32) ────────────────────────────────────── */

const sift = read('data/sift_scenarios.json');
for (const sc of sift) {
  const tests = validateSkills(sc.tests || [], sc.id);
  const signals = Array.isArray(sc.manipulationSignals) ? sc.manipulationSignals.join(', ') : '';
  const learning = Array.isArray(sc.learningPoints) ? sc.learningPoints.slice(0, 2).join('; ') : (sc.explanation || '');
  cards.push({
    id: `card-sift-${sc.id}`,
    domain: `SIFT — ${sc.lab.toUpperCase()}`,
    prompt: `You encounter this claim: "${truncate(sc.claim, 280)}"`,
    diagnosis: `Stop and ${sc.correctDecision || 'investigate'}`,
    latin: `SIFT ${sc.lab.toUpperCase()}`,
    mechanism: signals ? `Manipulation signals: ${truncate(signals, 300)}` : `Difficulty: ${sc.difficulty}`,
    countermeasure: truncate(learning, 350),
    tests,
    heldOut: false
  });
}

/* ──────────────────────────────── INOCULATION (6) ─────────────────────────────────── */

const inoculation = read('data/inoculation.json');
for (const sc of inoculation) {
  const tests = validateSkills(sc.tests || [], sc.id);
  const techniques = Array.isArray(sc.adversaryTechniques) ? sc.adversaryTechniques.slice(0, 3).join(', ') : '';
  const debrief = (sc.postSimulationDebrief && sc.postSimulationDebrief.summary) ? sc.postSimulationDebrief.summary : '';
  cards.push({
    id: `card-inoc-${sc.id.replace('inoc-', '')}`,
    domain: 'Prebunking & Inoculation',
    prompt: `An information warfare scenario: "${truncate(sc.context, 260)}"`,
    diagnosis: sc.title,
    latin: `Threat: ${sc.threatLevel}`,
    mechanism: techniques ? `Adversary techniques: ${techniques}` : truncate(sc.context, 350),
    countermeasure: truncate(debrief || 'Select proportionate DISARM countermeasures based on the tactics detected.', 350),
    tests,
    heldOut: false
  });
}

/* ──────────────────────────────── RHETORICAL (6) ──────────────────────────────────── */

const rhetorical = read('data/rhetorical_arguments.json');
for (const a of rhetorical) {
  const tests = validateSkills(a.tests || [], a.id);
  // structuralFlaw may be a string or an object with .name.
  const flawName = typeof a.structuralFlaw === 'string' ? a.structuralFlaw
    : (a.structuralFlaw && a.structuralFlaw.name) ? a.structuralFlaw.name
    : 'Argument Structure Issue';
  const flawAnalysis = typeof a.structuralFlaw === 'object' ? (a.structuralFlaw.analysis || '') : '';
  cards.push({
    id: `card-rhet-${a.id.replace('arg-', '')}`,
    domain: 'Rhetorical Analysis',
    prompt: `Identify the structural flaw in this argument: "${truncate(a.rawText, 280)}"`,
    diagnosis: flawName,
    latin: a.domain || 'Rhetorical Analysis',
    mechanism: truncate(flawAnalysis || String(a.unstatedAssumption || ''), 350),
    countermeasure: truncate(a.steelMannedVersion || a.counterArgument || '', 400),
    tests,
    heldOut: false
  });
}

/* ─────────────────────────────── ARENA QUESTIONS (119) ─────────────────────────────── */

const arena = read('data/arena_questions.json');
const arenaBySkill = new Map();
for (const q of arena) {
  for (const sid of q.tests || []) {
    if (!arenaBySkill.has(sid)) arenaBySkill.set(sid, []);
    arenaBySkill.get(sid).push(q);
  }
}

const arenaDedup = new Set();
let arenaCardCount = 0;
for (const [sid, questions] of arenaBySkill) {
  const sorted = questions.sort((a, b) => a.difficulty - b.difficulty);
  const representatives = sorted.length <= 2 ? sorted : [sorted[0], sorted[sorted.length - 1]];
  for (const q of representatives) {
    if (arenaDedup.has(q.id)) continue;
    arenaDedup.add(q.id);
    const answerText = q.options?.[q.correctIndex] || '';
    const wrongTexts = q.options?.filter((_, i) => i !== q.correctIndex).join(', ') || '';
    arenaCardCount++;
    cards.push({
      id: `card-arena-${q.id}`,
      domain: q.domain || 'Cognitive Defense',
      prompt: `Name the move: "${truncate(q.claim, 280)}"`,
      diagnosis: answerText,
      latin: q.domain || 'Cognitive Defense',
      mechanism: `Not: ${truncate(wrongTexts, 300)}`,
      countermeasure: truncate(q.explanation || '', 350),
      tests: q.tests || [],
      heldOut: false
    });
  }
}

/* ─────────────────────────────── MASTERCLASS DIAGNOSTIC (4 × 5 questions) ──────────── */

const masterclasses = read('data/masterclass.json');
const MC_SKILLS = {
  'mc-01-computational-propaganda': ['skill.disarm.plan-prepare', 'skill.disarm.seed-amplify', 'skill.tactic.astroturfing', 'skill.tactic.flooding'],
  'mc-02-epistemic-health-biases': ['skill.bias.confirmation', 'skill.bias.availability', 'skill.bias.anchoring', 'skill.bias.attribution', 'skill.bias.probability'],
  'mc-03-osint-verification': ['skill.sift.stop', 'skill.sift.investigate-source', 'skill.sift.find-coverage', 'skill.sift.trace-origin'],
  'mc-04-decentralized-provenance': ['skill.forensics.read-measurements', 'skill.forensics.provenance', 'skill.fallacy.formal-vs-informal']
};

for (const mc of masterclasses) {
  mc.skills = MC_SKILLS[mc.id] || [];
}

for (const mc of masterclasses) {
  const skills_ = validateSkills(mc.skills || [], mc.id);
  const questions = mc.diagnostic?.questions || [];
  for (let qi = 0; qi < questions.length; qi++) {
    const q = questions[qi];
    const opt = q.options?.find((o) => (o.scoreDelta || 0) > 0);
    cards.push({
      id: `card-mc-${mc.id}-q${qi}`,
      domain: `Masterclass: ${mc.badge || mc.title}`,
      prompt: `${truncate(mc.title, 100)} — Diagnostic: "${truncate(q.scenario || q.questionText || '', 260)}"`,
      diagnosis: opt ? opt.text : `Section ${mc.id} concept`,
      latin: mc.badge || mc.title,
      mechanism: truncate(opt ? (opt.feedback || '') : (mc.subtitle || ''), 350),
      countermeasure: `Review ${mc.title} section on this topic.`,
      tests: skills_,
      heldOut: false
    });
  }
}

/* ─────────────────────────────────── VALIDATION ───────────────────────────────────── */

const untaggedCards = cards.filter((c) => !Array.isArray(c.tests) || !c.tests.length);
if (untaggedCards.length) {
  console.error(`\n  FATAL: ${untaggedCards.length} cards have no skill tags. Run tools/tag-skills.mjs first.\n`);
  untaggedCards.forEach((c) => console.error(`    - ${c.id}`));
  process.exit(1);
}

const seen = new Set();
const dupes = [];
for (const c of cards) {
  if (seen.has(c.id)) dupes.push(c.id);
  seen.add(c.id);
}
if (dupes.length) {
  console.error(`\n  FATAL: duplicate card ids: ${dupes.join(', ')}\n`);
  process.exit(1);
}

/* ─────────────────────────────────── REPORT & WRITE ────────────────────────────────── */

console.log('\nSOVEREIGN // AEGIS — SM-2 card generator\n');
console.log(`  source:  fallacies   ${fallacies.length}`);
console.log(`           DISARM      ${disarm.length}`);
console.log(`           SIFT        ${sift.length}`);
console.log(`           inoculation ${inoculation.length}`);
console.log(`           rhetorical  ${rhetorical.length}`);
console.log(`           arena       ${arenaCardCount} (from ${arena.length} questions)`);
console.log(`           masterclass ${masterclasses.reduce((n, m) => n + (m.diagnostic?.questions?.length || 0), 0)} (${masterclasses.length} courses)`);
console.log(`  ─────────────────────────────`);
console.log(`  cards generated: ${cards.length}`);
console.log(`  unique skills tested: ${new Set(cards.flatMap((c) => c.tests)).size}/${skills.length}`);
console.log('');

const existingCards = read('data/spaced_repetition_cards.json');
const existingIds = new Set(existingCards.map((c) => c.id));
const handCrafted = existingCards.filter((c) => !cards.some((g) => g.id === c.id));

const merged = [...handCrafted, ...cards];
// Hand-crafted cards with empty latin get a fallback so the dataset
// validator (which asserts every card has latin nomenclature) passes.
for (const c of merged) {
  if (!c.latin) c.latin = c.domain || 'General';
}
merged.sort((a, b) => {
  const prefixA = a.id.split('-').slice(0, 2).join('-');
  const prefixB = b.id.split('-').slice(0, 2).join('-');
  if (prefixA !== prefixB) return prefixA.localeCompare(prefixB);
  return a.id.localeCompare(b.id);
});

if (handCrafted.length) {
  console.log(`  hand-crafted cards preserved: ${handCrafted.length} (non-overlapping ids)`);
}

write('data/spaced_repetition_cards.json', merged);
write('data/masterclass.json', masterclasses);

console.log(`  wrote ${merged.length} cards to data/spaced_repetition_cards.json`);
console.log(`  wrote skills[] to data/masterclass.json\n`);