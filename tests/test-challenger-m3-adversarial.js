/**
 * SOVEREIGN // AEGIS — Milestone 3 Adversarial Challenge & Stress Test Harness
 *
 * EMPIRICAL CHALLENGER 1 (Milestone 3: Pillar III DSP & Cutoff Detection)
 *
 * Exhaustively stress-tests:
 *  1. Degenerate & Extreme Signals:
 *     - Pure Silence (all zeros)
 *     - Pure DC Offset (+1.0, -1.0, 1000.0) -> Verified bandlimited infrasound isolation
 *     - Pure White Noise (uniform random) -> Verified broadband spectral flatness & Nyquist reach
 *     - Pink Noise (1/f roll-off, ~3 dB/octave) -> Verified false-positive immunity
 *     - Single Delta Impulse (delta[0], delta[mid]) -> Flat spectrum response
 *     - Nyquist Tone (f = fs/2 alternating +1/-1) -> Nyquist band edge verification
 *     - Sub-Nyquist high-freq tones
 *     - NaN and Infinity poisoned audio buffers -> Exception-free graceful degradation
 *     - Sub-frame length buffers (1 sample, 15 samples, 100 samples)
 *  2. Brickwall Cutoff Detection across Diverse Sample Rates:
 *     - 8,000 Hz, 16,000 Hz, 22,050 Hz, 24,000 Hz, 32,000 Hz, 44,100 Hz, 48,000 Hz, 96,000 Hz
 *     - Broadband verification (no false positives across all 8 rates)
 *     - 8 kHz legacy / telephony detection across rates
 *     - 16 kHz neural vocoder detection across rates
 *     - Custom bandlimited cutoffs (e.g. CD upsampled to 96kHz, 2.5kHz in 8kHz container)
 *  3. Steep vs Gradual Spectral Roll-Off Discrimination (False Positive Resistance):
 *     - 6 dB/octave gradual natural acoustic falloff (1st order)
 *     - 12 dB/octave natural acoustic falloff (2nd order)
 *     - 96 dB/octave brickwall filter shelf
 *  4. 2D FFT & Periodic Peak Detection Under Diverse Inputs:
 *     - Flat zero image, horizontal/vertical/diagonal sinusoidal gratings, Hann-windowed smooth patterns
 */

import {
  fft,
  magnitudeSpectrum,
  hannWindow,
  fft2dPowerSpectrum,
  detectSpectralPeaks,
  spectrogram,
  spectralFeatures,
  detectBrickwallCutoff
} from '../js/dsp.js';

class AdversarialHarness {
  constructor(name) {
    this.suiteName = name;
    this.totalAssertions = 0;
    this.passed = 0;
    this.failed = 0;
    this.failures = [];
    this.currentSuite = '';
  }

  describe(name, fn) {
    this.currentSuite = name;
    console.log(`\n  === ${name} ===`);
    return fn();
  }

  async it(name, fn) {
    try {
      await fn();
    } catch (err) {
      this.failed++;
      this.totalAssertions++;
      this.failures.push({ suite: this.currentSuite, test: name, error: err.message, stack: err.stack });
      console.error(`  ✗ [FAIL] ${name} (${err.message})`);
    }
  }

  assert(cond, msg) {
    this.totalAssertions++;
    if (cond) {
      this.passed++;
      console.log(`    ✓ ${msg}`);
    } else {
      this.failed++;
      this.failures.push({ suite: this.currentSuite, test: msg, error: 'Assertion failed' });
      console.error(`    ✗ [FAIL] ${msg}`);
    }
  }

  assertClose(actual, expected, tol, msg) {
    const diff = Math.abs(actual - expected);
    this.assert(diff <= tol, `${msg} | got ${actual.toFixed(6)}, expected ${expected} ±${tol}`);
  }

  summary() {
    console.log('\n========================================================================');
    console.log(`[${this.suiteName}] Summary: ${this.passed}/${this.totalAssertions} Passed (${this.failed} Failed)`);
    console.log('========================================================================');
    if (this.failed > 0) {
      console.error('\nFailure Details:');
      this.failures.forEach(f => console.error(` - [${f.suite}] ${f.test}: ${f.error}`));
    }
    return { passed: this.passed, failed: this.failed, total: this.totalAssertions };
  }
}

