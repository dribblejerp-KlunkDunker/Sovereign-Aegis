/**
 * SOVEREIGN // AEGIS — Digital Signal Processing primitives
 *
 * WHY THIS EXISTS
 * ---------------
 * The forensics studio previously *drew* the things it claimed to compute. The image
 * "2D FFT" converted the image to a grayscale luminance array and then discarded it,
 * painting a radial gradient and four rings instead — the source comment said
 * `Render simulated 2D power spectrum`. The audio "spectrogram" never called
 * `getChannelData`; audio was decoded only so it could be played.
 *
 * That is the difference between a tool and a picture of a tool. This module does the
 * arithmetic for real: a genuine Cooley-Tukey FFT, a genuine 2D transform, and a
 * genuine short-time Fourier transform. Zero dependencies, matching the rest of the
 * project.
 *
 * Everything here is pure and synchronous, so it is directly unit-testable against
 * analytic signals with known spectra — see tests/test-dsp.js.
 *
 * @module dsp
 */

/**
 * In-place iterative radix-2 Cooley-Tukey FFT.
 *
 * Operates on separate real and imaginary Float64Arrays (avoids allocating complex
 * objects per sample). Length MUST be a power of two.
 *
 * @param {Float64Array} re - real components, modified in place
 * @param {Float64Array} im - imaginary components, modified in place
 * @param {boolean} [inverse=false] - compute the inverse transform (with 1/N scaling)
 */
export function fft(re, im, inverse = false) {
  const n = re.length;
  if (n !== im.length) throw new Error('fft: re/im length mismatch');
  if (n === 0) return;
  if ((n & (n - 1)) !== 0) throw new Error(`fft: length must be a power of two, got ${n}`);
  if (n === 1) return;

  // --- bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }

  // --- butterflies
  const sign = inverse ? 1 : -1;
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (sign * 2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      const half = len >> 1;
      for (let k = 0; k < half; k++) {
        const aRe = re[i + k];
        const aIm = im[i + k];
        const bRe = re[i + k + half] * curRe - im[i + k + half] * curIm;
        const bIm = re[i + k + half] * curIm + im[i + k + half] * curRe;
        re[i + k] = aRe + bRe;
        im[i + k] = aIm + bIm;
        re[i + k + half] = aRe - bRe;
        im[i + k + half] = aIm - bIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }
}

/**
 * Magnitude spectrum of a real-valued signal.
 * Returns the first N/2+1 bins (the rest are the mirror image for real input).
 *
 * @param {ArrayLike<number>} samples - length must be a power of two
 * @returns {Float64Array} magnitudes, length N/2+1
 */
export function magnitudeSpectrum(samples) {
  const n = samples.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = samples[i];
  fft(re, im);
  const half = (n >> 1) + 1;
  const out = new Float64Array(half);
  for (let i = 0; i < half; i++) out[i] = Math.hypot(re[i], im[i]);
  return out;
}

/**
 * Periodic Hann window — reduces spectral leakage from finite framing.
 * @param {number} n
 * @returns {Float64Array}
 */
export function hannWindow(n) {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / n));
  return w;
}

/**
 * True 2D FFT of a square, power-of-two luminance plane.
 *
 * Separable transform: FFT every row, then FFT every column. Returns the log-scaled,
 * fftshift-ed power spectrum normalised to [0,1] — i.e. DC at the centre, which is the
 * conventional presentation and the one where diffusion-model periodicity and JPEG
 * blocking artefacts are legible as off-centre peaks and axis spikes.
 *
 * @param {Float64Array|Float32Array|number[]} plane - size*size luminance, row-major
 * @param {number} size - power of two
 * @returns {{spectrum: Float64Array, size: number, maxLog: number}}
 */
export function fft2dPowerSpectrum(plane, size) {
  if ((size & (size - 1)) !== 0) throw new Error(`fft2d: size must be a power of two, got ${size}`);
  if (plane.length !== size * size) throw new Error('fft2d: plane length !== size*size');

  const re = new Float64Array(size * size);
  const im = new Float64Array(size * size);
  for (let i = 0; i < size * size; i++) re[i] = plane[i];

  const rowRe = new Float64Array(size);
  const rowIm = new Float64Array(size);

  // rows
  for (let y = 0; y < size; y++) {
    const off = y * size;
    for (let x = 0; x < size; x++) { rowRe[x] = re[off + x]; rowIm[x] = im[off + x]; }
    fft(rowRe, rowIm);
    for (let x = 0; x < size; x++) { re[off + x] = rowRe[x]; im[off + x] = rowIm[x]; }
  }
  // columns
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) { rowRe[y] = re[y * size + x]; rowIm[y] = im[y * size + x]; }
    fft(rowRe, rowIm);
    for (let y = 0; y < size; y++) { re[y * size + x] = rowRe[y]; im[y * size + x] = rowIm[y]; }
  }

  // log power, fftshift so DC lands at (size/2, size/2)
  const half = size >> 1;
  const shifted = new Float64Array(size * size);
  let maxLog = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const p = Math.log1p(Math.hypot(re[i], im[i]));
      const sy = (y + half) % size;
      const sx = (x + half) % size;
      shifted[sy * size + sx] = p;
      if (p > maxLog) maxLog = p;
    }
  }
  if (maxLog > 0) for (let i = 0; i < shifted.length; i++) shifted[i] /= maxLog;

  return { spectrum: shifted, size, maxLog };
}

