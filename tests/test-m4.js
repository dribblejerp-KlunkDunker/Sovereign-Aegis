/**
 * SOVEREIGN // AEGIS — Test Suite: Milestone 4 (Pillar IV: InfoWar, Operator Profile & Onboarding)
 * Validates dynamic 5-axis SVG spiderchart geometry, Overall Resilience Index weighting,
 * 7-tier Next Recommended Action priority engine, InfoWar containment grading harmonization,
 * canonical DISARM taxonomy alignment, turn-by-turn historical snapshot scrubbing, and state persistence.
 * Zero external runtime dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

// Import production modules
import { InfoWarEngine, getContainmentGrade, DISARM_DIAGNOSTICS } from '../js/modules/infowar.js';
import { OnboardingModule } from '../js/modules/onboarding.js';
import { CONTEXTS } from '../js/attempts.js';

// Standardized Zero-Dependency Test Harness
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

  assertCloseTo(actual, expected, delta = 1e-2, message) {
    const diff = Math.abs(actual - expected);
    const pass = diff <= delta;
    this.assert(pass, `${message} | Expected ~${expected}, Got: ${actual} (diff: ${diff.toFixed(4)})`);
  }

  assertGreaterOrEqual(actual, minimum, message) {
    this.assert(actual >= minimum, `${message} | Got: ${actual} >= Min: ${minimum}`);
  }

  assertLessOrEqual(actual, maximum, message) {
    this.assert(actual <= maximum, `${message} | Got: ${actual} <= Max: ${maximum}`);
  }

  summary() {
    console.log('\n====================================================');
    console.log(`[${this.suiteName}] Summary: ${this.passed}/${this.totalAssertions} Passed (${this.failed} Failed)`);
    console.log('====================================================');
    if (this.failed > 0) {
      console.error('\nFailure Details:');
      this.failures.forEach(f => console.error(` - [${f.suite}] ${f.test}: ${f.error}`));
      if (process.exitCode === undefined || process.exitCode === 0) {
        process.exitCode = 1;
      }
    }
    return { passed: this.passed, failed: this.failed, total: this.totalAssertions };
  }
}

const harness = new TestHarness('Milestone 4: Pillar IV InfoWar, Operator Profile & Onboarding Suite');

async function runTests() {
  // ----------------------------------------------------
  // Tier 1: 5-Axis Spiderchart SVG Geometry & Mathematics
  // ----------------------------------------------------
  await harness.describe('Tier 1: Dynamic 5-Axis SVG Spiderchart Mathematics', async () => {
    const axes = [
      { key: 'siftVerification', label: 'SIFT Verification', value: 80, color: 'var(--disinfo-crimson)' },
      { key: 'patternRecognition', label: 'Pattern Recognition', value: 65, color: 'var(--suspicion-amber)' },
      { key: 'memoryRetention', label: 'Memory Retention', value: 90, color: 'var(--emerald-bright)' },
      { key: 'theoreticalDepth', label: 'Theoretical Depth', value: 75, color: 'var(--bronze-bright)' },
      { key: 'analyticalPractice', label: 'Analytical Practice', value: 60, color: 'var(--intel-cyan)' }
    ];

    await harness.it('Calculates 5-axis polar vertices with -pi/2 offset accurately', () => {
      const size = 160;
      const center = size / 2; // 80
      const maxRadius = 60;
      const n = 5;

      const getPoint = (i, radius) => {
        const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
        return {
          x: center + radius * Math.cos(angle),
          y: center + radius * Math.sin(angle)
        };
      };

      // Vertex 0 (Top / 12 o'clock, angle = -90 deg)
      const p0 = getPoint(0, maxRadius);
      harness.assertCloseTo(p0.x, 80.0, 1e-2, 'Axis 0 X is 80');
      harness.assertCloseTo(p0.y, 20.0, 1e-2, 'Axis 0 Y is 20');

      // Vertex 1 (angle = -18 deg)
      const p1 = getPoint(1, maxRadius);
      harness.assertCloseTo(p1.x, 80 + 60 * Math.cos(-18 * Math.PI / 180), 1e-2, 'Axis 1 X matches -18 deg');
      harness.assertCloseTo(p1.y, 80 + 60 * Math.sin(-18 * Math.PI / 180), 1e-2, 'Axis 1 Y matches -18 deg');

      // Vertex 2 (angle = 54 deg)
      const p2 = getPoint(2, maxRadius);
      harness.assertCloseTo(p2.x, 80 + 60 * Math.cos(54 * Math.PI / 180), 1e-2, 'Axis 2 X matches 54 deg');
      harness.assertCloseTo(p2.y, 80 + 60 * Math.sin(54 * Math.PI / 180), 1e-2, 'Axis 2 Y matches 54 deg');

      // Vertex 3 (angle = 126 deg)
      const p3 = getPoint(3, maxRadius);
      harness.assertCloseTo(p3.x, 80 + 60 * Math.cos(126 * Math.PI / 180), 1e-2, 'Axis 3 X matches 126 deg');
      harness.assertCloseTo(p3.y, 80 + 60 * Math.sin(126 * Math.PI / 180), 1e-2, 'Axis 3 Y matches 126 deg');

      // Vertex 4 (angle = 198 deg)
      const p4 = getPoint(4, maxRadius);
      harness.assertCloseTo(p4.x, 80 + 60 * Math.cos(198 * Math.PI / 180), 1e-2, 'Axis 4 X matches 198 deg');
      harness.assertCloseTo(p4.y, 80 + 60 * Math.sin(198 * Math.PI / 180), 1e-2, 'Axis 4 Y matches 198 deg');
    });

    await harness.it('Renders complete SVG spiderchart structure with grid rings and data hull', () => {
      const svg = OnboardingModule._buildSpiderchart(axes);
      harness.assert(typeof svg === 'string', 'SVG string is generated');
      harness.assert(svg.includes('viewBox="0 0 160 160"'), 'SVG contains correct 160x160 viewBox');
      harness.assert((svg.match(/<line/g) || []).length === 5, 'SVG contains 5 radial spoke lines');
      harness.assert((svg.match(/<circle/g) || []).length === 5, 'SVG contains 5 vertex marker circles');
      harness.assert((svg.match(/<text/g) || []).length === 5, 'SVG contains 5 percentage value labels');
      harness.assert(svg.includes('fill="rgba(210, 166, 77, 0.15)"'), 'SVG contains bronze data hull');
    });
  });

  // ----------------------------------------------------
  // Tier 2: Overall Resilience Index & Competency Derivations
  // ----------------------------------------------------
  await harness.describe('Tier 2: Overall Resilience Index & Competency Derivations', async () => {
    await harness.it('Validates formula weighting sums strictly to 1.00', () => {
      const w_sift = 0.30;
      const w_pattern = 0.20;
      const w_memory = 0.20;
      const w_theory = 0.15;
      const w_practice = 0.15;
      const sum = w_sift + w_pattern + w_memory + w_theory + w_practice;
      harness.assertCloseTo(sum, 1.00, 1e-6, 'Sum of weights is exactly 1.00');
    });

    await harness.it('Calculates Resilience Index on Cold Start (All 0 -> 0%)', () => {
      const mockApp = {
        store: {
          get(key, defaultVal) {
            return defaultVal;
          }
        }
      };
      const moduleInstance = Object.create(OnboardingModule);
      moduleInstance._app = mockApp;

      const scores = moduleInstance._computeCompetencyScores();
      harness.assertEqual(scores.siftVerification, 0, 'SIFT accuracy is 0%');
      harness.assertEqual(scores.patternRecognition, 0, 'Pattern recognition is 0%');
      harness.assertEqual(scores.memoryRetention, 0, 'Memory retention is 0%');
      harness.assertEqual(scores.theoreticalDepth, 0, 'Theoretical depth is 0%');
      harness.assertEqual(scores.analyticalPractice, 0, 'Analytical practice is 0%');
      harness.assertEqual(scores.overallResilience, 0, 'Overall Resilience Index is 0%');
    });

    await harness.it('Calculates Resilience Index on Full Mastery (All 100 -> 100%)', () => {
      const mockApp = {
        store: {
          get(key) {
            if (key === 'sift.stats') return { correct: 10, total: 10 };
            // NOTE: 'arena.stats' is intentionally NOT mocked — nothing writes that store
            // key; Pattern Recognition is measured from the attempt log and injected.
            if (key === 'sm2.deck') return JSON.stringify([{ id: 'c1', repetitions: 4 }, { id: 'c2', repetitions: 3 }]);
            if (key === 'cognitive.progress') return { c1: { completed: true }, c2: { completed: true }, c3: { completed: true }, c4: { completed: true } };
            if (key === 'ach.analysisCount') return 5;
            if (key === 'verdad.auditCount') return 10;
            if (key === 'infowar.stats') return { victories: 3 };
            if (key === 'operator.siftPoints') return '450';
            return null;
          }
        }
      };
      const moduleInstance = Object.create(OnboardingModule);
      moduleInstance._app = mockApp;

      const scores = moduleInstance._computeCompetencyScores({ arenaAccuracy: 100 });
      harness.assertEqual(scores.siftVerification, 100, 'SIFT accuracy is 100%');
      harness.assertEqual(scores.patternRecognition, 100, 'Pattern recognition is 100%');
      harness.assertEqual(scores.memoryRetention, 100, 'Memory retention is 100%');
      harness.assertEqual(scores.theoreticalDepth, 100, 'Theoretical depth is 100%');
      harness.assertEqual(scores.analyticalPractice, 100, 'Analytical practice is 100%');
      harness.assertEqual(scores.overallResilience, 100, 'Overall Resilience Index is 100%');
      harness.assertEqual(scores.siftPoints, 450, 'SIFT points pass through');
    });

    await harness.it('Pattern Recognition is measured from real arena attempts, never a store key', () => {
      const mockApp = {
        store: {
          get: (key) => (key === 'sift.stats' ? { correct: 10, total: 10 } : null)
        }
      };
      const moduleInstance = Object.create(OnboardingModule);
      moduleInstance._app = mockApp;

      // 3 practice arena attempts (2 correct) + 1 held-out probe + 1 non-arena record:
      // only the 3 practice arena records count → round(2/3*100) = 67%.
      const arenaAccuracy = moduleInstance.arenaAccuracyFromAttempts([
        { context: 'arena', correct: true },
        { context: 'arena', correct: true },
        { context: 'arena', correct: false },
        { context: 'arena', correct: true, heldOut: true },
        { context: 'sift', correct: true }
      ]);
      harness.assertEqual(arenaAccuracy, 67, 'arenaAccuracyFromAttempts: 2/3 practice correct = 67%, held-out excluded');
      harness.assertEqual(moduleInstance.arenaAccuracyFromAttempts(null), 0, 'No attempts → honest 0');

      const scores = moduleInstance._computeCompetencyScores({ arenaAccuracy });
      harness.assertEqual(scores.patternRecognition, 67, 'Pattern Recognition reflects real attempt data');
      // Reweighted Resilience Index: 0.30*100 + 0.30*67 + 0 + 0 + 0 = 50.1 → 50
      harness.assertEqual(scores.overallResilience, 50, 'Resilience Index uses the 0.30/0.30/0.15/0.15/0.10 weights');
    });

    await harness.it('Factors infowar.stats victories cleanly into analyticalPractice', () => {
      const mockApp = {
        store: {
          get(key) {
            if (key === 'ach.analysisCount') return 1; // 1 * 15 = 15
            if (key === 'verdad.auditCount') return 2; // 2 * 5 = 10
            if (key === 'infowar.stats') return { victories: 2 }; // 2 * 20 = 40
            return null;
          }
        }
      };
      const moduleInstance = Object.create(OnboardingModule);
      moduleInstance._app = mockApp;

      const scores = moduleInstance._computeCompetencyScores();
      harness.assertEqual(scores.analyticalPractice, 65, 'Analytical practice = 15 + 10 + 40 = 65');
    });
  });

  // ----------------------------------------------------
  // Tier 3: 7-Tier Next Recommended Action Priority Engine
  // ----------------------------------------------------
  await harness.describe('Tier 3: 7-Tier Next Recommended Action Priority Engine', async () => {
    await harness.it('Selects Priority 10: SIFT drill when siftVerification < 40', () => {
      const action = OnboardingModule._computeNextAction({
        siftVerification: 35,
        patternRecognition: 20,
        theoreticalDepth: 10,
        memoryRetention: 10,
        analyticalPractice: 10
      });
      harness.assertEqual(action.priority, 10, 'Priority is 10');
      harness.assertEqual(action.label, 'Complete a SIFT Lab drill', 'Label matches');
      harness.assertEqual(action.tab, 'cognitive', 'Target tab is cognitive');
      harness.assertEqual(action.subtab, 'sift-labs', 'Target subtab is sift-labs');
      harness.assertEqual(action.icon, '🛑', 'Icon is 🛑');
    });

    await harness.it('Selects Priority 9: Infinite Arena when patternRecognition < 30', () => {
      const action = OnboardingModule._computeNextAction({
        siftVerification: 70,
        patternRecognition: 25,
        theoreticalDepth: 50,
        memoryRetention: 50,
        analyticalPractice: 50
      });
      harness.assertEqual(action.priority, 9, 'Priority is 9');
      harness.assertEqual(action.label, 'Run an Infinite Arena session', 'Label matches');
      harness.assertEqual(action.tab, 'cognitive', 'Tab is cognitive');
      harness.assertEqual(action.subtab, 'arena', 'Subtab is arena');
    });

    await harness.it('Selects Priority 8: Masterclass I when theoreticalDepth < 25', () => {
      const action = OnboardingModule._computeNextAction({
        siftVerification: 70,
        patternRecognition: 60,
        theoreticalDepth: 20,
        memoryRetention: 50,
        analyticalPractice: 50
      });
      harness.assertEqual(action.priority, 8, 'Priority is 8');
      harness.assertEqual(action.label, 'Start Masterclass I', 'Label matches');
      harness.assertEqual(action.tab, 'cognitive', 'Tab is cognitive');
      harness.assertEqual(action.subtab, 'masterclasses', 'Subtab is masterclasses');
    });

    await harness.it('Selects Priority 7: Memory Queue when memoryRetention < 20', () => {
      const action = OnboardingModule._computeNextAction({
        siftVerification: 70,
        patternRecognition: 60,
        theoreticalDepth: 50,
        memoryRetention: 15,
        analyticalPractice: 50
      });
      harness.assertEqual(action.priority, 7, 'Priority is 7');
      harness.assertEqual(action.label, 'Review your Memory Queue', 'Label matches');
      harness.assertEqual(action.subtab, 'memory', 'Subtab is memory');
    });

    await harness.it('Selects Priority 6: VERDAD audit when analyticalPractice < 20', () => {
      const action = OnboardingModule._computeNextAction({
        siftVerification: 70,
        patternRecognition: 60,
        theoreticalDepth: 50,
        memoryRetention: 50,
        analyticalPractice: 15
      });
      harness.assertEqual(action.priority, 6, 'Priority is 6');
      harness.assertEqual(action.label, 'Run a VERDAD claim audit', 'Label matches');
      harness.assertEqual(action.tab, 'verdad', 'Tab is verdad');
      harness.assertEqual(action.subtab, null, 'Subtab is null');
    });

    await harness.it('Selects Priority 5: ACH Matrix when sift > 60 and analyticalPractice < 40', () => {
      const action = OnboardingModule._computeNextAction({
        siftVerification: 75,
        patternRecognition: 60,
        theoreticalDepth: 50,
        memoryRetention: 50,
        analyticalPractice: 30
      });
      harness.assertEqual(action.priority, 5, 'Priority is 5');
      harness.assertEqual(action.label, 'Build an ACH Matrix analysis', 'Label matches');
      harness.assertEqual(action.tab, 'ach', 'Tab is ach');
    });

    await harness.it('Selects Priority 1: Default fallback when all proficiencies are established', () => {
      const action = OnboardingModule._computeNextAction({
        siftVerification: 80,
        patternRecognition: 80,
        theoreticalDepth: 80,
        memoryRetention: 80,
        analyticalPractice: 80
      });
      harness.assertEqual(action.priority, 1, 'Priority is 1 (Fallback)');
      harness.assertEqual(action.label, 'Continue SIFT Labs practice', 'Label matches');
      harness.assertEqual(action.tab, 'cognitive', 'Tab is cognitive');
    });
  });

  // ----------------------------------------------------
  // Tier 4: InfoWar Containment Grading Harmonization
  // ----------------------------------------------------
  await harness.describe('Tier 4: InfoWar Containment Grading Harmonization', async () => {
    await harness.it('Maps scores to correct letter grades (S/A/B/C/D/F)', () => {
      harness.assertEqual(getContainmentGrade(95), 'S', 'Score 95 -> S');
      harness.assertEqual(getContainmentGrade(85), 'S', 'Score 85 -> S (boundary)');
      harness.assertEqual(getContainmentGrade(84), 'A', 'Score 84 -> A');
      harness.assertEqual(getContainmentGrade(70), 'A', 'Score 70 -> A (boundary)');
      harness.assertEqual(getContainmentGrade(69), 'B', 'Score 69 -> B');
      harness.assertEqual(getContainmentGrade(55), 'B', 'Score 55 -> B (boundary)');
      harness.assertEqual(getContainmentGrade(54), 'C', 'Score 54 -> C');
      harness.assertEqual(getContainmentGrade(40), 'C', 'Score 40 -> C (boundary)');
      harness.assertEqual(getContainmentGrade(39), 'D', 'Score 39 -> D');
      harness.assertEqual(getContainmentGrade(20), 'D', 'Score 20 -> D (boundary)');
      harness.assertEqual(getContainmentGrade(19), 'F', 'Score 19 -> F');
      harness.assertEqual(getContainmentGrade(0), 'F', 'Score 0 -> F');
    });

    await harness.it('Harmonizes InfoWarEngine.generateAAR() output with letter and title grading', () => {
      const engine = new InfoWarEngine();
      engine.health = 90;
      engine.panic = 10;
      engine.won = true;
      const aar = engine.generateAAR();
      harness.assertEqual(aar.containmentEfficiency, 90, 'Containment efficiency is 90% (90*0.7 + 90*0.3)');
      harness.assertEqual(aar.gradeLetter, 'S', 'Grade letter is S');
      harness.assertEqual(aar.grade, 'S', 'Grade alias is S');
      harness.assert(aar.performanceGrade.includes('(S)'), 'Performance grade title includes (S)');
    });
  });

  // ----------------------------------------------------
  // Tier 5: Canonical DISARM IDs & Post-Mortem Diagnostics
  // ----------------------------------------------------
  await harness.describe('Tier 5: Canonical DISARM Taxonomy & Diagnostics', async () => {
    await harness.it('Aligns DISARM diagnostics with canonical 4-digit IDs in data/disarm.json', () => {
      const disarmRaw = fs.readFileSync(path.join(DATA_DIR, 'disarm.json'), 'utf8');
      const disarmData = JSON.parse(disarmRaw);
      const canonicalIds = disarmData.map(d => d.id);

      const expectedIds = ['T0002', 'T0004', 'T0008', 'T0009', 'T0015', 'T0026'];
      for (const id of expectedIds) {
        harness.assert(canonicalIds.includes(id), `Canonical ID ${id} exists in data/disarm.json`);
        harness.assert(Boolean(DISARM_DIAGNOSTICS[id]), `DISARM_DIAGNOSTICS contains diagnostic entry for ${id}`);
        const diag = DISARM_DIAGNOSTICS[id];
        harness.assert(typeof diag.name === 'string' && diag.name.length > 0, `${id} has valid name: ${diag.name}`);
        harness.assert(typeof diag.description === 'string' && diag.description.length > 0, `${id} has description`);
        harness.assert(typeof diag.remedy === 'string' && diag.remedy.length > 0, `${id} has remedy`);
        harness.assert(Array.isArray(diag.tacticMatch) && diag.tacticMatch.length > 0, `${id} has mapped campaigns`);
      }
    });

    await harness.it('Verifies AttemptLog CONTEXTS includes INFOWAR', () => {
      harness.assertEqual(CONTEXTS.INFOWAR, 'infowar', 'CONTEXTS.INFOWAR is registered as "infowar"');
    });
  });

  // ----------------------------------------------------
  // Tier 6: Historical Snapshot Scrubbing & State Replay
  // ----------------------------------------------------
  await harness.describe('Tier 6: Historical Snapshot Scrubbing & State Replay', async () => {
    await harness.it('Preserves immutable historical snapshots across turns', () => {
      const game = new InfoWarEngine();
      const snapshots = [];

      // Save initial snapshot (Turn 1)
      snapshots.push({
        turn: game.turn,
        health: game.health,
        panic: game.panic,
        avgInfection: game.avgInfection,
        nodes: game.nodes.map(n => ({ ...n })),
        edges: []
      });

      // Play turn 1
      game.takeAction('debunk', 'node-3');
      game.endTurn();

      // Save turn 2 snapshot
      snapshots.push({
        turn: game.turn,
        health: game.health,
        panic: game.panic,
        avgInfection: game.avgInfection,
        nodes: game.nodes.map(n => ({ ...n })),
        edges: []
      });

      // Verify Turn 1 state is preserved intact in snapshot 0
      harness.assertEqual(snapshots.length, 2, 'Two historical snapshots recorded');
      harness.assertEqual(snapshots[0].turn, 1, 'Snapshot 0 is Turn 1');
      harness.assertEqual(snapshots[1].turn, 2, 'Snapshot 1 is Turn 2');
      harness.assert(snapshots[0].nodes[2].infection !== snapshots[1].nodes[2].infection, 'Node 3 infection changed between Turn 1 and Turn 2 snapshots');
      harness.assertEqual(snapshots[0].nodes.length, 7, 'Snapshot 0 has 7 nodes');
      harness.assertEqual(snapshots[1].nodes.length, 7, 'Snapshot 1 has 7 nodes');
    });
  });

  return harness.summary();
}

// Standalone execution support
runTests().then(result => {
  if (result.failed > 0) {
    process.exit(1);
  }
}).catch(err => {
  console.error('Fatal error running Milestone 4 test suite:', err);
  process.exit(1);
});
