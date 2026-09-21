import { TacticalAudio } from './tacticalAudio.js';
/**
 * SOVEREIGN // AEGIS — SIFT Labs: Active Skill-Building Engine
 * Four interactive labs that turn reference material into trained capability.
 *
 * SIFT = Stop · Investigate the Source · Find Better Coverage · Trace Claims
 *
 * Each lab:
 *  1. Presents a real-world scenario
 *  2. Scores the user's decision-making process (not just the answer)
 *  3. Feeds missed concepts directly into the SM-2 memory queue
 *  4. Accumulates competency points in the Operator Profile
 */

import { esc } from '../security.js';
import { recordAttempt, CONTEXTS } from '../attempts.js';
import { Confidence } from '../confidence.js';

/**
 * Pure, deterministic assembly of the 60-Second Triage feed from the Stop lab's scenarios.
 *
 * The triage is deliberately NOT a new dataset: it is the Stop lab's own content model — a mixed
 * feed of manipulative and legitimate claims — compressed into a rapid, replayable arcade. Ground
 * truth stays whatever the Stop lab already declared in `correctDecision`, so a correct "continue"
 * scores exactly as much as a correct "stop" and there is no invented third category to grade against.
 *
 * @param {object[]} scenarios - data/sift_scenarios.json records
 * @param {number|string} [seed]
 * @returns {object[]} stop-lab scenarios, shuffled deterministically
 */
export function buildTriagePool(scenarios, seed = 0x7a11ac) {
  const shuffleWithKey = (arr, key) => {
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
  };

  return shuffleWithKey(
    (scenarios || []).filter((s) => s && s.lab === 'stop'
      && (s.correctDecision === 'stop' || s.correctDecision === 'continue')
      && typeof s.claim === 'string' && s.claim),
    `triage-${seed}`
  );
}

