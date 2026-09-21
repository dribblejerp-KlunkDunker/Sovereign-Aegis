/**
 * SOVEREIGN // AEGIS — Test Suite: DSP primitives (js/dsp.js)
 *
 * These assertions are the reason this module is trustworthy. The previous "FFT" and
 * "spectrogram" were drawn rather than computed, and no test could have caught that
 * because nothing was being computed to check. Here every claim is verified against a
 * signal whose spectrum is known analytically:
 *
 *   - DC input        -> all energy in bin 0, nothing elsewhere
 *   - pure sinusoid   -> single peak at the expected bin, correct amplitude
 *   - two sinusoids   -> two peaks, correct relative amplitudes
 *   - impulse         -> flat spectrum (all bins equal)
 *   - Parseval        -> energy preserved between time and frequency domains
 *   - round-trip      -> inverse(forward(x)) == x
 *
 * Zero external runtime dependencies.
 */

import {
  fft, magnitudeSpectrum, hannWindow, fft2dPowerSpectrum,
  detectSpectralPeaks, spectrogram, spectralFeatures, detectBrickwallCutoff
} from '../js/dsp.js';

class TestHarness {
  constructor(name) {
    this.suiteName = name; this.totalAssertions = 0; this.passed = 0;
    this.failed = 0; this.failures = []; this.currentSuite = '';
  }
  describe(name, fn) { this.currentSuite = name; console.log(`\n  --- ${name} ---`); return fn(); }
  async it(name, fn) {
    try { await fn(); } catch (err) {
      this.failed++; this.totalAssertions++;
      this.failures.push({ suite: this.currentSuite, test: name, error: err.message });
      console.error(`  ✗ [FAIL] ${name} (${err.message})`);
    }
  }
  assert(cond, msg) {
    this.totalAssertions++;
    if (cond) { this.passed++; console.log(`    ✓ ${msg}`); }
    else { this.failed++; this.failures.push({ suite: this.currentSuite, test: msg, error: 'Assertion failed' }); console.error(`    ✗ [FAIL] ${msg}`); }
  }
  assertClose(actual, expected, tol, msg) {
    this.assert(Math.abs(actual - expected) <= tol, `${msg} | got ${actual.toFixed(6)}, expected ${expected} ±${tol}`);
  }
  summary() {
    console.log('\n====================================================');
    console.log(`[${this.suiteName}] Summary: ${this.passed}/${this.totalAssertions} Passed (${this.failed} Failed)`);
    console.log('====================================================');
    if (this.failed > 0) {
      console.error('\nFailure Details:');
      this.failures.forEach(f => console.error(` - [${f.suite}] ${f.test}: ${f.error}`));
      process.exitCode = 1;
    }
    return { passed: this.passed, failed: this.failed, total: this.totalAssertions };
  }
}

const harness = new TestHarness('DSP: FFT / 2D FFT / Spectrogram Suite');

