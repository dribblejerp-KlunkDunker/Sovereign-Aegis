/**
 * SOVEREIGN // AEGIS — Predict-then-measure forensics drill (pure)
 *
 * WHAT THIS FIXES
 * ---------------
 * The Forensics studio computes real work — a real 2-D FFT, a real STFT spectrogram, a real C2PA
 * manifest walk — and then shows you the answer the moment you pick a sample. As a viewer it
 * cannot produce a single attempt record, which is why `skill.forensics.provenance` had two items
 * and both came from Prebunking. Reading a measurement is a skill; watching one render is not.
 *
 * So the operator commits a prediction BEFORE the measurement is drawn, and is then shown what it
 * actually says. Nothing about the analysis changes — only the order.
 *
 * THE SECOND QUESTION IS THE POINT
 * --------------------------------
 * Each drill has two parts. The first asks what the measurement will SHOW; the second asks what it
 * ESTABLISHES, and there the correct answer is always the properly hedged one. That is deliberate:
 * the failure this application exists to correct is not missing an artefact, it is over-reading one.
 * An operator who predicts every indicator correctly and then concludes "therefore it is fake" has
 * learned the easy half.
 *
 * PURE BY DESIGN
 * --------------
 * Questions are derived from the sample's own ground-truth fields, so they cannot drift from what
 * the viewport will display. No DOM, no storage, no randomness — the module can be tested against
 * every sample in the corpus, which is how the option sets are kept honest.
 *
 * @module forensicsDrill
 */

/** Modes that carry a drill. `user` uploads are excluded — see buildDrill(). */
export const DRILL_MODES = ['image', 'audio', 'video', 'c2pa'];

const yes = (v) => v === true;

/**
 * The two-by-two option set used by every "what will it show?" question.
 *
 * Both mixed options are real states, not filler: a genuine photograph that has been cropped and
 * resaved shows localised ELA anomalies with no periodic spectral structure, and an upscaled
 * authentic image can show spectral regularity with clean ELA. If the mixed cases were impossible
 * the item would be a disguised true/false.
 *
 * @private
 */
function twoByTwo({ aTrue, bTrue, both, neither, onlyA, onlyB }) {
  const options = [both, onlyA, onlyB, neither];
  const correct = aTrue && bTrue ? both : aTrue ? onlyA : bTrue ? onlyB : neither;
  return { options, correctIndex: options.indexOf(correct) };
}

/**
 * Build the prediction question for a sample in a mode, or null if the mode does not apply.
 * @private
 */
function predictionFor(sample, mode) {
  const f = sample.forensics || {};

  if (mode === 'image') {
    if (sample.type !== 'image') return null;
    const ela = yes(f.ela?.anomalyDetected);
    const fft = yes(f.fft?.spectralSpikes);
    const { options, correctIndex } = twoByTwo({
      aTrue: ela, bTrue: fft,
      both: 'Localised ELA anomalies AND periodic spikes in the spectrum',
      onlyA: 'Localised ELA anomalies, but smooth isotropic spectral decay',
      onlyB: 'Uniform ELA, but periodic spikes in the spectrum',
      neither: 'Uniform ELA and smooth isotropic spectral decay'
    });
    return {
      prompt: 'Before the measurements render — what will the Error Level Analysis and the 2-D frequency spectrum show?',
      options, correctIndex,
      skills: ['skill.forensics.read-measurements']
    };
  }

  if (mode === 'audio') {
    if (sample.type !== 'audio') return null;
    const vocoder = yes(f.spectrogram?.vocoderArtifacts);
    const brokenGlottal = f.pitchContour ? !yes(f.pitchContour.glottalPulseContinuous) : false;
    const { options, correctIndex } = twoByTwo({
      aTrue: vocoder, bTrue: brokenGlottal,
      both: 'A vocoder brickwall in the spectrogram AND a discontinuous glottal pulse',
      onlyA: 'A vocoder brickwall in the spectrogram, but a continuous glottal pulse',
      onlyB: 'Full acoustic bandwidth, but a discontinuous glottal pulse',
      neither: 'Full acoustic bandwidth and a continuous, naturally jittered glottal pulse'
    });
    return {
      prompt: 'Before the spectrogram renders — what will it and the pitch contour show?',
      options, correctIndex,
      skills: ['skill.forensics.read-measurements']
    };
  }

  if (mode === 'video') {
    if (sample.type !== 'video') return null;
    const seam = Boolean(f.temporal?.blendBoundary || f.temporal?.frameJitter);
    const unnaturalGaze = f.blinkRate ? !yes(f.blinkRate.saccadeNatural) : false;
    const { options, correctIndex } = twoByTwo({
      aTrue: seam, bTrue: unnaturalGaze,
      both: 'A visible blend seam along the jaw AND an abnormal blink/saccade pattern',
      onlyA: 'A visible blend seam along the jaw, with a natural blink/saccade pattern',
      onlyB: 'No blend seam, but an abnormal blink/saccade pattern',
      neither: 'No blend seam and a natural blink/saccade pattern'
    });
    return {
      prompt: 'Before the temporal analysis renders — what will the frame seams and gaze behaviour show?',
      options, correctIndex,
      skills: ['skill.forensics.read-measurements']
    };
  }

  if (mode === 'c2pa') {
    const m = sample.c2paManifest;
    const present = Boolean(m) && m.tamperStatus !== 'NO_MANIFEST';
    const claimsVerified = present && yes(m.verified);
    const options = [
      'A manifest is present and claims a verified signature',
      'A manifest is present but does not claim a verified signature',
      'No manifest at all',
      'A manifest is present and the asset hash fails to match'
    ];
    const correctIndex = !present ? 2 : claimsVerified ? 0 : 1;
    return {
      prompt: 'Before the manifest is parsed — what will the provenance reader find?',
      options, correctIndex,
      skills: ['skill.forensics.provenance']
    };
  }

  return null;
}

