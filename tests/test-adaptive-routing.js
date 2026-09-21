/**
 * SOVEREIGN // AEGIS — Suite 44: Adaptive Routing & Progressive Placement Test
 *
 * Verifies:
 *  1. Canonical Diagnostic Probe Questions: schema, answers, and skill mapping.
 *  2. Diagnostic Placement Scoring & Decision Tree: track assignment, starting point routing, Brier scores.
 *  3. Advisory Prerequisites Architecture: non-blocking gate evaluation, missing skills detection.
 *  4. Open Access Principle & Advisory Banner Markup: non-impeding guidance, dismiss action, navigation shortcut.
 *  5. NextDrillPanel Placement Fallback: immediate routing based on diagnostic priors.
 *  6. Backward Compatibility: Onboarding priority rules, spiderchart math, and step flow.
 *
 * Zero external dependencies. Headless execution.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTEXTS } from '../js/attempts.js';
import {
  DIAGNOSTIC_QUESTIONS,
  SUBTAB_PREREQUISITES,
  computeDiagnosticPlacement,
  evaluateAdvisoryPrerequisites,
  renderAdvisoryBanner
} from '../js/modules/adaptiveRouting.js';
import { nextDrillPanel } from '../js/nextDrillPanel.js';
import { OnboardingModule } from '../js/modules/onboarding.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const skillsPath = path.resolve(__dirname, '../data/skills.json');
const skills = JSON.parse(fs.readFileSync(skillsPath, 'utf8'));

// Test Harness
let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    failures.push(message);
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    const errMsg = `${message} | Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`;
    failures.push(errMsg);
    console.error(`  ✗ FAIL: ${errMsg}`);
  }
}

console.log('====================================================');
console.log(' Suite 44: Adaptive Routing & Progressive Placement');
console.log('====================================================\n');

// ----------------------------------------------------
// Group 1: Canonical Diagnostic Probe Questions
// ----------------------------------------------------
console.log('--- Group 1: Canonical Diagnostic Probe Questions ---');
assertEqual(DIAGNOSTIC_QUESTIONS.length, 4, 'Exactly 4 diagnostic probes configured');
assertEqual(CONTEXTS.DIAGNOSTIC, 'diagnostic', 'CONTEXTS.DIAGNOSTIC is registered as "diagnostic"');

const validSkillIds = new Set(skills.map(s => s.id));
for (const q of DIAGNOSTIC_QUESTIONS) {
  assert(q.id && q.id.startsWith('diag_'), `Question ${q.id} has valid probe ID`);
  assert(validSkillIds.has(q.skillId), `Probe ${q.id} targets registered skill ${q.skillId}`);
  assert(typeof q.prompt === 'string' && q.prompt.length > 30, `Probe ${q.id} has non-trivial scenario prompt`);
  assert(Array.isArray(q.options) && q.options.length === 4, `Probe ${q.id} has 4 distinct options`);
  assert(Number.isInteger(q.correct) && q.correct >= 0 && q.correct < 4, `Probe ${q.id} has valid correct option index`);
  assert(typeof q.explanation === 'string' && q.explanation.length > 20, `Probe ${q.id} has informative pedagogical explanation`);
}

// ----------------------------------------------------
// Group 2: Diagnostic Placement Decision Tree
// ----------------------------------------------------
console.log('\n--- Group 2: Diagnostic Placement Decision Tree ---');

// Case A: Missing SIFT Stop -> Placed at SIFT Labs
const siftsFailed = computeDiagnosticPlacement([
  { questionId: 'diag_sift_stop', chosen: 0, confidence: 'sure' }, // incorrect
  { questionId: 'diag_fallacy_relevance', chosen: 2, confidence: 'sure' },
  { questionId: 'diag_fallacy_structure', chosen: 1, confidence: 'sure' },
  { questionId: 'diag_disarm_coordination', chosen: 0, confidence: 'sure' }
], skills);
assertEqual(siftsFailed.track, 'SIFT Foundational', 'Missing SIFT Stop assigns SIFT Foundational track');
assertEqual(siftsFailed.placedAt.subtab, 'sift-labs', 'Routes to sift-labs subtab');
assertEqual(siftsFailed.prioritySkill, 'skill.sift.stop', 'Identifies skill.sift.stop as priority');
assertEqual(siftsFailed.score, 3, 'Correctly scores 3/4');

// Case B: Passing SIFT Stop, but Missing Relevance Fallacy -> Placed at Fallacies
const fallacyRelFailed = computeDiagnosticPlacement([
  { questionId: 'diag_sift_stop', chosen: 1, confidence: 'sure' }, // correct
  { questionId: 'diag_fallacy_relevance', chosen: 0, confidence: 'sure' }, // incorrect
  { questionId: 'diag_fallacy_structure', chosen: 1, confidence: 'sure' },
  { questionId: 'diag_disarm_coordination', chosen: 0, confidence: 'sure' }
], skills);
assertEqual(fallacyRelFailed.track, 'Logical Fortification', 'Missing Relevance Fallacy assigns Logical Fortification track');
assertEqual(fallacyRelFailed.placedAt.subtab, 'fallacies', 'Routes to fallacies subtab');
assertEqual(fallacyRelFailed.prioritySkill, 'skill.fallacy.relevance', 'Identifies skill.fallacy.relevance as priority');

// Case C: Passing SIFT Stop & Relevance, but Missing Structure Fallacy -> Placed at Fallacies
const fallacyStructFailed = computeDiagnosticPlacement([
  { questionId: 'diag_sift_stop', chosen: 1, confidence: 'sure' },
  { questionId: 'diag_fallacy_relevance', chosen: 2, confidence: 'sure' },
  { questionId: 'diag_fallacy_structure', chosen: 0, confidence: 'sure' }, // incorrect
  { questionId: 'diag_disarm_coordination', chosen: 0, confidence: 'sure' }
], skills);
assertEqual(fallacyStructFailed.track, 'Logical Fortification', 'Missing Structural Fallacy assigns Logical Fortification track');
assertEqual(fallacyStructFailed.placedAt.subtab, 'fallacies', 'Routes to fallacies subtab');
assertEqual(fallacyStructFailed.prioritySkill, 'skill.fallacy.structure', 'Identifies skill.fallacy.structure as priority');

// Case D: Passing Logic & Stop, but Missing DISARM -> Placed at DISARM
const disarmFailed = computeDiagnosticPlacement([
  { questionId: 'diag_sift_stop', chosen: 1, confidence: 'sure' },
  { questionId: 'diag_fallacy_relevance', chosen: 2, confidence: 'sure' },
  { questionId: 'diag_fallacy_structure', chosen: 1, confidence: 'sure' },
  { questionId: 'diag_disarm_coordination', chosen: 3, confidence: 'sure' } // incorrect
], skills);
assertEqual(disarmFailed.track, 'Adversarial Threat Intelligence', 'Missing DISARM assigns Adversarial Threat Intelligence track');
assertEqual(disarmFailed.placedAt.subtab, 'disarm', 'Routes to disarm subtab');
assertEqual(disarmFailed.prioritySkill, 'skill.disarm.plan-prepare', 'Identifies skill.disarm.plan-prepare as priority');

// Case E: Clean Sweep (All 4 correct) -> Placed at Arena Gauntlet
const cleanSweep = computeDiagnosticPlacement([
  { questionId: 'diag_sift_stop', chosen: 1, confidence: 'sure' },
  { questionId: 'diag_fallacy_relevance', chosen: 2, confidence: 'sure' },
  { questionId: 'diag_fallacy_structure', chosen: 1, confidence: 'sure' },
  { questionId: 'diag_disarm_coordination', chosen: 0, confidence: 'sure' }
], skills);
assertEqual(cleanSweep.track, 'Advanced Triage & Stress Gauntlet', 'Clean sweep assigns Advanced Triage track');
assertEqual(cleanSweep.placedAt.subtab, 'arena', 'Routes to arena subtab');
assertEqual(cleanSweep.score, 4, 'Score is 4/4');
assertEqual(cleanSweep.percentage, 100, 'Percentage is 100%');
assertEqual(cleanSweep.missedSkills.length, 0, 'No missed skills');

// ----------------------------------------------------
// Group 3: Confidence Ratings & Brier Calibration
// ----------------------------------------------------
console.log('\n--- Group 3: Confidence Ratings & Brier Calibration ---');
// Clean sweep with sure (0.9): (0.9 - 1)^2 = 0.01
assertEqual(cleanSweep.brierScore, 0.01, 'Brier score for 100% sure-correct is 0.0100');

// All wrong with sure (0.9): (0.9 - 0)^2 = 0.81
const allWrongSure = computeDiagnosticPlacement([
  { questionId: 'diag_sift_stop', chosen: 0, confidence: 'sure' },
  { questionId: 'diag_fallacy_relevance', chosen: 0, confidence: 'sure' },
  { questionId: 'diag_fallacy_structure', chosen: 0, confidence: 'sure' },
  { questionId: 'diag_disarm_coordination', chosen: 1, confidence: 'sure' }
], skills);
assertEqual(allWrongSure.brierScore, 0.81, 'Brier score for 100% overconfident wrong is 0.8100');

// All correct with guess (0.25): (0.25 - 1)^2 = 0.5625
const allGuessCorrect = computeDiagnosticPlacement([
  { questionId: 'diag_sift_stop', chosen: 1, confidence: 'guess' },
  { questionId: 'diag_fallacy_relevance', chosen: 2, confidence: 'guess' },
  { questionId: 'diag_fallacy_structure', chosen: 1, confidence: 'guess' },
  { questionId: 'diag_disarm_coordination', chosen: 0, confidence: 'guess' }
], skills);
assertEqual(allGuessCorrect.brierScore, 0.5625, 'Brier score for underconfident correct matches 0.5625');

// Evaluated responses include skillIds and correctness
assert(Array.isArray(cleanSweep.evaluatedResponses), 'evaluatedResponses is an array');
assertEqual(cleanSweep.evaluatedResponses.length, 4, '4 evaluated responses');
assert(cleanSweep.evaluatedResponses.every(r => r.correct === true), 'All evaluated responses marked correct in clean sweep');

// ----------------------------------------------------
// Group 4: Advisory Prerequisites Architecture
// ----------------------------------------------------
console.log('\n--- Group 4: Advisory Prerequisites Architecture ---');

// Forensics subtab check
const coldEstimates = new Map(); // cold start: no attempts
const forensicsGate = evaluateAdvisoryPrerequisites('forensics', coldEstimates, skills);
assertEqual(forensicsGate.hasPrerequisites, true, 'Forensics subtab has advisory prerequisites');
assertEqual(forensicsGate.met, false, 'Cold start does not meet forensics prerequisites');
assert(forensicsGate.missing.length >= 2, 'Forensics missing at least 2 prerequisite skills on cold start');
assertEqual(forensicsGate.primaryDest.subtab, 'sift-labs', 'Primary training shortcut points to sift-labs');

// Epistemic Commons check
const commonsGate = evaluateAdvisoryPrerequisites('commons', coldEstimates, skills);
assertEqual(commonsGate.hasPrerequisites, true, 'Epistemic Commons has advisory prerequisites');
assertEqual(commonsGate.met, false, 'Cold start does not meet commons prerequisites');
assertEqual(commonsGate.firstMissing.skillId, 'skill.bias.confirmation', 'First missing skill is confirmation bias');

// Infinite Arena check
const arenaGate = evaluateAdvisoryPrerequisites('arena', coldEstimates, skills);
assertEqual(arenaGate.hasPrerequisites, true, 'Arena has advisory prerequisites');
assertEqual(arenaGate.met, false, 'Cold start does not meet arena prerequisites');

// Unrestricted subtab (e.g. sift-labs or masterclasses)
const siftLabsGate = evaluateAdvisoryPrerequisites('sift-labs', coldEstimates, skills);
assertEqual(siftLabsGate.hasPrerequisites, false, 'SIFT Labs has no subtab prerequisites');
assertEqual(siftLabsGate.met, true, 'SIFT Labs is open by default');

// Subtab with met prerequisites
const masteredEstimates = new Map([
  ['skill.sift.stop', { mastery: 0.85, confidence: 0.6 }],
  ['skill.forensics.read-measurements', { mastery: 0.78, confidence: 0.5 }],
  ['skill.fallacy.relevance', { mastery: 0.80, confidence: 0.5 }],
  ['skill.fallacy.structure', { mastery: 0.75, confidence: 0.4 }],
  ['skill.disarm.plan-prepare', { mastery: 0.70, confidence: 0.3 }],
  ['skill.disarm.seed-amplify', { mastery: 0.65, confidence: 0.3 }],
  ['skill.bias.confirmation', { mastery: 0.72, confidence: 0.4 }]
]);

const forensicsUnlocked = evaluateAdvisoryPrerequisites('forensics', masteredEstimates, skills);
assertEqual(forensicsUnlocked.hasPrerequisites, true, 'Forensics has prerequisites');
assertEqual(forensicsUnlocked.met, true, 'Forensics prerequisites met when mastery and confidence exceed threshold');
assertEqual(forensicsUnlocked.missing.length, 0, 'No missing skills when mastered');

const arenaUnlocked = evaluateAdvisoryPrerequisites('arena', masteredEstimates, skills);
assertEqual(arenaUnlocked.met, true, 'Arena prerequisites met when mastered');

// ----------------------------------------------------
// Group 5: Open Access Principle & Advisory Banner
// ----------------------------------------------------
console.log('\n--- Group 5: Open Access Principle & Advisory Banner ---');

const bannerEmpty = renderAdvisoryBanner(forensicsUnlocked);
assertEqual(bannerEmpty, '', 'No advisory banner rendered when prerequisites are met');

const bannerUnmet = renderAdvisoryBanner(forensicsGate);
assert(bannerUnmet.length > 50, 'Generates non-empty banner markup when prerequisites unmet');
assert(bannerUnmet.includes('ADVISORY PREREQUISITE GUIDANCE'), 'Includes advisory guidance title');
assert(bannerUnmet.includes('OPEN ACCESS PRESERVED'), 'Explicitly attests Open Access Preserved');
assert(bannerUnmet.includes('data-aegis-action="switch-tab"'), 'Contains data-aegis-action switch-tab button');
assert(bannerUnmet.includes('data-aegis-dismiss-banner'), 'Contains dismiss banner trigger');
assert(!bannerUnmet.includes('disabled'), 'Banner contains NO disabling attributes (open access guarantee)');
assert(!bannerUnmet.includes('pointer-events: none'), 'Banner contains NO pointer-events blocking styles');

// ----------------------------------------------------
// Group 6: NextDrillPanel Placement Fallback
// ----------------------------------------------------
console.log('\n--- Group 6: NextDrillPanel Placement Fallback ---');

// With no attempts and no placement -> generic prompt
const defaultDrill = nextDrillPanel(null, { skills });
assert(defaultDrill.includes('NEXT DRILL — WHERE TO PRACTISE'), 'Renders default prompt without placement');
assert(defaultDrill.includes('Answer a few Arena questions first'), 'Mentions answering questions first');

// With no attempts but active diagnostic placement -> recommended starting drill
const routedDrill = nextDrillPanel(null, { skills, placement: siftsFailed });
assert(routedDrill.includes('RECOMMENDED STARTING DRILL — PLACEMENT ROUTED'), 'Renders placement routed starting drill');
assert(routedDrill.includes('SIFT Foundational'), 'Displays assigned track in drill panel');
assert(routedDrill.includes('data-aegis-tab="cognitive"'), 'Target tab is cognitive');
assert(routedDrill.includes('data-aegis-subtab="sift-labs"'), 'Target subtab is sift-labs');

// ----------------------------------------------------
// Group 6b: Phase 2 — Due Memory Vault reviews outrank every other recommendation
// ----------------------------------------------------
console.log('\n--- Group 6b: Due-Review Pressure (Phase 2 Retention) ---');

const dueDrill = nextDrillPanel(null, { skills, placement: siftsFailed, dueReview: { count: 7, tab: 'cognitive', subtab: 'memory' } });
assert(dueDrill.includes('DUE NOW — SPACED REPETITION REVIEW'), 'Due cards outrank placement routing (title wins)');
assert(dueDrill.includes('7 Memory Vault cards due today'), 'Renders the measured due count');
assert(dueDrill.includes('data-aegis-subtab="memory"'), 'Routes to the Memory Vault');
assert(dueDrill.includes('Review Now'), 'Offers the review CTA');

// Placement must NOT appear when reviews are due — one recommendation at a time.
assert(!dueDrill.includes('RECOMMENDED STARTING DRILL'), 'No placement panel mixed into the due-review panel');

// Even with a ranked Arena item available, due cards win.
const dueVsArena = nextDrillPanel(
  { skillId: 'skill.fallacy.relevance', mastery: 0.2, miscalibrated: false },
  { skills, dueReview: { count: 1, tab: 'cognitive', subtab: 'memory' } }
);
assert(dueVsArena.includes('DUE NOW — SPACED REPETITION REVIEW'), 'Due cards outrank the competency-ranked Arena pick');
assert(dueVsArena.includes('1 Memory Vault card due today'), 'Singular due count renders un-pluralised');

// Zero/negative/absent counts behave as before — no regressions.
assert(nextDrillPanel(null, { skills, dueReview: { count: 0, tab: 'cognitive', subtab: 'memory' } }).includes('NEXT DRILL — WHERE TO PRACTISE'), 'Zero due cards falls through to the default prompt');
assert(nextDrillPanel(null, { skills }).includes('NEXT DRILL — WHERE TO PRACTISE'), 'Absent dueReview falls through to the default prompt');
assert(!nextDrillPanel(null, { skills, dueReview: { count: 3 } }).includes('DUE NOW'), 'Malformed dueReview (no destination) is ignored, not half-rendered');

// ----------------------------------------------------
// Group 7: Backward Compatibility & Onboarding State
// ----------------------------------------------------
console.log('\n--- Group 7: Backward Compatibility & Onboarding State ---');

assertEqual(OnboardingModule._totalSteps, 6, 'OnboardingModule has 6 total steps (5 tour + 1 diagnostic)');

// Test Step 4 contains diagnostic CTA
const step4Html = OnboardingModule._buildStep(4);
assert(step4Html.includes('Take Diagnostic Placement Test →'), 'Step 4 CTA leads to Diagnostic Placement');
assert(step4Html.includes('Skip Placement →'), 'Step 4 contains non-coercive skip placement option');

// Test Step 5 renders diagnostic probe
const step5ProbeHtml = OnboardingModule._buildStep(5);
assert(step5ProbeHtml.includes('DIAGNOSTIC PLACEMENT PROBE 1 OF 4'), 'Step 5 renders first diagnostic probe');
assert(step5ProbeHtml.includes('Confidence:'), 'Step 5 renders confidence rating bar');
assert(step5ProbeHtml.includes('diag-option-card'), 'Step 5 renders interactive option cards');

// Verify existing priority engine rules in OnboardingModule remain unchanged
const p10 = OnboardingModule._computeNextAction({ siftVerification: 20, patternRecognition: 50, theoreticalDepth: 50, memoryRetention: 50, analyticalPractice: 50 });
assertEqual(p10.priority, 10, 'Onboarding priority 10 preserved');
const p9 = OnboardingModule._computeNextAction({ siftVerification: 50, patternRecognition: 20, theoreticalDepth: 50, memoryRetention: 50, analyticalPractice: 50 });
assertEqual(p9.priority, 9, 'Onboarding priority 9 preserved');
const p1 = OnboardingModule._computeNextAction({ siftVerification: 80, patternRecognition: 80, theoreticalDepth: 80, memoryRetention: 80, analyticalPractice: 80 });
assertEqual(p1.priority, 1, 'Onboarding priority 1 fallback preserved');

// Spiderchart geometry invariance check
const testAxes = [
  { key: 'siftVerification', label: 'SIFT', value: 75, color: '#f00' },
  { key: 'patternRecognition', label: 'Pattern', value: 60, color: '#ff0' },
  { key: 'memoryRetention', label: 'Memory', value: 80, color: '#0f0' },
  { key: 'theoreticalDepth', label: 'Theory', value: 70, color: '#d2a64d' },
  { key: 'analyticalPractice', label: 'Practice', value: 65, color: '#0ff' }
];
const svg = OnboardingModule._buildSpiderchart(testAxes);
assert(svg.includes('viewBox="0 0 160 160"'), 'Spiderchart retains 160x160 geometry');
assert(svg.includes('<circle'), 'Spiderchart renders vertex circles');

// Summary
console.log('\n====================================================');
console.log(`[Suite 44: Adaptive Routing & Progressive Placement] Summary: ${passed}/${passed + failed} Passed (${failed} Failed)`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
}
