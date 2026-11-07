/**
 * SOVEREIGN // AEGIS — Inline-Style Extraction Guard Suite
 *
 * index.html's 493 static style="" attributes were moved into css/extracted-inline.css by
 * tools/extract-inline-styles.mjs (2026-11-06, CSP hardening — ROADMAP §8, STATUS.md item 5).
 * The move was verified as a visual no-op by diffing every element's full computed style,
 * in every view at 1280px and 390px, against the pre-move tree. This suite pins the move and
 * the assumptions that made it safe, so they fail loudly instead of drifting:
 *
 *   1. index.html carries no style="" attribute (so it never again needs 'unsafe-inline').
 *   2. Every data-ix hash in index.html has exactly one rule, and no rule is orphaned.
 *   3. Every rule keeps the :is([data-ix], #ix-never#ix-never) form — (2,0,0) specificity,
 *      which out-ranks every other selector ONLY while none of them uses two or more IDs.
 *   4. No rule is !important (inline styles were not, and JS el.style.* writes must keep
 *      overriding these rules exactly as they overrode the inline attribute).
 *   5. No JS resets an inline value (el.style.x = '' / removeProperty) and no JS reads one
 *      back beyond the known, JS-templated site: both would behave differently now that the
 *      value lives in a stylesheet. Adding either needs a class toggle instead.
 *
 * Zero external runtime dependencies.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
function assert(condition, message) {
  if (condition) { passed++; console.log(`    ✓ ${message}`); } else { failed++; console.error(`    ✗ [FAIL] ${message}`); }
}

const html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
const markup = html.replace(/<!--[\s\S]*?-->/g, ''); // comments may mention style="" in prose
const cssPath = path.join(ROOT_DIR, 'css', 'extracted-inline.css');
const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';

console.log('  Group 1: index.html is free of inline styles');
const inline = [...markup.matchAll(/\sstyle="[^"]*"/g)].length;
assert(inline === 0, `index.html has 0 style="" attributes (found ${inline}) — run node tools/extract-inline-styles.mjs`);
assert(css.length > 0, 'css/extracted-inline.css exists');
assert(/<link rel="stylesheet" href="css\/extracted-inline\.css">/.test(markup),
  'index.html links css/extracted-inline.css');

console.log('  Group 2: hashes and rules match one-to-one');
const used = new Set([...markup.matchAll(/\sdata-ix="([0-9a-f]+)"/g)].map((m) => m[1]));
const ruleRx = /^:is\(\[data-ix="([0-9a-f]+)"\], #ix-never#ix-never\) \{ ([^}]*) \}$/;
const ruleLines = css.split('\n').filter((l) => l.includes('[data-ix='));
const rules = new Map();
let malformed = 0;
let dupes = 0;
for (const line of ruleLines) {
  const m = ruleRx.exec(line);
  if (!m) { malformed++; continue; }
  if (rules.has(m[1])) dupes++;
  rules.set(m[1], m[2]);
}
assert(used.size > 0, `index.html carries data-ix hashes (${used.size} distinct)`);
assert(malformed === 0, `every rule keeps the :is([data-ix], #ix-never#ix-never) specificity form (${malformed} malformed)`);
assert(dupes === 0, `no hash has two rules (${dupes} duplicated)`);
const missing = [...used].filter((h) => !rules.has(h));
assert(missing.length === 0, `every data-ix in index.html has a rule (${missing.length} missing: ${missing.slice(0, 5).join(', ')})`);
const orphans = [...rules.keys()].filter((h) => !used.has(h));
assert(orphans.length === 0, `no orphaned rules (${orphans.length}: ${orphans.slice(0, 5).join(', ')})`);
assert([...rules.values()].every((d) => d.trim().length > 0), 'no empty rule bodies');

console.log('  Group 3: the specificity guarantee still holds');
assert(!/!important/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'no extracted rule is !important');
let worst = { ids: 0, sel: '' };
for (const f of fs.readdirSync(path.join(ROOT_DIR, 'css')).filter((f) => f.endsWith('.css') && f !== 'extracted-inline.css')) {
  const src = fs.readFileSync(path.join(ROOT_DIR, 'css', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  // Every prelude is the text just before a '{' (since the previous '{', '}' or ';'). That
  // catches selectors nested in @media/@supports, which stripping blocks innermost-first
  // would delete along with their declarations.
  const preludes = [];
  let start = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '{') { preludes.push(src.slice(start, i)); start = i + 1; }
    else if (c === '}' || c === ';') start = i + 1;
  }
  for (const s of preludes.filter((p) => !p.trim().startsWith('@')).join(',').split(',')) {
    const ids = (s.match(/#[A-Za-z_-][\w-]*/g) || []).length;
    if (ids > worst.ids) worst = { ids, sel: `${f}: ${s.trim()}` };
  }
}
assert(worst.ids < 2,
  `no other stylesheet selector uses 2+ IDs, so (2,0,0) still out-ranks them all (max ${worst.ids}${worst.ids >= 2 ? ' — ' + worst.sel : ''})`);

console.log('  Group 4: no JS depends on inline values living on the element');
const jsFiles = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (e.name.endsWith('.js')) jsFiles.push(p);
  }
};
walk(path.join(ROOT_DIR, 'js'));
const resets = [];
const readbacks = [];
for (const f of jsFiles) {
  const rel = path.relative(ROOT_DIR, f);
  fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (/\.style\.[a-zA-Z]+\s*=\s*(''|""|null)\s*[;,)]|\.style\.removeProperty|removeAttribute\(\s*['"]style/.test(line)) resets.push(`${rel}:${i + 1}`);
    if (/\.style\.[a-zA-Z]+\s*(===|!==|==|!=)/.test(line)) readbacks.push(`${rel}:${i + 1}`);
  });
}
assert(resets.length === 0, `no inline-style resets (${resets.join(', ') || 'none'})`);
// The one known read-back toggles #disarm-detail-* panels that cognitive.js renders itself
// with their own inline style — not index.html markup, so the move cannot affect it.
const KNOWN_READBACKS = ['js/modules/cognitive.js'];
const unexpected = readbacks.filter((r) => !KNOWN_READBACKS.includes(r.split(':')[0]));
assert(unexpected.length === 0, `no new inline-style read-backs (${unexpected.join(', ') || 'only the known JS-templated one'})`);

console.log('====================================================');
console.log(`[INLINE STYLE EXTRACTION Summary: ${passed} Passed, ${failed} Failed]`);
console.log('====================================================');
if (failed > 0) process.exit(1);
