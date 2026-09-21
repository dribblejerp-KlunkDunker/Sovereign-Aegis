/**
 * SOVEREIGN // AEGIS — Early Warning Threat Radar Module
 * 6-Domain Polar Radar, Active Threat Telemetry, DISARM Countermeasure Checklists
 */

export const EarlyWarningModule = {
  _app: null,
  _alerts: [],

  async init(app) {
    this._app = app;
    await this._loadData();
    this._bindEvents();
    console.log('[EarlyWarningModule] Initialized.');
  },

  onMount() {
    this.renderAlerts();
  },

  async _loadData() {
    try {
      const res = await fetch('./data/early_warning.json').catch(() => fetch('data/early_warning.json'));
      if (res && res.ok) {
        this._alerts = await res.json();
      }
    } catch {
      this._alerts = [
        { id: 'EW-01', domain: 'FINANCE', title: 'Astroturfed Liquidity Panic', threat: 'DEFCON 2', severity: 'HIGH' },
        { id: 'EW-02', domain: 'CIVIC', title: 'Synthetic Voice Polling Closure', threat: 'DEFCON 1', severity: 'CRITICAL' },
        { id: 'EW-03', domain: 'HEALTH', title: 'Contaminated Water Hoax', threat: 'DEFCON 3', severity: 'MEDIUM' }
      ];
    }
  },

  _bindEvents() {
    // Polar radar blip clicks
    const blips = document.querySelectorAll('#svg-polar-radar circle');
    blips.forEach((blip, idx) => {
      blip.style.cursor = 'pointer';
      blip.addEventListener('click', () => {
        const names = ['Astroturfed Liquidity Panic', 'Synthetic Voice Polling Closure', 'Contaminated Water Hoax'];
        this._app?.showToast({
          type: 'warning',
          title: 'RADAR TARGET LOCKED',
          message: `Inspecting active incident: ${names[idx % names.length]}`
        });
      });
    });

    // Checklist interactive counters
    const checkboxes = document.querySelectorAll('#view-early-warning input[type="checkbox"]');
    checkboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        const total = checkboxes.length;
        const checked = document.querySelectorAll('#view-early-warning input[type="checkbox"]:checked').length;
        if (checked === total) {
          this._app?.showToast({
            type: 'success',
            title: 'PLAYBOOK EXECUTED',
            message: 'All 3 DISARM countermeasure objectives verified & deployed.'
          });
        }
      });
    });
  },

  renderAlerts() {
    // Dynamic alerts hook if additional table rendered
  }
};
