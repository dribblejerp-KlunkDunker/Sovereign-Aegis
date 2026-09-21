/**
 * SOVEREIGN // AEGIS — The Rhetorical Sandbox
 * Interactive Premise-Conclusion Dissector, Syllogism Inspector, Enthymeme Deduction & Socratic Steel-Manning Bench.
 */

import { esc } from '../security.js';
import { recordAttempt, CONTEXTS } from '../attempts.js';
import { Confidence } from '../confidence.js';

export const RhetoricalSandbox = {
  _app: null,
  _arguments: [],
  _currentArg: null,
  _activeTagMode: 'premise', // 'premise' | 'conclusion'
  _userClauseTags: {}, // { clauseId: 'premise' | 'conclusion' }
  _isCustom: false,
  /** Which (argument, clause) pairs have already been recorded, so re-verifying is idempotent. */
  _recordedClauses: new Set(),

  // Interactive Enthymeme Deduction State
  _selectedEnthymemeIdx: null,
  _enthymemeOptions: [], // Array of { text: string, isCorrect: boolean }
  _enthymemeSubmitted: false,
  _enthymemeUnlocked: false,

  // Interactive Socratic Steel-Manning State
  _selectedSteelmanOptionIdx: null,
  _steelmanExercise: null,
  _steelmanOptions: [], // Array of { text: string, isCorrect: boolean }
  _steelmanSubmitted: false,

  async init(app) {
    this._app = app;
    await this._loadData();
    this._bindEvents();
    console.log('[RhetoricalSandbox] Initialized.');
  },

  onMount() {
    this._renderPresetSelect();
    if (this._arguments.length > 0 && !this._currentArg) {
      // Check if state exists in store
      const storedState = this._app?.store?.get('rhetoric.state');
      if (storedState?.activeArgId && !storedState.isCustom) {
        this.loadArgument(storedState.activeArgId);
      } else {
        this.loadArgument(this._arguments[0].id);
      }
    }
  },

  onUnmount() {
    // Teardown if necessary
  },

  _saveState() {
    if (this._app?.store && this._currentArg) {
      this._app.store.set('rhetoric.state', {
        activeArgId: this._currentArg.id,
        isCustom: this._isCustom,
        userClauseTags: this._userClauseTags,
        enthymemeUnlocked: this._enthymemeUnlocked,
        enthymemeSubmitted: this._enthymemeSubmitted,
        selectedEnthymemeIdx: this._selectedEnthymemeIdx,
        steelmanSubmitted: this._steelmanSubmitted,
        selectedSteelmanOptionIdx: this._selectedSteelmanOptionIdx
      });
    }
  },

  _getAssumptionObj(arg) {
    if (!arg) return { text: '', distractors: [], explanation: '' };
    if (typeof arg.unstatedAssumption === 'object' && arg.unstatedAssumption !== null) {
      return arg.unstatedAssumption;
    }
    return {
      text: typeof arg.unstatedAssumption === 'string' ? arg.unstatedAssumption : '',
      distractors: [
        'Premises are universally true across all possible domains.',
        'Alternative interpretations have zero empirical support.',
        'The authority quoted is infallible and beyond question.'
      ],
      explanation: 'The unstated premise required to bridge the empirical premises to the ultimate policy conclusion.'
    };
  },

  _getSteelmanObj(arg) {
    if (!arg) return { text: '', improvements: [], exercises: [] };
    if (typeof arg.steelMannedVersion === 'object' && arg.steelMannedVersion !== null) {
      return arg.steelMannedVersion;
    }
    return {
      text: typeof arg.steelMannedVersion === 'string' ? arg.steelMannedVersion : '',
      improvements: [
        'Eliminates categorical overreach',
        'Substitutes risk mitigation benchmarks for deterministic doom',
        'Establishes testable capability boundaries'
      ],
      exercises: []
    };
  },

  _shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  async _loadData() {
    try {
      const resp = await fetch('./data/rhetorical_arguments.json')
        .catch(() => fetch('data/rhetorical_arguments.json'));
      const data = await resp.json();
      this._arguments = Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn('[RhetoricalSandbox] Could not load rhetorical_arguments.json, using fallback data.', e);
      this._arguments = [
        {
          id: 'arg-ai-risk',
          title: 'Autonomous AI Existential Ban Argument',
          domain: 'Artificial Intelligence & Tech Ethics',
          difficulty: 'Intermediate',
          rawText: 'Artificial intelligence systems are advancing faster than our regulatory mechanisms. Any technology that advances faster than regulation will inevitably escape human oversight and cause catastrophic harm. Therefore, all research into autonomous neural architectures must be banned immediately by international treaty.',
          clauses: [
            { id: 'c1', text: 'Artificial intelligence systems are advancing faster than our regulatory mechanisms.', type: 'premise', label: 'Premise 1' },
            { id: 'c2', text: 'Any technology that advances faster than regulation will inevitably escape human oversight and cause catastrophic harm.', type: 'premise', label: 'Premise 2' },
            { id: 'c3', text: 'Therefore, all research into autonomous neural architectures must be banned immediately by international treaty.', type: 'conclusion', label: 'Conclusion' }
          ],
          unstatedAssumption: {
            text: 'Prohibition treaties can be globally enforced with 100% compliance without driving dangerous research underground or ceding geopolitical asymmetry.',
            distractors: [
              'Artificial neural architectures possess subjective consciousness.',
              'Regulatory bodies lack computation hardware.',
              'Traditional legal frameworks have halted all historical technological advancements.'
            ],
            explanation: 'Moves from pace differential to immediate global ban without proving prohibition is enforceable.'
          },
          structuralFlaw: {
            name: 'False Dilemma / Slippery Slope',
            latin: 'Argumentum ad Consequentiam',
            category: 'Informal / Deductive Overreach',
            analysis: 'Premise 2 establishes an unsupported universal deterministic claim and leaps from a pace differential directly to global catastrophe.'
          },
          steelMannedVersion: {
            text: 'Because frontier AI capability growth outpaces traditional rulemaking, high-leverage safety protocols, compute governance, and international benchmarks must be instituted.',
            improvements: [
              'Replaces absolute prohibition with compute governance',
              'Substitutes deterministic doom with risk mitigation'
            ],
            exercises: [
              {
                id: 'ex-ai-risk-1',
                prompt: 'Which reformulation represents the strongest philosophical steel-man?',
                options: [
                  'Banning all microcontrollers.',
                  'Establishing staged capability thresholds and compute auditing.',
                  'Allowing unrestricted deployment with retrospective insurance.',
                  'Passing symbolic voluntary guidelines.'
                ],
                correctIndex: 1,
                rationale: 'Staged thresholds provide verifiable governance.'
              }
            ]
          },
          counterArgument: 'A total blanket ban is practically unenforceable and halts defensive alignment research. A targeted capability-threshold governance framework provides enforceable friction.',
          tests: ['skill.fallacy.structure'],
          heldOut: false
        }
      ];
    }
  },

  _bindEvents() {
    if (typeof document === 'undefined') return;

    // Preset dropdown change
    const presetSelect = document.getElementById('select-sandbox-preset');
    if (presetSelect) {
      presetSelect.addEventListener('change', (e) => {
        const id = e.target.value;
        if (id) {
          this._isCustom = false;
          this.loadArgument(id);
        }
      });
    }

    // Custom Mode Toggle
    const btnCustom = document.getElementById('btn-sandbox-custom-mode');
    const customCard = document.getElementById('sandbox-custom-input-card');
    const btnCancel = document.getElementById('btn-sandbox-custom-cancel');
    const btnLoadCustom = document.getElementById('btn-sandbox-custom-load');

    if (btnCustom && customCard) {
      btnCustom.addEventListener('click', () => {
        customCard.classList.toggle('hidden');
      });
    }

    if (btnCancel && customCard) {
      btnCancel.addEventListener('click', () => {
        customCard.classList.add('hidden');
      });
    }

    if (btnLoadCustom) {
      btnLoadCustom.addEventListener('click', () => {
        const text = document.getElementById('textarea-sandbox-custom')?.value?.trim();
        if (text) {
          this.loadCustomArgument(text);
          customCard?.classList.add('hidden');
        }
      });
    }

    // Tag selector buttons
    const tagBtns = document.querySelectorAll('.tag-selector-btn');
    tagBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tagBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._activeTagMode = btn.getAttribute('data-tag') || 'premise';
      });
    });

    // Verification button
    const confidenceHost = document.getElementById('sandbox-confidence-host');
    if (confidenceHost) {
      Confidence.mount(confidenceHost, {
        label: 'HOW SURE ARE YOU OF THIS DECOMPOSITION?'
      });
    }

    const btnValidate = document.getElementById('btn-validate-clause-tags');
    if (btnValidate) {
      btnValidate.addEventListener('click', () => this._validateUserTags());
    }

    // Enthymeme Submit Button
    const btnSubmitEnthymeme = document.getElementById('btn-submit-enthymeme');
    if (btnSubmitEnthymeme) {
      btnSubmitEnthymeme.addEventListener('click', () => this._submitEnthymemeDeduction());
    }

    // Socratic Steel-Manning Submit Button
    const btnSubmitSteelman = document.getElementById('btn-submit-steelman-exercise');
    if (btnSubmitSteelman) {
      btnSubmitSteelman.addEventListener('click', () => this._submitSteelmanExercise());
    }

    // Hidden assumption toggle (fallback compatibility)
    const btnToggleAssumption = document.getElementById('btn-toggle-assumption');
    const assumptionText = document.getElementById('sandbox-assumption-text');
    if (btnToggleAssumption && assumptionText) {
      btnToggleAssumption.addEventListener('click', () => {
        const isHidden = assumptionText.classList.contains('hidden');
        if (isHidden) {
          assumptionText.classList.remove('hidden');
          btnToggleAssumption.textContent = 'Hide';
        } else {
          assumptionText.classList.add('hidden');
          btnToggleAssumption.textContent = 'Reveal';
        }
      });
    }

    // Pin to Dossier
    const btnPin = document.getElementById('btn-sandbox-pin');
    if (btnPin) {
      btnPin.addEventListener('click', () => this._pinToDossier());
    }

    // Copy Syllogism Breakdown
    const btnCopy = document.getElementById('btn-sandbox-copy');
    if (btnCopy) {
      btnCopy.addEventListener('click', () => this._copyBreakdown());
    }
  },

  _renderPresetSelect() {
    if (typeof document === 'undefined') return;
    const select = document.getElementById('select-sandbox-preset');
    if (!select || this._arguments.length === 0) return;

    select.innerHTML = '<option value="">-- Load Curated Argument Preset --</option>' +
      this._arguments.map(arg => `<option value="${esc(arg.id)}">${esc(arg.title)} [${esc(arg.domain)}]</option>`).join('');
  },

  loadArgument(argId) {
    const arg = this._arguments.find(a => a.id === argId);
    if (!arg) return;

    this._currentArg = arg;
    this._isCustom = false;
    this._userClauseTags = {};
    // Reloading an argument is a fresh attempt at it, so let its clauses be recorded again.
    for (const key of [...this._recordedClauses]) {
      if (key.startsWith(`${arg.id}#`)) this._recordedClauses.delete(key);
    }

    if (typeof document !== 'undefined') {
      const select = document.getElementById('select-sandbox-preset');
      if (select && select.value !== argId) {
        select.value = argId;
      }

      const domainBadge = document.getElementById('sandbox-arg-domain');
      if (domainBadge) {
        domainBadge.textContent = arg.domain.toUpperCase();
      }

      const feedback = document.getElementById('sandbox-tag-feedback');
      if (feedback) {
        feedback.classList.add('hidden');
        feedback.innerHTML = '';
      }

      const assumptionText = document.getElementById('sandbox-assumption-text');
      const btnToggleAssumption = document.getElementById('btn-toggle-assumption');
      if (assumptionText && btnToggleAssumption) {
        const assumpObj = this._getAssumptionObj(arg);
        assumptionText.classList.add('hidden');
        btnToggleAssumption.textContent = 'Reveal';
        assumptionText.textContent = assumpObj.text || 'No unstated assumption specified.';
      }
    }

    // Render Clauses for Tagging
    this._renderClauses(arg.clauses);

    // Render Initial Syllogism Flow & Diagnostics
    this._renderSyllogismChain(arg.clauses, false);
    this._renderDiagnostics(arg);

    // Initialize & Render Enthymeme Drill
    this._initEnthymeme(arg);
    this._renderEnthymemeDrill();

    // Initialize & Render Steelman Engine
    this._initSteelman(arg);
    this._renderSteelman(arg);

    this._saveState();
  },

  loadCustomArgument(rawText) {
    // Split sentences heuristically into clauses
    const sentences = rawText.match(/[^.!?]+[.!?]+|\s*[^.!?]+$/g) || [rawText];
    const clauses = sentences.map((s, idx) => {
      const clean = s.trim();
      const isLast = idx === sentences.length - 1;
      return {
        id: `custom_c${idx + 1}`,
        text: clean,
        type: isLast ? 'conclusion' : 'premise',
        label: isLast ? 'Conclusion (Inferred)' : `Premise ${idx + 1} (Inferred)`
      };
    }).filter(c => c.text.length > 0);

    const customArg = {
      id: 'custom_' + Date.now(),
      title: 'Custom Ingested Argument',
      domain: 'User-Provided Argument',
      difficulty: 'Custom',
      rawText: rawText,
      clauses: clauses,
      unstatedAssumption: {
        text: 'Analyze the gap between stated premises and final conclusion to discover hidden enthymemes.',
        distractors: [
          'All premises are completely independent with zero logical relation.',
          'The conclusion is guaranteed true regardless of premise validity.',
          'Informal fallacies do not apply to custom user arguments.'
        ],
        explanation: 'Examine whether the conclusion logically follows without introducing unstated empirical or normative claims.'
      },
      structuralFlaw: {
        name: 'Heuristic Inference Review',
        latin: 'Examen Structurale',
        category: 'Custom Syllogism',
        analysis: 'Verify if premises provide necessary and sufficient conditions to logically deduce the conclusion without unstated normative leaps.'
      },
      steelMannedVersion: {
        text: 'Reformulate the strongest empirical claims of this premise set to eliminate rhetorical excess and define precise scope boundaries.',
        improvements: [
          'Isolates core empirical claims from emotional framing',
          'Establishes explicit boundary conditions',
          'Tests deductive validity and inductive strength'
        ],
        exercises: [
          {
            id: 'ex-custom-1',
            prompt: 'What is the primary objective of steel-manning a custom user argument?',
            options: [
              'To reconstruct the strongest possible version of the thesis before testing its validity.',
              'To dismiss the argument as invalid without examining its premises.',
              'To replace the argument with an entirely unrelated topic.',
              'To prove that all conclusions are subjective opinions.'
            ],
            correctIndex: 0,
            rationale: 'Steel-manning strengthens the opponent position to avoid straw-man fallacies and test the genuine core thesis.'
          }
        ]
      },
      counterArgument: 'Identify weak inductive links or unverified factual assertions within the premise structure.',
      tests: ['skill.fallacy.structure'],
      heldOut: false
    };

    this._currentArg = customArg;
    this._isCustom = true;
    this._userClauseTags = {};

    if (typeof document !== 'undefined') {
      const domainBadge = document.getElementById('sandbox-arg-domain');
      if (domainBadge) domainBadge.textContent = 'CUSTOM WORKBENCH';
    }

    this._renderClauses(clauses);
    this._renderSyllogismChain(clauses, true);
    this._renderDiagnostics(customArg);

    this._initEnthymeme(customArg);
    this._renderEnthymemeDrill();

    this._initSteelman(customArg);
    this._renderSteelman(customArg);

    this._app?.showToast?.({
      type: 'info',
      title: 'ARGUMENT INGESTED',
      message: `Parsed into ${clauses.length} clause blocks.`
    });

    this._saveState();
  },

  _renderClauses(clauses) {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('sandbox-clauses-container');
    if (!container) return;

    container.innerHTML = clauses.map(c => {
      const userTag = this._userClauseTags[c.id];
      let tagClass = '';
      let pillText = 'Click to Tag';
      let pillClass = 'unassigned';

      if (userTag === 'premise') {
        tagClass = 'tagged-premise';
        pillText = 'Premise';
        pillClass = 'premise';
      } else if (userTag === 'conclusion') {
        tagClass = 'tagged-conclusion';
        pillText = 'Conclusion';
        pillClass = 'conclusion';
      }

      return `
        <div class="sandbox-clause-item ${esc(tagClass)}" data-clause-id="${esc(c.id)}">
          <span class="sandbox-tag-pill ${esc(pillClass)}">${esc(pillText)}</span>
          <span>"${esc(c.text)}"</span>
        </div>
      `;
    }).join('');

    // Bind click on clause items
    container.querySelectorAll('.sandbox-clause-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-clause-id');
        if (!id) return;

        // Toggle tag with current activeTagMode
        if (this._userClauseTags[id] === this._activeTagMode) {
          delete this._userClauseTags[id];
        } else {
          this._userClauseTags[id] = this._activeTagMode;
        }

        this._renderClauses(this._currentArg.clauses);
        this._saveState();
      });
    });
  },

  _validateUserTags() {
    if (!this._currentArg) return;
    const feedback = typeof document !== 'undefined' ? document.getElementById('sandbox-tag-feedback') : null;

    const total = this._currentArg.clauses.length;
    let correctCount = 0;
    let taggedCount = Object.keys(this._userClauseTags).length;

    if (taggedCount === 0) {
      if (feedback) {
        feedback.classList.remove('hidden');
        feedback.style.background = 'rgba(248, 113, 113, 0.1)';
        feedback.style.border = '1px solid var(--suspicion-border, #f87171)';
        feedback.style.color = 'var(--suspicion-text, #fca5a5)';
        feedback.innerHTML = '<strong>No tags assigned.</strong> Click each clause above to tag it as a Premise or Conclusion before verifying.';
      }
      return;
    }

    this._currentArg.clauses.forEach(c => {
      const tagged = this._userClauseTags[c.id];
      const isCorrect = tagged === c.type;
      if (isCorrect) correctCount++;

      const key = `${this._currentArg.id}#${c.id}`;
      if (tagged && !this._recordedClauses.has(key)) {
        this._recordedClauses.add(key);
        const skillIds = Array.isArray(this._currentArg.tests) && this._currentArg.tests.length > 0
          ? this._currentArg.tests
          : ['skill.fallacy.structure'];

        recordAttempt({
          skillIds,
          itemId: key,
          correct: isCorrect,
          context: CONTEXTS.SANDBOX,
          latencyMs: null,
          heldOut: this._currentArg.heldOut === true
        });
      }
    });

    const rhetoricStats = this._app?.store?.get('rhetoric.stats') || {
      clausesTagged: 0, clausesCorrect: 0, enthymemesAttempted: 0, enthymemesCorrect: 0, steelmansCompleted: 0
    };
    rhetoricStats.clausesTagged += taggedCount;
    rhetoricStats.clausesCorrect += correctCount;
    this._app?.store?.set('rhetoric.stats', rhetoricStats);

    const isPerfect = correctCount === total && taggedCount === total;
    if (feedback) {
      feedback.classList.remove('hidden');
      if (isPerfect) {
        feedback.style.background = 'rgba(74, 222, 128, 0.1)';
        feedback.style.border = '1px solid var(--veracity-border, #4ade80)';
        feedback.style.color = 'var(--veracity-text, #86efac)';
        feedback.innerHTML = `<strong>Accurate Decomposition (${esc(correctCount)}/${esc(total)}).</strong> You correctly identified all premise structures and the operative conclusion.`;
      } else {
        feedback.style.background = 'rgba(210, 166, 77, 0.12)';
        feedback.style.border = '1px solid var(--bronze-mid)';
        feedback.style.color = 'var(--parchment-bright)';
        feedback.innerHTML = `<strong>Partial Match (${esc(correctCount)}/${esc(total)} correct).</strong> Review indicators like <em>"Therefore"</em>, <em>"Thus"</em>, or <em>"Consequently"</em> for conclusions, and empirical assertions for premises.`;
      }
    }
    this._renderSyllogismChain(this._currentArg.clauses, true);
  },

  _renderSyllogismChain(clauses, showLabels) {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('sandbox-syllogism-chain');
    if (!container) return;

    let html = '';
    const premises = clauses.filter(c => c.type === 'premise');
    const conclusions = clauses.filter(c => c.type === 'conclusion');

    premises.forEach((p, idx) => {
      html += `
        <div class="syllogism-node premise">
          <div class="status-label text-bronze" style="font-size: 0.7rem;">PREMISE ${esc(idx + 1)}</div>
          <div>${esc(p.text)}</div>
        </div>
      `;
      if (idx < premises.length - 1) {
        html += `<div class="syllogism-connector">+ (CONJUNCTION)</div>`;
      }
    });

    html += `<div class="syllogism-connector">⇓ [INFERENCE BRIDGE] ⇓</div>`;

    conclusions.forEach((c, idx) => {
      html += `
        <div class="syllogism-node conclusion">
          <div class="status-label text-emerald" style="font-size: 0.7rem;">CONCLUSION</div>
          <div style="font-weight: 600;">${esc(c.text)}</div>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  _initEnthymeme(arg) {
    const assumptionObj = this._getAssumptionObj(arg);
    const correctText = assumptionObj.text || '';
    const distractors = Array.isArray(assumptionObj.distractors) ? assumptionObj.distractors : [];

    const rawOptions = [
      { text: correctText, isCorrect: true },
      ...distractors.map(d => ({ text: d, isCorrect: false }))
    ];

    this._enthymemeOptions = this._shuffleArray(rawOptions);
    this._selectedEnthymemeIdx = null;
    this._enthymemeSubmitted = false;
    this._enthymemeUnlocked = false;
  },

  _renderEnthymemeDrill() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('sandbox-enthymeme-options');
    const feedback = document.getElementById('sandbox-enthymeme-feedback');
    const submitBtn = document.getElementById('btn-submit-enthymeme');
    const lockBanner = document.getElementById('sandbox-flaw-lock-banner');
    const flawContent = document.getElementById('sandbox-flaw-content');
    const assumptionText = document.getElementById('sandbox-assumption-text');

    if (assumptionText && this._currentArg) {
      const assumpObj = this._getAssumptionObj(this._currentArg);
      assumptionText.textContent = assumpObj.text;
    }

    if (feedback && !this._enthymemeSubmitted) {
      feedback.classList.add('hidden');
      feedback.innerHTML = '';
    }

    if (submitBtn) {
      submitBtn.disabled = this._enthymemeSubmitted;
    }

    if (lockBanner && flawContent) {
      if (this._enthymemeUnlocked) {
        lockBanner.classList.add('hidden');
        flawContent.classList.remove('hidden');
      } else {
        lockBanner.classList.remove('hidden');
        flawContent.classList.add('hidden');
      }
    }

    if (!container) return;

    container.innerHTML = this._enthymemeOptions.map((opt, idx) => {
      let extraClass = '';
      if (this._selectedEnthymemeIdx === idx) extraClass += ' selected';
      if (this._enthymemeSubmitted) {
        if (opt.isCorrect) extraClass += ' correct';
        else if (this._selectedEnthymemeIdx === idx) extraClass += ' incorrect';
      }

      return `
        <button class="enthymeme-option-btn ${esc(extraClass)}" data-idx="${idx}" ${this._enthymemeSubmitted ? 'disabled' : ''}>
          <span style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--bronze-bright); min-width: 20px;">[${idx + 1}]</span>
          <span>${esc(opt.text)}</span>
        </button>
      `;
    }).join('');

    container.querySelectorAll('.enthymeme-option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this._enthymemeSubmitted) return;
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        this._selectedEnthymemeIdx = idx;
        container.querySelectorAll('.enthymeme-option-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });
  },

  _submitEnthymemeDeduction() {
    if (!this._currentArg) return;
    const feedback = typeof document !== 'undefined' ? document.getElementById('sandbox-enthymeme-feedback') : null;

    if (this._selectedEnthymemeIdx === null) {
      if (feedback) {
        feedback.classList.remove('hidden');
        feedback.style.background = 'rgba(239, 68, 68, 0.1)';
        feedback.style.border = '1px solid var(--disinfo-crimson)';
        feedback.style.color = 'var(--parchment-bright)';
        feedback.innerHTML = '<strong>Selection Required:</strong> Choose the unstated premise candidate that best links the argument before verifying.';
      }
      return;
    }

    this._enthymemeSubmitted = true;
    const chosen = this._enthymemeOptions[this._selectedEnthymemeIdx];
    const isCorrect = chosen?.isCorrect === true;
    const assumptionObj = this._getAssumptionObj(this._currentArg);

    // Record attempt for Bayesian tracking
    const skillIds = Array.isArray(this._currentArg.tests) && this._currentArg.tests.length > 0
      ? this._currentArg.tests
      : ['skill.fallacy.structure'];

    recordAttempt({
      skillIds,
      itemId: `${this._currentArg.id}#enthymeme`,
      correct: isCorrect,
      context: CONTEXTS.SANDBOX,
      latencyMs: null,
      heldOut: this._currentArg.heldOut === true,
      chosen: chosen?.text
    });

    // Update stats
    const rhetoricStats = this._app?.store?.get('rhetoric.stats') || {
      clausesTagged: 0, clausesCorrect: 0, enthymemesAttempted: 0, enthymemesCorrect: 0, steelmansCompleted: 0
    };
    rhetoricStats.enthymemesAttempted++;
    if (isCorrect) rhetoricStats.enthymemesCorrect++;
    this._app?.store?.set('rhetoric.stats', rhetoricStats);

    // Unlock flaw diagnostic
    this._enthymemeUnlocked = true;

    // Render feedback
    if (feedback) {
      feedback.classList.remove('hidden');
      if (isCorrect) {
        feedback.style.background = 'rgba(74, 222, 128, 0.12)';
        feedback.style.border = '1px solid var(--veracity-green, #4ade80)';
        feedback.style.color = 'var(--veracity-green, #4ade80)';
        feedback.innerHTML = `<strong>✓ ACCURATE ENTHYMEME DEDUCTION</strong><br><span style="color: var(--parchment-primary);">${esc(assumptionObj.explanation || 'You accurately uncovered the hidden unstated premise.')}</span>`;
      } else {
        feedback.style.background = 'rgba(245, 158, 11, 0.12)';
        feedback.style.border = '1px solid var(--suspicion-amber, #f59e0b)';
        feedback.style.color = 'var(--suspicion-amber, #f59e0b)';
        feedback.innerHTML = `<strong>✕ INCORRECT ASSUMPTION</strong><br><span style="color: var(--parchment-primary);">${esc(assumptionObj.explanation || 'Review the logical leap between the empirical premise and the ultimate conclusion.')}</span>`;
      }
    }

    this._renderEnthymemeDrill();
    this._saveState();
  },

  _renderDiagnostics(arg) {
    if (typeof document === 'undefined') return;
    const titleEl = document.getElementById('sandbox-flaw-title');
    const latinEl = document.getElementById('sandbox-flaw-latin');
    const descEl = document.getElementById('sandbox-flaw-desc');
    const flawBadge = document.getElementById('sandbox-flaw-badge');

    if (titleEl) titleEl.textContent = arg.structuralFlaw?.name || 'Logical Structure Review';
    if (latinEl) latinEl.textContent = arg.structuralFlaw?.latin ? `(${arg.structuralFlaw.latin})` : '';
    if (descEl) descEl.textContent = arg.structuralFlaw?.analysis || 'No detailed flaw analysis available.';
    if (flawBadge) flawBadge.textContent = arg.structuralFlaw?.category || 'FALLACY DIAGNOSTIC';
  },

  _initSteelman(arg) {
    const steelmanObj = this._getSteelmanObj(arg);
    const exercises = Array.isArray(steelmanObj.exercises) && steelmanObj.exercises.length > 0
      ? steelmanObj.exercises
      : [
          {
            id: 'ex-default',
            prompt: 'Which reformulation principle best strengthens this argument while eliminating structural fallacies?',
            options: [
              'Replace absolute deterministic assertions with verifiable capability thresholds and empirical mitigation.',
              'Dismiss counter-arguments as malicious disinformation without evaluation.',
              'Increase emotional urgency and tribal loyalty framing.',
              'Declare the conclusion self-evident and beyond question.'
            ],
            correctIndex: 0,
            rationale: 'Empirical capability thresholds provide testable claims without relying on deductive overreach or emotional coercion.'
          }
        ];

    this._steelmanExercise = exercises[0];
    const rawOptions = (this._steelmanExercise.options || []).map((opt, idx) => ({
      text: opt,
      isCorrect: idx === this._steelmanExercise.correctIndex
    }));

    this._steelmanOptions = this._shuffleArray(rawOptions);
    this._selectedSteelmanOptionIdx = null;
    this._steelmanSubmitted = false;
  },

  _renderSteelman(arg) {
    if (typeof document === 'undefined') return;
    const steelmanObj = this._getSteelmanObj(arg);
    const steelmanEl = document.getElementById('sandbox-steelman-view');
    const counterEl = document.getElementById('sandbox-counter-view');
    const improvementsContainer = document.getElementById('sandbox-steelman-improvements');

    if (steelmanEl) {
      steelmanEl.textContent = `"${steelmanObj.text || 'No steel-manned formulation provided.'}"`;
    }
    if (counterEl) {
      counterEl.textContent = arg.counterArgument || 'No sovereign counter-argument provided.';
    }
    if (improvementsContainer) {
      improvementsContainer.innerHTML = (steelmanObj.improvements || []).map(imp =>
        `<span class="steelman-improvement-tag">✨ ${esc(imp)}</span>`
      ).join('');
    }

    this._renderSteelmanExercise();
  },

  _renderSteelmanExercise() {
    if (typeof document === 'undefined') return;
    const promptEl = document.getElementById('sandbox-steelman-exercise-prompt');
    const container = document.getElementById('sandbox-steelman-exercise-options');
    const feedback = document.getElementById('sandbox-steelman-exercise-feedback');
    const submitBtn = document.getElementById('btn-submit-steelman-exercise');

    if (!this._steelmanExercise) return;

    if (promptEl) {
      promptEl.textContent = this._steelmanExercise.prompt;
    }

    if (feedback && !this._steelmanSubmitted) {
      feedback.classList.add('hidden');
      feedback.innerHTML = '';
    }

    if (submitBtn) {
      submitBtn.disabled = this._steelmanSubmitted;
    }

    if (!container) return;

    container.innerHTML = this._steelmanOptions.map((opt, idx) => {
      let extraClass = '';
      if (this._selectedSteelmanOptionIdx === idx) extraClass += ' selected';
      if (this._steelmanSubmitted) {
        if (opt.isCorrect) extraClass += ' correct';
        else if (this._selectedSteelmanOptionIdx === idx) extraClass += ' incorrect';
      }

      return `
        <button class="steelman-option-btn ${esc(extraClass)}" data-idx="${idx}" ${this._steelmanSubmitted ? 'disabled' : ''}>
          <span style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--intel-cyan); min-width: 20px;">[${String.fromCharCode(65 + idx)}]</span>
          <span>${esc(opt.text)}</span>
        </button>
      `;
    }).join('');

    container.querySelectorAll('.steelman-option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this._steelmanSubmitted) return;
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        this._selectedSteelmanOptionIdx = idx;
        container.querySelectorAll('.steelman-option-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });
  },

  _submitSteelmanExercise() {
    if (!this._currentArg || !this._steelmanExercise) return;
    const feedback = typeof document !== 'undefined' ? document.getElementById('sandbox-steelman-exercise-feedback') : null;

    if (this._selectedSteelmanOptionIdx === null) {
      if (feedback) {
        feedback.classList.remove('hidden');
        feedback.style.background = 'rgba(239, 68, 68, 0.1)';
        feedback.style.border = '1px solid var(--disinfo-crimson)';
        feedback.style.color = 'var(--parchment-bright)';
        feedback.innerHTML = '<strong>Selection Required:</strong> Choose the best philosophical reformulation before verifying.';
      }
      return;
    }

    this._steelmanSubmitted = true;
    const chosen = this._steelmanOptions[this._selectedSteelmanOptionIdx];
    const isCorrect = chosen?.isCorrect === true;

    const skillIds = Array.isArray(this._currentArg.tests) && this._currentArg.tests.length > 0
      ? this._currentArg.tests
      : ['skill.fallacy.structure'];

    recordAttempt({
      skillIds,
      itemId: `${this._currentArg.id}#steelman`,
      correct: isCorrect,
      context: CONTEXTS.SANDBOX,
      latencyMs: null,
      heldOut: this._currentArg.heldOut === true,
      chosen: chosen?.text
    });

    const rhetoricStats = this._app?.store?.get('rhetoric.stats') || {
      clausesTagged: 0, clausesCorrect: 0, enthymemesAttempted: 0, enthymemesCorrect: 0, steelmansCompleted: 0
    };
    if (isCorrect) rhetoricStats.steelmansCompleted++;
    this._app?.store?.set('rhetoric.stats', rhetoricStats);

    if (feedback) {
      feedback.classList.remove('hidden');
      if (isCorrect) {
        feedback.style.background = 'rgba(74, 222, 128, 0.12)';
        feedback.style.border = '1px solid var(--veracity-green, #4ade80)';
        feedback.style.color = 'var(--veracity-green, #4ade80)';
        feedback.innerHTML = `<strong>✓ SOUND REFORMULATION</strong><br><span style="color: var(--parchment-primary);">${esc(this._steelmanExercise.rationale || 'Optimal steel-man formulation.')}</span>`;
      } else {
        feedback.style.background = 'rgba(245, 158, 11, 0.12)';
        feedback.style.border = '1px solid var(--suspicion-amber, #f59e0b)';
        feedback.style.color = 'var(--suspicion-amber, #f59e0b)';
        feedback.innerHTML = `<strong>✕ SUBOPTIMAL REFORMULATION</strong><br><span style="color: var(--parchment-primary);">${esc(this._steelmanExercise.rationale || 'Review charitable reformulation principles.')}</span>`;
      }
    }

    this._renderSteelmanExercise();
    this._saveState();
  },

  _pinToDossier() {
    if (!this._currentArg) return;

    const assumpObj = this._getAssumptionObj(this._currentArg);
    const steelObj = this._getSteelmanObj(this._currentArg);

    const contentStr = `ARGUMENT: ${this._currentArg.title} [${this._currentArg.domain}]\n\n` +
      `SYLLOGISM BREAKDOWN:\n` +
      this._currentArg.clauses.map((c, i) => `  [${c.type.toUpperCase()}] ${c.text}`).join('\n') + `\n\n` +
      `UNSTATED ENTHYMEME:\n  ${assumpObj.text}\n\n` +
      `STRUCTURAL FLAW:\n  ${this._currentArg.structuralFlaw?.name} — ${this._currentArg.structuralFlaw?.analysis}\n\n` +
      `STEEL-MAN FORMULATION:\n  "${steelObj.text}"\n\n` +
      `EPISTEMIC COUNTER-ARGUMENT:\n  ${this._currentArg.counterArgument}`;

    window.dispatchEvent(new CustomEvent('aegis:pin', {
      detail: {
        source: 'The Rhetorical Sandbox',
        title: `Dissection: ${this._currentArg.title}`,
        content: contentStr
      }
    }));
  },

  _copyBreakdown() {
    if (!this._currentArg) return;
    const assumpObj = this._getAssumptionObj(this._currentArg);
    const steelObj = this._getSteelmanObj(this._currentArg);

    const text = `SOVEREIGN // AEGIS — Rhetorical Syllogism Decomposition\n` +
      `Title: ${this._currentArg.title}\nDomain: ${this._currentArg.domain}\n\n` +
      `Clauses:\n` + this._currentArg.clauses.map(c => `- [${c.type}] ${c.text}`).join('\n') + `\n\n` +
      `Hidden Assumption: ${assumpObj.text}\n` +
      `Flaw: ${this._currentArg.structuralFlaw?.name} (${this._currentArg.structuralFlaw?.latin})\n` +
      `Steel-Man: ${steelObj.text}\n` +
      `Counter-Argument: ${this._currentArg.counterArgument}`;

    navigator.clipboard?.writeText(text).then(() => {
      this._app?.showToast?.({
        type: 'success',
        title: 'COPIED TO CLIPBOARD',
        message: 'Full syllogism breakdown copied.'
      });
    }).catch(() => {
      this._app?.showToast?.({
        type: 'info',
        title: 'COPY FAILED',
        message: 'Could not access clipboard.'
      });
    });
  }
};
