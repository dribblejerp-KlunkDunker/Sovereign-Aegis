/**
 * SOVEREIGN // AEGIS — Phase 4 transfer study: shared deterministic helpers
 *
 * Used by build-forms, randomize, analyze, power-sim and the pinned test suite so the
 * PRNG family, item-severity generator, and effect-size calibration exist exactly once.
 *
 * The calibration helper exists because "τ percentage points" is a probability-scale
 * claim while a practice effect acts on the logit scale. calibrateLogitEffect solves
 * for the logit delta whose EXPECTED accuracy shift — averaged over the frozen item
 * severities and the participant ability distribution — equals the target in pp.
 * Power scenarios and selftests must plant effects through it, never by raw logit
 * values, or the scenario label lies about its own size.
 */

/** djb2 string hash → unsigned 32-bit seed. */
export function hashSeed(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

/** mulberry32 PRNG — same family as the app's seeded shuffles. */
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const normal = (rng) => Math.sqrt(-2 * Math.log(Math.max(1e-12, rng()))) * Math.cos(2 * Math.PI * rng());
export const logistic = (x) => 1 / (1 + Math.exp(-x));
export const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
export const sd = (xs) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
};

/** Acklam's inverse normal CDF (probit), double-precision rational approximation. */
export function probit(p) {
  if (p <= 0 || p >= 1) throw new RangeError('probit: p must be in (0, 1)');
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const pl = 0.02425;
  let q, r;
  if (p < pl) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pl) return -probit(1 - p);
  q = p - 0.5; r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
         (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/**
 * Fixed pseudo item difficulties for the frozen forms, keyed `T0-<k>` / `T1-<k>`.
 * Deterministic from the session+index names; shared by simulations and selftests so
 * every component describes the same imaginary item bank.
 */
export function makeItemSeverities(sizes) {
  const sev = { T0: [], T1: [] };
  for (const s of ['T0', 'T1']) {
    for (let k = 0; k < sizes[s]; k++) sev[s].push((hashSeed(s + ':' + k) % 1000) / 1000 - 0.5);
  }
  return sev;
}

/** Response model used by every simulator: ability + item severity, 0.8 severity slope. */
export const itemP = (ability, severity, delta = 0) => logistic(ability + delta - severity * 0.8 + 0.2);

/**
 * Solve for the logit delta whose expected probability-scale gain equals targetPp.
 * Expected over the frozen T1 item severities and a deterministic quantile grid of
 * N(0, sigmaP) abilities. Monotone in delta → bisection. Returns logits.
 */
export function calibrateLogitEffect(targetPp, sizes, sigmaP) {
  const sev = makeItemSeverities(sizes);
  const Q = 199;
  const abilities = sigmaP === 0
    ? [0]
    : Array.from({ length: Q }, (_, i) => sigmaP * probit((i + 0.5) / Q));
  const shift = (delta) => {
    let acc = 0, cnt = 0;
    for (const a of abilities) {
      for (const s of sev.T1) {
        acc += itemP(a, s, delta) - itemP(a, s, 0);
        cnt++;
      }
    }
    return acc / cnt;
  };
  const target = targetPp / 100;
  let lo = 0, hi = 5;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (shift(mid) < target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
