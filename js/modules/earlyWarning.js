/**
 * SOVEREIGN // AEGIS — Early Warning Threat Radar Module
 * 6-Domain Polar Radar, active-incident dossier, DISARM countermeasure checklists.
 *
 * HONESTY CONTRACT (2026-09-26 audit — "honest chrome III"):
 * Every rendered value comes from data/early_warning.json. Radar blips are plotted
 * from the dataset's own radarAngle/radarDistance/threatLevel fields; the incident
 * dossier shows the selected domain's first active incident; the checklist is that
 * domain's real DISARM playbook. If the dataset fails to load, this module renders
 * a labeled UNAVAILABLE state — it never substitutes fictional incidents (the old
 * hardcoded three-alert fallback and the three hardcoded blips were removed here).
 *
 * Headless-safe: every render guards on its container elements.
 *
 * @module earlyWarning
 */

import { esc } from '../security.js';

const SEVERITY_COLORS = {
  critical: 'var(--disinfo-crimson)',
  high: 'var(--suspicion-amber)',
  elevated: 'var(--suspicion-amber)',
  medium: 'var(--intel-cyan)'
};

const SEVERITY_BADGES = {
  critical: 'badge-disinfo',
  high: 'badge-suspicion',
  elevated: 'badge-suspicion',
  medium: 'badge-neutral'
};