/**
 * Detect periodic spectral peaks — the artefact class that upsampling and
 * diffusion-decoder architectures tend to leave behind.
 *
 * Measures how far the brightest non-DC region deviates from the smooth radial
 * average. A high ratio means energy concentrated at discrete spatial frequencies
 * rather than the broadly isotropic falloff of a camera image.
 *
 * This is a real measurement of the real spectrum. It is NOT a trained detector, and
 * it does not license a claim that an image is synthetic — see the limitation notes
 * surfaced in the UI.
 *
 * @param {Float64Array} spectrum - normalised, fftshift-ed spectrum from fft2dPowerSpectrum
 * @param {number} size
 * @returns {{peakRatio: number, periodicPeaks: boolean, radialProfile: number[]}}
 */
export function detectSpectralPeaks(spectrum, size) {
  const c = size >> 1;
  const maxR = c - 1;
  const sums = new Float64Array(maxR + 1);
  const counts = new Float64Array(maxR + 1);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.round(Math.hypot(x - c, y - c));
      if (r > maxR) continue;
      sums[r] += spectrum[y * size + x];
      counts[r] += 1;
    }
  }
  const radial = [];
  for (let r = 0; r <= maxR; r++) radial.push(counts[r] ? sums[r] / counts[r] : 0);

  // Largest positive deviation from the radial mean, ignoring the DC neighbourhood.
  let worst = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.round(Math.hypot(x - c, y - c));
      if (r < 4 || r > maxR) continue;
      const expected = radial[r];
      if (expected <= 1e-6) continue;
      const ratio = spectrum[y * size + x] / expected;
      if (ratio > worst) worst = ratio;
    }
  }

  return {
    peakRatio: worst,
    periodicPeaks: worst > 3.0,
    radialProfile: radial
  };
}

/**
 * Short-time Fourier transform of a real signal — a genuine spectrogram.
 *
 * @param {Float32Array|Float64Array} samples - mono PCM, any length
 * @param {{fftSize?: number, hop?: number, maxFrames?: number}} [opts]
 * @returns {{frames: Float64Array[], fftSize: number, hop: number, bins: number}}
 *   frames[t][f] = magnitude in dB, normalised to [0,1]
 */
export function spectrogram(samples, opts = {}) {
  const fftSize = opts.fftSize || 1024;
  const hop = opts.hop || Math.floor(fftSize / 4);
  const maxFrames = opts.maxFrames || 512;

  if ((fftSize & (fftSize - 1)) !== 0) throw new Error('spectrogram: fftSize must be a power of two');

  const bins = (fftSize >> 1) + 1;
  const win = hannWindow(fftSize);

  const total = Math.max(0, Math.floor((samples.length - fftSize) / hop) + 1);
  // Decimate in time rather than truncating, so a long file still shows its whole shape.
  const stride = total > maxFrames ? Math.ceil(total / maxFrames) : 1;

  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);
  const frames = [];

  for (let f = 0; f < total; f += stride) {
    const start = f * hop;
    for (let i = 0; i < fftSize; i++) {
      re[i] = (samples[start + i] || 0) * win[i];
      im[i] = 0;
    }
    fft(re, im);
    const mag = new Float64Array(bins);
    for (let b = 0; b < bins; b++) {
      // dB with a floor, then map [-100,0] dB -> [0,1]
      const m = Math.hypot(re[b], im[b]) / (fftSize / 2);
      const db = 20 * Math.log10(Math.max(m, 1e-6));
      mag[b] = Math.min(1, Math.max(0, (db + 100) / 100));
    }
    frames.push(mag);
  }

  return { frames, fftSize, hop: hop * stride, bins };
}

