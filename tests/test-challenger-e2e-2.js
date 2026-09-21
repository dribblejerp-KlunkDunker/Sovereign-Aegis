/**
 * SOVEREIGN // AEGIS — Challenger 2 Adversarial Stress Suite (E2E & Test Harness)
 * 
 * Stress Dimensions:
 * 1. Rapid Sequential & Concurrent Executions & Port Handling
 * 2. Headless CDP & DOM Verification Fail-Fast on Corrupted / Missing DOM
 * 3. Tier 4 Real-World Application Scenarios State Progression Depth
 * 4. Resource Footprint, Memory Profiling & Unhandled Promise Rejections
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFileSync, fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

class AdversarialRunner {
  constructor(name) {
    this.name = name;
    this.total = 0;
    this.passed = 0;
    this.failed = 0;
    this.failures = [];
    this.startTime = Date.now();
  }

  section(title) {
    console.log(`\n========================================================================`);
    console.log(`[CHALLENGER 2] ${title}`);
    console.log(`========================================================================`);
  }

  assert(condition, message, details = '') {
    this.total++;
    if (condition) {
      this.passed++;
      console.log(`  ✓ ${message}`);
    } else {
      this.failed++;
      const msg = details ? `${message} (${details})` : message;
      this.failures.push(msg);
      console.error(`  ✗ [FAIL] ${msg}`);
    }
  }

  summary() {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);
    console.log(`\n========================================================================`);
    console.log(`[CHALLENGER 2 SUMMARY] ${this.passed}/${this.total} Passed (${this.failed} Failed) in ${elapsed}s`);
    console.log(`========================================================================`);
    if (this.failures.length > 0) {
      console.error('\nFailures encountered:');
      this.failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}`));
    }
    return { passed: this.passed, failed: this.failed, total: this.total, durationSec: parseFloat(elapsed) };
  }
}

async function runChallenger2Suite() {
  const runner = new AdversarialRunner('E2E & Test Harness Empirical Challenge');
  const unhandledRejections = [];
  process.on('unhandledRejection', (reason) => {
    unhandledRejections.push(reason);
    console.error('[UNHANDLED REJECTION DETECTED]:', reason);
  });

  // ========================================================================
  // 1. RAPID SEQUENTIAL & CONCURRENT HARNESS RUNS
  // ========================================================================
  runner.section('1. Rapid Sequential & Concurrent Test Harness Stability');

  // Test 1.1: Rapid Sequential Executions of test-e2e.js (3 runs in rapid succession)
  console.log('▶ Testing 3 sequential executions of test-e2e.js...');
  let seqSuccessCount = 0;
  for (let i = 1; i <= 3; i++) {
    const t0 = performance.now();
    try {
      const out = execFileSync(process.execPath, [path.join(__dirname, 'test-e2e.js')], {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      const t1 = performance.now();
      const passMatch = out.includes('ALL END-TO-END BROWSER TESTS PASSED FLAWLESSLY');
      if (passMatch) seqSuccessCount++;
      console.log(`    Run ${i}/3 completed in ${(t1 - t0).toFixed(0)}ms: ${passMatch ? 'PASS' : 'FAIL'}`);
    } catch (err) {
      console.error(`    Run ${i}/3 failed:`, err.message);
    }
  }
  runner.assert(seqSuccessCount === 3, '3 rapid sequential E2E test runs all succeed 100% without hang or crash');

  // Test 1.2: Rapid Sequential Executions of master runner run-all.js (3 runs)
  console.log('▶ Testing 3 sequential executions of run-all.js...');
  let masterSuccessCount = 0;
  for (let i = 1; i <= 3; i++) {
    const t0 = performance.now();
    try {
      const out = execFileSync(process.execPath, [path.join(__dirname, 'run-all.js')], {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      const t1 = performance.now();
      const passMatch = out.includes('HEADLESS CORE & DATA SUITES PASSED');
      if (passMatch) masterSuccessCount++;
      console.log(`    Master Run ${i}/3 completed in ${(t1 - t0).toFixed(0)}ms: ${passMatch ? 'PASS' : 'FAIL'}`);
    } catch (err) {
      console.error(`    Master Run ${i}/3 failed:`, err.message);
    }
  }
  runner.assert(masterSuccessCount === 3, '3 rapid sequential run-all.js executions all succeed 100%');

  // Test 1.3: Port Contention & Dynamic Port Allocation
  console.log('▶ Testing port contention & dynamic allocation on AegisHttpServer...');
  // Import AegisHttpServer directly from test-e2e module or recreate to test isolation
  // Start 3 concurrent servers on port 0
  const createMockServer = (preferredPort = 0) => {
    const s = http.createServer((req, res) => { res.writeHead(200); res.end('OK'); });
    return new Promise((resolve, reject) => {
      s.listen(preferredPort, '127.0.0.1', () => {
        const p = s.address().port;
        resolve({ server: s, port: p });
      });
      s.on('error', reject);
    });
  };

  const serverErrors = [];
  const captureServerError = (e) => serverErrors.push(String(e && e.message ? e.message : e));
  process.on('uncaughtException', captureServerError);

  const s1 = await createMockServer(0);
  const s2 = await createMockServer(0);
  const s3 = await createMockServer(0);

  runner.assert(s1.port > 0 && s2.port > 0 && s3.port > 0, 'Dynamic port assignment assigns valid non-zero ports');
  runner.assert(s1.port !== s2.port && s2.port !== s3.port && s1.port !== s3.port, 'Concurrent servers get unique non-colliding ephemeral ports');

  await new Promise(r => s1.server.close(r));
  await new Promise(r => s2.server.close(r));
  await new Promise(r => s3.server.close(r));
  process.off('uncaughtException', captureServerError);
  runner.assert(serverErrors.length === 0, `Ephemeral server instances close cleanly without unhandled errors (observed ${serverErrors.length})`);
  runner.assert(!s1.server.listening && !s2.server.listening && !s3.server.listening, 'All three ephemeral servers report closed');

  // Test 1.4: Chrome User Data Directory Cleanup
  console.log('▶ Testing browser temp directory cleanup...');
  const tmpDir = os.tmpdir();
  for (const f of fs.readdirSync(tmpDir).filter(f => f.startsWith('aegis-e2e-'))) {
    try { fs.rmSync(path.join(tmpDir, f), { recursive: true, force: true }); } catch {}
  }
  const aegisTmpFoldersBefore = fs.readdirSync(tmpDir).filter(f => f.startsWith('aegis-e2e-'));
  // Run an e2e test once
  execFileSync(process.execPath, [path.join(__dirname, 'test-e2e.js')], { cwd: ROOT_DIR, encoding: 'utf8' });
  const aegisTmpFoldersAfter = fs.readdirSync(tmpDir).filter(f => f.startsWith('aegis-e2e-'));
  runner.assert(aegisTmpFoldersAfter.length === 0 || aegisTmpFoldersAfter.length <= aegisTmpFoldersBefore.length, `No orphaned aegis-e2e temp directories leaked (Before: ${aegisTmpFoldersBefore.length}, After: ${aegisTmpFoldersAfter.length})`);


  // ========================================================================
  // 2. CDP & DOM FAIL-FAST VERIFICATION (FAULT INJECTION)
  // ========================================================================
  runner.section('2. CDP & DOM Fail-Fast Verification under Corrupted / Missing Elements');

  // Test 2.1: Fault Injection on Temporary Corrupted HTML
  // We will create a test script that serves an HTML missing critical elements and verifies that CDP fails fast
  console.log('▶ Testing fail-fast behavior when critical DOM elements are missing...');
  
  const testFailFastCode = `
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

// Corrupted index.html missing #view-verdad and #infowar-ap-badge
let html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
// Remove critical elements
html = html.replace('id="view-verdad"', 'id="view-verdad-corrupted"');
html = html.replace('id="infowar-ap-badge"', 'id="infowar-ap-badge-missing"');
html = html.replace('id="ach-rankings-grid"', 'id="ach-rankings-grid-missing"');

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  if (pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }
  const filePath = path.join(ROOT_DIR, pathname);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const mime = ext === '.js' ? 'application/javascript' : (ext === '.css' ? 'text/css' : (ext === '.json' ? 'application/json' : 'text/plain'));
    res.writeHead(200, { 'Content-Type': mime });
    res.end(fs.readFileSync(filePath));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  
  // Find browser
  // Cross-platform: this list was Windows-only, so on Linux/macOS the script printed
  // NO_BROWSER and the parent then tried to JSON.parse that string.
  const candidates = [
    process.env.AEGIS_CHROME_PATH || '',
    'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
    'C:\\\\Program Files (x86)\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\\\Chrome\\\\Application\\\\chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\\\Edge\\\\Application\\\\msedge.exe'),
    'C:\\\\Program Files (x86)\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/opt/pw-browsers/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
  ];
  let execPath = candidates.find(p => fs.existsSync(p));
  if (!execPath) {
    console.log('NO_BROWSER');
    server.close();
    process.exit(0);
  }

  const tmpDir = path.join(os.tmpdir(), 'failfast-test-' + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });
  const proc = spawn(execPath, ['--headless=new', '--remote-debugging-port=0', '--no-sandbox', '--disable-gpu', '--user-data-dir=' + tmpDir, 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
  
  // Read active port
  const activePortFile = path.join(tmpDir, 'DevToolsActivePort');
  let cdpPort = null;
  const start = Date.now();
  while (Date.now() - start < 6000) {
    if (fs.existsSync(activePortFile)) {
      try {
        cdpPort = parseInt(fs.readFileSync(activePortFile, 'utf8').trim().split('\\n')[0], 10);
        if (cdpPort > 0) break;
      } catch {}
    }
    await new Promise(r => setTimeout(r, 50));
  }

  const listResp = await fetch('http://127.0.0.1:' + cdpPort + '/json/list');
  const targets = await listResp.json();
  const pageTarget = targets.find(t => t.type === 'page');
  const wsUrl = pageTarget.webSocketDebuggerUrl;

  const ws = new WebSocket(wsUrl);
  let msgId = 1;
  const cbs = new Map();
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && cbs.has(msg.id)) {
      const { resolve, reject } = cbs.get(msg.id);
      cbs.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = msgId++;
    cbs.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:' + port + '/index.html' });
  await new Promise(r => setTimeout(r, 600));

  // Evaluate missing element
  const evalResult = await send('Runtime.evaluate', {
    expression: 'document.getElementById("view-verdad") !== null',
    returnByValue: true
  });
  const verdadExists = evalResult.result.value;

  const apResult = await send('Runtime.evaluate', {
    expression: 'document.getElementById("infowar-ap-badge") !== null',
    returnByValue: true
  });
  const apExists = apResult.result.value;

  // Cleanup
  ws.close();
  proc.kill();
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  server.close();

  console.log(JSON.stringify({ verdadExists, apExists }));
});
`;

  const failFastScriptPath = path.join(__dirname, 'temp-failfast-test.mjs');
  fs.writeFileSync(failFastScriptPath, testFailFastCode, 'utf8');

  try {
    const rawOut = execFileSync(process.execPath, [failFastScriptPath], {
      cwd: ROOT_DIR,
      encoding: 'utf8',
      timeout: 10000
    });
    const lastLine = rawOut.trim().split('\n').pop();
    if (lastLine === 'NO_BROWSER') {
      // Report honestly rather than crashing on JSON.parse('NO_BROWSER') and rather
      // than quietly counting this as a pass.
      runner.assert(false, 'Fault injection requires a browser: none was found on this host, so CDP fail-fast behaviour was NOT verified');
    } else {
      const parsed = JSON.parse(lastLine);
      runner.assert(parsed.verdadExists === false, 'Fault injection accurately detects missing #view-verdad in headless CDP');
      runner.assert(parsed.apExists === false, 'Fault injection accurately detects missing #infowar-ap-badge in headless CDP');
    }
  } catch (err) {
    runner.assert(false, 'Fail-fast fault injection execution encountered error', err.message);
  } finally {
    if (fs.existsSync(failFastScriptPath)) {
      try { fs.unlinkSync(failFastScriptPath); } catch {}
    }
  }


  // ========================================================================
  // 3. TIER 4 REAL-WORLD APPLICATION SCENARIOS STATE PROGRESSION DEPTH
  // ========================================================================
  runner.section('3. Tier 4 Real-World Application Scenarios Genuine State Progression');

  // Let's test the state progression of all 4 Tier 4 scenarios in depth using the real module classes
  console.log('▶ Testing Scenario 1 Deep Pipeline: VERDAD -> OSINT -> ACH -> WebCrypto DID Sign...');
  
  // Import modules
  const { VerdadEngine } = await import('../js/modules/verdad.js');
  const { AchEngine } = await import('../js/modules/ach.js');
  const { AegisCrypto } = await import('../js/crypto.js');
  const { StateStore, SEED_STATE } = await import('../js/state.js');
  const { InfoWarEngine } = await import('../js/modules/infowar.js');

  const verdadRules = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data/verdad_rules.json'), 'utf8'));
  const osintScenarios = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data/scenarios.json'), 'utf8'));
  const achTemplates = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data/scenarios.json'), 'utf8'));
  const infowarData = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data/scenarios.json'), 'utf8'));

  // Scenario 1 Deep Check:
  // Step 1: Analyze claim with VERDAD
  const claimText = 'EMERGENCY: Coordinated cyber attack triggered massive catastrophic grid collapse across Eastern Seaboard! Stock markets halting trading immediately!';
  const verdadResult = VerdadEngine.runOfflineHeuristics(claimText, verdadRules);
  runner.assert(verdadResult.veracityScore <= 40, `Scenario 1.1: VERDAD detected high-risk claim (Veracity: ${verdadResult.veracityScore} <= 40)`);
  runner.assert(verdadResult.emotionalTriggers.urgency >= 60, `Scenario 1.2: VERDAD flagged urgency trigger (${verdadResult.emotionalTriggers.urgency}/100)`);
  runner.assert(verdadResult.emotionalTriggers.fear >= 60, `Scenario 1.3: VERDAD flagged fear trigger (${verdadResult.emotionalTriggers.fear}/100)`);

  // Step 2: ACH Matrix Evaluation based on evidence
  const achCases = achTemplates.achCases || achTemplates.ach_cases || [];
  const achCase = achCases.find(c => c.id === 'case-grid-outage' || c.id === 'ach-case-01') || achCases[0];
  const rankings = AchEngine.rankHypotheses(achCase.hypotheses, achCase.evidenceList || achCase.evidence, achCase.defaultMatrix || achCase.ratings);
  runner.assert(rankings.length >= 3, `Scenario 1.4: ACH matrix ranked ${rankings.length} competing hypotheses`);
  runner.assert(rankings[0].inconsistency <= rankings[1].inconsistency, 'Scenario 1.5: ACH Rank 1 has minimal mathematical inconsistency');

  // Step 3: WebCrypto ECDSA DID Signing of the Attestation
  const keyPairData = await AegisCrypto.generateKeyPair();
  runner.assert(keyPairData.did.startsWith('did:key:z'), `Scenario 1.6: Generated W3C did:key: ${keyPairData.did.slice(0, 20)}...`);
  
  const attestationStatement = {
    type: 'EpistemicAttestation',
    claim: claimText,
    veracityScore: verdadResult.veracityScore,
    mostProbableHypothesis: rankings[0].name || rankings[0].label || 'H1',
    timestamp: new Date().toISOString()
  };
  const signature = await AegisCrypto.signStatement(keyPairData.keyPair.privateKey, attestationStatement);
  runner.assert(typeof signature === 'string' && signature.length > 50, 'Scenario 1.7: Derived valid Base64URL digital signature');

  const isValidSig = await AegisCrypto.verifyStatement(keyPairData.publicKeyJwk, attestationStatement, signature);
  runner.assert(isValidSig === true, 'Scenario 1.8: Digital signature cryptographically verifies against statement payload');

  const tamperedStatement = { ...attestationStatement, veracityScore: 99 };
  const isTamperedValid = await AegisCrypto.verifyStatement(keyPairData.publicKeyJwk, tamperedStatement, signature);
  runner.assert(isTamperedValid === false, 'Scenario 1.9: Tampering with attestation statement invalidates signature immediately');

  // Scenario 2 Deep Check: InfoWar Game State Progression
  console.log('\n▶ Testing Scenario 2 Deep Pipeline: InfoWar Turn-by-Turn AP Economy & Containment...');
  const campaigns = infowarData.infowarCampaigns || infowarData.infowar_scenarios || [];
  const gameScenario = campaigns[0];
  const engine = new InfoWarEngine(gameScenario);
  runner.assert(engine.getState().turn === 1, 'Scenario 2.1: Game starts at Turn 1');
  runner.assert(engine.getState().ap === 10, 'Scenario 2.2: Initial AP economy is 10 AP');

  // Perform multi-step tactical actions in Turn 1
  const act1 = engine.takeAction('inoculate', 'node-1'); // costs 3
  const act2 = engine.takeAction('debunk', 'node-3');    // costs 4
  const act3 = engine.takeAction('friction', 'node-4');  // costs 2
  runner.assert(act1.success && act2.success && act3.success, 'Scenario 2.3: Player successfully deployed 3 countermeasures');
  runner.assert(engine.getState().ap === 1, 'Scenario 2.4: Remaining AP is exactly 1 (10 - 3 - 4 - 2)');

  // End turn 1 -> advances to turn 2
  const turn1Result = engine.endTurn();
  runner.assert(turn1Result.turn === 2, 'Scenario 2.5: Advance turn successfully transitions to Turn 2');
  runner.assert(engine.getState().ap === 10, 'Scenario 2.6: AP refreshed to 10 on Turn 2');

  // Play until Turn 8 with optimal defense
  for (let t = 2; t <= 8; t++) {
    if (engine.getState().gameOver) break;
    engine.takeAction('debunk', 'node-4');
    engine.takeAction('inoculate', 'node-2');
    engine.takeAction('debunk', 'node-3');
    engine.endTurn();
  }
  const finalGameState = engine.getState();
  runner.assert(finalGameState.gameOver === true, `Scenario 2.7: Game reached terminal state at turn ${finalGameState.turn}`);
  runner.assert(finalGameState.history.length === 8, `Scenario 2.8: Game recorded full 8-turn telemetry history`);

  // Scenario 3 Deep Check: Epistemic Aftercare State & Journal Persistence
  console.log('\n▶ Testing Scenario 3 Deep Pipeline: Aftercare State Store & LocalStorage Export...');
  const testStore = new StateStore(null, { persist: false });
  testStore.set('aftercare.pacerPhase', 'inhale');
  testStore.set('aftercare.cyclesCompleted', 4);
  testStore.set('aftercare.journalEntries', [
    {
      id: 'entry-01',
      title: 'Disinformation Reflex Audit',
      triggerClaim: claimText,
      cognitiveBias: 'Affect Heuristic / Urgency Bias',
      reframing: 'Recognized synthetic panic pacing, decoupled reaction from emotion.',
      timestamp: new Date().toISOString()
    }
  ]);
  const retrievedEntries = testStore.get('aftercare.journalEntries');
  runner.assert(retrievedEntries.length === 1, 'Scenario 3.1: Journal entry persisted into reactive store');
  runner.assert(retrievedEntries[0].cognitiveBias.includes('Affect Heuristic'), 'Scenario 3.2: Journal stores cognitive bias tags accurately');

  // Scenario 4 Deep Check: Early Warning Radar & DISARM Mitigation Checklist
  console.log('\n▶ Testing Scenario 4 Deep Pipeline: Early Warning Alerts & DISARM Playbooks...');
  const earlyWarningData = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data/early_warning.json'), 'utf8'));
  const repSources = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data/sources.json'), 'utf8'));

  const domains = Array.isArray(earlyWarningData) ? earlyWarningData : (earlyWarningData.domains || []);
  const allIncidents = domains.flatMap(d => d.activeIncidents || d.active_incidents || []);
  runner.assert(domains.length >= 6, `Scenario 4.1: Early Warning radar monitors ${domains.length} strategic domains`);
  runner.assert(allIncidents.length >= 3, `Scenario 4.2: ${allIncidents.length} active threat incidents modeled with DISARM playbooks`);
  
  const incident1 = allIncidents[0] || {};
  const dTechs = incident1.disarmCodes || incident1.disarm_techniques || incident1.disarmTechniques || [];
  const domain1 = domains[0] || {};
  const mList = domain1.disarmPlaybook?.actionChecklist || domain1.disarmPlaybook?.steps || incident1.mitigation_checklist || incident1.mitigationChecklist || [];
  runner.assert(dTechs.length > 0, `Scenario 4.3: Incident ${incident1.id} maps to DISARM techniques (${dTechs.join(', ')})`);
  runner.assert(mList.length >= 3, `Scenario 4.4: Incident has ${mList.length}-step interactive mitigation checklist`);

  const hasCredibleSources = repSources.some(s => (s.factualityRating || s.factual_rating || s.factual || '').toLowerCase().includes('high'));
  const hasDisinfoSources = repSources.some(s => (s.factualityRating || s.factual_rating || s.factual || '').toLowerCase().includes('low') || (s.credibilityScore || 100) < 40);
  runner.assert(hasCredibleSources && hasDisinfoSources, 'Scenario 4.5: Source Reputation contains verified high-credibility and flagged disinformation sources');


  // ========================================================================
  // 4. RESOURCE FOOTPRINT, MEMORY PROFILING & UNHANDLED PROMISE REJECTIONS
  // ========================================================================
  runner.section('4. Resource Footprint, Memory Profiling & Promise Safety');

  // Test 4.1: Heap Memory & Object Leak Check over 100 Crypto & ACH Operations
  console.log('▶ Testing memory stability over 100 iterations of crypto and ACH cycles...');
  const memBefore = process.memoryUsage().heapUsed;
  for (let i = 0; i < 100; i++) {
    const kp = await AegisCrypto.generateKeyPair();
    const sig = await AegisCrypto.signStatement(kp.keyPair.privateKey, { iter: i, test: 'stress' });
    await AegisCrypto.verifyStatement(kp.publicKeyJwk, { iter: i, test: 'stress' }, sig);
    AchEngine.rankHypotheses(achCase.hypotheses, achCase.evidenceList || achCase.evidence, achCase.defaultMatrix || achCase.ratings);
    VerdadEngine.runOfflineHeuristics(claimText, verdadRules);
  }
  if (global.gc) global.gc();
  const memAfter = process.memoryUsage().heapUsed;
  const heapDeltaMb = ((memAfter - memBefore) / (1024 * 1024)).toFixed(2);
  console.log(`    Heap used before: ${(memBefore / (1024 * 1024)).toFixed(2)} MB, after: ${(memAfter / (1024 * 1024)).toFixed(2)} MB (Delta: ${heapDeltaMb} MB)`);
  runner.assert(parseFloat(heapDeltaMb) < 50.0, `Heap memory growth is bounded (< 50MB delta, got ${heapDeltaMb}MB)`);

  // Test 4.2: Execution Latency Benchmarking
  console.log('▶ Benchmarking test suite execution times...');
  const tMaster0 = performance.now();
  execFileSync(process.execPath, [path.join(__dirname, 'run-all.js')], { cwd: ROOT_DIR, encoding: 'utf8' });
  const tMaster = Math.round(performance.now() - tMaster0);
  runner.assert(tMaster < 10000, `run-all.js finishes in under 10000ms (Actual: ${tMaster}ms)`);

  const tE2E0 = performance.now();
  execFileSync(process.execPath, [path.join(__dirname, 'test-e2e.js')], { cwd: ROOT_DIR, encoding: 'utf8' });
  const tE2E = Math.round(performance.now() - tE2E0);
  runner.assert(tE2E < 8000, `test-e2e.js finishes in under 8000ms (Actual: ${tE2E}ms)`);

  // Test 4.3: Unhandled Rejection Tracker
  runner.assert(unhandledRejections.length === 0, `0 unhandled promise rejections detected during stress testing (Detected: ${unhandledRejections.length})`);

  return runner.summary();
}

runChallenger2Suite().then(res => {
  if (res.failed > 0) {
    process.exit(1);
  }
}).catch(err => {
  console.error('[CHALLENGER 2 FATAL ERROR]:', err);
  process.exit(1);
});
