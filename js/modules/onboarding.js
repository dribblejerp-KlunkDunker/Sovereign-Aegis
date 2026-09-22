/**
 * SOVEREIGN // AEGIS — First-Run Onboarding & Operator Profile Engine
 *
 * Responsibilities:
 *  1. First-run detection and guided 5-step onboarding modal
 *  2. Operator Profile: competency spiderchart derived from activity across all modules
 *  3. Progressive disclosure controller: tier-1 / tier-2 / tier-3 content gating
 *  4. "Next Recommended Action" engine: directs users to the highest-value next step
 */

import { esc } from '../security.js';
import { AttemptLog, normaliseConfidence } from '../attemptlog.js';
import { MIN_RATED as CALIBRATION_MIN_RATED } from '../calibrationPanel.js';
import {
  DIAGNOSTIC_QUESTIONS,
  computeDiagnosticPlacement
} from './adaptiveRouting.js';

export const OnboardingModule = {
  _app: null,
  _step: 0,
  _totalSteps: 6,
  _diagIndex: 0,
  _diagResponses: [],
  _diagComplete: false,
  _selectedOption: null,
  _selectedConf: 'sure',
  _lastPlacement: null,
  _cachedSkills: [],

  // ──────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ──────────────────────────────────────────────────────────────
  async init(app) {
    this._app = app;

    // Listen for SIFT Lab memory card events
    window.addEventListener('aegis:sift-cards', (e) => {
      this._enqueueSiftCards(e.detail.cards);
    });

    console.log('[Onboarding] Initialized.');
  },

  onMount() {
    const isOnboarded = this._app.store.get('app.onboarded', false);
    if (!isOnboarded) {
      this._showOnboardingModal();
    }
    this._renderOperatorProfile();
  },

  // ──────────────────────────────────────────────────────────────
  // SIFT → SM-2 BRIDGE
  // ──────────────────────────────────────────────────────────────
  _enqueueSiftCards(newCards) {
    // Get existing SM-2 deck
    const stored = this._app.store.get('sm2.deck');
    let deck = stored ? JSON.parse(stored) : [];

    // Only add cards that don't already exist
    let added = 0;
    for (const card of newCards) {
      if (!deck.find(c => c.id === card.id)) {
        deck.push(card);
        added++;
      }
    }

    if (added > 0) {
      this._app.store.set('sm2.deck', JSON.stringify(deck));
      this._app.showToast({
        type: 'info',
        title: `${added} REVIEW CARD${added > 1 ? 'S' : ''} QUEUED`,
        message: 'Missed concepts added to your Daily Memory Queue for spaced repetition.',
        duration: 3500
      });

      // Update the overview badge
      const badge = document.getElementById('overview-memory-due-count');
      const today = new Date().toISOString().split('T')[0];
      const dueCount = deck.filter(c => !c.dueDate || c.dueDate <= today).length;
      if (badge) badge.textContent = dueCount;
    }
  },

  // ──────────────────────────────────────────────────────────────
  // ONBOARDING MODAL
  // ──────────────────────────────────────────────────────────────
  _showOnboardingModal() {
    // Remove existing if any
    document.getElementById('modal-onboarding')?.remove();

    const modal = document.createElement('div');
    modal.id = 'modal-onboarding';
    modal.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      display: flex; align-items: center; justify-content: center;
      background: rgba(7, 9, 14, 0.92);
      backdrop-filter: blur(8px);
      padding: 20px;
    `;

    modal.innerHTML = this._buildStep(0);
    document.body.appendChild(modal);

    this._bindOnboardingEvents(modal);
  },

  _buildStep(step) {
    const steps = [
      {
        icon: '⬡',
        title: 'Welcome to SOVEREIGN // AEGIS',
        subtitle: 'A Complete Architecture for Cognitive Sovereignty',
        content: `
          <p style="font-family: var(--font-quote); font-style: italic; font-size: 1.05rem; color: var(--stone-light); line-height: 1.7; text-align: center; max-width: 560px; margin: 0 auto 20px auto;">
            "The manipulation of human belief is the oldest weapon of power. This system erects four standing structures — cognitive fortification, real-time protection, OSINT investigation, and collective defense."
          </p>
          <p style="font-size: 0.9rem; color: var(--parchment-secondary); line-height: 1.6; text-align: center; max-width: 480px; margin: 0 auto;">
            AEGIS is not a reference tool. It is a training system. This 5-step orientation will establish your baseline, show you where to start, and calibrate your Operator Profile.
          </p>
        `,
        cta: 'Begin Orientation →'
      },
      {
        icon: '🧠',
        title: 'Pillar I: Cognitive Fortification',
        subtitle: 'Build resilience before the adversary arrives',
        content: `
          <div style="display: flex; flex-direction: column; gap: 14px; max-width: 560px; margin: 0 auto;">
            <div style="background: var(--bg-surface-inset); border-left: 3px solid var(--bronze-primary); padding: 14px; border-radius: var(--radius-sm);">
              <div class="status-label text-bronze" style="margin-bottom: 4px;">WHERE TO START</div>
              <p style="font-size: 0.9rem; color: var(--parchment-primary); margin: 0; line-height: 1.5;">
                <strong>01 // Cognitive Lab</strong> — Start with the SIFT Labs. Four active skill-building drills that teach the exact verification workflow used by intelligence analysts and investigative journalists.
              </p>
            </div>
            <div style="background: var(--bg-surface-inset); border-left: 3px solid var(--border-subtle); padding: 14px; border-radius: var(--radius-sm);">
              <div class="status-label text-muted" style="margin-bottom: 4px;">THEN EXPLORE</div>
              <p style="font-size: 0.88rem; color: var(--parchment-secondary); margin: 0; line-height: 1.5;">
                Masterclasses build deep theory. The Fallacy Taxonomy is your field reference. The Infinite Arena tests reflexes under pressure. The Memory Queue maintains everything long-term through spaced repetition.
              </p>
            </div>
          </div>
        `,
        cta: 'Next: Real-Time Protection →'
      },
      {
        icon: '🛡️',
        title: 'Pillar II: Real-Time Protection',
        subtitle: 'Intercept falsehood at the moment of encounter',
        content: `
          <div style="display: flex; flex-direction: column; gap: 14px; max-width: 560px; margin: 0 auto;">
            <div style="background: var(--bg-surface-inset); border-left: 3px solid var(--intel-cyan, #38bdf8); padding: 14px; border-radius: var(--radius-sm);">
              <div class="status-label" style="color: var(--intel-cyan, #38bdf8); margin-bottom: 4px;">VERDAD ENGINE (04)</div>
              <p style="font-size: 0.9rem; color: var(--parchment-primary); margin: 0; line-height: 1.5;">
                Paste any claim into VERDAD. The heuristic engine runs offline — no API key needed. For deeper reasoning, add your Gemini API key in Settings to activate live chain-of-thought analysis.
              </p>
            </div>
            <div style="background: var(--bg-surface-inset); border-left: 3px solid var(--border-subtle); padding: 14px; border-radius: var(--radius-sm);">
              <div class="status-label text-muted" style="margin-bottom: 4px;">ADVERSARIAL SANDBOX</div>
              <p style="font-size: 0.88rem; color: var(--parchment-secondary); margin: 0; line-height: 1.5;">
                After running an analysis, activate the Adversarial Sandbox: the system generates manipulative reframings of the same claim. Your job is to identify which variant is most dangerous. This turns the verifier into a trainer.
              </p>
            </div>
          </div>
        `,
        cta: 'Next: OSINT Investigation →'
      },
      {
        icon: '🔍',
        title: 'Pillar III: OSINT Investigation',
        subtitle: 'The tools of intelligence, in your hands',
        content: `
          <div style="display: flex; flex-direction: column; gap: 14px; max-width: 560px; margin: 0 auto;">
            <div style="background: var(--bg-surface-inset); border-left: 3px solid var(--veracity-green); padding: 14px; border-radius: var(--radius-sm);">
              <div class="status-label text-emerald" style="margin-bottom: 4px;">MODULES 05–07</div>
              <p style="font-size: 0.9rem; color: var(--parchment-primary); margin: 0; line-height: 1.5;">
                <strong>OSINT Suite</strong> — practice multi-source investigation workflows. <strong>ACH Matrix</strong> — apply Richards Heuer's mathematical inconsistency method to competing hypotheses. <strong>Narrative Topology</strong> — trace how a story diffuses over time.
              </p>
            </div>
            <div style="background: var(--bg-surface-inset); border-left: 3px solid var(--border-subtle); padding: 14px; border-radius: var(--radius-sm);">
              <div class="status-label text-muted" style="margin-bottom: 4px;">HONEST SCOPE NOTE</div>
              <p style="font-size: 0.88rem; color: var(--parchment-secondary); margin: 0; line-height: 1.5;">
                These tools simulate professional methodologies. They teach the workflow and build the habit of structured analysis. Real OSINT investigations involve live external tools — treat these labs as simulation, not substitution.
              </p>
            </div>
          </div>
        `,
        cta: 'Next: Collective Defense →'
      },
      {
        icon: '📡',
        title: 'Pillar IV: Collective Defense',
        subtitle: 'No mind stands alone against a coordinated campaign',
        content: `
          <div style="display: flex; flex-direction: column; gap: 14px; max-width: 560px; margin: 0 auto;">
            <div style="background: var(--bg-surface-inset); border-left: 3px solid var(--suspicion-amber); padding: 14px; border-radius: var(--radius-sm);">
              <div class="status-label text-amber" style="margin-bottom: 4px;">EARLY WARNING (08) + SOURCE DIRECTORY (09)</div>
              <p style="font-size: 0.9rem; color: var(--parchment-primary); margin: 0; line-height: 1.5;">
                The Threat Radar monitors six domains. The Source Directory gives you factual-accuracy scores for 60+ major media outlets. The InfoWar Simulator (02) lets you practice network defense strategy against disinformation campaigns.
              </p>
            </div>
            <div style="background: rgba(210, 166, 77, 0.1); border: 1px solid var(--bronze-dark); border-radius: var(--radius-sm); padding: 16px; text-align: center;">
              <div class="status-label text-bronze" style="margin-bottom: 6px;">YOUR RECOMMENDED FIRST MOVE</div>
              <p style="font-size: 0.9rem; color: var(--parchment-bright); margin: 0; font-weight: 600;">
                Calibrate your Operator Profile with the Diagnostic Placement Test to identify your optimal starting point.
              </p>
              <p style="font-size: 0.8rem; color: var(--stone-light); margin: 6px 0 0 0;">
                Four rapid scenario probes. Calibrate priors, confidence, and initial routing.
              </p>
            </div>
          </div>
        `,
        cta: 'Take Diagnostic Placement Test →'
      }
    ];

    if (step === 5) {
      return this._buildDiagnosticStep();
    }

    const s = steps[step];
    const progressPct = ((step) / (this._totalSteps - 1)) * 100;

    return `
      <div style="
        background: var(--bg-surface-card);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        width: 100%;
        max-width: 680px;
        overflow: hidden;
        box-shadow: 0 24px 80px rgba(0,0,0,0.6);
      ">
        <!-- Progress Bar -->
        <div style="height: 3px; background: var(--bg-surface-inset); width: 100%;">
          <div style="height: 100%; width: ${esc(progressPct)}%; background: linear-gradient(90deg, var(--bronze-primary), var(--bronze-bright)); transition: width 0.4s ease;"></div>
        </div>

        <!-- Header -->
        <div style="padding: 32px 32px 0 32px; text-align: center;">
          <div style="font-size: 2.5rem; margin-bottom: 12px;">${esc(s.icon)}</div>
          <div style="font-family: var(--font-display); font-size: 1.35rem; font-weight: 700; color: var(--parchment-bright); margin-bottom: 6px; letter-spacing: 0.03em;">
            ${esc(s.title)}
          </div>
          <div style="font-family: var(--font-quote); font-style: italic; color: var(--bronze-mid); font-size: 0.9rem; margin-bottom: 24px;">
            ${esc(s.subtitle)}
          </div>
        </div>

        <!-- Content -->
        <div style="padding: 0 32px 24px 32px;">
          ${/* s.content is a project-authored HTML fragment from the literal `steps`
                array above — not ingested data — so it is intentionally not encoded.
                Every other field on `s` is plain text and IS encoded. */ s.content}
        </div>

        <!-- Footer -->
        <div style="padding: 20px 32px 28px 32px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle);">
          <div style="font-family: var(--font-mono); font-size: 0.7rem; color: var(--stone-warm);">
            STEP ${esc(step + 1)} OF ${esc(this._totalSteps)}
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            ${step > 0 ? `<button id="btn-onboard-back" class="btn btn-outline" style="font-size: 0.85rem;">← Back</button>` : ''}
            ${step === 4 ? `<button id="btn-onboard-skip-diag" class="btn btn-outline" style="font-size: 0.82rem; color: var(--stone-warm);">Skip Placement →</button>` : ''}
            ${step < this._totalSteps - 1
              ? `<button id="btn-onboard-next" class="btn btn-primary" style="font-size: 0.9rem;">${s.cta}</button>`
              : `<button id="btn-onboard-finish" class="btn btn-primary" style="font-size: 0.9rem; background: linear-gradient(135deg, var(--bronze-primary), var(--bronze-bright));">${s.cta}</button>`
            }
          </div>
        </div>
      </div>
    `;
  },

  _buildDiagnosticStep() {
    if (this._diagComplete && this._lastPlacement) {
      const p = this._lastPlacement;
      return `
        <div style="
          background: var(--bg-surface-card);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          width: 100%;
          max-width: 680px;
          overflow: hidden;
          box-shadow: 0 24px 80px rgba(0,0,0,0.6);
        ">
          <!-- Progress Bar -->
          <div style="height: 3px; background: var(--bg-surface-inset); width: 100%;">
            <div style="height: 100%; width: 100%; background: linear-gradient(90deg, var(--bronze-primary), var(--emerald-bright));"></div>
          </div>

          <!-- Header -->
          <div style="padding: 28px 32px 0 32px; text-align: center;">
            <div style="font-size: 2.2rem; margin-bottom: 8px;">🎯</div>
            <div style="font-family: var(--font-display); font-size: 1.35rem; font-weight: 700; color: var(--parchment-bright); margin-bottom: 4px; letter-spacing: 0.03em;">
              Diagnostic Placement Complete
            </div>
            <div style="font-family: var(--font-quote); font-style: italic; color: var(--bronze-mid); font-size: 0.88rem; margin-bottom: 20px;">
              Operator Baseline Calibrated · Adaptive Route Established
            </div>
          </div>

          <!-- Content -->
          <div style="padding: 0 32px 20px 32px; display: flex; flex-direction: column; gap: 14px;">
            <div style="background: rgba(210, 166, 77, 0.1); border: 1px solid var(--bronze-primary); border-radius: var(--radius-sm); padding: 16px; text-align: center;">
              <div class="status-label text-bronze" style="margin-bottom: 6px;">ASSIGNED OPERATOR TRACK</div>
              <div style="font-family: var(--font-display); font-size: 1.25rem; font-weight: 700; color: var(--parchment-bright); margin-bottom: 4px;">
                ${esc(p.track)}
              </div>
              <div style="font-size: 0.85rem; color: var(--stone-light);">
                Score: <strong>${esc(p.score)} / ${esc(p.total)} (${esc(p.percentage)}%)</strong> · Brier Calibration: <span style="font-family: var(--font-mono); color: var(--bronze-bright);">${esc(p.brierScore)}</span>
              </div>
            </div>

            <div style="background: var(--bg-surface-inset); border-left: 3px solid var(--veracity-green); padding: 14px; border-radius: var(--radius-sm);">
              <div class="status-label text-emerald" style="margin-bottom: 4px;">RECOMMENDED STARTING POINT</div>
              <p style="font-size: 0.95rem; color: var(--parchment-bright); margin: 0 0 4px 0; font-weight: 600;">
                ${esc(p.placedAt.label)}
              </p>
              <p style="font-size: 0.84rem; color: var(--parchment-secondary); margin: 0; line-height: 1.5;">
                ${esc(p.reason)}
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div style="padding: 18px 32px 24px 32px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle);">
            <div style="font-family: var(--font-mono); font-size: 0.7rem; color: var(--veracity-green);">
              ✓ PRIORS INITIALIZED
            </div>
            <button id="btn-onboard-finish" class="btn btn-primary" style="font-size: 0.92rem; background: linear-gradient(135deg, var(--bronze-primary), var(--bronze-bright)); padding: 10px 22px;">
              Enter AEGIS at ${esc(p.placedAt.label)} →
            </button>
          </div>
        </div>
      `;
    }

    const q = DIAGNOSTIC_QUESTIONS[this._diagIndex] || DIAGNOSTIC_QUESTIONS[0];
    const totalQ = DIAGNOSTIC_QUESTIONS.length;
    const isLastQ = this._diagIndex === totalQ - 1;

    return `
      <div style="
        background: var(--bg-surface-card);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        width: 100%;
        max-width: 680px;
        overflow: hidden;
        box-shadow: 0 24px 80px rgba(0,0,0,0.6);
      ">
        <!-- Progress Bar -->
        <div style="height: 3px; background: var(--bg-surface-inset); width: 100%;">
          <div style="height: 100%; width: ${((this._diagIndex + 1) / totalQ) * 100}%; background: linear-gradient(90deg, var(--bronze-primary), var(--bronze-bright)); transition: width 0.3s ease;"></div>
        </div>

        <!-- Header -->
        <div style="padding: 24px 32px 0 32px; text-align: center;">
          <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--bronze-bright); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">
            DIAGNOSTIC PLACEMENT PROBE ${esc(this._diagIndex + 1)} OF ${esc(totalQ)}
          </div>
          <div style="font-family: var(--font-display); font-size: 1.2rem; font-weight: 700; color: var(--parchment-bright); margin-bottom: 4px;">
            Baseline Competency Calibration
          </div>
          <div style="font-size: 0.8rem; color: var(--stone-warm); margin-bottom: 16px;">
            Target Skill: <span style="font-family: var(--font-mono); color: var(--intel-cyan, #38bdf8);">${esc(q.skillId)}</span>
          </div>
        </div>

        <!-- Scenario Prompt -->
        <div style="padding: 0 32px 18px 32px;">
          <div style="background: var(--bg-surface-inset); border-left: 3px solid var(--bronze-primary); padding: 14px; border-radius: var(--radius-sm); margin-bottom: 16px; font-size: 0.88rem; color: var(--parchment-primary); line-height: 1.55;">
            ${esc(q.prompt)}
          </div>

          <!-- Options -->
          <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
            ${q.options.map((opt, i) => {
              const selected = this._selectedOption === i;
              return `
                <div class="diag-option-card"
                     data-diag-option="${i}"
                     style="
                       display: flex; align-items: center; gap: 12px;
                       padding: 10px 14px;
                       border-radius: var(--radius-sm);
                       border: 1px solid ${selected ? 'var(--bronze-bright)' : 'var(--border-subtle)'};
                       background: ${selected ? 'rgba(210, 166, 77, 0.12)' : 'var(--bg-surface-card)'};
                       cursor: pointer;
                       transition: all 0.2s ease;
                     ">
                  <div style="
                    width: 18px; height: 18px; border-radius: 50%;
                    border: 2px solid ${selected ? 'var(--bronze-bright)' : 'var(--stone-warm)'};
                    background: ${selected ? 'var(--bronze-bright)' : 'transparent'};
                    display: flex; align-items: center; justify-content: center;
                    flex-shrink: 0;
                  ">
                    ${selected ? '<div style="width: 6px; height: 6px; border-radius: 50%; background: #000;"></div>' : ''}
                  </div>
                  <div style="font-size: 0.85rem; color: ${selected ? 'var(--parchment-bright)' : 'var(--parchment-secondary)'}; line-height: 1.4;">
                    ${esc(opt)}
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <!-- Confidence Rating Bar -->
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 14px; background: rgba(0,0,0,0.25); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
            <div style="font-family: var(--font-mono); font-size: 0.7rem; color: var(--stone-warm); text-transform: uppercase;">
              Confidence:
            </div>
            <div style="display: flex; gap: 8px;">
              ${[
                { id: 'sure', label: 'Sure (90%)', color: 'var(--veracity-green)' },
                { id: 'unsure', label: 'Unsure (60%)', color: 'var(--suspicion-amber)' },
                { id: 'guess', label: 'Guess (25%)', color: 'var(--stone-light)' }
              ].map(c => {
                const active = (this._selectedConf || 'sure') === c.id;
                return `
                  <button type="button"
                          class="btn btn-sm diag-conf-btn"
                          data-diag-conf="${c.id}"
                          style="
                            font-size: 0.72rem; padding: 3px 8px;
                            border: 1px solid ${active ? c.color : 'var(--border-subtle)'};
                            background: ${active ? 'rgba(255,255,255,0.08)' : 'transparent'};
                            color: ${active ? c.color : 'var(--stone-warm)'};
                            font-weight: ${active ? '700' : 'normal'};
                            cursor: pointer;
                          ">
                    ${c.label}
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div style="padding: 16px 32px 22px 32px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle);">
          <div>
            <button id="btn-diag-prev" class="btn btn-outline" style="font-size: 0.82rem;">
              ${this._diagIndex > 0 ? '← Previous Probe' : '← Overview'}
            </button>
            <button id="btn-diag-skip" class="btn" style="background: transparent; border: none; color: var(--stone-muted); font-size: 0.75rem; text-decoration: underline; margin-left: 8px; cursor: pointer;">
              Skip Diagnostic
            </button>
          </div>
          <button id="btn-diag-submit" class="btn btn-primary"
                  ${this._selectedOption === null ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}
                  style="font-size: 0.88rem; background: linear-gradient(135deg, var(--bronze-primary), var(--bronze-bright));">
            ${isLastQ ? 'Complete Placement →' : 'Next Probe →'}
          </button>
        </div>
      </div>
    `;
  },

  _bindOnboardingEvents(modal) {
    modal.addEventListener('click', (e) => {
      const target = e.target;
      if (!target) return;

      const optCard = target.closest('[data-diag-option]');
      if (optCard) {
        this._selectedOption = parseInt(optCard.getAttribute('data-diag-option'), 10);
        modal.innerHTML = this._buildStep(this._step);
        this._bindOnboardingEvents(modal);
        return;
      }

      const confBtn = target.closest('[data-diag-conf]');
      if (confBtn) {
        this._selectedConf = confBtn.getAttribute('data-diag-conf');
        modal.innerHTML = this._buildStep(this._step);
        this._bindOnboardingEvents(modal);
        return;
      }

      if (target.id === 'btn-diag-submit' && this._selectedOption !== null) {
        const q = DIAGNOSTIC_QUESTIONS[this._diagIndex] || DIAGNOSTIC_QUESTIONS[0];
        this._diagResponses[this._diagIndex] = {
          questionId: q.id,
          skillId: q.skillId,
          chosen: this._selectedOption,
          confidence: this._selectedConf || 'sure'
        };

        if (this._diagIndex < DIAGNOSTIC_QUESTIONS.length - 1) {
          this._diagIndex++;
          this._selectedOption = this._diagResponses[this._diagIndex]?.chosen ?? null;
          this._selectedConf = this._diagResponses[this._diagIndex]?.confidence ?? 'sure';
          modal.innerHTML = this._buildStep(this._step);
          this._bindOnboardingEvents(modal);
        } else {
          // Complete diagnostic!
          const placement = computeDiagnosticPlacement(this._diagResponses, this._cachedSkills);
          this._lastPlacement = placement;
          this._diagComplete = true;

          // Append to AttemptLog under context: 'diagnostic'
          try {
            for (const r of placement.evaluatedResponses) {
              AttemptLog.append({
                skillId: r.skillId,
                itemId: r.questionId,
                correct: r.correct,
                confidence: r.confidence,
                context: 'diagnostic'
              }).catch(err => console.warn('[Onboarding] Diagnostic attempt log error:', err));
            }
          } catch (err) {
            console.warn('[Onboarding] Error writing diagnostic attempts:', err);
          }

          this._app?.store?.set('operator.placement', JSON.stringify(placement));
          modal.innerHTML = this._buildStep(this._step);
          this._bindOnboardingEvents(modal);
        }
        return;
      }

      if (target.id === 'btn-diag-prev') {
        if (this._diagIndex > 0) {
          this._diagIndex--;
          this._selectedOption = this._diagResponses[this._diagIndex]?.chosen ?? null;
          this._selectedConf = this._diagResponses[this._diagIndex]?.confidence ?? 'sure';
          modal.innerHTML = this._buildStep(this._step);
          this._bindOnboardingEvents(modal);
        } else {
          this._step = 4;
          modal.innerHTML = this._buildStep(this._step);
          this._bindOnboardingEvents(modal);
        }
        return;
      }

      if (target.id === 'btn-diag-skip' || target.id === 'btn-onboard-skip-diag') {
        this._completeOnboarding(modal, { tab: 'cognitive', subtab: 'sift-labs', label: 'SIFT Labs' });
        return;
      }

      if (target.id === 'btn-onboard-next') {
        this._step = Math.min(this._step + 1, this._totalSteps - 1);
        modal.innerHTML = this._buildStep(this._step);
        this._bindOnboardingEvents(modal);
        return;
      }

      if (target.id === 'btn-onboard-back') {
        this._step = Math.max(this._step - 1, 0);
        modal.innerHTML = this._buildStep(this._step);
        this._bindOnboardingEvents(modal);
        return;
      }

      if (target.id === 'btn-onboard-finish') {
        const dest = this._lastPlacement?.placedAt || { tab: 'cognitive', subtab: 'sift-labs', label: 'SIFT Labs' };
        this._completeOnboarding(modal, dest);
        return;
      }
    });
  },

  _completeOnboarding(modal, dest = { tab: 'cognitive', subtab: 'sift-labs', label: 'SIFT Labs' }) {
    this._app?.store?.set('app.onboarded', true);
    this._app?.store?.set('app.onboardedAt', new Date().toISOString());

    modal.style.opacity = '0';
    modal.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
      modal.remove();
      this._app?.showToast({
        type: 'success',
        title: 'AEGIS ORIENTATION COMPLETE',
        message: `Routed to ${dest.label || 'Cognitive Lab'}. Baseline priors calibrated.`,
        duration: 5000
      });
      if (dest.tab && typeof window !== 'undefined' && window.AegisApp?.switchTab) {
        window.AegisApp.switchTab(dest.tab);
        if (dest.subtab) {
          setTimeout(() => {
            const subtabBtn = document.querySelector(`[data-subtab="${dest.subtab}"]`);
            subtabBtn?.click();
          }, 150);
        }
      }
      this._renderOperatorProfile();
    }, 300);
  },

  // ──────────────────────────────────────────────────────────────
  // OPERATOR PROFILE
  // ──────────────────────────────────────────────────────────────

  /**
   * Arena accuracy from real attempt-log records — the raw material for the Pattern
   * Recognition axis. Practice items only: held-out probes measure transfer elsewhere
   * and are excluded here. No attempts means an honest 0, never a fabricated one.
   * @param {Array<{context?: string, correct?: boolean, heldOut?: boolean}>|null} attempts
   * @returns {number} 0-100
   */
  arenaAccuracyFromAttempts(attempts) {
    const arena = (Array.isArray(attempts) ? attempts : [])
      .filter((a) => a && a.context === 'arena' && typeof a.correct === 'boolean' && a.heldOut !== true);
    if (!arena.length) return 0;
    return Math.round((arena.filter((a) => a.correct).length / arena.length) * 100);
  },

  /**
   * @param {{arenaAccuracy?: number}} [injections] — real measured values the caller
   *   pulled from stores that are not synchronous (the attempt log). Omitted => 0.
   */
  _computeCompetencyScores(injections = {}) {
    const arenaAccuracy = Number.isFinite(injections.arenaAccuracy) ? injections.arenaAccuracy : 0;
    const siftStats = this._app?.store?.get('sift.stats') || { correct: 0, total: 0, byLab: {} };
    const memoryDeck = this._app?.store?.get('sm2.deck');
    let deck = [];
    if (memoryDeck) {
      try {
        deck = typeof memoryDeck === 'string' ? JSON.parse(memoryDeck) : memoryDeck;
      } catch {
        deck = [];
      }
    }
    const cogProgress = this._app?.store?.get('cognitive.progress') || {};
    const verdadAudits = this._app?.store?.get('verdad.auditCount') || 0;
    const achAnalyses = this._app?.store?.get('ach.analysisCount') || 0;
    const infowarStats = this._app?.store?.get('infowar.stats') || { victories: 0, completedCampaigns: 0 };

    // Compute 5-axis competency (0-100 each)
    const siftAccuracy = siftStats.total > 0
      ? Math.round((siftStats.correct / siftStats.total) * 100)
      : 0;

    const memoryCoverage = deck.length > 0
      ? Math.min(100, Math.round((deck.filter(c => c.repetitions > 2).length / deck.length) * 100))
      : 0;

    const coursesCompleted = Object.keys(cogProgress).filter(k => cogProgress[k]?.completed).length;
    const theoreticalDepth = Math.min(100, (coursesCompleted / 4) * 100);

    const infowarVictories = infowarStats.victories || 0;
    const analyticalPractice = Math.min(100, (achAnalyses * 15) + (verdadAudits * 5) + (infowarVictories * 20));

    const siftPoints = parseInt(this._app?.store?.get('operator.siftPoints') || '0', 10);
    // Weights sum to 1: 0.30 verification + 0.30 arena pattern recognition +
    // 0.15 retention + 0.15 theory + 0.10 practice.
    const overallResilience = Math.min(100, Math.round(
      (siftAccuracy * 0.30) +
      (arenaAccuracy * 0.30) +
      (memoryCoverage * 0.15) +
      (theoreticalDepth * 0.15) +
      (analyticalPractice * 0.10)
    ));

    return {
      siftVerification: siftAccuracy,
      patternRecognition: arenaAccuracy,
      memoryRetention: memoryCoverage,
      theoreticalDepth: Math.round(theoreticalDepth),
      analyticalPractice: Math.min(100, analyticalPractice),
      overallResilience,
      siftPoints
    };
  },

  _computeNextAction(scores, opts = {}) {
    const actions = [
      { condition: scores.siftVerification < 40, priority: 10, label: 'Complete a SIFT Lab drill', tab: 'cognitive', subtab: 'sift-labs', icon: '🛑' },
      { condition: scores.patternRecognition < 30, priority: 9, label: 'Run an Infinite Arena session', tab: 'cognitive', subtab: 'arena', icon: '⚡' },
      { condition: scores.theoreticalDepth < 25, priority: 8, label: 'Start Masterclass I', tab: 'cognitive', subtab: 'masterclasses', icon: '🎓' },
      { condition: scores.memoryRetention < 20, priority: 7, label: 'Review your Memory Queue', tab: 'cognitive', subtab: 'memory', icon: '🧠' },
      { condition: scores.analyticalPractice < 20, priority: 6, label: 'Run a VERDAD claim audit', tab: 'verdad', subtab: null, icon: '🛡️' },
      { condition: scores.siftVerification > 60 && scores.analyticalPractice < 40, priority: 5, label: 'Build an ACH Matrix analysis', tab: 'ach', subtab: null, icon: '⚖️' },
      { condition: true, priority: 1, label: 'Continue SIFT Labs practice', tab: 'cognitive', subtab: 'sift-labs', icon: '🛑' }
    ];

    // Calibration is the app's most honest mirror. While it is dark, lighting it up is the
    // highest-value next step — and its raw material is the confidence tap on every answer.
    // Keyed off an OPTIONAL rated-answer count so callers that do not know the attempt log
    // (and the pure unit tests) are unaffected.
    if (Number.isFinite(opts.ratedAnswers) && opts.ratedAnswers < CALIBRATION_MIN_RATED) {
      actions.push({
        condition: true,
        priority: 12,
        label: `Answer ${CALIBRATION_MIN_RATED - opts.ratedAnswers} more questions with a confidence tap to light up Calibration`,
        tab: 'cognitive',
        subtab: 'arena',
        icon: '🎯'
      });
    }

    const best = actions.filter(a => a.condition).sort((a, b) => b.priority - a.priority)[0];
    return best;
  },

  /** Confidence-rated attempts in the local log — the count the calibration panel needs to draw. */
  async _countRatedAnswers() {
    try {
      const attempts = await AttemptLog.readAll();
      return attempts.filter((a) => normaliseConfidence(a && a.confidence) !== null).length;
    } catch {
      return 0;
    }
  },

  async _renderOperatorProfile() {
    const container = document.getElementById('operator-profile-panel');
    if (!container) return;

    // Pattern Recognition is measured from the local attempt log (real arena answers),
    // not a store key — the log is the only writer of arena outcomes.
    let arenaAccuracy = 0;
    try {
      arenaAccuracy = this.arenaAccuracyFromAttempts(await AttemptLog.readAll());
    } catch {
      arenaAccuracy = 0;
    }
    const scores = this._computeCompetencyScores({ arenaAccuracy });
    const nextAction = this._computeNextAction(scores, { ratedAnswers: await this._countRatedAnswers() });
    const siftPoints = parseInt(this._app.store.get('operator.siftPoints') || '0', 10);
    const onboardedAt = this._app.store.get('app.onboardedAt');

    let placement = null;
    try {
      const pRaw = this._app?.store?.get('operator.placement');
      if (pRaw) {
        placement = typeof pRaw === 'string' ? JSON.parse(pRaw) : pRaw;
      }
    } catch {
      placement = null;
    }

    const axes = [
      { key: 'siftVerification', label: 'SIFT Verification', color: 'var(--disinfo-crimson)' },
      { key: 'patternRecognition', label: 'Pattern Recognition', color: 'var(--suspicion-amber)' },
      { key: 'memoryRetention', label: 'Memory Retention', color: 'var(--emerald-bright, #4ade80)' },
      { key: 'theoreticalDepth', label: 'Theoretical Depth', color: 'var(--bronze-bright)' },
      { key: 'analyticalPractice', label: 'Analytical Practice', color: 'var(--intel-cyan, #38bdf8)' }
    ];

    // SVG Pentagon Spiderchart
    const spiderSvg = this._buildSpiderchart(axes.map(a => ({ label: a.label, value: scores[a.key], color: a.color })));

    container.innerHTML = `
      <div class="card card-bronze" style="padding: 24px; margin-bottom: var(--space-6);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 16px;">
          <div>
            <span class="view-tag text-bronze" style="font-size: 0.7rem;">OPERATOR PROFILE</span>
            <h3 style="font-family: var(--font-display); font-size: 1.1rem; color: var(--parchment-bright); margin: 4px 0 2px 0;">Cognitive Competency Matrix</h3>
            <div style="font-size: 0.78rem; color: var(--stone-warm);">
              Overall Resilience Index: <span style="font-family: var(--font-mono); color: ${esc(scores.overallResilience > 60 ? 'var(--veracity-green)' : scores.overallResilience > 30 ? 'var(--suspicion-amber)' : 'var(--disinfo-crimson)')}; font-weight: 700;">${esc(scores.overallResilience)}%</span>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-family: var(--font-mono); font-size: 0.7rem; color: var(--stone-warm); margin-bottom: 4px;">COMPETENCY POINTS</div>
            <div style="font-family: var(--font-display); font-size: 1.8rem; color: var(--bronze-bright); font-weight: 700;">${esc(siftPoints)}</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 200px 1fr; gap: 24px; align-items: center; flex-wrap: wrap;">
          <!-- Spiderchart -->
          <div style="display: flex; justify-content: center;">
            ${spiderSvg}
          </div>

          <!-- Axis Bars -->
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${axes.map(a => `
              <div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                  <span style="font-size: 0.75rem; color: var(--stone-light);">${a.label}</span>
                  <span style="font-family: var(--font-mono); font-size: 0.72rem; color: ${a.color};">${scores[a.key]}%</span>
                </div>
                <div style="height: 5px; background: var(--bg-surface-inset); border-radius: 3px; overflow: hidden;">
                  <div style="height: 100%; width: ${scores[a.key]}%; background: ${a.color}; transition: width 0.8s ease; border-radius: 3px;"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Next Recommended Action -->
        ${nextAction ? `
          <div style="margin-top: 20px; border-top: 1px solid var(--border-subtle); padding-top: 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 200px;">
              <div style="font-size: 0.7rem; color: var(--stone-warm); font-family: var(--font-mono); margin-bottom: 4px;">NEXT RECOMMENDED ACTION</div>
              <div style="font-size: 0.9rem; color: var(--parchment-bright); font-weight: 600;">${nextAction.icon} ${nextAction.label}</div>
            </div>
            <button class="btn btn-sm btn-primary operator-next-action-btn" data-tab="${nextAction.tab}" data-subtab="${nextAction.subtab || ''}" style="white-space: nowrap;">
              Go There →
            </button>
          </div>
        ` : ''}

        <!-- Diagnostic Placement Track & Retake -->
        ${placement ? `
          <div style="margin-top: 16px; border-top: 1px solid var(--border-subtle); padding-top: 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div>
              <div style="font-size: 0.68rem; color: var(--bronze-bright); font-family: var(--font-mono); text-transform: uppercase;">
                DIAGNOSTIC PLACEMENT TRACK: <span style="color: var(--parchment-bright); font-weight: 700;">${esc(placement.track)}</span>
              </div>
              <div style="font-size: 0.8rem; color: var(--stone-light); margin-top: 2px;">
                Calibrated: ${esc(placement.score)}/${esc(placement.total)} Probes (${esc(placement.percentage)}%) · Starting Point: <strong>${esc(placement.placedAt?.label || 'SIFT Labs')}</strong>
              </div>
            </div>
            <button id="btn-retake-placement" class="btn btn-sm btn-outline" style="font-size: 0.76rem; padding: 4px 10px; white-space: nowrap;">
              Retake Diagnostic ↺
            </button>
          </div>
        ` : ''}
      </div>
    `;

    // Bind next action button
    container.querySelector('.operator-next-action-btn')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.operator-next-action-btn');
      const tab = btn?.getAttribute('data-tab');
      const subtab = btn?.getAttribute('data-subtab');
      if (tab) {
        window.AegisApp?.switchTab(tab);
        if (subtab) {
          setTimeout(() => {
            const subtabBtn = document.querySelector(`[data-subtab="${subtab}"]`);
            subtabBtn?.click();
          }, 150);
        }
      }
    });

    // Bind retake placement button
    container.querySelector('#btn-retake-placement')?.addEventListener('click', () => {
      this._step = 5;
      this._diagIndex = 0;
      this._diagResponses = [];
      this._diagComplete = false;
      this._selectedOption = null;
      this._selectedConf = 'sure';
      this._showOnboardingModal();
    });
  },

  _buildSpiderchart(axes) {
    const size = 160;
    const center = size / 2;
    const maxRadius = 60;
    const n = axes.length;

    const getPoint = (i, radius) => {
      const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
      return {
        x: center + radius * Math.cos(angle),
        y: center + radius * Math.sin(angle)
      };
    };

    // Grid rings
    let rings = '';
    for (let r = 1; r <= 4; r++) {
      const pts = Array.from({ length: n }, (_, i) => getPoint(i, (maxRadius * r) / 4));
      const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';
      rings += `<path d="${esc(d)}" fill="none" stroke="var(--border-subtle)" stroke-width="0.5" opacity="0.5"/>`;
    }

    // Axis lines
    let axisLines = '';
    for (let i = 0; i < n; i++) {
      const outer = getPoint(i, maxRadius);
      axisLines += `<line x1="${esc(center)}" y1="${esc(center)}" x2="${outer.x.toFixed(1)}" y2="${outer.y.toFixed(1)}" stroke="var(--border-subtle)" stroke-width="0.5" opacity="0.4"/>`;
    }

    // Data polygon
    const dataPts = axes.map((a, i) => getPoint(i, (maxRadius * a.value) / 100));
    const dataPath = dataPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';

    // Labels
    let labels = '';
    for (let i = 0; i < n; i++) {
      const outer = getPoint(i, maxRadius + 14);
      labels += `<text x="${outer.x.toFixed(1)}" y="${outer.y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" fill="${esc(axes[i].color)}" font-size="7" font-family="var(--font-mono)">${esc(axes[i].value)}%</text>`;
    }

    return `
      <svg viewBox="0 0 ${esc(size)} ${esc(size)}" width="${esc(size)}" height="${esc(size)}" style="overflow: visible;">
        ${rings}
        ${axisLines}
        <path d="${esc(dataPath)}" fill="rgba(210, 166, 77, 0.15)" stroke="var(--bronze-bright)" stroke-width="1.5"/>
        ${dataPts.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="var(--bronze-bright)"/>`).join('')}
        ${labels}
      </svg>
    `;
  }
};
