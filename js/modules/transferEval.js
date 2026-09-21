/**
 * SOVEREIGN // AEGIS — Transfer Evaluation Protocol (Phase 4 / R8)
 *
 * Administers controlled 10-item parallel forms drawn exclusively from held-out items
 * that are never used in ordinary practice.
 *
 * Implements:
 *   - Form T0 (Baseline): Pre-test diagnostic before extensive practice.
 *   - Form T1 (Follow-Up): Post-test transfer measurement.
 *
 * Records each attempt to AttemptLog with heldOut: true and context: 'arena',
 * directly feeding competency.transfer() to produce empirical within-subject delta
 * and 95% confidence intervals.
 *
 * @module transferEval
 */

import { recordAttempt, CONTEXTS } from '../attempts.js';
import { Confidence } from '../confidence.js';
import { AttemptLog } from '../attemptlog.js';
import { transfer } from '../competency.js';
import { esc } from '../security.js';

export const TransferEval = {
  _app: null,
  _active: false,
  _mode: 'baseline', // 'baseline' (T0) | 'followup' (T1)
  _formQuestions: [],
  _currentIndex: 0,
  _score: 0,
  _shownAt: 0,
  _isAnswerLocked: false,

  init(app) {
    this._app = app;
  },

  /**
   * Launch a 10-item held-out evaluation form.
   * @param {'baseline'|'followup'} mode
   */
  async startEvaluation(mode = 'baseline') {
    this._mode = mode;
    this._score = 0;
    this._currentIndex = 0;
    this._isAnswerLocked = false;
    this._evaluatedResponses = [];

    let allQuestions = [];
    try {
      const resp = await fetch('./data/arena_questions.json')
        .catch(() => fetch('data/arena_questions.json'));
      allQuestions = await resp.json();
    } catch (e) {
      console.error('[TransferEval] Could not load questions:', e);
      this._app?.showToast?.({ type: 'error', title: 'TRANSFER EVAL ERROR', message: 'Could not load held-out questions.' });
      return;
    }

    const heldOutQuestions = (Array.isArray(allQuestions) ? allQuestions : []).filter(q => q.heldOut === true);
    if (!heldOutQuestions.length) {
      this._app?.showToast?.({ type: 'error', title: 'TRANSFER EVAL ERROR', message: 'No held-out probe items found.' });
      return;
    }

    // Determine prior held-out item exposures from attempt log
    let attemptedIds = new Set();
    try {
      const attempts = await AttemptLog.readAll();
      attemptedIds = new Set((attempts || []).filter(a => a && a.heldOut === true).map(a => a.itemId));
    } catch {
      attemptedIds = new Set();
    }

    if (mode === 'baseline') {
      // T0: Draw 10 balanced held-out items across Fallacy, SIFT, and Tactics/Biases
      this._formQuestions = this._drawBalancedBattery(heldOutQuestions, attemptedIds);
    } else {
      // T1: Draw 10 non-overlapping balanced held-out items
      this._formQuestions = this._drawBalancedBattery(heldOutQuestions, attemptedIds);
    }

    this._active = true;
    this._renderModal();
    this._renderCurrentQuestion();
  },

  _drawBalancedBattery(questions, attemptedIds) {
    const isFallacy = (q) => (q.tests || []).some((t) => t.startsWith('skill.fallacy.'));
    const isSift = (q) => (q.tests || []).some((t) => t.startsWith('skill.sift.'));
    const isOther = (q) => !isFallacy(q) && !isSift(q);

    const pickFrom = (pool, count) => {
      const unattempted = pool.filter((q) => !attemptedIds.has(q.id));
      const chosen = [];
      const unShuffled = this._shuffle([...unattempted]);
      while (chosen.length < count && unShuffled.length) {
        chosen.push(unShuffled.pop());
      }
      if (chosen.length < count) {
        const attempted = this._shuffle(pool.filter((q) => attemptedIds.has(q.id)));
        while (chosen.length < count && attempted.length) {
          chosen.push(attempted.pop());
        }
      }
      return chosen;
    };

    const fallacies = pickFrom(questions.filter(isFallacy), 4);
    const sifts = pickFrom(questions.filter(isSift), 4);
    const others = pickFrom(questions.filter(isOther), 2);

    const combined = [...fallacies, ...sifts, ...others];
    if (combined.length < 10) {
      const chosenIds = new Set(combined.map((q) => q.id));
      const remaining = this._shuffle(questions.filter((q) => !chosenIds.has(q.id)));
      while (combined.length < 10 && remaining.length) {
        combined.push(remaining.pop());
      }
    }
    return this._shuffle(combined).slice(0, 10);
  },

  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  _renderModal() {
    let modal = document.getElementById('transfer-eval-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'transfer-eval-modal';
      modal.className = 'modal-backdrop';
      document.body.appendChild(modal);
    }

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-card card card-bronze" style="max-width:760px;width:95%;max-height:90vh;overflow-y:auto;padding:24px;border:1px solid var(--bronze-mid);">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--bronze-dark);padding-bottom:12px;margin-bottom:16px;">
          <div>
            <span class="badge badge-intel">${this._mode === 'baseline' ? 'PROTOCOL: FORM T0 (BASELINE)' : 'PROTOCOL: FORM T1 (FOLLOW-UP)'}</span>
            <h3 class="heading-3" style="margin:4px 0 0 0;color:var(--parchment-bright);">🔬 Transfer Capability Evaluation</h3>
          </div>
          <button type="button" class="btn-icon" id="btn-transfer-eval-close" title="Exit Evaluation">✕</button>
        </div>
        <div id="transfer-eval-body"></div>
      </div>
    `;

    document.getElementById('btn-transfer-eval-close')?.addEventListener('click', () => {
      if (confirm('Exit transfer evaluation? Incomplete assessments will not yield valid pre/post delta.')) {
        this.closeModal();
      }
    });
  },

  _renderCurrentQuestion() {
    const body = document.getElementById('transfer-eval-body');
    if (!body) return;

    if (this._currentIndex >= this._formQuestions.length) {
      this._renderSummary();
      return;
    }

    const q = this._formQuestions[this._currentIndex];
    this._isAnswerLocked = false;
    this._shownAt = Date.now();

    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span class="status-label" style="color:var(--amber-bright);font-weight:700;">
          PROBE ${this._currentIndex + 1} OF ${this._formQuestions.length}
        </span>
        <span class="badge badge-neutral">${esc(q.domain || 'EPISTEMIC').toUpperCase()}</span>
      </div>

      <div class="card card-granite-inset" style="padding:16px;margin-bottom:16px;border-left:3px solid var(--intel-cyan,#38bdf8);">
        <div class="status-label text-muted" style="margin-bottom:6px;">STIMULUS CLAIM / EVIDENCE:</div>
        <p class="body-text" style="font-size:1.05rem;line-height:1.5;color:var(--parchment-bright);margin:0;">
          ${esc(q.claim)}
        </p>
      </div>

      <div id="transfer-eval-confidence-host" style="margin-bottom:16px;"></div>

      <div class="status-label text-muted" style="margin-bottom:8px;">SELECT EVALUATION:</div>
      <div class="grid-2" style="gap:10px;" id="transfer-eval-options">
        ${q.options.map((opt, idx) => `
          <button type="button" class="btn btn-secondary transfer-opt-btn" data-opt-idx="${idx}" style="text-align:left;padding:12px;font-size:0.9rem;white-space:normal;line-height:1.4;">
            <span style="font-family:var(--font-mono);color:var(--amber-bright);margin-right:6px;">${String.fromCharCode(65 + idx)}.</span>
            ${esc(opt)}
          </button>
        `).join('')}
      </div>

      <div id="transfer-eval-feedback" class="hidden" style="margin-top:16px;"></div>
    `;

    // Mount confidence selector
    const confHost = document.getElementById('transfer-eval-confidence-host');
    if (confHost) {
      Confidence.mount(confHost, { label: 'CERTAINTY BEFORE ANSWERING:' });
    }

    // Bind option buttons
    body.querySelectorAll('.transfer-opt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this._isAnswerLocked) return;
        const optIdx = parseInt(btn.getAttribute('data-opt-idx'), 10);
        this._handleAnswer(optIdx);
      });
    });
  },

  _handleAnswer(chosenIdx) {
    if (this._isAnswerLocked) return;
    this._isAnswerLocked = true;

    const q = this._formQuestions[this._currentIndex];
    const isCorrect = chosenIdx === q.correctIndex;
    if (isCorrect) this._score++;

    const latencyMs = Math.max(100, Date.now() - this._shownAt);
    const conf = Confidence.current();

    if (!this._evaluatedResponses) this._evaluatedResponses = [];
    this._evaluatedResponses.push({
      question: q,
      isCorrect,
      confidence: conf,
      latencyMs
    });

    // Record attempt under CONTEXTS.ARENA with heldOut: true
    recordAttempt({
      skillIds: q.tests || [],
      itemId: q.id,
      correct: isCorrect,
      context: CONTEXTS.ARENA,
      heldOut: true,
      confidence: conf,
      chosen: q.options[chosenIdx] || '',
      latencyMs
    });

    // Visually highlight options
    const optionBtns = document.querySelectorAll('.transfer-opt-btn');
    optionBtns.forEach(b => {
      const idx = parseInt(b.getAttribute('data-opt-idx'), 10);
      b.disabled = true;
      if (idx === q.correctIndex) {
        b.style.borderColor = 'var(--veracity-green, #34d399)';
        b.style.backgroundColor = 'rgba(52, 211, 153, 0.12)';
      } else if (idx === chosenIdx) {
        b.style.borderColor = 'var(--disinfo-crimson, #f87171)';
        b.style.backgroundColor = 'rgba(248, 113, 113, 0.12)';
      }
    });

    // Show immediate brief feedback
    const fb = document.getElementById('transfer-eval-feedback');
    if (fb) {
      fb.classList.remove('hidden');
      fb.innerHTML = `
        <div class="card card-granite-inset" style="padding:14px;border-left:3px solid ${isCorrect ? 'var(--veracity-green,#34d399)' : 'var(--disinfo-crimson,#f87171)'};">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span class="status-label" style="color:${isCorrect ? 'var(--veracity-green,#34d399)' : 'var(--disinfo-crimson,#f87171)'};">
              ${isCorrect ? '✓ PROBE VERIFIED' : '✗ PROBE LAPSED'}
            </span>
            <span class="status-label text-muted">CONFIDENCE: ${esc(conf.toUpperCase())}</span>
          </div>
          <p class="body-text" style="font-size:0.88rem;color:var(--stone-light);margin:0 0 12px 0;">
            ${esc(q.explanation || 'Demonstrated verification item on unpracticed stimulus.')}
          </p>
          <button type="button" class="btn btn-primary" id="btn-transfer-next">
            ${this._currentIndex < this._formQuestions.length - 1 ? 'Next Question →' : 'Complete Evaluation →'}
          </button>
        </div>
      `;

      document.getElementById('btn-transfer-next')?.addEventListener('click', () => {
        this._currentIndex++;
        this._renderCurrentQuestion();
      });
    }
  },

  async _renderSummary() {
    const body = document.getElementById('transfer-eval-body');
    if (!body) return;

    const total = this._formQuestions.length;
    const pct = Math.round((this._score / total) * 100);

    // Compute cluster breakdown for this form session
    const responses = this._evaluatedResponses || [];
    const clusterStats = {
      fallacy: { label: '🏛️ Logical Fallacies', correct: 0, total: 0 },
      sift: { label: '🔍 SIFT Methodology', correct: 0, total: 0 },
      other: { label: '⚔️ Tactics & Biases', correct: 0, total: 0 }
    };

    for (const r of responses) {
      const tests = r.question.tests || [];
      if (tests.some((t) => t.startsWith('skill.fallacy.'))) {
        clusterStats.fallacy.total++;
        if (r.isCorrect) clusterStats.fallacy.correct++;
      } else if (tests.some((t) => t.startsWith('skill.sift.'))) {
        clusterStats.sift.total++;
        if (r.isCorrect) clusterStats.sift.correct++;
      } else {
        clusterStats.other.total++;
        if (r.isCorrect) clusterStats.other.correct++;
      }
    }

    // Compute updated transfer report
    let report = null;
    try {
      const attempts = await AttemptLog.readAll();
      report = transfer(attempts, { halfSize: 3 });
    } catch (e) {
      console.warn('[TransferEval] could not compute transfer report:', e);
    }

    const renderClusterRow = (stat) => {
      if (!stat.total) return '';
      const cPct = Math.round((stat.correct / stat.total) * 100);
      const color = cPct >= 70 ? 'var(--veracity-green,#34d399)' : cPct >= 40 ? 'var(--amber-bright,#fbbf24)' : 'var(--disinfo-crimson,#f87171)';
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:0.85rem;">
          <span style="color:var(--parchment-bright);">${esc(stat.label)}</span>
          <span style="font-family:var(--font-mono);color:${color};font-weight:700;">
            ${stat.correct}/${stat.total} (${cPct}%)
          </span>
        </div>
      `;
    };

    body.innerHTML = `
      <div style="text-align:center;padding:16px 0;">
        <div class="badge badge-intel" style="margin-bottom:8px;">FORM COMPLETED: ${this._mode.toUpperCase()}</div>
        <h2 class="heading-2" style="font-size:2.5rem;font-family:var(--font-mono);color:var(--amber-bright);margin:0;">
          ${this._score} / ${total}
        </h2>
        <div class="status-label text-muted" style="margin-top:4px;">${pct}% ACCURACY ON UNPRACTICED PROBES</div>

        <!-- Session Cluster Breakdown -->
        <div class="card card-granite-inset" style="text-align:left;margin:16px 0;padding:14px 16px;">
          <div class="status-label" style="color:var(--bronze-primary,#d2a64d);margin-bottom:8px;">EVALUATION BATTERY CLUSTER BREAKDOWN</div>
          ${renderClusterRow(clusterStats.fallacy)}
          ${renderClusterRow(clusterStats.sift)}
          ${renderClusterRow(clusterStats.other)}
        </div>

        <div class="card card-granite-inset" style="text-align:left;margin:16px 0;padding:16px;">
          <div class="status-label" style="color:var(--bronze-primary,#d2a64d);margin-bottom:8px;">SCIENTIFIC TRANSFER VERDICT</div>
          <p class="body-text" style="font-size:0.85rem;color:var(--parchment-bright);margin:0 0 8px 0;">
            ${report && report.available
              ? `Demonstrated generalization delta: <strong>${report.delta > 0 ? '+' : ''}${Math.round(report.delta * 100)}%</strong> between early baseline and current held-out performance.`
              : 'Initial baseline probe measurements recorded. Complete regular training modules (SIFT Labs, Fallacy Gauntlet, ACH Matrix) before administering Form T1.'}
          </p>
          ${report && report.available && report.clusters ? `
            <div style="font-size:0.78rem;font-family:var(--font-mono);color:var(--stone-light);margin-top:6px;">
              ${report.clusters.fallacy?.available ? `🏛️ Fallacy Transfer: <strong>${report.clusters.fallacy.delta >= 0 ? '+' : ''}${Math.round(report.clusters.fallacy.delta * 100)}%</strong> &nbsp;&nbsp;` : ''}
              ${report.clusters.sift?.available ? `🔍 SIFT Transfer: <strong>${report.clusters.sift.delta >= 0 ? '+' : ''}${Math.round(report.clusters.sift.delta * 100)}%</strong>` : ''}
            </div>
          ` : ''}
          <p class="body-muted" style="font-size:0.75rem;margin:10px 0 0 0;">
            Within-subject comparison on held-out items. Small n, no control group — this is empirical evidence of cognitive change in you, not a laboratory controlled trial.
          </p>
        </div>

        <button type="button" class="btn btn-primary" id="btn-transfer-eval-done" style="padding:10px 24px;">
          Return to Dashboard
        </button>
      </div>
    `;

    document.getElementById('btn-transfer-eval-done')?.addEventListener('click', () => {
      this.closeModal();
      // Notify application to refresh transfer panel
      window.dispatchEvent(new CustomEvent('aegis:transfer-updated'));
      if (this._app && typeof this._app._renderTransfer === 'function') {
        this._app._renderTransfer();
      }
    });
  },

  closeModal() {
    this._active = false;
    const modal = document.getElementById('transfer-eval-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
      modal.innerHTML = '';
    }
  }
};

export default TransferEval;
