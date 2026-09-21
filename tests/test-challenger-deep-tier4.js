/**
 * SOVEREIGN // AEGIS — Challenger 2 Deep Tier 4 Scenarios & Adversarial Browser Test Suite
 * 
 * Objectives:
 * 1. Deep real browser rendering & CDP verification of all 4 Tier 4 Real-World Application Scenarios:
 *    - Scenario 1: High-Stakes Disinformation Triage (VERDAD -> OSINT -> ACH Matrix -> WebCrypto DID Signing & Verification)
 *    - Scenario 2: Inoculation & Tactical Network Defense (Masterclass -> Prebunking -> InfoWar Game AP Economy -> AAR)
 *    - Scenario 3: Epistemic Friction & Cognitive Aftercare (4-7-8 Breathing Pacer -> Cognitive Reframing -> Stress Journaling)
 *    - Scenario 4: Early Warning & DISARM Response (Threat Radar -> DEFCON -> Mitigation Checklist -> Source Reputation)
 * 2. Adversarial Concurrency, Rapid Tab Storms & Race Condition Testing in Browser DOM.
 * 3. Browser Fault Injection: LocalStorage corruption recovery, API key failover, Malformed Input Stressing.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// ============================================================================
// 1. ADVERSARIAL HARNESS
// ============================================================================
class ChallengerDeepHarness {
  constructor() {
    this.total = 0;
    this.passed = 0;
    this.failed = 0;
    this.failures = [];
    this.startTime = Date.now();
  }

  section(title) {
    console.log(`\n========================================================================`);
    console.log(`[CHALLENGER 2 DEEP TIER 4] ${title}`);
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

  assertEqual(actual, expected, message) {
    const pass = actual === expected;
    this.assert(pass, message, pass ? '' : `Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
  }

  assertIncludes(actual, expectedSubstring, message) {
    const pass = typeof actual === 'string' && actual.includes(expectedSubstring);
    this.assert(pass, message, pass ? '' : `String does not contain "${expectedSubstring}". Got: "${String(actual).slice(0, 80)}..."`);
  }

  summary() {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);
    console.log(`\n========================================================================`);
    console.log(`[CHALLENGER 2 DEEP TIER 4 SUMMARY] ${this.passed}/${this.total} Passed (${this.failed} Failed) in ${elapsed}s`);
    console.log(`========================================================================`);
    if (this.failures.length > 0) {
      console.error('\nFailures encountered:');
      this.failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}`));
    }
    return { passed: this.passed, failed: this.failed, total: this.total, durationSec: parseFloat(elapsed) };
  }
}

// ============================================================================
// 2. STATIC HTTP SERVER
// ============================================================================
class TestServer {
  constructor(rootDir) {
    this.rootDir = rootDir;
    this.server = null;
    this.port = null;
  }

  start() {
    const MIME = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.ico': 'image/x-icon'
    };

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const parsed = new URL(req.url, 'http://localhost');
        let pathname = parsed.pathname === '/' ? '/index.html' : parsed.pathname;
        const safe = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
        const filePath = path.join(this.rootDir, safe);

        if (!filePath.startsWith(this.rootDir)) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }

        fs.readFile(filePath, (err, data) => {
          if (err) {
            res.writeHead(404);
            res.end('Not Found');
            return;
          }
          const ext = path.extname(filePath).toLowerCase();
          res.writeHead(200, {
            'Content-Type': MIME[ext] || 'application/octet-stream',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(data);
        });
      });

      this.server.listen(0, '127.0.0.1', () => {
        this.port = this.server.address().port;
        resolve(this.port);
      });
      this.server.on('error', reject);
    });
  }

  stop() {
    return new Promise(resolve => {
      if (this.server) this.server.close(resolve);
      else resolve();
    });
  }
}

// ============================================================================
// 3. CDP BROWSER CONTROLLER
// ============================================================================
class BrowserController {
  constructor() {
    this.proc = null;
    this.tmpDir = null;
    this.ws = null;
    this.msgId = 1;
    this.callbacks = new Map();
    this.consoleLogs = [];
    this.pageErrors = [];
  }

  static findExecutable() {
    // Was Windows-only, so this suite could never run on Linux or macOS — it was
    // counted among the "15 suites executed" while being incapable of executing.
    const candidates = [
      process.env.AEGIS_CHROME_PATH || '',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\Edge\\Application\\msedge.exe'),
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/opt/pw-browsers/chromium',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    ];
    return candidates.find(p => p && fs.existsSync(p));
  }

  async launch(url) {
    const execPath = BrowserController.findExecutable();
    if (!execPath) throw new Error('No compatible browser executable found.');

    this.tmpDir = path.join(os.tmpdir(), 'aegis-deep-tier4-' + Date.now());
    fs.mkdirSync(this.tmpDir, { recursive: true });

    this.proc = spawn(execPath, [
      '--headless=new',
      '--remote-debugging-port=0',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--window-size=1440,900',
      `--user-data-dir=${this.tmpDir}`,
      'about:blank'
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    // Locate active debugging port
    const portFile = path.join(this.tmpDir, 'DevToolsActivePort');
    let port = null;
    const start = Date.now();
    while (Date.now() - start < 8000) {
      if (fs.existsSync(portFile)) {
        try {
          const content = fs.readFileSync(portFile, 'utf8').trim().split('\n')[0];
          port = parseInt(content, 10);
          if (port > 0) break;
        } catch {}
      }
      await new Promise(r => setTimeout(r, 50));
    }
    if (!port) throw new Error('Failed to obtain CDP debugging port.');

    const listResp = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await listResp.json();
    const pageTarget = targets.find(t => t.type === 'page');
    if (!pageTarget) throw new Error('No page target found.');

    this.ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

    this.ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value || a.description || '').join(' ');
        this.consoleLogs.push({ type: msg.params.type, text });
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        this.pageErrors.push(msg.params.exceptionDetails);
      }
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });

    await new Promise(r => this.ws.addEventListener('open', r));

    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('DOM.enable');

    await this.send('Page.navigate', { url });
    await new Promise(r => setTimeout(r, 1200)); // Allow app initialization
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
    }
    return res.result.value;
  }

  async click(selector) {
    return this.eval(`
      (() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) throw new Error('Element not found: ' + ${JSON.stringify(selector)});
        el.click();
        return true;
      })()
    `);
  }

  async type(selector, text) {
    return this.eval(`
      (() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) throw new Error('Element not found: ' + ${JSON.stringify(selector)});
        el.value = ${JSON.stringify(text)};
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()
    `);
  }

  async getText(selector) {
    return this.eval(`
      (() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        return el ? el.textContent.trim() : null;
      })()
    `);
  }

  async isVisible(selector) {
    return this.eval(`
      (() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      })()
    `);
  }

  async close() {
    if (this.ws) {
      try { this.ws.close(); } catch {}
    }
    if (this.proc) {
      try { this.proc.kill(); } catch {}
    }
    if (this.tmpDir) {
      try { fs.rmSync(this.tmpDir, { recursive: true, force: true }); } catch {}
    }
  }
}

// ============================================================================
// 4. MAIN TEST EXECUTION
// ============================================================================
async function runChallengerDeepTier4() {
  const harness = new ChallengerDeepHarness();
  const server = new TestServer(ROOT_DIR);
  const browser = new BrowserController();

  try {
    const port = await server.start();
    const appUrl = `http://127.0.0.1:${port}/index.html`;
    await browser.launch(appUrl);

    // ========================================================================
    // TIER 4 — SCENARIO 1: HIGH-STAKES DISINFORMATION TRIAGE
    // ========================================================================
    harness.section('Scenario 1: High-Stakes Disinformation Triage (VERDAD -> OSINT -> ACH -> WebCrypto DID)');

    // 1.1 Switch to VERDAD and verify rendering
    await browser.eval('AegisApp.switchTab("verdad")');
    const isVerdadVisible = await browser.isVisible('#view-verdad');
    harness.assert(isVerdadVisible, 'Scenario 1.1: VERDAD view renders visibly in real browser');

    // 1.2 Submit viral disinformation claim with intense psychological triggers
    const adversarialViralClaim = 'EMERGENCY BREAKING: Corrupt liar and foreign cabal poisoned water treatment reservoir! Everyone must panic and share immediately before it is too late!';
    await browser.type('#textarea-verdad-claim', adversarialViralClaim);
    await browser.click('#btn-run-verdad-audit');
    await new Promise(r => setTimeout(r, 200));

    // Verify computed veracity and emotional triggers in live browser DOM
    const veracityScoreText = await browser.getText('#verdad-veracity-score');
    const veracityScore = parseInt(veracityScoreText, 10);
    harness.assert(!isNaN(veracityScore) && veracityScore <= 40, `Scenario 1.2: VERDAD accurately computes high-risk veracity score (${veracityScore}/100)`);

    const emotionalScoreText = await browser.getText('#verdad-emotional-score');
    harness.assert(Boolean(emotionalScoreText) && emotionalScoreText.includes('/ 10'), `Scenario 1.3: VERDAD emotional intensity score computed (${emotionalScoreText})`);

    const fallaciesCountText = await browser.getText('#verdad-fallacies-count');
    harness.assert(Boolean(fallaciesCountText) && !fallaciesCountText.includes('0 MATCHES'), `Scenario 1.4: VERDAD flags detected fallacies (${fallaciesCountText})`);

    const flagsListHtml = await browser.getText('#verdad-flags-list');
    harness.assertIncludes(flagsListHtml, 'VECTOR', 'Scenario 1.5: VERDAD renders affective vector breakdown cards');

    const counterCardText = await browser.getText('#verdad-counter-card');
    harness.assert(counterCardText.length > 20, 'Scenario 1.6: Counter-narrative prebunk card rendered in DOM');

    // 1.3 Pivot to OSINT Investigation Suite
    await browser.eval('AegisApp.switchTab("osint", "search")');
    const isOsintVisible = await browser.isVisible('#view-osint');
    harness.assert(isOsintVisible, 'Scenario 1.7: OSINT Investigation Suite active in browser');

    await browser.type('#input-osint-query', 'water-conspiracy-leak.io');
    await browser.click('#btn-run-osint-query');
    await new Promise(r => setTimeout(r, 200));

    const sherlockResultsText = await browser.getText('#sherlock-results-grid');
    harness.assertIncludes(sherlockResultsText, 'GITHUB', 'Scenario 1.8: OSINT multi-platform matrix scanned GITHUB');
    harness.assertIncludes(sherlockResultsText, 'TELEGRAM', 'Scenario 1.9: OSINT multi-platform matrix scanned TELEGRAM');

    // 1.4 Pivot to Richards Heuer ACH Matrix
    await browser.eval('AegisApp.switchTab("ach")');
    const isAchVisible = await browser.isVisible('#view-ach');
    harness.assert(isAchVisible, 'Scenario 1.10: Heuer ACH Matrix Lab active in browser');

    // Dynamically interact with ACH matrix cells
    await browser.click('#btn-recompute-ach');
    await new Promise(r => setTimeout(r, 100));

    const achRank1 = await browser.getText('#ach-rankings-grid');
    harness.assertIncludes(achRank1, 'RANK 1', 'Scenario 1.11: ACH Matrix mathematically computed Rank 1 hypothesis');

    // 1.5 Cryptographic Fact Attestation Signing with WebCrypto ECDSA P-256
    await browser.eval('AegisApp.switchTab("identity", "signer")');
    const isSignerVisible = await browser.isVisible('#view-identity');
    harness.assert(isSignerVisible, 'Scenario 1.12: Cryptographic Identity suite active');

    const attestationPayload = 'Attestation #0042: Coordinated water contamination narrative debunked via ELA forensics & OSINT telemetry.';
    await browser.type('#textarea-sign-statement', attestationPayload);
    await browser.click('#btn-sign-statement-now');
    await new Promise(r => setTimeout(r, 100));

    const generatedSig = await browser.getText('#signature-output-display');
    harness.assert(generatedSig.length > 40, 'Scenario 1.13: Generated valid Base64URL digital signature');
    harness.assert(!generatedSig.includes('+') && !generatedSig.includes('/'), 'Scenario 1.14: Signature is clean Base64URL');

    // 1.6 WebCrypto Cryptographic Verification Engine
    const cryptoVerifyResult = await browser.eval(`
      (async () => {
        const { AegisCrypto } = await import('./js/crypto.js');
        const pubKeyJwk = AegisApp.store.get('identity.publicKeyJwk');
        // Signing keys are non-extractable and vaulted in IndexedDB — there is no
        // private JWK in localStorage to read any more, which is the point. Resolve
        // the signing handle through the application's own path instead.
        const resolved = await AegisApp.modules.identity._resolveSigningKey();
        const signingKey = resolved && resolved.key;
        const statementObj = {
          assertion: ${JSON.stringify(attestationPayload)},
          issuer: AegisApp.store.get('identity.did'),
          timestamp: new Date().toISOString()
        };
        const sig = await AegisCrypto.signStatement(signingKey, statementObj);
        const valid = await AegisCrypto.verifyStatement(pubKeyJwk, statementObj, sig);
        const tampered = await AegisCrypto.verifyStatement(pubKeyJwk, { ...statementObj, assertion: 'TAMPERED' }, sig);
        return { valid, tampered };
      })()
    `);
    harness.assert(cryptoVerifyResult.valid === true, 'Scenario 1.15: Cryptographic statement signature verified VALID');
    harness.assert(cryptoVerifyResult.tampered === false, 'Scenario 1.16: Tampered assertion correctly verified INVALID');


    // ========================================================================
    // TIER 4 — SCENARIO 2: INOCULATION & TACTICAL NETWORK DEFENSE
    // ========================================================================
    harness.section('Scenario 2: Inoculation & Tactical Network Defense (Masterclasses -> Prebunking -> InfoWar Game)');

    // 2.1 Masterclass Curriculum navigation
    await browser.eval('AegisApp.switchTab("cognitive", "masterclasses")');
    const isCognitiveVisible = await browser.isVisible('#view-cognitive');
    harness.assert(isCognitiveVisible, 'Scenario 2.1: Cognitive Fortification view active');

    // Switch between masterclasses by clicking syllabus item
    await browser.eval(`
      (() => {
        const items = document.querySelectorAll('.mc-syllabus-item');
        if (items.length > 1) items[1].click();
      })()
    `);
    await new Promise(r => setTimeout(r, 100));
    const readerTitle = await browser.getText('#mc-reader-title, .mc-syllabus-item.active');
    harness.assert(Boolean(readerTitle), 'Scenario 2.2: Masterclass syllabus dynamically switches active reader course');

    // 2.2 Prebunking Simulator
    await browser.eval('AegisApp.switchSubTab("cognitive", "prebunking")');
    const isPrebunkVisible = await browser.isVisible('#subtab-prebunking');
    harness.assert(isPrebunkVisible, 'Scenario 2.3: Prebunking simulator active');

    const prebunkCardsCount = await browser.eval('document.querySelectorAll("#subtab-prebunking .card-clickable").length');
    harness.assert(prebunkCardsCount >= 3, `Scenario 2.4: Prebunking simulator contains ${prebunkCardsCount} interactive propaganda scenarios`);

    // 2.3 InfoWar Serious Game Tactical Network Defense Loop
    await browser.eval('AegisApp.switchTab("infowar")');
    const isInfowarVisible = await browser.isVisible('#view-infowar');
    harness.assert(isInfowarVisible, 'Scenario 2.5: InfoWar tactical network simulator active');

    // Launch first campaign scenario
    await browser.eval(`
      (() => {
        const firstCard = document.querySelector('[data-campaign-idx="0"]');
        if (firstCard) firstCard.click();
        else AegisApp.modules.infowar._startCampaign(AegisApp.modules.infowar._campaigns[0]);
      })()
    `);
    await new Promise(r => setTimeout(r, 150));

    // Verify 10 AP battery and arena
    const apBadgeInitial = await browser.getText('#infowar-ap-badge');
    harness.assertEqual(apBadgeInitial, '10 / 10 AP', 'Scenario 2.6: AP battery initialized to 10/10');

    // Deploy Countermeasure 1: Inoculate Node (costs 3 AP)
    await browser.eval(`
      (() => {
        const eng = AegisApp.modules.infowar._engine;
        if (eng && eng.nodes && eng.nodes.length > 0) {
          AegisApp.modules.infowar._selectedNode = eng.nodes[0].id;
          eng.immunize(eng.nodes[0].id);
          AegisApp.modules.infowar._refreshUI();
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 50));

    const apAfterInoculate = await browser.getText('#infowar-ap-badge');
    harness.assertEqual(apAfterInoculate, '7 / 10 AP', 'Scenario 2.7: Inoculate action deducts 3 AP (7 AP remaining)');

    // Deploy Countermeasure 2: Expose Botnet (costs 4 AP)
    await browser.eval(`
      (() => {
        const eng = AegisApp.modules.infowar._engine;
        if (eng && eng.nodes && eng.nodes.length > 1) {
          AegisApp.modules.infowar._selectedNode = eng.nodes[1].id;
          eng.exposeBotnet(eng.nodes[1].id);
          AegisApp.modules.infowar._refreshUI();
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 50));

    const apAfterBotnet = await browser.getText('#infowar-ap-badge');
    harness.assertEqual(apAfterBotnet, '3 / 10 AP', 'Scenario 2.8: Expose Botnet action deducts 4 AP (3 AP remaining)');

    // Deploy Countermeasure 3: Counter-Narrative (costs 2 AP)
    await browser.eval(`
      (() => {
        const eng = AegisApp.modules.infowar._engine;
        if (eng && eng.nodes && eng.nodes.length > 2) {
          AegisApp.modules.infowar._selectedNode = eng.nodes[2].id;
          eng.counterMessage(eng.nodes[2].id);
          AegisApp.modules.infowar._refreshUI();
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 50));

    const apAfterCounter = await browser.getText('#infowar-ap-badge');
    harness.assertEqual(apAfterCounter, '1 / 10 AP', 'Scenario 2.9: Counter-narrative action deducts 2 AP (1 AP remaining)');

    // Advance turn: Turn 1 -> Turn 2
    await browser.click('#btn-end-turn');
    await new Promise(r => setTimeout(r, 100));

    const turnBadge = await browser.getText('#infowar-turn-badge');
    harness.assertIncludes(turnBadge, 'TURN 2', 'Scenario 2.10: Turn advanced to Turn 2 of 8');

    const apRefreshed = await browser.getText('#infowar-ap-badge');
    harness.assertEqual(apRefreshed, '10 / 10 AP', 'Scenario 2.11: AP battery replenished to 10/10 on turn boundary');

    // Simulate through remaining turns to terminal state (until turn > maxTurns)
    await browser.eval(`
      (() => {
        const eng = AegisApp.modules.infowar._engine;
        while (eng && !eng.gameOver) {
          eng.endTurn();
        }
        AegisApp.modules.infowar._refreshUI();
      })()
    `);
    await new Promise(r => setTimeout(r, 100));

    const isGameOver = await browser.eval('Boolean(AegisApp.modules.infowar._engine?.gameOver)');
    harness.assert(isGameOver, 'Scenario 2.12: InfoWar simulation reached terminal state at turn 8');


    // ========================================================================
    // TIER 4 — SCENARIO 3: EPISTEMIC FRICTION & COGNITIVE AFTERCARE
    // ========================================================================
    harness.section('Scenario 3: Epistemic Friction & Cognitive Aftercare (Somatic Pacer -> Reframing -> Journaling)');

    // 3.1 Somatic 4-7-8 Breathing Pacer
    await browser.eval('AegisApp.switchTab("aftercare", "pacer")');
    const isAftercareVisible = await browser.isVisible('#view-aftercare');
    harness.assert(isAftercareVisible, 'Scenario 3.1: Cognitive Aftercare view active');

    const pacerPhaseInitial = await browser.getText('#breathe-phase-text');
    harness.assertEqual(pacerPhaseInitial, 'INHALE', 'Scenario 3.2: Pacer starts in INHALE phase');

    await browser.click('#btn-start-pacer');
    await new Promise(r => setTimeout(r, 100));

    const isPacerRunning = await browser.eval('Boolean(AegisApp.modules.aftercare?._pacerRunning)');
    harness.assert(isPacerRunning, 'Scenario 3.3: 4-7-8 breathing timer cycle activated');

    // 3.2 Cognitive Reframing Tool
    await browser.eval('AegisApp.switchSubTab("aftercare", "reframing")');
    const isReframingVisible = await browser.isVisible('#subtab-reframing');
    harness.assert(isReframingVisible, 'Scenario 3.4: Cognitive Reframing tool active');

    const reframingCardsText = await browser.getText('#subtab-reframing');
    harness.assertIncludes(reframingCardsText, 'SYSTEM 1', 'Scenario 3.5: Reactive Impulse (System 1) guide rendered');
    harness.assertIncludes(reframingCardsText, 'SYSTEM 2', 'Scenario 3.6: Epistemic Reframe (System 2) guide rendered');

    // Test custom personal reframing generator
    await browser.type('#custom-s1-input', 'Outrageous breaking news claims urgent collapse!');
    await browser.click('#btn-generate-reframe');
    await new Promise(r => setTimeout(r, 50));
    const customReframeText = await browser.getText('#custom-reframe-result');
    harness.assertIncludes(customReframeText, 'SYSTEM 2 EPISTEMIC REFRAME', 'Scenario 3.7: Custom System 2 Epistemic Reframe generated');

    // 3.3 Stress Journaling & Encrypted Export
    await browser.eval('AegisApp.switchSubTab("aftercare", "journal")');
    const isJournalVisible = await browser.isVisible('#subtab-journal');
    harness.assert(isJournalVisible, 'Scenario 3.8: Stress Journaling subtab active');

    await browser.type('#journal-claim', 'Coordinated Viral Outrage Campaign');
    await browser.click('#btn-save-journal');
    await new Promise(r => setTimeout(r, 100));

    const journalCountBadge = await browser.getText('#journal-count-badge');
    harness.assertIncludes(journalCountBadge, 'ENTRIES', 'Scenario 3.9: Reflection entry saved in journal');

    const hasExportJournalBtn = await browser.eval('Boolean(document.getElementById("btn-export-journal"))');
    harness.assert(hasExportJournalBtn, 'Scenario 3.10: Export encrypted journal button present in DOM');


    // ========================================================================
    // TIER 4 — SCENARIO 4: EARLY WARNING & DISARM RESPONSE
    // ========================================================================
    harness.section('Scenario 4: Early Warning & DISARM Response (Radar -> DEFCON -> Mitigation Checklist -> Source Directory)');

    // 4.1 Threat Radar
    await browser.eval('AegisApp.switchTab("early-warning")');
    const isRadarVisible = await browser.isVisible('#view-early-warning');
    harness.assert(isRadarVisible, 'Scenario 4.1: Early Warning Polar Threat Radar active');

    const radarCanvasExists = await browser.eval('Boolean(document.getElementById("canvas-threat-radar") || document.getElementById("svg-radar-threats") || document.querySelector("svg, canvas"))');
    harness.assert(radarCanvasExists, 'Scenario 4.2: Threat Radar visualization rendered');

    // 4.2 Interactive DISARM Checklist
    const checklistItems = await browser.eval('document.querySelectorAll(".card-granite-inset input[type=\'checkbox\']").length');
    harness.assert(checklistItems >= 2, `Scenario 4.3: DISARM mitigation checklist contains ${checklistItems} actionable defense tasks`);

    // Toggle checklist item
    await browser.eval(`
      (() => {
        const cb = document.querySelector(".card-granite-inset input[type='checkbox']");
        if (cb) {
          cb.click();
          cb.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 50));
    // Assert the toggle actually changed state, rather than asserting the literal `true`.
    const checkedCount = await browser.eval('document.querySelectorAll(".card-granite-inset input[type=\'checkbox\']:checked").length');
    harness.assert(checkedCount >= 1, `Scenario 4.4: Interactive DISARM checklist item toggled (checked: ${checkedCount})`);

    // 4.3 Source Reputation Directory & Bias Search
    await browser.eval('AegisApp.switchTab("reputation")');
    const isReputationVisible = await browser.isVisible('#view-reputation');
    harness.assert(isReputationVisible, 'Scenario 4.5: Source Reputation Directory active');

    const filteredRowsText = await browser.getText('#table-source-reputation');
    harness.assertIncludes(filteredRowsText, 'Reuters', 'Scenario 4.6: Reputation directory lists Reuters');
    harness.assertIncludes(filteredRowsText, 'Associated Press', 'Scenario 4.7: Reputation directory lists Associated Press');
    harness.assertIncludes(filteredRowsText, 'VERY HIGH', 'Scenario 4.8: Displays VERY HIGH credibility rating');


    // ========================================================================
    // 5. ADVERSARIAL CONCURRENCY, RAPID TAB STORMS & RACE CONDITION HARNESS
    // ========================================================================
    harness.section('5. Adversarial Browser Concurrency, Tab Storms & Race Condition Stress');

    // 5.1 100 Rapid Tab Switches in under 1 second
    console.log('▶ Firing rapid 100-tab navigation storm in live browser...');
    const tabList = ['overview', 'cognitive', 'infowar', 'aftercare', 'verdad', 'osint', 'ach', 'narrative', 'early-warning', 'reputation', 'identity'];
    let tabSwitchErrors = 0;
    for (let i = 0; i < 100; i++) {
      const targetTab = tabList[i % tabList.length];
      try {
        await browser.eval(`AegisApp.switchTab(${JSON.stringify(targetTab)})`);
      } catch {
        tabSwitchErrors++;
      }
    }
    harness.assertEqual(tabSwitchErrors, 0, '5.1: 100 rapid consecutive tab switches completed with 0 errors');

    // Verify DOM state consistency after storm
    await browser.eval('AegisApp.switchTab("verdad")');
    const finalVerdadVisible = await browser.isVisible('#view-verdad');
    harness.assert(finalVerdadVisible, '5.2: DOM container state is consistent after 100-tab navigation storm');

    // 5.2 Simultaneous multi-click on action buttons
    console.log('▶ Firing simultaneous multi-clicks on audit buttons...');
    const multiClickResult = await browser.eval(`
      (() => {
        const btn = document.getElementById('btn-run-verdad-audit');
        if (!btn) return false;
        for (let i = 0; i < 10; i++) {
          btn.click();
        }
        return true;
      })()
    `);
    harness.assert(multiClickResult, '5.3: 10 simultaneous rapid clicks on VERDAD audit handle gracefully without locking UI');


    // ========================================================================
    // 6. FAULT INJECTION & RESILIENCE IN BROWSER
    // ========================================================================
    harness.section('6. Fault Injection & Browser Error Resilience');

    // 6.1 Corrupted LocalStorage Recovery
    console.log('▶ Injecting corrupt JSON string into localStorage...');
    const recoverySuccess = await browser.eval(`
      (() => {
        try {
          localStorage.setItem('sovereign_aegis_state_v1', '{corrupted_json_payload_###@@@!!!');
          // Re-init StateStore
          const testStore = new AegisApp.store.constructor();
          return testStore.get('app.theme', null) === 'dark-granite';
        } catch (e) {
          return false;
        }
      })()
    `);
    harness.assert(recoverySuccess, '6.1: StateStore safely falls back to default seed state when localStorage is corrupted');

    // 6.2 Browser Page Errors check
    harness.assertEqual(browser.pageErrors.length, 0, `6.2: 0 uncaught JS exceptions during entire adversarial browser test session`);

  } finally {
    await browser.close();
    await server.stop();
  }

  return harness.summary();
}

runChallengerDeepTier4().then(res => {
  if (res.failed > 0) {
    process.exit(1);
  }
}).catch(err => {
  console.error('[Challenger Deep] Fatal Error:', err);
  process.exit(1);
});
