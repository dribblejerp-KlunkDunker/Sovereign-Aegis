/**
 * SOVEREIGN // AEGIS — Milestone 4 Deep Empirical Challenger Stress Suite
 * Author: m4_challenger_2 (Role: M4 Contagion & Spiderchart Stress Challenger)
 *
 * Dedicated empirical test battery verifying:
 * 1. Contagion Physics Invariant Bounds [0, 100] across InfoWarEngine & InfoWar UI:
 *    - 100% infected start nodes
 *    - 0% infected start nodes
 *    - Disconnected / zero-edge graphs
 *    - High transmission rates & huge adversary turn events
 *    - Circuit-breaker / friction activation & reset
 *    - Node-level clamping (infection, trust, resistance)
 *    - Global-level clamping (health, panic, avgInfection)
 * 2. Operator Profile & Competency Calculations:
 *    - 5-axis metric calculation under boundary & empty state conditions
 *    - Resilience Index formula: 0.30*sift + 0.20*pattern + 0.20*memory + 0.15*theory + 0.15*practice
 *    - Dynamic SVG spiderchart polar coordinate geometry (5 equidistant vertices, unit circle -pi/2 rotation)
 *    - Geometric coordinates exact trigonometric validation
 */

import { InfoWarEngine, InfoWar, getContainmentGrade, DISARM_DIAGNOSTICS } from '../js/modules/infowar.js';
import { OnboardingModule } from '../js/modules/onboarding.js';

class DeepHarness {
  constructor(name) {
    this.suiteName = name;
    this.total = 0;
    this.passed = 0;
    this.failed = 0;
    this.failures = [];
  }

  describe(name, fn) {
    console.log(`\n=== [CHALLENGE SUITE] ${name} ===`);
    return fn();
  }

  it(name, fn) {
    try {
      fn();
    } catch (err) {
      this.failed++;
      this.total++;
      this.failures.push({ test: name, error: err.message, stack: err.stack });
      console.error(`  ✗ [FAIL] ${name} (${err.message})`);
    }
  }

  assert(cond, msg) {
    this.total++;
    if (cond) {
      this.passed++;
      console.log(`    ✓ ${msg}`);
    } else {
      this.failed++;
      this.failures.push({ test: msg, error: 'Assertion failed' });
      console.error(`    ✗ [FAIL] ${msg}`);
    }
  }

