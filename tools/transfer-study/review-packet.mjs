/**
 * SOVEREIGN // AEGIS — Phase 4 transfer study: ground-truth review worksheet (§9 item 3)
 *
 * The protocol requires item ground truth and rationales to be "independently reviewed
 * and frozen" BEFORE enrollment. This emits the review packet for exactly the scored
 * held-out items (T0 + T1):
 *
 *   docs/transfer-study/review/ground-truth-worksheet.csv — one row per item with empty
 *     reviewer columns (verdict / date / notes) for the human reviewer to fill.
 *   docs/transfer-study/review/review-instructions.md — what the reviewer must check.
 *
 * The worksheet is derived from the FROZEN forms (it reads form-T0/T1.json), so any
 * change to the forms changes the packet — and the packet's own hash goes into the
 * freeze manifest, closing the loop between review and the frozen artifacts.
 *
 * Usage: node tools/transfer-study/review-packet.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const FORMS = join(ROOT, 'docs', 'transfer-study', 'forms');
const OUT = join(ROOT, 'docs', 'transfer-study', 'review');

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const forms = ['T0', 'T1'].map((name) => ({
  name,
  items: JSON.parse(readFileSync(join(FORMS, `form-${name}.json`), 'utf8')).items
}));

const rows = [['form', 'position', 'itemId', 'difficulty', 'skillTags', 'claim', 'optionA', 'optionB', 'optionC', 'optionD', 'verdict(ok/revise/reject)', 'reviewerNote', 'reviewDate', 'reviewerInitials']];
for (const { name, items } of forms) {
  items.forEach((q, position) => {
    rows.push([
      name, position, q.id, q.difficulty ?? '',
      (q.tests || []).join('; '),
      q.claim || q.scenario || '',
      q.options[0] || '', q.options[1] || '', q.options[2] || '', q.options[3] || '',
      '', '', '', ''
    ]);
  });
}
const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';

const instructions = `# Ground-Truth Review Packet — Phase 4 Transfer Study (protocol §9 item 3)

**Reviewer instructions.** You are independently verifying the scored content of the two
held-out forms (T0 baseline, T1 post-test) before the study can be preregistered. Work
row by row through \`ground-truth-worksheet.csv\`:

1. **Single defensible key.** For each item, satisfy yourself that exactly one option is
   correct as written, and that no other option is arguably also correct. The answer keys
   themselves are in \`../forms/form-keys-T0.json\` / \`form-keys-T1.json\` (they were
   withheld from the served forms on purpose; consult them, do not edit them).
2. **Rationale check.** The source bank carries an \`explanation\` per item (see
   \`data/arena_questions.json\`); confirm it actually justifies the key and contains no
   factual error a fact-checker would flag.
3. **Leak check.** Confirm the item does not give away its own answer (leading wording,
   giveaway phrasing, duplicate of another item on the same form).
4. **Ambiguity/difficulty sanity.** Flag anything whose difficulty looks wildly
   mismatched to its neighbors — do not reorder anything; flag and stop.
5. **Fill the four review columns** (verdict ok/revise/reject, note, date, initials) for
   every row. A blank review column blocks enrollment.

**What happens to your review.** The completed worksheet is hashed and recorded alongside
the frozen artifacts in \`form-manifest.json\`'s freeze block. If any item is rejected or
revised, the forms are REBUILT (new seed policy entry, new hashes, new review packet) —
never patched in place — before preregistration and enrollment.

**Independence.** The reviewer must not be the author of the reviewed items and should
have access to at least one external reference per domain stratum (the item's skillTags
column names them).

Forms covered: ${forms.map((f) => `${f.name} (${f.items.length} items)`).join(', ')} —
${forms.reduce((s, f) => s + f.items.length, 0)} rows in the worksheet.
`;

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'ground-truth-worksheet.csv'), csv);
writeFileSync(join(OUT, 'review-instructions.md'), instructions);

const hash = createHash('sha256').update(csv).digest('hex');
const manifestPath = join(FORMS, 'form-manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.reviewPacket = manifest.reviewPacket || {};
manifest.reviewPacket['ground-truth-worksheet.csv'] = hash;
manifest.reviewPacket.note = 'hash of the EMPTy review packet generated from the frozen forms; the completed packet is hashed again at freeze time';
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`worksheet: ${forms.reduce((s, f) => s + f.items.length, 0)} items (${forms.map((f) => `${f.name}=${f.items.length}`).join(', ')})`);
console.log(`review/ground-truth-worksheet.csv sha256: ${hash.slice(0, 16)}…`);
console.log('recorded in form-manifest.json → reviewPacket');
