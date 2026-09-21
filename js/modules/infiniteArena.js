import { TacticalAudio } from './tacticalAudio.js';
/**
 * SOVEREIGN // AEGIS — The Infinite Arena
 * Rapid-fire ELO streak challenge and endless epistemic gauntlet.
 */

import { esc } from '../security.js';
import { recordAttempt, CONTEXTS } from '../attempts.js';
import { Confidence } from '../confidence.js';
import { rank, estimateAll } from '../competency.js';
import { AttemptLog } from '../attemptlog.js';

/**
 * How often a held-out item is administered, in questions.
 *
 * Held-out items are the only evidence the application has that practice produces
 * transfer rather than familiarity (see js/competency.js → transfer()). They are therefore
 * NOT drawn as ordinary practice: the pool used by nextQuestion() excludes them, and one is
 * deliberately administered every PROBE_EVERY questions instead.
 *
 * Before this, selection was uniform over all questions, so ~21% of everything answered was
 * a held-out item — enough repetition (with the explanation shown each time) that
 * improvement on them would have measured practice, not transfer. Probing spaces that
 * exposure out to ~12% and makes it scheduled rather than accidental.
 *
 * The remaining honest limitation: the Arena shows the explanation after every answer,
 * including probes, so held-out items are not perfectly unpracticed — only rarely and
 * evenly practiced. Suppressing feedback on probes would fix that at the cost of silently
 * withholding the explanation the operator expects, which is a UI decision, not a
 * refactor. Documented rather than assumed.
 */
const PROBE_EVERY = 8;