export const EarlyWarningModule = {
  _app: null,
  _domains: [],
  _selectedDomainIdx: 0,

  async init(app) {
    this._app = app;
    await this._loadData();
    console.log(`[EarlyWarningModule] Initialized with ${this._domains.length} dataset domain(s).`);
  },

  onMount() {
    this.renderAll();
    this._bindCountermeasure();
  },

  /**
   * The execute button ACKNOWLEDGES the playbook — this offline app coordinates
   * nothing in the real world, so the toast says exactly what happened.
   */
  _bindCountermeasure() {
    const btn = document.getElementById('btn-ew-countermeasure');
    if (!btn || btn.dataset.aegisEwBound) return;
    btn.dataset.aegisEwBound = '1';
    btn.addEventListener('click', () => {
      if (!this._domains.length) {
        this._app?.showToast({ type: 'warning', title: 'NO DATASET', message: 'early_warning.json unavailable — no playbook to acknowledge.' });
        return;
      }
      const dom = this._domains[this._selectedDomainIdx % this._domains.length];
      this._app?.showToast({
        type: 'info',
        title: 'PLAYBOOK ACKNOWLEDGED',
        message: `"${dom.disarmPlaybook?.title || dom.domainName}" staged — work the checklist items; nothing is executed off-device.`
      });
    });
  },

  async _loadData() {
    try {
      const res = await fetch('./data/early_warning.json').catch(() => fetch('data/early_warning.json'));
      if (res && res.ok) {
        const data = await res.json();
        this._domains = Array.isArray(data) ? data : [];
        this.refreshNavBadge();
        return;
      }
    } catch {
      // deliberate fall-through: unavailable dataset renders as unavailable
    }
    this._domains = [];
    this.refreshNavBadge();
  },

  /**
   * Nav badge derives from the LOADED dataset (honesty audit 2026-09-26): the
   * old hardcoded "5 ACTIVE" matched neither the dataset's domain count nor its
   * incident count. "N DOM · M INC" is the real monitored-domain and
   * active-incident count from data/early_warning.json.
   */
  refreshNavBadge() {
    const badge = document.getElementById('nav-badge-early-warning');
    if (!badge) return;
    if (!this._domains.length) {
      badge.textContent = 'RADAR: N/A';
      badge.title = 'early_warning.json unavailable — no domain or incident count can be honestly displayed.';
      return;
    }
    const incidents = this._domains.reduce((n, d) => n + (d.activeIncidents ? d.activeIncidents.length : 0), 0);
    badge.textContent = `${this._domains.length} DOM · ${incidents} INC`;
    badge.title = `Loaded from data/early_warning.json: ${this._domains.length} monitored domain(s) with ${incidents} active incident(s) in the dataset — not a live sweep.`;
  },

  renderAll() {
    this.renderDatasetBadge();
    this.renderRadar();
    this.renderDossier();
  },

  renderDatasetBadge() {
    const badge = document.getElementById('ew-dataset-badge');
    if (!badge) return;
    if (!this._domains.length) {
      badge.textContent = 'DATASET: UNAVAILABLE';
      badge.className = 'badge badge-neutral';
      badge.title = 'data/early_warning.json could not be loaded — no domain or incident counts can be displayed.';
      return;
    }
    const incidents = this._domains.reduce((n, d) => n + (d.activeIncidents ? d.activeIncidents.length : 0), 0);
    badge.textContent = `DATASET: ${this._domains.length} DOMAINS / ${incidents} INCIDENTS`;
    badge.className = 'badge badge-neutral';
    badge.title = 'Loaded from data/early_warning.json — a real count of the local dataset, not a live sweep.';
  },

  renderRadar() {
    const g = document.getElementById('radar-blips');
    if (!g) return;
    if (!this._domains.length) {
      g.innerHTML = '';
      return;
    }
    const cx = 160, cy = 160, maxR = 140;
    let html = '';
    this._domains.forEach((dom, idx) => {
      // The dataset's polar coordinates: radarAngle in degrees, radarDistance 0..1.
      const ang = ((dom.radarAngle || 0) * Math.PI) / 180;
      const dist = Math.max(0, Math.min(1, dom.radarDistance ?? 0.5));
      const x = Math.round(cx + maxR * dist * Math.cos(ang));
      const y = Math.round(cy - maxR * dist * Math.sin(ang));
      const color = SEVERITY_COLORS[String(dom.threatLevel || '').toLowerCase()] || 'var(--intel-cyan)';
      const incidents = (dom.activeIncidents || []).length;
      html += `<circle cx="${x}" cy="${y}" r="6" fill="${color}" class="radar-blip${idx === this._selectedDomainIdx ? ' animate-pulse' : ''}" data-domain-idx="${idx}" style="cursor:pointer"><title>${esc(dom.domainName)} — ${esc(String(dom.threatLevel || '—'))} — ${incidents} active incident(s)</title></circle>`;
    });
    g.innerHTML = html;
    g.querySelectorAll('.radar-blip').forEach((blip) => {
      blip.addEventListener('click', () => {
        this._selectedDomainIdx = parseInt(blip.getAttribute('data-domain-idx'), 10) || 0;
        this.renderAll();
      });
    });
  },

  renderDossier() {
    const titleEl = document.getElementById('ew-incident-title');
    const sevEl = document.getElementById('ew-incident-severity');
    const sumEl = document.getElementById('ew-incident-summary');
    const listEl = document.getElementById('ew-playbook-checklist');
    if (!titleEl) return;

    if (!this._domains.length) {
      // Fail loud: the dataset is unavailable, so no incident can be honestly shown.
      titleEl.textContent = 'INCIDENT DOSSIER UNAVAILABLE';
      if (sevEl) { sevEl.textContent = 'NO DATA'; sevEl.className = 'badge badge-neutral'; }
      if (sumEl) sumEl.textContent = 'data/early_warning.json could not be loaded, so no incident can be displayed. This view renders only what the local dataset contains — no substitute incidents.';
      if (listEl) listEl.innerHTML = '';
      return;
    }

    const dom = this._domains[this._selectedDomainIdx % this._domains.length];
    const incident = (dom.activeIncidents || [])[0];
    const playbook = dom.disarmPlaybook || {};
    const sevLabel = String((incident ? incident.severity : dom.threatLevel) || '—');
    const sevKey = sevLabel.toLowerCase();

    titleEl.textContent = incident ? incident.headline : `${dom.domainName} — no active incident in dataset`;
    if (sevEl) {
      sevEl.textContent = sevLabel.toUpperCase();
      sevEl.className = `badge ${SEVERITY_BADGES[sevKey] || 'badge-neutral'}`;
    }
    if (sumEl) {
      sumEl.textContent = incident
        ? `${dom.domainName}. Origin vector: ${incident.originVector || 'unrecorded'}. ${incident.summary || ''}`
        : dom.domainName;
    }

    if (listEl) {
      const actions = playbook.actionChecklist || [];
      if (!actions.length) {
        listEl.innerHTML = '<div class="body-text" style="color: var(--stone-warm); font-style: italic;">No DISARM playbook actions recorded for this domain in the dataset.</div>';
      } else {
        listEl.innerHTML = actions.map((a) =>
          `<label class="flex-row-gap"><input type="checkbox" data-ew-step="${esc(a.stepId || '')}"> <span>${esc(a.task || '')}</span></label>`
        ).join('');
        // Completion feedback is tied to the real checklist length — never a hardcoded "3".
        listEl.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
          cb.addEventListener('change', () => {
            const boxes = Array.from(listEl.querySelectorAll('input[type="checkbox"]'));
            const checked = boxes.filter((b) => b.checked).length;
            if (checked === boxes.length) {
              this._app?.showToast({
                type: 'success',
                title: 'PLAYBOOK EXECUTED',
                message: `All ${boxes.length} actions of "${playbook.title || 'the playbook'}" checked off.`
              });
            }
          });
        });
      }
    }
  }
};
