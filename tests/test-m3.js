/**
 * SOVEREIGN // AEGIS — Test Suite M3: Pillar III Signal Forensics & Heuer ACH Matrix Lab
 * Validates:
 *  1. Automated Brickwall Cutoff Detection (8 kHz & 16 kHz vocoder artifacts, transition steepness, dB attenuation)
 *  2. Procedural In-Memory AudioBuffer Synthesis (Authentic vs. Voice-Clone PCM waveforms & live STFT spectra)
 *  3. Media Forensics Acoustic Diagnostics & Epistemic Honesty Provenance Markers
 *  4. Richards J. Heuer ACH Matrix Lab (Scenarios.json Hydration, Mathematical Inconsistency & 5-Axis Confidence)
 *  5. AttemptLog & Operator Competency Spine Telemetry
 * Zero external runtime dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// In-memory IndexedDB stub for headless Node test environment
function installIndexedDbStub() {
  const databases = new Map();

  class FakeRequest {
    constructor() { this.result = undefined; this.error = null; }
  }

  class FakeStore {
    constructor(map, tx) { this._map = map; this._tx = tx; }
    _req(value) { const r = new FakeRequest(); r.result = value; return r; }
    put(value, key) {
      if (this._tx.mode !== 'readwrite') throw new Error('read-only transaction');
      this._map.set(key, JSON.parse(JSON.stringify(value)));
      return this._req(key);
    }
    getAll(range) {
      let entries = [...this._map.entries()];
      if (range) entries = entries.filter(([k]) => range.includes(k));
      return this._req(entries.map(([, v]) => v));
    }
    getAllKeys() { return this._req([...this._map.keys()]); }
    count() { return this._req(this._map.size); }
    clear() {
      if (this._tx.mode !== 'readwrite') throw new Error('read-only transaction');
      this._map.clear();
      return this._req(undefined);
    }
  }

  class FakeTransaction {
    constructor(db, storeName, mode) {
      this.mode = mode;
      this._db = db;
      this._storeName = storeName;
      this.oncomplete = null;
      this.onerror = null;
      this.onabort = null;
      this.error = null;
      queueMicrotask(() => { if (this.oncomplete) this.oncomplete(); });
    }
    objectStore(name) {
      const store = this._db._stores.get(name);
      if (!store) throw new Error(`no such store: ${name}`);
      return new FakeStore(store, this);
    }
  }

  class FakeDb {
    constructor(rec) {
      this._stores = rec.stores;
      this.closed = false;
      this.objectStoreNames = { contains: (n) => rec.stores.has(n) };
    }
    createObjectStore(name) { this._stores.set(name, new Map()); return {}; }
    transaction(storeName, mode = 'readonly') {
      if (this.closed) throw new Error('database is closed');
      return new FakeTransaction(this, storeName, mode);
    }
    close() { this.closed = true; }
  }

  globalThis.indexedDB = {
    open(name, version) {
      const req = new FakeRequest();
      req.onupgradeneeded = null;
      req.onsuccess = null;
      req.onerror = null;
      queueMicrotask(() => {
        let rec = databases.get(name);
        const isNew = !rec || rec.version < version;
        if (!rec) { rec = { version, stores: new Map() }; databases.set(name, rec); }
        req.result = new FakeDb(rec);
        if (isNew) { rec.version = version; if (req.onupgradeneeded) req.onupgradeneeded(); }
        if (req.onsuccess) req.onsuccess();
      });
      return req;
    },
    _databases: databases
  };

  globalThis.IDBKeyRange = {
    lowerBound(bound) { return { includes: (k) => String(k) >= String(bound) }; }
  };
}

installIndexedDbStub();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Standard Test Harness
class TestHarness {
  constructor(suiteName) {
    this.suiteName = suiteName;
    this.totalAssertions = 0;
    this.passed = 0;
    this.failed = 0;
    this.failures = [];
    this.currentSuite = '';
  }

  describe(name, fn) {
    this.currentSuite = name;
    console.log(`\n  --- ${name} ---`);
    return fn();
  }

  async it(name, fn) {
    try {
      await fn();
    } catch (err) {
      this.failed++;
      this.totalAssertions++;
      this.failures.push({ suite: this.currentSuite, test: name, error: err.message });
      console.error(`  ✗ [FAIL] ${name} (${err.message})`);
    }
  }

  assert(condition, message) {
    this.totalAssertions++;
    if (condition) {
      this.passed++;
      console.log(`    ✓ ${message}`);
    } else {
      this.failed++;
      this.failures.push({ suite: this.currentSuite, test: message, error: 'Assertion failed' });
      console.error(`    ✗ [FAIL] ${message}`);
    }
  }

  assertEqual(actual, expected, message) {
    this.assert(actual === expected, `${message} | Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
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

// Module Imports
import { detectBrickwallCutoff, spectralFeatures, spectrogram } from '../js/dsp.js';
import { MediaForensics } from '../js/modules/mediaForensics.js';
import { AchEngine, AchModule } from '../js/modules/ach.js';
import { AttemptLog } from '../js/attemptlog.js';

const harness = new TestHarness('Milestone 3: Pillar III (Signal Forensics & Heuer ACH Matrix Lab)');

async function runMilestone3Tests() {
  // ──────────────────────────────────────────────────────────────────────────
  // Group 1: Automated Brickwall Cutoff Detection & Mathematical Metrics
  // ──────────────────────────────────────────────────────────────────────────
  await harness.describe('Group 1: Automated Brickwall Cutoff Detection & Mathematical Metrics', async () => {
    const SR = 44100;

    await harness.it('Detects 16 kHz neural vocoder artifact cutoff on synthetic signal', () => {
      // 16.0 kHz low-pass harmonic comb
      const len = SR * 1;
      const x = new Float64Array(len);
      const f0 = 130;
      for (let i = 0; i < len; i++) {
        const t = i / SR;
        let s = 0;
        for (let h = 1; h * f0 < 16000; h++) {
          s += (1.0 / Math.pow(h, 0.8)) * Math.sin(2 * Math.PI * (h * f0) * t);
        }
        x[i] = s * 0.1;
      }
      const spec = spectrogram(x, { fftSize: 1024, hop: 256 });
      const cutoff = detectBrickwallCutoff(spec, SR);

      harness.assert(cutoff.brickwallDetected, 'brickwall detected');
      harness.assert(cutoff.is16kHzCutoff, 'is16kHzCutoff is true');
      harness.assert(!cutoff.is8kHzCutoff, 'is8kHzCutoff is false');
      harness.assertEqual(cutoff.cutoffType, '16kHz_neural_vocoder', 'cutoffType is 16kHz_neural_vocoder');
      harness.assert(cutoff.attenuationDb >= 20, `attenuation is significant (${cutoff.attenuationDb} dB)`);
      harness.assert(cutoff.steepnessDbPerOctave > 50, `steepness is non-physical (> 50 dB/oct, got ${cutoff.steepnessDbPerOctave})`);
      harness.assert(cutoff.confidence >= 0.90, `confidence elevated (${cutoff.confidence})`);
      harness.assert(cutoff.notes.toLowerCase().includes('vocoder'), 'notes mention vocoder');
    });

    await harness.it('Detects 8 kHz telephony / legacy voice cloner cutoff on narrowband signal', () => {
      // 8.0 kHz low-pass harmonic comb
      const len = SR * 1;
      const x = new Float64Array(len);
      const f0 = 130;
      for (let i = 0; i < len; i++) {
        const t = i / SR;
        let s = 0;
        for (let h = 1; h * f0 < 8000; h++) {
          s += (1.0 / Math.pow(h, 0.8)) * Math.sin(2 * Math.PI * (h * f0) * t);
        }
        x[i] = s * 0.1;
      }
      const spec = spectrogram(x, { fftSize: 1024, hop: 256 });
      const cutoff = detectBrickwallCutoff(spec, SR);

      harness.assert(cutoff.brickwallDetected, 'brickwall detected');
      harness.assert(cutoff.is8kHzCutoff, 'is8kHzCutoff is true');
      harness.assert(!cutoff.is16kHzCutoff, 'is16kHzCutoff is false');
      harness.assertEqual(cutoff.cutoffType, '8kHz_legacy_cloner', 'cutoffType is 8kHz_legacy_cloner');
      harness.assert(cutoff.attenuationDb >= 20, `attenuation is significant (${cutoff.attenuationDb} dB)`);
    });

    await harness.it('Broadband authentic signal clears brickwall cutoff flags', () => {
      const len = SR * 1;
      const x = new Float64Array(len);
      let seed = 12345;
      const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff) * 2 - 1; };
      for (let i = 0; i < len; i++) x[i] = rand() * 0.3;

      const spec = spectrogram(x, { fftSize: 1024, hop: 256 });
      const cutoff = detectBrickwallCutoff(spec, SR);

      harness.assert(!cutoff.brickwallDetected, 'brickwallDetected is false');
      harness.assert(!cutoff.is8kHzCutoff, 'is8kHzCutoff is false');
      harness.assert(!cutoff.is16kHzCutoff, 'is16kHzCutoff is false');
      harness.assertEqual(cutoff.cutoffType, 'none', 'cutoffType is none');
      harness.assert(cutoff.notes.includes('Continuous acoustic bandwidth'), 'notes reflect full bandwidth');
    });

    await harness.it('spectralFeatures correctly embeds detectBrickwallCutoff results', () => {
      const len = SR * 1;
      const x = new Float64Array(len);
      for (let i = 0; i < len; i++) x[i] = Math.sin(2 * Math.PI * 1000 * i / SR) * 0.5;

      const spec = spectrogram(x, { fftSize: 512, hop: 256 });
      const feats = spectralFeatures(spec, SR);

      harness.assert(typeof feats.cutoff === 'object', 'feats.cutoff is object');
      harness.assert(typeof feats.bandEdgeHz === 'number', 'bandEdgeHz is number');
      harness.assert(typeof feats.spectralFlatness === 'number', 'spectralFlatness is number');
      harness.assert(typeof feats.hfRolloffRatio === 'number', 'hfRolloffRatio is number');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Group 2: Procedural In-Memory AudioBuffer Synthesis
  // ──────────────────────────────────────────────────────────────────────────
  await harness.describe('Group 2: Procedural In-Memory AudioBuffer Synthesis', async () => {
    await harness.it('Generates valid PCM AudioBuffer for sample-voice-authentic', () => {
      const buffer = MediaForensics._getOrCreateSampleAudioBuffer('sample-voice-authentic');
      harness.assert(buffer !== null && typeof buffer === 'object', 'buffer is created');
      harness.assertEqual(buffer.sampleRate, 44100, 'sampleRate is 44100 Hz');
      harness.assertEqual(buffer.duration, 2.5, 'duration is 2.5s');
      harness.assert(buffer.length === Math.floor(44100 * 2.5), 'length matches duration * sampleRate');

      const data = buffer.getChannelData(0);
      harness.assert(data instanceof Float32Array, 'channel data is Float32Array');
      harness.assert(data.length === buffer.length, 'channel data length matches');

      // Verify non-zero PCM samples
      let sum = 0, nonZero = 0;
      for (let i = 0; i < data.length; i++) {
        sum += Math.abs(data[i]);
        if (Math.abs(data[i]) > 1e-4) nonZero++;
      }
      harness.assert(nonZero > 1000, `contains active audio waveform (${nonZero} non-zero samples)`);
      harness.assert(sum > 0, 'waveform energy is positive');

      // Verify spectral analysis on authentic procedural buffer shows full bandwidth
      const spec = spectrogram(data, { fftSize: 1024, hop: 512 });
      const feats = spectralFeatures(spec, buffer.sampleRate);
      harness.assert(!feats.cutoff.is16kHzCutoff, 'authentic sample does NOT trigger 16 kHz cutoff');
      harness.assert(!feats.cutoff.is8kHzCutoff, 'authentic sample does NOT trigger 8 kHz cutoff');
      harness.assert(feats.hfRolloffRatio > 0.005, `authentic sample has high-frequency breath energy (${feats.hfRolloffRatio.toFixed(4)})`);
    });

    await harness.it('Generates valid PCM AudioBuffer for sample-voice-clone with 16 kHz cutoff', () => {
      const buffer = MediaForensics._getOrCreateSampleAudioBuffer('sample-voice-clone');
      harness.assert(buffer !== null, 'clone buffer is created');
      harness.assertEqual(buffer.sampleRate, 44100, 'sampleRate is 44100 Hz');

      const data = buffer.getChannelData(0);
      harness.assert(data.length === buffer.length, 'channel data length matches');

      // Verify spectral analysis on clone procedural buffer triggers 16 kHz cutoff
      const spec = spectrogram(data, { fftSize: 1024, hop: 512 });
      const feats = spectralFeatures(spec, buffer.sampleRate);
      harness.assert(feats.cutoff.brickwallDetected, 'clone sample triggers brickwall cutoff');
      harness.assert(feats.cutoff.is16kHzCutoff, 'clone sample triggers is16kHzCutoff');
      harness.assertEqual(feats.cutoff.cutoffType, '16kHz_neural_vocoder', 'cutoffType is 16kHz_neural_vocoder');
      harness.assert(feats.cutoff.attenuationDb >= 15, `measured cutoff drop >= 15 dB (${feats.cutoff.attenuationDb} dB)`);
    });

    await harness.it('Procedural buffers are cached across repeated queries', () => {
      const b1 = MediaForensics._getOrCreateSampleAudioBuffer('sample-voice-authentic');
      const b2 = MediaForensics._getOrCreateSampleAudioBuffer('sample-voice-authentic');
      harness.assert(b1 === b2, 'buffer instance is cached');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Group 3: Richards J. Heuer ACH Matrix Lab & 5-Axis Confidence
  // ──────────────────────────────────────────────────────────────────────────
  await harness.describe('Group 3: Richards J. Heuer ACH Matrix Lab & 5-Axis Confidence', async () => {
    await harness.it('AchEngine inconsistency formula penalizes refuting evidence only', () => {
      const hypId = 'H1';
      const evList = [
        { id: 'E1', credibility: 5, relevance: 5 }, // Weight = 25
        { id: 'E2', credibility: 4, relevance: 4 }, // Weight = 16
        { id: 'E3', credibility: 3, relevance: 3 }  // Weight = 9
      ];
      // E1 is +2 (consistent), E2 is -1 (inconsistent), E3 is -2 (highly inconsistent)
      const matrix = {
        E1: { H1: 2 },
        E2: { H1: -1 },
        E3: { H1: -2 }
      };

      const inconsistency = AchEngine.calculateInconsistency(hypId, evList, matrix);
      const support = AchEngine.calculateSupport(hypId, evList, matrix);

      // Inconsistency: 0*25 + 1*16 + 2*9 = 34
      harness.assertEqual(inconsistency, 34, 'Inconsistency matches 1*16 + 2*9 = 34');
      // Support: 2*25 + 0*16 + 0*9 = 50
      harness.assertEqual(support, 50, 'Support matches 2*25 = 50');
    });

    await harness.it('AchEngine ranking sorts by least inconsistency then highest support', () => {
      const hypotheses = [
        { id: 'H1', name: 'Hypothesis 1' },
        { id: 'H2', name: 'Hypothesis 2' },
        { id: 'H3', name: 'Hypothesis 3' }
      ];
      const evList = [
        { id: 'E1', credibility: 4, relevance: 4 } // Weight = 16
      ];
      const matrix = {
        E1: { H1: 1, H2: -1, H3: 2 }
      };

      const ranked = AchEngine.rankHypotheses(hypotheses, evList, matrix);
      // H3 has 0 inconsistency, support 32 -> Rank 1
      // H1 has 0 inconsistency, support 16 -> Rank 2
      // H2 has 16 inconsistency, support 0 -> Rank 3
      harness.assertEqual(ranked[0].id, 'H3', 'H3 is Rank 1');
      harness.assertEqual(ranked[1].id, 'H1', 'H1 is Rank 2');
      harness.assertEqual(ranked[2].id, 'H2', 'H2 is Rank 3');
      harness.assertEqual(ranked[0].rank, 1, 'Rank 1 index is 1');
      harness.assertEqual(ranked[1].rank, 2, 'Rank 2 index is 2');
      harness.assertEqual(ranked[2].rank, 3, 'Rank 3 index is 3');
    });

    await harness.it('AchEngine 5-axis confidence decomposition and ICD 203 verbal certainty tags', () => {
      const perfect = AchEngine.computeConfidence({
        sourceReliability: 1.0,
        contentCredibility: 1.0,
        corroboration: 1.0,
        ageHours: 0,
        analyticalPeerReview: 1.0,
        contradictions: 0
      });
      harness.assertEqual(perfect.score, 100, 'Perfect score is 100%');
      harness.assertEqual(perfect.label, 'Almost Certain', '100% is Almost Certain');

      const high = AchEngine.computeConfidence({
        sourceReliability: 0.8,
        contentCredibility: 0.8,
        corroboration: 0.8,
        ageHours: 12,
        analyticalPeerReview: 0.8,
        contradictions: 0
      });
      harness.assert(high.score >= 70 && high.score < 85, `Score in Highly Likely band (${high.score}%)`);
      harness.assertEqual(high.label, 'Highly Likely', 'Label is Highly Likely');

      const contradicted = AchEngine.computeConfidence({
        sourceReliability: 0.8,
        contentCredibility: 0.8,
        corroboration: 0.8,
        ageHours: 0,
        analyticalPeerReview: 0.8,
        contradictions: 4
      });
      harness.assert(contradicted.score < 40, `Contradictions reduce score significantly (${contradicted.score}%)`);
      harness.assert(contradicted.breakdown.contradictionPenalty === 0.4, 'Contradiction penalty is 1.0 - 0.15*4 = 0.4');
    });

    await harness.it('AchModule hydrates and merges scenarios from scenarios.json', async () => {
      // Simulate file load
      const scenariosPath = path.join(ROOT_DIR, 'data', 'scenarios.json');
      const data = JSON.parse(fs.readFileSync(scenariosPath, 'utf8'));

      harness.assert(Array.isArray(data.achCases), 'data.achCases is array');
      harness.assert(data.achCases.length >= 3, 'contains at least 3 production cases');

      // Verify each case has hypotheses, evidence, and defaultMatrix
      for (const c of data.achCases) {
        harness.assert(c.id && c.caseTitle, `case ${c.id} has id and caseTitle`);
        harness.assert(c.hypotheses && c.hypotheses.length >= 3, `case ${c.id} has >= 3 hypotheses`);
        harness.assert(c.evidenceList && c.evidenceList.length >= 3, `case ${c.id} has >= 3 evidence items`);
        harness.assert(c.defaultMatrix && Object.keys(c.defaultMatrix).length > 0, `case ${c.id} has defaultMatrix`);

        // Test calculation on production scenario
        const rankings = AchEngine.rankHypotheses(c.hypotheses, c.evidenceList, c.defaultMatrix);
        harness.assert(rankings.length === c.hypotheses.length, `all hypotheses ranked for ${c.id}`);
        harness.assert(rankings[0].rank === 1, `top rank is 1 for ${c.id}`);
        harness.assert(rankings[0].inconsistency <= rankings[1].inconsistency, 'rank 1 <= rank 2 inconsistency');
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Group 4: AttemptLog & Operator Competency Spine Telemetry
  // ──────────────────────────────────────────────────────────────────────────
  await harness.describe('Group 4: AttemptLog & Operator Competency Spine Telemetry', async () => {
    await harness.it('Records ACH audit completion attempt to AttemptLog', async () => {
      const initialCount = await AttemptLog.count();

      const result = await AttemptLog.append({
        skillId: 'skill.bias.confirmation',
        itemId: 'ach-case-01',
        correct: true,
        context: 'forensics',
        confidence: 'sure'
      });

      harness.assert(result.ok, 'attempt logged successfully');
      harness.assert(typeof result.id === 'string', 'attempt ID generated');

      const afterCount = await AttemptLog.count();
      harness.assertEqual(afterCount, initialCount + 1, 'AttemptLog count incremented by 1');

      const all = await AttemptLog.readAll();
      const last = all[all.length - 1];
      harness.assertEqual(last.skillId, 'skill.bias.confirmation', 'skillId matches');
      harness.assertEqual(last.itemId, 'ach-case-01', 'itemId matches');
      harness.assertEqual(last.correct, true, 'correct matches');
      harness.assertEqual(last.context, 'forensics', 'context matches');
      harness.assertEqual(last.confidence, 'sure', 'confidence matches');
    });
  });

  return harness.summary();
}

runMilestone3Tests().then(result => {
  if (result.failed > 0) process.exitCode = 1;
});
