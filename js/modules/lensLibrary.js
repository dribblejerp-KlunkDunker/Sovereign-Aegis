/**
 * SOVEREIGN // AEGIS — Lens Library (InfoWar ▸ Resistance Library reading pane)
 *
 * Thin view layer over the compiled lens guides (data/lens-guides.json, built by
 * tools/build-lens-guides.mjs from docs/guides/*.md — those documents are the source of
 * truth). Rendering itself lives in the pure module js/lensRender.js; this file only
 * fetches data, wires clicks, and interpolates.
 *
 * The guides are self-reflection reference material: comparison lenses for profiling
 * YOURSELF. The pane copy and every guide's three rules enforce that boundary.
 */

import { renderGuideDoc } from '../lensRender.js';
import { esc } from '../security.js';

export const LensLibrary = {
  id: 'lens',
  _app: null,
  _guides: [],
  _active: 0,

  async init(app) {
    this._app = app;
    await this._loadData();
    console.log(`[LensLibrary] Initialized with ${this._guides.length} guides.`);
  },

  onMount() {
    this._renderList();
    this._renderReader();
  },

  async _loadData() {
    if (this._guides.length) return; // init-once, like SiftLabs
    try {
      const res = await fetch('./data/lens-guides.json').catch(() => fetch('data/lens-guides.json'));
      const data = await res.json();
      this._guides = Array.isArray(data?.guides) ? data.guides : [];
    } catch (err) {
      console.error('[LensLibrary] Data load error:', err);
      this._guides = [];
    }
  },

  /**
   * Open a specific guide by its data id (e.g. 'lens.darktriad'). Used by static routes
   * from other modules — the support card in the Personal Defense Profile deep-links to
   * the Dark Triad guide's support paths. Returns false when the id is unknown.
   * @param {string} id
   * @returns {boolean}
   */
  openGuide(id) {
    const idx = this._guides.findIndex((g) => g && g.id === id);
    if (idx === -1) return false;
    this._active = idx;
    this._renderList();
    this._renderReader();
    return true;
  },

  _bindItem(itemEl, idx) {
    itemEl.addEventListener('click', () => {
      this._active = idx;
      this._renderList();
      this._renderReader();
    });
  },

  _renderList() {
    const list = document.getElementById('lens-guide-list');
    if (!list) return;
    if (!this._guides.length) {
      list.innerHTML = '<p class="body-muted">Guide library unavailable (data/lens-guides.json missing or invalid).</p>';
      return;
    }
    list.innerHTML = '';
    this._guides.forEach((g, idx) => {
      const sections = Array.isArray(g.blocks) ? g.blocks.filter((b) => b.type === 'heading').length : 0;
      const item = document.createElement('div');
      item.className = 'card card-granite-inset card-clickable lens-guide-item' + (idx === this._active ? ' active' : '');
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      item.innerHTML =
        '<div class="lens-guide-item-head">' +
          '<span class="lens-guide-item-title">' + esc(g.title) + '</span>' +
          '<span class="badge badge-neutral">' + esc(String(g.evidenceTier || 'unrated')) + '</span>' +
        '</div>' +
        '<div class="lens-guide-item-meta">' + esc(String(g.rules?.length || 0)) + ' rules &middot; ' + sections + ' sections</div>';
      this._bindItem(item, idx);
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.click(); }
      });
      list.appendChild(item);
    });
  },

  _renderReader() {
    const g = this._guides[this._active];
    const titleEl = document.getElementById('lens-active-title');
    const badgeEl = document.getElementById('lens-reader-badge');
    const bodyEl = document.getElementById('lens-reader-body');
    if (!bodyEl) return;
    if (!g) {
      bodyEl.innerHTML = '<p class="body-muted">No guide selected.</p>';
      return;
    }
    if (titleEl) titleEl.textContent = g.title;
    if (badgeEl) badgeEl.textContent = esc(String(g.evidenceTier || 'unrated')).toUpperCase();
    const preamble = g.status
      ? '<p class="lens-status">' + esc(g.status) + '</p>'
      : '';
    // renderGuideDoc returns SafeHtml (every string it emits is esc()'d inside the pure
    // renderer); the status preamble is esc()'d above. String concat of SafeHtml invokes
    // toString(), yielding trusted, pre-built HTML by the house rule in js/security.js.
    bodyEl.innerHTML = preamble + renderGuideDoc(g);
    bodyEl.scrollTop = 0;
  },
};