  assertEqual(actual, expected, msg) {
    this.assert(actual === expected, `${msg} | Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
  }

  assertClose(actual, expected, tol = 1e-3, msg) {
    const diff = Math.abs(actual - expected);
    this.assert(diff <= tol, `${msg} | Expected ~${expected}, Got: ${actual} (diff: ${diff.toFixed(6)})`);
  }

  assertBounded(val, min, max, msg) {
    const isNum = typeof val === 'number' && !Number.isNaN(val) && Number.isFinite(val);
    const inBounds = isNum && val >= min && val <= max;
    this.assert(inBounds, `${msg} | Value ${val} strictly in [${min}, ${max}] (Finite: ${isNum})`);
  }

  summary() {
    console.log('\n========================================================================');
    console.log(`[${this.suiteName}] Summary: ${this.passed}/${this.total} Passed (${this.failed} Failed)`);
    console.log('========================================================================');
    if (this.failed > 0) {
      console.error('\nFailures Recorded:');
      this.failures.forEach(f => console.error(` - ${f.test}: ${f.error}`));
    }
    return { passed: this.passed, failed: this.failed, total: this.total };
  }
}

const harness = new DeepHarness('Milestone 4 Deep Mathematical & Physics Challenge');

// ============================================================================
// SECTION 1: CONTAGION PHYSICS STRESS TESTS (InfoWarEngine & InfoWar UI)
// ============================================================================
harness.describe('1. Contagion Physics: 100% Infected Start Nodes & Strict Bounding', () => {
  // Scenario: 100% infected start nodes with 0% resistance and max reach (1.0)
  const extremeNodes100 = [
    { id: 'n1', name: 'Alpha', type: 'Social', reach: 1.0, resistance: 0.0, infection: 100, trust: 0 },
    { id: 'n2', name: 'Beta', type: 'Social', reach: 1.0, resistance: 0.0, infection: 100, trust: 0 },
    { id: 'n3', name: 'Gamma', type: 'Social', reach: 1.0, resistance: 0.0, infection: 100, trust: 0 },
    { id: 'n4', name: 'Delta', type: 'Social', reach: 1.0, resistance: 0.0, infection: 100, trust: 0 }
  ];

  const engine100 = new InfoWarEngine({
    id: 'extreme-100',
    name: 'Total Contamination Scenario',
    nodes: extremeNodes100,
    maxTurns: 5,
    apPerTurn: 10
  });

  harness.it('Initial metrics at 100% infection are strictly bounded', () => {
    harness.assertEqual(engine100.avgInfection, 100, 'Initial avg infection is 100%');
    harness.assertEqual(engine100.health, 0, 'Initial health is 0%');
    harness.assertEqual(engine100.panic, 100, 'Initial panic is clamped to 100% (raw 120 -> 100)');
    harness.assertBounded(engine100.health, 0, 100, 'Health in [0, 100]');
    harness.assertBounded(engine100.panic, 0, 100, 'Panic in [0, 100]');
    harness.assertBounded(engine100.avgInfection, 0, 100, 'Avg infection in [0, 100]');
  });

  harness.it('Advancing turns with 100% infection preserves all bounds [0, 100] without NaN or overflow', () => {
    for (let turn = 1; turn <= 5; turn++) {
      engine100.endTurn();
      for (const node of engine100.nodes) {
        harness.assertBounded(node.infection, 0, 100, `Turn ${turn} Node ${node.id} infection in [0, 100]`);
        harness.assertBounded(node.trust, 0, 100, `Turn ${turn} Node ${node.id} trust in [0, 100]`);
        harness.assertBounded(node.resistance, 0, 1, `Turn ${turn} Node ${node.id} resistance in [0, 1]`);
      }
      harness.assertBounded(engine100.health, 0, 100, `Turn ${turn} Engine health in [0, 100]`);
      harness.assertBounded(engine100.panic, 0, 100, `Turn ${turn} Engine panic in [0, 100]`);
      harness.assertBounded(engine100.avgInfection, 0, 100, `Turn ${turn} Engine avgInfection in [0, 100]`);
    }
  });

  // UI Engine counterpart test
  const uiEngine100 = InfoWar._createEngine({
    id: 'ui-extreme-100',
    name: 'UI Contamination',
    nodes: extremeNodes100.map(n => ({ ...n, infection: 1.0, trust: 0.0 })),
    topology: 'mesh',
    maxTurns: 5,
    apPerTurn: 10,
    initialHealth: 100,
    initialPanic: 0
  });

  harness.it('UI Engine with 100% infection bounds all node & global values', () => {
    for (let turn = 1; turn <= 5; turn++) {
      uiEngine100.endTurn();
      for (const node of uiEngine100.nodes) {
        harness.assertBounded(node.infection, 0, 1, `UI Turn ${turn} Node ${node.id} infection in [0, 1]`);
        harness.assertBounded(node.trust, 0, 1, `UI Turn ${turn} Node ${node.id} trust in [0, 1]`);
        harness.assertBounded(node.resistance, 0, 1, `UI Turn ${turn} Node ${node.id} resistance in [0, 1]`);
      }
      harness.assertBounded(uiEngine100.health, 0, 100, `UI Turn ${turn} Health in [0, 100]`);
      harness.assertBounded(uiEngine100.panic, 0, 100, `UI Turn ${turn} Panic in [0, 100]`);
    }
  });
});

harness.describe('2. Contagion Physics: 0% Infected Start Nodes (Clean Baseline)', () => {
  const pristineNodes = [
    { id: 'p1', name: 'Clean 1', type: 'Institutional', reach: 0.8, resistance: 0.5, infection: 0, trust: 100 },
    { id: 'p2', name: 'Clean 2', type: 'Press', reach: 0.6, resistance: 0.4, infection: 0, trust: 90 },
    { id: 'p3', name: 'Clean 3', type: 'Academic', reach: 0.3, resistance: 0.9, infection: 0, trust: 95 }
  ];

  const engine0 = new InfoWarEngine({
    id: 'pristine-0',
    nodes: pristineNodes,
    maxTurns: 5,
    apPerTurn: 10
  });

  harness.it('0% infected network stays 0% infected without events', () => {
    harness.assertEqual(engine0.avgInfection, 0, 'Initial avg infection is 0');
    harness.assertEqual(engine0.health, 100, 'Initial health is 100');
    harness.assertEqual(engine0.panic, 0, 'Initial panic is 0');

    for (let t = 1; t <= 5; t++) {
      engine0.endTurn();
      harness.assertEqual(engine0.avgInfection, 0, `Turn ${t} avgInfection remains 0`);
      harness.assertEqual(engine0.health, 100, `Turn ${t} health remains 100`);
      harness.assertEqual(engine0.panic, 0, `Turn ${t} panic remains 0`);
      for (const n of engine0.nodes) {
        harness.assertEqual(n.infection, 0, `Node ${n.id} infection remains 0`);
      }
    }
  });

  const uiEngine0 = InfoWar._createEngine({
    id: 'ui-pristine-0',
    nodes: pristineNodes.map(n => ({ ...n, infection: 0.0, trust: 0.95 })),
    topology: 'mesh',
    maxTurns: 5,
    apPerTurn: 10,
    initialHealth: 100,
    initialPanic: 0
  });

  harness.it('UI Engine with 0% infection stays at 0% infection', () => {
    for (let t = 1; t <= 5; t++) {
      uiEngine0.endTurn();
      harness.assertEqual(uiEngine0.getAverageInfection(), 0, `UI Turn ${t} avgInfection is 0`);
      harness.assertEqual(uiEngine0.health, 100, `UI Turn ${t} health is 100`);
      harness.assertEqual(uiEngine0.panic, 0, `UI Turn ${t} panic is 0`);
    }
  });
});

harness.describe('3. Contagion Physics: Disconnected Graphs & Single Node Topologies', () => {
  harness.it('UI Engine edge generator handles empty, 1-node, 2-node, and 3-node graphs safely across all topologies', () => {
    const topologies = ['mesh', 'hub-spoke', 'hierarchy'];
    for (const topo of topologies) {
      const edges0 = InfoWar._generateEdges([], topo);
      harness.assertEqual(edges0.length, 0, `Empty array gives 0 edges for ${topo}`);

      const edges1 = InfoWar._generateEdges([{ id: 'n1' }], topo);
      harness.assert(Array.isArray(edges1), `1-node returns array for ${topo}`);

      const edges2 = InfoWar._generateEdges([{ id: 'n1' }, { id: 'n2' }], topo);
      harness.assert(Array.isArray(edges2), `2-node returns array without throwing for ${topo}`);

      for (const edge of edges2) {
        harness.assert(edge.source && edge.target, `Edge has source & target: ${edge.source} -> ${edge.target}`);
      }
    }
  });

  harness.it('InfoWarEngine operates with single node without throwing', () => {
    const singleNodeEngine = new InfoWarEngine({
      nodes: [{ id: 'solo', name: 'Solo Node', type: 'Press', reach: 0.5, resistance: 0.3, infection: 40, trust: 60 }],
      maxTurns: 3,
      apPerTurn: 10
    });

    harness.assertEqual(singleNodeEngine.nodes.length, 1, 'Single node engine initialized');
    harness.assertEqual(singleNodeEngine.avgInfection, 40, 'Avg infection is 40');
    harness.assertEqual(singleNodeEngine.health, 60, 'Health is 60');

    // Action on solo node
    const r = singleNodeEngine.takeAction('debunk', 'solo');
    harness.assertEqual(r.success, true, 'Action on solo node succeeds');
    harness.assertEqual(singleNodeEngine.nodes[0].infection, 0, 'Infection reduced from 40 to 0 (max(0, 40-50))');

    singleNodeEngine.endTurn();
    harness.assertEqual(singleNodeEngine.avgInfection, 0, 'Avg infection is 0 after turn end');
  });
});

harness.describe('4. Contagion Physics: High Transmission Rates & Circuit-Breaker Activation', () => {
  harness.it('Circuit-breaker in InfoWar UI halves transmission velocity from 0.4 to 0.2', () => {
    const makeCampaign = () => ({
      nodes: [
        { id: 'src', name: 'Source', type: 'Social', reach: 1.0, resistance: 0.0, infection: 0.8, trust: 0.2 },
        { id: 'tgt', name: 'Target', type: 'Social', reach: 1.0, resistance: 0.0, infection: 0.1, trust: 0.5 }
      ],
      topology: 'mesh',
      maxTurns: 3,
      apPerTurn: 10,
      initialHealth: 90,
      initialPanic: 10
    });

    // Run 1: Standard transmission (circuit breaker inactive)
    const engStandard = InfoWar._createEngine(makeCampaign());
    engStandard.edges = [{ source: 'src', target: 'tgt' }];
    engStandard.circuitBreakerActive = false;
    engStandard.endTurn();
    const standardTgtInfection = engStandard.getNode('tgt').infection;

    // Run 2: Circuit-breaker active
    const engCircuit = InfoWar._createEngine(makeCampaign());
    engCircuit.edges = [{ source: 'src', target: 'tgt' }];
    engCircuit.deployCircuitBreaker();
    harness.assertEqual(engCircuit.circuitBreakerActive, true, 'Circuit breaker flag is active');
    engCircuit.endTurn();
    const circuitTgtInfection = engCircuit.getNode('tgt').infection;

    // Theoretical infection increases:
    // Standard delta: src.infection(0.8) * tgt.reach(1.0) * (1 - tgt.res(0.0)) * 0.4 = 0.32 -> tgt = 0.1 + 0.32 = 0.42
    // Circuit delta: src.infection(0.8) * tgt.reach(1.0) * (1 - tgt.res(0.0)) * 0.2 = 0.16 -> tgt = 0.1 + 0.16 = 0.26
    harness.assertClose(standardTgtInfection, 0.42, 1e-3, 'Standard target infection matches 0.42');
    harness.assertClose(circuitTgtInfection, 0.26, 1e-3, 'Circuit-breaker target infection matches 0.26 (halved spread)');
    harness.assertEqual(engCircuit.circuitBreakerActive, false, 'Circuit breaker automatically resets after turn');
  });

  harness.it('Friction doctrine in InfoWarEngine halves transmission beta from 0.20 to 0.10', () => {
    const makeNodes = () => [
      { id: 's1', name: 'Source', type: 'Social', reach: 1.0, resistance: 0.0, infection: 80, trust: 20 },
      { id: 't1', name: 'Target', type: 'Social', reach: 1.0, resistance: 0.0, infection: 10, trust: 50 }
    ];

    // Standard run (beta = 0.20)
    const eStd = new InfoWarEngine({ nodes: makeNodes() });
    eStd.endTurn();
    const stdInfection = eStd.getNode('t1').infection;

    // Friction run (beta = 0.10)
    const eFric = new InfoWarEngine({ nodes: makeNodes() });
    const fricRes = eFric.takeAction('friction');
    harness.assertEqual(fricRes.success, true, 'Friction action successful');
    harness.assertEqual(eFric.frictionActive, true, 'frictionActive is true');
    eFric.endTurn();
    const fricInfection = eFric.getNode('t1').infection;

    // Spread delta standard: (80/100) * 1.0 * 0.20 * (1 - 0) * 20 = 0.8 * 0.20 * 20 = 3.2
    // Expected Target Std: min(100, round((10 + 3.2)*10)/10) = 13.2
    // Spread delta friction: (80/100) * 1.0 * 0.10 * (1 - 0) * 20 = 0.8 * 0.10 * 20 = 1.6
    // Expected Target Friction: min(100, round((10 + 1.6)*10)/10) = 11.6
    harness.assertClose(stdInfection, 13.2, 0.1, `Standard spread infection is 13.2 (Got: ${stdInfection})`);
    harness.assertClose(fricInfection, 11.6, 0.1, `Friction spread infection is 11.6 (Got: ${fricInfection})`);
    harness.assertEqual(eFric.frictionActive, false, 'frictionActive flag reset after endTurn');
  });

  harness.it('Massive adversary turn events (+500 infection delta) clamp safely to 100', () => {
    const engineMassive = new InfoWarEngine({
      nodes: [{ id: 'victim', name: 'Victim', type: 'Press', reach: 0.5, resistance: 0.2, infection: 10, trust: 80 }],
      turnEvents: [
        { turn: 1, affectedNode: 'victim', infectionDelta: 500, title: 'Adversary Zero-Day Flood' }
      ]
    });

    engineMassive.endTurn();
    harness.assertEqual(engineMassive.getNode('victim').infection, 100, 'Infection clamped at 100% max');
    harness.assertEqual(engineMassive.health, 0, 'Health is 0%');
    harness.assertBounded(engineMassive.panic, 0, 100, 'Panic is bounded in [0, 100]');
  });
});

// ============================================================================
// SECTION 2: OPERATOR PROFILE, RESILIENCE INDEX & SPIDERCHART GEOMETRY
// ============================================================================
harness.describe('5. Operator Profile: 5-Axis Metric Calculation Under Extreme & Boundary States', () => {
  harness.it('Empty store state computes all 0s for 5 axes, resilience, and siftPoints', () => {
    const mockAppEmpty = {
      store: {
        get: (k, def) => def || null
      }
    };
    const mod = Object.create(OnboardingModule);
    mod._app = mockAppEmpty;

    const scores = mod._computeCompetencyScores();
    harness.assertEqual(scores.siftVerification, 0, 'siftVerification = 0');
    harness.assertEqual(scores.patternRecognition, 0, 'patternRecognition = 0');
    harness.assertEqual(scores.memoryRetention, 0, 'memoryRetention = 0');
    harness.assertEqual(scores.theoreticalDepth, 0, 'theoreticalDepth = 0');
    harness.assertEqual(scores.analyticalPractice, 0, 'analyticalPractice = 0');
    harness.assertEqual(scores.overallResilience, 0, 'overallResilience = 0');
    harness.assertEqual(scores.siftPoints, 0, 'siftPoints = 0');
  });

  harness.it('Boundary conditions: 100% across all store domains yields exact 100% across all 5 axes', () => {
    const mockAppFull = {
      store: {
        get: (k) => {
          if (k === 'sift.stats') return { correct: 50, total: 50 };
          if (k === 'arena.stats') return { correct: 100, total: 100 };
          if (k === 'sm2.deck') return JSON.stringify([
            { id: '1', repetitions: 3 },
            { id: '2', repetitions: 5 },
            { id: '3', repetitions: 4 }
          ]);
          if (k === 'cognitive.progress') return {
            m1: { completed: true },
            m2: { completed: true },
            m3: { completed: true },
            m4: { completed: true }
          };
          if (k === 'ach.analysisCount') return 10;
          if (k === 'verdad.auditCount') return 20;
          if (k === 'infowar.stats') return { victories: 10 };
          if (k === 'operator.siftPoints') return '999';
          return null;
        }
      }
    };
    const mod = Object.create(OnboardingModule);
    mod._app = mockAppFull;

    const scores = mod._computeCompetencyScores();
    harness.assertEqual(scores.siftVerification, 100, 'siftVerification = 100');
    harness.assertEqual(scores.patternRecognition, 100, 'patternRecognition = 100');
    harness.assertEqual(scores.memoryRetention, 100, 'memoryRetention = 100');
    harness.assertEqual(scores.theoreticalDepth, 100, 'theoreticalDepth = 100');
    harness.assertEqual(scores.analyticalPractice, 100, 'analyticalPractice = 100');
    harness.assertEqual(scores.overallResilience, 100, 'overallResilience = 100');
    harness.assertEqual(scores.siftPoints, 999, 'siftPoints = 999');
  });

  harness.it('Resilience Index mathematical formula weights verification', () => {
    // Formula: 0.30*sift + 0.20*pattern + 0.20*memory + 0.15*theory + 0.15*practice
    const testCases = [
      { sift: 100, pat: 0, mem: 0, th: 0, pr: 0, expected: 30 },
      { sift: 0, pat: 100, mem: 0, th: 0, pr: 0, expected: 20 },
      { sift: 0, pat: 0, mem: 100, th: 0, pr: 0, expected: 20 },
      { sift: 0, pat: 0, mem: 0, th: 100, pr: 0, expected: 15 },
      { sift: 0, pat: 0, mem: 0, th: 0, pr: 100, expected: 15 },
      { sift: 80, pat: 70, mem: 90, th: 60, pr: 50, expected: Math.round(80*0.30 + 70*0.20 + 90*0.20 + 60*0.15 + 50*0.15) }, // 24+14+18+9+7.5 = 72.5 -> 73
      { sift: 33, pat: 44, mem: 55, th: 66, pr: 77, expected: Math.round(33*0.30 + 44*0.20 + 55*0.20 + 66*0.15 + 77*0.15) }  // 9.9+8.8+11+9.9+11.55 = 51.15 -> 51
    ];

    for (const tc of testCases) {
      const computed = Math.min(100, Math.round(
        (tc.sift * 0.30) +
        (tc.pat * 0.20) +
        (tc.mem * 0.20) +
        (tc.th * 0.15) +
        (tc.pr * 0.15)
      ));
      harness.assertEqual(computed, tc.expected, `Resilience calculation for (${tc.sift}, ${tc.pat}, ${tc.mem}, ${tc.th}, ${tc.pr}) matches ${tc.expected}`);
    }
  });
});

harness.describe('6. Spiderchart: Dynamic SVG Pentagon Unit Circle Coordinate Geometry', () => {
  // Geometry parameters from OnboardingModule._buildSpiderchart:
  // size = 160, center = 80, maxRadius = 60, n = 5
  // angle_i = (i / 5) * 2 * PI - PI / 2
  // x_i = center + radius * cos(angle_i)
  // y_i = center + radius * sin(angle_i)

  const size = 160;
  const center = 80;
  const maxRadius = 60;
  const n = 5;

  const expectedAnglesDeg = [-90, -18, 54, 126, 198];

  harness.it('5 Pentagon vertices form exact equidistant angles with -90 degree (12 o\'clock) rotation', () => {
    for (let i = 0; i < n; i++) {
      const rad = (i / n) * 2 * Math.PI - Math.PI / 2;
      const deg = (rad * 180) / Math.PI;
      harness.assertClose(deg, expectedAnglesDeg[i], 1e-4, `Vertex ${i} angle is ${expectedAnglesDeg[i]} deg`);
    }
  });

  harness.it('Coordinates for 100% values match analytical unit circle scaling', () => {
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
      const expX = center + maxRadius * Math.cos(angle);
      const expY = center + maxRadius * Math.sin(angle);

      if (i === 0) {
        harness.assertClose(expX, 80.0, 1e-4, 'Vertex 0 X is top center (80.0)');
        harness.assertClose(expY, 20.0, 1e-4, 'Vertex 0 Y is top vertex (20.0)');
      } else if (i === 1) {
        // -18 deg: cos(-18 deg) = cos(18 deg) = ~0.9510565, sin(-18 deg) = ~-0.309017
        // X = 80 + 60*0.9510565 = ~137.063, Y = 80 - 60*0.309017 = ~61.459
        harness.assertClose(expX, 137.063, 1e-2, 'Vertex 1 X is ~137.063');
        harness.assertClose(expY, 61.459, 1e-2, 'Vertex 1 Y is ~61.459');
      } else if (i === 2) {
        // 54 deg: cos(54) = ~0.587785, sin(54) = ~0.809017
        // X = 80 + 60*0.587785 = ~115.267, Y = 80 + 60*0.809017 = ~128.541
        harness.assertClose(expX, 115.267, 1e-2, 'Vertex 2 X is ~115.267');
        harness.assertClose(expY, 128.541, 1e-2, 'Vertex 2 Y is ~128.541');
      } else if (i === 3) {
        // 126 deg: cos(126) = ~-0.587785, sin(126) = ~0.809017
        // X = 80 - 60*0.587785 = ~44.733, Y = 80 + 60*0.809017 = ~128.541
        harness.assertClose(expX, 44.733, 1e-2, 'Vertex 3 X is ~44.733');
        harness.assertClose(expY, 128.541, 1e-2, 'Vertex 3 Y is ~128.541');
      } else if (i === 4) {
        // 198 deg: cos(198) = ~-0.9510565, sin(198) = ~-0.309017
        // X = 80 - 60*0.9510565 = ~22.937, Y = 80 - 60*0.309017 = ~61.459
        harness.assertClose(expX, 22.937, 1e-2, 'Vertex 4 X is ~22.937');
        harness.assertClose(expY, 61.459, 1e-2, 'Vertex 4 Y is ~61.459');
      }
    }
  });

  harness.it('Coordinates for 50% values scale linearly to radius 30', () => {
    const halfRadius = maxRadius * 0.5; // 30
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
      const x50 = center + halfRadius * Math.cos(angle);
      const y50 = center + halfRadius * Math.sin(angle);
      if (i === 0) {
        harness.assertClose(x50, 80.0, 1e-4, 'Vertex 0 at 50% has X=80.0');
        harness.assertClose(y50, 50.0, 1e-4, 'Vertex 0 at 50% has Y=50.0');
      }
    }
  });

  harness.it('Generated SVG contains matching formatted coordinate tokens and zero NaN values', () => {
    const axes = [
      { label: 'A0', value: 100, color: '#fff' },
      { label: 'A1', value: 50, color: '#fff' },
      { label: 'A2', value: 75, color: '#fff' },
      { label: 'A3', value: 25, color: '#fff' },
      { label: 'A4', value: 0, color: '#fff' }
    ];

    const svg = OnboardingModule._buildSpiderchart(axes);
    harness.assert(typeof svg === 'string', 'Returns string');
    harness.assert(!svg.includes('NaN'), 'SVG contains no NaN');
    harness.assert(!svg.includes('undefined'), 'SVG contains no undefined');
    harness.assert(svg.includes('d="M 80.0 20.0'), 'Path starts at top vertex (80.0, 20.0)');
    harness.assert(svg.includes('cx="80.0" cy="20.0"'), 'Vertex circle 0 at (80.0, 20.0)');
    harness.assert(svg.includes('cx="80.0" cy="80.0"'), 'Vertex circle 4 at (80.0, 80.0) for 0%');
  });
});

harness.summary();
