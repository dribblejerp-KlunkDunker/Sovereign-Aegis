/**
 * SOVEREIGN // AEGIS — Phase 4 transfer study: held-out form builder (protocol §4)
 *
 * Partitions eligible arena items into three disjoint, hash-frozen bundles:
 *   practice  — available to Arm A during the 14-day practice window
 *   T0        — baseline held-out form (never practiced)
 *   T1        — post-test held-out form, parallel to T0 (same strata, matched difficulty)
 *
 * Eligibility (protocol §4): items NOT flagged heldOut in the app (those 40 are the app's
 * own transfer probes and are excluded from the study entirely), each with a stable id,
 * a skill tag array (tests), a correctIndex, and the form's response format (4 options).
 *
 * Parallel-form construction: within each skill stratum, order items by (difficulty, id)
 * and deal alternately to T0/T1 — difficulty-matched, stratum-matched. Leftover items in
 * a stratum (3rd, 4th, …) go to practice. Item order within a form and option order
 * within an item are shuffled with the predeclared seed; the answer key reflects the
 * permutation, and correctIndex is stripped from the served form files.
 *
 * Determinism: same inputs + same SEED → byte-identical outputs (pinned by tests).
 *
 * Usage: node tools/transfer-study/build-forms.mjs [--seed <string>]
 * Writes to docs/transfer-study/forms/ and prints the SHA-256 manifest.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'docs', 'transfer-study', 'forms');

/** Predeclared seed policy (protocol §4). Change this only BEFORE enrollment, never after. */
const SEED = 'aegis-transfer-study-v1.0-forms';

// djb2 string hash → 32-bit seed, mulberry32 PRNG. Same family as the app's seeded shuffles.
function hashSeed(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededShuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

const args = process.argv.slice(2);
const seedArg = args.includes('--seed') ? args[args.indexOf('--seed') + 1] : SEED;

const bank = JSON.parse(readFileSync(join(ROOT, 'data', 'arena_questions.json'), 'utf8'));

// ---- Eligibility -----------------------------------------------------------
const eligible = [];
const excluded = { appHeldOut: 0, malformed: 0 };
for (const q of bank) {
  if (q.heldOut === true) { excluded.appHeldOut++; continue; }
  if (!q.id || !Array.isArray(q.tests) || q.tests.length === 0 ||
      !Number.isInteger(q.correctIndex) || !Array.isArray(q.options) || q.options.length !== 4) {
    excluded.malformed++; continue;
  }
  eligible.push(q);
}
// Primary stratum = first skill tag (tags are ordered by content design); guard against none.
const strataOf = (q) => q.tests[0];

// ---- Parallel-form deal ----------------------------------------------------
// Within stratum: sort by (difficulty, id) for determinism, then deal T0, T1, practice, practice, T0, T1…
// The alternate deal gives each form one item per stratum with difficulty matched on average.
const byStratum = new Map();
for (const q of eligible) {
  const s = strataOf(q);
  if (!byStratum.has(s)) byStratum.set(s, []);
  byStratum.get(s).push(q);
}
const t0 = [], t1 = [], practice = [];
const strataReport = [];
for (const [stratum, items] of [...byStratum.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  items.sort((a, b) => (a.difficulty - b.difficulty) || a.id.localeCompare(b.id));
  let deal = 0; // 0 → T0, 1 → T1, ≥2 → practice
  for (const q of items) {
    if (deal === 0) t0.push(q);
    else if (deal === 1) t1.push(q);
    else practice.push(q);
    deal++;
  }
  strataReport.push({ stratum, total: items.length, t0: Math.min(1, items.length), t1: Math.min(1, items.length - 1) });
}

// ---- Serve forms: strip answers, shuffle items + options --------------------
const rngItems = mulberry32(hashSeed(seedArg + ':item-order'));
const servedT0 = seededShuffle(t0, rngItems).map((q) => structuredClone(q));
const servedT1 = seededShuffle(t1, rngItems).map((q) => structuredClone(q));

const keyFor = (served) => served.map((q, position) => {
  const correctText = q.options[q.correctIndex];
  const perm = seededShuffle(q.options.map((_, i) => i), mulberry32(hashSeed(seedArg + ':opts:' + q.id)));
  q.options = perm.map((i) => q.options[i]);
  const key = { itemId: q.id, position, correctIndex: q.options.indexOf(correctText), correctOption: correctText };
  delete q.correctIndex;       // answer material leaves the served form
  delete q.heldOut;
  return key;
});
const keyT0 = keyFor(servedT0);
const keyT1 = keyFor(servedT1);

// ---- Write outputs ----------------------------------------------------------
mkdirSync(OUT, { recursive: true });
const files = {
  'form-T0.json': JSON.stringify({ form: 'T0', seed: seedArg, items: servedT0 }, null, 2) + '\n',
  'form-T1.json': JSON.stringify({ form: 'T1', seed: seedArg, items: servedT1 }, null, 2) + '\n',
  'form-keys-T0.json': JSON.stringify({ form: 'T0', seed: seedArg, key: keyT0 }, null, 2) + '\n',
  'form-keys-T1.json': JSON.stringify({ form: 'T1', seed: seedArg, key: keyT1 }, null, 2) + '\n',
  'practice-manifest.json': JSON.stringify({
    seed: seedArg,
    note: 'Arm A practice pool. During the study the arena drill must exclude the T0/T1 item ids listed in exclude-ids.json; all other app drills are unrestricted practice.',
    itemIds: seededShuffle(practice, mulberry32(hashSeed(seedArg + ':practice'))).map((q) => q.id)
  }, null, 2) + '\n',
  'exclude-ids.json': JSON.stringify({
    seed: seedArg,
    note: 'Union of T0+T1 item ids — must be removed from arena practice for study participants. App heldOut probes are already excluded from the study bank.',
    ids: [...t0, ...t1].map((q) => q.id).sort()
  }, null, 2) + '\n',
  'form-manifest.json': JSON.stringify({
    seed: seedArg,
    source: 'data/arena_questions.json',
    eligibility: { considered: bank.length, eligible: eligible.length, excluded },
    counts: { T0: servedT0.length, T1: servedT1.length, practice: practice.length },
    strata: strataReport,
    sha256: {}
  }, null, 2) + '\n'
};
for (const [name, body] of Object.entries(files)) writeFileSync(join(OUT, name), body);

// Fill the manifest's hash section (manifest itself excluded from its own hash list).
const manifest = JSON.parse(readFileSync(join(OUT, 'form-manifest.json'), 'utf8'));
for (const name of ['form-T0.json', 'form-T1.json', 'form-keys-T0.json', 'form-keys-T1.json', 'practice-manifest.json', 'exclude-ids.json']) {
  manifest.sha256[name] = sha256(readFileSync(join(OUT, name)));
}
writeFileSync(join(OUT, 'form-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(`seed: ${seedArg}`);
console.log(`eligible ${eligible.length} (excluded: ${excluded.appHeldOut} app-heldOut, ${excluded.malformed} malformed)`);
console.log(`T0 ${servedT0.length} | T1 ${servedT1.length} | practice ${practice.length}`);
console.log('strata covered by both forms:', strataReport.filter((s) => s.t0 && s.t1).length, '/', strataReport.length);
for (const [name, h] of Object.entries(manifest.sha256)) console.log(`  ${h.slice(0, 16)}…  ${name}`);