export const SiftLabs = {
  _spawnCombatFloat(host, text, type = 'normal') {
    if (!host) return;
    const tag = document.createElement('div');
    tag.className = `combat-float-tag ${type}`;
    tag.textContent = text;
    host.style.position = 'relative';
    tag.style.top = '30%';
    host.appendChild(tag);
    setTimeout(() => tag.remove(), 1100);
  },
  _app: null,
  _scenarios: [],
  _activeLab: 'stop',     // 'stop' | 'investigate' | 'coverage' | 'trace' | 'triage'
  _activeScenario: null,
  _sessionResults: [],    // array of { scenarioId, correct, timeMs, lab }
  _timerStart: null,
  _timerInterval: null,
  _stopDecisionMade: false,

  // 60-Second Triage (arcade built on the Stop lab's content)
  _triageActive: false,
  _triagePool: [],
  _triageIdx: 0,
  _triageScore: 0,
  _triageStreak: 0,
  _triageMaxStreak: 0,
  _triageTimeLeft: 60,
  _triageTimer: null,
  _triageShownAt: 0,
  _triageLocked: false,

  // ──────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ──────────────────────────────────────────────────────────────
  async init(app) {
    this._app = app;
    await this._loadScenarios();
    console.log('[SiftLabs] Initialized with', this._scenarios.length, 'scenarios.');
  },

  onMount() {
    this._renderLabSelector();
    this._startLab(this._activeLab);
  },

  onUnmount() {
    this._clearTimer();
    this._clearTriageCountdown();
    this._triageActive = false;
    this._activeScenario = null;
  },

  // ──────────────────────────────────────────────────────────────
  // DATA
  // ──────────────────────────────────────────────────────────────
  async _loadScenarios() {
    try {
      const res = await fetch('./data/sift_scenarios.json')
        .catch(() => fetch('data/sift_scenarios.json'));
      this._scenarios = await res.json();
    } catch (e) {
      console.warn('[SiftLabs] Could not load sift_scenarios.json', e);
      this._scenarios = [];
    }
  },

  _getScenariosForLab(lab) {
    return this._scenarios.filter(s => s.lab === lab);
  },

  _pickScenario(lab) {
    const pool = this._getScenariosForLab(lab);
    if (!pool.length) return null;

    // Prioritize scenarios not recently seen
    const seen = this._app.store.get('sift.seen') || {};
    const unseen = pool.filter(s => !seen[s.id]);
    const candidates = unseen.length > 0 ? unseen : pool;

    return candidates[Math.floor(Math.random() * candidates.length)];
  },

  _markSeen(id) {
    const seen = this._app.store.get('sift.seen') || {};
    seen[id] = Date.now();
    // Only keep last 30 seen to allow recycling
    const keys = Object.keys(seen);
    if (keys.length > 30) {
      const oldest = keys.sort((a, b) => seen[a] - seen[b]).slice(0, 10);
      oldest.forEach(k => delete seen[k]);
    }
    this._app.store.set('sift.seen', seen);
  },

  // ──────────────────────────────────────────────────────────────
  // SCORING & SM-2 INTEGRATION
  // ──────────────────────────────────────────────────────────────
  /**
   * @param {object} scenario
   * @param {boolean} wasCorrect
   * @param {number} timeMs
   * @param {{assessed?: boolean}} [opts] - pass `assessed: false` for an interaction that had no
   *   right answer. Session stats still update; the attempt log is NOT written.
   */
  _scoreResult(scenario, wasCorrect, timeMs, opts = {}) {
    const result = {
      scenarioId: scenario.id,
      lab: scenario.lab,
      correct: wasCorrect,
      timeMs,
      timestamp: Date.now()
    };
    this._sessionResults.push(result);

    // All four labs funnel through here, so this is the only place SIFT needs to record.
    // `tests` comes from data/sift_scenarios.json (tagged by lab); timeMs is already the
    // measured decision time, so latency is real rather than reconstructed.
    //
    // `assessed: false` exists because an interaction with no wrong answer must not produce an
    // attempt record. Recording a guaranteed-correct outcome does not merely add weak evidence —
    // it manufactures mastery out of clicking, which is worse than having no measurement, because
    // a fabricated 100% is indistinguishable from a real one.
    if (opts.assessed !== false) {
      // `chosen` is the selected option's display text where there was a discrete choice
      // (coverage ranking, trace verdict, triage stop/continue); graded decisions pass nothing
      // and correctly record null. `itemId` lets a drill variant (e.g. the triage) reuse a
      // scenario's content while keeping its records distinct in the log.
      recordAttempt({
        skillIds: scenario.tests,
        itemId: opts.itemId || scenario.id,
        correct: wasCorrect === true,
        context: CONTEXTS.SIFT,
        latencyMs: timeMs,
        heldOut: scenario.heldOut === true,
        chosen: opts.chosen ?? null
      });
    }

    // Persist lab stats
    const stats = this._app.store.get('sift.stats') || { correct: 0, total: 0, byLab: {} };
    stats.total++;
    if (wasCorrect) stats.correct++;
    stats.byLab[scenario.lab] = stats.byLab[scenario.lab] || { correct: 0, total: 0 };
    stats.byLab[scenario.lab].total++;
    if (wasCorrect) stats.byLab[scenario.lab].correct++;
    this._app.store.set('sift.stats', stats);

    // Accumulate competency points
    const pts = wasCorrect ? 10 : 2;
    const existing = parseInt(this._app.store.get('operator.siftPoints') || '0', 10);
    this._app.store.set('operator.siftPoints', existing + pts);

    // Feed missed concepts into SM-2 queue
    if (!wasCorrect && scenario.sm2Tags && scenario.sm2Tags.length > 0) {
      this._enqueueMemoryCards(scenario);
    }

    return result;
  },

  _enqueueMemoryCards(scenario) {
    // Dispatch event for SpacedRepetition module to pick up
    const today = new Date().toISOString().split('T')[0];
    const latinMaxims = {
      stop: 'Siste et Perpende',
      investigate: 'Investiga Fontem',
      coverage: 'Meliorem Reperire',
      trace: 'Vestigia Sequere'
    };

    const labNames = {
      stop: 'Stop & Pause',
      investigate: 'Investigate Source',
      coverage: 'Find Better Coverage',
      trace: 'Trace Origin'
    };

    const newCards = (scenario.learningPoints || []).map((lp, i) => ({
      id: `sift-${scenario.id}-lp${i}`,
      domain: 'SIFT Verification',
      prompt: `"${scenario.claim}"\n\n[SIFT ${scenario.lab.toUpperCase()} LAB — ${labNames[scenario.lab] || 'Heuristic'}]: What critical verification rule or diagnostic failure applies here?`,
      diagnosis: `SIFT ${scenario.lab.toUpperCase()}: ${lp.split(':')[0] || lp.split('—')[0] || 'Verification Principle'}`,
      latin: latinMaxims[scenario.lab] || 'Heuristica SIFT',
      mechanism: scenario.explanation,
      countermeasure: lp,
      tests: Array.isArray(scenario.tests) && scenario.tests.length > 0 ? scenario.tests : [`skill.sift.${scenario.lab}`],
      heldOut: scenario.heldOut === true,
      repetitions: 0,
      interval: 0,
      easeFactor: 2.5,
      dueDate: today,
      lastReviewed: null,
      history: [],
      source: 'sift-labs'
    }));

    window.dispatchEvent(new CustomEvent('aegis:sift-cards', { detail: { cards: newCards } }));
  },

  // ──────────────────────────────────────────────────────────────
  // TIMER
  // ──────────────────────────────────────────────────────────────
  _startTimer() {
    this._timerStart = Date.now();
    this._timerInterval = setInterval(() => {
      const el = document.getElementById('sift-timer-display');
      if (el) {
        const elapsed = Math.floor((Date.now() - this._timerStart) / 1000);
        el.textContent = `${elapsed}s`;
      }
    }, 1000);
  },

  _clearTimer() {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
  },

  _getElapsedMs() {
    return this._timerStart ? Date.now() - this._timerStart : 0;
  },

  // ──────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ──────────────────────────────────────────────────────────────
  _getContainer() {
    return document.getElementById('subtab-sift-labs');
  },

  _renderLabSelector() {
    const container = this._getContainer();
    if (!container) return;

    const stats = this._app.store.get('sift.stats') || { correct: 0, total: 0, byLab: {} };

    const labs = [
      {
        id: 'stop',
        icon: '🛑',
        title: 'Stop',
        subtitle: 'Recognize manipulation signals before engaging',
        color: 'var(--disinfo-crimson)',
        borderColor: 'var(--suspicion-border)',
        description: 'A viral claim arrives. Should you engage, share, or stop and verify? Develop instant recognition of the manipulation signals that demand a pause.'
      },
      {
        id: 'investigate',
        icon: '🔎',
        title: 'Investigate the Source',
        subtitle: 'Lateral reading & authority verification',
        color: 'var(--bronze-bright)',
        borderColor: 'var(--bronze-dark)',
        description: 'Who is making the claim? Practice lateral reading — searching the source independently rather than reading through the source\'s own framing.'
      },
      {
        id: 'coverage',
        icon: '📰',
        title: 'Find Better Coverage',
        subtitle: 'Trace claims to primary sources',
        color: 'var(--intel-cyan, #38bdf8)',
        borderColor: 'rgba(56, 189, 248, 0.3)',
        description: 'Given multiple versions of a story, identify the most reliable coverage. Practice tracing secondary reports to primary sources and spotting sensationalization.'
      },
      {
        id: 'trace',
        icon: '🧭',
        title: 'Trace Claims, Quotes & Media',
        subtitle: 'Origin verification & recycled content detection',
        color: 'var(--emerald-bright, #4ade80)',
        borderColor: 'var(--emerald-border, #2d5a3c)',
        description: 'Where did this image, quote, or statistic actually come from? Practice reverse image search, metadata analysis, and archive verification workflows.'
      },
      {
        id: 'triage',
        icon: '⏱️',
        title: '60-Second Triage',
        subtitle: 'Rapid stop-or-continue under the clock',
        color: 'var(--suspicion-amber, #f59e0b)',
        borderColor: 'var(--suspicion-border)',
        description: 'A fast feed of mixed claims. One move each: stop and verify, or continue. Correct stops and correct continues score equally — no cynicism bonus.'
      }
    ];

    // Build the lab selection UI
    container.innerHTML = `
      <div style="margin-bottom: var(--space-5);">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; margin-bottom: 24px;">
          <div>
            <span class="view-tag text-bronze">ACTIVE SKILL DEVELOPMENT</span>
            <h2 class="heading-2" style="margin: 4px 0 6px 0;">SIFT Labs</h2>
            <p class="body-text" style="max-width: 640px; margin: 0; color: var(--stone-light); font-size: 0.9rem;">
              Evidence-based verification drills drawn from Mike Caulfield's SIFT method — the methodology taught to intelligence analysts, journalists, and fact-checkers worldwide — plus a 60-second triage arcade. Each drill scores your decisions, not just your answers.
            </p>
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
            <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--stone-warm); text-align: right;">
              SESSION: <span style="color: var(--parchment-bright);">${esc(stats.correct)}/${esc(stats.total)} correct</span>
            </div>
            <div style="display: flex; gap: 6px;">
              ${labs.map(lab => {
                // The triage arcade reuses the Stop lab's content, so its accuracy IS the Stop
                // lab's accuracy — a permanent "--" here would mislabel a drill that is stop-skill
                // practice as unmeasured.
                const statKey = lab.id === 'triage' ? 'stop' : lab.id;
                const labStats = stats.byLab[statKey] || { correct: 0, total: 0 };
                const pct = labStats.total > 0 ? Math.round((labStats.correct / labStats.total) * 100) : '--';
                return `<div title="${lab.title}: ${pct}% accuracy" style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); border-radius: 4px; padding: 4px 8px; font-family: var(--font-mono); font-size: 0.68rem; color: var(--stone-light);">${lab.icon} ${pct}${pct !== '--' ? '%' : ''}</div>`;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Lab Selector Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 28px;" id="sift-lab-selector-grid">
          ${labs.map(lab => `
            <button class="sift-lab-card ${this._activeLab === lab.id ? 'active' : ''}"
              data-lab="${lab.id}"
              style="text-align: left; background: var(--bg-surface-card); border: 1.5px solid ${this._activeLab === lab.id ? lab.color : 'var(--border-subtle)'}; border-radius: var(--radius-md); padding: 18px; cursor: pointer; transition: all 0.2s ease; display: flex; flex-direction: column; gap: 8px; position: relative; overflow: hidden;">
              <div style="position: absolute; top: 0; left: 0; width: 3px; height: 100%; background: ${lab.color}; opacity: ${this._activeLab === lab.id ? 1 : 0.3};"></div>
              <div style="font-size: 1.5rem; margin-bottom: 2px;">${lab.icon}</div>
              <div style="font-family: var(--font-display); font-size: 0.95rem; font-weight: 700; color: var(--parchment-bright); letter-spacing: 0.03em;">S·I·F·T — ${lab.title}</div>
              <div style="font-size: 0.78rem; color: ${lab.color}; font-weight: 600;">${lab.subtitle}</div>
              <p style="font-size: 0.8rem; color: var(--stone-light); line-height: 1.45; margin: 0;">${lab.description}</p>
            </button>
          `).join('')}
        </div>

        <!-- Active Lab Viewport -->
        <div id="sift-active-lab-viewport"></div>
      </div>
    `;

    // Bind lab switcher
    container.querySelectorAll('[data-lab]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._clearTimer();
        this._activeLab = btn.getAttribute('data-lab');
        this._activeScenario = null;
        this._stopDecisionMade = false;
        this._renderLabSelector();
        this._startLab(this._activeLab);
      });
    });
  },

  _startLab(lab) {
    this._activeLab = lab;
    if (lab === 'triage') {
      this._startTriage();
      return;
    }
    // Leaving (or not entering) the triage: kill its countdown so a detached interval cannot
    // keep ticking over a lab the operator is no longer in.
    this._clearTriageCountdown();
    this._triageActive = false;
    const scenario = this._pickScenario(lab);
    if (!scenario) {
      this._renderNoScenarios(lab);
      return;
    }
    this._activeScenario = scenario;
    this._markSeen(scenario.id);
    this._stopDecisionMade = false;

    switch (lab) {
      case 'stop': this._renderStopLab(scenario); break;
      case 'investigate': this._renderInvestigateLab(scenario); break;
      case 'coverage': this._renderCoverageLab(scenario); break;
      case 'trace': this._renderTraceLab(scenario); break;
    }

    // All four labs render a #sift-confidence-host, so one mount here covers them rather than four
    // near-identical calls that could fall out of step.
    Confidence.mount(document.getElementById('sift-confidence-host'));

    this._startTimer();
  },

  _renderNoScenarios(lab) {
    const vp = document.getElementById('sift-active-lab-viewport');
    if (vp) {
      vp.innerHTML = `<div class="card" style="padding: 32px; text-align: center; color: var(--stone-light);">No scenarios loaded for the <strong>${esc(lab)}</strong> lab. Check that sift_scenarios.json is present in the data directory.</div>`;
    }
  },

  // ──────────────────────────────────────────────────────────────
  // LAB 1: STOP
  // ──────────────────────────────────────────────────────────────
  _renderStopLab(scenario) {
    const vp = document.getElementById('sift-active-lab-viewport');
    if (!vp) return;

    const difficultyColor = {
      beginner: 'var(--veracity-green)',
      intermediate: 'var(--suspicion-amber)',
      advanced: 'var(--disinfo-crimson)'
    }[scenario.difficulty] || 'var(--stone-light)';

    vp.innerHTML = `
      <div class="card card-bronze" style="padding: 24px;">
        <!-- Lab Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span style="font-size: 1.4rem;">🛑</span>
              <span class="status-label text-crimson">STOP LAB — RECOGNITION DRILL</span>
            </div>
            <p class="body-text" style="color: var(--stone-light); margin: 0; font-size: 0.85rem; max-width: 560px;">
              A claim has appeared in your feed. Scan it for manipulation signals. Should you stop and verify, or is it safe to engage?
            </p>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="badge" style="color: ${esc(difficultyColor)}; border-color: ${esc(difficultyColor)}; background: transparent;">${esc(scenario.difficulty.toUpperCase())}</span>
            <span class="badge badge-neutral">${esc(scenario.domain.toUpperCase())}</span>
            <div id="sift-timer-display" style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--stone-warm);">0s</div>
          </div>
        </div>

        <!-- The Claim -->
        <div style="background: var(--bg-surface-inset); border: 1px solid var(--border-default); border-radius: var(--radius-sm); padding: 20px; margin-bottom: 20px; position: relative;">
          <div style="position: absolute; top: 10px; right: 10px; font-family: var(--font-mono); font-size: 0.65rem; color: var(--stone-warm); padding: 2px 6px; background: rgba(0,0,0,0.3); border-radius: 4px;">CLAIM / INCOMING CONTENT</div>
          <p id="sift-claim-text" style="font-family: var(--font-serif); font-size: 1.1rem; color: var(--parchment-bright); line-height: 1.6; margin: 0; font-style: italic; padding-right: 80px;">
            "${esc(scenario.claim)}"
          </p>
        </div>

        <div id="sift-confidence-host" style="margin-bottom: 14px;"></div>

        <!-- Decision Buttons -->
        <div id="sift-stop-decision-area" style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
          <button id="btn-sift-stop" class="btn btn-primary" style="flex: 1; min-width: 200px; background: rgba(239, 68, 68, 0.15); border-color: var(--disinfo-crimson); color: var(--disinfo-crimson); font-weight: 700; font-size: 0.95rem; padding: 14px;">
            🛑 STOP — This needs verification before I engage
          </button>
          <button id="btn-sift-continue" class="btn btn-outline" style="flex: 1; min-width: 200px; color: var(--stone-light); font-size: 0.95rem; padding: 14px;">
            ▶ CONTINUE — Seems fine to engage / share
          </button>
        </div>

        <!-- Feedback Panel (Hidden until decision) -->
        <div id="sift-feedback-panel" class="hidden" style="margin-top: 16px; border-top: 1px solid var(--border-subtle); padding-top: 20px;">
        </div>

        <!-- Navigation -->
        <div id="sift-nav-actions" class="hidden" style="display: flex; gap: 12px; margin-top: 20px; border-top: 1px solid var(--border-subtle); padding-top: 16px;">
          <button id="btn-sift-next" class="btn btn-secondary" style="flex: 1;">Next Scenario →</button>
          <button class="btn btn-outline sift-switch-lab" data-lab="investigate" style="font-size: 0.85rem;">Try Investigate Lab →</button>
        </div>
      </div>
    `;

    this._bindStopEvents(scenario);
  },

  _bindStopEvents(scenario) {
    const btnStop = document.getElementById('btn-sift-stop');
    const btnContinue = document.getElementById('btn-sift-continue');

    const handleDecision = (userChose) => {
      if (this._stopDecisionMade) return;
      this._stopDecisionMade = true;

      this._clearTimer();
      const timeMs = this._getElapsedMs();
      const wasCorrect = (userChose === scenario.correctDecision);
      this._scoreResult(scenario, wasCorrect, timeMs);

      if (btnStop) btnStop.disabled = true;
      if (btnContinue) btnContinue.disabled = true;

      this._renderStopFeedback(scenario, userChose, wasCorrect, timeMs);

      const nav = document.getElementById('sift-nav-actions');
      if (nav) {
        nav.classList.remove('hidden');
        nav.style.display = 'flex';
      }

      document.getElementById('btn-sift-next')?.addEventListener('click', () => {
        this._startLab('stop');
      });

      document.querySelectorAll('.sift-switch-lab').forEach(el => {
        el.addEventListener('click', () => {
          this._activeLab = el.getAttribute('data-lab');
          this._renderLabSelector();
          this._startLab(this._activeLab);
        });
      });
    };

    btnStop?.addEventListener('click', () => handleDecision('stop'));
    btnContinue?.addEventListener('click', () => handleDecision('continue'));
  },

  _renderStopFeedback(scenario, userDecision, wasCorrect, timeMs) {
    const panel = document.getElementById('sift-feedback-panel');
    if (!panel) return;

    const signalBadges = (scenario.manipulationSignals || []).map(s =>
      `<span class="badge badge-suspicion" style="font-size: 0.7rem;">${esc(s.replace(/_/g, ' '))}</span>`
    ).join('');

    panel.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
        <div style="font-size: 2rem;">${esc(wasCorrect ? '✅' : '❌')}</div>
        <div>
          <div style="font-family: var(--font-display); font-size: 1.1rem; color: ${esc(wasCorrect ? 'var(--veracity-green)' : 'var(--disinfo-crimson)')}; font-weight: 700;">
            ${esc(wasCorrect ? 'Correct Decision' : 'Incorrect Decision')} · ${(timeMs / 1000).toFixed(1)}s
          </div>
          <div style="font-size: 0.8rem; color: var(--stone-warm); margin-top: 2px;">
            ${wasCorrect ? `+10 competency points` : `+2 points · Learning cards queued for review`}
          </div>
        </div>
      </div>

      <div style="background: var(--bg-surface-inset); border-left: 3px solid ${esc(wasCorrect ? 'var(--veracity-green)' : 'var(--disinfo-crimson)')}; padding: 16px; border-radius: var(--radius-sm); margin-bottom: 16px;">
        <div class="status-label text-bronze" style="margin-bottom: 8px;">EXPLANATION</div>
        <p class="body-text" style="line-height: 1.6; margin: 0;">${esc(scenario.explanation)}</p>
      </div>

      <div style="margin-bottom: 16px;">
        <div class="status-label text-amber" style="margin-bottom: 8px;">DETECTED MANIPULATION SIGNALS</div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">${signalBadges}</div>
      </div>

      <div>
        <div class="status-label text-emerald" style="margin-bottom: 8px;">LEARNING POINTS</div>
        <ul style="margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px;">
          ${(scenario.learningPoints || []).map(lp => `<li style="font-size: 0.88rem; color: var(--parchment-primary); line-height: 1.5;">${lp}</li>`).join('')}
        </ul>
      </div>
    `;

    panel.classList.remove('hidden');
  },

  // ──────────────────────────────────────────────────────────────
  // LAB 2: INVESTIGATE THE SOURCE
  // ──────────────────────────────────────────────────────────────
  _renderInvestigateLab(scenario) {
    const vp = document.getElementById('sift-active-lab-viewport');
    if (!vp) return;

    const src = scenario.sourceToEvaluate;

    vp.innerHTML = `
      <div class="card card-bronze" style="padding: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span style="font-size: 1.4rem;">🔎</span>
              <span class="status-label text-bronze">INVESTIGATE LAB — LATERAL READING DRILL</span>
            </div>
            <p class="body-text" style="color: var(--stone-light); margin: 0; font-size: 0.85rem; max-width: 560px;">
              A claim is attributed to a specific expert or source. Practice lateral reading — evaluate the source independently before reading through it.
            </p>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="badge badge-neutral">${esc(scenario.domain.toUpperCase())}</span>
            <div id="sift-timer-display" style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--stone-warm);">0s</div>
          </div>
        </div>

        <!-- The Claim -->
        <div style="background: var(--bg-surface-inset); border: 1px solid var(--border-default); border-radius: var(--radius-sm); padding: 16px; margin-bottom: 20px;">
          <div class="status-label text-muted" style="font-size: 0.7rem; margin-bottom: 6px;">THE CLAIM</div>
          <p style="font-family: var(--font-serif); font-size: 1rem; color: var(--parchment-bright); line-height: 1.5; margin: 0; font-style: italic;">"${esc(scenario.claim)}"</p>
        </div>

        <!-- Source Card -->
        <div style="background: var(--bg-surface-card); border: 1px solid var(--border-default); border-radius: var(--radius-sm); padding: 18px; margin-bottom: 20px;">
          <div class="status-label text-bronze" style="margin-bottom: 10px;">ATTRIBUTED SOURCE — EVALUATE BEFORE TRUSTING</div>
          <div style="display: grid; grid-template-columns: auto 1fr; gap: 6px 16px;">
            <span style="font-size: 0.75rem; color: var(--stone-warm);">Name:</span>
            <span style="font-size: 0.9rem; color: var(--parchment-bright); font-weight: 600;">${esc(src.name)}</span>
            <span style="font-size: 0.75rem; color: var(--stone-warm);">Affiliation:</span>
            <span style="font-size: 0.9rem; color: var(--parchment-primary);">${esc(src.affiliation)}</span>
          </div>
        </div>

        <!-- Lateral Reading Simulation -->
        <div style="margin-bottom: 20px;">
          <div class="status-label text-intel" style="margin-bottom: 10px;">YOUR LATERAL READING RESULTS</div>
          <div class="card-granite-inset" style="padding: 14px; cursor: pointer; border: 1px dashed var(--border-default);" id="btn-reveal-lateral">
            <div style="text-align: center; color: var(--stone-warm); font-size: 0.88rem;">
              🔍 Click to perform lateral reading — search the source name in a new context outside this article
            </div>
          </div>
          <div id="lateral-reading-result" class="hidden" style="margin-top: 12px; background: var(--bg-surface-inset); border-left: 3px solid var(--bronze-primary); padding: 14px; border-radius: var(--radius-sm);">
            <div class="status-label text-bronze" style="margin-bottom: 8px;">LATERAL READING FINDINGS</div>
            <p style="font-size: 0.88rem; color: var(--parchment-primary); line-height: 1.5; margin: 0;">${esc(src.lateralReadingFindings)}</p>
          </div>
        </div>

        <!-- Verdict Selection -->
        <div id="sift-investigate-verdict-area" style="margin-bottom: 16px;">
          <div class="status-label text-emerald" style="margin-bottom: 10px;">YOUR VERDICT ON THIS SOURCE</div>
          <div id="sift-confidence-host" style="margin-bottom: 12px;"></div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px;">
            ${['reliable', 'unreliable', 'domain_spoof', 'fabricated_attribution', 'half_truth', 'fabricated_expert'].map(verdict => `
              <button class="btn btn-outline sift-verdict-btn" data-verdict="${verdict}" style="font-size: 0.8rem; padding: 10px; text-align: left; white-space: nowrap;">
                ${this._verdictLabel(verdict)}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Feedback Panel -->
        <div id="sift-feedback-panel" class="hidden" style="margin-top: 16px; border-top: 1px solid var(--border-subtle); padding-top: 20px;"></div>

        <!-- Navigation -->
        <div id="sift-nav-actions" class="hidden" style="display: flex; gap: 12px; margin-top: 20px; border-top: 1px solid var(--border-subtle); padding-top: 16px;">
          <button id="btn-sift-next" class="btn btn-secondary" style="flex: 1;">Next Scenario →</button>
          <button class="btn btn-outline sift-switch-lab" data-lab="coverage" style="font-size: 0.85rem;">Try Coverage Lab →</button>
        </div>
      </div>
    `;

    // Reveal lateral reading
    document.getElementById('btn-reveal-lateral')?.addEventListener('click', () => {
      const result = document.getElementById('lateral-reading-result');
      if (result) {
        result.classList.remove('hidden');
        document.getElementById('btn-reveal-lateral').style.display = 'none';
      }
    });

    // Verdict buttons
    document.querySelectorAll('.sift-verdict-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const verdict = btn.getAttribute('data-verdict');
        this._clearTimer();
        const timeMs = this._getElapsedMs();
        const wasCorrect = (verdict === scenario.correctAnswer);
        this._scoreResult(scenario, wasCorrect, timeMs, { chosen: this._verdictLabel(verdict) });

        document.querySelectorAll('.sift-verdict-btn').forEach(b => b.disabled = true);
        btn.style.borderColor = wasCorrect ? 'var(--veracity-green)' : 'var(--disinfo-crimson)';
        btn.style.color = wasCorrect ? 'var(--veracity-green)' : 'var(--disinfo-crimson)';

        // Show correct if wrong
        if (!wasCorrect) {
          document.querySelectorAll('.sift-verdict-btn').forEach(b => {
            if (b.getAttribute('data-verdict') === scenario.correctAnswer) {
              b.style.borderColor = 'var(--veracity-green)';
              b.style.color = 'var(--veracity-green)';
            }
          });
        }

        this._renderInvestigateFeedback(scenario, wasCorrect, timeMs);
        const nav = document.getElementById('sift-nav-actions');
        if (nav) { nav.classList.remove('hidden'); nav.style.display = 'flex'; }

        document.getElementById('btn-sift-next')?.addEventListener('click', () => this._startLab('investigate'));
        document.querySelectorAll('.sift-switch-lab').forEach(el => {
          el.addEventListener('click', () => {
            this._activeLab = el.getAttribute('data-lab');
            this._renderLabSelector();
            this._startLab(this._activeLab);
          });
        });
      });
    });
  },

  _verdictLabel(verdict) {
    return {
      reliable: '✅ Reliable Source',
      unreliable: '⚠️ Unreliable / Biased',
      domain_spoof: '🌐 Domain Spoofing',
      fabricated_attribution: '🔴 Fabricated Attribution',
      half_truth: '🟡 Half-Truth Foundation',
      fabricated_expert: '👤 Fabricated Expert',
    }[verdict] || verdict;
  },

  _renderInvestigateFeedback(scenario, wasCorrect, timeMs) {
    const panel = document.getElementById('sift-feedback-panel');
    if (!panel) return;
    const src = scenario.sourceToEvaluate;

    panel.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
        <div style="font-size: 2rem;">${esc(wasCorrect ? '✅' : '❌')}</div>
        <div>
          <div style="font-family: var(--font-display); font-size: 1.1rem; color: ${esc(wasCorrect ? 'var(--veracity-green)' : 'var(--disinfo-crimson)')}; font-weight: 700;">
            ${esc(wasCorrect ? 'Correct Verdict' : 'Incorrect Verdict')} — ${esc(this._verdictLabel(scenario.correctAnswer))}
          </div>
          <div style="font-size: 0.8rem; color: var(--stone-warm); margin-top: 2px;">
            Source Trust Score: <span style="font-family: var(--font-mono); color: ${esc(src.trustScore < 30 ? 'var(--disinfo-crimson)' : src.trustScore < 60 ? 'var(--suspicion-amber)' : 'var(--veracity-green)')};">${esc(src.trustScore)}/100</span>
          </div>
        </div>
      </div>
      <div style="background: var(--bg-surface-inset); border-left: 3px solid ${esc(wasCorrect ? 'var(--veracity-green)' : 'var(--disinfo-crimson)')}; padding: 16px; border-radius: var(--radius-sm); margin-bottom: 16px;">
        <div class="status-label text-bronze" style="margin-bottom: 8px;">ANALYSIS</div>
        <p class="body-text" style="line-height: 1.6; margin: 0;">${esc(scenario.explanation)}</p>
      </div>
      <div>
        <div class="status-label text-emerald" style="margin-bottom: 8px;">LATERAL READING SKILLS</div>
        <ul style="margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px;">
          ${(scenario.learningPoints || []).map(lp => `<li style="font-size: 0.88rem; color: var(--parchment-primary); line-height: 1.5;">${lp}</li>`).join('')}
        </ul>
      </div>
    `;
    panel.classList.remove('hidden');
  },

  // ──────────────────────────────────────────────────────────────
  // LAB 3: FIND BETTER COVERAGE
  // ──────────────────────────────────────────────────────────────
  _renderCoverageLab(scenario) {
    const vp = document.getElementById('sift-active-lab-viewport');
    if (!vp) return;

    vp.innerHTML = `
      <div class="card card-bronze" style="padding: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span style="font-size: 1.4rem;">📰</span>
              <span class="status-label" style="color: var(--intel-cyan, #38bdf8);">COVERAGE LAB — SOURCE RANKING DRILL</span>
            </div>
            <p class="body-text" style="color: var(--stone-light); margin: 0; font-size: 0.85rem; max-width: 560px;">
              Three sources report on the same story. Identify the most reliable version — the one closest to primary evidence.
            </p>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="badge badge-neutral">${esc(scenario.domain.toUpperCase())}</span>
            <div id="sift-timer-display" style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--stone-warm);">0s</div>
          </div>
        </div>

        <!-- The Claim -->
        <div style="background: var(--bg-surface-inset); border: 1px solid var(--border-default); border-radius: var(--radius-sm); padding: 16px; margin-bottom: 20px;">
          <div class="status-label text-muted" style="font-size: 0.7rem; margin-bottom: 6px;">CLAIM CIRCULATING IN THE WILD</div>
          <p style="font-family: var(--font-serif); font-size: 1rem; color: var(--parchment-bright); line-height: 1.5; margin: 0; font-style: italic;">"${esc(scenario.claim)}"</p>
        </div>

        <!-- Coverage Options -->
        <div class="status-label" style="color: var(--intel-cyan, #38bdf8); margin-bottom: 10px;">SELECT THE MOST RELIABLE COVERAGE</div>
        <div id="sift-confidence-host" style="margin-bottom: 12px;"></div>
        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px;">
          ${(scenario.coverageOptions || []).map((opt, idx) => `
            <button class="sift-coverage-btn" data-opt-id="${opt.id}" data-correct="${opt.id === scenario.correctAnswer}"
              style="text-align: left; background: var(--bg-surface-card); border: 1.5px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 16px; cursor: pointer; transition: all 0.2s ease;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 200px;">
                  <div style="font-weight: 600; color: var(--parchment-bright); margin-bottom: 4px; font-size: 0.9rem;">${opt.source}</div>
                  <div style="font-style: italic; color: var(--parchment-primary); font-size: 0.85rem; line-height: 1.4;">"${opt.headline}"</div>
                </div>
                <div style="font-size: 1.5rem; opacity: 0.5;">${['📰', '📡', '🔬'][idx] || '📄'}</div>
              </div>
            </button>
          `).join('')}
        </div>

        <!-- Feedback Panel -->
        <div id="sift-feedback-panel" class="hidden" style="margin-top: 16px; border-top: 1px solid var(--border-subtle); padding-top: 20px;"></div>

        <!-- Navigation -->
        <div id="sift-nav-actions" class="hidden" style="display: flex; gap: 12px; margin-top: 20px; border-top: 1px solid var(--border-subtle); padding-top: 16px;">
          <button id="btn-sift-next" class="btn btn-secondary" style="flex: 1;">Next Scenario →</button>
          <button class="btn btn-outline sift-switch-lab" data-lab="trace" style="font-size: 0.85rem;">Try Trace Lab →</button>
        </div>
      </div>
    `;

    document.querySelectorAll('.sift-coverage-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._clearTimer();
        const timeMs = this._getElapsedMs();
        const optId = btn.getAttribute('data-opt-id');
        const isCorrect = btn.getAttribute('data-correct') === 'true';
        const chosen = (scenario.coverageOptions || []).find(o => o.id === optId);
        this._scoreResult(scenario, isCorrect, timeMs, { chosen: chosen?.source || null });

        document.querySelectorAll('.sift-coverage-btn').forEach(b => b.disabled = true);

        // Color all options
        document.querySelectorAll('.sift-coverage-btn').forEach(b => {
          const isThis = b.getAttribute('data-opt-id') === optId;
          const isAnswer = b.getAttribute('data-correct') === 'true';
          if (isAnswer) { b.style.borderColor = 'var(--veracity-green)'; b.style.background = 'rgba(74,222,128,0.07)'; }
          else if (isThis && !isAnswer) { b.style.borderColor = 'var(--disinfo-crimson)'; b.style.background = 'rgba(239,68,68,0.07)'; }
        });

        this._renderCoverageFeedback(scenario, optId, isCorrect, timeMs);
        const nav = document.getElementById('sift-nav-actions');
        if (nav) { nav.classList.remove('hidden'); nav.style.display = 'flex'; }
        document.getElementById('btn-sift-next')?.addEventListener('click', () => this._startLab('coverage'));
        document.querySelectorAll('.sift-switch-lab').forEach(el => {
          el.addEventListener('click', () => {
            this._activeLab = el.getAttribute('data-lab');
            this._renderLabSelector();
            this._startLab(this._activeLab);
          });
        });
      });
    });
  },

  _renderCoverageFeedback(scenario, chosenId, wasCorrect, timeMs) {
    const panel = document.getElementById('sift-feedback-panel');
    if (!panel) return;
    const correct = (scenario.coverageOptions || []).find(o => o.id === scenario.correctAnswer);
    const chosen = (scenario.coverageOptions || []).find(o => o.id === chosenId);

    panel.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
        <div style="font-size: 2rem;">${esc(wasCorrect ? '✅' : '❌')}</div>
        <div>
          <div style="font-family: var(--font-display); font-size: 1.1rem; color: ${esc(wasCorrect ? 'var(--veracity-green)' : 'var(--disinfo-crimson)')}; font-weight: 700;">
            ${esc(wasCorrect ? 'Best Source Identified' : 'Not the Best Source')}
          </div>
          <div style="font-size: 0.8rem; color: var(--stone-warm); margin-top: 2px;">Best: <strong>${esc(correct?.source)}</strong> — ${esc(correct?.rating)}</div>
        </div>
      </div>

      ${!wasCorrect && chosen ? `
        <div style="background: rgba(239,68,68,0.08); border-left: 3px solid var(--disinfo-crimson); padding: 12px; border-radius: var(--radius-sm); margin-bottom: 12px; font-size: 0.85rem;">
          <div class="status-label text-crimson" style="margin-bottom: 4px;">YOUR CHOICE — ${chosen.source}</div>
          <p style="margin: 0; color: var(--parchment-primary);">${chosen.reason}</p>
        </div>
      ` : ''}

      <div style="background: rgba(74,222,128,0.08); border-left: 3px solid var(--veracity-green); padding: 12px; border-radius: var(--radius-sm); margin-bottom: 16px; font-size: 0.85rem;">
        <div class="status-label text-emerald" style="margin-bottom: 4px;">BEST COVERAGE — ${esc(correct?.source)}</div>
        <p style="margin: 0; color: var(--parchment-primary);">${esc(correct?.reason)}</p>
      </div>

      <div style="background: var(--bg-surface-inset); border-left: 3px solid var(--bronze-primary); padding: 14px; border-radius: var(--radius-sm); margin-bottom: 16px;">
        <div class="status-label text-bronze" style="margin-bottom: 8px;">WHY THIS MATTERS</div>
        <p class="body-text" style="line-height: 1.6; margin: 0;">${esc(scenario.explanation)}</p>
      </div>

      <div>
        <div class="status-label text-emerald" style="margin-bottom: 8px;">LEARNING POINTS</div>
        <ul style="margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px;">
          ${(scenario.learningPoints || []).map(lp => `<li style="font-size: 0.88rem; color: var(--parchment-primary); line-height: 1.5;">${lp}</li>`).join('')}
        </ul>
      </div>
    `;
    panel.classList.remove('hidden');
  },

  // ──────────────────────────────────────────────────────────────
  // LAB 4: TRACE CLAIMS
  // ──────────────────────────────────────────────────────────────
  _renderTraceLab(scenario) {
    const vp = document.getElementById('sift-active-lab-viewport');
    if (!vp) return;

    let revealedSteps = 0;

    vp.innerHTML = `
      <div class="card card-bronze" style="padding: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span style="font-size: 1.4rem;">🧭</span>
              <span class="status-label text-emerald">TRACE LAB — ORIGIN VERIFICATION DRILL</span>
            </div>
            <p class="body-text" style="color: var(--stone-light); margin: 0; font-size: 0.85rem; max-width: 560px;">
              Trace this claim, image, or quote to its origin. Follow the verification chain step by step. What does the evidence actually show?
            </p>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="badge badge-neutral">${esc(scenario.domain.toUpperCase())}</span>
            <div id="sift-timer-display" style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--stone-warm);">0s</div>
          </div>
        </div>

        <!-- The Claim -->
        <div style="background: var(--bg-surface-inset); border: 1px solid var(--border-default); border-radius: var(--radius-sm); padding: 16px; margin-bottom: 20px;">
          <div class="status-label text-muted" style="font-size: 0.7rem; margin-bottom: 6px;">CLAIM / MEDIA TO TRACE</div>
          <p style="font-family: var(--font-serif); font-size: 1rem; color: var(--parchment-bright); line-height: 1.5; margin: 0; font-style: italic;">"${esc(scenario.claim)}"</p>
        </div>

        <!-- Trace Chain Steps -->
        <div class="status-label text-emerald" style="margin-bottom: 12px;">VERIFICATION CHAIN — REVEAL EACH STEP IN SEQUENCE</div>
        <div id="trace-chain-steps" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px;">
          ${(scenario.traceChain || []).map((step, idx) => `
            <div class="trace-step" data-step="${idx}" style="background: var(--bg-surface-card); border: 1.5px solid var(--border-subtle); border-radius: var(--radius-sm); overflow: hidden;">
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-family: var(--font-mono); font-size: 0.7rem; color: var(--stone-warm); background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px;">STEP ${step.step}</span>
                  <span style="font-size: 0.88rem; color: var(--parchment-primary);">${step.action}</span>
                </div>
                <button class="btn btn-sm btn-outline reveal-step-btn" data-step="${idx}" style="font-size: 0.75rem; display: ${idx === 0 ? 'block' : 'none'};">
                  Reveal Finding →
                </button>
              </div>
              <div class="trace-finding hidden" data-step="${idx}" style="padding: 12px 16px; padding-top: 0;">
                <div style="border-top: 1px solid var(--border-subtle); padding-top: 10px; font-size: 0.85rem; color: var(--intel-cyan, #38bdf8); font-family: var(--font-mono);">
                  ▸ ${step.result}
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Verdict Area.
             This used to display the answer and offer an "I understand this verdict" button, which
             recorded a guaranteed-correct attempt — so clicking through scored 100% and
             skill.sift.trace-origin read as mastered without the operator ever making a judgement.
             Now the verdict must be PREDICTED from the chain before it is shown. The distractors are
             the other trace scenarios' real verdicts, so they are plausible category confusions
             (recycled image vs fabricated composite) rather than obvious throwaways. -->
        <div id="trace-verdict-area" class="hidden" style="margin-bottom: 16px;">
          <div class="status-label text-emerald" style="margin-bottom: 10px;">BASED ON THE CHAIN — WHAT IS THE VERDICT?</div>
          <div id="sift-confidence-host" style="margin-bottom: 12px;"></div>
          <div id="trace-verdict-options" style="display: flex; flex-direction: column; gap: 10px;">
            ${this._traceVerdictOptions(scenario).map((opt, i) => `
              <button class="btn btn-outline trace-verdict-btn" data-correct="${esc(opt.correct ? 'true' : 'false')}" data-chosen="${esc(opt.text)}"
                      style="text-align: left; justify-content: flex-start; padding: 12px 16px; font-size: 0.85rem;">
                <span style="font-family: var(--font-mono); color: var(--bronze-primary); margin-right: 10px;">${esc(String.fromCharCode(65 + i))}.</span>
                ${esc(opt.text)}
              </button>
            `).join('')}
          </div>
          <div id="trace-verdict-reveal" class="hidden" style="margin-top: 12px;">
            <div style="background: rgba(74,222,128,0.08); border: 1.5px solid var(--veracity-green); border-radius: var(--radius-sm); padding: 16px;">
              <div style="font-weight: 700; color: var(--veracity-green); margin-bottom: 8px;">VERIFIED VERDICT</div>
              <p style="font-size: 0.9rem; color: var(--parchment-bright); margin: 0; line-height: 1.5;">${esc(scenario.verdict)}</p>
            </div>
          </div>
        </div>

        <!-- Feedback Panel -->
        <div id="sift-feedback-panel" class="hidden" style="margin-top: 16px; border-top: 1px solid var(--border-subtle); padding-top: 20px;"></div>

        <!-- Navigation -->
        <div id="sift-nav-actions" class="hidden" style="display: flex; gap: 12px; margin-top: 20px; border-top: 1px solid var(--border-subtle); padding-top: 16px;">
          <button id="btn-sift-next" class="btn btn-secondary" style="flex: 1;">Next Scenario →</button>
          <button class="btn btn-outline sift-switch-lab" data-lab="stop" style="font-size: 0.85rem;">Back to Stop Lab</button>
        </div>
      </div>
    `;

    // Bind reveal chain logic
    const bindRevealSteps = () => {
      document.querySelectorAll('.reveal-step-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const stepIdx = parseInt(btn.getAttribute('data-step'));
          const finding = document.querySelector(`.trace-finding[data-step="${stepIdx}"]`);
          if (finding) finding.classList.remove('hidden');
          btn.style.display = 'none';
          revealedSteps++;

          // Show next step's reveal button
          const nextBtn = document.querySelector(`.reveal-step-btn[data-step="${stepIdx + 1}"]`);
          if (nextBtn) nextBtn.style.display = 'block';

          // If all steps revealed, show verdict
          if (revealedSteps >= (scenario.traceChain || []).length) {
            const verdictArea = document.getElementById('trace-verdict-area');
            if (verdictArea) verdictArea.classList.remove('hidden');
          }
        });
      });
    };
    bindRevealSteps();

    // Predict the verdict — a real judgement, scored against the chain the operator just read.
    let verdictAnswered = false;
    document.querySelectorAll('.trace-verdict-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (verdictAnswered) return;
        verdictAnswered = true;

        this._clearTimer();
        const timeMs = this._getElapsedMs();
        const wasCorrect = btn.getAttribute('data-correct') === 'true';
        this._scoreResult(scenario, wasCorrect, timeMs, { chosen: btn.getAttribute('data-chosen') || null });

        document.querySelectorAll('.trace-verdict-btn').forEach(b => {
          b.disabled = true;
          const isAnswer = b.getAttribute('data-correct') === 'true';
          if (isAnswer) { b.style.borderColor = 'var(--veracity-green)'; b.style.background = 'rgba(74,222,128,0.07)'; }
          else if (b === btn) { b.style.borderColor = 'var(--disinfo-crimson)'; b.style.background = 'rgba(239,68,68,0.07)'; }
        });
        document.getElementById('trace-verdict-reveal')?.classList.remove('hidden');

        this._renderTraceFeedback(scenario, timeMs, wasCorrect);

        const nav = document.getElementById('sift-nav-actions');
        if (nav) { nav.classList.remove('hidden'); nav.style.display = 'flex'; }
        document.getElementById('btn-sift-next')?.addEventListener('click', () => this._startLab('trace'));
        document.querySelectorAll('.sift-switch-lab').forEach(el => {
          el.addEventListener('click', () => {
            this._activeLab = el.getAttribute('data-lab');
            this._renderLabSelector();
            this._startLab(this._activeLab);
          });
        });
      });
    });
  },

  /**
   * Four verdict options for a trace scenario: the real one plus three drawn from the other trace
   * scenarios, shuffled.
   *
   * Distractors come from real content rather than being invented, which is what makes them
   * plausible — "recycled image, wrong location" against "fabricated composite, two images merged"
   * is a genuine category distinction an operator can get wrong for the right reasons. Invented
   * distractors would be either obviously wrong (measuring nothing) or arbitrary.
   *
   * @private
   * @param {object} scenario
   * @returns {{text: string, correct: boolean}[]}
   */
  _traceVerdictOptions(scenario) {
    const others = (this._scenarios || [])
      .filter(s => s.lab === 'trace' && s.id !== scenario.id && s.verdict)
      .map(s => s.verdict);

    // Deterministic per scenario id, so re-entering the same scenario does not reshuffle the
    // options underneath someone who is mid-thought. Cheap string hash, no RNG.
    let seed = 0;
    for (let i = 0; i < scenario.id.length; i++) seed = (seed * 31 + scenario.id.charCodeAt(i)) & 0x7fffffff;
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const shuffle = (xs) => {
      const a = [...xs];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    const opts = [
      { text: scenario.verdict, correct: true },
      ...shuffle(others).slice(0, 3).map(text => ({ text, correct: false }))
    ];
    return shuffle(opts);
  },

  _renderTraceFeedback(scenario, timeMs, wasCorrect = true) {
    const panel = document.getElementById('sift-feedback-panel');
    if (!panel) return;

    const accent = wasCorrect ? 'var(--veracity-green)' : 'var(--disinfo-crimson)';
    panel.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
        <div style="font-size: 2rem;">${esc(wasCorrect ? '✅' : '❌')}</div>
        <div>
          <div style="font-family: var(--font-display); font-size: 1.1rem; color: ${esc(accent)}; font-weight: 700;">
            ${esc(wasCorrect ? 'Verdict Correctly Identified' : 'Verdict Misidentified')} · ${(timeMs / 1000).toFixed(1)}s
          </div>
          <div style="font-size: 0.8rem; color: var(--stone-warm); margin-top: 2px;">${esc(wasCorrect ? '+10' : '+2')} competency points</div>
        </div>
      </div>
      <div style="background: var(--bg-surface-inset); border-left: 3px solid ${esc(accent)}; padding: 16px; border-radius: var(--radius-sm); margin-bottom: 16px;">
        <div class="status-label text-bronze" style="margin-bottom: 8px;">ANALYTICAL BREAKDOWN</div>
        <p class="body-text" style="line-height: 1.6; margin: 0;">${esc(scenario.explanation)}</p>
      </div>
      <div>
        <div class="status-label text-emerald" style="margin-bottom: 8px;">TRACE METHODOLOGY SKILLS</div>
        <ul style="margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px;">
          ${(scenario.learningPoints || []).map(lp => `<li style="font-size: 0.88rem; color: var(--parchment-primary); line-height: 1.5;">${lp}</li>`).join('')}
        </ul>
      </div>
    `;
    panel.classList.remove('hidden');
  },

  // ──────────────────────────────────────────────────────────────
  // LAB 5: 60-SECOND TRIAGE (arcade built on the Stop lab's content)
  // ──────────────────────────────────────────────────────────────
  _startTriage() {
    this._clearTriageCountdown();
    this._triagePool = buildTriagePool(this._scenarios);
    if (!this._triagePool.length) {
      this._renderNoScenarios('triage');
      return;
    }
    this._triageActive = true;
    this._triageIdx = 0;
    this._triageScore = 0;
    this._triageCritCount = 0;
    this._triageStreak = 0;
    this._triageMaxStreak = 0;
    this._triageTimeLeft = 60;
    this._triageLocked = false;
    this._renderTriageQuestion();
    this._startTriageCountdown();
  },

  _startTriageCountdown() {
    this._clearTriageCountdown();
    this._triageTimer = setInterval(() => {
      this._triageTimeLeft--;
      this._updateTriageHUD();
      const t = document.getElementById('triage-time');
      if (this._triageTimeLeft <= 10 && this._triageTimeLeft > 0) {
        t?.classList.add('timer-danger');
        TacticalAudio.playTimerWarning();
      } else {
        t?.classList.remove('timer-danger');
      }
      if (this._triageTimeLeft <= 0) this._endTriage('TIME EXPIRED');
    }, 1000);
  },

  _clearTriageCountdown() {
    if (this._triageTimer) { clearInterval(this._triageTimer); this._triageTimer = null; }
    document.getElementById('triage-time')?.classList.remove('timer-danger');
  },

  _updateTriageHUD() {
    const t = document.getElementById('triage-time');
    const s = document.getElementById('triage-score');
    const st = document.getElementById('triage-streak');
    if (t) t.textContent = `${Math.max(0, this._triageTimeLeft)}s`;
    if (s) s.textContent = `${this._triageScore}`;
    if (st) st.textContent = `${this._triageStreak}`;
  },

  _renderTriageQuestion() {
    if (!this._triageActive) return;
    const vp = document.getElementById('sift-active-lab-viewport');
    if (!vp) return;
    if (this._triageIdx >= this._triagePool.length) { this._endTriage('FEED CLEARED'); return; }

    const s = this._triagePool[this._triageIdx];
    this._triageShownAt = Date.now();
    this._triageLocked = false;

    vp.innerHTML = `
      <div class="card card-bronze" style="padding: 22px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.3rem;">⏱️</span>
            <span class="status-label" style="color: var(--suspicion-amber, #f59e0b);">60-SECOND TRIAGE — STOP OR CONTINUE</span>
          </div>
          <div style="display:flex;gap:12px;font-family:var(--font-mono);font-size:0.8rem;color:var(--stone-warm);">
            <span>⏱ <span id="triage-time">${esc(this._triageTimeLeft)}s</span></span>
            <span>🎯 <span id="triage-score">${esc(this._triageScore)}</span></span>
            <span>🔥 <span id="triage-streak">${esc(this._triageStreak)}</span></span>
          </div>
        </div>
        <div style="background:var(--bg-surface-inset);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:18px;margin-bottom:14px;">
          <div class="status-label text-muted" style="font-size:0.7rem;margin-bottom:6px;">INCOMING CLAIM — ONE MOVE</div>
          <p style="font-family:var(--font-serif);font-size:1.05rem;color:var(--parchment-bright);line-height:1.55;margin:0;font-style:italic;">"${esc(s.claim)}"</p>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <button id="btn-triage-stop" class="btn btn-primary" style="flex:1;min-width:200px;background:rgba(239,68,68,0.15);border-color:var(--disinfo-crimson);color:var(--disinfo-crimson);font-weight:700;padding:14px;">
            🛑 STOP — needs verification
          </button>
          <button id="btn-triage-continue" class="btn btn-outline" style="flex:1;min-width:200px;color:var(--stone-light);padding:14px;">
            ▶ CONTINUE — safe to engage
          </button>
        </div>
        <div id="triage-feedback" style="margin-top:14px;"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;border-top:1px solid var(--border-subtle);padding-top:12px;">
          <button class="btn btn-outline" id="btn-triage-exit" style="font-size:0.8rem;">✕ Exit Triage</button>
          <span class="body-muted" style="font-size:0.75rem;">${esc(this._triageIdx + 1)} / ${esc(this._triagePool.length)}</span>
        </div>
      </div>`;

    vp.querySelector('#btn-triage-exit')?.addEventListener('click', () => this._exitTriage());
    vp.querySelector('#btn-triage-stop')?.addEventListener('click', () => this._answerTriage('stop'));
    vp.querySelector('#btn-triage-continue')?.addEventListener('click', () => this._answerTriage('continue'));
  },

  _answerTriage(decision) {
    if (this._triageLocked || !this._triageActive) return;
    const s = this._triagePool[this._triageIdx];
    if (!s) return;
    this._triageLocked = true;

    const correct = decision === s.correctDecision;
    const latencyMs = this._triageShownAt ? Math.max(0, Date.now() - this._triageShownAt) : 2500;
    const isCritical = correct && latencyMs > 0 && latencyMs <= 1800;
    const vp = document.getElementById('sift-active-lab-viewport');
    const cardEl = vp?.querySelector('.card-bronze');

    if (correct) {
      this._triageStreak++;
      if (this._triageStreak > this._triageMaxStreak) this._triageMaxStreak = this._triageStreak;
      if (isCritical) {
        this._triageCritCount = (this._triageCritCount || 0) + 1;
        this._triageScore += 2;
        this._triageTimeLeft = Math.min(60, this._triageTimeLeft + 3);
        TacticalAudio.playCriticalHit();
        cardEl?.classList.add('crit-hit-pulse');
        setTimeout(() => cardEl?.classList.remove('crit-hit-pulse'), 450);
        this._spawnCombatFloat(cardEl, `? INSTANT TRIAGE! +2 pts (${(latencyMs/1000).toFixed(1)}s)`, 'crit');
      } else {
        this._triageScore += 1;
        this._triageTimeLeft = Math.min(60, this._triageTimeLeft + 2);
        TacticalAudio.playStreakHit(this._triageStreak);
        this._spawnCombatFloat(cardEl, `? +1 pt${this._triageStreak >= 3 ? ` (${this._triageStreak}x STREAK)` : ''}`, 'normal');
      }
    } else {
      const brokenStreak = this._triageStreak;
      this._triageStreak = 0;
      cardEl?.classList.add('aegis-shake');
      setTimeout(() => cardEl?.classList.remove('aegis-shake'), 380);
      if (brokenStreak >= 2) {
        TacticalAudio.playStreakBust();
        this._spawnCombatFloat(cardEl, `?? STREAK BROKEN (${brokenStreak})`, 'bust');
      } else {
        TacticalAudio.playZizzle();
        this._spawnCombatFloat(cardEl, '? INCORRECT', 'bust');
      }
    }

    // Correct stops and correct continues score identically — the "always stop" cynicism bias
    // must earn nothing. The chosen action is recorded so the confusion matrix can reveal which
    // direction the operator over-indexes.
    this._scoreResult(s, correct, this._triageShownAt ? Date.now() - this._triageShownAt : 0, {
      chosen: decision === 'stop' ? 'STOP' : 'CONTINUE',
      itemId: `${s.id}#triage`
    });

    const stopBtn = document.getElementById('btn-triage-stop');
    const contBtn = document.getElementById('btn-triage-continue');
    [stopBtn, contBtn].forEach((b) => { if (b) b.disabled = true; });
    const correctBtn = s.correctDecision === 'stop' ? stopBtn : contBtn;
    const chosenBtn = decision === 'stop' ? stopBtn : contBtn;
    if (correctBtn) { correctBtn.style.borderColor = 'var(--veracity-green)'; correctBtn.style.background = 'rgba(74,222,128,0.12)'; }
    if (!correct && chosenBtn) { chosenBtn.style.borderColor = 'var(--disinfo-crimson)'; chosenBtn.style.background = 'rgba(239,68,68,0.12)'; }

    const fb = document.getElementById('triage-feedback');
    if (fb) {
      fb.innerHTML = `
        <div class="card-granite-inset" style="border-left:3px solid ${esc(correct ? 'var(--veracity-green)' : 'var(--disinfo-crimson)')};padding:12px;">
          <span class="status-label ${esc(correct ? 'text-emerald' : 'text-crimson')}">${esc(correct
            ? (s.correctDecision === 'stop' ? '✓ CORRECT — STOPPED' : '✓ CORRECT — CONTINUED')
            : (s.correctDecision === 'stop' ? '✗ SHOULD HAVE STOPPED' : '✗ SHOULD HAVE CONTINUED'))}</span>
          <p class="body-text" style="margin:6px 0 0;font-size:0.85rem;">${esc(s.explanation)}</p>
        </div>`;
    }

    this._triageIdx++;
    setTimeout(() => {
      if (this._triageActive) this._renderTriageQuestion();
    }, correct ? 600 : 1400);
  },

  _endTriage(reason) {
    this._clearTriageCountdown();
    this._triageActive = false;
    const vp = document.getElementById('sift-active-lab-viewport');
    if (!vp) return;
    const total = this._triageIdx;
    const acc = total > 0 ? Math.round((this._triageScore / total) * 100) : 0;
    if (acc >= 70 && total >= 3) {
      TacticalAudio.playVictory();
    } else {
      TacticalAudio.playDefeat();
    }
    vp.innerHTML = `
      <div class="card card-bronze" style="padding:24px;">
        <div style="text-align:center;margin-bottom:16px;">
          <div style="font-size:2rem;">⏱️</div>
          <h3 class="card-title" style="margin:6px 0;">Triage Complete — ${esc(reason)}</h3>
        </div>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:18px;">
          <div class="stat-card"><div class="stat-val bronze">${esc(this._triageScore)}</div><div class="stat-lbl">Correct</div></div>
          <div class="stat-card"><div class="stat-val amber">${esc(acc)}%</div><div class="stat-lbl">Accuracy (${esc(total)} triaged)</div></div>
          <div class="stat-card"><div class="stat-val crim">${esc(this._triageMaxStreak)}</div><div class="stat-lbl">Best Streak</div></div>
        </div>
        <p class="body-muted" style="text-align:center;font-size:0.8rem;margin-bottom:16px;">
          Correct stops and correct continues scored equally — a reflexive "stop everything" earns no bonus.
        </p>
        <div style="display:flex;gap:10px;justify-content:center;">
          <button class="btn btn-primary" id="btn-triage-replay">⏱️ Play Again</button>
          <button class="btn btn-outline" id="btn-triage-back">← Back to Labs</button>
        </div>
      </div>`;
    vp.querySelector('#btn-triage-replay')?.addEventListener('click', () => this._startTriage());
    vp.querySelector('#btn-triage-back')?.addEventListener('click', () => this._exitTriage());
  },

  _exitTriage() {
    this._clearTriageCountdown();
    this._triageActive = false;
    this._renderLabSelector();
  },

  // ──────────────────────────────────────────────────────────────
  // SESSION SUMMARY
  // ──────────────────────────────────────────────────────────────
  getSessionSummary() {
    const total = this._sessionResults.length;
    const correct = this._sessionResults.filter(r => r.correct).length;
    const avgTime = total > 0
      ? Math.round(this._sessionResults.reduce((s, r) => s + r.timeMs, 0) / total / 1000)
      : 0;
    return { total, correct, accuracy: total > 0 ? Math.round((correct / total) * 100) : 0, avgTimeSec: avgTime };
  }
};
