/**
 * SOVEREIGN // AEGIS — Phase 4 transfer study: pre-enrollment power simulation (§3)
 *
 * The protocol requires, BEFORE recruitment: "publish a simulation using the frozen
 * item counts and a range of participant/item correlations. If that simulation says
 * 400 is inadequate for 80% power at two-sided α=.05, increase enrollment before the
 * first participant."
 *
 * This script does exactly that. It simulates complete trials under the frozen form
 * sizes (T0/T1 from the hashed manifests) across:
 *   - true effects τ ∈ {15, 12, 10, 8, 5} percentage points,
 *   - participant ability clustering σ_p ∈ {0, 0.35, 0.7, 1.0} logit units
 *     (0 = no clustering; larger = stronger participant/item correlation), and
 *   - session state noise σ_s ∈ {0, 0.5} logit units — an independent per-person,
 *     per-session fluctuation (fatigue, mood, context) that deflates the T0↔T1
 *     correlation. σ_s=0 is the optimistic stable-trait limit; σ_s=0.5 is the
 *     pessimistic end of the protocol's correlation range.
 * each with the predeclared n=400 (200/arm), plus n=480 and n=560 as the pre-planned
 * larger enrollments if 400 proves inadequate. The power verdict is driven by the
 * WORST cell at the target effect, i.e. the pessimistic corner.
 *
 * Significance inside the simulation uses the normal approximation of the primary
 * estimand (two-sided z at 1.96) for speed; the confirmatory analysis remains the
 * §7 participant bootstrap. The --selftest run of analyze.mjs cross-checks that the
 * bootstrap CI width at n=400 agrees with these SEs.
 *
 * Output is a power table written to docs/transfer-study/exports/power-simulation.json
 * and printed. This is a planning artifact, not a result.
 *
 * Usage: node tools/transfer-study/power-sim.mjs [--trials 400]
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { hashSeed, mulberry32, normal, mean, sd, calibrateLogitEffect, makeItemSeverities, itemP } from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const FORMS_MANIFEST = join(ROOT, 'docs', 'transfer-study', 'forms', 'form-manifest.json');
const EXPORTS_DIR = join(ROOT, 'docs', 'transfer-study', 'exports');

const SIM_SEED = 'aegis-transfer-study-v1.0-power';
const Z = 1.959963984540054;

function formSizes() {
  if (!existsSync(FORMS_MANIFEST)) {
    console.error('forms manifest missing — run build-forms.mjs first.');
    process.exit(2);
  }
  const m = JSON.parse(readFileSync(FORMS_MANIFEST, 'utf8'));
  return { T0: m.counts.T0, T1: m.counts.T1 };
}

/**
 * Simulate one trial. Items get fixed pseudo-difficulties (same generator family as the
 * selftest); participants get N(0, σ_p) abilities. Returns τ̂ and SE(τ̂) in pp.
 */
function simulateOneTrial(rng, sizes, deltaLogit, sigmaP, sigmaS, nPerArm) {
  const sev = makeItemSeverities(sizes);
  const runArm = (treated) => {
    const d = [];
    for (let i = 0; i < nPerArm; i++) {
      const stable = normal(rng) * sigmaP;   // trait: shared across sessions
      let b = 0, bn = 0, t = 0, tn = 0;
      const state0 = normal(rng) * sigmaS;   // session state: independent per session
      const state1 = normal(rng) * sigmaS;
      for (let k = 0; k < sizes.T0; k++) {
        b += rng() < itemP(stable + state0, sev.T0[k]) ? 1 : 0; bn++;
      }
      for (let k = 0; k < sizes.T1; k++) {
        t += rng() < itemP(stable + state1, sev.T1[k], treated ? deltaLogit : 0) ? 1 : 0; tn++;
      }
      if (bn >= sizes.T0 / 2 && tn >= sizes.T1 / 2) d.push(t / tn - b / bn);
    }
    return d;
  };
  const dA = runArm(true);
  const dC = runArm(false);
  const tauHat = mean(dA) - mean(dC);
  const se = Math.sqrt(sd(dA) ** 2 / dA.length + sd(dC) ** 2 / dC.length);
  return { tauHat: tauHat * 100, se: se * 100 };
}

