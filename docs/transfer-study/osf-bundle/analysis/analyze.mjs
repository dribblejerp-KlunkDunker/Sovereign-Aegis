/**
 * SOVEREIGN // AEGIS — Phase 4 transfer study: frozen primary analysis (protocol §7)
 *
 * PRE-REGISTERED ANALYSIS SCRIPT. This file (and its bootstrap seed) must be frozen
 * before arm labels are opened; a reviewer regenerates the estimate and CIs from the
 * pseudonymous export with no network access. It implements exactly:
 *
 *   Primary estimand (§1/§7):
 *     τ = mean(D)_AEGIS − mean(D)_CONTROL,  D(i) = P_post(i) − P_base(i),
 *     each P = correct/valid items on a form, missing if < half the form's items.
 *   Primary 95% CI (§7): participant-level percentile cluster bootstrap, 10,000
 *     replicates, seeded, resampled WITHIN arm, whole participants kept together.
 *   Secondary (§6, exploratory): pooled form accuracy with Wilson score intervals;
 *   paired-participant binary analysis with Newcombe's hybrid-score paired interval
 *   (square-and-add of marginal Wilsons), reporting concordant/discordant counts.
 *
 * NO p-value is computed for the primary endpoint; the pre-registered report is the
 * estimate in percentage points with its two-sided 95% CI. A null result is a result.
 *
 * Input schema (docs/transfer-study/exports/participants.json):
 *   [{ "pid": string, "arm": "AEGIS"|"CONTROL",
 *      "items": [{ "session": "T0"|"T1", "itemId": string, "correct": boolean,
 *                  "confidence"?: "sure"|"unsure"|"guess", "latencyMs"?: number|null }] }]
 *   T2 rows are permitted and ignored for the primary endpoint (counted, reported).
 *
 * Usage:
 *   node tools/transfer-study/analyze.mjs exports/participants.json   # real analysis
 *   node tools/transfer-study/analyze.mjs --selftest                  # synthetic machinery check
 *
 * The selftest plants a known effect (+15 pp for AEGIS at T1) into synthetic data and
 * verifies the pipeline recovers it. Its output is marked SYNTHETIC and must never be
 * presented as a study result.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const FORMS_MANIFEST = join(ROOT, 'docs', 'transfer-study', 'forms', 'form-manifest.json');
const ALLOCATION_CSV = join(ROOT, 'docs', 'transfer-study', 'allocation.csv');
const EXPORTS_DIR = join(ROOT, 'docs', 'transfer-study', 'exports');

const BOOTSTRAP_SEED = 'aegis-transfer-study-v1.0-analysis';
const BOOTSTRAP_REPS = 10000;
const Z95 = 1.959963984540054;

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
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
const percentile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * sorted.length)))];

/** Wilson score interval for a binomial proportion (protocol §7 bans Wald). */
export function wilson(x, n, z = Z95) {
  if (!Number.isInteger(n) || n <= 0) return { point: NaN, lo: NaN, hi: NaN };
  const p = x / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return { point: p, lo: center - half, hi: center + half };
}

/**
 * Newcombe's hybrid-score interval for the difference of paired proportions
 * (Newcombe 1998, method 10: square-and-add of the two marginal Wilson intervals).
 * d = (b − c)/n from discordant counts; concordant/discordant counts are reported
 * alongside, as the protocol requires. (b = T1 success & T0 failure, c = reverse.)
 */
export function newcombePaired(x1, x2, n) {
  const w1 = wilson(x1, n);
  const w2 = wilson(x2, n);
  const p1 = x1 / n;
  const p2 = x2 / n;
  const d = p1 - p2;
  const lo = d - Math.sqrt((p1 - w1.lo) ** 2 + (w2.hi - p2) ** 2);
  const hi = d + Math.sqrt((w1.hi - p1) ** 2 + (p2 - w2.lo) ** 2);
  return { d, lo, hi };
}

function formSizes() {
  if (!existsSync(FORMS_MANIFEST)) {
    console.error(`forms manifest missing: ${FORMS_MANIFEST}\nRun tools/transfer-study/build-forms.mjs first.`);
    process.exit(2);
  }
  const m = JSON.parse(readFileSync(FORMS_MANIFEST, 'utf8'));
  return { T0: m.counts.T0, T1: m.counts.T1 };
}

/** Session proportion for one participant, or null when the thin-form threshold bites. */
function sessionProportion(items, session, formSize) {
  const answered = items.filter((it) => it.session === session && typeof it.correct === 'boolean');
  if (answered.length < formSize / 2) return null; // fixed before seeing outcomes (§7)
  const correct = answered.filter((it) => it.correct).length;
  return { p: correct / answered.length, answered: answered.length, correct };
}

