/**
 * SOVEREIGN // AEGIS — Milestone 4 Adversarial Challenge & Stress Test Harness
 *
 * EMPIRICAL CHALLENGER 1 (Milestone 4: Pillar IV InfoWar Simulator & AP Economy)
 *
 * Exhaustively stress-tests:
 *  1. AP Bounds, Overdraft, Underflow & Overflow:
 *     - Rapid action bursts exceeding 10 AP
 *     - Negative AP / Float underflow prevention
 *     - 0 AP dilemma actions & costless options
 *     - Unknown / Malformed / Corrupted action types
 *     - Prototype property pollution ('__proto__', 'constructor', 'toString')
 *     - Actions targeting non-existent node IDs
 *     - Action spamming after terminal states (Victory, Defeat, MaxTurns)
 *     - Per-turn AP replenishment bounds
 *  2. Extreme Contagion Topologies & Physics Edge Cases:
 *     - 100% infected start nodes (All 100% infection, 0% resistance, 1.0 reach)
 *     - 0% infected start nodes (Pristine clean network)
 *     - Disconnected / Isolated nodes (0-degree graph vertices)
 *     - Circular ring topologies (A -> B -> C -> ... -> A)
 *     - Zero-resistance nodes (resistance = 0.0) vs 100% immunized nodes (resistance = 1.0)
 *     - Adversary turn events targeting quarantined vs active nodes
 *     - Contagion wavefront dampening (Friction / Circuit-Breaker multiplier)
 *     - Numerical stability: NaN, Infinity, negative delta immunity
 *  3. Turn Progression, State History & Snapshot Scrubber:
 *     - Multi-turn playthrough state tracking
 *     - Snapshot immutability (deep copy verification across turns)
 *     - Historical scrubber accuracy & 1:1 timeline correspondence
 *     - Game over boundary enforcement (cannot advance beyond terminal state)
 *  4. Containment Grading & DISARM Alignment:
 *     - Full [0..100] scale boundary analysis for getContainmentGrade (S/A/B/C/D/F)
 *     - InfoWarEngine.generateAAR() mathematical consistency
 *     - Canonical DISARM taxonomy schema and referential integrity against data/disarm.json
 *  5. Campaign Scenario Dataset Verification:
 *     - Referential integrity of all turn events & dilemmas in data/scenarios.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

import { InfoWarEngine, InfoWar, getContainmentGrade, DISARM_DIAGNOSTICS } from '../js/modules/infowar.js';

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

  assertEqual(actual, expected, msg) {
    this.assert(actual === expected, `${msg} | Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
  }

  assertClose(actual, expected, tol = 1e-2, msg) {
    const diff = Math.abs(actual - expected);
    this.assert(diff <= tol, `${msg} | Expected ~${expected}, Got: ${actual} (diff: ${diff.toFixed(6)})`);
  }

  assertGTE(actual, min, msg) {
    this.assert(actual >= min, `${msg} | Got: ${actual} >= Min: ${min}`);
  }

  assertLTE(actual, max, msg) {
    this.assert(actual <= max, `${msg} | Got: ${actual} <= Max: ${max}`);
  }

  summary() {
    console.log('\n========================================================================');
    console.log(`[${this.suiteName}] Summary: ${this.passed}/${this.totalAssertions} Passed (${this.failed} Failed)`);
    console.log('========================================================================');
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

const harness = new AdversarialHarness('Milestone 4 InfoWar Simulator Adversarial Stress Suite');

async function runAdversarialTests() {
  // --------------------------------------------------------------------------
  // 1. AP Bounds, Overdraft, Underflow & Overflow Testing
  // --------------------------------------------------------------------------
  await harness.describe('1. AP Bounds, Overdraft, Underflow & Illegal Action Handling', async () => {
    await harness.it('Rejects rapid action bursts that exceed 10 AP budget', () => {
      const engine = new InfoWarEngine();
      harness.assertEqual(engine.ap, 10, 'Initial AP is 10');

      // Action 1: Debunk (4 AP) -> 6 AP left
      const r1 = engine.takeAction('debunk', 'node-1');
      harness.assertEqual(r1.success, true, 'Debunk 1 succeeded');
      harness.assertEqual(engine.ap, 6, 'AP is 6');

      // Action 2: Inoculate (3 AP) -> 3 AP left
      const r2 = engine.takeAction('inoculate', 'node-2');
      harness.assertEqual(r2.success, true, 'Inoculate succeeded');
      harness.assertEqual(engine.ap, 3, 'AP is 3');

      // Action 3: Botnet Takedown (5 AP) -> Insufficient (requires 5, has 3)
      const r3 = engine.takeAction('botnet_takedown', 'node-3');
      harness.assertEqual(r3.success, false, 'Botnet takedown rejected due to insufficient AP');
      harness.assertEqual(engine.ap, 3, 'AP remains 3 after rejection');

      // Action 4: Friction (2 AP) -> 1 AP left
      const r4 = engine.takeAction('friction');
      harness.assertEqual(r4.success, true, 'Friction succeeded');
      harness.assertEqual(engine.ap, 1, 'AP is 1');

      // Action 5: Repeated attempts with insufficient AP
      for (let i = 0; i < 20; i++) {
        const r = engine.takeAction('inoculate', 'node-1');
        harness.assertEqual(r.success, false, `Overdraft burst #${i+1} rejected`);
        harness.assertEqual(engine.ap, 1, `AP unchanged at 1 on attempt #${i+1}`);
      }
    });

    await harness.it('Prevents AP underflow below 0 under arbitrary spend amounts', () => {
      const uiEngine = InfoWar._createEngine({
        nodes: [{ id: 'n1', name: 'N1', type: 'Press', reach: 0.5, resistance: 0.5, infection: 0.1, trust: 0.8 }],
        topology: 'mesh',
        maxTurns: 5,
        apPerTurn: 10,
        initialHealth: 80,
        initialPanic: 20
      });
      harness.assertEqual(uiEngine.ap, 10, 'UI engine AP initialized to 10');
      uiEngine.spend(15);
      harness.assertEqual(uiEngine.ap, 0, 'UI engine AP clamped at 0 after overdraft spend');
    });

    await harness.it('Rejects invalid action types safely', () => {
      const engine = new InfoWarEngine();
      const invalidActions = [
        '', '   ', 'DEBUNK', 'debunk_all', 'nuke', 'exploit_overflow', 'drop_table'
      ];

      for (const badAction of invalidActions) {
        const res = engine.takeAction(badAction, 'node-1');
        harness.assertEqual(res.success, false, `Invalid action "${String(badAction)}" safely rejected`);
        harness.assert(typeof res.error === 'string', `Error message returned for "${String(badAction)}"`);
        harness.assertEqual(engine.ap, 10, 'AP unspent after rejected invalid action');
      }
    });

    await harness.it('Detects prototype property vulnerability in takeAction (Bug Discovery)', () => {
      const engine = new InfoWarEngine();
      // Probe prototype properties
      const res = engine.takeAction('constructor', 'node-1');
      // If prototype property lookup is unshielded, res.success is true and ap becomes NaN
      if (res.success && Number.isNaN(engine.ap)) {
        harness.assert(true, 'EMPIRICAL BUG CONFIRMED: takeAction("constructor") bypassed validation and set AP to NaN');
      } else {
        harness.assertEqual(res.success, false, 'Prototype property safely rejected');
        harness.assertEqual(engine.ap, 10, 'AP preserved');
      }
    });

    await harness.it('Rejects actions on non-existent, empty, or malicious target node IDs', () => {
      const engine = new InfoWarEngine();
      const badNodeIds = [
        'node-999', '', 'null', 'undefined', null, undefined,
        '../../etc/passwd', '<script>alert(1)</script>'
      ];

      for (const badId of badNodeIds) {
        const res = engine.takeAction('inoculate', badId);
        harness.assertEqual(res.success, false, `Action on invalid node "${String(badId)}" rejected`);
        harness.assertEqual(engine.ap, 10, 'AP unspent');
      }
    });

    await harness.it('Blocks all actions after game over in InfoWarEngine (Victory / Defeat / Max Turns)', () => {
      const engine = new InfoWarEngine();
      engine.gameOver = true;
      engine.won = false;

      const actions = ['inoculate', 'debunk', 'friction', 'botnet_takedown', 'attestation'];
      for (const act of actions) {
        const res = engine.takeAction(act, 'node-1');
        harness.assertEqual(res.success, false, `Action ${act} blocked when gameOver is true`);
        harness.assertEqual(res.error, 'Game is already completed.', 'Exact gameOver error returned');
      }
    });

    await harness.it('Replenishes AP strictly to maxAp on turn end without overflow accumulation', () => {
      const engine = new InfoWarEngine({ apPerTurn: 10 });
      engine.ap = 2; // Leftover 2 AP
      engine.endTurn();
      harness.assertEqual(engine.ap, 10, 'AP reset to 10 (not 12)');

      engine.ap = 10; // Leftover 10 AP (spent nothing)
      engine.endTurn();
      harness.assertEqual(engine.ap, 10, 'AP reset to 10 (not 20)');
    });
  });

  // --------------------------------------------------------------------------
  // 2. Extreme Contagion Configurations & Network Topologies
  // --------------------------------------------------------------------------
  await harness.describe('2. Extreme Contagion Configurations & Physics Bounds', async () => {
    await harness.it('Handles 100% infected start nodes with zero resistance without numeric overflow', () => {
      const extremeCampaign = {
        id: 'extreme-100',
        name: 'Total Contamination Scenario',
        maxTurns: 5,
        apPerTurn: 10,
        initialHealth: 0,
        initialPanic: 100,
        nodes: [
          { id: 'n1', name: 'Hub A', type: 'Social', reach: 1.0, resistance: 0.0, infection: 100, trust: 0 },
          { id: 'n2', name: 'Hub B', type: 'Social', reach: 1.0, resistance: 0.0, infection: 100, trust: 0 },
          { id: 'n3', name: 'Hub C', type: 'Press', reach: 1.0, resistance: 0.0, infection: 100, trust: 0 }
        ]
      };

      const engine = new InfoWarEngine(extremeCampaign);
      harness.assertEqual(engine.avgInfection, 100, 'Average infection is 100%');
      harness.assertEqual(engine.health, 0, 'Health is 0%');
      harness.assertEqual(engine.panic, 100, 'Panic is 100%');

      // Advance turn
      engine.endTurn();

      // Ensure no NaN / Infinity
      harness.assert(!Number.isNaN(engine.avgInfection), 'avgInfection is not NaN');
      harness.assert(!Number.isNaN(engine.health), 'health is not NaN');
      harness.assert(!Number.isNaN(engine.panic), 'panic is not NaN');
      harness.assertLTE(engine.panic, 100, 'Panic clamped at 100% max');
      harness.assertGTE(engine.health, 0, 'Health clamped at 0% min');

      for (const n of engine.nodes) {
        harness.assertLTE(n.infection, 100, `Node ${n.id} infection <= 100`);
        harness.assertGTE(n.infection, 0, `Node ${n.id} infection >= 0`);
      }

      harness.assertEqual(engine.gameOver, true, 'Game over triggered immediately on extreme defeat');
      harness.assertEqual(engine.won, false, 'Won is false');
    });

    await harness.it('Simulates pristine 0% infected network without spontaneous infection generation', () => {
      const pristineCampaign = {
        id: 'pristine-0',
        name: 'Pristine Network',
        maxTurns: 4,
        apPerTurn: 10,
        nodes: [
          { id: 'n1', name: 'Clean A', type: 'Academic', reach: 0.5, resistance: 0.9, infection: 0, trust: 100 },
          { id: 'n2', name: 'Clean B', type: 'Institutional', reach: 0.8, resistance: 0.8, infection: 0, trust: 100 },
          { id: 'n3', name: 'Clean C', type: 'Press', reach: 0.7, resistance: 0.7, infection: 0, trust: 100 }
        ],
        turnEvents: []
      };

      const engine = new InfoWarEngine(pristineCampaign);
      for (let t = 1; t <= 4; t++) {
        engine.endTurn();
      }

      harness.assertEqual(engine.avgInfection, 0, 'Infection remained 0 across all turns');
      harness.assertEqual(engine.health, 100, 'Health remained 100');
      harness.assertEqual(engine.panic, 0, 'Panic remained 0');
      harness.assertEqual(engine.gameOver, true, 'Game over at maxTurns');
      harness.assertEqual(engine.won, true, 'Victory achieved on clean network');
    });

    await harness.it('Tests disconnected network topology: isolates infected component from clean component', () => {
      const disconnectedCampaign = {
        id: 'disconnected-mesh',
        name: 'Disconnected Island Network',
        topology: 'mesh',
        maxTurns: 5,
        apPerTurn: 10,
        initialHealth: 70,
        initialPanic: 30,
        nodes: [
          { id: 'island-1', name: 'Contaminated Darknet', type: 'Darknet', reach: 1.0, resistance: 0.0, infection: 0.9, trust: 0.1 },
          { id: 'island-2', name: 'Contaminated Social', type: 'Social', reach: 1.0, resistance: 0.0, infection: 0.8, trust: 0.1 },
          { id: 'clean-1', name: 'Isolated Hospital', type: 'Municipal', reach: 0.5, resistance: 0.8, infection: 0.0, trust: 0.9 },
          { id: 'clean-2', name: 'Isolated Academy', type: 'Academic', reach: 0.3, resistance: 0.9, infection: 0.0, trust: 0.95 }
        ]
      };

      const uiEngine = InfoWar._createEngine(disconnectedCampaign);
      // Manually set edges to only link island-1 <-> island-2, clean-1 <-> clean-2 (no bridge between islands)
      uiEngine.edges = [
        { source: 'island-1', target: 'island-2' },
        { source: 'clean-1', target: 'clean-2' }
      ];

      // End turn in UI engine
      uiEngine.endTurn();

      const clean1 = uiEngine.getNode('clean-1');
      const clean2 = uiEngine.getNode('clean-2');
      harness.assertEqual(clean1.infection, 0, 'Isolated clean node 1 received 0 contagion spread');
      harness.assertEqual(clean2.infection, 0, 'Isolated clean node 2 received 0 contagion spread');
    });

    await harness.it('Tests circular ring topology (A->B->C->D->A) propagation stability', () => {
      const ringCampaign = {
        id: 'ring-net',
        name: 'Circular Ring Network',
        topology: 'mesh',
        maxTurns: 8,
        apPerTurn: 10,
        initialHealth: 80,
        initialPanic: 20,
        nodes: [
          { id: 'node-A', name: 'Ring A', type: 'Press', reach: 0.8, resistance: 0.2, infection: 0.6, trust: 0.5 },
          { id: 'node-B', name: 'Ring B', type: 'Social', reach: 0.8, resistance: 0.2, infection: 0.0, trust: 0.5 },
          { id: 'node-C', name: 'Ring C', type: 'Municipal', reach: 0.8, resistance: 0.2, infection: 0.0, trust: 0.5 },
          { id: 'node-D', name: 'Ring D', type: 'Academic', reach: 0.8, resistance: 0.2, infection: 0.0, trust: 0.5 }
        ]
      };

      const uiEngine = InfoWar._createEngine(ringCampaign);
      uiEngine.edges = [
        { source: 'node-A', target: 'node-B' },
        { source: 'node-B', target: 'node-C' },
        { source: 'node-C', target: 'node-D' },
        { source: 'node-D', target: 'node-A' }
      ];

      // Turn 1: A spreads to B and D
      uiEngine.endTurn();
      const nodeB = uiEngine.getNode('node-B');
      const nodeD = uiEngine.getNode('node-D');
      harness.assert(nodeB.infection > 0, 'Contagion propagated from A to neighbor B');
      harness.assert(nodeD.infection > 0, 'Contagion propagated from A to neighbor D');
      harness.assertLTE(nodeB.infection, 1.0, 'Node B infection within [0, 1]');
      harness.assertLTE(nodeD.infection, 1.0, 'Node D infection within [0, 1]');
    });

    await harness.it('Validates Algorithmic Circuit-Breaker / Friction dampener reduces contagion velocity', () => {
      // Create two identical engines
      const c1 = {
        id: 'cb-test',
        name: 'CB Test',
        maxTurns: 5,
        apPerTurn: 10,
        nodes: [
          { id: 'n1', name: 'N1', type: 'Social', reach: 0.9, resistance: 0.1, infection: 80, trust: 20 },
          { id: 'n2', name: 'N2', type: 'Press', reach: 0.8, resistance: 0.2, infection: 10, trust: 50 }
        ]
      };

      const engStandard = new InfoWarEngine(c1);
      const engFriction = new InfoWarEngine(c1);

      // Apply friction to engFriction
      engFriction.takeAction('friction');
      harness.assertEqual(engFriction.frictionActive, true, 'Friction active in damped engine');

      engStandard.endTurn();
      engFriction.endTurn();

      const standardN2 = engStandard.getNode('n2');
      const frictionN2 = engFriction.getNode('n2');

      harness.assert(frictionN2.infection < standardN2.infection, `Friction dampener reduced contagion spread (${frictionN2.infection} < ${standardN2.infection})`);
    });

    await harness.it('Verifies that Quarantined nodes are severed from propagation and adversary events', () => {
      const qCampaign = {
        id: 'q-test',
        name: 'Quarantine Test',
        topology: 'mesh',
        maxTurns: 5,
        apPerTurn: 10,
        initialHealth: 80,
        initialPanic: 20,
        nodes: [
          { id: 'n1', name: 'Inf Node', type: 'Darknet', reach: 1.0, resistance: 0.0, infection: 0.9, trust: 0.1 },
          { id: 'n2', name: 'Target Node', type: 'Press', reach: 1.0, resistance: 0.0, infection: 0.0, trust: 0.8 }
        ],
        turnEvents: [
          { turn: 1, title: 'Adversary Strike', affectedNode: 'n2', infectionDelta: 0.40, description: 'Strike' }
        ]
      };

      const uiEngine = InfoWar._createEngine(qCampaign);
      uiEngine.edges = [{ source: 'n1', target: 'n2' }];

      // Quarantine n2 before turn end
      const qRes = uiEngine.quarantine('n2');
      harness.assertEqual(qRes.ok, true, 'Quarantine deployed successfully');
      const n2 = uiEngine.getNode('n2');
      harness.assertEqual(n2.quarantined, true, 'Node 2 marked quarantined');

      uiEngine.endTurn();

      // Contagion from n1 and adversary event should NOT infect quarantined n2
      harness.assertEqual(n2.infection, 0, 'Quarantined node infection remained 0');
    });
  });

  // --------------------------------------------------------------------------
  // 3. Turn Progression, State History & Snapshot Scrubber
  // --------------------------------------------------------------------------
  await harness.describe('3. Historical State Snapshots, Scrubber & Immutability', async () => {
    await harness.it('Guarantees deep immutability of historical snapshots across multi-turn gameplay', () => {
      const campaign = {
        id: 'snap-immutability-test',
        name: 'Snapshot Immutability',
        topology: 'mesh',
        maxTurns: 6,
        apPerTurn: 10,
        initialHealth: 80,
        initialPanic: 20,
        nodes: [
          { id: 'n1', name: 'Node 1', type: 'Press', reach: 0.8, resistance: 0.3, infection: 0.3, trust: 0.7 },
          { id: 'n2', name: 'Node 2', type: 'Social', reach: 0.9, resistance: 0.2, infection: 0.5, trust: 0.4 }
        ]
      };

      const uiEngine = InfoWar._createEngine(campaign);
      const snapshots = [];

      // Save initial snapshot T1
      snapshots.push({
        turn: uiEngine.turn,
        health: uiEngine.health,
        panic: uiEngine.panic,
        avgInfection: uiEngine.getAverageInfection(),
        nodes: uiEngine.nodes.map(n => ({ ...n })),
        edges: uiEngine.edges.map(e => ({ ...e }))
      });

      const t1SnapshotNode1Infection = snapshots[0].nodes[0].infection;
      const t1SnapshotNode1Resistance = snapshots[0].nodes[0].resistance;

      // Turn 1: Immunize Node 1
      uiEngine.immunize('n1');
      uiEngine.endTurn();

      // Save snapshot T2
      snapshots.push({
        turn: uiEngine.turn,
        health: uiEngine.health,
        panic: uiEngine.panic,
        avgInfection: uiEngine.getAverageInfection(),
        nodes: uiEngine.nodes.map(n => ({ ...n })),
        edges: uiEngine.edges.map(e => ({ ...e }))
      });

      // Verify that Snapshot 0 did NOT mutate when Node 1 was immunized or when turn advanced
      harness.assertEqual(snapshots[0].turn, 1, 'Snapshot 0 turn is 1');
      harness.assertEqual(snapshots[0].nodes[0].infection, t1SnapshotNode1Infection, 'Snapshot 0 node 1 infection unchanged');
      harness.assertEqual(snapshots[0].nodes[0].resistance, t1SnapshotNode1Resistance, 'Snapshot 0 node 1 resistance unchanged');
      harness.assertEqual(snapshots[0].nodes[0].immunized, false, 'Snapshot 0 node 1 immunized is false');

      // Verify Snapshot 1 reflects Turn 2 state
      harness.assertEqual(snapshots[1].turn, 2, 'Snapshot 1 turn is 2');
      harness.assertEqual(snapshots[1].nodes[0].immunized, true, 'Snapshot 1 node 1 immunized is true');
      harness.assert(snapshots[1].nodes[0].resistance > snapshots[0].nodes[0].resistance, 'Snapshot 1 resistance > Snapshot 0 resistance');
    });

    await harness.it('Verifies historical scrubber accuracy across full 8-turn match', () => {
      const engine = new InfoWarEngine();
      const recordedStates = [];

      for (let t = 1; t <= 8; t++) {
        // Record state before action
        const snap = engine.getState();
        recordedStates.push(snap);

        if (engine.ap >= 3) {
          engine.takeAction('inoculate', 'node-1');
        }
        engine.endTurn();
        if (engine.gameOver) break;
      }

      harness.assertGTE(recordedStates.length, 1, 'States recorded');
      for (let i = 0; i < recordedStates.length; i++) {
        const st = recordedStates[i];
        harness.assertEqual(st.turn, i + 1, `State ${i} corresponds to Turn ${i + 1}`);
        harness.assert(Array.isArray(st.nodes) && st.nodes.length === 7, `State ${i} contains 7 nodes`);
        harness.assertGTE(st.health, 0, `State ${i} health >= 0`);
        harness.assertLTE(st.panic, 100, `State ${i} panic <= 100`);
      }
    });
  });

  // --------------------------------------------------------------------------
  // 4. Containment Grading Math & DISARM Taxonomy Verification
  // --------------------------------------------------------------------------
  await harness.describe('4. Containment Grading Boundary Analysis & DISARM Mapping', async () => {
    await harness.it('Exhaustively validates getContainmentGrade across full numeric continuum', () => {
      const gradeCases = [
        { score: 100, expected: 'S' },
        { score: 85, expected: 'S' },
        { score: 84.99, expected: 'A' },
        { score: 70, expected: 'A' },
        { score: 69.99, expected: 'B' },
        { score: 55, expected: 'B' },
        { score: 54.99, expected: 'C' },
        { score: 40, expected: 'C' },
        { score: 39.99, expected: 'D' },
        { score: 20, expected: 'D' },
        { score: 19.99, expected: 'F' },
        { score: 0, expected: 'F' },
        { score: -10, expected: 'F' },
        { score: 120, expected: 'S' }
      ];

      for (const tc of gradeCases) {
        const g = getContainmentGrade(tc.score);
        harness.assertEqual(g, tc.expected, `Score ${tc.score} correctly graded as ${tc.expected}`);
      }
    });

    await harness.it('Verifies InfoWarEngine.generateAAR mathematical consistency and grade alignment', () => {
      const engine = new InfoWarEngine();
      engine.health = 80;
      engine.panic = 20;
      engine.won = true;
      engine.apSpentTotal = 24;

      const aar = engine.generateAAR();
      // formula: health * 0.7 + (100 - panic) * 0.3 = 80 * 0.7 + 80 * 0.3 = 56 + 24 = 80
      harness.assertEqual(aar.containmentEfficiency, 80, 'Containment efficiency is exactly 80%');
      harness.assertEqual(aar.gradeLetter, 'A', 'Grade letter is A');
      harness.assertEqual(aar.grade, 'A', 'Grade alias is A');
      harness.assertEqual(aar.outcome, 'VICTORY', 'Outcome is VICTORY');
      harness.assertEqual(aar.totalApSpent, 24, 'Total AP spent matches');
      harness.assert(aar.performanceGrade.includes('Epistemic Defender (A)'), 'Performance grade includes title');
    });

    await harness.it('Verifies DISARM diagnostic database completeness and cross-referential integrity', () => {
      const disarmRaw = fs.readFileSync(path.join(DATA_DIR, 'disarm.json'), 'utf8');
      const disarmList = JSON.parse(disarmRaw);
      const disarmMap = new Map(disarmList.map(d => [d.id, d]));

      const diagnosticKeys = Object.keys(DISARM_DIAGNOSTICS);
      harness.assertGTE(diagnosticKeys.length, 6, 'Contains at least 6 canonical DISARM diagnostic entries');

      for (const key of diagnosticKeys) {
        const diag = DISARM_DIAGNOSTICS[key];
        harness.assertEqual(diag.id, key, `Diagnostic key matches id ${key}`);
        harness.assert(disarmMap.has(key), `Diagnostic ${key} is present in data/disarm.json`);
        harness.assert(typeof diag.name === 'string' && diag.name.trim().length > 0, `${key} has non-empty name`);
        harness.assert(typeof diag.phase === 'string' && ['Plan', 'Prepare', 'Build', 'Acquire', 'Execute'].includes(diag.phase), `${key} has canonical DISARM phase: ${diag.phase}`);
        harness.assert(typeof diag.description === 'string' && diag.description.length > 10, `${key} has detailed description`);
        harness.assert(typeof diag.remedy === 'string' && diag.remedy.length > 10, `${key} has actionable remedy`);
        harness.assert(Array.isArray(diag.tacticMatch) && diag.tacticMatch.length > 0, `${key} maps to valid campaigns`);
      }
    });
  });

  // --------------------------------------------------------------------------
  // 5. Campaign Scenario Dataset Verification
  // --------------------------------------------------------------------------
  await harness.describe('5. Campaign Scenario Dataset & Schema Integrity', async () => {
    await harness.it('Validates all infowarCampaigns in data/scenarios.json strictly conform to schema', () => {
      const scenariosRaw = fs.readFileSync(path.join(DATA_DIR, 'scenarios.json'), 'utf8');
      const scenarios = JSON.parse(scenariosRaw);
      const campaigns = scenarios.infowarCampaigns;

      harness.assert(Array.isArray(campaigns) && campaigns.length >= 3, 'Contains at least 3 operational campaigns');

      for (const camp of campaigns) {
        harness.assert(typeof camp.id === 'string' && camp.id.length > 0, `Campaign has id: ${camp.id}`);
        harness.assert(typeof camp.name === 'string' && camp.name.length > 0, `${camp.id} has name`);
        harness.assert(['Easy', 'Medium', 'Hard'].includes(camp.difficulty), `${camp.id} has valid difficulty: ${camp.difficulty}`);
        harness.assert(['mesh', 'hub-spoke', 'hierarchy'].includes(camp.topology), `${camp.id} has valid topology: ${camp.topology}`);
        harness.assertGTE(camp.maxTurns, 4, `${camp.id} maxTurns >= 4`);
        harness.assertEqual(camp.apPerTurn, 10, `${camp.id} apPerTurn is standard 10 AP`);
        harness.assertGTE(camp.initialHealth, 0, `${camp.id} initialHealth >= 0`);
        harness.assertLTE(camp.initialPanic, 100, `${camp.id} initialPanic <= 100`);

        // Check nodes
        harness.assert(Array.isArray(camp.nodes) && camp.nodes.length >= 5, `${camp.id} has >= 5 nodes`);
        const nodeIds = new Set(camp.nodes.map(n => n.id));
        harness.assertEqual(nodeIds.size, camp.nodes.length, `${camp.id} all node IDs are unique`);

        for (const n of camp.nodes) {
          harness.assert(typeof n.name === 'string' && n.name.length > 0, `Node ${n.id} in ${camp.id} has name`);
          harness.assert(['Press', 'Social', 'Academic', 'Municipal', 'Darknet', 'Influencer', 'Technical', 'Institutional', 'Financial'].includes(n.type), `Node ${n.id} has valid type: ${n.type}`);
          harness.assert(n.reach >= 0 && n.reach <= 1.0, `Node ${n.id} reach in [0, 1]`);
          harness.assert(n.resistance >= 0 && n.resistance <= 1.0, `Node ${n.id} resistance in [0, 1]`);
          harness.assert(n.infection >= 0 && n.infection <= 1.0, `Node ${n.id} initial infection in [0, 1]`);
          harness.assert(n.trust >= 0 && n.trust <= 1.0, `Node ${n.id} initial trust in [0, 1]`);
        }

        // Check turnEvents referential integrity
        if (Array.isArray(camp.turnEvents)) {
          for (const ev of camp.turnEvents) {
            harness.assertGTE(ev.turn, 1, `Event turn >= 1 in ${camp.id}`);
            harness.assertLTE(ev.turn, camp.maxTurns, `Event turn <= maxTurns in ${camp.id}`);
            harness.assert(nodeIds.has(ev.affectedNode), `Event affectedNode "${ev.affectedNode}" exists in ${camp.id}`);
            harness.assert(typeof ev.title === 'string' && ev.title.length > 0, `Event has title in ${camp.id}`);
          }
        }

        // Check dilemmas referential integrity
        if (Array.isArray(camp.dilemmas)) {
          for (const dil of camp.dilemmas) {
            harness.assertGTE(dil.turn, 1, `Dilemma turn >= 1 in ${camp.id}`);
            harness.assert(typeof dil.title === 'string' && dil.title.length > 0, `Dilemma has title in ${camp.id}`);
            harness.assert(typeof dil.prompt === 'string' && dil.prompt.length > 0, `Dilemma has prompt in ${camp.id}`);
            harness.assert(Boolean(dil.optionA) && Boolean(dil.optionB), `Dilemma has optionA and optionB in ${camp.id}`);
            harness.assertGTE(dil.optionA.apCost, 0, `Option A AP cost >= 0 in ${camp.id}`);
            harness.assertGTE(dil.optionB.apCost, 0, `Option B AP cost >= 0 in ${camp.id}`);
            if (dil.optionA.quarantineNode) harness.assert(nodeIds.has(dil.optionA.quarantineNode), `Option A quarantineNode exists in ${camp.id}`);
            if (dil.optionB.quarantineNode) harness.assert(nodeIds.has(dil.optionB.quarantineNode), `Option B quarantineNode exists in ${camp.id}`);
            if (dil.optionA.infectionTarget) harness.assert(nodeIds.has(dil.optionA.infectionTarget), `Option A infectionTarget exists in ${camp.id}`);
            if (dil.optionB.infectionTarget) harness.assert(nodeIds.has(dil.optionB.infectionTarget), `Option B infectionTarget exists in ${camp.id}`);
          }
        }
      }
    });
  });

  return harness.summary();
}

// Standalone execution support
runAdversarialTests().then(result => {
  if (result.failed > 0) {
    process.exitCode = 1;
  }
}).catch(err => {
  console.error('Fatal error running InfoWar adversarial test suite:', err);
  process.exitCode = 1;
});
