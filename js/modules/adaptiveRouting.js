/**
 * SOVEREIGN // AEGIS — Adaptive Routing & Progressive Placement Engine
 *
 * Responsibilities:
 *  1. Canonical Diagnostic Placement Questions (4 foundational probes).
 *  2. Diagnostic placement scoring & routing decision tree (assigns initial track & start subtab).
 *  3. Advisory Prerequisites map for advanced subtabs across all pillars.
 *  4. Non-blocking gate evaluation preserving the Open Access Principle.
 *  5. Safe, accessible advisory banner markup generation with one-click training shortcuts.
 *
 * Zero external runtime dependencies. Pure mathematical and rendering logic.
 *
 * @module adaptiveRouting
 */

import { esc } from '../security.js';
import { CONFIDENCE_LEVELS } from '../competency.js';

/**
 * Canonical 4-question Diagnostic Placement probe.
 * Evaluates core cognitive defenses: SIFT Stop, Relevance Fallacy,
 * Structural Logic, and Coordinated Inauthentic Disinformation (DISARM).
 */
export const DIAGNOSTIC_QUESTIONS = Object.freeze([
  {
    id: 'diag_sift_stop',
    skillId: 'skill.sift.stop',
    prompt: 'A breaking post appears on your feed: "BREAKING: Leaked documents prove water supply in major metro contaminated; city officials caught hiding test results!" Attached is a low-res image of a water plant. Your immediate internal reaction is alarm and urgency to warn friends. What is the single most critical immediate action?',
    options: [
      'Immediately quote-tweet and share to alert family before it gets taken down',
      'Stop, notice your emotional arousal, and pause before reacting or amplifying',
      'Reply to the post demanding that the author post the raw PDF documents',
      'Reverse image search the water plant picture immediately'
    ],
    correct: 1,
    explanation: 'The foundational SIFT reflex is STOP. High-urgency emotional arousal (fear, outrage) is the primary contagion vector used to bypass critical judgment.'
  },
  {
    id: 'diag_fallacy_relevance',
    skillId: 'skill.fallacy.relevance',
    prompt: 'During a debate on algorithmic audit standards, Speaker A presents statistical audit data demonstrating demographic bias in loan approvals. Speaker B responds: "Speaker A used to consult for a rival fintech firm five years ago, so their entire audit methodology is invalid." What fallacy has Speaker B committed?',
    options: [
      'False Dilemma (Black-or-White)',
      'Hasty Generalization',
      'Ad Hominem (Circumstantial) / Genetic Fallacy',
      'Slippery Slope'
    ],
    correct: 2,
    explanation: 'Speaker B attacks Speaker A\'s prior affiliation and presumed motives rather than addressing the mathematical or empirical validity of the audit data.'
  },
  {
    id: 'diag_fallacy_structure',
    skillId: 'skill.fallacy.structure',
    prompt: 'Consider this argument: "If an adversary deployed deepfake audio, spectral analysis would reveal synthetic phase discontinuities. Spectral analysis did NOT reveal synthetic phase discontinuities. Therefore, no deepfake audio was deployed." What structural error exists here?',
    options: [
      'Affirming the consequent',
      'Denying the antecedent / Fallacy of the inverse',
      'Begging the question',
      'The argument is formally valid and sound'
    ],
    correct: 1,
    explanation: 'Denying the antecedent (If P then Q; Not P; Therefore not Q). Modern diffusion models or hybrid splices can generate authentic-sounding audio without detectable synthetic phase discontinuities.'
  },
  {
    id: 'diag_disarm_coordination',
    skillId: 'skill.disarm.plan-prepare',
    prompt: 'Within 12 minutes of a policy announcement, 450 newly registered accounts (all created within the previous 48 hours) begin posting near-identical phrases with identical hashtags across two platforms. In the DISARM framework, what tactic does this represent?',
    options: [
      'T0083 Inauthentic Asset Creation & Sybil Orchestration (Plan & Prepare / Establish Assets)',
      'T0092 Physical Coercion & Doxxing',
      'T0065 Epistemic Reframing & Lateral Fact-checking',
      'T0012 Spontaneous Grassroots Convergence'
    ],
    correct: 0,
    explanation: 'Account creation clustering and copypasta synchronicity are classic signatures of pre-positioned inauthentic infrastructure (DISARM Stage 01/02: Plan & Prepare / Establish Assets).'
  }
]);

