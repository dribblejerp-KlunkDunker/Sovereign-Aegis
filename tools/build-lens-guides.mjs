#!/usr/bin/env node
/**
 * SOVEREIGN // AEGIS — lens-guide content compiler
 *
 * docs/guides/*.md are the source of truth for the lens guides. The app cannot fetch .md
 * at runtime on every host and the standalone build only inlines data/*.json, so this
 * compiler derives data/lens-guides.json from the markdown. Run after editing a guide:
 *
 *     node tools/build-lens-guides.mjs
 *
 * Zero dependencies. Deterministic output. Inline markdown is compiled to JSON-safe op
 * lists, never HTML; the runtime renderer (js/lensRender.js) maps ops to safe HTML via
 * js/security.js primitives.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'lens-guides.json');

/** Split markdown source into top-level blocks, keeping tables and lists together. */
function parseBlocks(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let current = null;

  const flush = () => {
    if (!current) return;
    if (current.type === 'paragraph' && current.lines.join('').trim() === '') {
      current = null;
      return;
    }
    blocks.push(finalize(current));
    current = null;
  };

  for (const line of lines) {
    const fence = /^```(.*)$/.exec(line);
    if (fence) {
      if (current && current.type === 'code') {
        flush();
      } else {
        flush();
        current = { type: 'code', lines: [], lang: fence[1].trim() };
      }
      continue;
    }
    if (current && current.type === 'code') {
      current.lines.push(line);
      continue;
    }
    if (/^\s*$/.test(line)) { flush(); continue; }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) { flush(); blocks.push(finalize({ type: 'heading', level: heading[1].length, lines: [heading[2].trim()] })); continue; }

    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flush(); blocks.push(finalize({ type: 'hr', lines: [] })); continue; }

    if (/^\s*\|.*\|\s*$/.test(line)) {
      if (!current || current.type !== 'table') { flush(); current = { type: 'table', lines: [] }; }
      current.lines.push(line.trim().replace(/^\|/, '').replace(/\|$/, ''));
      continue;
    }

    const li = /^\s*(?:[-*+]\s+|\d+[.)]\s+)(.*)$/.exec(line);
    if (li) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      if (!current || current.type !== 'list' || current.ordered !== ordered) { flush(); current = { type: 'list', ordered, lines: [] }; }
      current.lines.push(li[1]);
      continue;
    }

    const quote = /^\s*>\s?(.*)$/.exec(line);
    if (quote) {
      if (!current || current.type !== 'quote') { flush(); current = { type: 'quote', lines: [] }; }
      current.lines.push(quote[1]);
      continue;
    }

    if (!current || current.type !== 'paragraph') { flush(); current = { type: 'paragraph', lines: [] }; }
    current.lines.push(line.trim());
  }
  flush();
  return blocks;
}

/** Collapse a raw block into its final shape, tokenizing inline markdown to ops. */
function finalize(b) {
  if (b.type === 'table') {
    const rows = b.lines
      .map((l) => l.split('|').map((c) => c.trim()))
      .filter((cells) => !cells.every((c) => /^:?-{2,}:?$/.test(c)))
      .map((cells) => cells.map(tokenizeInline));
    return { type: 'table', rows };
  }
  if (b.type === 'list') {
    return { type: 'list', ordered: !!b.ordered, items: b.lines.map(tokenizeInline) };
  }
  if (b.type === 'quote') {
    return { type: 'quote', text: tokenizeInline(b.lines.join(' ')) };
  }
  if (b.type === 'heading') {
    return { type: 'heading', level: b.level, text: tokenizeInline(b.lines[0]) };
  }
  if (b.type === 'code') {
    return { type: 'code', lang: b.lang, text: b.lines.join('\n') };
  }
  if (b.type === 'paragraph') {
    return { type: 'paragraph', text: tokenizeInline(b.lines.join(' ')) };
  }
  return b; // hr already final
}

// ---------------------------------------------------------------------------
// Inline markdown -> JSON-safe op lists (never HTML at compile time)
// ---------------------------------------------------------------------------
// Op shapes:
//   ["t", text]        plain text
//   ["c", text]        inline code
//   ["b", ops]         bold
//   ["i", ops]         italic
//   ["a", href, ops]   link

function tokenizeInline(text) {
  const ops = [];
  let i = 0;

  while (i < text.length) {
    // inline code first: inside backticks nothing else is interpreted
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1);
      if (end !== -1) {
        ops.push(['c', text.slice(i + 1, end)]);
        i = end + 1;
        continue;
      }
    }
    // images: drop entirely (guides are text+links; keep alt text so meaning survives)
    const img = /^!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/.exec(text.slice(i));
    if (img) {
      if (img[1]) ops.push(['t', img[1]]);
      i += img[0].length;
      continue;
    }
    // links
    const link = /^\[([^\]]*)\]\(([^)\s]+)[^)]*\)/.exec(text.slice(i));
    if (link) {
      const href = link[2];
      if (href.endsWith('.md') || href.startsWith('#')) {
        // document-internal reference: no in-app target; render as plain text
        if (link[1]) ops.push(['t', link[1]]);
      } else {
        ops.push(['a', href, link[1] === '' ? [] : tokenizeInline(link[1])]);
      }
      i += link[0].length;
      continue;
    }
    // autolink <https://...>
    const auto = /^<(https?:\/\/[^>]+)>/.exec(text.slice(i));
    if (auto) {
      ops.push(['a', auto[1], [['t', auto[1]]]]);
      i += auto[0].length;
      continue;
    }
    // bold (** or __)
    if (text.startsWith('**', i) || text.startsWith('__', i)) {
      const marker = text.slice(i, i + 2);
      const end = text.indexOf(marker, i + 2);
      if (end !== -1) {
        ops.push(['b', tokenizeInline(text.slice(i + 2, end))]);
        i = end + 2;
        continue;
      }
    }
    // italic (* or _)
    if (text[i] === '*' || text[i] === '_') {
      const end = text.indexOf(text[i], i + 1);
      if (end !== -1) {
        ops.push(['i', tokenizeInline(text.slice(i + 1, end))]);
        i = end + 1;
        continue;
      }
    }
    // bare URL -> link
    const bare = /^https?:\/\/[^\s<>)]+/.exec(text.slice(i));
    if (bare) {
      ops.push(['a', bare[0], [['t', bare[0]]]]);
      i += bare[0].length;
      continue;
    }
    // plain run up to the next interesting character
    let j = i + 1;
    while (j < text.length && !`*_[]!<`.includes(text[j]) && !text.slice(j).startsWith('http')) j++;
    ops.push(['t', text.slice(i, j)]);
    i = j;
  }
  return ops;
}

// ---------------------------------------------------------------------------
// Guide file parsing (front matter + rules block structured, body as blocks)
// ---------------------------------------------------------------------------

function compileGuide(file, id) {
  const raw = fs.readFileSync(path.join(ROOT, 'docs', 'guides', file), 'utf8');

  const title = (/^#\s+(.+)$/m.exec(raw) || [])[1] || id;
  const status = (/^\*\*Status:\*\*\s*(.+)$/m.exec(raw) || [])[1] || '';
  const tier = (/^\*\*Evidence tier:\*\*\s*`?([a-z-]+)`?/im.exec(raw) || [])[1] || 'unrated';

  // Structured "three rules" — numbered bold-led items whose bodies continue on indented
  // lines until the blank line before the next item. Bodies are inline-tokenized so the
  // citations they carry render as links.
  const rulesStart = raw.search(/^##\s+Read this first/m);
  const rules = [];
  if (rulesStart !== -1) {
    const nextH2 = raw.indexOf('\n## ', rulesStart + 1);
    const section = raw.slice(rulesStart, nextH2 === -1 ? raw.length : nextH2);
    const itemRe = /^\d+\.\s+\*\*(.+?)\*\*\s*(.*)$/;
    let collecting = null;
    for (const line of section.split('\n').slice(1)) {
      const m = itemRe.exec(line);
      if (m) {
        if (collecting) rules.push(collecting);
        collecting = { title: m[1].replace(/\s+/g, ' ').trim(), bodyLines: [m[2]] };
      } else if (collecting) {
        if (/^\s*$/.test(line)) {
          rules.push(collecting);
          collecting = null;
        } else if (/^\s+\S/.test(line)) {
          collecting.bodyLines.push(line.trim());
        } else {
          rules.push(collecting);
          collecting = null;
        }
      }
    }
    if (collecting) rules.push(collecting);
    for (const r of rules) r.body = tokenizeInline(r.bodyLines.join(' '));
  }

  // Body: everything after the rules section ends (the next `## ` heading).
  let bodyStart = 0;
  if (rulesStart !== -1) {
    const afterRules = raw.indexOf('\n## ', rulesStart + 1);
    bodyStart = afterRules === -1 ? raw.length : afterRules + 1;
  }
  const body = parseBlocks(raw.slice(bodyStart));

  return {
    id,
    title: title.trim(),
    status: status.trim(),
    evidenceTier: tier.trim(),
    rules,
    blocks: body,
    compiled: new Date().toISOString().slice(0, 10),
  };
}

const guides = [
  compileGuide('mbti-comparison-lens.md', 'lens.mbti'),
  compileGuide('enneagram-comparison-lens.md', 'lens.enneagram'),
  // The Dark Triad guide is behavior recognition rather than a type lens, but both lens
  // guides cross-reference it; shipping it in the same library keeps the in-app set coherent.
  compileGuide('dark-triad-behavior-recognition.md', 'lens.darktriad'),
];

// Deterministic: fixed key order, date-only timestamp.
const payload = { version: 1, generated: new Date().toISOString().slice(0, 10), guides };

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n', 'utf8');

const blocks = guides.reduce((n, g) => n + g.blocks.length, 0);
console.log(`lens-guides.json -> ${payload.guides.length} guides, ${blocks} blocks, ${(fs.statSync(OUT).size / 1024).toFixed(1)} KB`);
