/**
 * SOVEREIGN // AEGIS — Portable Playwright browser smoke check.
 *
 * Serves the app with the project's own zero-dependency `serve.js`, then drives a
 * headless Chromium-family browser through boot, navigation and view-switching
 * checks. It is a fast, honest complement to the heavy 116-assertion `test-e2e.js`:
 * it proves the app boots and every view activates in a real browser, without the
 * heavy full-app assertions of `test-e2e.js` (which also drives every pillar through
 * real Chromium, including the strict verifier toast checks).
 *
 * Browser auto-discovery, in order:
 *   1. `AEGIS_BROWSER_PATH` env var (explicit override)
 *   2. Playwright-managed Chromium (default `chromium.launch()`)
 *   3. System Google Chrome  (`channel: 'chrome'`)
 *   4. System Microsoft Edge (`channel: 'msedge'`)
 *
 * Fails loudly if none is found — it never degrades to static checks.
 */

import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SERVE_JS = path.join(ROOT_DIR, 'serve.js');

let passed = 0;
let failed = 0;

function check(cond, name, detail = '') {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? `  [${detail}]` : ''}`);
  }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function launchBrowser() {
  const candidates = [];
  if (process.env.AEGIS_BROWSER_PATH) {
    candidates.push(['AEGIS_BROWSER_PATH', { executablePath: process.env.AEGIS_BROWSER_PATH }]);
  }
  candidates.push(['Playwright-managed Chromium', {}]);
  candidates.push(['System Google Chrome', { channel: 'chrome' }]);
  candidates.push(['System Microsoft Edge', { channel: 'msedge' }]);

  let lastErr = null;
  for (const [label, opts] of candidates) {
    try {
      const browser = await chromium.launch({ headless: true, ...opts });
      console.log(`  [browser] ${label}`);
      return browser;
    } catch (err) {
      lastErr = err;
    }
  }
  const hint = lastErr && lastErr.message ? lastErr.message.split('\n')[0] : 'unknown error';
  throw new Error(
    `No Chromium-family browser found. Run \`npx playwright install chromium\` or set AEGIS_BROWSER_PATH. (${hint})`
  );
}

async function main() {
  const port = await freePort();
  const server = spawn(process.execPath, [SERVE_JS, String(port), '--no-open'], {
    cwd: ROOT_DIR,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // serve.js prints the actual URL (it bumps the port if ours got taken), so read it
  // back instead of assuming the port stayed free.
  let url = null;
  server.stdout.on('data', (d) => {
    const m = d.toString().match(/http:\/\/127\.0\.0\.1:\d+\/index\.html/);
    if (m) url = m[0];
  });
  server.stderr.on('data', (d) => console.error('  [serve]', d.toString().trim()));

  try {
    const start = Date.now();
    while (!url && Date.now() - start < 10000) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!url) {
      console.error('[AegisBrowserCheck] serve.js did not report a URL within 10s.');
      process.exitCode = 1;
      return;
    }

    const browser = await launchBrowser();
    const page = await browser.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(`${m.text()} :: ${m.location().url}`);
    });
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Poll the real boot signal rather than trusting navigation timing.
    let booted = false;
    for (let i = 0; i < 100; i++) {
      try {
        booted = await page.evaluate(
          "Boolean(window.AegisApp && window.AegisApp.store && document.querySelector('.nav-item'))"
        );
      } catch {
        /* page may still be loading */
      }
      if (booted) break;
      await new Promise((r) => setTimeout(r, 80));
    }
    check(booted, 'App boots (window.AegisApp + store + nav)');

    // Dismiss the first-run onboarding modal so it cannot block interaction.
    await page.evaluate(
      "(() => { const m = document.getElementById('modal-onboarding'); if (m) (m.closest('.modal-backdrop') || m).remove(); window.AegisApp?.store?.set('app.onboarded', true); })()"
    );

    const navCount = await page.locator('#sidebar .nav-item').count();
    check(navCount === 12, '12 nav items rendered', `got ${navCount}`);

    const views = ['cognitive', 'infowar', 'aftercare', 'verdad', 'osint', 'ach',
      'narrative', 'early-warning', 'reputation', 'identity', 'defense'];
    let switched = 0;
    for (const v of views) {
      await page.evaluate(`AegisApp.switchTab(${JSON.stringify(v)})`);
      const cls = (await page.locator(`#view-${v}`).getAttribute('class')) || '';
      if (cls.split(/\s+/).includes('active')) switched++;
    }
    await page.evaluate('AegisApp.switchTab("overview")');
    check(switched === views.length, `All ${views.length} views activate`, `${switched}/${views.length}`);

    const csp = await page.evaluate(
      "[...document.querySelectorAll('meta[http-equiv=\"Content-Security-Policy\"]')].map(e => e.content).join(' ').includes(\"script-src 'self'\")"
    );
    check(csp, "CSP meta present with script-src 'self'");

    const realConsole = consoleErrors.filter((e) => !/favicon/i.test(e));
    check(realConsole.length === 0, 'No console errors', realConsole.slice(0, 3).join(' | '));
    check(pageErrors.length === 0, 'No uncaught page errors', pageErrors.slice(0, 3).join(' | '));

    await browser.close();
  } catch (err) {
    failed++;
    console.error('  ERROR', err.message);
  } finally {
    server.kill();
  }

  console.log(`\n[AegisBrowserCheck] ${passed}/${passed + failed} checks passed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
