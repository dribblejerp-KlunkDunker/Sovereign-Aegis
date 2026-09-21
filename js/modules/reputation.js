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
        this._sources = raw.map(s => ({
          name: s.name,
          domain: s.domain,
          factual: `${(s.factualityRating || 'High').toUpperCase()} (${s.credibilityScore || 90}%)`,
          bias: (s.biasRating || 'Center').toUpperCase(),
          biasType: (s.biasRating || 'CENTER').toUpperCase().includes('LEFT') ? 'LEFT' : (s.biasRating || '').toUpperCase().includes('RIGHT') ? 'RIGHT' : (s.biasRating || '').toUpperCase().includes('STATE') ? 'STATE' : 'CENTER',
          history: s.retractionHistory?.notes || `${s.retractionHistory?.totalRetractions || 0} Retractions (${s.retractionHistory?.protocolAdherence || 'Standard'})`,
          badge: (s.credibilityScore || 90) >= 90 ? 'badge-veracity' : (s.credibilityScore || 90) >= 60 ? 'badge-suspicion' : 'badge-disinfo'
        }));
      }
    } catch {
      this._sources = [
        { name: 'Reuters', domain: 'reuters.com', factual: 'VERY HIGH (98%)', bias: 'CENTER', biasType: 'CENTER', history: '0 Failed Checks (Past 5 Years)', badge: 'badge-veracity' },
        { name: 'Associated Press', domain: 'apnews.com', factual: 'VERY HIGH (98%)', bias: 'CENTER', biasType: 'CENTER', history: '0 Failed Checks (Past 5 Years)', badge: 'badge-veracity' },
        { name: 'BBC News', domain: 'bbc.com', factual: 'HIGH (92%)', bias: 'LEFT-CENTER', biasType: 'LEFT', history: '2 Corrected Reports', badge: 'badge-veracity' },
        { name: 'Wall Street Journal', domain: 'wsj.com', factual: 'HIGH (93%)', bias: 'RIGHT-CENTER', biasType: 'RIGHT', history: '1 Corrected Report', badge: 'badge-veracity' },
        { name: 'RT (Russia Today)', domain: 'rt.com', factual: 'VERY LOW (12%)', bias: 'STATE CONTROLLED', biasType: 'STATE', history: '142 Verified False Narratives', badge: 'badge-disinfo' },
        { name: 'Sputnik News', domain: 'sputnikglobe.com', factual: 'VERY LOW (14%)', bias: 'STATE CONTROLLED', biasType: 'STATE', history: '118 Verified False Narratives', badge: 'badge-disinfo' },
        { name: 'ProPublica', domain: 'propublica.org', factual: 'VERY HIGH (96%)', bias: 'LEFT-CENTER', biasType: 'LEFT', history: '0 Failed Checks (Investigative)', badge: 'badge-veracity' },
        { name: 'Financial Times', domain: 'ft.com', factual: 'HIGH (94%)', bias: 'CENTER', biasType: 'CENTER', history: '0 Failed Checks', badge: 'badge-veracity' }
      ];
    }
    this.renderTable();
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
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--parchment-muted); padding: var(--space-6);">
            No media outlets matching search criteria.
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