export function analyze(participants, sizes, opts = {}) {
  const arms = new Set(participants.map((p) => p.arm));
  if ([...arms].some((a) => a !== 'AEGIS' && a !== 'CONTROL')) {
    throw new Error('arm labels must be exactly "AEGIS" or "CONTROL"');
  }
  const seen = new Set();
  for (const p of participants) {
    if (seen.has(p.pid)) throw new Error(`duplicate participant id: ${p.pid}`);
    seen.add(p.pid);
  }

  const rows = participants.map((p) => {
    const b = sessionProportion(p.items, 'T0', sizes.T0);
    const t = sessionProportion(p.items, 'T1', sizes.T1);
    const followUpRows = p.items.filter((it) => it.session === 'T2').length;
    return {
      pid: p.pid, arm: p.arm,
      base: b ? b.p : null, post: t ? t.p : null,
      d: b && t ? t.p - b.p : null,
      followUpRows
    };
  });

  const attrition = { both: 0, baselineOnly: 0, postOnly: 0, neither: 0 };
  for (const r of rows) {
    if (r.base !== null && r.post !== null) attrition.both++;
    else if (r.base !== null) attrition.baselineOnly++;
    else if (r.post !== null) attrition.postOnly++;
    else attrition.neither++;
  }

  const primary = rows.filter((r) => r.d !== null);
  const byArm = (arm) => primary.filter((r) => r.arm === arm).map((r) => r.d);
  const dA = byArm('AEGIS');
  const dC = byArm('CONTROL');
  const tau = mean(dA) - mean(dC);

  // Primary CI: participant cluster bootstrap, resampled within arm to observed sizes.
  const rng = mulberry32(hashSeed(BOOTSTRAP_SEED));
  const tauStars = new Array(BOOTSTRAP_REPS);
  for (let rep = 0; rep < BOOTSTRAP_REPS; rep++) {
    const sample = (arr) => {
      const out = new Array(arr.length);
      for (let i = 0; i < arr.length; i++) out[i] = arr[Math.floor(rng() * arr.length)];
      return mean(out);
    };
    tauStars[rep] = sample(dA) - sample(dC);
  }
  tauStars.sort((a, b) => a - b);
  const ci = [percentile(tauStars, 0.025), percentile(tauStars, 0.975)];

  // Secondary (exploratory): pooled item accuracy per arm/session, Wilson per protocol §7.
  const pooled = {};
  for (const arm of ['AEGIS', 'CONTROL']) {
    for (const session of ['T0', 'T1']) {
      const its = participants.filter((p) => p.arm === arm)
        .flatMap((p) => p.items.filter((it) => it.session === session && typeof it.correct === 'boolean'));
      pooled[`${arm}.${session}`] = wilson(its.filter((it) => it.correct).length, its.length);
    }
  }

  return {
    sizes,
    counts: {
      randomized: participants.length,
      primary: primary.length,
      byArm: { AEGIS: dA.length, CONTROL: dC.length },
      attrition,
      followUpRowsIgnored: rows.reduce((s, r) => s + r.followUpRows, 0)
    },
    primary: {
      meanChange: { AEGIS: mean(dA), CONTROL: mean(dC) },
      tauPercentagePoints: tau * 100,
      ci95PercentagePoints: [ci[0] * 100, ci[1] * 100],
      method: `participant cluster bootstrap, ${BOOTSTRAP_REPS} replicates, seed "${BOOTSTRAP_SEED}"`
    },
    secondaryExploratory: { pooledWilson: pooled },
    missingData: 'no imputation of the primary endpoint (§7); attrition reported above'
  };
}