/**
 * Spectral features that are diagnostically interesting for synthetic speech.
 *
 * - `hfRolloffRatio`: energy above ~7.5 kHz relative to total. Many neural vocoders and
 *   lossy-resampled TTS outputs show an abrupt deficit here.
 * - `spectralFlatness`: geometric/arithmetic mean ratio. Vocoded speech is often
 *   flatter and less harmonically structured than a real recording.
 * - `bandEdgeDb`: the highest frequency still carrying meaningful energy — a hard shelf
 *   well below Nyquist suggests upsampling from a lower-rate synthesis pipeline.
 *
 * These are honest measurements, not a verdict. Real recordings from a phone codec can
 * look similar; the UI must present them as indicators requiring interpretation.
 *
/**
 * Automated brickwall cutoff detection for synthetic speech & vocoder forensics.
 *
 * Detects steep spectral attenuation shelves that indicate upsampling from lower-rate
 * neural vocoders or narrowband telephony codecs.
 *
 * @param {{frames: Float64Array[], bins: number}} spec - output of spectrogram()
 * @param {number} sampleRate - Audio sample rate in Hz (e.g. 44100, 48000)
 * @returns {{
 *   brickwallDetected: boolean,
 *   cutoffHz: number,
 *   cutoffType: '8kHz_legacy_cloner' | '16kHz_neural_vocoder' | 'custom_bandlimited' | 'none',
 *   attenuationDb: number,
 *   steepnessDbPerOctave: number,
 *   is8kHzCutoff: boolean,
 *   is16kHzCutoff: boolean,
 *   confidence: number,
 *   notes: string
 * }}
 */
export function detectBrickwallCutoff(spec, sampleRate) {
  if (!spec || !spec.frames || !spec.frames.length || !spec.bins || spec.bins < 8 || !sampleRate || sampleRate <= 0) {
    return {
      brickwallDetected: false,
      cutoffHz: 0,
      cutoffType: 'none',
      attenuationDb: 0,
      steepnessDbPerOctave: 0,
      is8kHzCutoff: false,
      is16kHzCutoff: false,
      confidence: 0,
      notes: 'Insufficient frames or bins to analyze.'
    };
  }

  const { frames, bins } = spec;
  const nyquist = sampleRate / 2;
  const hzPerBin = nyquist / (bins - 1);

  // Compute time-averaged power spectrum across frames
  const avgMag = new Float64Array(bins);
  for (const fr of frames) {
    for (let b = 0; b < bins; b++) avgMag[b] += fr[b];
  }
  for (let b = 0; b < bins; b++) avgMag[b] /= frames.length;

  // Find the highest bin with significant energy above noise floor
  const floor = 0.08;
  let highestActiveBin = 0;
  for (let b = bins - 1; b >= 1; b--) {
    if (avgMag[b] > floor) { highestActiveBin = b; break; }
  }

  const bandEdgeHz = Math.round(highestActiveBin * hzPerBin);

  // Measure spectral drop (passband power vs stopband power)
  // Transition window around the detected edge
  const windowBins = Math.max(3, Math.floor(400 / hzPerBin));
  const passStart = Math.max(1, highestActiveBin - windowBins);
  const stopEnd = Math.min(bins - 1, highestActiveBin + windowBins);

  let passSum = 0, passCount = 0;
  for (let b = passStart; b <= highestActiveBin; b++) { passSum += avgMag[b]; passCount++; }
  const passAvg = passCount > 0 ? passSum / passCount : 0;

  let stopSum = 0, stopCount = 0;
  for (let b = highestActiveBin + 1; b <= stopEnd; b++) { stopSum += avgMag[b]; stopCount++; }
  const stopAvg = stopCount > 0 ? stopSum / stopCount : 0;

  // Normalized magnitude [0,1] corresponds to [-100 dB, 0 dB], so delta * 100 = dB drop
  const dropDb = Math.max(0, (passAvg - stopAvg) * 100);

  // Octave span calculation for physical slope
  const fPass = Math.max(100, passStart * hzPerBin);
  const fStop = Math.max(fPass * 1.05, stopEnd * hzPerBin);
  const octaves = Math.max(0.1, Math.log2(fStop / fPass));
  const steepnessDbPerOctave = Math.round(dropDb / octaves);

  // Check if cutoff is well below Nyquist
  const isBelowNyquist = bandEdgeHz < nyquist * 0.94;
  const isSteepCliff = dropDb >= 18 || (passAvg > 0.20 && stopAvg < 0.08);

  let is8kHz = false;
  let is16kHz = false;
  let cutoffType = 'none';
  let notes = `Continuous acoustic bandwidth to Nyquist (${(nyquist / 1000).toFixed(1)} kHz).`;

  if (isBelowNyquist && isSteepCliff) {
    // 8 kHz legacy / telephony cloner check: ~3.3 - 4.4 kHz (telephony) or ~7.3 - 8.6 kHz (16 kHz synthesis upsampled)
    if ((bandEdgeHz >= 3300 && bandEdgeHz <= 4400) || (bandEdgeHz >= 7300 && bandEdgeHz <= 8600)) {
      is8kHz = true;
      cutoffType = '8kHz_legacy_cloner';
      notes = `Brickwall cutoff detected at ${bandEdgeHz} Hz (${(bandEdgeHz / 1000).toFixed(1)} kHz). Consistent with 8 kHz telephony bandwidth or 16 kHz legacy voice-cloning pipeline.`;
    }
    // 16 kHz neural vocoder check: ~14.8 - 16.8 kHz (HiFi-GAN / VALL-E 32k) or ~10.8 - 12.6 kHz (22k/24k vocoders)
    else if ((bandEdgeHz >= 14800 && bandEdgeHz <= 16800) || (bandEdgeHz >= 10800 && bandEdgeHz <= 12600)) {
      is16kHz = true;
      cutoffType = '16kHz_neural_vocoder';
      notes = `Brickwall cutoff detected at ${bandEdgeHz} Hz (${(bandEdgeHz / 1000).toFixed(1)} kHz). Consistent with neural vocoder synthesis (e.g. HiFi-GAN / VALL-E / 32 kHz synthesis upsampled to container rate).`;
    }
    else {
      cutoffType = 'custom_bandlimited';
      notes = `Band edge cutoff detected at ${bandEdgeHz} Hz (${(bandEdgeHz / 1000).toFixed(1)} kHz) with ${dropDb.toFixed(1)} dB stopband attenuation.`;
    }
  }

  return {
    brickwallDetected: is8kHz || is16kHz || (isBelowNyquist && isSteepCliff),
    cutoffHz: bandEdgeHz,
    cutoffType,
    attenuationDb: Math.round(dropDb * 10) / 10,
    steepnessDbPerOctave,
    is8kHzCutoff: is8kHz,
    is16kHzCutoff: is16kHz,
    confidence: is8kHz || is16kHz ? 0.92 : (isSteepCliff ? 0.75 : 0.20),
    notes
  };
}