/**
 * Advisory Prerequisites map for advanced subtabs.
 * In accordance with Cognitive Sovereignty, these are ADVISORY ONLY.
 * They guide the operator to foundational training but never lock or disable panels.
 */
export const SUBTAB_PREREQUISITES = Object.freeze({
  'forensics': {
    skills: ['skill.sift.stop', 'skill.forensics.read-measurements'],
    label: 'AI Media Forensics & C2PA',
    description: 'Interpreting spectral forensics and C2PA manifests requires baseline SIFT reflexes and measurement literacy.',
    primaryDest: { tab: 'cognitive', subtab: 'sift-labs', label: 'SIFT Labs' }
  },
  'disarm': {
    skills: ['skill.disarm.plan-prepare'],
    label: 'DISARM Framework',
    description: 'Adversarial playbook analysis builds upon recognizing preliminary planning and asset creation indicators.',
    primaryDest: { tab: 'cognitive', subtab: 'fallacies', label: 'Fallacies Taxonomy' }
  },
  'prebunking': {
    skills: ['skill.disarm.seed-amplify'],
    label: 'Inoculation Prebunking',
    description: 'Prebunking simulation models how contagion seeds and amplifies across networks.',
    primaryDest: { tab: 'cognitive', subtab: 'disarm', label: 'DISARM Catalog' }
  },
  'sandbox': {
    skills: ['skill.fallacy.structure'],
    label: 'Rhetorical Sandbox',
    description: 'Generating and identifying adversarial reframings demands familiarity with logical argument structure.',
    primaryDest: { tab: 'cognitive', subtab: 'fallacies', label: 'Fallacies Taxonomy' }
  },
  'arena': {
    skills: ['skill.fallacy.relevance', 'skill.fallacy.structure'],
    label: 'Infinite Arena',
    description: 'Rapid-fire timed triage tests both relevance and structural fallacy reflexes under pressure.',
    primaryDest: { tab: 'cognitive', subtab: 'fallacies', label: 'Fallacies Taxonomy' }
  },
  'commons': {
    skills: ['skill.bias.confirmation'],
    label: 'Epistemic Commons',
    description: 'Collaborative sensemaking requires awareness of confirmation bias and echo-chamber dynamics.',
    primaryDest: { tab: 'aftercare', subtab: 'audit', label: 'Bias Audit' }
  }
});

/**
 * Computes diagnostic placement, track, and destination from operator probe responses.
 *
 * @param {Array<{questionId: string, chosen: number, confidence?: string|number}>} responses
 * @param {Array<{id: string, label: string}>} [skills]
 * @returns {object} Placement report
 */
