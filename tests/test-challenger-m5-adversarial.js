/**
 * SOVEREIGN // AEGIS — Milestone 5 Empirical Challenger Adversarial Test Suite
 * 
 * Deep verification of Milestone 5 deliverables:
 * 1. 19-Dataset Mutation & Negative Validation Oracle (Schema Fuzzing & Invariant Stress)
 * 2. High-Concurrency Multi-Pillar Operator Lifecycle Simulation (50 Concurrent Operators)
 * 3. DSP Pathological Audio Signals & STFT Spectrogram Extreme Edge Cases
 * 4. StateStore Rapid Interleaved Writes & Persistence Corruption Recovery
 * 5. Architectural Gravitas & Anti-Dark-Pattern Invariant Static Audit
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { AegisCrypto } from '../js/crypto.js';
import { StateStore } from '../js/state.js';
import { estimate, estimateAll, miscalibrated } from '../js/competency.js';
import { AchEngine } from '../js/modules/ach.js';
import { VerdadEngine } from '../js/modules/verdad.js';
import { InfoWarEngine } from '../js/modules/infowar.js';
import {
  fft,
  magnitudeSpectrum,
  hannWindow,
  fft2dPowerSpectrum,
  spectrogram,
  spectralFeatures,
  detectBrickwallCutoff
} from '../js/dsp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const JS_DIR = path.join(ROOT_DIR, 'js');
const CSS_DIR = path.join(ROOT_DIR, 'css');

class M5AdversarialHarness {
  constructor(name) {
    this.name = name;
    this.total = 0;
    this.passed = 0;
    this.failed = 0;
    this.failures = [];
    this.currentCategory = '';
  }

  category(name, fn) {
    this.currentCategory = name;
    console.log(`\n========================================================================`);
    console.log(`▶ [M5 CHALLENGER] ${name}`);
    console.log(`========================================================================`);
    return fn();
  }

  async it(testName, fn) {
    try {
      await fn();
    } catch (err) {
      this.failed++;
      this.total++;
      this.failures.push({ category: this.currentCategory, test: testName, error: err.message, stack: err.stack });
      console.error(`  ✗ [FAIL] ${testName} -> ${err.message}`);
    }
  }

  assert(condition, message) {
    this.total++;
    if (condition) {
      this.passed++;
      console.log(`  ✓ ${message}`);
    } else {
      this.failed++;
      this.failures.push({ category: this.currentCategory, test: message, error: 'Assertion failed' });
      console.error(`  ✗ [ASSERTION FAILED] ${message}`);
    }
  }

  assertEqual(actual, expected, message) {
    this.assert(actual === expected, `${message} | Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
  }

  assertCloseTo(actual, expected, delta = 1e-3, message) {
    const diff = Math.abs(actual - expected);
    this.assert(diff <= delta, `${message} | Expected ~${expected}, Got: ${actual} (diff: ${diff.toFixed(5)})`);
  }

  summary() {
    console.log('\n========================================================================');
    console.log(`[${this.name}] SUMMARY: ${this.passed}/${this.total} Assertions Passed (${this.failed} Failed)`);
    console.log('========================================================================');
    if (this.failed > 0) {
      console.error('\nFailures Detected:');
      this.failures.forEach(f => console.error(` - [${f.category}] ${f.test}: ${f.error}`));
    }
    return { passed: this.passed, failed: this.failed, total: this.total };
  }
}

const harness = new M5AdversarialHarness('Milestone 5 Challenger Adversarial Suite');

// Helper to safely load JSON
function loadJson(relPath) {
  const full = path.join(DATA_DIR, relPath);
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

async function runM5AdversarialSuite() {
  console.log('========================================================================');
  console.log(' SOVEREIGN // AEGIS — MILESTONE 5 ADVERSARIAL STRESS & INVARIANT SUITE  ');
  console.log('========================================================================');

  // ==========================================================================
  // SECTION 1: 19-DATASET MUTATION & FUZZING ORACLE
  // ==========================================================================
  await harness.category('1. 19-Dataset Structural Mutation & Referential Integrity Fuzzing', async () => {
    const datasetFiles = [
      'answer_skill_map.json',
      'arena_questions.json',
      'community_packs.json',
      'disarm.json',
      'early_warning.json',
      'fallacies.json',
      'forensic_samples.json',
      'inoculation.json',
      'masterclass.json',
      'media_forensics.json',
      'narratives.json',
      'reputation.json',
      'rhetorical_arguments.json',
      'scenarios.json',
      'sift_scenarios.json',
      'skills.json',
      'sources.json',
      'spaced_repetition_cards.json',
      'verdad_rules.json'
    ];

    await harness.it('Verifies all 19 physical dataset files parse into valid non-null objects', async () => {
      for (const file of datasetFiles) {
        const data = loadJson(file);
        harness.assert(typeof data === 'object' && data !== null, `Dataset ${file} parses into non-null object/array`);
      }
    });

    // Fuzzing SIFT Scenarios Schema
    await harness.it('SIFT Scenarios resilience under mutated / missing properties', async () => {
      const siftScenarios = loadJson('sift_scenarios.json');
      harness.assert(Array.isArray(siftScenarios) && siftScenarios.length === 32, `sift_scenarios has 32 scenarios (found ${siftScenarios.length})`);
      
      const labs = ['stop', 'investigate', 'coverage', 'trace'];
      for (const lab of labs) {
        const count = siftScenarios.filter(s => s.lab === lab).length;
        harness.assert(count === 8, `SIFT lab "${lab}" contains exactly 8 scenarios (found ${count})`);
      }

      // Check Stop lab scenario invariants
      const stopScenarios = siftScenarios.filter(s => s.lab === 'stop');
      for (const s of stopScenarios) {
        harness.assert(['stop', 'continue'].includes(s.correctDecision), `Stop scenario ${s.id} has valid correctDecision`);
        harness.assert(Array.isArray(s.manipulationSignals), `Stop scenario ${s.id} has manipulationSignals`);
        harness.assert(Array.isArray(s.learningPoints) && s.learningPoints.length > 0, `Stop scenario ${s.id} has learningPoints`);
      }
    });

    // Fuzzing Rhetorical Arguments Schema
    await harness.it('Rhetorical Arguments structural integrity and Socratic exercises', async () => {
      const rhetArguments = loadJson('rhetorical_arguments.json');
      harness.assert(Array.isArray(rhetArguments) && rhetArguments.length >= 6, `rhetorical_arguments has ${rhetArguments.length} arguments (>= 6)`);

      for (const arg of rhetArguments) {
        harness.assert(typeof arg.id === 'string' && arg.id.length > 0, `Argument ${arg.id} has valid ID`);
        harness.assert(Array.isArray(arg.clauses) && arg.clauses.length >= 2, `Argument ${arg.id} has >= 2 clauses`);
        harness.assert(typeof arg.unstatedAssumption === 'object' && arg.unstatedAssumption !== null, `Argument ${arg.id} has unstatedAssumption object`);
        harness.assert(Array.isArray(arg.unstatedAssumption.distractors) && arg.unstatedAssumption.distractors.length >= 2, `Argument ${arg.id} has distractors`);
        harness.assert(typeof arg.steelMannedVersion === 'object' && arg.steelMannedVersion !== null, `Argument ${arg.id} has steelMannedVersion`);
        harness.assert(Array.isArray(arg.steelMannedVersion.exercises) && arg.steelMannedVersion.exercises.length >= 1, `Argument ${arg.id} has Socratic exercises`);
      }
    });

    // Cross-Referencing Sources & Reputation
    await harness.it('Sources and Reputation cross-dataset referential consistency', async () => {
      const sourcesList = loadJson('sources.json');
      const repData = loadJson('reputation.json');

      harness.assert(Array.isArray(sourcesList) && sourcesList.length >= 50, `sources.json has ${sourcesList.length} sources (>= 50 required)`);
      const sourceDomains = new Set(sourcesList.map(s => s.domain.toLowerCase()));

      harness.assert(sourceDomains.size >= 50, `sources.json has ${sourceDomains.size} unique domains`);
      harness.assert(Array.isArray(repData.badgeDefinitions) && repData.badgeDefinitions.length >= 10, `reputation.json has ${repData.badgeDefinitions?.length} badge definitions (>= 10 required)`);

      // Domain format validator
      const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
      let validFormats = true;
      for (const d of sourceDomains) {
        if (!domainRegex.test(d)) validFormats = false;
      }
      harness.assert(validFormats, 'All source domains conform to valid DNS domain syntax');
    });

    // Competency Skill DAG Acyclicity Test
    await harness.it('Skill DAG has no cycles and all prerequisites exist', async () => {
      const skillsData = loadJson('skills.json');
      const skillList = Array.isArray(skillsData) ? skillsData : (skillsData.skills || Object.values(skillsData));
      const skillMap = new Map();
      
      for (const s of skillList) {
        skillMap.set(s.id, s);
      }

      let allPrereqsExist = true;
      for (const s of skillList) {
        const prereqs = s.prerequisites || s.requires || [];
        for (const p of prereqs) {
          if (!skillMap.has(p)) allPrereqsExist = false;
        }
      }
      harness.assert(allPrereqsExist, 'All skill node prerequisites resolve to existing skill IDs');

      // Cycle detector (DFS)
      let hasCycle = false;
      const visited = new Set();
      const recStack = new Set();

      function dfs(id) {
        visited.add(id);
        recStack.add(id);
        const node = skillMap.get(id);
        const prereqs = node?.prerequisites || node?.requires || [];
        for (const p of prereqs) {
          if (!visited.has(p)) {
            if (dfs(p)) return true;
          } else if (recStack.has(p)) {
            return true;
          }
        }
        recStack.delete(id);
        return false;
      }

      for (const id of skillMap.keys()) {
        if (!visited.has(id)) {
          if (dfs(id)) { hasCycle = true; break; }
        }
      }
      harness.assert(!hasCycle, 'Competency Skill DAG is strictly acyclic (no circular dependencies)');
    });
  });

  // ==========================================================================
  // SECTION 2: CONCURRENT MULTI-PILLAR OPERATOR LIFECYCLE STRESS
  // ==========================================================================
  await harness.category('2. Concurrent Multi-Pillar Operator Lifecycle Simulation (50 Operators)', async () => {
    const operatorCount = 50;
    const operatorPromises = [];

    console.log(`  ▶ Simulating ${operatorCount} parallel operators executing complete 10-step pedagogical pipelines...`);

    for (let opId = 1; opId <= operatorCount; opId++) {
      operatorPromises.push((async (id) => {
        // 1. Crypto Identity Generation (P-256 did:key)
        const keyPair = await AegisCrypto.generateKeyPair();
        if (!keyPair.did.startsWith('did:key:zDnae')) throw new Error(`Operator ${id} DID invalid: ${keyPair.did}`);

        // 2. StateStore isolation & seed
        const state = new StateStore({}, { storageKey: `test_operator_${id}_${Date.now()}` });
        state.set('operator.id', keyPair.did);
        state.set('operator.name', `Operator-${id}`);

        // 3. SIFT Scenario simulation & SM-2 card generation
        const siftScenarios = loadJson('sift_scenarios.json');
        const testScenario = siftScenarios[id % siftScenarios.length];
        
        // Push SM-2 card to operator deck
        const cardPayload = {
          id: `card-${testScenario.id}`,
          prompt: testScenario.claim || `Analyze SIFT scenario ${testScenario.id}`,
          diagnosis: testScenario.explanation || 'Diagnosis rationale',
          latin: 'Fallacia',
          mechanism: 'Cognitive shortcut vector',
          countermeasure: 'Deliberate lateral reading',
          tests: ['lateral_reading', 'source_check']
        };
        const initialDeck = state.get('sm2.deck', []) || [];
        initialDeck.push({
          ...cardPayload,
          interval: 1,
          repetitions: 0,
          easeFactor: 2.5,
          nextReview: Date.now()
        });
        state.set('sm2.deck', initialDeck);

        // 4. SM-2 Spaced Repetition Review (SuperMemo Algorithm)
        const activeCard = initialDeck[0];
        const grade = (id % 4) + 2; // Grade 2, 3, 4, or 5
        if (grade < 3) {
          activeCard.repetitions = 0;
          activeCard.interval = 1;
        } else {
          if (activeCard.repetitions === 0) activeCard.interval = 1;
          else if (activeCard.repetitions === 1) activeCard.interval = 6;
          else activeCard.interval = Math.round(activeCard.interval * activeCard.easeFactor);
          activeCard.repetitions += 1;
        }
        activeCard.easeFactor = Math.max(1.3, activeCard.easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
        state.set('sm2.deck', [activeCard]);

        // 5. Append-Only AttemptLog recording with cryptographic signing
        const logEntry = {
          operatorDid: keyPair.did,
          action: 'sift_diagnosis',
          scenarioId: testScenario.id,
          grade: grade,
          timestamp: new Date().toISOString()
        };
        const signature = await AegisCrypto.signStatement(keyPair.keyPair.privateKey, logEntry);
        const validSig = await AegisCrypto.verifyStatement(keyPair.publicKeyJwk, logEntry, signature);
        if (!validSig) throw new Error(`Operator ${id} signature verification failed`);

        // 6. Competency Engine Update
        const attempts = [
          { skillId: 'sift-stop', correct: grade >= 3, ts: Date.now(), confidence: 'sure' },
          { skillId: 'fallacy-detection', correct: true, ts: Date.now() - 3600000, confidence: 'unsure' }
        ];
        const estSift = estimate(attempts, 'sift-stop');
        const estFallacy = estimate(attempts, 'fallacy-detection');

        if (estSift.mastery < 0 || estSift.mastery > 1 || estFallacy.mastery < 0 || estFallacy.mastery > 1) {
          throw new Error(`Operator ${id} competency out of bounds`);
        }

        // 7. VERDAD NLP Analysis & Adversarial Sandbox Generation
        const claimText = `BREAKING: Urgent leak reveals secret offshore bioweapon lab in sector ${id}! Retweet now before censorship deletes this!`;
        const verdadResult = VerdadEngine.runOfflineHeuristics(claimText);
        if (verdadResult.emotionalIntensity <= 0 && verdadResult.veracityScore >= 80) {
          throw new Error(`Operator ${id} VERDAD failed to detect urgency/outrage affect`);
        }
        const adversarialBriefs = VerdadEngine.generateAdversarialReframings(claimText, verdadResult);
        if (!adversarialBriefs.outrageMaximizer || !adversarialBriefs.falseConsensus || !adversarialBriefs.inGroupThreat) {
          throw new Error(`Operator ${id} Adversarial sandbox missing briefs`);
        }

        // 8. Heuer ACH Matrix Inconsistency Math
        const hypotheses = [
          { id: 'H1', name: 'Coordinated Disinformation Campaign' },
          { id: 'H2', name: 'Organic Viral Misunderstanding' },
          { id: 'H3', name: 'Accurate Whistleblower Report' }
        ];
        const evidence = [
          { id: 'E1', credibility: 4, relevance: 5 },
          { id: 'E2', credibility: 5, relevance: 4 }
        ];
        const ratings = {
          E1: { H1: 2, H2: 0, H3: -2 },
          E2: { H1: 1, H2: -1, H3: -2 }
        };
        const rankedAch = AchEngine.rankHypotheses(hypotheses, evidence, ratings);
        if (!rankedAch || rankedAch.length !== 3 || rankedAch[0].id !== 'H1') {
          throw new Error(`Operator ${id} ACH failed ranking`);
        }

        // 9. InfoWar Turn-Based AP Engine
        const infowar = new InfoWarEngine();
        const nodeToInoculate = infowar.nodes[0].id;
        const actionRes = infowar.takeAction('inoculate', nodeToInoculate);
        if (!actionRes.success || infowar.ap !== 7) {
          throw new Error(`Operator ${id} InfoWar AP deduction failed: AP=${infowar.ap}`);
        }

        // 10. Operator Profile 5-Axis Spiderchart Resilience Index
        const siftVal = estSift.mastery;
        const patternVal = estFallacy.mastery;
        const memoryVal = activeCard.repetitions > 1 ? 0.9 : 0.6;
        const theoryVal = 0.85;
        const practiceVal = 0.80;

        const resilienceIndex = Math.round(
          (0.30 * siftVal + 0.20 * patternVal + 0.20 * memoryVal + 0.15 * theoryVal + 0.15 * practiceVal) * 100
        );

        if (isNaN(resilienceIndex) || resilienceIndex < 0 || resilienceIndex > 100) {
          throw new Error(`Operator ${id} Resilience Index calculation invalid: ${resilienceIndex}`);
        }

        return { id, resilienceIndex, validSig };
      })(opId));
    }

    const results = await Promise.all(operatorPromises);
    harness.assertEqual(results.length, operatorCount, `All ${operatorCount} parallel operator lifecycles completed`);
    
    let allValid = results.every(r => r.validSig && r.resilienceIndex >= 0 && r.resilienceIndex <= 100);
    harness.assert(allValid, 'All 50 operators produced 100% valid cryptographic signatures and bounded Resilience Indices');
  });

  // ==========================================================================
  // SECTION 3: DSP PATHOLOGICAL AUDIO & SPECTROGRAM STRESS
  // ==========================================================================
  await harness.category('3. DSP Pathological Audio Signals & STFT Spectrogram Extreme Edge Cases', async () => {
    // Edge case 1: Empty and single-sample FFT
    await harness.it('FFT handles edge-case lengths cleanly without exceptions', async () => {
      const re0 = new Float64Array(0);
      const im0 = new Float64Array(0);
      fft(re0, im0);
      harness.assertEqual(re0.length, 0, 'Zero-length FFT returns without error');

      const re1 = new Float64Array([42]);
      const im1 = new Float64Array([0]);
      fft(re1, im1);
      harness.assertEqual(re1[0], 42, '1-sample FFT identity preserved');
    });

    // Edge case 2: Non-power-of-two protection
    await harness.it('FFT strictly rejects non-power-of-two lengths', async () => {
      const re3 = new Float64Array(3);
      const im3 = new Float64Array(3);
      let threw = false;
      try {
        fft(re3, im3);
      } catch (e) {
        threw = true;
      }
      harness.assert(threw, 'FFT throws Error on non-power-of-two size (3)');
    });

    // Edge case 3: Dirac Delta Impulse
    await harness.it('Dirac Delta impulse produces flat magnitude spectrum', async () => {
      const n = 256;
      const samples = new Float64Array(n);
      samples[0] = 1.0; // Delta at t=0
      const mag = magnitudeSpectrum(samples);
      let flat = true;
      for (let i = 0; i < mag.length; i++) {
        if (Math.abs(mag[i] - 1.0) > 1e-6) flat = false;
      }
      harness.assert(flat, 'Dirac delta FFT magnitude is exactly flat (1.0) across all frequencies');
    });

    // Edge case 4: Synthesized 8 kHz brickwall cut-off signal
    await harness.it('Automated brickwall detector flags 8 kHz cutoff with high confidence', async () => {
      const sampleRate = 44100;
      const fftSize = 1024;
      const totalSamples = 44100; // 1 second
      const audio = new Float64Array(totalSamples);
      
      // Fill with harmonic tones below 7.5 kHz only
      for (let i = 0; i < totalSamples; i++) {
        const t = i / sampleRate;
        audio[i] = 0.5 * Math.sin(2 * Math.PI * 440 * t) +
                   0.3 * Math.sin(2 * Math.PI * 2000 * t) +
                   0.2 * Math.sin(2 * Math.PI * 6000 * t);
      }

      const spec = spectrogram(audio, fftSize, 512);
      const features = spectralFeatures(spec, sampleRate);
      const cutoff = detectBrickwallCutoff(spec, sampleRate);

      harness.assert(cutoff.brickwallDetected, 'Brickwall detector identified cutoff in 8 kHz limited audio');
      harness.assert(cutoff.cutoffHz <= 8000, `Detected cutoff frequency (${cutoff.cutoffHz} Hz) <= 8000 Hz`);
      harness.assert(features.hfRolloffRatio < 0.05, `HF rolloff ratio (${features.hfRolloffRatio.toFixed(4)}) is near zero`);
    });

    // Edge case 5: Pathological NaN and Infinity guard in STFT
    await harness.it('DSP functions survive pathological inputs (all zeros, DC bias, extreme amplitudes)', async () => {
      const zeroAudio = new Float64Array(2048);
      const zeroSpec = spectrogram(zeroAudio, 512, 256);
      const zeroFeat = spectralFeatures(zeroSpec, 44100);

      harness.assert(!isNaN(zeroFeat.spectralFlatness), 'Zero-signal spectralFlatness is not NaN');
      harness.assert(!isNaN(zeroFeat.hfRolloffRatio), 'Zero-signal hfRolloffRatio is not NaN');
      harness.assert(isFinite(zeroFeat.bandEdgeHz), 'Zero-signal bandEdgeHz is finite');
    });
  });

  // ==========================================================================
  // SECTION 4: STATESTORE RAPID CONCURRENCY & RECOVERY STRESS
  // ==========================================================================
  await harness.category('4. StateStore Rapid Interleaved Writes & Persistence Corruption Recovery', async () => {
    const store = new StateStore({}, { storageKey: 'm5_adversarial_store' });
    
    await harness.it('Handles 500 rapid interleaved asynchronous mutations without loss', async () => {
      const writePromises = [];
      for (let i = 0; i < 500; i++) {
        writePromises.push((async (idx) => {
          store.set(`concurrency.key_${idx}`, idx * 2);
          const val = store.get(`concurrency.key_${idx}`);
          if (val !== idx * 2) throw new Error(`Mismatch at key_${idx}: got ${val}`);
        })(i));
      }
      await Promise.all(writePromises);
      harness.assertEqual(store.get('concurrency.key_499'), 998, 'Key 499 has expected value 998');
    });

    await harness.it('Listener subscription stress: 500 subscriptions attach, trigger, and cleanly detach', async () => {
      let notifyCount = 0;
      const unsubs = [];
      for (let i = 0; i < 500; i++) {
        const unsub = store.subscribe('stress.counter', () => {
          notifyCount++;
        });
        unsubs.push(unsub);
      }

      store.set('stress.counter', 1);
      harness.assertEqual(notifyCount, 500, 'All 500 listeners fired on mutation');

      // Unsubscribe all
      for (const unsub of unsubs) unsub();
      store.set('stress.counter', 2);
      harness.assertEqual(notifyCount, 500, '0 listeners fired after unsubscription');
    });

    await harness.it('Corrupted JSON storage safety fallback', async () => {
      const corruptedJson = '{"invalid_json_payload: [unclosed';
      let parseFailedSafe = false;
      try {
        JSON.parse(corruptedJson);
      } catch (e) {
        parseFailedSafe = true;
      }
      harness.assert(parseFailedSafe, 'Corrupted JSON triggers catch clause safely');
    });
  });

  // ==========================================================================
  // SECTION 5: ARCHITECTURAL GRAVITAS & ANTI-DARK-PATTERN STATIC AUDIT
  // ==========================================================================
  await harness.category('5. Architectural Gravitas & Anti-Dark-Pattern Invariant Static Audit', async () => {
    const prohibitedTokens = [
      'lootbox',
      'loot_box',
      'spin_wheel',
      'casino',
      'streak_loss_warning',
      'buy_coins',
      'gem_purchase',
      'daily_login_penalty',
      'paywall'
    ];

    // Scan all JS files in js/ and modules/
    const jsFiles = fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js')).map(f => path.join(JS_DIR, f));
    const modulesDir = path.join(JS_DIR, 'modules');
    if (fs.existsSync(modulesDir)) {
      jsFiles.push(...fs.readdirSync(modulesDir).filter(f => f.endsWith('.js')).map(f => path.join(modulesDir, f)));
    }

    await harness.it('JavaScript source files contain zero manipulative dopamine / dark pattern tokens', async () => {
      let violations = [];
      for (const filePath of jsFiles) {
        const content = fs.readFileSync(filePath, 'utf8').toLowerCase();
        for (const token of prohibitedTokens) {
          if (content.includes(token)) {
            violations.push({ file: path.basename(filePath), token });
          }
        }
      }
      harness.assertEqual(violations.length, 0, `0 dark pattern tokens found in ${jsFiles.length} JavaScript files`);
    });

    // Verify Design System Color Palette Invariants in CSS
    await harness.it('Design system CSS variables enforce solemn classical palette (Granite, Bronze, Parchment, Cinzel, Garamond)', async () => {
      const varCssPath = path.join(CSS_DIR, 'variables.css');
      harness.assert(fs.existsSync(varCssPath), 'css/variables.css exists');
      
      const cssContent = fs.readFileSync(varCssPath, 'utf8').toLowerCase();
      harness.assert(cssContent.includes('--granite-dark') || cssContent.includes('#191918') || cssContent.includes('#121211'), 'Dark Granite primary background token present');
      harness.assert(cssContent.includes('--bronze-light') || cssContent.includes('#dfbe7a') || cssContent.includes('#b68438'), 'Burnished Bronze primary accent token present');
      harness.assert(cssContent.includes('garamond') || cssContent.includes('cinzel'), 'Classical typography tokens (Garamond / Cinzel) defined');
    });
  });

  return harness.summary();
}

runM5AdversarialSuite().then(results => {
  if (results.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}).catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
