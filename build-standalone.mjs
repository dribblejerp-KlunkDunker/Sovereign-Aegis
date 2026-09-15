/**
 * SOVEREIGN // AEGIS — single-file build
 *
 * Produces `sovereign-aegis-standalone.html`: the entire application — every stylesheet,
 * all 20 JS modules, and all 17 datasets — inlined into one self-contained HTML file.
 *
 * WHY
 * ---
 * The multi-file app is an ES-module app, so it cannot be opened from disk: Chrome
 * refuses module imports over `file://` (origin `null`), and the failure is silent —
 * the shell renders and nothing works. The standalone build has no module imports and
 * no network fetches, so double-clicking it works, and it can be handed to someone as
 * a single artifact.
 *
 * The multi-file tree remains the source of truth. Re-run this after changing it:
 *     node build-standalone.mjs
 *
 * Requires esbuild (dev-only): npx esbuild --version
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'sovereign-aegis-standalone.html');

const log = (...a) => console.log('  ', ...a);
console.log('\nSOVEREIGN // AEGIS — single-file build\n');

// ---------------------------------------------------------------- 1. bundle JS
const tmpBundle = path.join(ROOT, '.build-bundle.js');
// On Windows, `npx` is a .cmd shim that execFileSync cannot spawn directly (ENOENT);
// spawn the platform-appropriate shim instead. First caught when esbuild stopped
// resolving during the lens-library build.
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
try {
  // shell:true is REQUIRED on Windows since the Node argv0 .cmd hardening (EINVAL otherwise).
  // Because a shell joins args itself, quote the outfile (the project path contains spaces)
  // and pass the entrypoint relative to cwd so its spaces never split the argument.
  execFileSync(npxCmd, [
    '--yes', 'esbuild', 'js/app.js',
    '--bundle', '--format=iife', '--platform=browser',
    '--legal-comments=none', `"--outfile=${tmpBundle}"`
  ], { stdio: ['ignore', 'pipe', 'pipe'], shell: true, cwd: ROOT });
} catch (err) {
  console.error('esbuild failed:', err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
const appBundle = fs.readFileSync(tmpBundle, 'utf8');
fs.unlinkSync(tmpBundle);
log(`bundled js/app.js -> ${(appBundle.length / 1024).toFixed(0)} KB`);

// ---------------------------------------------------------------- 2. inline data
const dataDir = path.join(ROOT, 'data');
const datasets = {};
for (const f of fs.readdirSync(dataDir).filter((f) => f.endsWith('.json'))) {
  datasets[f] = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
}
log(`inlined ${Object.keys(datasets).length} datasets`);

// The app fetches 'data/x.json' / './data/x.json'. Serve those from memory and let
// everything else (the BYOK Gemini endpoint) reach the network untouched.
const fetchShim = `
(function () {
  var DATA = __AEGIS_DATA__;
  var nativeFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var m = /(?:^|\\/)data\\/([A-Za-z0-9_.-]+\\.json)(?:[?#]|$)/.exec(url);
    if (m && Object.prototype.hasOwnProperty.call(DATA, m[1])) {
      var body = JSON.stringify(DATA[m[1]]);
      return Promise.resolve(new Response(body, {
        status: 200, headers: { 'Content-Type': 'application/json' }
      }));
    }
    if (!nativeFetch) return Promise.reject(new Error('fetch unavailable: ' + url));
    return nativeFetch(input, init);
  };
})();
`.replace('__AEGIS_DATA__', JSON.stringify(datasets));

// ---------------------------------------------------------------- 3. inline CSS
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const cssFiles = [...html.matchAll(/<link[^>]+href="(css\/[^"]+\.css)"[^>]*>/g)];
let inlinedCss = '';
for (const [tag, href] of cssFiles) {
  inlinedCss += `\n/* ===== ${href} ===== */\n` + fs.readFileSync(path.join(ROOT, href), 'utf8');
  html = html.replace(tag, '');
}
log(`inlined ${cssFiles.length} stylesheets -> ${(inlinedCss.length / 1024).toFixed(0)} KB`);

// ---------------------------------------------------------------- 4. rewrite <head>
// Drop the module script tags — their contents are in the bundle.
html = html.replace(/<script type="module" src="js\/app\.js"><\/script>/, '');
html = html.replace(/<script type="module" src="js\/fonts\.js"><\/script>/, '');

// The webfont <link> keeps media="print"; promote it here instead of via js/fonts.js.
const fontActivate = `
(function () {
  var l = document.getElementById('aegis-webfonts');
  if (!l) return;
  var go = function () { l.media = 'all'; };
  if (l.sheet) { go(); } else { l.addEventListener('load', go, { once: true }); }
})();
`;

const scripts = [fetchShim, fontActivate, appBundle];

// Guard: a raw control character in any inlined script silently breaks this build.
// The HTML parser rewrites NUL in script data to U+FFFD, so the DOM text no longer
// matches what we hashed — CSP then refuses the script, the app never boots, and the
// only symptom is a console "Refused to execute inline script" with no page error.
// A literal NUL inside a regex character class in js/security.js caused exactly that.
for (const [i, src] of scripts.entries()) {
  const bad = [...src].findIndex((ch) => {
    const c = ch.codePointAt(0);
    return c < 9 || (c > 10 && c < 13) || (c > 13 && c < 32);
  });
  if (bad !== -1) {
    console.error(`\n  FATAL: inlined script ${i} contains a raw control character at index ${bad} `
      + `(U+${scripts[i].codePointAt(bad).toString(16).padStart(4, '0').toUpperCase()}).`);
    console.error('  Replace it with an escape sequence in the source, then rebuild.\n');
    process.exit(1);
  }
}
const hashes = scripts.map(
  (s) => "'sha256-" + crypto.createHash('sha256').update(s, 'utf8').digest('base64') + "'"
);

// CSP is preserved, with the three inline scripts allowed by hash rather than by
// blanket 'unsafe-inline' — an injected <script> still cannot execute.
html = html.replace(
  /script-src 'self';/,
  () => `script-src 'self' ${hashes.join(' ')};`
);
// No same-origin resources exist in a single file opened from disk.
html = html.replace(/default-src 'self';/, "default-src 'none';");
html = html.replace(/style-src 'self' 'unsafe-inline'/, "style-src 'unsafe-inline'");
html = html.replace(/connect-src 'self' /, 'connect-src ');

const styleBlock = `  <style>\n${inlinedCss}\n  </style>\n`;
const scriptBlock = scripts.map((s) => `  <script>${s}</script>`).join('\n');

// NOTE: function replacers, not string replacements.
// String.prototype.replace() interprets `$&`, `$\``, `$'`, `$$` and `$<name>` inside a
// replacement STRING. The esbuild bundle and the concatenated CSS both contain `$`
// sequences, so a plain string replacement silently corrupts them — which broke the CSP
// script hash and left window.AegisApp undefined with no page error, only a "Refused to
// execute inline script" console message. A function replacer is substitution-free.
html = html.replace('</head>', () => `${styleBlock}</head>`);
html = html.replace('</body>', () => `${scriptBlock}\n</body>`);

html = html.replace(
  '<title>',
  '<!-- SINGLE-FILE BUILD — generated by build-standalone.mjs from the multi-file tree.\n'
  + '     Do not edit by hand; edit js/, css/, data/ and rebuild. -->\n  <title>'
);

fs.writeFileSync(OUT, html, 'utf8');
console.log(`\n  -> ${path.basename(OUT)}  (${(html.length / 1024 / 1024).toFixed(2)} MB)\n`);
