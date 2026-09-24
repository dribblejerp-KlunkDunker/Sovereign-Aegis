/**
 * SOVEREIGN // AEGIS — Phase 4 transfer study: allocation sequence (protocol §2)
 *
 * Generates the 1:1 permuted-block randomization sequence for the enrollment target
 * (400 participants) BEFORE any outcome data exists, per the protocol's requirement
 * that "the allocation sequence is generated before the first participant and not
 * changed after outcome data are inspected."
 *
 * Permuted blocks of 4 (2× AEGIS, 2× control per block) keep the arms balanced
 * throughout enrollment rather than only at the end. The block order is shuffled with
 * a predeclared seed. Within blocks the two AEGIS and two control assignments are
 * ordered by the same stream, so position inside a block leaks nothing.
 *
 * The sequence is written once, hashed, and frozen. Study operators draw the next row
 * at enrollment time; nobody may reorder, regenerate, or inspect ahead of the draw.
 *
 * Usage: node tools/transfer-study/randomize.mjs [--seed <string>] [--n 400]
 * Writes docs/transfer-study/allocation.csv and allocation-manifest.json
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'docs', 'transfer-study');

/** Predeclared seed policy — same family as build-forms. Freeze before enrollment. */
const SEED = 'aegis-transfer-study-v1.0-allocation';
const N_DEFAULT = 400; // protocol §3 enrollment target

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

const args = process.argv.slice(2);
const seed = args.includes('--seed') ? args[args.indexOf('--seed') + 1] : SEED;
const n = Math.max(2, parseInt(args.includes('--n') ? args[args.indexOf('--n') + 1] : String(N_DEFAULT), 10));

if (n % 4 !== 0) {
  console.error(`n=${n} is not a multiple of the block size 4 — use a multiple of 4 so blocks stay complete.`);
  process.exit(2);
}

const rng = mulberry32(hashSeed(seed));

// One shuffled block = [A, A, C, C] in a seeded order.
const ARM_A = 'AEGIS';
const ARM_B = 'CONTROL';
const rows = [];
const blockCount = n / 4;
for (let b = 0; b < blockCount; b++) {
  const block = seededShuffle([ARM_A, ARM_A, ARM_B, ARM_B], rng);
  for (const arm of block) rows.push({ seq: rows.length + 1, block: b + 1, arm });
}

const csv = ['seq,block,arm', ...rows.map((r) => `${r.seq},${r.block},${r.arm}`)].join('\n') + '\n';
const csvHash = createHash('sha256').update(csv).digest('hex');

const balance = rows.reduce((m, r) => ((m[r.arm] = (m[r.arm] || 0) + 1), m), {});
const manifest = {
  seed,
  blockSize: 4,
  enrollmentTarget: n,
  arms: { [ARM_A]: balance[ARM_A] || 0, [ARM_B]: balance[ARM_B] || 0 },
  procedure: 'permuted blocks of 4 (2 AEGIS / 2 CONTROL), block and within-block order from the predeclared seeded stream',
  sha256: csvHash,
  generatedAt: new Date().toISOString(),
  note: 'Draw rows strictly in seq order at enrollment. Do not regenerate or reorder after outcome data are inspected.'
};

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'allocation.csv'), csv);
writeFileSync(join(OUT, 'allocation-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(`seed: ${seed}`);
console.log(`sequence: ${n} rows in ${blockCount} blocks → AEGIS ${balance[ARM_A] || 0} / CONTROL ${balance[ARM_B] || 0}`);
console.log(`allocation.csv sha256: ${csvHash.slice(0, 16)}…`);
console.log('max cumulative drift: within any prefix, arms differ by at most 2 (block size guarantees).');
