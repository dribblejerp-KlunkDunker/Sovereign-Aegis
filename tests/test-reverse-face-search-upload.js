/**
 * Browser regression tests for the downloaded Reverse Face Search Space.
 *
 * Run from the repository root with:
 *   node sovereign-aegis/tests/test-reverse-face-search-upload.js
 *
 * The test discovers the current Hugging Face cache snapshot through refs/main.
 * Set REVERSE_FACE_SEARCH_DIR to override that location.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPACE_CACHE = path.join(
  os.homedir(),
  '.cache',
  'huggingface',
  'hub',
  'spaces--ReverseFaceSearch--Reverse-Face-Search'
);

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

let passed = 0;
let failed = 0;

function check(condition, name, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? `  [${detail}]` : ''}`);
  }
}

function resolveSpaceDir() {
  if (process.env.REVERSE_FACE_SEARCH_DIR) {
    return path.resolve(process.env.REVERSE_FACE_SEARCH_DIR);
  }

  const refPath = path.join(SPACE_CACHE, 'refs', 'main');
  const snapshot = fs.readFileSync(refPath, 'utf8').trim();
  return path.join(SPACE_CACHE, 'snapshots', snapshot);
}

function startStaticServer(rootDir) {
  const root = path.resolve(rootDir);
  const handoffRequests = [];
  const mimeTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
  };

  const server = http.createServer((request, response) => {
    if (request.method === 'POST' && request.url?.split('?')[0] === '/api/face-search/handoff') {
      const chunks = [];
      request.on('data', (chunk) => chunks.push(chunk));
      request.on('end', () => {
        handoffRequests.push({
          body: Buffer.concat(chunks),
          contentType: request.headers['content-type'] || '',
        });
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ ok: true, handoffToken: 'local-test-handoff-token' }));
      });
      return;
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      response.end();
      return;
    }

    let requestPath;
    try {
      requestPath = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname);
    } catch {
      response.writeHead(400);
      response.end();
      return;
    }

    const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
    const filePath = path.resolve(root, relativePath);
    if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403);
      response.end();
      return;
    }

    fs.stat(filePath, (statError, stats) => {
      if (statError || !stats.isFile()) {
        response.writeHead(404);
        response.end();
        return;
      }

      const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      response.writeHead(200, { 'Content-Type': contentType });
      if (request.method === 'HEAD') {
        response.end();
        return;
      }
      fs.createReadStream(filePath).pipe(response);
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, url: `http://127.0.0.1:${address.port}/`, handoffRequests });
    });
  });
}

async function launchBrowser() {
  const candidates = [];
  if (process.env.REVERSE_FACE_SEARCH_BROWSER_PATH) {
    candidates.push({ executablePath: process.env.REVERSE_FACE_SEARCH_BROWSER_PATH });
  }
  candidates.push({});
  candidates.push({ channel: 'chrome' });
  candidates.push({ channel: 'msedge' });

  let lastError;
  for (const options of candidates) {
    try {
      return await chromium.launch({ headless: true, ...options });
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `No Chromium-family browser found. Set REVERSE_FACE_SEARCH_BROWSER_PATH or install a browser. ${lastError?.message || ''}`
  );
}

async function readState(page) {
  return page.evaluate(() => ({
    buttonDisabled: document.getElementById('start-search').disabled,
    buttonText: document.getElementById('start-search').textContent,
    emptyHidden: document.getElementById('upload-empty').hidden,
    errorHidden: document.getElementById('upload-error').hidden,
    errorText: document.getElementById('upload-error').textContent,
    fileName: document.getElementById('file-name').textContent,
    previewHidden: document.getElementById('upload-preview').hidden,
    previewSrc: document.getElementById('preview-image').src,
  }));
}

async function selectFile(page, file) {
  await page.locator('#photo-input').setInputFiles(file);
}

async function testValidSelection(page) {
  await selectFile(page, {
    name: 'valid-test.png',
    mimeType: 'image/png',
    buffer: ONE_PIXEL_PNG,
  });
  const state = await readState(page);
  check(!state.buttonDisabled, 'Valid PNG enables START SEARCH');
  check(!state.previewHidden && state.emptyHidden, 'Valid PNG shows the preview state');
  check(state.fileName === 'valid-test.png', 'Valid PNG filename is displayed', state.fileName);
  check(state.errorHidden, 'Valid PNG clears the validation error');
}

async function testInvalidSelection(page) {
  await selectFile(page, {
    name: 'valid-before-invalid.png',
    mimeType: 'image/png',
    buffer: ONE_PIXEL_PNG,
  });
  await selectFile(page, {
    name: 'not-an-image.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an image'),
  });
  const state = await readState(page);
  check(state.buttonDisabled, 'Invalid file disables START SEARCH');
  check(state.previewHidden && !state.emptyHidden, 'Invalid file clears the previous preview');
  check(state.fileName === '', 'Invalid file clears the previous filename', state.fileName);
  check(!state.errorHidden && state.errorText.includes('JPG or PNG'), 'Invalid file shows a useful error', state.errorText);
}

function createOversizedFixture() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reverse-face-search-'));
  const filePath = path.join(tempDir, 'oversized-test.jpg');
  const descriptor = fs.openSync(filePath, 'w');
  const chunk = Buffer.alloc(1024 * 1024);
  try {
    for (let written = 0; written < MAX_UPLOAD_BYTES + 1; written += chunk.length) {
      fs.writeSync(descriptor, chunk, 0, Math.min(chunk.length, MAX_UPLOAD_BYTES + 1 - written));
    }
  } finally {
    fs.closeSync(descriptor);
  }
  return { filePath, tempDir };
}

async function testOversizedSelection(page, oversizedFilePath) {
  await selectFile(page, oversizedFilePath);
  const state = await readState(page);
  check(state.buttonDisabled, 'Oversized file disables START SEARCH');
  check(state.previewHidden && !state.emptyHidden, 'Oversized file clears the preview');
  check(
    !state.errorHidden && state.errorText.includes('too large'),
    'Oversized file shows the size error',
    state.errorText
  );
}

async function testSuccessfulHandoff(page, handoffRequests) {
  await selectFile(page, {
    name: 'handoff-test.png',
    mimeType: 'image/png',
    buffer: ONE_PIXEL_PNG,
  });

  await page.locator('#start-search').click();
  await page.waitForFunction(
    () => document.getElementById('start-search')?.textContent === 'CONTINUE TO SEARCH'
  );

  const state = await readState(page);
  check(state.buttonText === 'CONTINUE TO SEARCH', 'Successful handoff changes the button label');
  check(!state.buttonDisabled, 'Successful handoff re-enables the continue button');
  check(state.errorHidden, 'Successful handoff leaves no upload error');
  check(handoffRequests.length === 1, 'Local mock handoff endpoint receives one request');
  check(
    handoffRequests[0]?.contentType.includes('multipart/form-data'),
    'Handoff uses multipart/form-data',
    handoffRequests[0]?.contentType
  );
  check(
    handoffRequests[0]?.body.includes(Buffer.from('name="image"')),
    'Handoff includes the image field'
  );
  check(page.url().startsWith('http://127.0.0.1:'), 'Successful handoff stays on the local page', page.url());
}

async function testReplacementSelection(page) {
  await selectFile(page, {
    name: 'first-selection.png',
    mimeType: 'image/png',
    buffer: ONE_PIXEL_PNG,
  });
  const firstState = await readState(page);

  await selectFile(page, {
    name: 'replacement-selection.png',
    mimeType: 'image/png',
    buffer: ONE_PIXEL_PNG,
  });
  const replacementState = await readState(page);

  check(!replacementState.buttonDisabled, 'Replacement PNG keeps START SEARCH enabled');
  check(
    replacementState.fileName === 'replacement-selection.png',
    'Replacement filename replaces the original filename',
    replacementState.fileName
  );
  check(
    replacementState.previewSrc !== firstState.previewSrc,
    'Replacement selection receives a new preview URL'
  );
  check(replacementState.errorHidden, 'Replacement selection clears any validation error');
}

async function main() {
  const spaceDir = resolveSpaceDir();
  assert.ok(fs.existsSync(path.join(spaceDir, 'index.html')), `Space index not found: ${spaceDir}`);

  let server;
  let mainUrl;
  let handoffRequests;
  let browser;
  let oversizedFixture;
  try {
    ({ server, url: mainUrl, handoffRequests } = await startStaticServer(spaceDir));
    browser = await launchBrowser();
    const page = await browser.newPage();
    const pageErrors = [];
    const mockEndpoint = `${mainUrl}api/face-search/handoff`;
    await page.route('https://www.socialsleuth.xyz/api/face-search/handoff', async (route) => {
      const request = route.request();
      const contentType = await request.headerValue('content-type');
      const mockResponse = await fetch(mockEndpoint, {
        method: request.method(),
        headers: { 'content-type': contentType || '' },
        body: request.postDataBuffer() || undefined,
      });
      await route.fulfill({
        status: mockResponse.status,
        contentType: mockResponse.headers.get('content-type') || 'application/json',
        body: await mockResponse.text(),
      });
    });
    page.on('pageerror', (error) => pageErrors.push(String(error)));
    await page.goto(mainUrl, { waitUntil: 'domcontentloaded' });

    await testValidSelection(page);
    await testSuccessfulHandoff(page, handoffRequests);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await testInvalidSelection(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    oversizedFixture = createOversizedFixture();
    await testOversizedSelection(page, oversizedFixture.filePath);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await testReplacementSelection(page);

    check(pageErrors.length === 0, 'No uncaught page errors', pageErrors.slice(0, 3).join(' | '));
  } finally {
    await browser?.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    if (oversizedFixture) fs.rmSync(oversizedFixture.tempDir, { recursive: true, force: true });
  }

  console.log(`\n[ReverseFaceSearchUploadBrowserCheck] ${passed}/${passed + failed} checks passed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