/**
 * The "what does this establish?" question. The correct answer is always the hedged one, and the
 * distractors are the three over-reads an operator actually makes.
 * @private
 */
function establishFor(sample, mode) {
  if (mode === 'c2pa') {
    const m = sample.c2paManifest;
    const present = Boolean(m) && m.tamperStatus !== 'NO_MANIFEST';
    const options = present
      ? [
        'That the file carries a provenance claim — parsed, not independently verified against a trusted certificate chain',
        'That the image is authentic and unmodified',
        'That the named device really captured this image',
        'That the file has not been edited since capture'
      ]
      : [
        'Nothing about the asset — the overwhelming majority of real media carries no manifest',
        'That the file was probably manipulated',
        'That provenance metadata was deliberately stripped',
        'That the asset is synthetic'
      ];
    return {
      prompt: 'And what does that actually establish?',
      options, correctIndex: 0,
      skills: ['skill.forensics.provenance', 'skill.forensics.read-measurements']
    };
  }

  const anomalous = mode === 'image'
    ? (yes(sample.forensics?.ela?.anomalyDetected) || yes(sample.forensics?.fft?.spectralSpikes))
    : mode === 'audio'
      ? yes(sample.forensics?.spectrogram?.vocoderArtifacts)
      : Boolean(sample.forensics?.temporal?.blendBoundary);

  const options = anomalous
    ? [
      'An indicator consistent with synthesis — and with several innocent explanations. It narrows the question, it does not answer it',
      'That the asset is synthetic',
      'That the asset was deliberately manipulated to deceive',
      'Nothing — these measurements are unreliable'
    ]
    : [
      'That this particular measurement found nothing — which is not the same as the asset being authentic',
      'That the asset is authentic',
      'That the asset was captured by a real device',
      'That no manipulation of any kind occurred'
    ];

  return { prompt: 'And what does that actually establish?', options, correctIndex: 0,
    skills: ['skill.forensics.read-measurements'] };
}

/**
 * The full drill for a sample in a mode.
 *
 * Returns null when there is nothing honest to ask: a mode that does not apply to this media type,
 * or a USER-UPLOADED asset, whose `isSynthetic` is a default rather than a known fact. Scoring a
 * prediction against a guess would manufacture evidence, which is the failure this whole phase
 * exists to remove.
 *
 * @param {object} sample
 * @param {string} mode
 * @returns {{itemId: string, predict: object, establish: object}|null}
 */
export function buildDrill(sample, mode) {
  if (!sample || !sample.id || sample.id === 'user-media') return null;
  if (!DRILL_MODES.includes(mode)) return null;
  const predict = predictionFor(sample, mode);
  if (!predict) return null;
  return {
    itemId: `${sample.id}#${mode}`,
    predict: { ...predict, itemId: `${sample.id}#${mode}#predict` },
    establish: { ...establishFor(sample, mode), itemId: `${sample.id}#${mode}#establish` }
  };
}

/**
 * Every drill available across a corpus — used by the tests to check the whole set at once.
 * @param {object[]} samples
 * @returns {object[]}
 */
export function allDrills(samples) {
  const out = [];
  for (const s of samples || []) {
    for (const m of DRILL_MODES) {
      const d = buildDrill(s, m);
      if (d) out.push({ sampleId: s.id, mode: m, ...d });
    }
  }
  return out;
}

export default { buildDrill, allDrills, DRILL_MODES };