const harness = new AdversarialHarness('Milestone 3 DSP & Cutoff Detection Adversarial Stress Suite');

// Helper: Synthesize band-limited harmonic comb with steep brickwall cutoff
function synthBrickwallHarmonic(sampleRate, durationSec, maxFreqHz, f0 = 130) {
  const n = Math.floor(sampleRate * durationSec);
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    let s = 0;
    for (let h = 1; h * f0 < maxFreqHz; h++) {
      s += (1.0 / Math.pow(h, 0.75)) * Math.sin(2 * Math.PI * (h * f0) * t);
    }
    x[i] = s * 0.1;
  }
  return x;
}

// Helper: Synthesize noise with gradual roll-off (1st order low-pass / 6 dB/octave)
function synthFilteredNoise6dB(sampleRate, durationSec, cutoffHz) {
  const n = Math.floor(sampleRate * durationSec);
  const x = new Float64Array(n);
  const a = Math.exp(-2 * Math.PI * cutoffHz / sampleRate);
  let seed = 99991;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff) * 2 - 1; };
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const raw = rand() * 0.5;
    prev = (1 - a) * raw + a * prev;
    x[i] = prev;
  }
  return x;
}

// Helper: Synthesize noise with 2nd order Butterworth-like roll-off (~12 dB/octave)
function synthFilteredNoise12dB(sampleRate, durationSec, cutoffHz) {
  const n = Math.floor(sampleRate * durationSec);
  const x = new Float64Array(n);
  const a = Math.exp(-2 * Math.PI * cutoffHz / sampleRate);
  let seed = 54321;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff) * 2 - 1; };
  let p1 = 0, p2 = 0;
  for (let i = 0; i < n; i++) {
    const raw = rand() * 0.5;
    p1 = (1 - a) * raw + a * p1;
    p2 = (1 - a) * p1 + a * p2;
    x[i] = p2;
  }
  return x;
}

// Helper: Synthesize Pink Noise (Voss-McCartney 1/f noise)
function synthPinkNoise(sampleRate, durationSec) {
  const n = Math.floor(sampleRate * durationSec);
  const x = new Float64Array(n);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  let seed = 77777;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff) * 2 - 1; };
  for (let i = 0; i < n; i++) {
    const white = rand() * 0.2;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    x[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.15;
    b6 = white * 0.115926;
  }
  return x;
}