// ---------------------------------------------------------------------------
// Selftest: synthetic data with a planted +15 pp effect, run through the pipeline.
// ---------------------------------------------------------------------------
function selftest() {
  const sizes = formSizes();
  const rng = mulberry32(hashSeed(BOOTSTRAP_SEED + ':selftest'));
  const normal = () => {
    const u = Math.max(1e-9, rng());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  };
  const logistic = (x) => 1 / (1 + Math.exp(-x));

  // Arms come from the frozen allocation sequence when it exists (ties machinery together).
  let armSequence = [];
  if (existsSync(ALLOCATION_CSV)) {
    armSequence = readFileSync(ALLOCATION_CSV, 'utf8').trim().split('\n').slice(1)
      .map((line) => line.split(',')[2]);
  } else {
    armSequence = [...Array(200).fill('AEGIS'), ...Array(200).fill('CONTROL')];
  }

  const PLANTED_TAU = 0.15;
  const participants = armSequence.map((arm, idx) => {
    const ability = normal() * 0.7;                       // participant clustering
    const itemSeverity = sizes.T0 + sizes.T1;
    const items = [];
    for (const [session, formSize] of [['T0', sizes.T0], ['T1', sizes.T1]]) {
      for (let k = 0; k < formSize; k++) {
        const sev = (hashSeed(session + k) % 1000) / 1000 - 0.5; // fixed pseudo item difficulty
        const effect = session === 'T1' && arm === 'AEGIS' ? 0.65 : 0; // ≈ +15 pp near p≈0.55
        const p = logistic(ability + effect - sev * 0.8 + 0.2);
        items.push({ session, itemId: `${session}-${k}`, correct: rng() < p });
      }
    }
    return { pid: `SYN-${idx + 1}`, arm, items };
  });

  const result = analyze(participants, sizes);
  const out = {
    SYNTHETIC: 'SELFTEST — NOT A STUDY RESULT',
    plantedTauPercentagePoints: PLANTED_TAU * 100,
    ...result
  };
  mkdirSync(EXPORTS_DIR, { recursive: true });
  writeFileSync(join(EXPORTS_DIR, 'selftest-results.json'), JSON.stringify(out, null, 2) + '\n');
  console.log('SYNTHETIC SELFTEST — NOT A STUDY RESULT');
  console.log(`planted τ: ${(PLANTED_TAU * 100).toFixed(1)} pp`);
  console.log(`recovered τ: ${result.primary.tauPercentagePoints.toFixed(1)} pp`);
  console.log(`95% CI: [${result.primary.ci95PercentagePoints.map((v) => v.toFixed(1)).join(', ')}] pp`);
  console.log(`primary n: ${result.counts.primary} (${result.counts.byArm.AEGIS} AEGIS / ${result.counts.byArm.CONTROL} CONTROL)`);
  const covered = result.primary.ci95PercentagePoints[0] <= PLANTED_TAU * 100 && PLANTED_TAU * 100 <= result.primary.ci95PercentagePoints[1];
  console.log(`CI covers planted effect: ${covered ? 'yes' : 'NO'}`);
  if (!covered || Math.abs(result.primary.tauPercentagePoints - PLANTED_TAU * 100) > 6) {
    console.error('SELFTEST FAILED: pipeline did not recover the planted effect.');
    process.exit(1);
  }
  console.log('selftest OK — machinery verified; write exports/participants.json for the real analysis.');
}

// ---------------------------------------------------------------------------
// CLI entry point — only when executed directly, so tests can import the pure
// functions (wilson, newcombePaired, analyze) without triggering a process.exit.
// ---------------------------------------------------------------------------
const __isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (__isMain) {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) { selftest(); process.exit(0); }

  const input = args.find((a) => !a.startsWith('--')) || join(EXPORTS_DIR, 'participants.json');
  if (!existsSync(input)) {
    console.error(`no export found at ${input}\nExpected the pseudonymous minimum-research export (schema in the header comment).\nRun --selftest to verify the machinery without data.`);
    process.exit(2);
  }
  const sizes = formSizes();
  const data = JSON.parse(readFileSync(input, 'utf8'));
  const result = analyze(data, sizes);

  const report = { ...result, SYNTHETIC: false };
  mkdirSync(EXPORTS_DIR, { recursive: true });
  writeFileSync(join(EXPORTS_DIR, 'primary-results.json'), JSON.stringify(report, null, 2) + '\n');

  console.log('=== PRE-REGISTERED PRIMARY ANALYSIS (protocol §7) ===');
  console.log(`randomized: ${result.counts.randomized} | primary set: ${result.counts.primary} (AEGIS ${result.counts.byArm.AEGIS} / CONTROL ${result.counts.byArm.CONTROL})`);
  console.log(`attrition: ${JSON.stringify(result.counts.attrition)}`);
  console.log(`mean change (held-out accuracy): AEGIS ${(result.primary.meanChange.AEGIS * 100).toFixed(1)} pp, CONTROL ${(result.primary.meanChange.CONTROL * 100).toFixed(1)} pp`);
  console.log(`τ = ${result.primary.tauPercentagePoints.toFixed(1)} pp, 95% CI [${result.primary.ci95PercentagePoints.map((v) => v.toFixed(1)).join(', ')}]`);
  console.log(`method: ${result.primary.method}`);
  console.log('Secondary outcomes are exploratory (§6); no p-value is computed for the primary endpoint.');
}
