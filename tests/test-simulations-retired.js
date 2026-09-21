/**
 * SOVEREIGN // AEGIS — Suite 42: Retired Simulations (Video Forensics & Narrative Topology)
 *
 * Tests:
 * 1. Video Forensics DSP Primitives:
 *    - computeFrameDifference: zero delta on identical frames, positive energy on motion,
 *      valid colormap buffer length, and finite seam jitter index.
 *    - computeSpatialNoiseResidual: 3x3 Laplacian high-pass filter, valid variance ratios.
 *    - generateProceduralVideoFrames: 60-frame procedural generation for authentic vs deepfake.
 *    - Contrast Invariant: authentic video exhibits coherent temporal flow (seam jitter <= 1.40),
 *      while deepfake video exhibits elevated boundary seam jitter (>= 2.00) and collapsed noise.
 * 2. Narrative Topology Contagion Diffusion Mathematics:
 *    - simulateContagionDiffusion: differential network epidemic propagation across 48 hours
 *      for all 3 campaigns in data/narratives.json.
 *    - Monotonic propagation invariants: seed nodes infected at T+0, botnets at T+4, bridges at T+12,
 *      mainstream at T+24, institutional containment at T+36+.
 *    - Mathematical bounds: all infections in [0, 1], all fluxes >= 0, reach > 0.
 *
 * Zero external runtime dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

import {
  computeFrameDifference,
  computeSpatialNoiseResidual,
  computeTemporalProfile,
  generateProceduralVideoFrames,
  MediaForensics
} from '../js/modules/mediaForensics.js';

import {
  simulateContagionDiffusion,
  NarrativeModule
} from '../js/modules/narrative.js';

// Test assertion counters
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${message} | Expected: ${expected}, Got: ${actual}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message} | Expected: ${expected}, Got: ${actual}`);
  }
}

console.log('\n====================================================');
console.log('  Suite 42: Retired Simulations Verification');
console.log('====================================================\n');

// ─────────────────────────────────────────────
// GROUP 1: VIDEO FORENSICS DSP & DIFFERENCING
// ─────────────────────────────────────────────
console.log('--- Group 1: Video Forensics DSP & Frame Differencing ---');

const width = 320;
const height = 180;
const frameSize = width * height * 4;

// 1.1 Identical frame difference
const blankA = new Uint8ClampedArray(frameSize);
const blankB = new Uint8ClampedArray(frameSize);
blankA.fill(128);
blankB.fill(128);

const diffZero = computeFrameDifference(blankA, blankB, width, height);
assertEqual(diffZero.meanDiff, 0, 'Identical frames yield mean absolute difference of exactly 0');
assertEqual(diffZero.diffData.length, frameSize, 'diffData has correct 4-channel byte length (230,400 bytes)');

// 1.2 Non-zero motion difference
blankB[0] = 200; // mutate one pixel
blankB[1] = 200;
blankB[2] = 200;
const diffPositive = computeFrameDifference(blankA, blankB, width, height);
assert(diffPositive.meanDiff > 0, 'Mutated pixel yields positive difference energy');

// 1.3 Spatial noise residual on uniform flat image
const noiseFlat = computeSpatialNoiseResidual(blankA, width, height);
assertEqual(noiseFlat.residualData.length, frameSize, 'residualData has correct byte length');
assert(noiseFlat.faceNoiseStd === 0, 'Flat image has exactly 0 Laplacian face noise variance');
assert(noiseFlat.bgNoiseStd === 0, 'Flat image has exactly 0 Laplacian background noise variance');

// 1.4 Procedural Frame Generation: Authentic Sample
console.log('\n--- Group 2: Authentic vs Deepfake Video Testbench Contrast ---');
const authFrames = generateProceduralVideoFrames('sample-authentic-video', width, height, 60);
assertEqual(authFrames.length, 60, 'Generates exactly 60 procedural frames for authentic video');
assert(authFrames[0] instanceof Uint8ClampedArray, 'Frame is Uint8ClampedArray');
assertEqual(authFrames[0].length, frameSize, 'Frame has 230,400 bytes (320x180x4)');

// 1.5 Procedural Frame Generation: Deepfake Sample
const fakeFrames = generateProceduralVideoFrames('sample-deepfake-video', width, height, 60);
assertEqual(fakeFrames.length, 60, 'Generates exactly 60 procedural frames for deepfake video');

// 1.6 Temporal Profile Computation
const authProfile = computeTemporalProfile(authFrames, width, height);
const fakeProfile = computeTemporalProfile(fakeFrames, width, height);

assertEqual(authProfile.energyProfile.length, 59, 'Authentic energy profile has 59 transition steps');
assertEqual(fakeProfile.energyProfile.length, 59, 'Deepfake energy profile has 59 transition steps');
assert(authProfile.meanEnergy > 0, `Authentic video exhibits natural motion energy (${authProfile.meanEnergy.toFixed(2)} MAD)`);
assert(fakeProfile.meanEnergy > 0, `Deepfake video exhibits motion energy (${fakeProfile.meanEnergy.toFixed(2)} MAD)`);

// 1.7 Boundary Seam Jitter Invariant
console.log(`  Authentic Seam Jitter Index: ${authProfile.meanSeamJitter.toFixed(3)}x`);
console.log(`  Deepfake Seam Jitter Index: ${fakeProfile.meanSeamJitter.toFixed(3)}x`);
assert(authProfile.meanSeamJitter <= 1.40, `Authentic video seam jitter <= 1.40x (${authProfile.meanSeamJitter.toFixed(2)}x)`);
assert(fakeProfile.meanSeamJitter >= 2.00, `Deepfake video seam jitter >= 2.00x (${fakeProfile.meanSeamJitter.toFixed(2)}x)`);
assert(fakeProfile.meanSeamJitter > authProfile.meanSeamJitter * 1.5, 'Deepfake seam jitter is significantly elevated over authentic baseline');

// 1.8 Spatial Noise Residual Disparity Invariant
const authNoise = computeSpatialNoiseResidual(authFrames[15], width, height);
const fakeNoise = computeSpatialNoiseResidual(fakeFrames[15], width, height);

console.log(`  Authentic Noise Disparity Ratio: ${authNoise.noiseDisparityRatio.toFixed(3)}`);
console.log(`  Deepfake Noise Disparity Ratio: ${fakeNoise.noiseDisparityRatio.toFixed(3)}`);
assert(authNoise.noiseDisparityRatio >= 0.85 && authNoise.noiseDisparityRatio <= 1.35,
  `Authentic video noise ratio is near 1.0 (${authNoise.noiseDisparityRatio.toFixed(2)})`);
assert(fakeNoise.noiseDisparityRatio < 0.85,
  `Deepfake video noise ratio exhibits latent smoothing < 0.85 (${fakeNoise.noiseDisparityRatio.toFixed(2)})`);

// 1.9 MediaForensics In-Memory Cache
const cachedAuth1 = MediaForensics._getOrCreateSampleVideoFrames('sample-authentic-video');
const cachedAuth2 = MediaForensics._getOrCreateSampleVideoFrames('sample-authentic-video');
assert(cachedAuth1 === cachedAuth2, 'MediaForensics caches procedural video frames and returns identical reference');

// ─────────────────────────────────────────────
// GROUP 3: NARRATIVE CONTAGION DIFFUSION
// ─────────────────────────────────────────────
console.log('\n--- Group 3: Narrative Contagion Diffusion Physics ---');

const narrativesRaw = fs.readFileSync(path.join(ROOT_DIR, 'data', 'narratives.json'), 'utf8');
const narratives = JSON.parse(narrativesRaw);

assert(Array.isArray(narratives) && narratives.length >= 3, 'Loaded narratives.json with >= 3 campaigns');

for (const campaign of narratives) {
  console.log(`\nValidating Campaign: "${campaign.title}" (${campaign.id})`);
  const snaps = simulateContagionDiffusion(campaign.topologyGraph, campaign.diffusionTimeline, 48);

  assertEqual(snaps.length, 49, `Campaign ${campaign.id} produces exactly 49 hourly snapshots (T+0h to T+48h)`);

  const t0 = snaps[0];
  const t4 = snaps[4];
  const t12 = snaps[12];
  const t24 = snaps[24];
  const t36 = snaps[36];
  const t48 = snaps[48];

  // Hour 0 Invariants: Only seeders infected
  assertEqual(t0.hour, 0, 'Hour 0 index matches');
  assertEqual(t0.activePhase, 'PHASE 1: INCEPTION & FRINGE SEEDING', 'Hour 0 is Inception & Seeding phase');
  const seedNode = campaign.topologyGraph.nodes.find(n => n.type === 'Seeder' || n.type === 'Seed' || n.id.includes('seed') || n.id.includes('origin'));
  if (seedNode) {
    assert(t0.nodeInfections[seedNode.id] >= 0.85, `Seed node ${seedNode.id} has high initial infection (${(t0.nodeInfections[seedNode.id] * 100).toFixed(0)}%)`);
  }

  // Hour 4 Invariants: Botnet amplification
  assertEqual(t4.activePhase, 'PHASE 2: BOTNET SWARM AMPLIFICATION', 'Hour 4 is Botnet Swarm phase');
  assert(t4.cumulativeReach > t0.cumulativeReach, `Reach expands from T+0 (${t0.cumulativeReach.toLocaleString()}) to T+4 (${t4.cumulativeReach.toLocaleString()})`);

  // Hour 12 Invariants: Bridge Cascade
  assertEqual(t12.activePhase, 'PHASE 3: BRIDGE INFLUENCER CASCADE', 'Hour 12 is Bridge Influencer phase');
  assert(t12.cumulativeReach > t4.cumulativeReach, `Reach expands into millions at T+12 (${t12.cumulativeReach.toLocaleString()})`);

  // Hour 24 Invariants: Mainstream Media Laundering
  assertEqual(t24.activePhase, 'PHASE 4: MAINSTREAM MEDIA LAUNDERING', 'Hour 24 is Mainstream Laundering phase');
  assert(t24.cumulativeReach >= t12.cumulativeReach, 'Mainstream reach reaches crest');

  // Hour 36 & 48 Invariants: Institutional Clashes & Decay
  assertEqual(t36.activePhase, 'PHASE 5: INSTITUTIONAL CLASHES & DECAY', 'Hour 36 is Institutional Clashes & Decay phase');
  assertEqual(t48.activePhase, 'PHASE 5: INSTITUTIONAL CLASHES & DECAY', 'Hour 48 remains in Decay phase');

  // Universal Mathematical Bounds across all 49 snapshots
  let allInBounds = true;
  let allFluxesValid = true;
  for (const s of snaps) {
    for (const [nodeId, inf] of Object.entries(s.nodeInfections)) {
      if (typeof inf !== 'number' || inf < 0 || inf > 1) {
        allInBounds = false;
        console.error(`Infection out of bounds: hour ${s.hour}, node ${nodeId}, val: ${inf}`);
      }
    }
    for (const [edgeKey, flux] of Object.entries(s.edgeFluxes)) {
      if (typeof flux !== 'number' || flux < 0) {
        allFluxesValid = false;
        console.error(`Edge flux out of bounds: hour ${s.hour}, edge ${edgeKey}, val: ${flux}`);
      }
    }
  }
  assert(allInBounds, `All node infection levels strictly in [0.0, 1.0] across all 49 snapshots in ${campaign.id}`);
  assert(allFluxesValid, `All edge transmission fluxes strictly >= 0.0 across all 49 snapshots in ${campaign.id}`);
}

// ─────────────────────────────────────────────
// GROUP 4: NARRATIVE MODULE RUNTIME SAFETY
// ─────────────────────────────────────────────
console.log('\n--- Group 4: Narrative Module Runtime Lifecycle ---');

NarrativeModule._campaigns = narratives;
NarrativeModule._activeCampaign = narratives[0];
NarrativeModule._runSimulation();

assertEqual(NarrativeModule._simulation.length, 49, 'NarrativeModule._runSimulation produces 49 snapshots');
NarrativeModule.updateTimeline(18);
assertEqual(NarrativeModule._simulation[18].hour, 18, 'Timeline updates snapshot at T+18h');

console.log('\n====================================================');
console.log(`[Suite 42: Retired Simulations] Summary: ${passed}/${passed + failed} Passed (${failed} Failed)`);
console.log('====================================================\n');

if (failed > 0) {
  process.exit(1);
}
