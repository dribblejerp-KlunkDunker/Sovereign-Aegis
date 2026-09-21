/**
 * SOVEREIGN // AEGIS — System 2 Friction & Cognitive Aftercare Module (Next-Gen)
 * 1. 4-7-8 / Box / Physiological Sigh Pacer with Web Audio Respiratory Chimes
 * 2. 15-Second Cognitive Friction Interlock Protocol
 * 3. Epistemic Bias Susceptibility Self-Assessment Audit
 * 4. System 1 to System 2 Epistemic Reframing Drills & Auto-Trigger Detector
 * 5. Epistemic Post-Mortem Incident Debrief
 * 6. Debiasing Journal Deck with Bias Tagging & Dossier Export
 */

import { TacticalAudio } from './tacticalAudio.js';

import { esc } from '../security.js';
export const Aftercare = {
  _app: null,
  _pacerRunning: false,
  _pacerTimer: null,
  _selectedMode: '478',
  _phaseIndex: 0,
  _completedCycles: 0,
  _chimesEnabled: true,

  // Friction Interlock State
  _frictionTimer: null,
  _frictionSec: 15,
  _frictionRunning: false,

  MODES: {
    '478': {
      label: '4-7-8 Breathing (Parasympathetic Reset)',
      phases: [
        { name: 'INHALE', seconds: 4, color: 'var(--veracity-green)', scale: 1.35, chime: 'inhale' },
        { name: 'HOLD', seconds: 7, color: 'var(--bronze-primary)', scale: 1.35, chime: 'hold' },
        { name: 'EXHALE', seconds: 8, color: 'var(--intel-cyan)', scale: 0.75, chime: 'exhale' },
      ]
    },
    'box': {
      label: 'Box Breathing (4-4-4-4 Tactical Focus)',
      phases: [
        { name: 'INHALE', seconds: 4, color: 'var(--veracity-green)', scale: 1.35, chime: 'inhale' },
        { name: 'HOLD IN', seconds: 4, color: 'var(--bronze-primary)', scale: 1.35, chime: 'hold' },
        { name: 'EXHALE', seconds: 4, color: 'var(--intel-cyan)', scale: 0.75, chime: 'exhale' },
        { name: 'HOLD OUT', seconds: 4, color: 'var(--bronze-light)', scale: 0.75, chime: 'hold' },
      ]
    },
    'phys-sigh': {
      label: 'Physiological Sigh (Rapid De-arousal)',
      phases: [
        { name: 'INHALE (deep)', seconds: 3, color: 'var(--veracity-green)', scale: 1.4, chime: 'inhale' },
        { name: 'INHALE (top-up)', seconds: 1, color: 'var(--emerald-light, #6ee7b7)', scale: 1.5, chime: 'inhale' },
        { name: 'EXHALE (slow)', seconds: 8, color: 'var(--intel-cyan)', scale: 0.65, chime: 'exhale' },
      ]
    }
  },

  REFRAMING_PAIRS: [
    {
      s1: 'This outrageous headline proves my opponents are malicious and corrupt!',
      s2: 'What incentives drove this author to induce outrage in me? What context is absent?',
      bias: 'Outrage / Confirmation Bias'
    },
    {
      s1: 'This statistic proves everything I already believed — it must be true!',
      s2: 'What is the sample size, confidence interval, and what alternative explanations might this data also support?',
      bias: 'Confirmation Bias / Hasty Generalization'
    },
    {
      s1: 'Everyone is sharing this — so many people can\'t be wrong!',
      s2: 'Social proof is an influence heuristic, not epistemic evidence. Has any authoritative source independently verified the core claim?',
      bias: 'Bandwagon / Social Proof'
    },
    {
      s1: 'This is labeled BREAKING NEWS and uses ALL CAPS — it must be urgent!',
      s2: 'Urgency formatting is a deliberate psychological trigger. Do the underlying facts warrant this emotional register independent of the typography?',
      bias: 'Urgency Suppression Trigger'
    },
    {
      s1: 'An expert with credentials said this, so it is definitely correct!',
      s2: 'Appeal to authority is not logical evidence. Is this expert\'s field directly relevant? Are there contradicting experts in the same discipline?',
      bias: 'Appeal to Authority'
    },
    {
      s1: 'The mainstream media is not reporting this, which proves they are hiding it!',
      s2: 'Absence of coverage may reflect newsworthiness judgment, legal constraints, or early-stage verification — not deliberate suppression.',
      bias: 'Media Suppression Trope / Conspiracy'
    },
    {
      s1: 'If we allow X, it will inevitably lead to catastrophic Z!',
      s2: 'What specific causal mechanisms link X to Z? Has similar policy been implemented elsewhere, and what was the empirical outcome?',
      bias: 'Slippery Slope Fallacy'
    },
    {
      s1: 'I feel it in my gut — my instinct tells me this is true.',
      s2: 'Gut feelings reflect pattern-matching heuristics built on prior beliefs. What falsifiable evidence would change your assessment?',
      bias: 'Intuition Overconfidence / System 1'
    }
  ],

  AUDIT_QUESTIONS: [
    { id: 'q1', axis: 'affect', text: 'When a headline makes me feel intense anger or disgust, I immediately share or comment before fact-checking.' },
    { id: 'q2', axis: 'affect', text: 'Sensational claims that confirm my moral views feel so obviously true that verifying them seems unnecessary.' },
    { id: 'q3', axis: 'myside', text: 'I apply stricter standards of proof to claims from political opponents than to claims from my own allies.' },
    { id: 'q4', axis: 'myside', text: 'When presented with data contradicting my core beliefs, my first instinct is to assume the study was biased or corrupted.' },
    { id: 'q5', axis: 'authority', text: 'If an article cites a PhD or prominent CEO, I assume the conclusion is scientifically sound without checking methodology.' },
    { id: 'q6', axis: 'authority', text: 'I rarely verify whether an expert is speaking outside their actual domain of academic expertise.' },
    { id: 'q7', axis: 'repetition', text: 'When I see the same claim repeated across multiple social feeds, it begins to feel like established fact.' },
    { id: 'q8', axis: 'repetition', text: 'I struggle to recall where I first heard a piece of viral trivia, even when I accept it as true.' }
  ],

  async init(app) {
    this._app = app;
    this._completedCycles = app.store.get('aftercare.completedCycles', 0);
    this._bindSubTabs();
    console.log('[Aftercare] Initialized.');
  },

  onMount() {
    this._renderPacer();
    this._renderFrictionInterlock();
    this._renderBiasAudit();
    this._renderReframing();
    this._renderIncidentDebrief();
    this._renderJournal();
  },

  onUnmount() {
    this._stopPacer();
    if (this._frictionTimer) clearInterval(this._frictionTimer);
  },

  _bindSubTabs() {
    // Navigation is handled globally by AegisApp.switchSubTab
  },

  // ─────────────────────────────────────────────
  // 1. PACER & RESPIRATORY CHIMES
  // ─────────────────────────────────────────────
  _renderPacer() {
    const container = document.getElementById('subtab-pacer');
    if (!container) return;

    container.innerHTML = `
      <div class="grid-split-2-1">
        <div class="card card-bronze" style="align-items:center;justify-content:center;min-height:420px;display:flex;flex-direction:column;">
          <!-- Mode Selector & Audio Toggle -->
          <div style="display:flex;justify-content:space-between;width:100%;align-items:center;margin-bottom:var(--space-3);flex-wrap:wrap;gap:8px;">
            <div style="display:flex;gap:var(--space-2);" id="pacer-mode-btns">
              ${Object.entries(this.MODES).map(([k, m]) => `
                <button class="btn btn-sm ${k === this._selectedMode ? 'btn-primary' : 'btn-outline'} pacer-mode-btn" data-mode="${k}">
                  ${m.label.split(' ')[0]}
                </button>
              `).join('')}
            </div>
            <button class="btn btn-sm btn-outline" id="btn-pacer-chimes-toggle">
              ${esc(this._chimesEnabled ? '🎵 Chimes: ON' : '🔇 Chimes: OFF')}
            </button>
          </div>

          <!-- Breathing Ring -->
          <div style="position:relative;width:260px;height:260px;display:flex;align-items:center;justify-content:center;" id="pacer-ring-wrap">
            <svg width="260" height="260" viewBox="0 0 260 260" id="pacer-svg">
              <circle cx="130" cy="130" r="118" fill="none" stroke="var(--border-subtle)" stroke-width="1"/>
              <circle cx="130" cy="130" r="95" fill="none" stroke="var(--bronze-primary)" stroke-width="2" stroke-dasharray="3 3" opacity="0.4"/>
              <circle cx="130" cy="130" r="70" id="pacer-ring" fill="none" stroke="var(--bronze-primary)" stroke-width="3"
                      style="transition:r 1s ease, stroke 0.8s ease;"/>
            </svg>
            <div style="position:absolute;text-align:center;">
              <div class="heading-3" id="breathe-phase-text">INHALE</div>
              <div class="font-mono text-bronze" style="font-size:2.2rem;font-weight:700;margin:4px 0;" id="breathe-timer-text">4</div>
              <div class="body-muted" style="font-size:0.7rem;">System 2 Friction Reset</div>
            </div>
          </div>

          <!-- Controls -->
          <div class="flex-row-gap" style="margin-top:var(--space-5);">
            <button class="btn btn-primary" id="btn-start-pacer">Start Breathing Cycle</button>
            <button class="btn btn-secondary" id="btn-reset-pacer">Reset</button>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:var(--space-4);">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">The Physiology of Deception</h3>
              <span class="badge badge-intel">NEUROLOGY</span>
            </div>
            <p class="body-text" style="margin-bottom:var(--space-3);font-size:0.9rem;line-height:1.55;">
              Viral outrage triggers the amygdala, suppressing prefrontal deliberation in under 200 milliseconds. 
              Extending the exhalation cadence activates the vagus nerve, reducing heart rate and restoring rational System 2 capacity.
            </p>
            <blockquote class="quote-classical" style="font-size:0.88rem;">
              "Friction is not hesitation; it is the deliberate refusal to let automated outrage dictate belief."
            </blockquote>
          </div>

          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Session Telemetry</h3>
              <span class="badge badge-bronze">TELEMETRY</span>
            </div>
            <div class="grid-2" style="gap:var(--space-3);">
              <div class="card-granite-inset" style="text-align:center;">
                <div class="status-label text-bronze">SESSION CYCLES</div>
                <div class="metric-value text-emerald" id="pacer-session-cycles">0</div>
              </div>
              <div class="card-granite-inset" style="text-align:center;">
                <div class="status-label text-bronze">TOTAL CYCLES</div>
                <div class="metric-value text-emerald" id="pacer-completed-cycles">${esc(this._completedCycles)}</div>
              </div>
            </div>
            <div class="body-muted" style="margin-top:var(--space-3);font-size:0.78rem;">4 cycles recommended prior to high-stakes claim analysis.</div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-pacer-chimes-toggle')?.addEventListener('click', () => {
      this._chimesEnabled = !this._chimesEnabled;
      const btn = document.getElementById('btn-pacer-chimes-toggle');
      if (btn) btn.textContent = this._chimesEnabled ? '🎵 Chimes: ON' : '🔇 Chimes: OFF';
      if (this._chimesEnabled) TacticalAudio.playSelect();
    });

    document.getElementById('btn-start-pacer')?.addEventListener('click', () => this._togglePacer());
    document.getElementById('btn-reset-pacer')?.addEventListener('click', () => this._resetPacer());
    document.querySelectorAll('.pacer-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._stopPacer();
        this._selectedMode = btn.getAttribute('data-mode');
        this._phaseIndex = 0;
        document.querySelectorAll('.pacer-mode-btn').forEach(b => b.classList.remove('btn-primary'));
        btn.classList.add('btn-primary');
        const startBtn = document.getElementById('btn-start-pacer');
        if (startBtn) startBtn.textContent = 'Start Breathing Cycle';
        const phaseText = document.getElementById('breathe-phase-text');
        if (phaseText) phaseText.textContent = this.MODES[this._selectedMode].phases[0].name;
        const timerText = document.getElementById('breathe-timer-text');
        if (timerText) timerText.textContent = this.MODES[this._selectedMode].phases[0].seconds;
        this._setPacerRing(70, 'var(--bronze-primary)');
      });
    });
  },

  _togglePacer() {
    if (this._pacerRunning) this._stopPacer();
    else this._startPacer();
  },

  _startPacer() {
    this._pacerRunning = true;
    const startBtn = document.getElementById('btn-start-pacer');
    if (startBtn) startBtn.textContent = 'Pause Cycle';

    const mode = this.MODES[this._selectedMode];
    const phases = mode.phases;
    let sessionCycles = parseInt(document.getElementById('pacer-session-cycles')?.textContent || '0');

    const tick = () => {
      const phase = phases[this._phaseIndex];
      const phaseText = document.getElementById('breathe-phase-text');
      const timerText = document.getElementById('breathe-timer-text');

      if (!this._pacerRunning) return;

      if (phaseText) phaseText.textContent = phase.name;

      // Audio chimes
      if (this._chimesEnabled) {
        if (phase.chime === 'inhale') TacticalAudio.playInhaleChime(phase.seconds);
        else if (phase.chime === 'hold') TacticalAudio.playHoldChime(phase.seconds);
        else if (phase.chime === 'exhale') TacticalAudio.playExhaleChime(phase.seconds);
      }

      // Animate ring
      const targetR = Math.round(40 + phase.scale * 55);
      this._setPacerRing(targetR, phase.color);

      let remaining = phase.seconds;
      if (timerText) timerText.textContent = remaining;

      const countdown = setInterval(() => {
        if (!this._pacerRunning) { clearInterval(countdown); return; }
        remaining--;
        if (timerText) timerText.textContent = remaining;
        if (remaining <= 0) {
          clearInterval(countdown);
          this._phaseIndex = (this._phaseIndex + 1) % phases.length;

          if (this._phaseIndex === 0) {
            sessionCycles++;
            this._completedCycles++;
            const sc = document.getElementById('pacer-session-cycles');
            const tc = document.getElementById('pacer-completed-cycles');
            if (sc) sc.textContent = sessionCycles;
            if (tc) tc.textContent = this._completedCycles;
            this._app.store.set('aftercare.completedCycles', this._completedCycles);

            if (this._completedCycles % 4 === 0) {
              TacticalAudio.playVictory();
              this._app.showToast({ type: 'success', title: 'COGNITIVE EQUILIBRIUM RESTORED', message: '4 breathing cycles completed. System 2 fully armed.' });
            }
          }

          if (this._pacerRunning) tick();
        }
      }, 1000);

      this._pacerTimer = countdown;
    };

    tick();
  },

  _stopPacer() {
    this._pacerRunning = false;
    if (this._pacerTimer) { clearInterval(this._pacerTimer); this._pacerTimer = null; }
    const startBtn = document.getElementById('btn-start-pacer');
    if (startBtn) startBtn.textContent = 'Resume Cycle';
  },

  _resetPacer() {
    this._stopPacer();
    this._phaseIndex = 0;
    const mode = this.MODES[this._selectedMode];
    const phaseText = document.getElementById('breathe-phase-text');
    const timerText = document.getElementById('breathe-timer-text');
    if (phaseText) phaseText.textContent = mode.phases[0].name;
    if (timerText) timerText.textContent = mode.phases[0].seconds;
    this._setPacerRing(70, 'var(--bronze-primary)');
    const startBtn = document.getElementById('btn-start-pacer');
    if (startBtn) startBtn.textContent = 'Start Breathing Cycle';
    const sc = document.getElementById('pacer-session-cycles');
    if (sc) sc.textContent = '0';
  },

  _setPacerRing(radius, color) {
    const ring = document.getElementById('pacer-ring');
    if (ring) {
      ring.setAttribute('r', radius);
      ring.setAttribute('stroke', color);
    }
  },

  // ─────────────────────────────────────────────
  // 2. 15-SECOND COGNITIVE FRICTION INTERLOCK
  // ─────────────────────────────────────────────
  _renderFrictionInterlock() {
    const container = document.getElementById('subtab-friction');
    if (!container) return;

    container.innerHTML = `
      <div class="card card-bronze" style="max-width:840px;margin:0 auto;padding:28px 24px;">
        <div class="card-header" style="margin-bottom:16px;">
          <div>
            <div class="status-label text-amber">PENNYCOOK-RAND FRICTION PROTOCOL</div>
            <h3 class="heading-3" style="margin:2px 0 0 0;">The 15-Second Deliberation Interlock</h3>
          </div>
          <span class="badge badge-suspicion">ANTI-CONTAGION SHIELD</span>
        </div>
        <p class="body-text" style="font-size:0.9rem;line-height:1.55;color:var(--stone-light);margin-bottom:20px;">
          Empirical cognitive science shows that introducing a mandatory <strong>15-second deliberative pause</strong> before sharing, reacting, or endorsing breaking claims drops emotional contagion by 55%.
        </p>

        <!-- Input Claim -->
        <div class="form-group" style="margin-bottom:20px;">
          <label class="form-label">Paste Viral Claim, Outrage Headline, or Breaking Alert:</label>
          <textarea class="form-input" id="friction-claim-input" rows="2" placeholder="e.g. BREAKING: Secret memo reveals government agency intentionally poisoned city water supply..."></textarea>
        </div>

        <!-- Timer & 3-Point Checklist Stage -->
        <div id="friction-stage" style="display:flex;flex-direction:column;align-items:center;gap:16px;margin-bottom:20px;">
          <button class="btn btn-primary btn-lg" id="btn-start-friction" style="padding:12px 32px;font-size:1rem;">
            ⏳ Engage 15-Second Deliberation Interlock
          </button>
          
          <div id="friction-timer-wrap" class="hidden" style="text-align:center;">
            <div class="font-mono text-amber" style="font-size:3rem;font-weight:700;" id="friction-timer-val">15s</div>
            <div class="status-label text-muted">SYSTEM 1 IMPULSE LOCKOUT ACTIVE</div>
          </div>
        </div>

        <!-- 3-Point Pre-Flight Verification Checklist -->
        <div class="card-granite-inset" style="padding:16px;margin-bottom:20px;">
          <div class="status-label text-bronze" style="font-size:0.75rem;margin-bottom:10px;">MANDATORY 3-POINT PRE-FLIGHT VERIFICATION</div>
          <div style="display:flex;flex-direction:column;gap:10px;font-size:0.88rem;">
            <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;">
              <input type="checkbox" id="check-friction-1" class="friction-check" disabled>
              <span><strong>1. Affect Check:</strong> Is this claim engineered to provoke acute physiological anger, fear, or tribal vindication?</span>
            </label>
            <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;">
              <input type="checkbox" id="check-friction-2" class="friction-check" disabled>
              <span><strong>2. Provenance Check:</strong> Is there an uncropped primary document, or is this an inspect-element screenshot / anonymous leak?</span>
            </label>
            <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;">
              <input type="checkbox" id="check-friction-3" class="friction-check" disabled>
              <span><strong>3. Beneficiary Check:</strong> Who financially, algorithmically, or geopolitically gains if I react before verification?</span>
            </label>
          </div>
        </div>

        <!-- Action Result -->
        <div id="friction-result-box" class="hidden card-granite-inset" style="border-left:3px solid var(--veracity-green);padding:16px;">
          <div class="status-label text-emerald" style="margin-bottom:6px;">✓ COGNITIVE EQUILIBRIUM RESTORED</div>
          <p class="body-text" style="font-size:0.9rem;margin-bottom:12px;">
            Prefrontal cortex deliberation is fully re-engaged. You are ready to analyze this claim objectively.
          </p>
          <div class="flex-row-gap" style="gap:10px;">
            <button class="btn btn-primary" id="btn-friction-to-verdad">Send to VERDAD NLP Analyzer →</button>
            <button class="btn btn-secondary" id="btn-friction-pin-dossier">📌 Pin to Dossier</button>
          </div>
        </div>
      </div>
    `;

    const startBtn = document.getElementById('btn-start-friction');
    const timerWrap = document.getElementById('friction-timer-wrap');
    const timerVal = document.getElementById('friction-timer-val');
    const checks = container.querySelectorAll('.friction-check');
    const resultBox = document.getElementById('friction-result-box');

    startBtn?.addEventListener('click', () => {
      const claim = document.getElementById('friction-claim-input')?.value?.trim();
      if (!claim) {
        this._app?.showToast({ type: 'warning', title: 'CLAIM REQUIRED', message: 'Enter a headline or statement first.' });
        return;
      }

      startBtn.classList.add('hidden');
      timerWrap?.classList.remove('hidden');
      resultBox?.classList.add('hidden');
      checks.forEach(c => { c.disabled = false; c.checked = false; });

      this._frictionSec = 15;
      if (timerVal) timerVal.textContent = '15s';
      TacticalAudio.playPulse();

      if (this._frictionTimer) clearInterval(this._frictionTimer);

      this._frictionTimer = setInterval(() => {
        this._frictionSec--;
        if (timerVal) timerVal.textContent = `${this._frictionSec}s`;

        if (this._frictionSec <= 0) {
          clearInterval(this._frictionTimer);
          timerWrap?.classList.add('hidden');
          resultBox?.classList.remove('hidden');
          TacticalAudio.playShield();
          this._app?.showToast({ type: 'success', title: 'FRICTION COMPLETE', message: 'Deliberation window concluded. System 2 armed.' });
        }
      }, 1000);
    });

    document.getElementById('btn-friction-to-verdad')?.addEventListener('click', () => {
      const claim = document.getElementById('friction-claim-input')?.value?.trim();
      if (claim) {
        const verdadInput = document.getElementById('textarea-verdad-claim') || document.getElementById('verdad-claim-input');
        if (verdadInput) verdadInput.value = claim;
        this._app.switchTab('verdad');
      }
    });

    document.getElementById('btn-friction-pin-dossier')?.addEventListener('click', () => {
      const claim = document.getElementById('friction-claim-input')?.value?.trim();
      if (claim) {
        window.dispatchEvent(new CustomEvent('aegis:pin', {
          detail: {
            source: '15-Second Friction Interlock',
            title: 'Friction Audit: ' + claim.substring(0, 45) + '...',
            content: `CLAIM EVALUATED UNDER 15s FRICTION LOCKOUT:\n"${claim}"\n\nSTATUS: 3-Point Pre-Flight Verification complete. System 1 emotional override averted.`
          }
        }));
        TacticalAudio.playShield();
        this._app?.showToast({ type: 'success', title: 'PINNED TO DOSSIER', message: 'Friction record saved.' });
      }
    });
  },

  // ─────────────────────────────────────────────
  // 3. BIAS SUSCEPTIBILITY AUDIT
  // ─────────────────────────────────────────────
  _renderBiasAudit() {
    const container = document.getElementById('subtab-audit');
    if (!container) return;

    container.innerHTML = `
      <div class="card" style="max-width:860px;margin:0 auto;padding:24px;">
        <div class="card-header" style="margin-bottom:16px;">
          <div>
            <div class="status-label text-intel">COGNITIVE BLIND SPOT PROFILE</div>
            <h3 class="heading-3" style="margin:2px 0 0 0;">Epistemic Susceptibility Audit</h3>
          </div>
          <span class="badge badge-intel">8-QUESTION SCAN</span>
        </div>
        <p class="body-text" style="font-size:0.9rem;color:var(--stone-light);margin-bottom:20px;">
          Rate your intuitive reactions honestly on a 1 (Never) to 5 (Always) scale to map your psychological susceptibility to influence operations.
        </p>

        <form id="audit-form" style="display:flex;flex-direction:column;gap:14px;">
          ${this.AUDIT_QUESTIONS.map((q, idx) => `
            <div class="card-granite-inset" style="padding:14px;">
              <div style="font-size:0.9rem;color:var(--parchment-bright);margin-bottom:10px;">
                <strong>${idx + 1}.</strong> ${q.text}
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-family:var(--font-mono);font-size:0.78rem;">
                <span style="color:var(--stone-warm);">1 (Never)</span>
                <div style="display:flex;gap:14px;">
                  ${[1, 2, 3, 4, 5].map(v => `
                    <label style="cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;">
                      <input type="radio" name="${esc(q.id)}" value="${esc(v)}" ${esc(v === 2 ? 'checked' : '')}>
                      <span>${esc(v)}</span>
                    </label>
                  `).join('')}
                </div>
                <span style="color:var(--stone-warm);">5 (Always)</span>
              </div>
            </div>
          `).join('')}

          <div style="text-align:center;margin-top:10px;">
            <button type="button" class="btn btn-primary btn-lg" id="btn-compute-audit">
              📊 Compute Epistemic Vulnerability Profile
            </button>
          </div>
        </form>

        <!-- Results Breakdown -->
        <div id="audit-results-card" class="hidden card-granite-inset" style="margin-top:24px;padding:20px;border-left:3px solid var(--bronze-primary);">
          <div class="status-label text-bronze" style="margin-bottom:8px;">YOUR COGNITIVE DEFENSE MATRIX</div>
          <h4 class="heading-4" style="margin-bottom:16px;">Vulnerability Scan Results</h4>

          <div class="grid-2" style="gap:16px;margin-bottom:20px;">
            <div>
              <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:4px;">
                <span>Affect / Outrage Reactivity:</span>
                <strong id="score-affect" class="text-amber">--%</strong>
              </div>
              <div class="progress-bar"><div class="progress-fill progress-fill-crimson" id="bar-affect" style="width:0%;"></div></div>
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:4px;">
                <span>Myside / Confirmation Bias:</span>
                <strong id="score-myside" class="text-amber">--%</strong>
              </div>
              <div class="progress-bar"><div class="progress-fill progress-fill-cyan" id="bar-myside" style="width:0%;"></div></div>
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:4px;">
                <span>Authority Deference Bias:</span>
                <strong id="score-authority" class="text-amber">--%</strong>
              </div>
              <div class="progress-bar"><div class="progress-fill progress-fill-emerald" id="bar-authority" style="width:0%;"></div></div>
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:4px;">
                <span>Illusory Truth & Repetition:</span>
                <strong id="score-repetition" class="text-amber">--%</strong>
              </div>
              <div class="progress-bar"><div class="progress-fill" id="bar-repetition" style="width:0%;background:var(--bronze-primary);"></div></div>
            </div>
          </div>

          <div id="audit-recommendation" class="body-text" style="font-size:0.9rem;line-height:1.55;background:var(--bg-surface);padding:14px;border-radius:var(--radius-sm);margin-bottom:16px;">
            <!-- Customized prescription -->
          </div>

          <div class="flex-row-gap" style="justify-content:flex-end;">
            <button class="btn btn-secondary" id="btn-pin-audit-dossier">📌 Pin Vulnerability Profile to Dossier</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-compute-audit')?.addEventListener('click', () => {
      let affectSum = 0, mysideSum = 0, authSum = 0, repSum = 0;

      this.AUDIT_QUESTIONS.forEach(q => {
        const val = parseInt(document.querySelector(`input[name="${q.id}"]:checked`)?.value || '3', 10);
        if (q.axis === 'affect') affectSum += val;
        else if (q.axis === 'myside') mysideSum += val;
        else if (q.axis === 'authority') authSum += val;
        else if (q.axis === 'repetition') repSum += val;
      });

      // Scale to percentage (min 2 = 0%, max 10 = 100%)
      const toPct = (sum) => Math.round(((sum - 2) / 8) * 100);
      const pAffect = toPct(affectSum);
      const pMyside = toPct(mysideSum);
      const pAuth = toPct(authSum);
      const pRep = toPct(repSum);

      document.getElementById('score-affect').textContent = `${pAffect}%`;
      document.getElementById('score-myside').textContent = `${pMyside}%`;
      document.getElementById('score-authority').textContent = `${pAuth}%`;
      document.getElementById('score-repetition').textContent = `${pRep}%`;

      document.getElementById('bar-affect').style.width = `${pAffect}%`;
      document.getElementById('bar-myside').style.width = `${pMyside}%`;
      document.getElementById('bar-authority').style.width = `${pAuth}%`;
      document.getElementById('bar-repetition').style.width = `${pRep}%`;

      let topRisk = 'Affect / Outrage Reactivity';
      let maxP = pAffect;
      if (pMyside > maxP) { topRisk = 'Myside / Confirmation Bias'; maxP = pMyside; }
      if (pAuth > maxP) { topRisk = 'Authority Deference Bias'; maxP = pAuth; }
      if (pRep > maxP) { topRisk = 'Illusory Truth & Repetition'; maxP = pRep; }

      const recBox = document.getElementById('audit-recommendation');
      if (recBox) {
        recBox.innerHTML = `
          <strong>Primary Vulnerability Detected: <span class="text-amber">${esc(topRisk)} (${esc(maxP)}%)</span></strong><br>
          <em>Tailored Inoculation Protocol:</em> You are most vulnerable to influence payloads formatted as urgent moral indignation. Implement the <strong>15-Second Friction Interlock</strong> before retweeting breaking stories, and always search for the opposing steel-manned counter-argument.
        `;
      }

      document.getElementById('audit-results-card')?.classList.remove('hidden');
      TacticalAudio.playShield();
      this._app?.showToast({ type: 'success', title: 'AUDIT COMPUTED', message: `Primary risk: ${topRisk}` });
    });

    document.getElementById('btn-pin-audit-dossier')?.addEventListener('click', () => {
      const aff = document.getElementById('score-affect')?.textContent;
      const mys = document.getElementById('score-myside')?.textContent;
      const aut = document.getElementById('score-authority')?.textContent;
      const rep = document.getElementById('score-repetition')?.textContent;

      window.dispatchEvent(new CustomEvent('aegis:pin', {
        detail: {
          source: 'Epistemic Susceptibility Audit',
          title: 'Personal Cognitive Vulnerability Profile',
          content: `EPISTEMIC BIAS AUDIT RESULTS:\n- Affect / Outrage: ${aff}\n- Myside / Confirmation: ${mys}\n- Authority Deference: ${aut}\n- Illusory Truth / Repetition: ${rep}`
        }
      }));
      TacticalAudio.playShield();
      this._app?.showToast({ type: 'success', title: 'PINNED TO DOSSIER', message: 'Bias audit profile saved.' });
    });
  },

  // ─────────────────────────────────────────────
  // 4. REFRAMING DRILLS
  // ─────────────────────────────────────────────
  _renderReframing() {
    const container = document.getElementById('subtab-reframing');
    if (!container) return;

    let currentIdx = 0;

    const render = () => {
      const pair = this.REFRAMING_PAIRS[currentIdx];
      container.innerHTML = `
        <div class="card" style="margin-bottom:var(--space-4);">
          <div class="card-header">
            <h3 class="card-title">Epistemic Reframing Drills</h3>
            <div class="flex-row-gap">
              <span class="badge badge-neutral">${esc(currentIdx + 1)} / ${esc(this.REFRAMING_PAIRS.length)}</span>
              <span class="badge badge-disinfo">${esc(pair.bias)}</span>
            </div>
          </div>
          <div class="grid-2" style="margin-bottom:var(--space-4);">
            <div class="card card-granite-inset" style="border-left:3px solid var(--disinfo-crimson);">
              <div class="status-label text-crimson" style="margin-bottom:var(--space-2);">REACTIVE IMPULSE (SYSTEM 1)</div>
              <h4 class="heading-4" style="margin:var(--space-2) 0;font-style:italic;line-height:1.5;">"${esc(pair.s1)}"</h4>
              <p class="body-muted" style="font-size:0.82rem;">Emotional trigger: ${esc(pair.bias)}</p>
            </div>
            <div class="card card-granite-inset" style="border-left:3px solid var(--veracity-green);">
              <div class="status-label text-emerald" style="margin-bottom:var(--space-2);">EPISTEMIC REFRAME (SYSTEM 2)</div>
              <h4 class="heading-4" style="margin:var(--space-2) 0;line-height:1.5;color:var(--parchment-bright);">"${esc(pair.s2)}"</h4>
              <p class="body-muted" style="font-size:0.82rem;">Rational inquiry: Source verification, intent analysis, alternative hypotheses.</p>
            </div>
          </div>
          <div class="flex-row-gap" style="justify-content:center;">
            <button class="btn btn-secondary" id="btn-prev-reframe" ${esc(currentIdx === 0 ? 'disabled' : '')}>← Previous</button>
            <button class="btn btn-primary" id="btn-shuffle-reframe">Shuffle Randomly</button>
            <button class="btn btn-secondary" id="btn-next-reframe" ${esc(currentIdx === this.REFRAMING_PAIRS.length - 1 ? 'disabled' : '')}>Next →</button>
          </div>
        </div>

        <!-- Custom Reframing Tool -->
        <div class="card card-bronze">
          <div class="card-header">
            <h3 class="card-title">Personal Reframing Generator</h3>
            <span class="badge badge-veracity">TRIGGER DETECTOR</span>
          </div>
          <p class="body-text" style="margin-bottom:var(--space-3);font-size:0.9rem;">
            Enter your raw System 1 reactive thought to automatically detect cognitive triggers and generate a structured epistemic counter-question.
          </p>
          <div class="form-group">
            <label class="form-label">Your reactive thought or emotional response:</label>
            <textarea class="form-textarea" id="custom-s1-input" placeholder="e.g. I feel furious reading this headline — they must be totally corrupt..." rows="2"></textarea>
          </div>
          <button class="btn btn-primary" id="btn-generate-reframe">Generate System 2 Reframe</button>
          <div id="custom-reframe-result" style="display:none;margin-top:var(--space-4);"></div>
        </div>
      `;

      document.getElementById('btn-prev-reframe')?.addEventListener('click', () => { currentIdx--; render(); });
      document.getElementById('btn-next-reframe')?.addEventListener('click', () => { currentIdx++; render(); });
      document.getElementById('btn-shuffle-reframe')?.addEventListener('click', () => {
        let next;
        do { next = Math.floor(Math.random() * this.REFRAMING_PAIRS.length); } while (next === currentIdx && this.REFRAMING_PAIRS.length > 1);
        currentIdx = next;
        render();
      });

      document.getElementById('btn-generate-reframe')?.addEventListener('click', () => {
        const input = document.getElementById('custom-s1-input')?.value?.trim();
        if (!input) return;
        const triggers = this._detectTriggers(input);
        const reframe = this._generateReframe(input, triggers);
        const result = document.getElementById('custom-reframe-result');
        if (result) {
          result.style.display = 'block';
          result.innerHTML = `
            <div class="card-granite-inset" style="border-left:3px solid var(--veracity-green);padding:16px;">
              <div class="status-label text-emerald" style="margin-bottom:var(--space-2);">SYSTEM 2 EPISTEMIC REFRAME:</div>
              ${triggers.length ? `<div style="margin-bottom:var(--space-2);">
                <span class="body-muted" style="font-size:0.8rem;">Detected triggers: </span>
                ${triggers.map(t => `<span class="badge badge-suspicion" style="margin-right:4px;">#${esc(t)}</span>`).join('')}
              </div>` : ''}
              <p class="body-text" style="font-style:italic;font-size:0.95rem;color:var(--parchment-bright);">"${esc(reframe)}"</p>
            </div>
          `;
          TacticalAudio.playShield();
        }
      });
    };

    render();
  },

  _detectTriggers(text) {
    const t = text.toLowerCase();
    const triggers = [];
    if (/outrage|infuriated|outraged|disgusting|evil|corrupt|furious/.test(t)) triggers.push('Outrage');
    if (/everyone|everybody|nobody|all people/.test(t)) triggers.push('Bandwagon');
    if (/breaking|urgent|immediately|right now|hurry/.test(t)) triggers.push('Urgency');
    if (/they hide|they don't want|secret|coverup|suppressed/.test(t)) triggers.push('Conspiracy');
    if (/expert|scientist|doctor|authority|top official/.test(t)) triggers.push('Authority');
    if (/definitely|certainly|proven|obvious|undeniable/.test(t)) triggers.push('Overconfidence');
    return triggers;
  },

  _generateReframe(text, triggers) {
    if (triggers.includes('Urgency')) return 'The urgency formatting here may be an intentional System 1 bypass trigger. What do the primary facts look like once time pressure is removed?';
    if (triggers.includes('Conspiracy')) return 'Suppression narratives require verifiable evidence of institutional concealment. What open public records substantiate this alleged cover-up?';
    if (triggers.includes('Outrage')) return 'Notice the intense moral indignation this induces. What specific factual proposition is embedded in this emotional frame, and what independent evidence verifies it?';
    if (triggers.includes('Authority')) return 'Is this credentialed expert publishing in their primary domain of empirical study, and do peer-reviewed meta-analyses corroborate their assertion?';
    return 'What incentives might motivate the creator of this narrative, and what falsifiable evidence would be required to distinguish this claim from its opposite?';
  },

  // ─────────────────────────────────────────────
  // 5. INCIDENT POST-MORTEM DEBRIEF
  // ─────────────────────────────────────────────
  _renderIncidentDebrief() {
    const container = document.getElementById('subtab-incident');
    if (!container) return;

    let incidents = [];
    try {
      const stored = this._app.store.get('aftercare.incidents');
      if (stored) incidents = JSON.parse(stored);
    } catch (e) {}

    container.innerHTML = `
      <div class="grid-split-2-1" style="align-items:flex-start;">
        <div class="card card-bronze">
          <div class="card-header">
            <div>
              <div class="status-label text-bronze">EPISTEMIC INCIDENT ANALYSIS</div>
              <h3 class="card-title">Deception Post-Mortem Debrief</h3>
            </div>
            <span class="badge badge-suspicion">AAR PROTOCOL</span>
          </div>
          <p class="body-text" style="font-size:0.85rem;color:var(--stone-light);margin-bottom:16px;">
            Deconstruct a misleading narrative, false claim, or viral rumor you previously fell for or reacted to in haste.
          </p>

          <div class="form-group">
            <label class="form-label">1. Narrative / Claim Description:</label>
            <input type="text" id="inc-claim" class="form-input" placeholder="e.g. Viral video claiming bank runs in Chicago...">
          </div>

          <div class="form-group">
            <label class="form-label">2. The Psychological Hook (Why did it bypass skepticism?):</label>
            <textarea id="inc-hook" class="form-textarea" rows="2" placeholder="e.g. It triggered financial fear and matched my existing skepticism of regional lenders..."></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">3. The Broken Verification Link (What check was omitted?):</label>
            <textarea id="inc-broken" class="form-textarea" rows="2" placeholder="e.g. I accepted a cropped screenshot without cross-checking the Federal Reserve liquidity status page..."></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">4. The Corrective Inoculation Rule (One rule to prevent recurrence):</label>
            <input type="text" id="inc-rule" class="form-input" placeholder="e.g. Never act on banking screenshots without checking authenticated API feeds.">
          </div>

          <div class="flex-row-gap" style="justify-content:flex-end;margin-top:12px;">
            <button class="btn btn-primary" id="btn-save-incident">Save Incident Analysis →</button>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Past Incident Debriefs</h3>
            <span class="badge badge-neutral" id="inc-count-badge">${esc(incidents.length)} ARCHIVED</span>
          </div>
          <div id="incidents-feed" style="display:flex;flex-direction:column;gap:12px;max-height:480px;overflow-y:auto;">
            ${incidents.length === 0 ? '<div class="body-muted" style="text-align:center;padding:24px 0;">No incident reports logged. Deconstruct a past deception to inoculate future judgment.</div>' : ''}
            ${incidents.map((inc, i) => `
              <div class="card-granite-inset" style="padding:12px;border-left:3px solid var(--amber-mid);">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
                  <strong style="color:var(--parchment-bright);font-size:0.9rem;">${inc.claim}</strong>
                  <button class="btn btn-sm btn-outline btn-pin-inc" data-idx="${i}" style="font-size:0.7rem;">📌 Pin</button>
                </div>
                <div style="font-size:0.8rem;color:var(--stone-light);margin-bottom:4px;"><strong>Hook:</strong> ${inc.hook}</div>
                <div style="font-size:0.8rem;color:var(--emerald-bright);"><strong>Rule:</strong> "${inc.rule}"</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-save-incident')?.addEventListener('click', () => {
      const claim = document.getElementById('inc-claim')?.value?.trim();
      const hook = document.getElementById('inc-hook')?.value?.trim();
      const broken = document.getElementById('inc-broken')?.value?.trim();
      const rule = document.getElementById('inc-rule')?.value?.trim();

      if (!claim || !hook || !rule) {
        this._app?.showToast({ type: 'warning', title: 'FIELDS REQUIRED', message: 'Please fill in claim, hook, and rule.' });
        return;
      }

      const newInc = { id: 'inc-' + Date.now(), claim, hook, broken, rule, date: new Date().toISOString() };
      incidents.unshift(newInc);
      this._app.store.set('aftercare.incidents', JSON.stringify(incidents));

      TacticalAudio.playShield();
      this._app?.showToast({ type: 'success', title: 'INCIDENT LOGGED', message: 'Debrief archived and rule locked.' });
      this._renderIncidentDebrief();
    });

    container.querySelectorAll('.btn-pin-inc').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        const inc = incidents[idx];
        if (inc) {
          window.dispatchEvent(new CustomEvent('aegis:pin', {
            detail: {
              source: 'Epistemic Incident Debrief',
              title: `Incident: ${inc.claim.substring(0, 45)}...`,
              content: `DECEPTION POST-MORTEM:\nCLAIM: "${inc.claim}"\nHOOK: ${inc.hook}\nBROKEN LINK: ${inc.broken || 'N/A'}\nINOCULATION RULE: "${inc.rule}"`
            }
          }));
          TacticalAudio.playShield();
          this._app?.showToast({ type: 'success', title: 'PINNED TO DOSSIER', message: 'Incident debrief saved.' });
        }
      });
    });
  },

  // ─────────────────────────────────────────────
  // 6. DEBIASING JOURNAL DECK
  // ─────────────────────────────────────────────
  _renderJournal() {
    const container = document.getElementById('subtab-journal');
    if (!container) return;

    let entries = [];
    try {
      const stored = this._app.store.get('aftercare.journal');
      if (stored) entries = JSON.parse(stored);
    } catch (e) {}

    container.innerHTML = `
      <div class="grid-split-2-1" style="align-items:flex-start;">
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Epistemic Debiasing Reflection Deck</h3>
              <div class="status-label text-muted" style="font-size:0.75rem;">STRUCTURED SYSTEM 2 INQUIRY</div>
            </div>
            <span class="badge badge-bronze">LOCAL STORAGE</span>
          </div>

          <div class="form-group">
            <label class="form-label">Claim or Narrative Under Review:</label>
            <input type="text" class="form-input" id="journal-claim" placeholder="e.g. Viral claim regarding clinical trial cure...">
          </div>

          <div class="form-group">
            <label class="form-label">Primary Cognitive Bias Vector:</label>
            <select class="form-select" id="journal-bias-select">
              <option value="Outrage / Affect Heuristic">#Outrage / Affect Heuristic</option>
              <option value="Confirmation Bias">#Confirmation Bias</option>
              <option value="Hasty Generalization">#Hasty Generalization</option>
              <option value="Social Proof / Bandwagon">#Social Proof / Bandwagon</option>
              <option value="Appeal to False Authority">#Appeal to False Authority</option>
              <option value="Slippery Slope">#Slippery Slope</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">1. What specific emotion was triggered upon reading?</label>
            <input type="text" class="form-input" id="journal-q0" placeholder="e.g. Anger, tribal defensiveness, anxiety...">
          </div>

          <div class="form-group">
            <label class="form-label">2. What unstated assumptions or omitted context exist?</label>
            <textarea class="form-textarea" id="journal-q1" rows="2" placeholder="List at least two plausible alternative explanations..."></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">3. What primary verifiable sources could test this claim?</label>
            <input type="text" class="form-input" id="journal-q2" placeholder="e.g. ClinicalTrials.gov, SEC filings, primary video transcript...">
          </div>

          <div class="flex-row-gap" style="justify-content:flex-end;margin-top:12px;">
            <button class="btn btn-outline" id="btn-export-journal">Export JSON</button>
            <button class="btn btn-primary" id="btn-save-journal">Save Reflection Entry</button>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Saved Reflections</h3>
            <span class="badge badge-neutral" id="journal-count-badge">${esc(entries.length)} ENTRIES</span>
          </div>
          <div id="journal-entries-list" style="display:flex;flex-direction:column;gap:12px;max-height:520px;overflow-y:auto;">
            ${entries.length === 0 ? '<div class="body-muted" style="text-align:center;padding:24px 0;">No reflection entries recorded yet.</div>' : ''}
            ${entries.map((e, idx) => `
              <div class="card-granite-inset" style="padding:12px;border-left:3px solid var(--emerald-border);">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
                  <span class="badge badge-intel" style="font-size:0.65rem;">${e.bias || '#Debiasing'}</span>
                  <div style="display:flex;gap:6px;">
                    <button class="btn btn-sm btn-outline btn-pin-journal" data-idx="${idx}" style="font-size:0.7rem;">📌</button>
                    <button class="btn btn-sm btn-outline btn-del-journal" data-idx="${idx}" style="font-size:0.7rem;">×</button>
                  </div>
                </div>
                <h5 style="color:var(--parchment-bright);font-size:0.88rem;margin:4px 0;">"${e.claim}"</h5>
                <p class="body-text" style="font-size:0.8rem;color:var(--stone-light);margin-top:4px;">${e.q1 || ''}</p>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-save-journal')?.addEventListener('click', () => {
      const claim = document.getElementById('journal-claim')?.value?.trim();
      const bias = document.getElementById('journal-bias-select')?.value;
      const q0 = document.getElementById('journal-q0')?.value?.trim();
      const q1 = document.getElementById('journal-q1')?.value?.trim();
      const q2 = document.getElementById('journal-q2')?.value?.trim();

      if (!claim) {
        this._app?.showToast({ type: 'warning', title: 'CLAIM REQUIRED', message: 'Enter the claim you are reviewing.' });
        return;
      }

      entries.unshift({
        id: 'entry-' + Date.now(),
        claim,
        bias,
        q0,
        q1,
        q2,
        date: new Date().toISOString()
      });

      this._app.store.set('aftercare.journal', JSON.stringify(entries));
      TacticalAudio.playShield();
      this._app?.showToast({ type: 'success', title: 'REFLECTION SAVED', message: 'Journal entry stored locally.' });
      this._renderJournal();
    });

    document.getElementById('btn-export-journal')?.addEventListener('click', () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(entries, null, 2));
      const dlAnchorElem = document.createElement('a');
      dlAnchorElem.setAttribute("href", dataStr);
      dlAnchorElem.setAttribute("download", `sovereign_debiasing_journal_${Date.now()}.json`);
      dlAnchorElem.click();
    });

    container.querySelectorAll('.btn-pin-journal').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        const e = entries[idx];
        if (e) {
          window.dispatchEvent(new CustomEvent('aegis:pin', {
            detail: {
              source: 'Debiasing Reflection Deck',
              title: `Journal: ${e.claim.substring(0, 45)}...`,
              content: `DEBIASING JOURNAL REFLECTION [${e.bias}]:\nCLAIM: "${e.claim}"\nTRIGGER: ${e.q0 || 'N/A'}\nANALYSIS: ${e.q1 || 'N/A'}\nPRIMARY SOURCES: ${e.q2 || 'N/A'}`
            }
          }));
          TacticalAudio.playShield();
          this._app?.showToast({ type: 'success', title: 'PINNED TO DOSSIER', message: 'Journal reflection saved.' });
        }
      });
    });

    container.querySelectorAll('.btn-del-journal').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        entries.splice(idx, 1);
        this._app.store.set('aftercare.journal', JSON.stringify(entries));
        this._renderJournal();
      });
    });
  }
};
