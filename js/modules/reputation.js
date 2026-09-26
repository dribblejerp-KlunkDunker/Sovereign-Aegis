/**
 * SOVEREIGN // AEGIS — Source Reputation Directory Module
 * 50+ Media Outlet Dossiers, Factual Integrity Scores, Ideological Bias Filters
 */

import { esc } from '../security.js';
export const ReputationModule = {
  _app: null,
  _sources: [],

  async init(app) {
    this._app = app;
    await this._loadData();
    this._bindEvents();
    console.log('[ReputationModule] Initialized.');
  },

  onMount() {
    this.renderTable();
  },

  async _loadData() {
    try {
      const res = await fetch('./data/sources.json').catch(() => fetch('data/sources.json'));
      if (res && res.ok) {
        const raw = await res.json();
        // Every field renders what the dataset actually says — a missing rating
        // shows UNRATED/UNRECORDED, never a invented default like the old `|| 90`.
        this._sources = raw.map(s => ({
          name: s.name,
          domain: s.domain,
          factual: s.factualityRating
            ? `${String(s.factualityRating).toUpperCase()}${s.credibilityScore != null ? ` (${s.credibilityScore}%)` : ''}`
            : (s.credibilityScore != null ? `${s.credibilityScore}%` : 'UNRATED'),
          bias: (s.biasRating || 'UNRATED').toUpperCase(),
          biasType: (s.biasRating || '').toUpperCase().includes('LEFT') ? 'LEFT' : (s.biasRating || '').toUpperCase().includes('RIGHT') ? 'RIGHT' : (s.biasRating || '').toUpperCase().includes('STATE') ? 'STATE' : 'CENTER',
          history: s.retractionHistory?.notes || (s.retractionHistory ? `${s.retractionHistory.totalRetractions || 0} Retractions (${s.retractionHistory.protocolAdherence || 'protocol unrecorded'})` : 'RETRACTION HISTORY UNRECORDED'),
          badge: s.credibilityScore != null
            ? (s.credibilityScore >= 90 ? 'badge-veracity' : s.credibilityScore >= 60 ? 'badge-suspicion' : 'badge-disinfo')
            : 'badge-neutral'
        }));
      }
    } catch {
      // Fail loud (honesty audit 2026-09-26): a load failure now renders an EMPTY
      // directory plus a console warning — never a hardcoded substitute source list.
      // The fictional Reuters/AP/BBC/RT/etc. fallback rows that lived here were
      // invented ratings for real outlets, which is worse than no data.
      this._sources = [];
      console.warn('[ReputationModule] sources.json unavailable — directory renders empty rather than showing substitute data.');
    }
    this.renderTable();
    this.refreshNavBadge();
  },

  /**
   * Nav badge derives from the LOADED source directory (honesty audit
   * 2026-09-26): the old hardcoded "60+ DOSSIERS" was numerically wrong — the
   * dataset ships 55 — and the OSINT subtab's separate table rendered 8.
   */
  refreshNavBadge() {
    const badge = document.getElementById('nav-badge-reputation');
    if (!badge) return;
    if (!this._sources.length) {
      badge.textContent = 'DOSSIERS: N/A';
      badge.title = 'sources.json unavailable — no dossier count can be honestly displayed.';
      return;
    }
    badge.textContent = `${this._sources.length} DOSSIERS`;
    badge.title = `Loaded from data/sources.json: ${this._sources.length} source dossier(s). A real count of the local dataset.`;
  },

  _bindEvents() {
    const searchInput = document.getElementById('input-source-search');
    const biasSelect = document.getElementById('select-bias-filter');

    if (searchInput) {
      searchInput.addEventListener('input', () => this.renderTable());
    }

    if (biasSelect) {
      biasSelect.addEventListener('change', () => this.renderTable());
    }
  },

  renderTable() {
    const tbody = document.querySelector('#table-source-reputation tbody');
    if (!tbody) return;

    const query = (document.getElementById('input-source-search')?.value || '').toLowerCase().trim();
    const biasFilter = document.getElementById('select-bias-filter')?.value || 'ALL';

    const filtered = this._sources.filter(s => {
      const matchQuery = !query || s.name.toLowerCase().includes(query) || s.domain.toLowerCase().includes(query);
      const matchBias = biasFilter === 'ALL' || (s.biasType || '').toUpperCase() === biasFilter;
      return matchQuery && matchBias;
    });

    if (filtered.length === 0) {
      // Distinguish "the dataset failed to load" from "your filter matched nothing".
      const unavailable = !this._sources.length;
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--parchment-muted); padding: var(--space-6);">
            ${unavailable
              ? 'SOURCE DIRECTORY UNAVAILABLE — data/sources.json could not be loaded. No substitute records are shown.'
              : 'No media outlets matching search criteria.'}
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    for (const s of filtered) {
      const badgeClass = s.badge || (s.biasType === 'STATE' ? 'badge-disinfo' : 'badge-veracity');
      html += `
        <tr>
          <td><strong>${esc(s.name)}</strong></td>
          <td><code>${esc(s.domain)}</code></td>
          <td><span class="badge ${esc(badgeClass)}">${esc(s.factual)}</span></td>
          <td><span class="badge ${esc(s.biasType === 'STATE' ? 'badge-disinfo' : 'badge-neutral')}">${esc(s.bias)}</span></td>
          <td>${esc(s.history)}</td>
        </tr>
      `;
    }
    tbody.innerHTML = html;
  }
};