const args = process.argv.slice(2);
const trials = Math.max(100, parseInt(args.includes('--trials') ? args[args.indexOf('--trials') + 1] : '400', 10));

const sizes = formSizes();
const scenariosTau = [15, 12, 10, 8, 5];
const sigmas = [0, 0.35, 0.7, 1.0];
const sessionNoise = [0, 0.5];
const ns = [400, 480, 560];

const rng = mulberry32(hashSeed(SIM_SEED));
const results = [];
console.log(`frozen forms: T0=${sizes.T0} items, T1=${sizes.T1} items | ${trials} simulated trials per cell`);
console.log('power (fraction of trials with |z| > 1.96), two-sided α=.05\n');

for (const n of ns) {
  // Precompute the logit effect for each scenario ONCE per (tau, sigmaP, n-independent):
  // calibration depends only on the frozen item set and the clustering, not on n.
  const deltas = new Map();
  for (const tau of scenariosTau) {
    for (const sp of sigmas) {
      for (const ss of sessionNoise) deltas.set(`${tau}|${sp}|${ss}`, calibrateLogitEffect(tau, sizes, sp));
    }
  }
  for (const tau of scenariosTau) {
    for (const sp of sigmas) {
      for (const ss of sessionNoise) {
        const deltaLogit = deltas.get(`${tau}|${sp}|${ss}`);
        let hits = 0;
        for (let t = 0; t < trials; t++) {
          const { tauHat, se } = simulateOneTrial(rng, sizes, deltaLogit, sp, ss, n / 2);
          if (se > 0 && Math.abs(tauHat / se) > Z) hits++;
        }
        const power = hits / trials;
        results.push({ n, tau, sigmaP: sp, sigmaS: ss, logitDelta: +deltaLogit.toFixed(4), power, trials });
      }
    }
  }
  const cell = (tau, sp, ss) => results.find((r) => r.n === n && r.tau === tau && r.sigmaP === sp && r.sigmaS === ss).power;
  console.log(`n=${n} (${n / 2}/arm)`);
  for (const ss of sessionNoise) {
    console.log(`  session noise σ_s=${ss}`);
    console.log('    τ \\ σ_p   ' + sigmas.map((s) => s.toFixed(2).padStart(7)).join(''));
    for (const tau of scenariosTau) {
      console.log(`    ${String(tau).padStart(3)} pp  ` + sigmas.map((s) => (cell(tau, s, ss) * 100).toFixed(1).padStart(6) + '%').join(' '));
    }
  }
  console.log('');
}

const at400 = results.filter((r) => r.n === 400);
const minAt15 = Math.min(...at400.filter((r) => r.tau === 15).map((r) => r.power));
const verdict = minAt15 >= 0.8
  ? `n=400 MEETS the 80% power requirement at the protocol's 15 pp target across the whole clustering range (min ${(minAt15 * 100).toFixed(1)}%). Enrollment target stands.`
  : `n=400 is INADEQUATE at 15 pp under some clustering (min power ${(minAt15 * 100).toFixed(1)}%) — per §3 the enrollment target must be raised BEFORE the first participant.`;

mkdirSync(EXPORTS_DIR, { recursive: true });
const report = {
  PLANNING_ARTIFACT: 'power simulation — not a result',
  seed: SIM_SEED,
  frozenForms: sizes,
  trialsPerCell: trials,
  alpha: 0.05,
  effectModel: 'additive logit delta calibrated so the expected probability-scale gain equals the scenario tau (see lib.mjs calibrateLogitEffect)',
  cells: results,
  verdict
};
writeFileSync(join(EXPORTS_DIR, 'power-simulation.json'), JSON.stringify(report, null, 2) + '\n');
console.log(verdict);
console.log(`written: docs/transfer-study/exports/power-simulation.json`);
