/**
 * SOVEREIGN // AEGIS — Epistemic Memory Vault
 * Mathematical SuperMemo SM-2 Spaced-Repetition Daily Inoculation Engine.
 */

import { recordAttempt, CONTEXTS } from '../attempts.js';
import { Confidence } from '../confidence.js';

/**
 * The four-button self-grade mapped onto SM-2's own 0-5 quality scale. SM-2 treats q < 3 as a
 * lapse (repetitions reset) and q >= 3 as recalled. Button 2 (Hard) maps to q = 3 - "correct,
 * but with difficulty" - which is a PASS in the scheduler: repetitions advance and the interval
 * grows. Recording a quality-2 card as failed in the attempt log while scheduling it as learned
 * would give the app two disagreeing notions of "knew it"; the roadmap's rule is one notion.
 */
const SM2_QUALITY_MAP = { 1: 1, 2: 3, 3: 4, 4: 5 };

export const SpacedRepetition = {
  _app: null,
  _deck: [],
  _activeQueue: [],
  _currentIndex: 0,
  _isRevealed: false,
  _filterDomain: 'all',
  /** When the current card's answer was revealed — latency is time-to-self-grade. */
  _revealedAt: 0,
  /** Certainty claimed before the reveal, so the grade cannot rewrite it. */
  _confidenceAtReveal: null,
  /** The four forced-choice diagnosis options for the current card, before the flip. */
  _diagnosisOptions: [],
  /** The option the operator selected before the flip, or null. */
  _selectedDiagnosis: null,
  /** Whether the demonstrated diagnosis answer for the current card has been recorded. */
  _diagnosisRecorded: false,
  /** When the current card's front was shown — diagnosis latency is shown→reveal. */
  _shownAt: 0,

  async init(app) {
    this._app = app;
    await this._loadDeck();
    this._bindEvents();
    this._updateOverviewBadge();
    console.log('[SpacedRepetition] Initialized.');
  },

  onMount() {
    this._hydrateDeckFromStore();
    this._buildQueue();
    this._renderHUD();
    this._renderReviewState();
  },

  onUnmount() {
    // Cleanup if needed
  },

  async _loadDeck() {
    let baseCards = [];
    try {
      const resp = await fetch('./data/spaced_repetition_cards.json')
        .catch(() => fetch('data/spaced_repetition_cards.json'));
      const parsed = await resp.json();
      baseCards = Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('[SpacedRepetition] Could not load base cards.', e);
    }

    try {
      const stored = this._app.store.get('sm2.deck');
      if (stored) {
        const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
        this._deck = Array.isArray(parsed) ? parsed.filter(c => c && typeof c === 'object' && typeof c.id === 'string' && c.id.trim().length > 0) : [];
      } else {
        const today = new Date().toISOString().split('T')[0];
        this._deck = baseCards.map((card) => ({
          ...card,
          repetitions: 0,
          interval: 0,
          easeFactor: 2.5,
          dueDate: today, // Initially all available for initial inoculation
          lastReviewed: null,
          history: []
        }));
        this._saveDeck();
      }
    } catch (e) {
      console.warn('[SpacedRepetition] Could not load stored deck, using fallback.', e);
      this._deck = [];
    }

    // Re-attach the skill tags from the source data on every load, for both fresh and stored
    // decks. A deck serialised before the content was tagged has no `tests`, and without this
    // its reviews would go unrecorded forever — silently, since a missing attempt looks
    // exactly like an unattempted skill. Re-tagging content is a recompute by design
    // (see js/attemptlog.js), and this is where that recompute lands for SM-2.
    if (baseCards.length && this._deck.length) {
      const tagsById = new Map(baseCards.filter(c => c && c.id).map((c) => [c.id, { tests: c.tests || [], heldOut: c.heldOut === true }]));
      let retagged = 0;
      this._deck = this._deck.filter(c => c && typeof c === 'object' && typeof c.id === 'string').map((c) => {
        const t = tagsById.get(c.id);
        if (!t) return c;
        const changed = JSON.stringify(c.tests || []) !== JSON.stringify(t.tests) || c.heldOut !== t.heldOut;
        if (changed) retagged++;
        return { ...c, tests: t.tests, heldOut: t.heldOut };
      });
      if (retagged) this._saveDeck();
    }
  },

  _hydrateDeckFromStore() {
    try {
      const stored = this._app?.store?.get('sm2.deck');
      if (stored) {
        const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
        if (Array.isArray(parsed)) {
          this._deck = parsed.filter(c => c && typeof c === 'object' && typeof c.id === 'string' && c.id.trim().length > 0);
        }
      }
    } catch (e) {
      console.warn('[SpacedRepetition] Could not re-hydrate deck from store.', e);
    }
  },

  enqueueCards(newCards) {
    const validCards = (Array.isArray(newCards) ? newCards : []).filter(c => c && typeof c === 'object' && typeof c.id === 'string' && c.id.trim().length > 0);
    if (validCards.length === 0) return 0;
    this._hydrateDeckFromStore();

    if (!Array.isArray(this._deck)) {
      this._deck = [];
    }

    const today = new Date().toISOString().split('T')[0];
    let addedCount = 0;
    for (const card of validCards) {
      if (!this._deck.some(c => c && c.id === card.id)) {
        this._deck.unshift({
          repetitions: 0,
          interval: 0,
          easeFactor: 2.5,
          dueDate: today,
          lastReviewed: null,
          history: [],
          ...card
        });
        addedCount++;
      }
    }

    if (addedCount > 0) {
      this._saveDeck();
      this._updateOverviewBadge();
      
      // If currently mounted or in memory view, refresh UI immediately
      if (typeof document !== 'undefined') {
        const memorySubtab = document.getElementById('subtab-memory');
        if (memorySubtab && !memorySubtab.classList.contains('hidden')) {
          this._buildQueue();
          this._renderHUD();
          this._renderReviewState();
        }
      }

      if (this._app?.showToast) {
        this._app.showToast({
          type: 'info',
          title: 'MEMORY VAULT ENQUEUED',
          message: `${addedCount} review card(s) added to your spaced repetition queue.`
        });
      }
    }
    return addedCount;
  },

  _saveDeck() {
    if (this._app?.store) {
      this._app.store.set('sm2.deck', JSON.stringify(this._deck));
    }
    this._updateOverviewBadge();
  },

  _updateOverviewBadge() {
    if (typeof document === 'undefined') return;
    const today = new Date().toISOString().split('T')[0];
    const dueCount = this._deck.filter(c => !c.dueDate || c.dueDate <= today).length;
    
    const overviewBadge = document.getElementById('overview-memory-due-count');
    if (overviewBadge) {
      overviewBadge.textContent = dueCount;
    }
  },

  _buildQueue() {
    const today = new Date().toISOString().split('T')[0];
    let pool = this._deck;

    if (this._filterDomain !== 'all') {
      pool = pool.filter(c => c.domain === this._filterDomain);
    }

    // Sort: Due today first, then learning/repetition 0
    this._activeQueue = pool.filter(c => !c.dueDate || c.dueDate <= today);
    this._currentIndex = 0;
    this._isRevealed = false;
  },

  _calculateSM2(card, quality) {
    let { repetitions, interval, easeFactor } = card;
    const q = SM2_QUALITY_MAP[quality] || 4;

    if (q >= 3) {
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      repetitions++;
    } else {
      repetitions = 0;
      interval = 1;
    }

    // Update Ease Factor
    easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;

    // Calculate next due date
    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + interval);
    const dueDate = nextDue.toISOString().split('T')[0];

    return {
      repetitions,
      interval,
      easeFactor: Number(easeFactor.toFixed(2)),
      dueDate,
      lastReviewed: new Date().toISOString()
    };
  },

  _renderHUD() {
    const today = new Date().toISOString().split('T')[0];
    const dueCount = this._deck.filter(c => !c.dueDate || c.dueDate <= today).length;
    const learningCount = this._deck.filter(c => c.repetitions === 0 && c.lastReviewed).length;
    const matureCount = this._deck.filter(c => c.interval >= 21).length;

    // Calculate Retention Index (% of non-again reviews)
    let totalReviews = 0;
    let successfulReviews = 0;
    this._deck.forEach(c => {
      if (Array.isArray(c.history)) {
        c.history.forEach(h => {
          totalReviews++;
          if (h >= 2) successfulReviews++;
        });
      }
    });
    const retention = totalReviews > 0 ? Math.round((successfulReviews / totalReviews) * 100) : 100;

    const dueEl = document.getElementById('sm2-hud-due');
    const learningEl = document.getElementById('sm2-hud-learning');
    const matureEl = document.getElementById('sm2-hud-mature');
    const retentionEl = document.getElementById('sm2-hud-retention');

    if (dueEl) dueEl.textContent = dueCount;
    if (learningEl) learningEl.textContent = learningCount;
    if (matureEl) matureEl.textContent = matureCount;
    if (retentionEl) retentionEl.textContent = `${retention}%`;

    this._updateOverviewBadge();
  },

  _renderReviewState() {
    const reviewView = document.getElementById('sm2-review-view');
    const clearView = document.getElementById('sm2-clear-view');

    if (this._activeQueue.length === 0 || this._currentIndex >= this._activeQueue.length) {
      reviewView?.classList.add('hidden');
      clearView?.classList.remove('hidden');
      return;
    }

    reviewView?.classList.remove('hidden');
    clearView?.classList.add('hidden');

    const card = this._activeQueue[this._currentIndex];
    this._isRevealed = false;
    this._shownAt = Date.now();
    Confidence.mount(document.getElementById('sm2-confidence-host'), {
      label: 'BEFORE YOU LOOK — WILL YOU GET THIS?'
    });
    this._renderDiagnosisOptions(card);

    // Update Progress
    const progressEl = document.getElementById('sm2-card-progress');
    const domainBadge = document.getElementById('sm2-card-domain');
    const intervalBadge = document.getElementById('sm2-card-interval');

    if (progressEl) progressEl.textContent = `${this._currentIndex + 1} / ${this._activeQueue.length}`;
    if (domainBadge) domainBadge.textContent = card.domain.toUpperCase();
    if (intervalBadge) {
      intervalBadge.textContent = card.interval === 0 ? 'STATUS: NEW' : `INTERVAL: ${card.interval}d (EF: ${card.easeFactor})`;
    }

    // Render Front
    const promptText = document.getElementById('sm2-card-prompt-text');
    if (promptText) promptText.textContent = card.prompt;

    // Reset Back
    const backBox = document.getElementById('sm2-card-back');
    const revealWrapper = document.getElementById('sm2-reveal-wrapper');
    backBox?.classList.add('hidden');
    revealWrapper?.classList.remove('hidden');

    // Populate Back content
    const titleEl = document.getElementById('sm2-card-diagnosis-title');
    const latinEl = document.getElementById('sm2-card-latin');
    const mechEl = document.getElementById('sm2-card-mechanism');
    const countEl = document.getElementById('sm2-card-countermeasure');

    if (titleEl) titleEl.textContent = card.diagnosis;
    if (latinEl) latinEl.textContent = card.latin ? `(${card.latin})` : '';
    if (mechEl) mechEl.textContent = card.mechanism;
    if (countEl) countEl.textContent = card.countermeasure;

    // Preview next interval badges
    const hardInterval = Math.max(1, Math.round(card.interval * 1.2));
    const goodInterval = card.repetitions === 0 ? 1 : card.repetitions === 1 ? 6 : Math.round(card.interval * card.easeFactor);
    const easyInterval = Math.round(goodInterval * 1.3);

    const hardEl = document.getElementById('sm2-interval-hard');
    const goodEl = document.getElementById('sm2-interval-good');
    const easyEl = document.getElementById('sm2-interval-easy');

    if (hardEl) hardEl.textContent = `${hardInterval}d`;
    if (goodEl) goodEl.textContent = `${goodInterval}d`;
    if (easyEl) easyEl.textContent = `${easyInterval}d`;
  },

  /**
   * Build the four answer-before-reveal options: the card's own diagnosis plus three distractors
   * drawn from the OTHER cards' `diagnosis` fields (which already exist, so this costs no new
   * content). Deterministic per card id — re-encountering a card must not reshuffle the options
   * mid-thought — and padded from a small static list only if the deck is too thin to supply three
   * distractors.
   * @private
   */
  _buildDiagnosisOptions(card) {
    const answer = typeof card.diagnosis === 'string' && card.diagnosis ? card.diagnosis : '';
    const distractors = [];
    for (const c of this._deck) {
      if (distractors.length >= 3) break;
      const d = c && typeof c.diagnosis === 'string' ? c.diagnosis : '';
      if (d && d !== answer && !distractors.includes(d)) distractors.push(d);
    }
    const FALLBACK = [
      'Ad Hominem (Argumentum ad Hominem)',
      'Straw Man (Ignoratio Elenchi)',
      'False Dilemma (Bifurcation)',
      'Slippery Slope',
      'Confirmation Bias',
      'Appeal to Authority',
      'Hasty Generalisation',
      'Circular Reasoning (Begging the Question)'
    ];
    for (const f of FALLBACK) {
      if (distractors.length >= 3) break;
      if (f !== answer && !distractors.includes(f)) distractors.push(f);
    }

    // Deterministic shuffle (high bits of an LCG, seeded by card id) so the same card always
    // presents the same option order.
    let seed = 0;
    const key = String(card.id || '');
    for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) & 0x7fffffff;
    const next = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    next(); next();
    const options = [answer, ...distractors];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return options.filter((o) => o);
  },

  /** Render the diagnosis options for the current card, clearing any previous selection. */
  _renderDiagnosisOptions(card) {
    const host = document.getElementById('sm2-diagnosis-choices');
    if (!host) return;
    this._diagnosisOptions = this._buildDiagnosisOptions(card);
    this._selectedDiagnosis = null;
    this._diagnosisRecorded = false;
    host.innerHTML = '';
    for (const text of this._diagnosisOptions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-outline sm2-diagnosis-btn';
      btn.style.cssText = 'text-align:left;justify-content:flex-start;padding:8px 12px;font-size:0.82rem;';
      // textContent only — the option text is deck content, never trusted as markup.
      btn.textContent = text;
      btn.addEventListener('click', () => this._selectDiagnosis(text, btn));
      host.appendChild(btn);
    }
  },

  /** Mark one diagnosis option as selected (exclusive). Locked once the answer is revealed. */
  _selectDiagnosis(text, btn) {
    if (this._isRevealed) return;
    this._selectedDiagnosis = text;
    const host = document.getElementById('sm2-diagnosis-choices');
    host?.querySelectorAll('.sm2-diagnosis-btn').forEach((b) => {
      const on = b === btn;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.style.borderColor = on ? 'var(--bronze-primary)' : '';
      b.style.background = on ? 'rgba(210, 166, 77, 0.12)' : '';
    });
  },

  /**
   * Record the demonstrated diagnosis answer, if one was made. This is the strong evidence the
   * plain self-grade is not: a forced choice scored against the card's actual diagnosis, with its
   * `chosen` option feeding the confusion matrix. The self-grade is still recorded separately at
   * grade time, so the gap between demonstrated and felt recall stays distinguishable in the data
   * (contexts 'sm2-diagnosis' vs 'sm2').
   * @private
   */
  _recordDiagnosisAttempt() {
    const card = this._activeQueue[this._currentIndex];
    if (!card || !this._selectedDiagnosis || this._diagnosisRecorded) return;
    this._diagnosisRecorded = true;
    recordAttempt({
      skillIds: card.tests,
      itemId: `${card.id}#diagnosis`,
      correct: this._selectedDiagnosis === card.diagnosis,
      context: CONTEXTS.SM2_DIAGNOSIS,
      latencyMs: this._shownAt ? Math.max(0, this._revealedAt - this._shownAt) : null,
      heldOut: card.heldOut === true,
      confidence: this._confidenceAtReveal,
      chosen: this._selectedDiagnosis
    });
    this._revealDiagnosisOutcome(card);
  },

  /** Lock and grade the diagnosis options now that the answer is visible. */
  _revealDiagnosisOutcome(card) {
    const host = document.getElementById('sm2-diagnosis-choices');
    if (!host) return;
    host.querySelectorAll('.sm2-diagnosis-btn').forEach((b) => {
      b.disabled = true;
      if (b.textContent === card.diagnosis) {
        b.style.borderColor = 'var(--veracity-green)';
        b.style.background = 'rgba(74,222,128,0.12)';
      } else if (b.textContent === this._selectedDiagnosis) {
        b.style.borderColor = 'var(--disinfo-crimson)';
        b.style.background = 'rgba(239,68,68,0.12)';
      }
    });
  },

  revealAnswer() {
    if (this._isRevealed) return;
    this._isRevealed = true;
    this._revealedAt = Date.now();
    // Freeze what the operator claimed BEFORE seeing the answer. Reading the live control at
    // grade time instead would let a confidence set after the reveal be scored as a prediction,
    // which is exactly the hindsight this arrangement exists to prevent.
    this._confidenceAtReveal = Confidence.current();

    this._recordDiagnosisAttempt();

    document.getElementById('sm2-card-back')?.classList.remove('hidden');
    document.getElementById('sm2-reveal-wrapper')?.classList.add('hidden');
  },

  /**
   * Map a SM-2 self-grade onto the binary the estimator needs.
   *
   * Again(1) → not recalled; Hard(2)/Good(3)/Easy(4) → recalled. The boundary is SM-2's
   * own lapse boundary (q < 3 is a lapse, q >= 3 is recalled) applied AFTER the button-to-quality
   * mapping: Hard is SM-2 quality 3, a pass — the scheduler advances its repetitions and grows its
   * interval. Recording it as a failure in the attempt log would give the app two disagreeing
   * notions of "knew it" — one mapping, one notion.
   *
   * Worth being explicit that this is WEAKER EVIDENCE than an Arena answer: the operator
   * grades themselves, so it measures felt recall, not demonstrated recall. It is recorded
   * with its own context ('sm2') precisely so that distinction survives in the data and can
   * be weighted differently later.
   *
   * @param {number} quality 1–4
   * @returns {boolean}
   */
  _qualityToCorrect(quality) {
    const q = SM2_QUALITY_MAP[Number(quality)];
    return Number.isInteger(q) ? q >= 3 : false;
  },

  rateCard(quality) {
    if (!this._isRevealed || this._currentIndex >= this._activeQueue.length) return;

    const currentCard = this._activeQueue[this._currentIndex];
    const sm2Result = this._calculateSM2(currentCard, quality);

    recordAttempt({
      skillIds: currentCard.tests,
      itemId: currentCard.id,
      correct: this._qualityToCorrect(quality),
      context: CONTEXTS.SM2,
      latencyMs: this._revealedAt ? Math.max(0, Date.now() - this._revealedAt) : null,
      heldOut: currentCard.heldOut === true,
      confidence: this._confidenceAtReveal
    });
    this._revealedAt = 0;
    this._confidenceAtReveal = null;

    // Update Card in master deck
    const deckIdx = this._deck.findIndex(c => c.id === currentCard.id);
    if (deckIdx !== -1) {
      if (!Array.isArray(this._deck[deckIdx].history)) this._deck[deckIdx].history = [];
      this._deck[deckIdx].history.push(quality);
      
      this._deck[deckIdx] = {
        ...this._deck[deckIdx],
        ...sm2Result
      };
      this._saveDeck();
    }

    // If rated 'Again' (1), push to end of active queue for immediate relearning
    if (quality === 1) {
      this._activeQueue.push(this._deck[deckIdx]);
    }

    this._currentIndex++;
    this._renderHUD();
    this._renderReviewState();
  },

  _bindEvents() {
    // Reveal button
    document.getElementById('btn-sm2-reveal')?.addEventListener('click', () => this.revealAnswer());

    // Rating buttons
    document.querySelectorAll('.sm2-rate-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const quality = parseInt(btn.getAttribute('data-quality') || '3', 10);
        this.rateCard(quality);
      });
    });

    // Review Ahead / Clear view button
    document.getElementById('btn-sm2-review-ahead')?.addEventListener('click', () => {
      this._activeQueue = [...this._deck];
      this._currentIndex = 0;
      this._renderReviewState();
    });

    // Command Center link button
    document.getElementById('btn-goto-memory-queue')?.addEventListener('click', () => {
      this._app.switchTab('cognitive', 'memory');
    });

    // Modal triggers
    const modal = document.getElementById('sm2-custom-modal');
    const openBtn = document.getElementById('btn-sm2-open-creator');
    const openBtnClear = document.getElementById('btn-sm2-open-creator-clear');
    const closeBtn = document.getElementById('btn-sm2-close-modal');
    const cancelBtn = document.getElementById('btn-sm2-cancel-modal');
    const saveBtn = document.getElementById('btn-sm2-save-card');

    const toggleModal = (show) => {
      if (modal) {
        if (show) modal.classList.remove('hidden');
        else modal.classList.add('hidden');
      }
    };

    openBtn?.addEventListener('click', () => toggleModal(true));
    openBtnClear?.addEventListener('click', () => toggleModal(true));
    closeBtn?.addEventListener('click', () => toggleModal(false));
    cancelBtn?.addEventListener('click', () => toggleModal(false));

    saveBtn?.addEventListener('click', () => {
      const domain = document.getElementById('input-sm2-domain')?.value || 'Logical Fallacy';
      const prompt = document.getElementById('input-sm2-prompt')?.value?.trim();
      const title = document.getElementById('input-sm2-title')?.value?.trim();
      const latin = document.getElementById('input-sm2-latin')?.value?.trim() || '';
      const mechanism = document.getElementById('input-sm2-mechanism')?.value?.trim();
      const countermeasure = document.getElementById('input-sm2-countermeasure')?.value?.trim();

      if (!prompt || !title || !mechanism || !countermeasure) {
        this._app?.showToast({ type: 'danger', title: 'FIELDS INCOMPLETE', message: 'Please fill in prompt, diagnosis, mechanism, and countermeasure.' });
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const newCard = {
        id: 'card-custom-' + Date.now(),
        domain,
        prompt,
        diagnosis: title,
        latin,
        mechanism,
        countermeasure,
        repetitions: 0,
        interval: 0,
        easeFactor: 2.5,
        dueDate: today,
        lastReviewed: null,
        history: []
      };

      this._deck.unshift(newCard);
      this._saveDeck();
      toggleModal(false);

      this._app?.showToast({ type: 'success', title: 'CARD ADDED', message: `Added "${title}" to Memory Vault.` });
      this._buildQueue();
      this._renderHUD();
      this._renderReviewState();
    });

    // Pin Card to Dossier
    document.getElementById('btn-sm2-pin-card')?.addEventListener('click', () => {
      if (this._currentIndex < this._activeQueue.length) {
        const c = this._activeQueue[this._currentIndex];
        window.dispatchEvent(new CustomEvent('aegis:pin', {
          detail: {
            source: 'Epistemic Memory Vault',
            title: `Card: ${c.diagnosis} [${c.domain}]`,
            content: `SCENARIO PROMPT:\n"${c.prompt}"\n\nDIAGNOSIS: ${c.diagnosis} (${c.latin || 'N/A'})\n\nMECHANISM:\n${c.mechanism}\n\nTACTICAL COUNTERMEASURE:\n${c.countermeasure}`
          }
        }));
      }
    });

    // Live Event Listener for SIFT Labs Card Enqueue
    window.addEventListener('aegis:sift-cards', (e) => {
      const cards = e.detail?.cards;
      if (Array.isArray(cards) && cards.length > 0) {
        this.enqueueCards(cards);
      }
    });

    // Domain Filter Button
    const filterBtn = document.getElementById('btn-sm2-filter-all');
    if (filterBtn) {
      const domains = ['all', 'Logical Fallacy', 'Cognitive Bias', 'SIFT Verification', 'AI Media Forensics'];
      filterBtn.addEventListener('click', () => {
        const currentIdx = domains.indexOf(this._filterDomain);
        const nextIdx = (currentIdx + 1) % domains.length;
        this._filterDomain = domains[nextIdx];
        filterBtn.textContent = `Filter: ${this._filterDomain === 'all' ? 'All Domains' : this._filterDomain} ▾`;
        this._buildQueue();
        this._renderHUD();
        this._renderReviewState();
      });
    }

    // Keyboard Shortcuts (Space = Reveal, 1/2/3/4 = Rate)
    window.addEventListener('keydown', (e) => {
      const memoryView = document.getElementById('subtab-memory');
      if (!memoryView || memoryView.classList.contains('hidden')) return;

      if (e.code === 'Space' && !this._isRevealed) {
        e.preventDefault();
        this.revealAnswer();
      } else if (this._isRevealed && ['1', '2', '3', '4'].includes(e.key)) {
        this.rateCard(parseInt(e.key, 10));
      }
    });
  }
};