export function computeDiagnosticPlacement(responses = [], skills = []) {
  const respList = Array.isArray(responses) ? responses : [];
  const respMap = new Map();
  const qMap = new Map(DIAGNOSTIC_QUESTIONS.map(q => [q.id, q]));

  let correctCount = 0;
  let brierSum = 0;
  let brierCount = 0;
  const missedSkills = [];

  for (const r of respList) {
    const q = qMap.get(r.questionId);
    if (!q) continue;

    const isCorrect = Number(r.chosen) === q.correct;
    if (isCorrect) {
      correctCount++;
    } else if (!missedSkills.includes(q.skillId)) {
      missedSkills.push(q.skillId);
    }

    // Brier score: (p - outcome)^2
    let prob = 0.5;
    if (typeof r.confidence === 'string' && CONFIDENCE_LEVELS[r.confidence] !== undefined) {
      prob = CONFIDENCE_LEVELS[r.confidence];
    } else if (typeof r.confidence === 'number' && Number.isFinite(r.confidence)) {
      prob = Math.max(0, Math.min(1, r.confidence));
    }
    const outcome = isCorrect ? 1 : 0;
    brierSum += (prob - outcome) ** 2;
    brierCount++;

    respMap.set(q.id, {
      questionId: q.id,
      skillId: q.skillId,
      chosen: r.chosen,
      correct: isCorrect,
      confidence: r.confidence || 'sure'
    });
  }

  const brierScore = brierCount > 0 ? Number((brierSum / brierCount).toFixed(4)) : 0.25;

  // Placement Decision Tree
  let track = '';
  let placedAt = { tab: 'cognitive', subtab: 'sift-labs', label: 'SIFT Labs' };
  let prioritySkill = 'skill.sift.stop';
  let reason = '';

  const stopResp = respMap.get('diag_sift_stop');
  const relResp = respMap.get('diag_fallacy_relevance');
  const structResp = respMap.get('diag_fallacy_structure');
  const disarmResp = respMap.get('diag_disarm_coordination');

  if (!stopResp || !stopResp.correct) {
    track = 'SIFT Foundational';
    placedAt = { tab: 'cognitive', subtab: 'sift-labs', label: 'SIFT Labs (Stop Lab)' };
    prioritySkill = 'skill.sift.stop';
    reason = 'Your diagnostic indicates a priority need for foundational pause-and-reflect reflexes against high-urgency emotional contagion.';
  } else if ((relResp && !relResp.correct) || (structResp && !structResp.correct)) {
    track = 'Logical Fortification';
    placedAt = { tab: 'cognitive', subtab: 'fallacies', label: 'Fallacies Taxonomy & Gauntlet' };
    prioritySkill = (relResp && !relResp.correct) ? 'skill.fallacy.relevance' : 'skill.fallacy.structure';
    reason = 'Your diagnostic indicates a training opportunity in distinguishing valid argument forms from rhetorical distractions and formal flaws.';
  } else if (disarmResp && !disarmResp.correct) {
    track = 'Adversarial Threat Intelligence';
    placedAt = { tab: 'cognitive', subtab: 'disarm', label: 'DISARM Framework' };
    prioritySkill = 'skill.disarm.plan-prepare';
    reason = 'You have solid logical and pause reflexes; now prioritize mapping coordinated inauthentic campaign infrastructure.';
  } else {
    // All correct
    track = 'Advanced Triage & Stress Gauntlet';
    placedAt = { tab: 'cognitive', subtab: 'arena', label: 'Infinite Arena Gauntlet' };
    prioritySkill = 'skill.fallacy.relevance';
    reason = 'Clean diagnostic sweep! All baseline analytical reflexes are intact. You are cleared for high-speed adversarial stress triage in the Infinite Arena.';
  }

  const skillDef = Array.isArray(skills) ? skills.find(s => s.id === prioritySkill) : null;
  const prioritySkillLabel = skillDef ? skillDef.label : prioritySkill;

  return {
    track,
    placedAt,
    prioritySkill,
    prioritySkillLabel,
    reason,
    score: correctCount,
    total: DIAGNOSTIC_QUESTIONS.length,
    percentage: Math.round((correctCount / DIAGNOSTIC_QUESTIONS.length) * 100),
    brierScore,
    missedSkills,
    evaluatedResponses: Array.from(respMap.values())
  };
}

/**
 * Evaluates advisory prerequisites for a given subtab against live operator competency.
 *
 * @param {string} subtabId
 * @param {Map<string, {mastery: number, confidence: number}>|object} masteryMap
 * @param {Array<{id: string, label: string}>} [skills]
 * @param {{threshold?: number, minConfidence?: number}} [opts]
 * @returns {object}
 */
