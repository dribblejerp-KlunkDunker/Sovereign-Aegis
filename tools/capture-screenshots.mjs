/**
 * README screenshot capture (manual tooling — not part of any gate).
 * Drives the real app in headless Chromium and saves viewport screenshots to
 * docs/screenshots/ for the README tour. Serve the app first (node serve.mjs),
 * then run: node tools/capture-screenshots.mjs
 * Clicks are DOM-level (el.click() inside evaluate), matching the repo's own
 * E2E harness, since Playwright's actionability checks stall on this app's
 * overlaid/animated nav.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.AEGIS_URL || 'http://127.0.0.1:3000';
const OUT = 'docs/screenshots';
mkdirSync(OUT, { recursive: true });

const watchdog = setTimeout(() => { console.error('WATCHDOG: 120s elapsed, exiting'); process.exit(3); }, 120000);
const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

// DOM click inside evaluate — no actionability checks.
const domClick = (p, sel) => p.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) throw new Error('not found: ' + s);
  el.click();
}, sel);

const nav = (view) => async (p) => domClick(p, `.nav-item[data-view="${view}"]`);

const SHOTS = [
  { file: 'overview.png',           act: nav('overview'), settle: 1200 },
  { file: 'pillar-cognitive.png',   act: nav('cognitive'), settle: 1200 },
  { file: 'pillar-verdad.png',      act: nav('verdad'), settle: 1200 },
  { file: 'cognitive-inoculation.png', act: async (p) => { await nav('cognitive')(p); await domClick(p, '.subtab-btn[data-subtab="prebunking"]'); }, settle: 1500 },
  { file: 'pillar-osint.png',       act: nav('osint'), settle: 1200 },
  { file: 'pillar-infowar.png',     act: nav('infowar'), settle: 1500 },
];

const main = async () => {
  log('launching browser');
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));

  log('goto ' + BASE);
  await page.goto(BASE, { waitUntil: 'commit', timeout: 20000 });
  await page.waitForSelector('.nav-item', { timeout: 20000 });
  await page.waitForFunction(() => Boolean(window.AegisApp && window.AegisApp.store), null, { timeout: 20000 });
  await page.waitForTimeout(2000);
  log('app ready, capturing');

  let captured = 0;
  for (const shot of SHOTS) {
    try {
      await shot.act(page);
      await page.waitForTimeout(shot.settle);
      await page.screenshot({ path: `${OUT}/${shot.file}`, timeout: 15000 });
      log(`captured ${shot.file}`);
      captured++;
    } catch (e) {
      log(`SKIPPED ${shot.file}: ${String(e).split('\n')[0].slice(0, 120)}`);
    }
  }

  log(`${captured}/${SHOTS.length} captured; console errors: ${consoleErrors.length}`);
  if (consoleErrors.length) log('  ' + consoleErrors.slice(0, 5).join('\n  '));
  await browser.close();
  clearTimeout(watchdog);
  process.exit(captured >= 5 ? 0 : 1);
};

main().catch((e) => { console.error('FATAL:', String(e).split('\n')[0]); process.exit(2); });
