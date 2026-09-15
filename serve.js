/**
 * SOVEREIGN // AEGIS — Local development server
 *
 * WHY THIS EXISTS
 * ---------------
 * Opening index.html directly from disk does NOT work, and fails in a way that looks
 * like it worked: the static shell renders with all 11 nav items and several KB of
 * visible text, while every control is dead. Chrome refuses to load ES modules over
 * `file://` because the origin is `null`:
 *
 *   Access to script at 'file:///.../js/app.js' from origin 'null' has been blocked
 *   by CORS policy: Cross origin requests are only supported for protocol schemes...
 *
 * So the app must be served over HTTP. This is a zero-dependency static server in the
 * same spirit as tests/ — no npm install, no build step.
 *
 * Usage:
 *   node serve.js            # serves on the first free port from 8787
 *   node serve.js 3000       # serves on a specific port
 *   node serve.js --no-open  # don't launch a browser
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8'
};

const args = process.argv.slice(2);
const noOpen = args.includes('--no-open');
const portArg = args.find((a) => /^\d+$/.test(a));
const startPort = portArg ? Number(portArg) : 8787;

// Security headers the <meta> CSP in index.html cannot express. The meta tag covers
// script/style/font/connect sources; these cover framing, MIME sniffing and referrer
// leakage, which browsers only honour from an HTTP response.
const SECURITY_HEADERS = {
  // frame-ancestors cannot be delivered via <meta>. Deny clickjacking / framing.
  'Content-Security-Policy': "frame-ancestors 'none'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer'
};

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
    return res.end('Bad request');
  }

  if (pathname === '/' || pathname === '') pathname = '/index.html';

  const filePath = path.join(ROOT, pathname);

  // Directory traversal guard — never serve outside the project root.
  const rel = path.relative(ROOT, filePath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    res.writeHead(403, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS });
      return res.end(`Not found: ${pathname}`);
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      // No caching, so an edit + refresh always shows the edit.
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      ...SECURITY_HEADERS
    });
    res.end(data);
  });
});

function openBrowser(url) {
  const cmd =
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] :
    process.platform === 'darwin' ? ['open', [url]] :
    ['xdg-open', [url]];
  try {
    spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true, shell: false }).unref();
  } catch {
    /* the URL is printed below either way */
  }
}

function listen(port, attemptsLeft = 20) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      listen(port + 1, attemptsLeft - 1);
    } else {
      console.error(`[AEGIS] Could not start server: ${err.message}`);
      process.exitCode = 1;
    }
  });

  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}/index.html`;
    console.log('');
    console.log('  SOVEREIGN // AEGIS is running');
    console.log(`  ${url}`);
    console.log('');
    console.log('  Press Ctrl+C to stop.');
    console.log('');
    if (!noOpen) openBrowser(url);
  });
}

listen(startPort);