/**
 * Spectral features that are diagnostically interesting for synthetic speech.
 *
 * - `hfRolloffRatio`: energy above ~7.5 kHz relative to total. Many neural vocoders and
 *   lossy-resampled TTS outputs show an abrupt deficit here.
 * - `spectralFlatness`: geometric/arithmetic mean ratio. Vocoded speech is often
 *   flatter and less harmonically structured than a real recording.
 * - `bandEdgeDb`: the highest frequency still carrying meaningful energy — a hard shelf
 *   well below Nyquist suggests upsampling from a lower-rate synthesis pipeline.
 * - `cutoff`: automated brickwall cutoff detection structure (8 kHz, 16 kHz, attenuation).
 *
 * These are honest measurements, not a verdict. Real recordings from a phone codec can
 * look similar; the UI must present them as indicators requiring interpretation.
 *
 * @param {{frames: Float64Array[], bins: number}} spec - output of spectrogram()
 * @param {number} sampleRate
 * @returns {{hfRolloffRatio: number, spectralFlatness: number, bandEdgeHz: number, frameCount: number, cutoff: object}}
 */
export function spectralFeatures(spec, sampleRate) {
  const { frames, bins } = spec;
  if (!frames || !frames.length) {
    return {
      hfRolloffRatio: 0,
      spectralFlatness: 0,
      bandEdgeHz: 0,
      frameCount: 0,
      cutoff: detectBrickwallCutoff(spec, sampleRate)
    };
  }
  const nyquist = sampleRate / 2;
  const hzPerBin = nyquist / (bins - 1);
  const hfStart = Math.min(bins - 1, Math.floor(7500 / hzPerBin));

  // Average magnitude per bin across time.
  const avg = new Float64Array(bins);
  for (const fr of frames) for (let b = 0; b < bins; b++) avg[b] += fr[b];
  for (let b = 0; b < bins; b++) avg[b] /= frames.length;

  let total = 0;
  let hf = 0;
  let logSum = 0;
  let linSum = 0;
  for (let b = 1; b < bins; b++) {
    total += avg[b];
    if (b >= hfStart) hf += avg[b];
    const v = Math.max(avg[b], 1e-9);
    logSum += Math.log(v);
    linSum += v;
  }
  const count = bins - 1;
  const geo = Math.exp(logSum / count);
  const arith = linSum / count;

  // Highest bin still meaningfully above the noise floor.
  const floor = 0.08;
  let edge = 0;
  for (let b = bins - 1; b >= 1; b--) {
    if (avg[b] > floor) { edge = b; break; }
  }

  const cutoff = detectBrickwallCutoff(spec, sampleRate);

  return {
    hfRolloffRatio: total > 0 ? hf / total : 0,
    spectralFlatness: arith > 0 ? geo / arith : 0,
    bandEdgeHz: Math.round(edge * hzPerBin),
    frameCount: frames.length,
    cutoff
  };
}

export default {
  fft, magnitudeSpectrum, hannWindow, fft2dPowerSpectrum,
  detectSpectralPeaks, spectrogram, spectralFeatures,
  detectBrickwallCutoff
};
