/**
 * SOVEREIGN // AEGIS — Phase 4 transfer study: OSF preregistration bundle (§8/§9)
 *
 * Assembles everything the protocol requires to be "registered … on OSF or an
 * equivalent preregistration service before enrollment" into one upload-ready folder:
 *
 *   docs/transfer-study/osf-bundle/
 *     transfer-study-preregistration.md   (the pre-registered protocol document)
 *     forms/…                             (the six hashed form artifacts)
 *     review/…                            (reviewer instructions + empty worksheet)
 *     analysis/analyze.mjs                (the FROZEN primary analysis script)
 *     analysis/lib.mjs                    (shared deterministic helpers it imports)
 *     power-simulation.json               (the §3-mandated simulation artifact)
 *     MANIFEST.sha256                     (top-level hash of every bundled file)
 *     README.md                           (what this bundle is; upload order)
 *
 * The bundle is deliberately self-contained: a reviewer can verify the primary analysis
 * end-to-end offline from these files alone. Deliberately EXCLUDED: answer keys stay in
 * the bundle (reviewers need them; the OSF embargo covers the review window) — but the
 * raw item bank and app source are not bundled, only what the protocol names.
 *
 * Usage: node tools/transfer-study/osf-bundle.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const STUDY = join(ROOT, 'docs', 'transfer-study');
const OUT = join(STUDY, 'osf-bundle');

const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

if (!existsSync(join(STUDY, 'forms', 'form-manifest.json'))) {
  console.error('forms not built yet — run build-forms.mjs first.');
  process.exit(2);
}

// Fresh bundle every run (no stale files from earlier assemblies).
mkdirSync(OUT, { recursive: true });
for (const sub of ['forms', 'review', 'analysis']) mkdirSync(join(OUT, sub), { recursive: true });

copyFileSync(join(ROOT, 'docs', 'transfer-study-preregistration.md'), join(OUT, 'transfer-study-preregistration.md'));
for (const f of ['form-T0.json', 'form-T1.json', 'form-keys-T0.json', 'form-keys-T1.json', 'practice-manifest.json', 'exclude-ids.json', 'form-manifest.json']) {
  copyFileSync(join(STUDY, 'forms', f), join(OUT, 'forms', f));
}
for (const f of ['ground-truth-worksheet.csv', 'review-instructions.md']) {
  copyFileSync(join(STUDY, 'review', f), join(OUT, 'review', f));
}
copyFileSync(join(HERE, 'analyze.mjs'), join(OUT, 'analysis', 'analyze.mjs'));
copyFileSync(join(HERE, 'lib.mjs'), join(OUT, 'analysis', 'lib.mjs'));
copyFileSync(join(STUDY, 'exports', 'power-simulation.json'), join(OUT, 'power-simulation.json'));

const readme = `# OSF Preregistration Bundle — SOVEREIGN // AEGIS Phase 4 Transfer Study

Assembled by \`tools/transfer-study/osf-bundle.mjs\` from the frozen study kit.

## Upload order on OSF
1. Create a new ** preregistration** draft (OSF Registries → New Registration) and pick
   "Preregistration Template" or "Standard Pre-Data Collection Registration".
2. Upload the protocol (\`transfer-study-preregistration.md\`) as the main document.
3. Upload \`forms/\`, \`review/\`, \`analysis/\`, and \`power-simulation.json\` as
   supplementary files, exactly as hashed in \`MANIFEST.sha256\`.
4. Complete the review workflow (\`review/review-instructions.md\`) BEFORE submitting —
   a completed, hashed worksheet is a protocol precondition; if any item was revised,
   rebuild forms and re-assemble this bundle rather than submitting stale hashes.
5. Submit and record the resulting OSF DOI in \`SESSION-HANDOFF.md\`.

## What a reviewer can verify offline
- Form integrity: \`sha256sum -c MANIFEST.sha256\` reproduces every file's hash.
- The primary estimand and CI procedure: read \`analysis/analyze.mjs\` (frozen; the
  bootstrap seed and replicate count are constants in the file header).
- The machinery works: \`node analysis/analyze.mjs --selftest\` plants a synthetic +15 pp
  effect and verifies recovery (needs only Node ≥18; no network).
- The enrollment target is adequate: see \`power-simulation.json\` verdict.

## Integrity
\`MANIFEST.sha256\` covers every file in this bundle. Regenerating the bundle after any
content change produces different hashes — that is the point. The bundle as uploaded to
OSF is the freeze; this local copy is its working mirror.
`;
writeFileSync(join(OUT, 'README.md'), readme);

// Top-level manifest over everything in the bundle (stable order).
const files = [];
const walk = (dir, prefix = '') => {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name === 'MANIFEST.sha256') continue;
    const full = join(dir, e.name);
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) walk(full, rel);
    else files.push(rel);
  }
};
walk(OUT);

const lines = files.map((rel) => `${sha256(join(OUT, rel))}  ${rel}`);
writeFileSync(join(OUT, 'MANIFEST.sha256'), lines.join('\n') + '\n');

console.log(`bundle: ${OUT}`);
for (const l of lines) console.log(`  ${l.slice(0, 16)}…  ${l.split('  ')[1]}`);
console.log(`MANIFEST.sha256 sha256: ${createHash('sha256').update(lines.join('\n') + '\n').digest('hex').slice(0, 16)}…`);