export function evaluateAdvisoryPrerequisites(subtabId, masteryMap, skills = [], opts = {}) {
  const prereqDef = SUBTAB_PREREQUISITES[subtabId];
  if (!prereqDef) {
    return {
      hasPrerequisites: false,
      met: true,
      subtabId,
      missing: []
    };
  }

  const threshold = Number.isFinite(opts.threshold) ? opts.threshold : 0.60;
  const minConfidence = Number.isFinite(opts.minConfidence) ? opts.minConfidence : 0.25;
  const skillsList = Array.isArray(skills) ? skills : [];
  const missing = [];

  const getMastery = (skillId) => {
    if (!masteryMap) return null;
    if (typeof masteryMap.get === 'function') {
      return masteryMap.get(skillId);
    }
    return masteryMap[skillId] || null;
  };

  for (const skillId of prereqDef.skills) {
    const est = getMastery(skillId);
    const m = est && Number.isFinite(est.mastery) ? est.mastery : 0.5; // Beta(1,1) prior baseline
    const c = est && Number.isFinite(est.confidence) ? est.confidence : 0.0;

    if (m < threshold || c < minConfidence) {
      const sDef = skillsList.find(s => s.id === skillId);
      missing.push({
        skillId,
        label: sDef ? sDef.label : skillId,
        mastery: m,
        confidence: c,
        threshold,
        minConfidence
      });
    }
  }

  return {
    hasPrerequisites: true,
    met: missing.length === 0,
    subtabId,
    label: prereqDef.label,
    description: prereqDef.description,
    primaryDest: prereqDef.primaryDest,
    missing,
    firstMissing: missing[0] || null
  };
}

/**
 * Renders the non-blocking advisory banner HTML.
 * The banner never impedes operator autonomy: it offers a clear explanation,
 * a one-click shortcut to train the prerequisite, and a dismiss action.
 *
 * @param {object} gateResult Output from evaluateAdvisoryPrerequisites
 * @returns {string} Safe HTML string
 */
export function renderAdvisoryBanner(gateResult) {
  if (!gateResult || gateResult.met || !gateResult.hasPrerequisites) {
    return '';
  }

  const primary = gateResult.firstMissing || {};
  const dest = gateResult.primaryDest || { tab: 'cognitive', subtab: 'arena', label: 'Practice' };
  const bannerId = `advisory-banner-${esc(gateResult.subtabId)}`;

  return `
    <div id="${bannerId}" class="advisory-prereq-banner card card-granite-inset" style="
      margin-bottom: var(--space-4);
      padding: 14px 18px;
      border-left: 4px solid var(--amber-primary, #d97706);
      background: rgba(217, 119, 6, 0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      animation: fadeIn 0.25s ease-out;
    ">
      <div style="flex: 1; min-width: 240px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span style="font-size: 0.95rem;">💡</span>
          <span class="status-label" style="color: var(--amber-bright, #f59e0b); font-weight: 700; letter-spacing: 0.06em;">
            ADVISORY PREREQUISITE GUIDANCE
          </span>
          <span style="font-family: var(--font-mono); font-size: 0.68rem; color: var(--stone-warm); background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 3px;">
            OPEN ACCESS PRESERVED
          </span>
        </div>
        <div style="font-size: 0.84rem; color: var(--parchment-primary); line-height: 1.45;">
          Recommended prior competency: <strong>${esc(primary.label || 'Foundational Skill')}</strong>.
          <span style="color: var(--stone-light); font-size: 0.8rem; margin-left: 4px;">
            ${esc(gateResult.description)}
          </span>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
        <button class="btn btn-sm btn-outline"
                data-aegis-action="switch-tab"
                data-aegis-tab="${esc(dest.tab)}"
                data-aegis-subtab="${esc(dest.subtab)}"
                title="Train prerequisite first in ${esc(dest.label)}">
          ⚔️ Train Prior in ${esc(dest.label)} →
        </button>
        <button class="btn btn-sm"
                data-aegis-dismiss-banner="${bannerId}"
                style="background: transparent; border: 1px solid var(--border-subtle); color: var(--stone-light); padding: 5px 10px; cursor: pointer;"
                title="Dismiss this advisory notice">
          ✕ Dismiss
        </button>
      </div>
    </div>
  `.trim();
}

export default {
  DIAGNOSTIC_QUESTIONS,
  SUBTAB_PREREQUISITES,
  computeDiagnosticPlacement,
  evaluateAdvisoryPrerequisites,
  renderAdvisoryBanner
};
