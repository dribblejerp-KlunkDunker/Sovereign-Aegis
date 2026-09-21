/**
 * SOVEREIGN // AEGIS — remove the "pick the longest option" tell
 *
 * Across the bank, the correct answer was the longest option in 60 of 119 questions — so an
 * operator who always picked the longest scored ~50% against a 25% baseline, without reading a
 * single claim. That is the same class of defect as the Arena's fixed correctIndex: a route to a
 * high score that involves no epistemic work, which makes every mastery number downstream of it
 * partly fictional.
 *
 * The fix is meaning-preserving. Where the correct answer is the longest option, one or more
 * DISTRACTORS are expanded to their fuller canonical name — "Slippery Slope" becomes
 * "Slippery Slope (Continuum Fallacy)". Nothing is padded with filler and no option changes what
 * it denotes; the fuller names are the ones already used elsewhere in the bank and in the fallacy
 * taxonomy, so the vocabulary stays consistent.
 *
 * Only distractors are touched. Expanding the CORRECT answer would move the tell rather than
 * remove it, and would also change the answer→skill map key.
 *
 *     node tools/balance-option-lengths.mjs [--check]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = 'data/arena_questions.json';
const checkOnly = process.argv.includes('--check');

// Canonical fuller names. Each is the standard alternative label for the same concept.
const EXPANSIONS = {
  'Straw Man': 'Straw Man (Ignoratio Elenchi)',
  'Slippery Slope': 'Slippery Slope (Continuum Fallacy)',
  'Red Herring': 'Red Herring (Ignoratio Elenchi)',
  'Ad Hominem': 'Ad Hominem (Argumentum ad Hominem)',
  'False Dilemma': 'False Dilemma (Bifurcation)',
  'Circular Reasoning': 'Circular Reasoning (Petitio Principii)',
  'Begging the Question': 'Begging the Question (Petitio Principii)',
  'Hasty Generalisation': 'Hasty Generalisation (Secundum Quid)',
  'Hasty Generalization': 'Hasty Generalization (Secundum Quid)',
  'Cherry Picking': 'Cherry Picking (Suppressed Evidence)',
  'Survivorship Bias': 'Survivorship Bias (Selection Effect)',
  'Confirmation Bias': 'Confirmation Bias (Myside Bias)',
  'Anchoring Effect': 'Anchoring Effect (Focalism)',
  'Availability Heuristic': 'Availability Heuristic (Ease of Recall)',
  'Base-Rate Neglect': 'Base-Rate Neglect (Prior Insensitivity)',
  'Conjunction Fallacy': 'Conjunction Fallacy (Linda Problem)',
  'Sunk Cost Fallacy': 'Sunk Cost Fallacy (Escalation of Commitment)',
  'Hindsight Bias': 'Hindsight Bias (Knew-It-All-Along Effect)',
  'Selective Recall': 'Selective Recall (Memory Curation)',
  'Framing Effect': 'Framing Effect (Presentation Bias)',
  'Gish Gallop': 'Gish Gallop (Argument by Volume)',
  'Astroturfing': 'Astroturfing (Manufactured Grassroots)',
  'Brigading': 'Brigading (Coordinated Mass Reporting)',
  'Appeal to Ignorance': 'Appeal to Ignorance (Argumentum ad Ignorantiam)',
  'Appeal to Tradition': 'Appeal to Tradition (Argumentum ad Antiquitatem)',
  'Appeal to Nature': 'Appeal to Nature (Naturalistic Fallacy)',
  'Appeal to Fear': 'Appeal to Fear (Argumentum ad Metum)',
  'Appeal to False Authority': 'Appeal to False Authority (Ad Verecundiam)',
  'Appeal to Emotion': 'Appeal to Emotion (Argumentum ad Passiones)',
  'Guilt by Association': 'Guilt by Association (Association Fallacy)',
  'Post Hoc Ergo Propter Hoc': 'Post Hoc Ergo Propter Hoc (False Cause)',
  'Equivocation': 'Equivocation (Semantic Shift)',
  'No True Scotsman': 'No True Scotsman (Ad Hoc Rescue)',
  'Debunking': 'Debunking (Post-Exposure Correction)',
  'Strategic Silence': 'Strategic Silence (Deliberate Non-Amplification)',
  'Counter-Messaging': 'Counter-Messaging (Alternative Narrative)',
  'Prebunking': 'Prebunking (Attitudinal Inoculation)'
};

const rows = JSON.parse(fs.readFileSync(path.join(ROOT, P), 'utf8'));
const isLongestCorrect = (q) => {
  const L = q.options.map((o) => o.length);
  return L[q.correctIndex] === Math.max(...L) && new Set(L).size > 1;
};

const before = rows.filter(isLongestCorrect).length;
let touched = 0;
for (const q of rows) {
  if (!isLongestCorrect(q)) continue;
  const answer = q.options[q.correctIndex];
  let changed = false;
  // Expand distractors, longest-gain first, until the correct answer is no longer the longest.
  const candidates = q.options
    .map((o, i) => ({ o, i }))
    .filter(({ o, i }) => i !== q.correctIndex && EXPANSIONS[o] && EXPANSIONS[o].length > answer.length)
    .sort((a, b) => EXPANSIONS[b.o].length - EXPANSIONS[a.o].length);
  for (const { o, i } of candidates) {
    q.options[i] = EXPANSIONS[o];
    changed = true;
    if (!isLongestCorrect(q)) break;
  }
  if (changed) touched++;
}
const after = rows.filter(isLongestCorrect).length;

console.log(`  longest-is-correct: ${before}/${rows.length} → ${after}/${rows.length} (${Math.round(after / rows.length * 100)}%, chance 25%)`);
console.log(`  questions with an expanded distractor: ${touched}`);
if (checkOnly) process.exit(0);
fs.writeFileSync(path.join(ROOT, P), JSON.stringify(rows, null, 2) + '\n', 'utf8');
console.log(`  wrote ${P}\n`);
