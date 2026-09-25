/**
 * SOVEREIGN // AEGIS — Master Test Runner
 * Orchestrates and executes the core algorithmic and dataset test suites listed in SUITES
 * below — the single place a suite is registered. A suite that is not in that array does
 * not run, so anything added under tests/ must be added here too.
 *
 * Aggregates pass/fail statistics and total assertion counts.
 * Zero external runtime dependencies.
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const SUITES = [
  { name: 'Syntax & Compilation Suite', script: 'test-syntax.js' },
  { name: 'Datasets & Schemas Validation Suite', script: 'test-datasets.js' },
  { name: 'WebCrypto ECDSA P-256 & DID Suite', script: 'test-crypto.js' },
  { name: 'Dead-Control Regression Suite', script: 'test-dead-controls.js' },
  { name: 'CI Workflow Guard Suite', script: 'test-ci-workflow.js' },
  { name: 'Richards Heuer ACH & Confidence Suite', script: 'test-ach.js' },
  { name: 'Richards Heuer ACH Adversarial Suite', script: 'test-ach-adversarial.js' },
  { name: 'VERDAD Real-Time NLP Heuristic Suite', script: 'test-verdad.js' },
  { name: 'InfoWar Serious Game Network Suite', script: 'test-infowar.js' },
  { name: 'DSP: FFT / 2D FFT / Spectrogram Suite', script: 'test-dsp.js' },
  { name: 'C2PA / JUMBF Manifest Reader Suite', script: 'test-c2pa.js' },
  { name: 'Append-Only Attempt Log Suite', script: 'test-attemptlog.js' },
  { name: 'Personal Defense Profile Scoring Suite', script: 'test-profile.js' },
  { name: 'Personal Defense Profile Store Suite', script: 'test-profilestore.js' },
  { name: 'SM-2 Semantics & Answer-Before-Reveal Suite', script: 'test-sm2-semantics.js' },
  { name: 'Competency Estimation & Transfer Suite', script: 'test-competency.js' },
  { name: 'Zero-Click Ingestion Suite', script: 'test-ingest.js' },
  { name: 'VERDAD Service Suite', script: 'test-verdad-service.js' },
  { name: 'Key-Binding Credential Suite', script: 'test-keybinding.js' },
  { name: 'Mastery Panel & Messenger Wiring Suite', script: 'test-mastery.js' },
  { name: 'Playable Drills (Fallacy Gauntlet & Triage) Suite', script: 'test-games.js' },
  { name: 'DISARM Blue Dataset & InfoWar AAR Suite', script: 'test-disarm-blue.js' },
  { name: 'Milestone 1: Pillar I SIFT Labs, SM-2 & Rhetorical Suite', script: 'test-m1.js' },
  { name: 'Milestone 1: Cryptographic & Invariant Stress Suite', script: 'test-stress-m1.js' },
  { name: 'Milestone 1: Empirical HTML/CSS/DOM Suite', script: 'test-challenger-m1.js' },
  { name: 'Milestone 1: Deep Verification Suite', script: 'test-challenger-m1-deep.js' },
  { name: 'Milestone 1: Empirical Fuzzing Suite', script: 'test-challenger-m1-empirical.js' },
  { name: 'Milestone 1: Forensic Auditor Suite', script: 'test-auditor-m1.js' },
  { name: 'Milestone 2: Pillar II VERDAD CoT & Sandbox Suite', script: 'test-m2.js' },
  { name: 'Milestone 2: Adversarial Dialectic & Stress Suite', script: 'test-challenger-m2-adversarial.js' },
  { name: 'Milestone 2: Forensic Auditor Suite', script: 'test-auditor-m2.js' },
  { name: 'Milestone 3: Pillar III Signal Forensics & Heuer ACH Suite', script: 'test-m3.js' },
  { name: 'Milestone 3: Pillar III Adversarial Stress Suite', script: 'test-challenger-m3-adversarial.js' },
  { name: 'Milestone 4: Pillar IV InfoWar, Profile & Onboarding Suite', script: 'test-m4.js' },
  { name: 'Milestone 4: Pillar IV Adversarial Stress Suite', script: 'test-m4-adversarial.js' },
  { name: 'Milestone 4: Pillar IV InfoWar Adversarial Challenge Suite', script: 'test-challenger-m4-adversarial.js' },
  { name: 'Milestone 4: Pillar IV Deep Mathematical & Contagion Stress Suite', script: 'test-challenger-m4-deep.js' },
  { name: 'Algorithmic Challenger 1 Suite', script: 'test-challenger-algorithmic.js' },
  { name: 'Deep Stress & Concurrency Suite', script: 'test-challenger-deep-stress.js' },
  { name: 'Milestone 5: Adversarial Stress & Concurrency Suite', script: 'test-challenger-m5-adversarial.js' },
  { name: 'Lens Library & Safe Renderer Suite', script: 'test-lens-guides.js' },
  { name: "The Analyst's Desk & OSINT Suite", script: 'test-analyst-desk.js' },
  { name: 'Retention Machinery, Inoculation 3-Stage & Transfer Suite', script: 'test-retention-transfer.js' },
  { name: 'Adaptive Inoculation Selector Suite', script: 'test-inoculation-adaptive.js' },
  { name: 'Transfer Study Kit (Phase 4 pre-enrollment machinery) Suite', script: 'test-transfer-study.js' },
  { name: 'Retired Simulations (Video Forensics & Narrative Topology) Suite', script: 'test-simulations-retired.js' },
  { name: 'Competency Attestation & Verifiable Credential Suite', script: 'test-competency-attestation.js' },
  { name: 'Adaptive Routing & Progressive Placement Suite', script: 'test-adaptive-routing.js' }
];

console.log('========================================================================');
console.log('       SOVEREIGN // AEGIS — CORE ALGORITHMIC TEST SUITE MASTER RUNNER    ');
console.log('========================================================================\n');

let totalPassed = 0;
let totalFailed = 0;
let totalAssertions = 0;
const results = [];
const uncounted = [];
let allPassed = true;
const tStart = performance.now();

for (const suite of SUITES) {
  const scriptPath = path.join(__dirname, suite.script);
  console.log(`\n------------------------------------------------------------------------`);
  console.log(`▶ Executing: [${suite.name}] (${suite.script})`);
  console.log(`------------------------------------------------------------------------`);

  const t0 = performance.now();
  let stdout = '';
  let suitePassed = false;
  let passedCount = 0;
  let failedCount = 0;
  let totalCount = 0;

  try {
    const rawOutput = execFileSync(process.execPath, [scriptPath], {
      cwd: ROOT_DIR,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    stdout = rawOutput;
    console.log(stdout.trim());
    suitePassed = true;
  } catch (err) {
    suitePassed = false;
    stdout = (err.stdout || '') + '\n' + (err.stderr || '');
    console.log(stdout.trim());
    allPassed = false;
  }

  const durationMs = Math.round(performance.now() - t0);

  // Extract summary counts. Suites report in several formats.
  const patterns = [
    /Summary:\s+(\d+)\/(\d+)\s+Passed\s+\((\d+)\s+Failed\)/i,          // X/Y Passed (Z Failed)
    /SUMMARY:\s+(\d+)\/(\d+)\s+Assertions\s+Passed\s+\((\d+)\s+Failed\)/i,
    /Results:\s+(\d+)\/(\d+)\s+Passed\s+\((\d+)\s+Failed\)/i,
    /TEST SUMMARY:\s+(\d+)\s+passed,\s+(\d+)\s+failed/i,                  // N passed, M failed
    /STRESS TEST SUMMARY:\s+(\d+)\s+PASSED,\s+(\d+)\s+FAILED/i,
    /AUDITOR TEST SUMMARY:\s+(\d+)\s+PASSED,\s+(\d+)\s+FAILED/i,
    /Auditor Verification Summary:\s+(\d+)\s+Passed,\s+(\d+)\s+Failed/i,
    /\[[^\]]*SUMMARY\]\s+(\d+)\s+Passed,\s+(\d+)\s+Failed/i,
    /Summary:\s+(\d+)\s+Passed,\s+(\d+)\s+Failed/i
  ];

  let matched = false;
  for (const rx of patterns) {
    const m = stdout.match(rx);
    if (!m) continue;
    if (m.length >= 4) {
      passedCount = parseInt(m[1], 10);
      totalCount = parseInt(m[2], 10);
      failedCount = parseInt(m[3], 10);
    } else {
      passedCount = parseInt(m[1], 10);
      failedCount = parseInt(m[2], 10);
      totalCount = passedCount + failedCount;
    }
    matched = true;
    break;
  }

  if (!matched) {
    // Fall back to counting per-assertion PASS/FAIL lines before giving up.
    const passLines = (stdout.match(/^\s*(?:✅|✓)\s/gm) || []).length;
    const failLines = (stdout.match(/^\s*(?:❌|✗)\s/gm) || []).length;
    if (passLines + failLines > 0) {
      passedCount = passLines;
      failedCount = failLines;
      totalCount = passLines + failLines;
      matched = true;
    } else {
      passedCount = suitePassed ? 1 : 0;
      failedCount = suitePassed ? 0 : 1;
      totalCount = 1;
      uncounted.push(suite.script);
    }
  }

  totalPassed += passedCount;
  totalFailed += failedCount;
  totalAssertions += totalCount;

  results.push({
    name: suite.name,
    script: suite.script,
    passed: suitePassed && failedCount === 0,
    passedCount,
    failedCount,
    totalCount,
    durationMs
  });
}

const totalDurationMs = Math.round(performance.now() - tStart);

// Print Comprehensive Aggregated Table
console.log('\n\n========================================================================');
console.log('                       MASTER AGGREGATED TEST SUMMARY                   ');
console.log('========================================================================');
console.log('| # | Suite Name                             | Status   | Assertions | Time   |');
console.log('|---|----------------------------------------|:--------:|:----------:|-------:|');

results.forEach((r, idx) => {
  const num = (idx + 1).toString().padEnd(2);
  const name = r.name.padEnd(38);
  const status = r.passed ? '✓ PASSED' : '✗ FAILED';
  const counts = `${r.passedCount}/${r.totalCount}`.padStart(10);
  const time = `${r.durationMs}ms`.padStart(7);
  console.log(`| ${num}| ${name} | ${status} | ${counts} | ${time}|`);
});

console.log('========================================================================');
console.log(`Total Test Suites Executed: ${results.length}`);
console.log(`Total Assertions Evaluated: ${totalAssertions}`);
console.log(`Total Assertions Passed:   ${totalPassed}`);
console.log(`Total Assertions Failed:   ${totalFailed}`);
console.log(`Total Execution Time:      ${totalDurationMs}ms`);
if (uncounted.length) {
  console.log(`Suites with UNCOUNTED assertions (reported as 1): ${uncounted.join(', ')}`);
  console.log('  -> their real assertion counts are NOT included in the total above.');
}

// Assertion composition — honesty check. The headline number is dominated by static dataset
// schema validation (typeof x === 'string' && x.length > N). Surface that explicitly so the
// total cannot read as behavioural coverage, and name the browser suite this runner omits.
const datasetSuite = results.find((r) => r.script === 'test-datasets.js');
console.log('Assertion composition:');
if (datasetSuite) {
  const pct = ((datasetSuite.totalCount / totalAssertions) * 100).toFixed(0);
  console.log(`  - Static dataset/schema validation: ${datasetSuite.totalCount} (${pct}% of total)`);
  console.log(`  - Logic, crypto, fuzz & static HTML/CSS checks: ${totalAssertions - datasetSuite.totalCount}`);
}
console.log('  - Browser E2E (real Chromium): NOT included — run `npm run test:e2e`');
console.log('========================================================================');

// NOTE: set process.exitCode, never call process.exit().
// When stdout is a pipe (any CI runner, or the challenger suite that spawns this file),
// writes are asynchronous. process.exit() tears the process down before the buffer is
// flushed, so the aggregated summary above — including the [PASS]/[FAIL] marker — was
// silently truncated for every piped consumer. Setting exitCode lets Node drain stdout
// and exit with the same status.
if (allPassed && totalFailed === 0) {
  console.log(`\n[PASS] HEADLESS CORE & DATA SUITES PASSED (${totalPassed}/${totalAssertions}) — browser E2E runs separately via npm run test:e2e\n`);
  process.exitCode = 0;
} else {
  console.error('\n[FAIL] ONE OR MORE TEST SUITES FAILED. REVIEW LOGS ABOVE.\n');
  process.exitCode = 1;
}
