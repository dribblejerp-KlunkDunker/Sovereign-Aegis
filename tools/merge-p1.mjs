/**
 * SOVEREIGN // AEGIS — merge the P1 batch into the question bank
 *
 * Appends tools/p1-batch.mjs to data/arena_questions.json and regenerates
 * data/answer_skill_map.json, which tools/tag-skills.mjs reads.
 *
 * WHY THE MAP IS GENERATED RATHER THAN HAND-MAINTAINED
 * ---------------------------------------------------
 * Tagging is derived from the correct ANSWER, not written per item — that was a deliberate
 * decision, because a per-item tag is a second thing to keep in sync and the first thing to rot.
 * But a batch of ninety items introduces ~70 new answer strings, and hand-adding them to a literal
 * in the tagger would reintroduce exactly the drift the derivation was meant to prevent. So the
 * map is emitted from the same array that produces the questions: they cannot disagree.
 *
 * Idempotent. Re-running with the same batch produces the same files and no duplicates.
 *
 *     node tools/merge-p1.mjs [--check]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ITEMS } from './p1-batch.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const write = (p, v) => fs.writeFileSync(path.join(ROOT, p), JSON.stringify(v, null, 2) + '\n', 'utf8');
const checkOnly = process.argv.includes('--check');

/* --------------------------------------------------------------- validation */

const problems = [];
ITEMS.forEach((it, i) => {
  const where = `batch[${i}] "${(it.claim || '').slice(0, 48)}…"`;
  if (!it.claim || !it.explanation) problems.push(`${where}: missing claim or explanation`);
  if (!Array.isArray(it.options) || it.options.length !== 4) problems.push(`${where}: needs exactly 4 options`);
  if (new Set(it.options).size !== (it.options || []).length) problems.push(`${where}: duplicate options`);
  if (!it.options?.includes(it.correct)) problems.push(`${where}: correct answer is not among the options`);
  if (!Array.isArray(it.skills) || !it.skills.length) problems.push(`${where}: no skills`);
  if (!Number.isFinite(it.difficulty)) problems.push(`${where}: no difficulty`);
  // An explanation that only names the answer teaches a label. Every item must contrast.
  if ((it.explanation || '').length < 120) problems.push(`${where}: explanation too thin to teach the distinction`);
});

// One answer string must always mean one skill set, or the derived map is ambiguous.
const byAnswer = new Map();
for (const it of ITEMS) {
  const key = it.correct;
  const val = JSON.stringify([...it.skills].sort());
  if (byAnswer.has(key) && byAnswer.get(key) !== val) {
    problems.push(`answer "${key}" maps to two different skill sets — the derived map cannot be built`);
  }
  byAnswer.set(key, val);
}

// Overwriting an answer that already means something else would silently re-tag the questions
// already in the bank — a change to historical items nobody asked for, and one that would show up
// only as mastery numbers moving for no visible reason.
const existingMap = read('data/answer_skill_map.json');
for (const it of ITEMS) {
  const prior = existingMap[it.correct];
  if (prior && JSON.stringify([...prior].sort()) !== JSON.stringify([...it.skills].sort())) {
    problems.push(`answer "${it.correct}" already maps to [${prior}] — the batch would re-tag existing questions to [${it.skills}]`);
  }
}

const skillIds = new Set(read('data/skills.json').map((s) => s.id));
for (const it of ITEMS) {
  for (const s of it.skills) if (!skillIds.has(s)) problems.push(`unknown skill "${s}" in "${it.correct}"`);
}

if (problems.length) {
  console.error(`\n  ${problems.length} problem(s) in the batch:\n`);
  problems.forEach((p) => console.error(`    - ${p}`));
  console.error('\n  Nothing written.\n');
  process.exit(1);
}

/* ------------------------------------------------------------------- merge */

const arena = read('data/arena_questions.json');
const existingIds = new Set(arena.map((q) => q.id));
const existingClaims = new Set(arena.map((q) => q.claim));

// Ids continue the existing sequence. Stable across re-runs because a claim already present is
// skipped rather than re-added.
let next = Math.max(0, ...arena.map((q) => parseInt(String(q.id).replace(/\D/g, ''), 10) || 0)) + 1;
let added = 0;
for (const it of ITEMS) {
  if (existingClaims.has(it.claim)) continue;
  let id = `q${next++}`;
  while (existingIds.has(id)) id = `q${next++}`;
  existingIds.add(id);
  arena.push({
    id,
    domain: it.domain,
    difficulty: it.difficulty,
    claim: it.claim,
    options: it.options,
    correctIndex: it.options.indexOf(it.correct),
    explanation: it.explanation,
    tests: [...it.skills],
    heldOut: false
  });
  added++;
}

// The map the tagger reads: every answer string in the bank, old and new.
const map = read('data/answer_skill_map.json');
for (const it of ITEMS) map[it.correct] = [...it.skills];

if (checkOnly) {
  console.log(`  batch valid: ${ITEMS.length} items, ${added} would be added, ${byAnswer.size} distinct answers`);
  process.exit(0);
}

write('data/arena_questions.json', arena);
write('data/answer_skill_map.json', map);
console.log(`\n  merged ${added} new items (${ITEMS.length} in batch, ${ITEMS.length - added} already present)`);
console.log(`  arena bank is now ${arena.length} questions`);
console.log(`  answer→skill map now holds ${Object.keys(map).length} answers\n`);
