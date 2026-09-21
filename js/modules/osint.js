/**
 * SOVEREIGN // AEGIS — The Analyst's Desk & OSINT Tradecraft Suite
 * 
 * Transforms the mock OSINT view into genuine, evidence-grounded investigative tradecraft:
 *   1. The Analyst's Desk: Multi-vector case investigations with analytical deduction,
 *      hedged honesty limitations, calibrated confidence, and attempt-log recording.
 *   2. Solar & Chronolocation Bench: Mathematically rigorous sun-altitude & shadow
 *      trigonometry calculator with live SVG geometric rendering.
 *   3. Rapid Pivot Gauntlet: 60-second speed-triage arcade drilling high-entropy investigative moves.
 *   4. Bellingcat Toolkit Guide: Curated 20+ tool directory with explicit "what it cannot establish" caveats.
 * 
 * Pure functions are exported for headless, deterministic testing without a browser.
 */

import { esc } from '../security.js';
import { recordAttempt, CONTEXTS } from '../attempts.js';
import { Confidence } from '../confidence.js';

/**
 * Deterministic PRNG shuffle helper using a string seed.
 * @private
 */
function shuffleWithKey(arr, key) {
  let s = 0;
  const k = String(key || '');
  for (let i = 0; i < k.length; i++) s = (s * 31 + k.charCodeAt(i)) & 0x7fffffff;
  const next = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  next(); next();
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Assemble a deterministic, shuffled list of investigative cases.
 * 
 * @param {object[]} rawCases - array of cases from data/osint_cases.json
 * @param {number|string} [seed] - deterministic seed
 * @returns {object[]}
 */
export function buildCasePool(rawCases, seed = 0x0517) {
  if (!Array.isArray(rawCases) || rawCases.length === 0) return [];

  const valid = rawCases.filter((c) =>
    c && typeof c.id === 'string' && c.id &&
    typeof c.title === 'string' && c.title &&
    typeof c.briefing === 'string' && c.briefing &&
    Array.isArray(c.vectors) && c.vectors.length >= 2 &&
    c.deductionQuestion && Array.isArray(c.deductionQuestion.options) && c.deductionQuestion.options.length >= 2 &&
    Number.isInteger(c.deductionQuestion.correctIndex) &&
    c.deductionQuestion.correctIndex >= 0 && c.deductionQuestion.correctIndex < c.deductionQuestion.options.length &&
    c.limitationQuestion && Array.isArray(c.limitationQuestion.options) && c.limitationQuestion.options.length >= 2 &&
    Number.isInteger(c.limitationQuestion.correctIndex) &&
    c.limitationQuestion.correctIndex >= 0 && c.limitationQuestion.correctIndex < c.limitationQuestion.options.length &&
    Array.isArray(c.teaches) && c.teaches.length > 0
  );

  const prepared = valid.map((c) => {
    // Shuffle options deterministically per question so the correct answer moves reliably
    const dOrder = shuffleWithKey(c.deductionQuestion.options.map((_, i) => i), `${c.id}-deduction`);
    const lOrder = shuffleWithKey(c.limitationQuestion.options.map((_, i) => i), `${c.id}-limitation`);

    return {
      ...c,
      deductionQuestion: {
        ...c.deductionQuestion,
        options: dOrder.map((i) => c.deductionQuestion.options[i]),
        correctIndex: dOrder.indexOf(c.deductionQuestion.correctIndex)
      },
      limitationQuestion: {
        ...c.limitationQuestion,
        options: lOrder.map((i) => c.limitationQuestion.options[i]),
        correctIndex: lOrder.indexOf(c.limitationQuestion.correctIndex)
      }
    };
  });

  return shuffleWithKey(prepared, `cases-${seed}`);
}

/**
 * Calculate solar altitude and zenith angles from height and shadow measurements.
 * Formula: tan(altitude) = height / shadow -> altitude = atan2(height, shadow)
 * 
 * @param {number} objectHeight - height of vertical object in meters (> 0)
 * @param {number} shadowLength - length of horizontal cast shadow in meters (>= 0)
 * @returns {{isValid: boolean, altitudeDeg: number, zenithDeg: number, shadowRatio: number, error?: string}}
 */
export function calculateSolarAltitude(objectHeight, shadowLength) {
  const h = Number(objectHeight);
  const s = Number(shadowLength);

  if (!Number.isFinite(h) || !Number.isFinite(s) || h <= 0 || s < 0) {
    return {
      isValid: false,
      altitudeDeg: 0,
      zenithDeg: 0,
      shadowRatio: 0,
      error: 'Object height must be > 0 and shadow length must be >= 0'
    };
  }

  if (s === 0) {
    return {
      isValid: true,
      altitudeDeg: 90.0,
      zenithDeg: 0.0,
      shadowRatio: 0.0
    };
  }

  const rad = Math.atan2(h, s);
  const deg = (rad * 180) / Math.PI;
  const altitudeDeg = Math.round(deg * 100) / 100;
  const zenithDeg = Math.round((90 - altitudeDeg) * 100) / 100;
  const shadowRatio = Math.round((s / h) * 1000) / 1000;

  return {
    isValid: true,
    altitudeDeg,
    zenithDeg,
    shadowRatio
  };
}

/**
 * Estimate solar altitude benchmark at solar noon for a given latitude and season.
 * 
 * @param {number} latitude - degrees latitude (-90 to +90)
 * @param {number} solarAltitudeDeg - measured solar altitude in degrees (0 to 90)
 * @returns {{solarNoonEquinox: number, solarNoonSummer: number, solarNoonWinter: number, isAltitudePossibleAtNoon: boolean}}
 */
export function estimateChronolocation(latitude, solarAltitudeDeg) {
  const lat = Math.max(-90, Math.min(90, Number(latitude) || 0));
  const absLat = Math.abs(lat);
  const measured = Number(solarAltitudeDeg) || 0;

  // Maximum solar altitude at solar noon:
  // Equinox: 90 - abs(lat)
  // Summer Solstice: 90 - abs(lat) + 23.44
  // Winter Solstice: max(0, 90 - abs(lat) - 23.44)
  const equinoxNoon = Math.max(0, Math.min(90, 90 - absLat));
  const summerNoon = Math.max(0, Math.min(90, 90 - absLat + 23.44));
  const winterNoon = Math.max(0, Math.min(90, 90 - absLat - 23.44));

  // The measured altitude can never exceed the maximum possible solar noon in midsummer
  const isAltitudePossibleAtNoon = measured <= summerNoon + 0.5;

  return {
    solarNoonEquinox: Math.round(equinoxNoon * 10) / 10,
    solarNoonSummer: Math.round(summerNoon * 10) / 10,
    solarNoonWinter: Math.round(winterNoon * 10) / 10,
    isAltitudePossibleAtNoon
  };
}

/**
 * Pure filter for the Bellingcat investigative toolkit directory.
 * 
 * @param {object[]} tools
 * @param {string} [category]
 * @param {string} [query]
 * @returns {object[]}
 */
export function filterToolkit(tools, category = 'ALL', query = '') {
  if (!Array.isArray(tools)) return [];

  const cat = String(category || 'ALL').toUpperCase();
  const q = String(query || '').toLowerCase().trim();

  return tools.filter((t) => {
    if (!t) return false;
    const matchCat = cat === 'ALL' || String(t.category || '').toUpperCase().includes(cat);
    if (!matchCat) return false;

    if (!q) return true;
    const haystack = `${t.name || ''} ${t.description || ''} ${t.tradecraftUse || ''} ${t.limitation || ''}`.toLowerCase();
    return haystack.includes(q);
  });
}

/**
 * Assemble deterministic 60-second Rapid Pivot Gauntlet pool.
 * 
 * @param {object[]} drills - array of drill objects from data/osint_cases.json
 * @param {number|string} [seed]
 * @returns {object[]}
 */
export function buildPivotDrillPool(drills, seed = 0x9110) {
  if (!Array.isArray(drills)) return [];

  const valid = drills.filter((d) =>
    d && typeof d.id === 'string' && d.id &&
    typeof d.scenario === 'string' && d.scenario &&
    typeof d.prompt === 'string' && d.prompt &&
    Array.isArray(d.options) && d.options.length >= 2 &&
    Number.isInteger(d.correctIndex) && d.correctIndex >= 0 && d.correctIndex < d.options.length &&
    Array.isArray(d.teaches) && d.teaches.length > 0
  );

  const prepared = valid.map((d) => {
    const order = shuffleWithKey(d.options.map((_, i) => i), d.id);
    return {
      ...d,
      options: order.map((i) => d.options[i]),
      correctIndex: order.indexOf(d.correctIndex)
    };
  });

  return shuffleWithKey(prepared, `drills-${seed}`);
}

/**
 * Evaluate an analyst's answers for a case and compute performance metrics.
 * 
 * @param {object} caseObj
 * @param {number} deductionChoice
 * @param {number} limitationChoice
 * @param {string} [confidenceLevel] - 'sure' | 'unsure' | 'guess'
 * @returns {{isFullyCorrect: boolean, deductionCorrect: boolean, limitationCorrect: boolean, score: number, feedback: string}}
 */
export function evaluateCaseAnswer(caseObj, deductionChoice, limitationChoice, confidenceLevel = 'sure') {
  if (!caseObj || !caseObj.deductionQuestion || !caseObj.limitationQuestion) {
    return { isFullyCorrect: false, deductionCorrect: false, limitationCorrect: false, score: 0, feedback: 'Invalid case data' };
  }

  const deductionCorrect = deductionChoice === caseObj.deductionQuestion.correctIndex;
  const limitationCorrect = limitationChoice === caseObj.limitationQuestion.correctIndex;
  const isFullyCorrect = deductionCorrect && limitationCorrect;

  // Base score: 50 pts per correct component
  let baseScore = (deductionCorrect ? 50 : 0) + (limitationCorrect ? 50 : 0);

  // Confidence multiplier / penalty calibration
  let mult = 1.0;
  if (confidenceLevel === 'sure') {
    mult = isFullyCorrect ? 1.25 : 0.6; // High reward for calibration, penalty for overconfidence
  } else if (confidenceLevel === 'guess') {
    mult = 0.85; // Modest points for acknowledged uncertainty
  }

  const score = Math.round(baseScore * mult);

  let feedback = '';
  if (isFullyCorrect) {
    feedback = `CRITICAL DEDUCTION VERIFIED (+${score} PTS). ${caseObj.deductionQuestion.explanation} Furthermore, the analytical limitation was properly hedged: ${caseObj.limitationQuestion.explanation}`;
  } else if (deductionCorrect && !limitationCorrect) {
    feedback = `PARTIAL SUCCESS (+${score} PTS): The core deduction was accurate, but the finding was OVER-READ. Remember: ${caseObj.limitationQuestion.explanation}`;
  } else if (!deductionCorrect && limitationCorrect) {
    feedback = `PARTIAL SUCCESS (+${score} PTS): The analytical caveat was honored, but the primary deduction missed the evidence signal: ${caseObj.deductionQuestion.explanation}`;
  } else {
    feedback = `ANALYTICAL BREACH (0 PTS): Both the primary deduction and the caveat failed. ${caseObj.deductionQuestion.explanation} Caveat reminder: ${caseObj.limitationQuestion.explanation}`;
  }

  return {
    isFullyCorrect,
    deductionCorrect,
    limitationCorrect,
    score,
    feedback
  };
}

export const OsintModule = {
  _app: null,
  _data: null,
  _cases: [],
  _activeCaseIdx: 0,
  _selectedDeduction: null,
  _selectedLimitation: null,
  _selectedConfidence: 'sure',
  _caseSubmitted: false,
  _lastCaseResult: null,

  // Solar tool state
  _solarHeight: 10,
  _solarShadow: 28,
  _solarAzimuth: 340,
  _solarLat: 48,

  // Gauntlet state
  _drillPool: [],
  _drillIdx: 0,
  _drillScore: 0,
  _drillStreak: 0,
  _drillMaxStreak: 0,
  _drillTimeLeft: 60,
  _drillTimer: null,
  _drillActive: false,
  _drillLocked: false,
  _drillAdvanceTimeout: null,
  _lastTickTime: null,

  // Toolkit filter state
  _toolkitCategory: 'ALL',
  _toolkitQuery: '',

  _platforms: [
    { name: 'GITHUB', url: 'github.com/', icon: '💻', status: 'FOUND', badge: 'badge-veracity' },
    { name: 'TELEGRAM', url: 't.me/', icon: '💬', status: 'FOUND', badge: 'badge-veracity' },
    { name: 'KEYBASE', url: 'keybase.io/', icon: '🔐', status: 'VERIFIED PGP', badge: 'badge-crypto' },
    { name: 'REDDIT', url: 'reddit.com/u/', icon: '📌', status: 'NOT FOUND', badge: 'badge-neutral' },
    { name: 'TWITTER / X', url: 'x.com/', icon: '🐦', status: 'FOUND (SUSPENDED)', badge: 'badge-disinfo' },
    { name: 'MASTODON', url: 'mastodon.social/@', icon: '🐘', status: 'FOUND', badge: 'badge-veracity' },
    { name: 'PROTONMAIL', url: '@proton.me', icon: '✉️', status: 'MX CONFIRMED', badge: 'badge-crypto' },
    { name: 'VIRUSTOTAL', url: 'virustotal.com/gui/file/', icon: '🛡️', status: 'CLEAN', badge: 'badge-veracity' }
  ],

  async init(app) {
    this._app = app;
    await this._loadData();
    this._bindEvents();
    console.log('[OsintModule] The Analyst\'s Desk Initialized.');
  },

  onMount() {
    const activeSubtab = this._app?.store?.get('app.activeSubTabs.osint') ||
      document.querySelector('#view-osint .subtab-btn.active')?.getAttribute('data-subtab') ||
      'cases';
    this._renderActiveSubtab(activeSubtab);
  },

  onUnmount() {
    this._stopDrillTimer();
    this._drillActive = false;
    if (this._drillAdvanceTimeout) {
      clearTimeout(this._drillAdvanceTimeout);
      this._drillAdvanceTimeout = null;
    }
  },

  async _loadData() {
    try {
      const res = await fetch('./data/osint_cases.json').catch(() => fetch('data/osint_cases.json'));
      if (res && res.ok) {
        this._data = await res.json();
        this._cases = buildCasePool(this._data.cases || []);
        this._drillPool = buildPivotDrillPool(this._data.pivot_drills || []);
      }
    } catch (e) {
      console.warn('[OsintModule] Failed to load osint_cases.json, using fallback.', e);
      this._data = { cases: [], bellingcat_toolkit: [], pivot_drills: [] };
      this._cases = [];
      this._drillPool = [];
    }
  },

  _bindEvents() {
    // Top-level Subtab navigation within OSINT
    const subtabBtns = document.querySelectorAll('#view-osint .subtab-btn');
    subtabBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const subtab = e.currentTarget.getAttribute('data-subtab');
        if (subtab) {
          subtabBtns.forEach((b) => b.classList.remove('active'));
          e.currentTarget.classList.add('active');
          this._renderActiveSubtab(subtab);
        }
      });
    });

    // Solar tool inputs
    const inputHeight = document.getElementById('solar-input-height');
    const inputShadow = document.getElementById('solar-input-shadow');
    const inputAzimuth = document.getElementById('solar-input-azimuth');
    const inputLat = document.getElementById('solar-input-lat');

    const updateSolar = () => {
      if (inputHeight) {
        const v = parseFloat(inputHeight.value);
        this._solarHeight = Number.isFinite(v) ? v : 10;
      }
      if (inputShadow) {
        const v = parseFloat(inputShadow.value);
        this._solarShadow = Number.isFinite(v) ? v : 0;
      }
      if (inputAzimuth) {
        const v = parseFloat(inputAzimuth.value);
        this._solarAzimuth = Number.isFinite(v) ? v : 0;
      }
      if (inputLat) {
        const v = parseFloat(inputLat.value);
        this._solarLat = Number.isFinite(v) ? v : 0;
      }
      this._renderSolarCalculations();
    };

    if (inputHeight) inputHeight.addEventListener('input', updateSolar);
    if (inputShadow) inputShadow.addEventListener('input', updateSolar);
    if (inputAzimuth) inputAzimuth.addEventListener('input', updateSolar);
    if (inputLat) inputLat.addEventListener('input', updateSolar);

    // Toolkit Search & Filter
    const inputToolSearch = document.getElementById('toolkit-search-input');
    const selectToolCat = document.getElementById('toolkit-category-select');

    if (inputToolSearch) {
      inputToolSearch.addEventListener('input', (e) => {
        this._toolkitQuery = e.target.value;
        this._renderToolkitView();
      });
    }

    if (selectToolCat) {
      selectToolCat.addEventListener('change', (e) => {
        this._toolkitCategory = e.target.value;
        this._renderToolkitView();
      });
    }

    // Gauntlet start & debrief buttons
    const btnStartDrill = document.getElementById('btn-start-pivot-drill');
    if (btnStartDrill) {
      btnStartDrill.addEventListener('click', () => this._startGauntlet());
    }
    document.getElementById('btn-replay-pivot-drill')?.addEventListener('click', () => this._startGauntlet());
    document.getElementById('btn-back-drill-lobby')?.addEventListener('click', () => this._renderDrillLobby());

    // Pivot Query Console (Sherlock)
    const btnRun = document.getElementById('btn-run-osint-query');
    const inputQuery = document.getElementById('input-osint-query');
    const selectType = document.getElementById('select-osint-type');

    if (btnRun && inputQuery) {
      btnRun.addEventListener('click', () => {
        const query = inputQuery.value.trim();
        const type = selectType?.value || 'username';
        if (!query) {
          this._app?.showToast({ type: 'warning', title: 'EMPTY TARGET', message: 'Please enter a target identifier to pivot.' });
          return;
        }
        this.executePivot(query, type);
      });

      inputQuery.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          btnRun.click();
        }
      });
    }

    // Graph Zoom/Pan Controls
    const btnZoomIn = document.getElementById('btn-graph-zoom-in');
    const btnZoomOut = document.getElementById('btn-graph-zoom-out');
    const btnReset = document.getElementById('btn-graph-reset');

    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', () => {
        this._app?.showToast({ type: 'info', title: 'GRAPH ZOOM', message: 'Zooming in (120%)' });
      });
    }
    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', () => {
        this._app?.showToast({ type: 'info', title: 'GRAPH ZOOM', message: 'Zooming out (80%)' });
      });
    }
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this._app?.showToast({ type: 'info', title: 'GRAPH RESET', message: 'Graph viewport reset to origin.' });
      });
    }

    // Keyboard navigation (1, 2, 3, 4) in active drill
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return;
      const osintView = document.getElementById('view-osint');
      const subtabDrills = document.getElementById('subtab-drills');
      const drillView = document.getElementById('osint-drill-active');
      if (!osintView || osintView.classList.contains('hidden')) return;
      if (!subtabDrills || subtabDrills.classList.contains('hidden')) return;
      if (!drillView || drillView.classList.contains('hidden') || !this._drillActive || this._drillLocked) return;

      if (['1', '2', '3', '4'].includes(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        const q = this._drillPool[this._drillIdx];
        if (q && idx >= 0 && idx < q.options.length) {
          this._submitDrillAnswer(idx);
        }
      }
    });
  },

  executePivot(query, type) {
    const statusEl = document.getElementById('osint-scan-status');
    if (statusEl) {
      statusEl.textContent = 'SCANNING 50+ NODES...';
      statusEl.className = 'badge badge-suspicion';
    }

    this._app?.showToast({
      type: 'info',
      title: 'RECONNAISSANCE LAUNCHED',
      message: `Executing deep ${type.toUpperCase()} pivot for: ${query}`
    });

    setTimeout(() => {
      this.renderPlatforms(query);
      if (statusEl) {
        statusEl.textContent = 'RECON COMPLETE (5 FOUND)';
        statusEl.className = 'badge badge-veracity';
      }
      this._app?.showToast({
        type: 'success',
        title: 'PIVOT RESULTS COMPILED',
        message: 'Identified 5 platform presences and 2 active infrastructure ties.'
      });
    }, 800);
  },

  renderPlatforms(target = 'target_user') {
    const container = document.getElementById('sherlock-results-grid');
    if (!container) return;

    let html = '';
    for (const p of this._platforms) {
      html += `
        <div class="card card-granite-inset">
          <div class="flex-row-gap" style="justify-content: space-between;">
            <span class="status-label">${esc(p.icon)} ${esc(p.name)}</span>
            <span class="badge ${esc(p.badge)}">${esc(p.status)}</span>
          </div>
          <div class="crypto-hash" style="margin-top: 4px; font-size: 0.8rem;">${esc(p.url)}${esc(target)}</div>
        </div>
      `;
    }
    container.innerHTML = html;
  },

  _renderActiveSubtab(tabName) {
    if (tabName !== 'drills') {
      this._stopDrillTimer();
      this._drillActive = false;
      if (this._drillAdvanceTimeout) {
        clearTimeout(this._drillAdvanceTimeout);
        this._drillAdvanceTimeout = null;
      }
    }

    const contents = document.querySelectorAll('#view-osint .subtab-content');
    contents.forEach((c) => {
      c.classList.add('hidden');
      c.classList.remove('active');
    });

    const target = document.getElementById(`subtab-${tabName}`);
    if (target) {
      target.classList.remove('hidden');
      target.classList.add('active');
    }

    // Sync subtab button active states
    const subtabBtns = document.querySelectorAll('#view-osint .subtab-btn');
    subtabBtns.forEach((btn) => {
      if (btn.getAttribute('data-subtab') === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (tabName === 'cases') {
      this._renderCasesView();
    } else if (tabName === 'solar') {
      this._renderSolarCalculations();
    } else if (tabName === 'drills') {
      this._renderDrillLobby();
    } else if (tabName === 'toolkit') {
      this._renderToolkitView();
    } else if (tabName === 'search') {
      this.renderPlatforms();
    } else if (tabName === 'dossier') {
      // Epistemic Dossier integration
      if (this._app?.modules?.dossier) {
        this._app.modules.dossier.onMount();
      }
    }
  },

  // =========================================================================
  // 1. THE ANALYST'S DESK: CASE INVESTIGATIONS
  // =========================================================================
  _renderCasesView() {
    const caseSelect = document.getElementById('osint-case-selector');
    const container = document.getElementById('osint-case-dossier-content');
    if (!container || this._cases.length === 0) return;

    if (caseSelect && caseSelect.options.length === 0) {
      caseSelect.innerHTML = this._cases
        .map((c, i) => `<option value="${i}">CASE ${String(i + 1).padStart(2, '0')} // ${esc(c.title)} (${esc(c.domain)})</option>`)
        .join('');

      caseSelect.addEventListener('change', (e) => {
        this._activeCaseIdx = parseInt(e.target.value, 10);
        this._selectedDeduction = null;
        this._selectedLimitation = null;
        this._caseSubmitted = false;
        this._lastCaseResult = null;
        this._renderCasesView();
      });
    }

    const currentCase = this._cases[this._activeCaseIdx];
    if (!currentCase) return;

    let html = `
      <div class="card card-bronze" style="margin-bottom: var(--space-4);">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
          <div>
            <span class="view-tag text-bronze">${esc(currentCase.domain.toUpperCase())}</span>
            <h2 class="heading-2" style="margin: 4px 0 6px 0; color: var(--parchment-bright);">${esc(currentCase.title)}</h2>
          </div>
          <div class="flex-row-gap">
            <span class="badge badge-intel">${esc(currentCase.difficulty.toUpperCase())}</span>
            <span class="badge badge-neutral">CASE #${String(this._activeCaseIdx + 1).padStart(2, '0')} / ${this._cases.length}</span>
          </div>
        </div>

        <div style="background: rgba(0,0,0,0.3); border-left: 3px solid var(--amber-mid); padding: 12px 16px; margin: 12px 0; border-radius: 2px;">
          <strong style="color: var(--amber-light); font-family: var(--font-mono); font-size: 0.8rem;">SUSPICIOUS INTELLIGENCE CLAIM:</strong>
          <p class="body-lead" style="margin: 4px 0 0 0; color: var(--parchment-light); font-style: italic;">
            ${esc(currentCase.claim)}
          </p>
        </div>

        <p class="body-text" style="line-height: 1.6; color: var(--parchment-muted); margin-bottom: 16px;">
          <strong>INVESTIGATIVE BRIEFING:</strong> ${esc(currentCase.briefing)}
        </p>

        <!-- 3 Interactive Evidence Vectors -->
        <h3 class="status-label text-bronze" style="margin-bottom: 10px;">TRIANGULATED EVIDENCE VECTORS</h3>
        <div class="grid-3" style="margin-bottom: 20px;">
          ${currentCase.vectors.map((vec) => `
            <div class="card card-granite-inset" style="padding: 14px;">
              <div style="font-weight: 600; color: var(--bronze-bright); margin-bottom: 6px; font-family: var(--font-mono); font-size: 0.85rem;">
                ${esc(vec.icon)} ${esc(vec.name)}
              </div>
              <div class="body-text" style="font-size: 0.85rem; line-height: 1.5; color: var(--parchment-primary);">
                ${esc(vec.details)}
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Investigation Decision Bench -->
        <div class="card-granite-inset" style="padding: 20px; border: 1px solid var(--border-subtle); margin-bottom: 16px;">
          <h3 class="heading-3" style="color: var(--bronze-bright); margin-bottom: 4px;">OPERATIONAL RULING BENCH</h3>
          <p class="body-muted" style="margin-bottom: 16px;">Commit your analytical deduction and state the exact boundaries of what the evidence establishes.</p>

          <!-- Step 1: Core Deduction -->
          <div style="margin-bottom: 20px;">
            <label class="form-label" style="font-weight: 600; color: var(--parchment-light); margin-bottom: 8px;">
              1. PRIMARY DEDUCTION — ${esc(currentCase.deductionQuestion.prompt)}
            </label>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${currentCase.deductionQuestion.options.map((opt, idx) => `
                <button type="button" class="btn btn-outline case-deduction-btn ${this._selectedDeduction === idx ? 'active' : ''}"
                        data-idx="${idx}" style="text-align: left; justify-content: flex-start; padding: 10px 14px; font-size: 0.88rem; line-height: 1.4; border-radius: 4px;">
                  <span style="font-family: var(--font-mono); color: var(--bronze-bright); margin-right: 8px;">[${String.fromCharCode(65 + idx)}]</span>
                  ${esc(opt)}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Step 2: Hedged Limitation -->
          <div style="margin-bottom: 20px;">
            <label class="form-label" style="font-weight: 600; color: var(--amber-light); margin-bottom: 8px;">
              2. HEDGED LIMITATION — ${esc(currentCase.limitationQuestion.prompt)}
            </label>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${currentCase.limitationQuestion.options.map((opt, idx) => `
                <button type="button" class="btn btn-outline case-limitation-btn ${this._selectedLimitation === idx ? 'active' : ''}"
                        data-idx="${idx}" style="text-align: left; justify-content: flex-start; padding: 10px 14px; font-size: 0.88rem; line-height: 1.4; border-radius: 4px;">
                  <span style="font-family: var(--font-mono); color: var(--amber-mid); margin-right: 8px;">[${idx + 1}]</span>
                  ${esc(opt)}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Step 3: Calibrated Confidence -->
          <div style="margin-bottom: 20px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
            <span class="status-label text-bronze">CALIBRATED CONFIDENCE:</span>
            <div class="flex-row-gap">
              <button type="button" class="btn btn-sm btn-outline case-conf-btn ${this._selectedConfidence === 'sure' ? 'active' : ''}" data-conf="sure">
                HIGH CERTAINTY (90%+)
              </button>
              <button type="button" class="btn btn-sm btn-outline case-conf-btn ${this._selectedConfidence === 'unsure' ? 'active' : ''}" data-conf="unsure">
                PROBABLE (70%)
              </button>
              <button type="button" class="btn btn-sm btn-outline case-conf-btn ${this._selectedConfidence === 'guess' ? 'active' : ''}" data-conf="guess">
                UNCERTAIN / GUESS (50%)
              </button>
            </div>
          </div>

          <!-- Submission & Feedback Row -->
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
            <button class="btn btn-primary" id="btn-submit-case-verdict" ${this._selectedDeduction === null || this._selectedLimitation === null || this._caseSubmitted ? 'disabled' : ''}>
              <span>⚖️ Issue Operational Ruling</span>
            </button>
            ${this._caseSubmitted ? `
              <button class="btn btn-secondary" id="btn-next-case">
                Next Case (${this._activeCaseIdx + 1 < this._cases.length ? `Case ${this._activeCaseIdx + 2}` : 'Back to Case 1'}) →
              </button>
            ` : ''}
          </div>
        </div>

        <!-- AAR Post-Mortem -->
        ${this._lastCaseResult ? `
          <div class="card ${this._lastCaseResult.isFullyCorrect ? 'card-emerald' : 'card-granite-inset'}" style="margin-top: 16px; padding: 16px 20px; border-left: 4px solid ${this._lastCaseResult.isFullyCorrect ? 'var(--emerald-mid)' : 'var(--crimson-mid)'};">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span class="view-tag" style="color: ${this._lastCaseResult.isFullyCorrect ? 'var(--emerald-light)' : 'var(--crimson-light)'};">
                AFTER ACTION REPORT // ${this._lastCaseResult.isFullyCorrect ? 'VERIFIED' : 'ANALYSIS AUDIT'}
              </span>
              <button class="btn btn-sm btn-outline" id="btn-pin-case-dossier">📌 Pin Ruling to Dossier</button>
            </div>
            <p class="body-text" style="font-size: 0.95rem; line-height: 1.5; color: var(--parchment-bright); margin: 0;">
              ${esc(this._lastCaseResult.feedback)}
            </p>
          </div>
        ` : ''}
      </div>
    `;

    container.innerHTML = html;

    // Attach click listeners to options
    container.querySelectorAll('.case-deduction-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        if (this._caseSubmitted) return;
        this._selectedDeduction = parseInt(e.currentTarget.getAttribute('data-idx'), 10);
        this._renderCasesView();
      });
    });

    container.querySelectorAll('.case-limitation-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        if (this._caseSubmitted) return;
        this._selectedLimitation = parseInt(e.currentTarget.getAttribute('data-idx'), 10);
        this._renderCasesView();
      });
    });

    container.querySelectorAll('.case-conf-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        this._selectedConfidence = e.currentTarget.getAttribute('data-conf');
        this._renderCasesView();
      });
    });

    const submitBtn = document.getElementById('btn-submit-case-verdict');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => this._submitCaseVerdict());
    }

    const nextBtn = document.getElementById('btn-next-case');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this._activeCaseIdx = (this._activeCaseIdx + 1) % this._cases.length;
        if (caseSelect) caseSelect.value = this._activeCaseIdx;
        this._selectedDeduction = null;
        this._selectedLimitation = null;
        this._caseSubmitted = false;
        this._lastCaseResult = null;
        this._renderCasesView();
      });
    }

    const pinBtn = document.getElementById('btn-pin-case-dossier');
    if (pinBtn && this._lastCaseResult) {
      pinBtn.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('aegis:pin', {
          detail: {
            source: 'OSINT Desk',
            title: `Case Ruling: ${currentCase.title}`,
            content: `Claim: "${currentCase.claim}"\n\nAAR Ruling: ${this._lastCaseResult.feedback}`
          }
        }));
        this._app?.showToast({
          type: 'success',
          title: 'CASE PINNED',
          message: 'Analytical case ruling archived in Epistemic Dossier.'
        });
      });
    }
  },

  _submitCaseVerdict() {
    if (this._selectedDeduction === null || this._selectedLimitation === null) return;
    const currentCase = this._cases[this._activeCaseIdx];
    if (!currentCase) return;

    this._caseSubmitted = true;
    const result = evaluateCaseAnswer(currentCase, this._selectedDeduction, this._selectedLimitation, this._selectedConfidence);
    this._lastCaseResult = result;

    // Record attempt to the Competency Spine via recordAttempt
    recordAttempt({
      skillIds: currentCase.teaches || ['skill.sift.investigate-source'],
      itemId: currentCase.id,
      correct: result.isFullyCorrect,
      context: CONTEXTS.OSINT || 'osint',
      confidence: this._selectedConfidence,
      chosen: currentCase.deductionQuestion.options[this._selectedDeduction]
    });

    if (result.isFullyCorrect) {
      this._app?.showToast({
        type: 'success',
        title: 'CASE RULING VERIFIED',
        message: `Awarded +${result.score} points against ${currentCase.teaches.length} competency skills.`
      });
    } else {
      this._app?.showToast({
        type: 'warning',
        title: 'ANALYTICAL CORRECTION',
        message: 'Review the After Action Report to study the boundary limitations.'
      });
    }

    this._renderCasesView();
  },

  // =========================================================================
  // 2. SOLAR & CHRONOLOCATION BENCH
  // =========================================================================
  _renderSolarCalculations() {
    const calc = calculateSolarAltitude(this._solarHeight, this._solarShadow);
    const chrono = estimateChronolocation(this._solarLat, calc.altitudeDeg);

    const altEl = document.getElementById('solar-result-altitude');
    const zenEl = document.getElementById('solar-result-zenith');
    const ratioEl = document.getElementById('solar-result-ratio');
    const noonSummerEl = document.getElementById('solar-noon-summer');
    const noonEquinoxEl = document.getElementById('solar-noon-equinox');
    const noonWinterEl = document.getElementById('solar-noon-winter');
    const alertEl = document.getElementById('solar-validity-alert');
    const svg = document.getElementById('solar-svg-diagram');

    if (noonSummerEl) noonSummerEl.textContent = `${chrono.solarNoonSummer}°`;
    if (noonEquinoxEl) noonEquinoxEl.textContent = `${chrono.solarNoonEquinox}°`;
    if (noonWinterEl) noonWinterEl.textContent = `${chrono.solarNoonWinter}°`;

    if (!calc.isValid) {
      if (altEl) altEl.textContent = '—';
      if (zenEl) zenEl.textContent = '—';
      if (ratioEl) ratioEl.textContent = '—';

      if (alertEl) {
        alertEl.classList.remove('hidden');
        alertEl.className = 'badge badge-disinfo';
        alertEl.textContent = `INVALID INPUT: ${calc.error || 'Height must be > 0 and shadow must be >= 0'}`;
      }

      if (svg) {
        svg.innerHTML = `
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.3)"/>
          <text x="200" y="100" fill="var(--crimson-light, #fca5a5)" font-size="12" font-family="var(--font-mono)" text-anchor="middle" font-weight="600">
            ⚠️ INVALID MEASUREMENT GEOMETRY
          </text>
          <text x="200" y="124" fill="var(--parchment-muted)" font-size="10" font-family="var(--font-mono)" text-anchor="middle">
            ${esc(calc.error || 'Object height must be > 0, shadow length >= 0')}
          </text>
        `;
      }
      return;
    }

    if (altEl) altEl.textContent = `${calc.altitudeDeg}°`;
    if (zenEl) zenEl.textContent = `${calc.zenithDeg}°`;
    if (ratioEl) ratioEl.textContent = `${calc.shadowRatio}x`;

    if (alertEl) {
      if (!chrono.isAltitudePossibleAtNoon) {
        alertEl.classList.remove('hidden');
        alertEl.className = 'badge badge-disinfo';
        alertEl.textContent = `ASTRONOMICAL IMPOSSIBILITY: Sun altitude (${calc.altitudeDeg}°) exceeds highest possible summer noon altitude (${chrono.solarNoonSummer}°) at latitude ${this._solarLat}°!`;
      } else {
        alertEl.classList.remove('hidden');
        alertEl.className = 'badge badge-veracity';
        alertEl.textContent = `PHYSICALLY PLAUSIBLE: Altitude (${calc.altitudeDeg}°) is within solar envelope (max noon: ${chrono.solarNoonSummer}°).`;
      }
    }

    if (svg) {
      const groundY = 170;
      const poleX = 80;
      const rad = (calc.altitudeDeg * Math.PI) / 180;
      const isZenith = calc.shadowRatio === 0;

      let poleHeightPx = 100;
      let shadowPx = 0;

      if (!isZenith) {
        const maxShadowPx = 270;
        if (poleHeightPx * calc.shadowRatio <= maxShadowPx) {
          shadowPx = Math.max(6, poleHeightPx * calc.shadowRatio);
        } else {
          shadowPx = maxShadowPx;
          poleHeightPx = Math.max(20, Math.round(shadowPx / calc.shadowRatio));
        }
      }

      const poleTopY = groundY - poleHeightPx;
      const shadowEndX = poleX + shadowPx;

      // Sun icon coordinates along the ray vector
      const sunDistance = 60;
      const sunX = isZenith ? poleX : poleX - Math.cos(rad) * sunDistance;
      const sunY = isZenith ? poleTopY - sunDistance : poleTopY - Math.sin(rad) * sunDistance;

      // Opposite sun azimuth heading
      const oppAzimuth = (Math.round(this._solarAzimuth + 180)) % 360;
      const cardinalDirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
      const cardIdx = Math.round(oppAzimuth / 22.5) % 16;
      const cardStr = cardinalDirs[cardIdx];

      // Arc geometry at shadow tip
      const arcR = 26;
      const arcEndX = Math.round((shadowEndX - arcR * Math.cos(rad)) * 10) / 10;
      const arcEndY = Math.round((groundY - arcR * Math.sin(rad)) * 10) / 10;

      svg.innerHTML = `
        <defs>
          <linearGradient id="solar-ray-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="var(--amber-bright)" stop-opacity="1"/>
            <stop offset="100%" stop-color="var(--amber-mid)" stop-opacity="0.3"/>
          </linearGradient>
        </defs>

        <!-- Ground Line -->
        <line x1="20" y1="${groundY}" x2="380" y2="${groundY}" stroke="var(--border-strong)" stroke-width="2"/>
        <text x="360" y="${groundY + 18}" fill="var(--parchment-muted)" font-size="9" font-family="var(--font-mono)">GROUND</text>

        <!-- Vertical Pole -->
        <line x1="${poleX}" y1="${groundY}" x2="${poleX}" y2="${poleTopY}" stroke="var(--bronze-bright)" stroke-width="4" stroke-linecap="round"/>
        <circle cx="${poleX}" cy="${poleTopY}" r="4" fill="var(--bronze-light)"/>
        <text x="${poleX - 10}" y="${groundY - poleHeightPx / 2}" fill="var(--bronze-bright)" font-size="11" font-family="var(--font-mono)" text-anchor="end">${this._solarHeight}m</text>

        ${isZenith ? `
          <!-- Zenith Indicator -->
          <text x="${poleX}" y="${groundY + 20}" fill="var(--veracity-emerald, #4ade80)" font-size="10" font-family="var(--font-mono)" text-anchor="middle">NO SHADOW (ZENITH 90°)</text>
          <line x1="${sunX}" y1="${sunY}" x2="${poleX}" y2="${groundY}" stroke="url(#solar-ray-grad)" stroke-width="2" stroke-dasharray="4 4"/>
        ` : `
          <!-- Cast Shadow -->
          <line x1="${poleX}" y1="${groundY + 2}" x2="${shadowEndX}" y2="${groundY + 2}" stroke="var(--amber-mid)" stroke-width="6" stroke-linecap="round"/>
          <text x="${(poleX + shadowEndX) / 2}" y="${groundY + 20}" fill="var(--amber-bright)" font-size="11" font-family="var(--font-mono)" text-anchor="middle">SHADOW ${this._solarShadow}m</text>

          <!-- Sun Ray Hypotenuse passing through pole top -->
          <line x1="${sunX}" y1="${sunY}" x2="${shadowEndX}" y2="${groundY}" stroke="url(#solar-ray-grad)" stroke-width="1.5" stroke-dasharray="4 4"/>

          <!-- Angle Arc at Shadow Tip -->
          <path d="M ${shadowEndX - arcR} ${groundY} A ${arcR} ${arcR} 0 0 0 ${arcEndX} ${arcEndY}" fill="none" stroke="var(--veracity-emerald, #4ade80)" stroke-width="1.5"/>
          <text x="${shadowEndX - arcR - 6}" y="${groundY - 12}" fill="var(--veracity-emerald, #4ade80)" font-size="10" font-family="var(--font-mono)">θ = ${calc.altitudeDeg}°</text>
        `}

        <!-- Sun Symbol -->
        <circle cx="${sunX}" cy="${sunY}" r="14" fill="rgba(245,158,11,0.2)" stroke="var(--amber-bright)" stroke-width="2"/>
        <text x="${sunX}" y="${sunY + 4}" fill="var(--amber-bright)" font-size="10" text-anchor="middle">☀️</text>
        <text x="${sunX}" y="${sunY - 18}" fill="var(--amber-light)" font-size="9" font-family="var(--font-mono)" text-anchor="middle">SUN ALT: ${calc.altitudeDeg}°</text>
        <text x="${sunX}" y="${sunY - 6}" fill="var(--bronze-bright)" font-size="8" font-family="var(--font-mono)" text-anchor="middle">AZ: ${oppAzimuth}° (${cardStr})</text>
      `;
    }
  },

  // =========================================================================
  // 3. RAPID PIVOT GAUNTLET (60-SECOND ARCADE)
  // =========================================================================
  _renderDrillLobby() {
    const activeView = document.getElementById('osint-drill-active');
    const lobbyView = document.getElementById('osint-drill-lobby');
    const summaryView = document.getElementById('osint-drill-summary');

    if (activeView) activeView.classList.add('hidden');
    if (summaryView) summaryView.classList.add('hidden');
    if (lobbyView) lobbyView.classList.remove('hidden');

    this._stopDrillTimer();
    this._drillActive = false;
  },

  _startGauntlet() {
    this._drillActive = true;
    this._drillIdx = 0;
    this._drillScore = 0;
    this._drillStreak = 0;
    this._drillMaxStreak = 0;
    this._drillTimeLeft = 60;
    this._drillLocked = false;

    // Reshuffle pool for fresh run
    this._drillPool = buildPivotDrillPool(this._data?.pivot_drills || [], Date.now());

    document.getElementById('osint-drill-lobby')?.classList.add('hidden');
    document.getElementById('osint-drill-summary')?.classList.add('hidden');
    document.getElementById('osint-drill-active')?.classList.remove('hidden');

    this._startDrillTimer();
    this._renderCurrentDrillQuestion();
  },

  _startDrillTimer() {
    this._stopDrillTimer();
    this._lastTickTime = Date.now();
    this._drillTimer = setInterval(() => {
      const now = Date.now();
      const elapsedSec = Math.max(1, Math.round((now - this._lastTickTime) / 1000));
      this._lastTickTime = now;
      this._drillTimeLeft = Math.max(0, this._drillTimeLeft - elapsedSec);

      const timeDisplay = document.getElementById('drill-timer-val');
      const timeBar = document.getElementById('drill-timer-bar');

      if (timeDisplay) timeDisplay.textContent = `${this._drillTimeLeft}s`;
      if (timeBar) {
        const pct = Math.max(0, Math.min(100, (this._drillTimeLeft / 60) * 100));
        timeBar.style.width = `${pct}%`;
      }

      if (this._drillTimeLeft <= 0) {
        this._endGauntlet();
      }
    }, 1000);
  },

  _stopDrillTimer() {
    if (this._drillTimer) {
      clearInterval(this._drillTimer);
      this._drillTimer = null;
    }
    if (this._drillAdvanceTimeout) {
      clearTimeout(this._drillAdvanceTimeout);
      this._drillAdvanceTimeout = null;
    }
  },

  _renderCurrentDrillQuestion() {
    if (!this._drillActive) {
      this._endGauntlet();
      return;
    }

    // Loop with fresh shuffle if time remains
    if (this._drillIdx >= this._drillPool.length) {
      if (this._data?.pivot_drills?.length) {
        this._drillPool = buildPivotDrillPool(this._data.pivot_drills, Date.now());
        this._drillIdx = 0;
      } else {
        this._endGauntlet();
        return;
      }
    }

    const q = this._drillPool[this._drillIdx];
    if (!q) {
      this._endGauntlet();
      return;
    }

    const scoreVal = document.getElementById('drill-score-val');
    const streakVal = document.getElementById('drill-streak-val');
    const qScenario = document.getElementById('drill-q-scenario');
    const qPrompt = document.getElementById('drill-q-prompt');
    const optionsGrid = document.getElementById('drill-options-grid');
    const feedbackEl = document.getElementById('drill-live-feedback');

    if (scoreVal) scoreVal.textContent = this._drillScore;
    if (streakVal) streakVal.textContent = this._drillStreak;
    if (feedbackEl) feedbackEl.classList.add('hidden');
    this._drillLocked = false;

    if (qScenario) qScenario.textContent = q.scenario;
    if (qPrompt) qPrompt.textContent = q.prompt;

    if (optionsGrid) {
      optionsGrid.innerHTML = q.options.map((opt, i) => `
        <button class="btn btn-outline drill-opt-btn" data-opt="${i}" style="text-align: left; justify-content: flex-start; padding: 12px 16px; font-size: 0.9rem; line-height: 1.4;">
          <span style="font-family: var(--font-mono); color: var(--bronze-bright); margin-right: 8px;">[${i + 1}]</span>
          ${esc(opt)}
        </button>
      `).join('');

      optionsGrid.querySelectorAll('.drill-opt-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.currentTarget.getAttribute('data-opt'), 10);
          this._submitDrillAnswer(idx);
        });
      });
    }
  },

  _submitDrillAnswer(chosenIdx) {
    if (this._drillLocked || !this._drillActive) return;
    this._drillLocked = true;

    const q = this._drillPool[this._drillIdx];
    if (!q || chosenIdx < 0 || chosenIdx >= q.options.length) {
      this._drillLocked = false;
      return;
    }

    const isCorrect = chosenIdx === q.correctIndex;
    const feedbackEl = document.getElementById('drill-live-feedback');
    const optionBtns = document.querySelectorAll('.drill-opt-btn');

    optionBtns.forEach((btn, i) => {
      btn.disabled = true;
      if (i === q.correctIndex) {
        btn.style.borderColor = 'var(--veracity-emerald, #4ade80)';
        btn.style.background = 'rgba(74, 222, 128, 0.15)';
      } else if (i === chosenIdx) {
        btn.style.borderColor = 'var(--crimson-mid, #ef4444)';
        btn.style.background = 'rgba(239, 68, 68, 0.15)';
      }
    });

    // Record attempt
    recordAttempt({
      skillIds: q.teaches || ['skill.sift.investigate-source'],
      itemId: q.id,
      correct: isCorrect,
      context: CONTEXTS.OSINT_DRILL || 'osint-drill',
      confidence: 'sure',
      chosen: q.options[chosenIdx]
    });

    if (isCorrect) {
      this._drillStreak++;
      if (this._drillStreak > this._drillMaxStreak) this._drillMaxStreak = this._drillStreak;
      const bonus = this._drillStreak >= 3 ? 30 : 20;
      this._drillScore += bonus;
      this._drillTimeLeft = Math.min(60, this._drillTimeLeft + 2); // +2s time bonus
      this._lastTickTime = Date.now();

      if (feedbackEl) {
        feedbackEl.classList.remove('hidden');
        feedbackEl.style.borderColor = 'var(--veracity-emerald, #4ade80)';
        feedbackEl.style.color = 'var(--parchment-bright)';
        feedbackEl.innerHTML = `<strong>✓ ACCURATE PIVOT (+${bonus} pts, +2s):</strong> ${esc(q.explanation)}`;
      }

      this._drillAdvanceTimeout = setTimeout(() => {
        this._drillAdvanceTimeout = null;
        if (!this._drillActive) return;
        this._drillIdx++;
        this._renderCurrentDrillQuestion();
      }, 1000);
    } else {
      this._drillStreak = 0;
      this._drillTimeLeft = Math.max(0, this._drillTimeLeft - 4); // -4s penalty
      this._lastTickTime = Date.now();

      if (feedbackEl) {
        feedbackEl.classList.remove('hidden');
        feedbackEl.style.borderColor = 'var(--crimson-mid, #ef4444)';
        feedbackEl.style.color = 'var(--parchment-bright)';
        feedbackEl.innerHTML = `<strong>✗ ANALYTICAL NOISE (-4s):</strong> Correct move was: <em>${esc(q.options[q.correctIndex])}</em>.<br>${esc(q.explanation)}`;
      }

      this._drillAdvanceTimeout = setTimeout(() => {
        this._drillAdvanceTimeout = null;
        if (!this._drillActive) return;
        this._drillIdx++;
        this._renderCurrentDrillQuestion();
      }, 1800);
    }
  },

  _endGauntlet() {
    this._stopDrillTimer();
    this._drillActive = false;

    document.getElementById('osint-drill-active')?.classList.add('hidden');
    const summaryView = document.getElementById('osint-drill-summary');
    if (summaryView) {
      summaryView.classList.remove('hidden');
      const finalScoreEl = document.getElementById('drill-final-score');
      const finalStreakEl = document.getElementById('drill-final-streak');
      const finalRankEl = document.getElementById('drill-final-rank');

      if (finalScoreEl) finalScoreEl.textContent = this._drillScore;
      if (finalStreakEl) finalStreakEl.textContent = this._drillMaxStreak;
      if (finalRankEl) {
        if (this._drillScore >= 180) finalRankEl.textContent = 'SENIOR LEAD OSINT INVESTIGATOR';
        else if (this._drillScore >= 120) finalRankEl.textContent = 'FORENSIC RESEARCH ANALYST';
        else if (this._drillScore >= 60) finalRankEl.textContent = 'JUNIOR FIELD VERIFIER';
        else finalRankEl.textContent = 'INTELLIGENCE APPRENTICE';
      }
    }
  },

  // =========================================================================
  // 4. BELLINGCAT TOOLKIT GUIDE
  // =========================================================================
  _renderToolkitView() {
    const container = document.getElementById('toolkit-grid-results');
    if (!container || !this._data?.bellingcat_toolkit) return;

    const filtered = filterToolkit(this._data.bellingcat_toolkit, this._toolkitCategory, this._toolkitQuery);

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--parchment-muted);">
          No tools matching your query. Try searching for "solar", "satellite", "DNS", or "reverse".
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map((tool) => `
      <div class="card card-bronze" style="display: flex; flex-direction: column; justify-content: space-between; padding: 16px;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <h4 style="font-family: var(--font-display); font-size: 1.05rem; color: var(--bronze-bright); margin: 0;">
              ${esc(tool.name)}
            </h4>
            <span class="badge badge-intel" style="font-size: 0.7rem;">${esc(tool.category)}</span>
          </div>
          <p class="body-text" style="font-size: 0.85rem; line-height: 1.45; color: var(--parchment-light); margin-bottom: 10px;">
            ${esc(tool.description)}
          </p>
          <div style="font-size: 0.8rem; color: var(--parchment-muted); margin-bottom: 10px;">
            <strong style="color: var(--parchment-primary);">TRADECRAFT USE:</strong> ${esc(tool.tradecraftUse)}
          </div>
        </div>

        <div>
          <div style="background: rgba(239, 68, 68, 0.08); border-left: 3px solid var(--disinfo-crimson, #ef4444); padding: 8px 10px; margin-bottom: 12px; border-radius: 2px;">
            <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--crimson-light, #fca5a5); font-weight: 600;">
              WHAT THIS TOOL CANNOT ESTABLISH:
            </div>
            <div style="font-size: 0.8rem; color: var(--parchment-primary); line-height: 1.35; margin-top: 2px;">
              ${esc(tool.limitation)}
            </div>
          </div>
          <a href="${esc(tool.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline" style="width: 100%; justify-content: center;">
            Launch External Tool ↗
          </a>
        </div>
      </div>
    `).join('');
  }
};