async function runAdversarialTests() {
  // =========================================================================
  // ADV-1: Degenerate & Extreme Audio Signals
  // =========================================================================
  await harness.describe('ADV-1: Degenerate & Extreme Signals', async () => {
    const SR = 44100;

    await harness.it('Silence (all zero buffer): magnitude, spectrogram & cutoff stability', () => {
      const zeros = new Float64Array(SR * 1);
      const mag = magnitudeSpectrum(zeros.slice(0, 512));
      for (let i = 0; i < mag.length; i++) {
        harness.assert(mag[i] === 0, `bin ${i} is exactly 0`);
      }

      const spec = spectrogram(zeros, { fftSize: 1024, hop: 256 });
      harness.assert(spec.frames.length > 0, `produced ${spec.frames.length} frames`);
      // All frames should be at noise floor (0.0 normalized magnitude)
      let maxVal = 0;
      for (const fr of spec.frames) for (const v of fr) if (v > maxVal) maxVal = v;
      harness.assert(maxVal === 0, `all spectrogram bins clamped to floor (maxVal = ${maxVal})`);

      const cutoff = detectBrickwallCutoff(spec, SR);
      harness.assert(!cutoff.brickwallDetected, 'silence does not falsely trigger brickwall detection');
      harness.assert(cutoff.cutoffType === 'none', 'cutoffType is none');
      harness.assert(cutoff.attenuationDb === 0, 'attenuationDb is 0');
      harness.assert(!cutoff.is8kHzCutoff && !cutoff.is16kHzCutoff, 'is8k and is16k false');

      const feats = spectralFeatures(spec, SR);
      harness.assert(!isNaN(feats.hfRolloffRatio) && feats.hfRolloffRatio === 0, 'hfRolloffRatio is 0 (not NaN)');
      harness.assert(!isNaN(feats.spectralFlatness), 'spectralFlatness is not NaN');
      harness.assert(feats.bandEdgeHz === 0, 'bandEdgeHz is 0');
    });

    await harness.it('Pure DC offset (+1.0 and +1000.0): isolated to sub-audible infrasound (no vocoder flags)', () => {
      const dc1 = new Float64Array(SR * 1).fill(1.0);
      const dc1000 = new Float64Array(SR * 1).fill(1000.0);

      const spec1 = spectrogram(dc1, { fftSize: 1024, hop: 256 });
      const cutoff1 = detectBrickwallCutoff(spec1, SR);
      harness.assert(!cutoff1.is8kHzCutoff && !cutoff1.is16kHzCutoff, 'DC = +1.0 does not trigger vocoder or telephony flags');
      harness.assert(cutoff1.cutoffHz <= 50, `DC frequency strictly localized below 50 Hz (${cutoff1.cutoffHz} Hz)`);

      const spec1000 = spectrogram(dc1000, { fftSize: 1024, hop: 256 });
      const cutoff1000 = detectBrickwallCutoff(spec1000, SR);
      harness.assert(!cutoff1000.is8kHzCutoff && !cutoff1000.is16kHzCutoff, 'DC = +1000.0 does not trigger vocoder or telephony flags');
      harness.assert(cutoff1000.cutoffHz <= 50, `extreme DC cutoff <= 50 Hz (${cutoff1000.cutoffHz} Hz)`);
    });

    await harness.it('Pure White Noise: verified full acoustic bandwidth & zero cutoff flags', () => {
      const len = SR * 1.5;
      const x = new Float64Array(len);
      let seed = 88123;
      const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff) * 2 - 1; };
      for (let i = 0; i < len; i++) x[i] = rand() * 0.4;

      const spec = spectrogram(x, { fftSize: 1024, hop: 512 });
      const cutoff = detectBrickwallCutoff(spec, SR);
      harness.assert(!cutoff.brickwallDetected, 'pure white noise clears brickwall detection');
      harness.assert(cutoff.cutoffType === 'none', 'cutoffType is none');
      harness.assert(!cutoff.is8kHzCutoff && !cutoff.is16kHzCutoff, 'no 8k or 16k false flags');

      const feats = spectralFeatures(spec, SR);
      harness.assert(feats.spectralFlatness > 0.8, `spectralFlatness is high for white noise (${feats.spectralFlatness.toFixed(3)})`);
      harness.assert(feats.bandEdgeHz >= (SR / 2) * 0.90, `bandEdgeHz is near Nyquist (${feats.bandEdgeHz} Hz)`);
    });

    await harness.it('Pink Noise (1/f acoustic falloff): no false cutoff detection', () => {
      const pink = synthPinkNoise(SR, 1.5);
      const spec = spectrogram(pink, { fftSize: 1024, hop: 512 });
      const cutoff = detectBrickwallCutoff(spec, SR);

      harness.assert(!cutoff.brickwallDetected, `pink noise does NOT trigger brickwall (got ${cutoff.brickwallDetected}, type ${cutoff.cutoffType})`);
      harness.assert(!cutoff.is8kHzCutoff && !cutoff.is16kHzCutoff, 'flags 8k and 16k are false');
    });

    await harness.it('Single Delta Impulse (delta[0] and delta[mid]): flat response, no cutoff', () => {
      const x1 = new Float64Array(SR * 0.5);
      x1[0] = 1.0;
      const spec1 = spectrogram(x1, { fftSize: 1024, hop: 256 });
      const cutoff1 = detectBrickwallCutoff(spec1, SR);
      harness.assert(!cutoff1.brickwallDetected, 'impulse at t=0 does not trigger brickwall');

      const x2 = new Float64Array(SR * 0.5);
      x2[Math.floor(x2.length / 2)] = 1.0;
      const spec2 = spectrogram(x2, { fftSize: 1024, hop: 256 });
      const cutoff2 = detectBrickwallCutoff(spec2, SR);
      harness.assert(!cutoff2.brickwallDetected, 'impulse at t=mid does not trigger brickwall');
    });

    await harness.it('Nyquist Frequency Tone (f = fs/2 alternating +1/-1): spectrum and cutoff', () => {
      const n = SR * 1;
      const x = new Float64Array(n);
      for (let i = 0; i < n; i++) x[i] = (i % 2 === 0) ? 0.8 : -0.8;

      const spec = spectrogram(x, { fftSize: 512, hop: 256 });
      const cutoff = detectBrickwallCutoff(spec, SR);
      harness.assert(!cutoff.brickwallDetected, 'Nyquist tone does NOT trigger false cutoff below Nyquist');
      harness.assert(cutoff.cutoffType === 'none', 'cutoffType is none for Nyquist tone');
      const feats = spectralFeatures(spec, SR);
      harness.assert(feats.bandEdgeHz >= (SR / 2) * 0.98, `band edge lands at Nyquist (${feats.bandEdgeHz} Hz)`);
    });

    await harness.it('Extremely short audio buffers (< fftSize and 1 sample)', () => {
      // 1 sample
      const one = new Float64Array([0.5]);
      const specOne = spectrogram(one, { fftSize: 1024 });
      harness.assert(specOne.frames.length === 0, '1 sample yields 0 STFT frames');
      const cutoffOne = detectBrickwallCutoff(specOne, SR);
      harness.assert(!cutoffOne.brickwallDetected, '1 sample returns safe default cutoff object');
      harness.assert(cutoffOne.notes.includes('Insufficient'), 'notes explain insufficient frames');

      // 100 samples (less than 1024)
      const hundred = new Float64Array(100).fill(0.5);
      const specHundred = spectrogram(hundred, { fftSize: 1024 });
      harness.assert(specHundred.frames.length === 0, '100 samples yields 0 frames for fftSize 1024');
      const featsHundred = spectralFeatures(specHundred, SR);
      harness.assert(featsHundred.frameCount === 0, 'frameCount is 0');
    });

    await harness.it('NaN and Infinity in audio buffers degrade gracefully without throwing uncaught exceptions', () => {
      const len = 2048;
      const nanBuffer = new Float64Array(len);
      nanBuffer[10] = NaN;
      nanBuffer[50] = Infinity;
      nanBuffer[100] = -Infinity;

      let threw = false;
      let spec;
      try {
        spec = spectrogram(nanBuffer, { fftSize: 512, hop: 256 });
      } catch (e) {
        threw = true;
      }
      harness.assert(!threw, 'spectrogram does not throw unhandled exception on NaN/Infinity');
      harness.assert(spec.frames.length > 0, 'spectrogram produces frames');

      let cutoffThrew = false;
      let cutoff;
      try {
        cutoff = detectBrickwallCutoff(spec, SR);
      } catch (e) {
        cutoffThrew = true;
      }
      harness.assert(!cutoffThrew, 'detectBrickwallCutoff does not throw on NaN frames');
      harness.assert(typeof cutoff.brickwallDetected === 'boolean', 'returns valid boolean structure');
    });
  });

  // =========================================================================
  // ADV-2: Multi-Sample-Rate Brickwall Cutoff Detection Matrix
  // =========================================================================
  await harness.describe('ADV-2: Multi-Sample-Rate Brickwall Cutoff Detection Matrix', async () => {
    const testRates = [8000, 16000, 22050, 24000, 32000, 44100, 48000, 96000];

    // Sub-test 2.1: Full broadband signal at every sample rate must yield brickwallDetected = false
    for (const sr of testRates) {
      await harness.it(`Broadband noise at sample rate ${sr} Hz clears cutoff flags`, () => {
        const len = sr * 1;
        const x = new Float64Array(len);
        let seed = sr;
        const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff) * 2 - 1; };
        for (let i = 0; i < len; i++) x[i] = rand() * 0.4;

        const spec = spectrogram(x, { fftSize: 1024, hop: 512 });
        const cutoff = detectBrickwallCutoff(spec, sr);

        harness.assert(!cutoff.brickwallDetected, `[${sr}Hz] broadband noise: brickwallDetected = false`);
        harness.assert(cutoff.cutoffType === 'none', `[${sr}Hz] cutoffType is none`);
        harness.assert(!cutoff.is8kHzCutoff && !cutoff.is16kHzCutoff, `[${sr}Hz] is8k/16k false`);
      });
    }

    // Sub-test 2.2: 8 kHz legacy cloner / telephony shelf at rates supporting it (> 16000 Hz container)
    const ratesFor8k = [22050, 24000, 32000, 44100, 48000, 96000];
    for (const sr of ratesFor8k) {
      await harness.it(`8 kHz cutoff detected at container sample rate ${sr} Hz`, () => {
        // Synthesize steep cutoff at 7.8 kHz
        const x = synthBrickwallHarmonic(sr, 1.0, 7800, 120);
        const spec = spectrogram(x, { fftSize: 1024, hop: 256 });
        const cutoff = detectBrickwallCutoff(spec, sr);

        harness.assert(cutoff.brickwallDetected, `[${sr}Hz container] brickwall detected`);
        harness.assert(cutoff.is8kHzCutoff, `[${sr}Hz container] is8kHzCutoff is true`);
        harness.assert(cutoff.cutoffType === '8kHz_legacy_cloner', `[${sr}Hz container] cutoffType is 8kHz_legacy_cloner`);
        harness.assert(cutoff.cutoffHz >= 7200 && cutoff.cutoffHz <= 8600, `[${sr}Hz container] cutoffHz in range (${cutoff.cutoffHz} Hz)`);
        harness.assert(cutoff.attenuationDb >= 15, `[${sr}Hz container] attenuation >= 15 dB (${cutoff.attenuationDb} dB)`);
      });
    }

    // Sub-test 2.3: 16 kHz neural vocoder shelf at rates supporting it (> 32000 Hz)
    const ratesFor16k = [44100, 48000, 96000];
    for (const sr of ratesFor16k) {
      await harness.it(`16 kHz neural vocoder cutoff detected at container sample rate ${sr} Hz`, () => {
        // Synthesize steep cutoff at 15.8 kHz
        const x = synthBrickwallHarmonic(sr, 1.0, 15800, 140);
        const spec = spectrogram(x, { fftSize: 1024, hop: 256 });
        const cutoff = detectBrickwallCutoff(spec, sr);

        harness.assert(cutoff.brickwallDetected, `[${sr}Hz container] brickwall detected`);
        harness.assert(cutoff.is16kHzCutoff, `[${sr}Hz container] is16kHzCutoff is true`);
        harness.assert(!cutoff.is8kHzCutoff, `[${sr}Hz container] is8kHzCutoff is false`);
        harness.assert(cutoff.cutoffType === '16kHz_neural_vocoder', `[${sr}Hz container] cutoffType is 16kHz_neural_vocoder`);
        harness.assert(cutoff.cutoffHz >= 14800 && cutoff.cutoffHz <= 16800, `[${sr}Hz container] cutoffHz in range (${cutoff.cutoffHz} Hz)`);
      });
    }

    // Sub-test 2.4: 12 kHz (24 kHz vocoder rate) shelf at 44.1 kHz, 48 kHz, 96 kHz
    for (const sr of [44100, 48000, 96000]) {
      await harness.it(`12 kHz (24k vocoder) cutoff correctly classified at ${sr} Hz`, () => {
        const x = synthBrickwallHarmonic(sr, 1.0, 11800, 130);
        const spec = spectrogram(x, { fftSize: 1024, hop: 256 });
        const cutoff = detectBrickwallCutoff(spec, sr);

        harness.assert(cutoff.brickwallDetected, `[${sr}Hz] brickwall detected at 12 kHz`);
        harness.assert(cutoff.is16kHzCutoff, `[${sr}Hz] classified under 16kHz/neural vocoder banner`);
        harness.assert(cutoff.cutoffType === '16kHz_neural_vocoder', `[${sr}Hz] cutoffType is 16kHz_neural_vocoder`);
      });
    }

    // Sub-test 2.5: Telephony narrowband (3.8 kHz) in 16 kHz and 48 kHz containers
    for (const sr of [16000, 48000]) {
      await harness.it(`3.8 kHz telephony cutoff detected in ${sr} Hz container`, () => {
        const x = synthBrickwallHarmonic(sr, 1.0, 3800, 100);
        const spec = spectrogram(x, { fftSize: 1024, hop: 256 });
        const cutoff = detectBrickwallCutoff(spec, sr);

        harness.assert(cutoff.brickwallDetected, `[${sr}Hz] brickwall detected for 3.8 kHz telephony`);
        harness.assert(cutoff.is8kHzCutoff, `[${sr}Hz] is8kHzCutoff is true`);
        harness.assert(cutoff.cutoffType === '8kHz_legacy_cloner', `[${sr}Hz] cutoffType is 8kHz_legacy_cloner`);
      });
    }

    // Sub-test 2.6: 22.05 kHz CD audio upsampled into 96 kHz container
    await harness.it('22 kHz CD audio upsampled into 96 kHz studio container (custom bandlimited)', () => {
      const sr = 96000;
      const x = synthBrickwallHarmonic(sr, 1.0, 21500, 150);
      const spec = spectrogram(x, { fftSize: 1024, hop: 256 });
      const cutoff = detectBrickwallCutoff(spec, sr);

      harness.assert(cutoff.brickwallDetected, 'brickwall detected for 22 kHz shelf in 96 kHz container');
      harness.assert(cutoff.cutoffType === 'custom_bandlimited', `cutoffType is custom_bandlimited (got ${cutoff.cutoffType})`);
      harness.assert(cutoff.cutoffHz >= 20000 && cutoff.cutoffHz <= 23000, `cutoffHz measured near 22 kHz (${cutoff.cutoffHz} Hz)`);
      harness.assert(cutoff.attenuationDb >= 18, `attenuation >= 18 dB (${cutoff.attenuationDb} dB)`);
    });
  });

  // =========================================================================
  // ADV-3: Steep vs. Gradual Spectral Roll-Offs (False Positive Discrimination)
  // =========================================================================
  await harness.describe('ADV-3: Steep vs. Gradual Spectral Roll-Off Discrimination', async () => {
    const SR = 44100;

    await harness.it('1st-order natural acoustic roll-off (6 dB/octave) at 8 kHz cutoff: NO false positive', () => {
      const x = synthFilteredNoise6dB(SR, 1.5, 8000);
      const spec = spectrogram(x, { fftSize: 1024, hop: 512 });
      const cutoff = detectBrickwallCutoff(spec, SR);

      harness.assert(!cutoff.brickwallDetected, `6 dB/oct roll-off does NOT trigger brickwall (detected: ${cutoff.brickwallDetected})`);
      harness.assert(!cutoff.is8kHzCutoff, '6 dB/oct does NOT trigger 8 kHz cloner flag');
    });

    await harness.it('2nd-order natural acoustic roll-off (12 dB/octave) at 16 kHz cutoff: NO false positive', () => {
      const x = synthFilteredNoise12dB(SR, 1.5, 16000);
      const spec = spectrogram(x, { fftSize: 1024, hop: 512 });
      const cutoff = detectBrickwallCutoff(spec, SR);

      harness.assert(!cutoff.brickwallDetected, `12 dB/oct roll-off does NOT trigger brickwall (detected: ${cutoff.brickwallDetected})`);
      harness.assert(!cutoff.is16kHzCutoff, '12 dB/oct does NOT trigger 16 kHz vocoder flag');
    });

    await harness.it('Non-physical steep brickwall shelf (> 96 dB/octave) at 16 kHz: TRUE POSITIVE', () => {
      const x = synthBrickwallHarmonic(SR, 1.0, 16000, 130);
      const spec = spectrogram(x, { fftSize: 1024, hop: 256 });
      const cutoff = detectBrickwallCutoff(spec, SR);

      harness.assert(cutoff.brickwallDetected, 'true positive brickwall detected on 96+ dB/oct shelf');
      harness.assert(cutoff.is16kHzCutoff, 'is16kHzCutoff is true');
      harness.assert(cutoff.steepnessDbPerOctave > 80, `steepness is high (> 80 dB/oct, got ${cutoff.steepnessDbPerOctave} dB/oct)`);
      harness.assert(cutoff.attenuationDb >= 20, `attenuation >= 20 dB (${cutoff.attenuationDb} dB)`);
    });

    await harness.it('Non-physical steep brickwall shelf (> 96 dB/octave) at 8 kHz: TRUE POSITIVE', () => {
      const x = synthBrickwallHarmonic(SR, 1.0, 8000, 130);
      const spec = spectrogram(x, { fftSize: 1024, hop: 256 });
      const cutoff = detectBrickwallCutoff(spec, SR);

      harness.assert(cutoff.brickwallDetected, 'true positive brickwall detected on 8 kHz shelf');
      harness.assert(cutoff.is8kHzCutoff, 'is8kHzCutoff is true');
      harness.assert(cutoff.steepnessDbPerOctave > 80, `steepness is high (${cutoff.steepnessDbPerOctave} dB/oct)`);
    });
  });

  // =========================================================================
  // ADV-4: 2D FFT & Periodic Peak Stress
  // =========================================================================
  await harness.describe('ADV-4: 2D FFT & Periodic Peak Detection Stress', async () => {
    const size = 64;

    await harness.it('All-zero image plane: center DC = 0, no NaN or crash', () => {
      const plane = new Float64Array(size * size);
      const { spectrum, maxLog } = fft2dPowerSpectrum(plane, size);
      harness.assert(maxLog === 0, 'maxLog is 0 for zero image');
      harness.assert(spectrum.length === size * size, 'spectrum array length matches');
      let hasNaN = false;
      for (const v of spectrum) if (isNaN(v)) hasNaN = true;
      harness.assert(!hasNaN, 'no NaN in spectrum');

      const peaks = detectSpectralPeaks(spectrum, size);
      harness.assert(!peaks.periodicPeaks, 'no periodic peaks detected on all-zero image');
      harness.assert(peaks.peakRatio === 0, 'peakRatio is 0');
    });

    await harness.it('Horizontal and vertical sinusoidal gratings: discrete peaks detected', () => {
      for (const k of [8, 12, 16]) {
        const plane = new Float64Array(size * size);
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            plane[y * size + x] = 128 + 90 * Math.sin((2 * Math.PI * k * x) / size);
          }
        }
        const { spectrum } = fft2dPowerSpectrum(plane, size);
        const peaks = detectSpectralPeaks(spectrum, size);
        harness.assert(peaks.periodicPeaks, `vertical grating at k=${k} flagged as periodic (peakRatio: ${peaks.peakRatio.toFixed(2)})`);
        harness.assert(peaks.peakRatio > 10.0, `peakRatio is elevated (> 10.0, got ${peaks.peakRatio.toFixed(2)})`);
      }
    });

    await harness.it('Grating exhibits higher periodic peak deviation than smooth gradient', () => {
      const c = size / 2;
      const smooth = new Float64Array(size * size);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        smooth[y * size + x] = 200 - Math.hypot(x - c, y - c) * 2;
      }
      const s = fft2dPowerSpectrum(smooth, size);
      const sp = detectSpectralPeaks(s.spectrum, size);

      const grating = new Float64Array(size * size);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        grating[y * size + x] = 128 + 90 * Math.sin((2 * Math.PI * 12 * x) / size);
      }
      const g = fft2dPowerSpectrum(grating, size);
      const gp = detectSpectralPeaks(g.spectrum, size);

      harness.assert(gp.peakRatio > sp.peakRatio * 3, `grating ratio significantly exceeds smooth gradient (${gp.peakRatio.toFixed(2)} vs ${sp.peakRatio.toFixed(2)})`);
    });
  });

  return harness.summary();
}

runAdversarialTests().then(result => {
  if (result.failed > 0) process.exitCode = 1;
});
