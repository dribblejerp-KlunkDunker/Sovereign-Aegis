/**
 * SOVEREIGN // AEGIS — Epistemic Dossier
 * Local-first scrapbook for analyst findings.
 */

import { esc } from '../security.js';
export const Dossier = {
  _app: null,
  _pins: [],

  async init(app) {
    this._app = app;
    this._loadPins();
    this._bindEvents();
    console.log('[Dossier] Initialized.');
  },

  onMount() {
    this._renderPins();
  },

  onUnmount() {
    // Cleanup if needed
  },

  _loadPins() {
    try {
      const stored = this._app.store.get('dossier.pins');
      this._pins = stored ? JSON.parse(stored) : [];
    } catch (e) {
      this._pins = [];
    }
  },

  _savePins() {
    this._app.store.set('dossier.pins', JSON.stringify(this._pins));
    this._renderPins();
  },

  _bindEvents() {
    const clearBtn = document.getElementById('btn-clear-dossier');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear your local dossier? This cannot be undone.')) {
          this._pins = [];
          this._savePins();
        }
      });
    }

    // Bind global pin event (other modules can dispatch this)
    window.addEventListener('aegis:pin', (e) => {
      const payload = e.detail;
      if (payload) {
        this.addPin(payload);
      }
    });
  },

  /**
   * Add a pin to the dossier
   * @param {Object} pinData { source, title, content, timestamp }
   */
  addPin(pinData) {
    const pin = {
      id: 'pin_' + Date.now(),
      source: pinData.source || 'Unknown Source',
      title: pinData.title || 'Pinned Item',
      content: pinData.content || '',
      timestamp: pinData.timestamp || new Date().toISOString()
    };
    this._pins.unshift(pin); // Add to top
    this._savePins();
    this._app.showToast({ type: 'success', title: 'ITEM PINNED', message: 'Added to Epistemic Dossier.' });
  },

  _renderPins() {
    const feed = document.getElementById('dossier-feed');
    if (!feed) return;

    if (this._pins.length === 0) {
      feed.innerHTML = '<div class="body-text" style="text-align: center; color: var(--stone-warm); font-style: italic; padding: 40px 0;">Dossier is empty. Pin items from other modules to build your case.</div>';
      return;
    }

    feed.innerHTML = this._pins.map(pin => {
      const d = new Date(pin.timestamp);
      const timeStr = d.toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
      return `
        <div class="card-granite-inset" style="padding: 16px; position: relative;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <div class="status-label text-bronze">${esc(pin.source.toUpperCase())}</div>
            <div style="font-family: var(--font-mono); font-size: 0.7rem; color: var(--stone-warm);">${esc(timeStr)}</div>
          </div>
          <h4 style="font-family: var(--font-display); font-size: 1.1rem; color: var(--parchment-light); margin-bottom: 8px;">${esc(pin.title)}</h4>
          <div class="body-text" style="font-size: 0.9rem; line-height: 1.5; white-space: pre-wrap;">${esc(pin.content)}</div>
          <button class="btn-delete-pin" data-id="${esc(pin.id)}" style="position: absolute; top: 12px; right: 12px; background: transparent; border: none; color: var(--crimson-mid); cursor: pointer; font-size: 1.2rem;">×</button>
        </div>
      `;
    }).join('');

    feed.querySelectorAll('.btn-delete-pin').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        this._pins = this._pins.filter(p => p.id !== id);
        this._savePins();
      });
    });
  }
};
