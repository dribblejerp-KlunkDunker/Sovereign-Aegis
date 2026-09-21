/**
 * SOVEREIGN // AEGIS — Lens-guide block renderer (pure module)
 *
 * Maps compiled guide blocks (data/lens-guides.json, produced by tools/build-lens-guides.mjs)
 * to HTML. Pure: strings in, string out, no DOM access — ground-truth testable in Node.
 *
 * Security model: this module renders content that SHIPS WITH THE APP but must never become
 * an injection sink (a tampered dataset, a future user-authored guide). Every text op goes
 * through esc(); every href goes through escUrl() (javascript:/data:/vbscript: -> '#blocked');
 * the final document is wrapped once in markSafe() so module templates can interpolate it
 * under the house rule (js/security.js header).
 */

import { esc, escUrl, markSafe } from './security.js';

/**
 * Render compiled inline ops to HTML.
 * Op shapes (see tools/build-lens-guides.mjs):
 *   ["t", text] | ["c", text] | ["b", ops] | ["i", ops] | ["a", href, ops]
 * Anything malformed renders as escaped text — never throws.
 * @param {*} ops
 * @returns {string} safe HTML fragment
 */
export function renderInline(ops) {
  if (!Array.isArray(ops)) return esc(ops);
  let out = '';
  for (const op of ops) {
    if (!Array.isArray(op)) { out += esc(op); continue; }
    switch (op[0]) {
      case 't':
        out += esc(op[1] ?? '');
        break;
      case 'c':
        out += '<code class="lens-inline-code">' + esc(op[1] ?? '') + '</code>';
        break;
      case 'b':
        out += '<strong>' + renderInline(op[1] ?? []) + '</strong>';
        break;
      case 'i':
        out += '<em>' + renderInline(op[1] ?? []) + '</em>';
        break;
      case 'a':
        out += '<a class="lens-ext-link" href="' + escUrl(op[1]) + '" target="_blank" rel="noopener noreferrer">' + renderInline(op[2] ?? []) + '</a>';
        break;
      default:
        out += esc(String(op[1] ?? ''));
    }
  }
  return out;
}

/**
 * Plain-text extraction from inline ops (no HTML, no escaping) — used to index
 * type sections. Unknown or malformed ops are skipped, never thrown.
 */
function plainText(ops) {
  if (!Array.isArray(ops)) return '';
  let out = '';
  for (const op of ops) {
    if (!Array.isArray(op)) continue;
    if (op[0] === 't') out += String(op[1] ?? '');
    else if (op[0] === 'b' || op[0] === 'i') out += plainText(op[1]);
    else if (op[0] === 'a') out += plainText(op[2]);
  }
  return out;
}

/**
 * Index the per-type sections of a compiled guide as labeled comparison lenses.
 * Recognizes the two compiled heading forms:
 *   MBTI:      "INTJ — \"The Architect\""
 *   Enneagram: "Type 8 — The Challenger"
 * Returns [{ code, label, heading }] in document order; [] when the guide has no
 * type sections (e.g. the Dark Triad pattern catalog). Pure and deterministic —
 * the picker options and the heading a route scrolls to come from the same data.
 * @param {*} guide compiled guide object
 * @returns {Array<{code: string, label: string, heading: string}>}
 */
export function listTypeSections(guide) {
  if (!guide || typeof guide !== 'object' || !Array.isArray(guide.blocks)) return [];
  const out = [];
  for (const b of guide.blocks) {
    if (!b || b.type !== 'heading') continue;
    const text = plainText(b.text).trim();
    if (!text) continue;
    const mbti = /^([A-Z]{4}) — (.+)$/.exec(text);
    const ennea = /^Type (\d+) — (.+)$/.exec(text);
    if (mbti) out.push({ code: mbti[1], label: mbti[2], heading: text });
    else if (ennea) out.push({ code: ennea[1], label: ennea[2], heading: text });
  }
  return out;
}

/**
 * Render one compiled block to HTML. Unknown or malformed block types render as ''
 * rather than throwing — a corrupted dataset must degrade, not break the view.
 * @param {*} block
 * @returns {string} safe HTML fragment
 */
export function renderBlock(block) {
  if (!block || typeof block !== 'object') return '';
  switch (block.type) {
    case 'heading': {
      const lvl = String(Math.min(5, Math.max(2, block.level || 2)));
      return '<h' + lvl + ' class="lens-heading lens-h' + lvl + '">' + renderInline(block.text) + '</h' + lvl + '>';
    }
    case 'paragraph':
      return '<p class="lens-p">' + renderInline(block.text) + '</p>';
    case 'list': {
      const tag = block.ordered ? 'ol' : 'ul';
      const items = Array.isArray(block.items) ? block.items : [];
      return '<' + tag + ' class="lens-list">' + items.map((it) => '<li>' + renderInline(it) + '</li>').join('') + '</' + tag + '>';
    }
    case 'table': {
      const rows = Array.isArray(block.rows) ? block.rows : [];
      if (!rows.length) return '';
      const cols = rows[0].length;
      const cell = (c) => '<td>' + renderInline(c) + '</td>';
      const head = '<tr>' + rows[0].map((c) => '<th>' + renderInline(c) + '</th>').join('') + '</tr>';
      const body = rows.slice(1)
        .map((r) => '<tr>' + Array.from({ length: cols }, (_, i) => cell(r[i] ?? [['t', '']])).join('') + '</tr>')
        .join('');
      return '<div class="lens-table-wrap"><table class="lens-table"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
    }
    case 'quote':
      return '<blockquote class="lens-quote">' + renderInline(block.text) + '</blockquote>';
    case 'code':
      return '<pre class="lens-code"><code>' + esc(block.text ?? '') + '</code></pre>';
    case 'hr':
      return '<hr class="lens-hr">';
    default:
      return '';
  }
}

/**
 * Render a full guide document (rules + body blocks) as a marked-safe HTML string.
 * Body headings are level-2+ by construction (the guide's own title and rules heading are
 * excluded at compile time), so the page keeps a single <h1> without shifting.
 * Rule bodies are compiled inline-op arrays (full text incl. citations), rendered through
 * the same primitives — never as raw markdown fragments.
 * @param {*} guide compiled guide object
 * @returns {SafeHtml} trusted, pre-built HTML
 */
export function renderGuideDoc(guide) {
  if (!guide || typeof guide !== 'object') return markSafe('');
  const rules = Array.isArray(guide.rules) ? guide.rules : [];
  const blocks = Array.isArray(guide.blocks) ? guide.blocks : [];
  const rulesHtml = rules.length
    ? '<div class="lens-rules">' + rules.map((r, i) =>
        '<div class="lens-rule">' +
        '<span class="lens-rule-num">' + esc(String(i + 1)) + '</span>' +
        '<div><strong>' + renderInline(r.title) + '</strong>' +
        (r.body && r.body.length ? '<span class="lens-rule-body"> ' + renderInline(r.body) + '</span>' : '') +
        '</div></div>').join('') + '</div>'
    : '';
  const bodyHtml = blocks.map(renderBlock).join('');
  return markSafe(rulesHtml + bodyHtml);
}
