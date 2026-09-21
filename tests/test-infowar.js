/**
 * SOVEREIGN // AEGIS — Test Suite 6: InfoWar Serious Game Tactical Network Engine
 * Validates 10 AP budget economy, player countermeasure actions, contagion physics,
 * friction dampeners, adversary AI events, win/loss terminal states, and After-Action Reports (AAR).
 * Zero external runtime dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

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

// Canonical InfoWar Serious Game Engine Reference Implementation
// InfoWarEngine is imported from the production module below — this suite previously
// carried its own duplicate copy of the class, so it could not detect a regression
// in the shipped code. Do not re-inline it.
import { InfoWar, InfoWarEngine } from '../js/modules/infowar.js';


const harness = new TestHarness('InfoWar Serious Game Tactical Network Suite');

async function runTests() {
  // ----------------------------------------------------
  // Tier 1: Game Initialization & AP Budget Economy
  // ----------------------------------------------------
  await harness.describe('Tier 1: Game Engine Initialization & 10 AP Economy', async () => {
    let game = null;

    await harness.it('Initializes game with Turn 1, MaxTurns 8, AP 10', () => {
      game = new InfoWarEngine();
      harness.assertEqual(game.turn, 1, 'Starting turn is 1');
      harness.assertEqual(game.maxTurns, 8, 'Max turns is 8');
      harness.assertEqual(game.ap, 10, 'Initial AP is 10');
      harness.assertEqual(game.gameOver, false, 'Game is not over');
      harness.assertEqual(game.won, false, 'Won is initially false');
    });

    await harness.it('Initializes 7 heterogeneous graph nodes with valid attributes', () => {
      harness.assertEqual(game.nodes.length, 7, 'Contains 7 network nodes');
      for (const node of game.nodes) {
        harness.assert(typeof node.id === 'string' && node.id.startsWith('node-'), `Node ID valid: ${node.id}`);
        harness.assert(node.reach >= 0 && node.reach <= 1.0, `Reach in range [0, 1]: ${node.reach}`);
        harness.assert(node.resistance >= 0 && node.resistance <= 1.0, `Resistance in range [0, 1]: ${node.resistance}`);
        harness.assert(node.infection >= 0 && node.infection <= 100, `Infection in range [0, 100]: ${node.infection}`);
        harness.assert(node.trust >= 0 && node.trust <= 100, `Trust in range [0, 100]: ${node.trust}`);
      }
    });

    await harness.it('Executes Inoculate Action (Cost: 3 AP, Resistance +0.40)', () => {
      const node = game.getNode('node-3');
      const prevRes = node.resistance;
      const res = game.takeAction('inoculate', 'node-3');
      harness.assertEqual(res.success, true, 'Inoculate action succeeded');
      harness.assertEqual(game.ap, 7, 'Remaining AP is 7 (10 - 3)');
      harness.assertCloseTo(node.resistance, Math.min(1.0, prevRes + 0.40), 1e-3, 'Resistance increased by 0.40');
    });

    await harness.it('Executes Forensic Debunk Action (Cost: 4 AP, Infection -50, Trust +25)', () => {
      const node = game.getNode('node-4'); // Dark channels initial infection 90
      const prevInf = node.infection;
      const res = game.takeAction('debunk', 'node-4');
      harness.assertEqual(res.success, true, 'Debunk action succeeded');
      harness.assertEqual(game.ap, 3, 'Remaining AP is 3 (7 - 4)');
      harness.assertEqual(node.infection, Math.max(0, prevInf - 50), 'Infection decreased by 50');
      harness.assertGreaterOrEqual(node.trust, 30, 'Trust boosted by debunk');
    });

    await harness.it('Executes Platform Friction Action (Cost: 2 AP, Friction Flag Active)', () => {
      const res = game.takeAction('friction');
      harness.assertEqual(res.success, true, 'Friction action succeeded');
      harness.assertEqual(game.ap, 1, 'Remaining AP is 1 (3 - 2)');
      harness.assertEqual(game.frictionActive, true, 'Friction dampener active for next turn');
    });

    await harness.it('Rejects Action when AP is insufficient (Requires 3 AP, Has 1 AP)', () => {
      const res = game.takeAction('inoculate', 'node-1');
      harness.assertEqual(res.success, false, 'Action rejected due to insufficient AP');
      harness.assertEqual(game.ap, 1, 'AP unchanged at 1');
    });
  });

  // ----------------------------------------------------
  // Tier 1 & Tier 2: Turn Boundary, Contagion Physics & Clamping
  // ----------------------------------------------------
  await harness.describe('Tier 1 & Tier 2: Turn Boundary, Contagion Physics & Clamping', async () => {
    let game = null;

    await harness.it('Advances turn, resets AP to 10, and applies contagion dampening', () => {
      game = new InfoWarEngine();
      // Apply friction
      game.takeAction('friction');
      harness.assertEqual(game.frictionActive, true, 'Friction set');

      const stateAfterTurn1 = game.endTurn();
      harness.assertEqual(game.turn, 2, 'Turn advanced to 2');
      harness.assertEqual(game.ap, 10, 'AP reset to 10');
      harness.assertEqual(game.frictionActive, false, 'Friction consumed on turn end');
      harness.assertEqual(stateAfterTurn1.history.length, 1, 'Turn 1 logged to history');
    });

    await harness.it('Clamps node values strictly to physical boundaries', () => {
      const node = game.getNode('node-5'); // Academy
      // Boost resistance to max
      node.resistance = 0.90;
      game.takeAction('inoculate', 'node-5');
      harness.assertLessOrEqual(node.resistance, 1.0, 'Resistance clamped at 1.0 maximum');

      // Debunk low infection
      node.infection = 10;
      game.takeAction('debunk', 'node-5');
      harness.assertGreaterOrEqual(node.infection, 0, 'Infection clamped at 0 minimum');
    });

    await harness.it('Rejects actions on non-existent node IDs safely', () => {
      const res = game.takeAction('inoculate', 'node-nonexistent-99');
      harness.assertEqual(res.success, false, 'Invalid node action rejected');
    });

    await harness.it('Rejects unknown action strings safely', () => {
      const res = game.takeAction('nuke_all_internet', 'node-1');
      harness.assertEqual(res.success, false, 'Unknown action rejected');
    });

    await harness.it('Rejects prototype property action injection without AP corruption', () => {
      const initAp = game.ap;
      const protoActions = ['constructor', 'toString', 'valueOf', '__proto__', 'hasOwnProperty', 'isPrototypeOf'];
      for (const act of protoActions) {
        const res = game.takeAction(act, 'node-1');
        harness.assertEqual(res.success, false, `Prototype action "${act}" rejected`);
        harness.assertEqual(Number.isNaN(game.ap), false, `AP is not NaN after "${act}"`);
        harness.assertEqual(game.ap, initAp, `AP unchanged after rejected "${act}"`);
      }
    });

    await harness.it('Blocks all tactical actions after game over in InfoWar._createEngine', () => {
      const testEng = InfoWar._createEngine({
        nodes: [{ id: 'n1', name: 'Node 1', type: 'Press', reach: 0.5, resistance: 0.5, infection: 0.5, trust: 0.5 }],
        maxTurns: 5,
        apPerTurn: 10
      });
      testEng.gameOver = true;
      harness.assertEqual(testEng.quarantine('n1').ok, false, 'Quarantine blocked when gameOver');
      harness.assertEqual(testEng.immunize('n1').ok, false, 'Immunize blocked when gameOver');
      harness.assertEqual(testEng.counterMessage('n1').ok, false, 'CounterMessage blocked when gameOver');
      harness.assertEqual(testEng.exposeBotnet('n1').ok, false, 'ExposeBotnet blocked when gameOver');
      harness.assertEqual(testEng.deployC2PAProvenance().ok, false, 'deployC2PAProvenance blocked when gameOver');
      harness.assertEqual(testEng.deployCircuitBreaker().ok, false, 'deployCircuitBreaker blocked when gameOver');
      harness.assertEqual(testEng.deployOsintTakedown().ok, false, 'deployOsintTakedown blocked when gameOver');
      harness.assertEqual(testEng.ap, 10, 'AP unspent after blocked actions');
    });

    await harness.it('Safely generates edges on small networks without TypeErrors', () => {
      const emptyEdges = InfoWar._generateEdges([], 'hierarchy');
      harness.assertEqual(Array.isArray(emptyEdges), true, 'Empty nodes returns array');
      harness.assertEqual(emptyEdges.length, 0, 'Empty nodes returns empty edges');

      const singleNodeEdges = InfoWar._generateEdges([{ id: 'n1' }], 'hierarchy');
      harness.assertEqual(singleNodeEdges.length, 0, 'Single node hierarchy returns empty edges');

      const twoNodeEdgesH = InfoWar._generateEdges([{ id: 'n1' }, { id: 'n2' }], 'hierarchy');
      harness.assertEqual(Array.isArray(twoNodeEdgesH), true, 'Two nodes hierarchy returns array');

      const twoNodeEdgesHS = InfoWar._generateEdges([{ id: 'n1' }, { id: 'n2' }], 'hub-spoke');
      harness.assertEqual(Array.isArray(twoNodeEdgesHS), true, 'Two nodes hub-spoke returns array');
    });
  });

  // ----------------------------------------------------
  // Tier 2: Terminal States (Defeat & Victory Conditions)
  // ----------------------------------------------------
  await harness.describe('Tier 2: Terminal States & Win/Loss Boundaries', async () => {
    await harness.it('Triggers Defeat state when Panic >= 85 or Health < 20', () => {
      const defeatGame = new InfoWarEngine();
      // Force extreme contamination across all nodes
      for (const n of defeatGame.nodes) {
        n.infection = 95;
        n.trust = 5;
      }
      defeatGame.endTurn();
      harness.assertEqual(defeatGame.gameOver, true, 'Game over triggered by panic surge');
      harness.assertEqual(defeatGame.won, false, 'Won is false (Defeat)');
    });

    await harness.it('Blocks actions after Game Over', () => {
      const defeatGame = new InfoWarEngine();
      defeatGame.gameOver = true;
      const res = defeatGame.takeAction('debunk', 'node-1');
      harness.assertEqual(res.success, false, 'Action blocked after game over');
    });

    await harness.it('Achieves Victory when surviving 8 turns with Health >= 60 and Panic <= 40', () => {
      const vicGame = new InfoWarEngine();
      // Clean nodes to pristine health
      for (const n of vicGame.nodes) {
        n.infection = 10;
        n.trust = 90;
        n.resistance = 0.80;
      }
      // Play through turns 1 to 8
      for (let t = 1; t <= 8; t++) {
        vicGame.takeAction('attestation');
        vicGame.endTurn();
      }
      harness.assertEqual(vicGame.gameOver, true, 'Game completed at Turn 8');
      harness.assertEqual(vicGame.won, true, 'Victory state achieved');
      harness.assertGreaterOrEqual(vicGame.health, 60, 'Final health >= 60');
      harness.assertLessOrEqual(vicGame.panic, 40, 'Final panic <= 40');
    });
  });

  // ----------------------------------------------------
  // Tier 3: Full Multi-Turn Campaign & After-Action Report (AAR)
  // ----------------------------------------------------
  await harness.describe('Tier 3: Multi-Turn Campaign Playthrough & AAR Telemetry', async () => {
    await harness.it('Simulates complete 8-turn defensive operation and generates AAR', () => {
      // Load campaign from scenarios.json if available
      let campaignData = null;
      try {
        const scenariosRaw = fs.readFileSync(path.join(DATA_DIR, 'scenarios.json'), 'utf8');
        const scenarios = JSON.parse(scenariosRaw);
        campaignData = scenarios.infowarCampaigns?.[0];
      } catch {}

      const sim = new InfoWarEngine(campaignData || {});
      harness.assertEqual(sim.turn, 1, 'Campaign started at turn 1');

      // Tactical Loop across 8 turns
      for (let t = 1; t <= 8; t++) {
        // Tactic: Inoculate high reach nodes (3 AP), Debunk infected nodes (4 AP), apply Friction (2 AP)
        if (sim.ap >= 4) {
          // Find most infected node
          const highestInfNode = [...sim.nodes].sort((a, b) => b.infection - a.infection)[0];
          sim.takeAction('debunk', highestInfNode.id);
        }
        if (sim.ap >= 3) {
          // Inoculate lowest resistance node with high reach
          const target = [...sim.nodes].sort((a, b) => (b.reach - a.resistance) - (a.reach - b.resistance))[0];
          sim.takeAction('inoculate', target.id);
        }
        if (sim.ap >= 2) {
          sim.takeAction('friction');
        }
        sim.endTurn();
      }

      harness.assertEqual(sim.gameOver, true, 'Simulation ended at turn 8');
      harness.assertEqual(sim.history.length, 8, 'History recorded 8 turns');

      const aar = sim.generateAAR();
      harness.assert(Boolean(aar), 'AAR generated');
      harness.assertEqual(aar.outcome, sim.won ? 'VICTORY' : 'DEFEAT', 'AAR outcome matches game state');
      harness.assert(aar.totalApSpent > 0, `Total AP spent recorded: ${aar.totalApSpent}`);
      harness.assert(typeof aar.containmentEfficiency === 'number', 'Containment efficiency is number');
      harness.assert(typeof aar.performanceGrade === 'string', `Performance grade assigned: ${aar.performanceGrade}`);
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
  console.error('Fatal error running infowar test suite:', err);
  process.exit(1);
});