async function runTests() {
  // ------------------------------------------------------------------ 1D FFT
  await harness.describe('Tier 1: 1D FFT against analytically known spectra', async () => {
    await harness.it('DC signal puts all energy in bin 0', () => {
      const N = 64;
      const x = new Float64Array(N).fill(1);
      const mag = magnitudeSpectrum(x);
      harness.assertClose(mag[0], N, 1e-9, 'bin 0 magnitude equals N for unit DC');
      let restMax = 0;
      for (let i = 1; i < mag.length; i++) restMax = Math.max(restMax, mag[i]);
      harness.assert(restMax < 1e-9, `all non-DC bins are ~0 (max ${restMax.toExponential(2)})`);
    });

    await harness.it('Pure sinusoid produces one peak at the correct bin', () => {
      const N = 256;
      const k = 16; // exactly k cycles across the window -> energy lands in bin k
      const x = new Float64Array(N);
      for (let i = 0; i < N; i++) x[i] = Math.sin((2 * Math.PI * k * i) / N);
      const mag = magnitudeSpectrum(x);
      let peakBin = 0;
      for (let i = 1; i < mag.length; i++) if (mag[i] > mag[peakBin]) peakBin = i;
      harness.assert(peakBin === k, `peak is at bin ${k} (got ${peakBin})`);
      // amplitude 1 sinusoid -> N/2 in its bin
      harness.assertClose(mag[k], N / 2, 1e-6, 'peak magnitude equals N/2 for unit-amplitude sine');
      harness.assert(mag[k / 2] < 1e-6, 'no spurious energy at half the peak frequency');
    });

    await harness.it('Two sinusoids produce two peaks with correct relative amplitude', () => {
      const N = 512;
      const x = new Float64Array(N);
      for (let i = 0; i < N; i++) {
        x[i] = 1.0 * Math.sin((2 * Math.PI * 20 * i) / N)
             + 0.5 * Math.sin((2 * Math.PI * 70 * i) / N);
      }
      const mag = magnitudeSpectrum(x);
      harness.assertClose(mag[20], N / 2, 1e-5, 'first component magnitude');
      harness.assertClose(mag[70], N / 4, 1e-5, 'second component is half the amplitude');
      harness.assert(mag[20] > mag[70] * 1.9, 'amplitude ordering preserved');
    });

    await harness.it('Unit impulse produces a flat spectrum', () => {
      const N = 128;
      const x = new Float64Array(N);
      x[0] = 1;
      const mag = magnitudeSpectrum(x);
      let min = Infinity, max = 0;
      for (const m of mag) { min = Math.min(min, m); max = Math.max(max, m); }
      harness.assertClose(max - min, 0, 1e-9, 'all bins equal for an impulse (flat spectrum)');
      harness.assertClose(max, 1, 1e-9, 'flat magnitude equals 1');
    });

    await harness.it("Parseval's theorem holds (energy is conserved)", () => {
      const N = 256;
      const re = new Float64Array(N);
      const im = new Float64Array(N);
      for (let i = 0; i < N; i++) re[i] = Math.sin(i * 0.37) + 0.3 * Math.cos(i * 1.11);
      let timeEnergy = 0;
      for (let i = 0; i < N; i++) timeEnergy += re[i] * re[i];
      fft(re, im);
      let freqEnergy = 0;
      for (let i = 0; i < N; i++) freqEnergy += re[i] * re[i] + im[i] * im[i];
      harness.assertClose(freqEnergy / N, timeEnergy, 1e-6, 'sum|X[k]|^2 / N == sum|x[n]|^2');
    });

    await harness.it('Inverse FFT round-trips exactly', () => {
      const N = 128;
      const orig = new Float64Array(N);
      for (let i = 0; i < N; i++) orig[i] = Math.sin(i * 0.21) * 3 - 0.5;
      const re = Float64Array.from(orig);
      const im = new Float64Array(N);
      fft(re, im, false);
      fft(re, im, true);
      let maxErr = 0;
      for (let i = 0; i < N; i++) maxErr = Math.max(maxErr, Math.abs(re[i] - orig[i]));
      harness.assert(maxErr < 1e-9, `round-trip error is negligible (${maxErr.toExponential(2)})`);
    });

    await harness.it('Rejects non-power-of-two lengths instead of returning garbage', () => {
      let threw = false;
      try { fft(new Float64Array(100), new Float64Array(100)); } catch { threw = true; }
      harness.assert(threw, 'throws on length 100');
    });

    await harness.it('Hann window has the expected shape', () => {
      const w = hannWindow(64);
      harness.assertClose(w[0], 0, 1e-12, 'starts at 0');
      harness.assertClose(w[32], 1, 1e-12, 'peaks at 1 in the centre');
      let sum = 0; for (const v of w) sum += v;
      harness.assertClose(sum / 64, 0.5, 1e-12, 'mean is 0.5');
    });
  });

  // ------------------------------------------------------------------ 2D FFT
  await harness.describe('Tier 2: 2D FFT power spectrum', async () => {
    await harness.it('Uniform plane concentrates all energy at the centre (DC after shift)', () => {
      const size = 32;
      const plane = new Float64Array(size * size).fill(128);
      const { spectrum } = fft2dPowerSpectrum(plane, size);
      const c = size >> 1;
      harness.assertClose(spectrum[c * size + c], 1, 1e-12, 'centre bin is the normalised maximum');
      let offMax = 0;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        if (x === c && y === c) continue;
        offMax = Math.max(offMax, spectrum[y * size + x]);
      }
      harness.assert(offMax < 1e-6, `no off-centre energy for a flat plane (max ${offMax.toExponential(2)})`);
    });

    await harness.it('A vertical sinusoidal grating produces symmetric off-centre peaks', () => {
      const size = 64;
      const plane = new Float64Array(size * size);
      const k = 8;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        plane[y * size + x] = 128 + 100 * Math.sin((2 * Math.PI * k * x) / size);
      }
      const { spectrum } = fft2dPowerSpectrum(plane, size);
      const c = size >> 1;
      const left = spectrum[c * size + (c - k)];
      const right = spectrum[c * size + (c + k)];
      harness.assert(left > 0.3 && right > 0.3, `both conjugate peaks present (${left.toFixed(3)}, ${right.toFixed(3)})`);
      harness.assertClose(left, right, 1e-6, 'peaks are symmetric about DC (Hermitian symmetry)');
      const offAxis = spectrum[(c + k) * size + c];
      harness.assert(offAxis < left * 0.1, 'energy is on the horizontal axis only, as expected for vertical bars');
    });

    await harness.it('Rejects non-power-of-two sizes', () => {
      let threw = false;
      try { fft2dPowerSpectrum(new Float64Array(30 * 30), 30); } catch { threw = true; }
      harness.assert(threw, 'throws on size 30');
    });

    await harness.it('detectSpectralPeaks flags a synthetic grating and clears smooth noise', () => {
      const size = 64;
      // periodic grating -> should flag
      const grating = new Float64Array(size * size);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        grating[y * size + x] = 128 + 90 * Math.sin((2 * Math.PI * 12 * x) / size);
      }
      const g = fft2dPowerSpectrum(grating, size);
      const gp = detectSpectralPeaks(g.spectrum, size);
      harness.assert(gp.periodicPeaks, `grating flagged as periodic (ratio ${gp.peakRatio.toFixed(2)})`);

      // smooth radial gradient -> should NOT flag
      const smooth = new Float64Array(size * size);
      const c = size / 2;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        smooth[y * size + x] = 200 - Math.hypot(x - c, y - c) * 2;
      }
      const s = fft2dPowerSpectrum(smooth, size);
      const sp = detectSpectralPeaks(s.spectrum, size);
      harness.assert(gp.peakRatio > sp.peakRatio, `grating scores higher than smooth image (${gp.peakRatio.toFixed(2)} > ${sp.peakRatio.toFixed(2)})`);
      harness.assert(gp.radialProfile.length > 8, 'radial profile is populated');
    });
  });

  // ------------------------------------------------------------------ STFT
  await harness.describe('Tier 3: Spectrogram (STFT) from real samples', async () => {
    const SR = 16000;

    await harness.it('A steady tone yields a stable peak at the right frequency', () => {
      const dur = 0.5;
      const n = Math.floor(SR * dur);
      const freq = 1000;
      const x = new Float64Array(n);
      for (let i = 0; i < n; i++) x[i] = Math.sin((2 * Math.PI * freq * i) / SR);

      const spec = spectrogram(x, { fftSize: 1024, hop: 256 });
      harness.assert(spec.frames.length > 5, `produced ${spec.frames.length} frames`);
      harness.assert(spec.bins === 513, 'bin count is fftSize/2+1');

      const hzPerBin = (SR / 2) / (spec.bins - 1);
      const expectedBin = Math.round(freq / hzPerBin);
      const mid = spec.frames[Math.floor(spec.frames.length / 2)];
      let peak = 0;
      for (let b = 1; b < mid.length; b++) if (mid[b] > mid[peak]) peak = b;
      harness.assert(Math.abs(peak - expectedBin) <= 2, `peak bin ${peak} matches expected ${expectedBin} for 1 kHz`);
    });

    await harness.it('Values are normalised into [0,1]', () => {
      const n = 8192;
      const x = new Float64Array(n);
      for (let i = 0; i < n; i++) x[i] = Math.sin(i * 0.05) * 0.8;
      const spec = spectrogram(x, { fftSize: 512, hop: 128 });
      let lo = Infinity, hi = -Infinity;
      for (const fr of spec.frames) for (const v of fr) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      harness.assert(lo >= 0 && hi <= 1, `range is within [0,1] (${lo.toFixed(3)}..${hi.toFixed(3)})`);
    });

    await harness.it('Long input is decimated to the frame cap, not truncated', () => {
      const n = SR * 30; // 30 seconds
      const x = new Float64Array(n);
      for (let i = 0; i < n; i++) x[i] = Math.sin(i * 0.01);
      const spec = spectrogram(x, { fftSize: 1024, hop: 256, maxFrames: 200 });
      harness.assert(spec.frames.length <= 200, `frame count capped (${spec.frames.length})`);
      harness.assert(spec.frames.length > 100, 'still covers the file with useful resolution');
      harness.assert(spec.hop > 256, `hop widened to span the whole file (${spec.hop})`);
    });

    await harness.it('spectralFeatures separates band-limited from full-band audio', () => {
      const n = SR * 2;
      // full-band: broadband noise
      const wide = new Float64Array(n);
      let seed = 12345;
      const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff) * 2 - 1; };
      for (let i = 0; i < n; i++) wide[i] = rand() * 0.5;
      const wf = spectralFeatures(spectrogram(wide, { fftSize: 1024, hop: 512 }), SR);

      // band-limited: a low tone only, i.e. a hard shelf well below Nyquist
      const narrow = new Float64Array(n);
      for (let i = 0; i < n; i++) narrow[i] = Math.sin((2 * Math.PI * 300 * i) / SR) * 0.5;
      const nf = spectralFeatures(spectrogram(narrow, { fftSize: 1024, hop: 512 }), SR);

      harness.assert(wf.hfRolloffRatio > nf.hfRolloffRatio,
        `broadband carries more HF energy (${wf.hfRolloffRatio.toFixed(4)} > ${nf.hfRolloffRatio.toFixed(4)})`);
      harness.assert(wf.spectralFlatness > nf.spectralFlatness,
        `noise is spectrally flatter than a tone (${wf.spectralFlatness.toFixed(4)} > ${nf.spectralFlatness.toFixed(4)})`);
      harness.assert(nf.bandEdgeHz < SR / 2, `band edge detected below Nyquist (${nf.bandEdgeHz} Hz)`);
      harness.assert(wf.frameCount > 0 && nf.frameCount > 0, 'frame counts reported');
    });

    await harness.it('Empty input degrades safely rather than throwing', () => {
      const spec = spectrogram(new Float64Array(0), { fftSize: 256 });
      harness.assert(spec.frames.length === 0, 'no frames for empty input');
      const f = spectralFeatures(spec, SR);
      harness.assert(f.frameCount === 0 && f.hfRolloffRatio === 0, 'features return zeroed, not NaN');
    });
  });

  // ------------------------------------------------------------------ Brickwall Cutoff Detection
  await harness.describe('Tier 4: Automated Brickwall Cutoff Detection (8 kHz & 16 kHz)', async () => {
    const SR_44K = 44100;
    const SR_48K = 48000;

    await harness.it('Full-bandwidth signal clears all cutoff flags', () => {
      const n = SR_44K * 1;
      const x = new Float64Array(n);
      let seed = 42;
      const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff) * 2 - 1; };
      for (let i = 0; i < n; i++) x[i] = rand() * 0.4;

      const spec = spectrogram(x, { fftSize: 1024, hop: 512 });
      const cutoff = detectBrickwallCutoff(spec, SR_44K);

      harness.assert(!cutoff.brickwallDetected, 'no brickwall detected on broadband noise');
      harness.assert(!cutoff.is8kHzCutoff, '8 kHz flag is false');
      harness.assert(!cutoff.is16kHzCutoff, '16 kHz flag is false');
      harness.assert(cutoff.cutoffType === 'none', 'cutoffType is none');
    });

    await harness.it('Detects 16 kHz neural vocoder cutoff shelf with steep attenuation', () => {
      // Synthesize signal with rich harmonics up to 16.0 kHz and zero energy above
      const n = SR_44K * 1;
      const x = new Float64Array(n);
      const f0 = 150;
      for (let i = 0; i < n; i++) {
        const t = i / SR_44K;
        let s = 0;
        for (let h = 1; h * f0 < 16000; h++) {
          s += (1.0 / Math.sqrt(h)) * Math.sin(2 * Math.PI * (h * f0) * t);
        }
        x[i] = s * 0.1;
      }

      const spec = spectrogram(x, { fftSize: 1024, hop: 256 });
      const cutoff = detectBrickwallCutoff(spec, SR_44K);

      harness.assert(cutoff.brickwallDetected, 'brickwall detected on 16 kHz limited signal');
      harness.assert(cutoff.is16kHzCutoff, '16 kHz vocoder flag is true');
      harness.assert(!cutoff.is8kHzCutoff, '8 kHz flag is false');
      harness.assert(cutoff.cutoffType === '16kHz_neural_vocoder', `cutoffType is 16kHz_neural_vocoder (got ${cutoff.cutoffType})`);
      harness.assert(cutoff.cutoffHz >= 15000 && cutoff.cutoffHz <= 16500, `cutoff frequency in 16 kHz window (${cutoff.cutoffHz} Hz)`);
      harness.assert(cutoff.attenuationDb >= 15, `measured drop >= 15 dB (${cutoff.attenuationDb} dB)`);
      harness.assert(cutoff.steepnessDbPerOctave > 0, `steepness reported (${cutoff.steepnessDbPerOctave} dB/oct)`);
    });

    await harness.it('Detects 8 kHz telephony / legacy voice-cloning cutoff shelf', () => {
      // Synthesize signal with harmonics strictly up to 8.0 kHz
      const n = SR_44K * 1;
      const x = new Float64Array(n);
      const f0 = 150;
      for (let i = 0; i < n; i++) {
        const t = i / SR_44K;
        let s = 0;
        for (let h = 1; h * f0 < 8000; h++) {
          s += (1.0 / Math.sqrt(h)) * Math.sin(2 * Math.PI * (h * f0) * t);
        }
        x[i] = s * 0.1;
      }

      const spec = spectrogram(x, { fftSize: 1024, hop: 256 });
      const cutoff = detectBrickwallCutoff(spec, SR_44K);

      harness.assert(cutoff.brickwallDetected, 'brickwall detected on 8 kHz limited signal');
      harness.assert(cutoff.is8kHzCutoff, '8 kHz cloner flag is true');
      harness.assert(!cutoff.is16kHzCutoff, '16 kHz flag is false');
      harness.assert(cutoff.cutoffType === '8kHz_legacy_cloner', `cutoffType is 8kHz_legacy_cloner (got ${cutoff.cutoffType})`);
      harness.assert(cutoff.cutoffHz >= 7400 && cutoff.cutoffHz <= 8400, `cutoff frequency in 8 kHz window (${cutoff.cutoffHz} Hz)`);
      harness.assert(cutoff.attenuationDb >= 15, `measured drop >= 15 dB (${cutoff.attenuationDb} dB)`);
    });

    await harness.it('Detects 4 kHz narrowband telephony cutoff at 48 kHz container rate', () => {
      // PSTN / G.711 telephony audio upsampled into 48 kHz container
      const n = SR_48K * 1;
      const x = new Float64Array(n);
      const f0 = 120;
      for (let i = 0; i < n; i++) {
        const t = i / SR_48K;
        let s = 0;
        for (let h = 1; h * f0 < 3800; h++) {
          s += (1.0 / Math.sqrt(h)) * Math.sin(2 * Math.PI * (h * f0) * t);
        }
        x[i] = s * 0.1;
      }

      const spec = spectrogram(x, { fftSize: 1024, hop: 256 });
      const cutoff = detectBrickwallCutoff(spec, SR_48K);

      harness.assert(cutoff.brickwallDetected, 'brickwall detected on 3.8 kHz telephony signal');
      harness.assert(cutoff.is8kHzCutoff, 'classified under 8kHz telephony/cloner banner');
      harness.assert(cutoff.cutoffType === '8kHz_legacy_cloner', 'cutoffType is 8kHz_legacy_cloner');
    });

    await harness.it('detectBrickwallCutoff handles degenerate/empty inputs safely', () => {
      const empty1 = detectBrickwallCutoff(null, 44100);
      harness.assert(!empty1.brickwallDetected && empty1.cutoffType === 'none', 'null spec handled');

      const empty2 = detectBrickwallCutoff({ frames: [], bins: 513 }, 44100);
      harness.assert(!empty2.brickwallDetected && empty2.cutoffHz === 0, 'empty frames handled');

      const empty3 = detectBrickwallCutoff({ frames: [new Float64Array(4)], bins: 4 }, 44100);
      harness.assert(!empty3.brickwallDetected, 'too few bins handled');

      const empty4 = detectBrickwallCutoff({ frames: [new Float64Array(513)], bins: 513 }, 0);
      harness.assert(!empty4.brickwallDetected, 'zero sampleRate handled');
    });

    await harness.it('spectralFeatures includes cutoff analysis in returned object', () => {
      const n = SR_44K * 1;
      const x = new Float64Array(n);
      for (let i = 0; i < n; i++) x[i] = Math.sin(2 * Math.PI * 440 * i / SR_44K) * 0.5;

      const spec = spectrogram(x, { fftSize: 512, hop: 256 });
      const feat = spectralFeatures(spec, SR_44K);

      harness.assert(typeof feat.cutoff === 'object' && feat.cutoff !== null, 'cutoff property present');
      harness.assert(typeof feat.cutoff.brickwallDetected === 'boolean', 'brickwallDetected is boolean');
      harness.assert(typeof feat.cutoff.attenuationDb === 'number', 'attenuationDb is number');
      harness.assert(typeof feat.cutoff.notes === 'string', 'notes is string');
    });
  });

  return harness.summary();
}

runTests().then(result => {
  if (result.failed > 0) process.exitCode = 1;
});