export const InfiniteArena = {
  _spawnCombatFloat(host, text, type = 'normal') {
    if (!host) return;
    const tag = document.createElement('div');
    tag.className = `combat-float-tag ${type}`;
    tag.textContent = text;
    host.style.position = 'relative';
    tag.style.top = '36%';
    host.appendChild(tag);
    setTimeout(() => tag.remove(), 1100);
  },
  _app: null,
  _questions: [],
  _activeQuestion: null,
  _mode: 'blitz', // 'blitz' | 'suddendeath' | 'zen'
  _score: 0,
  _streak: 0,
  _maxStreak: 0,
  _timeLeft: 60,
  _timerInterval: null,
  _roundHistory: [],
  _isAnswerLocked: false,
  _questionShownAt: 0,
  _sinceProbe: 0,
  /** Display position → index into q.options, for the current question. */
  _displayOrder: [],
  /** Skills catalogue, loaded once. */
  _skills: [],
  /** Ranked practice pool, refreshed at round start. */
  _rankedPool: [],
  /** Index into _rankedPool — cycles so every item gets a turn. */
  _rankedCursor: 0,

  async init(app) {
    this._app = app;
    await this._loadData();
    await this._loadSkills();
    this._bindEvents();
    console.log('[InfiniteArena] Initialized.');
  },

  onMount() {
    this._updateHUD();
    this._showLobby();
  },

  onUnmount() {
    this._stopTimer();
  },

  async _loadData() {
    try {
      const resp = await fetch('./data/arena_questions.json')
        .catch(() => fetch('data/arena_questions.json'));
      const data = await resp.json();
      this._questions = Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn('[InfiniteArena] Could not load arena_questions.json, using fallback.', e);
      this._questions = [
        {
          id: 'q1',
          domain: 'Logical Fallacy',
          difficulty: 1050,
          claim: '"Why should we trust Dr. Vance\'s climate model when he was caught having an affair five years ago?"',
          options: ['Ad Hominem', 'Straw Man', 'Slippery Slope', 'False Dilemma'],
          correctIndex: 0,
          explanation: 'Attacks personal moral character rather than evaluating empirical scientific rigor.'
        }
      ];
    }
  },

  async _loadSkills() {
    try {
      const res = await fetch('./data/skills.json').catch(() => fetch('data/skills.json'));
      this._skills = await res.json();
    } catch {
      this._skills = [];
    }
  },

  /**
   * Refresh the ranked practice pool from the attempt log. Called at round start so the
   * operator's weakest skills drive the first few questions of each session. The pool is
   * stable for the rest of the round — refreshing mid-round would reshuffle the floor
   * under someone on a streak.
   *
   * Falls back to random uniform draw if the competency estimator has nothing to work with
   * (no attempts yet), so the first session behaves exactly as it did before.
   * @private
   */
  async _refreshRankedPool() {
    const practice = this._questions.filter((x) => x.heldOut !== true);
    if (!practice.length || !this._skills.length) {
      this._rankedPool = null;
      return;
    }
    try {
      const attempts = await AttemptLog.readAll();
      if (!attempts.length) {
        this._rankedPool = null;
        return;
      }
      const masteryMap = estimateAll(attempts, this._skills);
      // Treat arena questions as the item set for rank(). Each question's `tests` become
      // its `skillIds` which is what rank() uses to score the item by its weakest skill.
      const items = practice.map((q) => ({
        id: q.id,
        skillIds: q.tests || [],
        _question: q
      }));
      const ranked = rank(items, masteryMap, { attempts, limit: items.length });
      this._rankedPool = ranked.map((r) => r.item._question);
      this._rankedCursor = 0;
    } catch {
      this._rankedPool = null;
    }
  },

  _getRankTitle(elo) {
    if (elo < 1150) return 'EPISTEMIC NOVICE';
    if (elo < 1350) return 'COGNITIVE APPRENTICE';
    if (elo < 1550) return 'DISCERNMENT SENTINEL';
    if (elo < 1750) return 'SOVEREIGN DEFENDER';
    if (elo < 1950) return 'EPISTEMIC GRANDMASTER';
    return 'SOVEREIGN AEGIS ELITE';
  },

  _updateHUD() {
    const elo = parseInt(this._app.store.get('arena.elo') || '1000', 10);
    const highScore = parseInt(this._app.store.get('arena.high_score') || '0', 10);
    const bestStreak = parseInt(this._app.store.get('arena.best_streak') || '0', 10);

    const eloEl = document.getElementById('arena-hud-elo');
    const rankEl = document.getElementById('arena-hud-rank');
    const highEl = document.getElementById('arena-hud-high-score');
    const streakEl = document.getElementById('arena-hud-best-streak');

    if (eloEl) eloEl.textContent = elo;
    if (rankEl) rankEl.textContent = this._getRankTitle(elo);
    if (highEl) highEl.textContent = highScore;
    if (streakEl) streakEl.textContent = bestStreak;
  },

  _bindEvents() {
    // Mode Buttons
    document.getElementById('btn-mode-blitz')?.addEventListener('click', () => this.startRound('blitz'));
    document.getElementById('btn-mode-suddendeath')?.addEventListener('click', () => this.startRound('suddendeath'));
    document.getElementById('btn-mode-zen')?.addEventListener('click', () => this.startRound('zen'));

    // AAR Replay & Lobby Buttons
    document.getElementById('btn-arena-replay')?.addEventListener('click', () => this.startRound(this._mode));
    document.getElementById('btn-arena-lobby')?.addEventListener('click', () => this._showLobby());
    document.getElementById('btn-arena-pin-dossier')?.addEventListener('click', () => this._pinAARToDossier());

    // Keyboard controls (1, 2, 3, 4)
    window.addEventListener('keydown', (e) => {
      const activeView = document.getElementById('arena-active-view');
      if (!activeView || activeView.classList.contains('hidden') || this._isAnswerLocked) return;

      if (['1', '2', '3', '4'].includes(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        this.submitAnswer(idx);
      }
    });
  },

  _showLobby() {
    this._stopTimer();
    document.getElementById('arena-lobby-view')?.classList.remove('hidden');
    document.getElementById('arena-active-view')?.classList.add('hidden');
    document.getElementById('arena-aar-view')?.classList.add('hidden');
    this._updateHUD();
  },

  async startRound(mode = 'blitz') {
    this._mode = mode;
    this._score = 0;
    this._critCount = 0;
    this._streak = 0;
    this._maxStreak = 0;
    this._roundHistory = [];
    this._isAnswerLocked = false;
    this._sinceProbe = 0;
    this._rankedCursor = 0;
    this._timeLeft = mode === 'blitz' ? 60 : mode === 'suddendeath' ? 999 : 999;

    document.getElementById('arena-lobby-view')?.classList.add('hidden');
    document.getElementById('arena-aar-view')?.classList.add('hidden');
    document.getElementById('arena-active-view')?.classList.remove('hidden');

    const timerDisplay = document.getElementById('arena-timer-display');
    if (timerDisplay) {
      timerDisplay.textContent = mode === 'blitz' ? '60s' : mode === 'suddendeath' ? '1 LIFE' : 'ZEN FLOW';
    }

    // Refresh the ranked pool before the first question — fire-and-forget so the lobby
    // transition happens instantly. The pool defaults to random when null, so the first
    // question will still draw correctly even if the rank computation is still in-flight.
    this._refreshRankedPool();

    this._startTimer();
    this.nextQuestion();
  },

  _startTimer() {
    this._stopTimer();
    if (this._mode === 'zen' || this._mode === 'suddendeath') return;

    this._timerInterval = setInterval(() => {
      this._timeLeft--;
      const timerDisplay = document.getElementById('arena-timer-display');
      const timerBar = document.getElementById('arena-timer-bar');

      if (timerDisplay) timerDisplay.textContent = `${this._timeLeft}s`;
      if (timerBar) {
        const pct = Math.max(0, Math.min(100, (this._timeLeft / 60) * 100));
        timerBar.style.width = `${pct}%`;
      }

      if (this._timeLeft <= 0) {
        this.endRound('Time Expired');
      }
    }, 1000);
  },

  _stopTimer() {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
    document.getElementById('arena-timer-display')?.classList.remove('timer-danger');
  },

  /**
   * Choose the next question.
   *
   * Held-out probes are administered every PROBE_EVERY questions (uniform random from the
   * held-out set).
   *
   * For ordinary practice items: if a competency-ranked pool is available (it is computed
   * at round start from the attempt log), questions are drawn from the top of the ranked
   * list with probabilistic weighting — the weakest-skill item is most likely, but any item
   * in the top half can appear, so the experience doesn't feel like a deterministic queue.
   * Falls back to uniform random when no attempts exist yet (cold start).
   * @private
   */
  _selectQuestion() {
    const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];
    const held = this._questions.filter((x) => x.heldOut === true);
    const practice = this._questions.filter((x) => x.heldOut !== true);

    this._sinceProbe++;
    if (held.length && this._sinceProbe >= PROBE_EVERY) {
      this._sinceProbe = 0;
      return pick(held);
    }

    // Ranked pool exists → draw with weak-skill bias.
    if (this._rankedPool && this._rankedPool.length) {
      // Probabilistic: 50% of the time, take the top-ranked available item. 50% of the
      // time, pick uniformly from the top third. This keeps the draw concentrated on weak
      // skills without repeating questions in lock-step.
      const top = this._rankedPool.slice(0, Math.max(3, Math.ceil(this._rankedPool.length / 3)));
      if (Math.random() < 0.5 && top.length) {
        return top[0];
      }
      return pick(top);
    }

    return practice.length ? pick(practice) : pick(this._questions);
  },

  nextQuestion() {
    this._isAnswerLocked = false;
    const feedback = document.getElementById('arena-live-feedback');
    if (feedback) feedback.classList.add('hidden');

    if (this._questions.length === 0) return;

    const q = this._selectQuestion();
    if (!q) return;
    this._activeQuestion = q;
    // Read before the DOM writes below, so latency measures thinking time rather than render time.
    this._questionShownAt = Date.now();

    // Render Question
    const domainBadge = document.getElementById('arena-active-domain');
    const diffBadge = document.getElementById('arena-active-difficulty');
    const claimEl = document.getElementById('arena-active-claim');
    const comboBadge = document.getElementById('arena-active-combo');

    if (domainBadge) domainBadge.textContent = q.domain.toUpperCase();
    if (diffBadge) diffBadge.textContent = `DIFFICULTY: ${q.difficulty}`;
    if (claimEl) claimEl.textContent = q.claim;

    // Enhanced combo multiplier & dynamic tactical titles
    const mult = this._streak >= 8 ? 4.0 : this._streak >= 5 ? 3.0 : this._streak >= 3 ? 2.0 : this._streak >= 1 ? 1.5 : 1.0;
    if (comboBadge) {
      comboBadge.classList.remove('combo-pop-scale');
      void comboBadge.offsetWidth;
      comboBadge.classList.add('combo-pop-scale');
      if (this._streak >= 8) {
        comboBadge.textContent = `4.0x HYPER-SENTINEL APEX ?? (STREAK: ${this._streak})`;
        comboBadge.style.color = '#38bdf8';
      } else if (this._streak >= 5) {
        comboBadge.textContent = `3.0x COGNITIVE OVERDRIVE ? (STREAK: ${this._streak})`;
        comboBadge.style.color = '#34d399';
      } else if (this._streak >= 3) {
        comboBadge.textContent = `2.0x DIALECTIC FOCUS ?? (STREAK: ${this._streak})`;
        comboBadge.style.color = 'var(--amber-bright, #f59e0b)';
      } else if (this._streak >= 1) {
        comboBadge.textContent = `1.5x TACTICAL MOMENTUM (STREAK: ${this._streak})`;
        comboBadge.style.color = 'var(--parchment-bright)';
      } else {
        comboBadge.textContent = `1.0x MULTIPLIER (STREAK: 0)`;
        comboBadge.style.color = 'var(--stone-light)';
      }
    }
    const activeCardEl = document.getElementById('arena-active-view');
    if (activeCardEl) {
      if (this._streak >= 5) activeCardEl.classList.add('arena-card-overdrive');
      else activeCardEl.classList.remove('arena-card-overdrive');
    }

    // Render Options
    const grid = document.getElementById('arena-options-grid');
    if (!grid) return;

    // Mounted into its own host element, not into the grid: the grid is emptied on every question,
    // so a control inside it would be destroyed and rebuilt each time — flickering in the one place
    // in the app where speed is the point. mount() is idempotent, so this costs nothing after the
    // first question.
    Confidence.mount(document.getElementById('arena-confidence-host'), {
      label: 'HOW SURE ARE YOU? — STAYS SET UNTIL YOU CHANGE IT'
    });

    // Presentation order, NOT storage order — see _presentationOrder().
    this._displayOrder = this._presentationOrder(q);

    grid.innerHTML = '';
    this._displayOrder.forEach((sourceIdx, displayIdx) => {
      const btn = document.createElement('button');
      btn.className = 'arena-option-btn';
      btn.innerHTML = `
        <span class="arena-key-hint">${esc(displayIdx + 1)}</span>
        <span>${esc(q.options[sourceIdx])}</span>
      `;
      btn.addEventListener('click', () => this.submitAnswer(displayIdx));
      grid.appendChild(btn);
    });
  },

  /**
   * The order the four options are shown in, as indices into `q.options`.
   *
   * WHY THIS EXISTS
   * ---------------
   * Every question in the bank stores its correct answer at index 0 — all 119 of them — and the
   * options were previously rendered in storage order. The Arena was therefore passable at 100%
   * by pressing "1" on every question: full accuracy, rising ELO, and mastery estimates built
   * entirely on a single keypress. That is not weak evidence, it is fabricated evidence, and it
   * affected the strongest measurement in the application.
   *
   * Shuffling at PRESENTATION rather than fixing the data is deliberate. It cannot be undone by a
   * later content edit, it covers every item added in future without anyone remembering to vary
   * the index, and it leaves the stored `correctIndex` meaning exactly what it says.
   *
   * The order is deterministic per question id: re-encountering a question does not reshuffle the
   * options underneath someone mid-thought, which would be its own small cruelty under a timer.
   *
   * @private
   * @param {{id: string, options: string[]}} q
   * @returns {number[]}
   */
  _presentationOrder(q) {
    const n = Array.isArray(q.options) ? q.options.length : 0;
    const order = Array.from({ length: n }, (_, i) => i);
    let seed = 0;
    const key = String(q.id || '');
    for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) & 0x7fffffff;
    // Take the HIGH bits of the LCG, not `% (i+1)`. The low bits of a linear congruential
    // generator are famously non-random — the first version of this used the modulo and produced
    // a 0/61/29/29 distribution across the bank, i.e. the correct answer was never in position 1
    // and sat in position 2 half the time. A biased shuffle is a subtler version of the tell it
    // was written to remove, so the distribution is asserted in the test suite rather than assumed.
    const next = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    next(); next(); // discard two draws: the first outputs of an LCG track the seed too closely
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  },

  submitAnswer(selectedIndex) {
    if (this._isAnswerLocked || !this._activeQuestion) return;
    this._isAnswerLocked = true;

    const q = this._activeQuestion;
    // `selectedIndex` is a DISPLAY position; translate it back through the presentation order
    // before comparing to the stored answer. Without this the shuffle would invert scoring.
    const order = this._displayOrder && this._displayOrder.length === q.options.length
      ? this._displayOrder
      : q.options.map((_, i) => i);
    const answeredIndex = order[selectedIndex];
    const correctDisplayIndex = order.indexOf(q.correctIndex);
    const isCorrect = answeredIndex === q.correctIndex;
    // `chosen` is the option TEXT (stable across the presentation shuffle), not the display
    // index — the index is presentation state and would corrupt the confusion matrix.
    this._recordAttempt(q, isCorrect, q.options[answeredIndex]);
    const feedback = document.getElementById('arena-live-feedback');
    const optionBtns = document.querySelectorAll('.arena-option-btn');

    // Highlight options — by display position, since that is what the operator is looking at.
    optionBtns.forEach((btn, idx) => {
      btn.disabled = true;
      if (idx === correctDisplayIndex) {
        btn.classList.add('correct');
      } else if (idx === selectedIndex) {
        btn.classList.add('incorrect');
      }
    });

    // Record history
    this._roundHistory.push({
      question: q,
      selectedIndex: answeredIndex, // stored in SOURCE terms so the round summary stays readable
      isCorrect,
      domain: q.domain
    });

    if (isCorrect) {
      this._streak++;
      if (this._streak > this._maxStreak) this._maxStreak = this._streak;

      const mult = this._streak >= 6 ? 3.0 : this._streak >= 3 ? 2.0 : this._streak >= 1 ? 1.5 : 1.0;
      const basePoints = Math.round(q.difficulty / 10);
      const earned = Math.round(basePoints * mult);
      this._score += earned;

      if (this._mode === 'blitz') {
        this._timeLeft = Math.min(60, this._timeLeft + 3);
      }

      if (feedback) {
        feedback.classList.remove('hidden');
        feedback.style.background = 'rgba(74, 222, 128, 0.12)';
        feedback.style.border = '1px solid var(--veracity-border, #4ade80)';
        feedback.style.color = 'var(--veracity-text, #86efac)';
        feedback.innerHTML = `<strong>✓ Correct (+${esc(earned)} pts${esc(this._mode === 'blitz' ? ', +3s' : '')})!</strong> ${esc(q.explanation)}`;
      }

      setTimeout(() => this.nextQuestion(), 900);
    } else {
      this._streak = 0;

      if (this._mode === 'blitz') {
        this._timeLeft = Math.max(0, this._timeLeft - 5);
      }

      if (feedback) {
        feedback.classList.remove('hidden');
        feedback.style.background = 'rgba(239, 68, 68, 0.12)';
        feedback.style.border = '1px solid var(--disinfo-border, #ef4444)';
        feedback.style.color = 'var(--suspicion-text, #fca5a5)';
        feedback.innerHTML = `<strong>✗ Incorrect (${esc(this._mode === 'blitz' ? '-5s' : '')}).</strong> Correct: <em>${esc(q.options[q.correctIndex])}</em>.<br><span style="opacity: 0.9; font-size: 0.85em;">${esc(q.explanation)}</span>`;
      }

      if (this._mode === 'suddendeath') {
        setTimeout(() => this.endRound('Sudden Death Breach'), 1200);
        return;
      }

      setTimeout(() => this.nextQuestion(), 1600);
    }
  },

  /**
   * Hand the right/wrong moment to the shared recorder (js/attempts.js), which owns the
   * fan-out to one record per tested skill and the fire-and-forget contract.
   * @private
   */
  _recordAttempt(q, isCorrect, chosenText) {
    return recordAttempt({
      skillIds: q.tests,
      itemId: q.id,
      correct: isCorrect,
      context: CONTEXTS.ARENA,
      latencyMs: this._questionShownAt ? Math.max(0, Date.now() - this._questionShownAt) : null,
      heldOut: q.heldOut === true,
      chosen: chosenText
    });
  },

  endRound(reason = 'Gauntlet Finished') {
    this._stopTimer();

    document.getElementById('arena-active-view')?.classList.add('hidden');
    document.getElementById('arena-aar-view')?.classList.remove('hidden');

    const total = this._roundHistory.length;
    const correctCount = this._roundHistory.filter(h => h.isCorrect).length;
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    // Calculate ELO Delta
    let currentElo = parseInt(this._app.store.get('arena.elo') || '1000', 10);
    let eloDelta = 0;

    this._roundHistory.forEach(h => {
      const expected = 1 / (1 + Math.pow(10, (h.question.difficulty - currentElo) / 400));
      const actual = h.isCorrect ? 1 : 0;
      eloDelta += Math.round(32 * (actual - expected) / Math.max(1, total * 0.5));
    });

    const newElo = Math.max(800, currentElo + eloDelta);
    this._app.store.set('arena.elo', newElo);

    // High Score and Best Streak
    const prevHighScore = parseInt(this._app.store.get('arena.high_score') || '0', 10);
    if (this._score > prevHighScore) {
      this._app.store.set('arena.high_score', this._score);
    }

    const prevBestStreak = parseInt(this._app.store.get('arena.best_streak') || '0', 10);
    if (this._maxStreak > prevBestStreak) {
      this._app.store.set('arena.best_streak', this._maxStreak);
    }

    // Render AAR UI
    const titleEl = document.getElementById('arena-aar-title');
    const subtitleEl = document.getElementById('arena-aar-subtitle');
    const scoreEl = document.getElementById('arena-aar-score');
    const accEl = document.getElementById('arena-aar-accuracy');
    const streakEl = document.getElementById('arena-aar-streak');
    const eloDeltaEl = document.getElementById('arena-aar-elo-delta');

    if (titleEl) titleEl.textContent = reason;
    if (subtitleEl) subtitleEl.textContent = `Completed ${total} trials under ${this._mode.toUpperCase()} protocol.`;
    if (scoreEl) scoreEl.textContent = this._score;
    if (accEl) accEl.textContent = `${accuracy}% (${correctCount}/${total})`;
    if (streakEl) streakEl.textContent = this._maxStreak;
    if (eloDeltaEl) {
      const sign = eloDelta >= 0 ? '+' : '';
      eloDeltaEl.textContent = `${newElo} (${sign}${eloDelta})`;
      eloDeltaEl.className = eloDelta >= 0 ? 'text-emerald' : 'text-crimson';
    }

    // Domain Breakdown
    const breakdownEl = document.getElementById('arena-aar-breakdown');
    if (breakdownEl) {
      const domains = {};
      this._roundHistory.forEach(h => {
        if (!domains[h.domain]) domains[h.domain] = { total: 0, correct: 0 };
        domains[h.domain].total++;
        if (h.isCorrect) domains[h.domain].correct++;
      });

      breakdownEl.innerHTML = Object.entries(domains).map(([domain, stats]) => {
        const pct = Math.round((stats.correct / stats.total) * 100);
        const isWeak = pct < 60;
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: var(--bg-surface); border-radius: var(--radius-xs);">
            <span>${esc(domain)}</span>
            <span class="badge ${esc(isWeak ? 'badge-disinfo' : 'badge-veracity')}">${esc(pct)}% (${esc(stats.correct)}/${esc(stats.total)}) ${esc(isWeak ? '⚠ VULNERABILITY' : '✓ SECURE')}</span>
          </div>
        `;
      }).join('');
    }

    this._updateHUD();
  },

  _pinAARToDossier() {
    const total = this._roundHistory.length;
    const correct = this._roundHistory.filter(h => h.isCorrect).length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const elo = this._app.store.get('arena.elo') || '1000';

    const mistakes = this._roundHistory.filter(h => !h.isCorrect);
    let mistakeSummary = mistakes.map(m => `  • [${m.domain}] "${m.question.claim}" → Correct: ${m.question.options[m.question.correctIndex]} (${m.question.explanation})`).join('\n');
    if (!mistakeSummary) mistakeSummary = '  • None! Flawless run.';

    const contentStr = `PROTOCOL: ${this._mode.toUpperCase()} GAUNTLET\n` +
      `FINAL SCORE: ${this._score} | ACCURACY: ${accuracy}% | MAX STREAK: ${this._maxStreak}\n` +
      `CURRENT ELO: ${elo} (${this._getRankTitle(parseInt(elo, 10))})\n\n` +
      `IDENTIFIED EPISTEMIC VULNERABILITIES & MISTAKES:\n${mistakeSummary}`;

    window.dispatchEvent(new CustomEvent('aegis:pin', {
      detail: {
        source: 'The Infinite Arena',
        title: `Gauntlet AAR: ${this._mode.toUpperCase()} Session`,
        content: contentStr
      }
    }));
  }
};
