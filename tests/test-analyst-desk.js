/**
 * SOVEREIGN // AEGIS — Test Suite: The Analyst's Desk & OSINT Tradecraft Suite
 * 
 * Tests the new investigative serious game engine, datasets, and pure mathematical functions:
 *   - Dataset schemas: data/osint_cases.json (cases, bellingcat_toolkit, pivot_drills)
 *   - Referential integrity: all teaches[] tags resolve to valid skills in data/skills.json
 *   - Pure assemblers: buildCasePool(), buildPivotDrillPool() determinism and option shuffle preservation
 *   - Chronolocation mathematics: calculateSolarAltitude(), estimateChronolocation() accuracy & boundary tests
 *   - Analytical ruling evaluation: evaluateCaseAnswer(), filterToolkit()
 *   - Arena Calibrated Mode Brier mathematics verification
 * 
 * Zero external runtime dependencies (native Node.js assertions).
 */

import { readFileSync } from 'node:fs';
import {
  buildCasePool,
  calculateSolarAltitude,
  estimateChronolocation,
  filterToolkit,
  buildPivotDrillPool,
  evaluateCaseAnswer
} from '../js/modules/osint.js';

const osintData = JSON.parse(readFileSync(new URL('../data/osint_cases.json', import.meta.url), 'utf8'));
const skillsData = JSON.parse(readFileSync(new URL('../data/skills.json', import.meta.url), 'utf8'));
const validSkillIds = new Set(skillsData.map((s) => s.id));

class TestHarness {
  constructor(name) {
    this.suiteName = name;
    this.totalAssertions = 0;
    this.passed = 0;
    this.failed = 0;
    this.failures = [];
    this.currentSuite = '';
  }
  describe(name, fn) {
    this.currentSuite = name;
    console.log(`\n  --- ${name} ---`);
    return fn();
  }
  async it(name, fn) {
    try {
      await fn();
    } catch (err) {
      this.failed++;
      this.totalAssertions++;
      this.failures.push({ suite: this.currentSuite, test: name, error: err.message });
      console.error(`  ✗ [FAIL] ${name} (${err.message})`);
    }
  }
  assert(cond, msg) {
    this.totalAssertions++;
    if (cond) {
      this.passed++;
      console.log(`    ✓ ${msg}`);
    } else {
      this.failed++;
      this.failures.push({ suite: this.currentSuite, test: msg, error: 'Assertion failed' });
      console.error(`    ✗ [FAIL] ${msg}`);
    }
  }
  assertEqual(a, e, m) {
    this.assert(a === e, `${m} | got ${JSON.stringify(a)}, expected ${JSON.stringify(e)}`);
  }
  assertClose(a, e, tol, m) {
    const diff = Math.abs(a - e);
    this.assert(diff <= tol, `${m} | got ${a}, expected ~${e} (diff: ${diff.toFixed(4)})`);
  }
  summary() {
    console.log('\n====================================================');
    console.log(`[${this.suiteName}] Summary: ${this.passed}/${this.totalAssertions} Passed (${this.failed} Failed)`);
    console.log('====================================================');
    if (this.failed > 0) {
      console.error('\nFailure Details:');
      this.failures.forEach((f) => console.error(` - [${f.suite}] ${f.test}: ${f.error}`));
      process.exitCode = 1;
    }
    return { passed: this.passed, failed: this.failed, total: this.totalAssertions };
  }
}

const harness = new TestHarness("The Analyst's Desk & OSINT Suite");

async function runTests() {
  // =========================================================================
  // Tier 1: Dataset Validation against data/osint_cases.json
  // =========================================================================
  await harness.describe('Tier 1: Dataset Schemas & Referential Integrity', async () => {
    await harness.it('osint_cases.json has cases, bellingcat_toolkit, and pivot_drills arrays', () => {
      harness.assert(Array.isArray(osintData.cases) && osintData.cases.length >= 6, `has >= 6 cases (${osintData.cases.length})`);
      harness.assert(Array.isArray(osintData.bellingcat_toolkit) && osintData.bellingcat_toolkit.length >= 15, `has >= 15 tools (${osintData.bellingcat_toolkit.length})`);
      harness.assert(Array.isArray(osintData.pivot_drills) && osintData.pivot_drills.length >= 16, `has >= 16 drills (${osintData.pivot_drills.length})`);
    });

    await harness.it('every case conforms to full schema with >=3 vectors and 2 distinct questions', () => {
      const caseIds = new Set();
      for (const [idx, c] of osintData.cases.entries()) {
        harness.assert(/^case-[a-z0-9-]+$/.test(c.id), `Case #${idx + 1} (${c.id}) has valid ID format`);
        harness.assert(!caseIds.has(c.id), `Case ${c.id} has unique ID`);
        caseIds.add(c.id);

        harness.assert(typeof c.title === 'string' && c.title.length > 5, `Case ${c.id} has title`);
        harness.assert(typeof c.domain === 'string' && c.domain.length > 3, `Case ${c.id} has domain`);
        harness.assert(typeof c.claim === 'string' && c.claim.length > 20, `Case ${c.id} has claim`);
        harness.assert(typeof c.briefing === 'string' && c.briefing.length > 30, `Case ${c.id} has briefing`);

        harness.assert(Array.isArray(c.vectors) && c.vectors.length >= 3, `Case ${c.id} has >= 3 evidence vectors`);
        for (const v of c.vectors) {
          harness.assert(typeof v.name === 'string' && v.name.length > 0, `Vector in ${c.id} has name`);
          harness.assert(typeof v.details === 'string' && v.details.length > 20, `Vector in ${c.id} has details`);
        }

        // Deduction Question
        const dq = c.deductionQuestion;
        harness.assert(dq && typeof dq.prompt === 'string' && dq.prompt.length > 10, `Case ${c.id} has deduction question prompt`);
        harness.assert(Array.isArray(dq.options) && dq.options.length >= 4, `Case ${c.id} deduction has >= 4 options`);
        harness.assertEqual(new Set(dq.options).size, dq.options.length, `Case ${c.id} deduction options are distinct`);
        harness.assert(Number.isInteger(dq.correctIndex) && dq.correctIndex >= 0 && dq.correctIndex < dq.options.length, `Case ${c.id} deduction correctIndex in range`);
        harness.assert(typeof dq.explanation === 'string' && dq.explanation.length > 20, `Case ${c.id} deduction has explanation`);

        // Limitation Question (Hedged Honesty)
        const lq = c.limitationQuestion;
        harness.assert(lq && typeof lq.prompt === 'string' && lq.prompt.length > 10, `Case ${c.id} has limitation question prompt`);
        harness.assert(Array.isArray(lq.options) && lq.options.length >= 4, `Case ${c.id} limitation has >= 4 options`);
        harness.assertEqual(new Set(lq.options).size, lq.options.length, `Case ${c.id} limitation options are distinct`);
        harness.assert(Number.isInteger(lq.correctIndex) && lq.correctIndex >= 0 && lq.correctIndex < lq.options.length, `Case ${c.id} limitation correctIndex in range`);
        harness.assert(typeof lq.explanation === 'string' && lq.explanation.length > 20, `Case ${c.id} limitation has explanation`);
      }
    });

    await harness.it('every skill tag in cases and drills resolves to valid skills in data/skills.json', () => {
      for (const c of osintData.cases) {
        harness.assert(Array.isArray(c.teaches) && c.teaches.length > 0, `Case ${c.id} has teaches array`);
        for (const skillId of c.teaches) {
          harness.assert(validSkillIds.has(skillId), `Case ${c.id} skill ${skillId} exists in skills.json`);
        }
      }

      for (const d of osintData.pivot_drills) {
        harness.assert(Array.isArray(d.teaches) && d.teaches.length > 0, `Drill ${d.id} has teaches array`);
        for (const skillId of d.teaches) {
          harness.assert(validSkillIds.has(skillId), `Drill ${d.id} skill ${skillId} exists in skills.json`);
        }
      }
    });

    await harness.it('bellingcat_toolkit entries all contain explicit "cannot establish" limitations', () => {
      for (const tool of osintData.bellingcat_toolkit) {
        harness.assert(typeof tool.name === 'string' && tool.name.length > 0, `Tool ${tool.id} has name`);
        harness.assert(typeof tool.category === 'string' && tool.category.length > 0, `Tool ${tool.id} has category`);
        harness.assert(typeof tool.url === 'string' && tool.url.startsWith('http'), `Tool ${tool.id} has valid URL`);
        harness.assert(typeof tool.description === 'string' && tool.description.length > 10, `Tool ${tool.id} has description`);
        harness.assert(typeof tool.tradecraftUse === 'string' && tool.tradecraftUse.length > 10, `Tool ${tool.id} has tradecraftUse`);
        harness.assert(typeof tool.limitation === 'string' && tool.limitation.length > 15, `Tool ${tool.id} has honest limitation caveat`);
      }
    });
  });

  // =========================================================================
  // Tier 2: Pure Assemblers & Determinism
  // =========================================================================
  await harness.describe('Tier 2: Pure Assemblers & Deterministic Replay', async () => {
    await harness.it('buildCasePool() preserves source question text and correct answer content', () => {
      const pool = buildCasePool(osintData.cases);
      harness.assertEqual(pool.length, osintData.cases.length, 'All valid cases assembled');

      for (const c of pool) {
        const src = osintData.cases.find((x) => x.id === c.id);
        harness.assert(Boolean(src), `Original case found for ${c.id}`);

        // Verify correct answer text matches original correct answer text after shuffle
        const origDeductionText = src.deductionQuestion.options[src.deductionQuestion.correctIndex];
        const newDeductionText = c.deductionQuestion.options[c.deductionQuestion.correctIndex];
        harness.assertEqual(newDeductionText, origDeductionText, `Case ${c.id} deduction answer preserved after shuffle`);

        const origLimitationText = src.limitationQuestion.options[src.limitationQuestion.correctIndex];
        const newLimitationText = c.limitationQuestion.options[c.limitationQuestion.correctIndex];
        harness.assertEqual(newLimitationText, origLimitationText, `Case ${c.id} limitation answer preserved after shuffle`);
      }
    });

    await harness.it('buildCasePool() is deterministic with same seed and permutes with different seed', () => {
      const a = buildCasePool(osintData.cases, 'seed-1');
      const b = buildCasePool(osintData.cases, 'seed-1');
      const c = buildCasePool(osintData.cases, 'seed-2');

      harness.assertEqual(JSON.stringify(a.map((x) => x.id)), JSON.stringify(b.map((x) => x.id)), 'Same seed -> identical order');
      harness.assert(JSON.stringify(a.map((x) => x.id)) !== JSON.stringify(c.map((x) => x.id)), 'Different seed -> permuted order');
    });

    await harness.it('buildCasePool() degrades gracefully on null or empty input', () => {
      harness.assertEqual(buildCasePool(null).length, 0, 'null -> []');
      harness.assertEqual(buildCasePool([]).length, 0, '[] -> []');
      harness.assertEqual(buildCasePool([{ invalid: true }]).length, 0, 'malformed records filtered');
    });

    await harness.it('buildPivotDrillPool() preserves correct answers and is deterministic', () => {
      const pool = buildPivotDrillPool(osintData.pivot_drills, 'drill-seed');
      harness.assertEqual(pool.length, osintData.pivot_drills.length, 'All drills assembled');

      for (const d of pool) {
        const src = osintData.pivot_drills.find((x) => x.id === d.id);
        const origText = src.options[src.correctIndex];
        const newText = d.options[d.correctIndex];
        harness.assertEqual(newText, origText, `Drill ${d.id} answer preserved`);
      }
    });
  });

  // =========================================================================
  // Tier 3: Chronolocation & Solar Trigonometry Mathematics
  // =========================================================================
  await harness.describe('Tier 3: Solar & Chronolocation Trigonometry Precision', async () => {
    await harness.it('calculates exact 45-degree angle when height equals shadow length', () => {
      const res = calculateSolarAltitude(10, 10);
      harness.assert(res.isValid, 'Calculation valid');
      harness.assertEqual(res.altitudeDeg, 45.0, 'Altitude is exactly 45.0 deg');
      harness.assertEqual(res.zenithDeg, 45.0, 'Zenith is exactly 45.0 deg');
      harness.assertEqual(res.shadowRatio, 1.0, 'Shadow ratio is 1.0');
    });

    await harness.it('calculates 90-degree zenith sun when shadow length is zero', () => {
      const res = calculateSolarAltitude(15, 0);
      harness.assert(res.isValid, 'Calculation valid');
      harness.assertEqual(res.altitudeDeg, 90.0, 'Altitude is 90.0 deg (overhead)');
      harness.assertEqual(res.zenithDeg, 0.0, 'Zenith is 0.0 deg');
      harness.assertEqual(res.shadowRatio, 0.0, 'Shadow ratio is 0.0');
    });

    await harness.it('calculates Operation Sunburst case values accurately (10m height, 28m shadow)', () => {
      const res = calculateSolarAltitude(10, 28);
      harness.assert(res.isValid, 'Calculation valid');
      harness.assertClose(res.altitudeDeg, 19.65, 0.05, 'Altitude is ~19.65 deg');
      harness.assertClose(res.zenithDeg, 70.35, 0.05, 'Zenith is ~70.35 deg');
      harness.assertEqual(res.shadowRatio, 2.8, 'Shadow ratio is 2.8');
    });

    await harness.it('handles invalid or boundary numeric inputs gracefully with clear errors', () => {
      const h0 = calculateSolarAltitude(0, 10);
      harness.assert(!h0.isValid, 'Height 0 is invalid');
      harness.assert(typeof h0.error === 'string' && h0.error.length > 0, 'Height 0 has error message');

      const negH = calculateSolarAltitude(-5, 10);
      harness.assert(!negH.isValid, 'Negative height is invalid');
      harness.assert(typeof negH.error === 'string', 'Negative height has error message');

      const negS = calculateSolarAltitude(10, -2);
      harness.assert(!negS.isValid, 'Negative shadow is invalid');
      harness.assert(typeof negS.error === 'string', 'Negative shadow has error message');

      const nanH = calculateSolarAltitude(NaN, 10);
      harness.assert(!nanH.isValid, 'NaN height is invalid');

      const infS = calculateSolarAltitude(10, Infinity);
      harness.assert(!infS.isValid, 'Infinity shadow is invalid');
    });

    await harness.it('estimates solar noon benchmarks correctly across latitudes', () => {
      // Equator (0 deg): Equinox noon is 90 deg, Summer noon is 90 deg, Winter noon is 66.56 deg
      const eq = estimateChronolocation(0, 75);
      harness.assertEqual(eq.solarNoonEquinox, 90.0, 'Equator equinox noon is 90 deg');
      harness.assert(eq.isAltitudePossibleAtNoon, '75 deg altitude is possible at equator');

      // 48 deg N (Operation Sunburst location)
      const lat48 = estimateChronolocation(48, 19.65);
      harness.assertEqual(lat48.solarNoonEquinox, 42.0, '48N equinox noon is 42 deg');
      harness.assertEqual(lat48.solarNoonSummer, 65.4, '48N summer noon is 65.4 deg');
      harness.assertEqual(lat48.solarNoonWinter, 18.6, '48N winter noon is 18.6 deg');
      harness.assert(lat48.isAltitudePossibleAtNoon, '19.65 deg is possible in summer/equinox');

      // Impossible noon altitude check: 60 deg altitude at 60 deg N (max summer noon is 53.44 deg)
      const imp = estimateChronolocation(60, 60.0);
      harness.assert(!imp.isAltitudePossibleAtNoon, '60 deg altitude is impossible at 60N (max 53.4 deg)');
    });
  });

  // =========================================================================
  // Tier 4: Analytical Ruling Evaluation & Bellingcat Filter
  // =========================================================================
  await harness.describe('Tier 4: Analytical Evaluation & Toolkit Search', async () => {
    const sampleCase = osintData.cases[0];

    await harness.it('evaluateCaseAnswer() correctly scores perfect analytical judgment with calibration', () => {
      const perfectSure = evaluateCaseAnswer(
        sampleCase,
        sampleCase.deductionQuestion.correctIndex,
        sampleCase.limitationQuestion.correctIndex,
        'sure'
      );
      harness.assert(perfectSure.isFullyCorrect, 'Fully correct');
      harness.assert(perfectSure.deductionCorrect && perfectSure.limitationCorrect, 'Both sub-answers correct');
      harness.assertEqual(perfectSure.score, 125, 'Score is 125 (100 * 1.25 for high certainty)');
      harness.assert(perfectSure.feedback.includes('CRITICAL DEDUCTION VERIFIED'), 'Verified feedback prefix');

      const perfectGuess = evaluateCaseAnswer(
        sampleCase,
        sampleCase.deductionQuestion.correctIndex,
        sampleCase.limitationQuestion.correctIndex,
        'guess'
      );
      harness.assertEqual(perfectGuess.score, 85, 'Score is 85 (100 * 0.85 for guess)');
    });

    await harness.it('evaluateCaseAnswer() penalizes overconfidence on incorrect rulings', () => {
      const wrongSure = evaluateCaseAnswer(
        sampleCase,
        (sampleCase.deductionQuestion.correctIndex + 1) % sampleCase.deductionQuestion.options.length,
        sampleCase.limitationQuestion.correctIndex,
        'sure'
      );
      harness.assert(!wrongSure.isFullyCorrect, 'Not fully correct');
      harness.assertEqual(wrongSure.score, 30, 'Score is 30 (50 * 0.6 penalty for overconfidence)');

      const totalBreach = evaluateCaseAnswer(
        sampleCase,
        (sampleCase.deductionQuestion.correctIndex + 1) % sampleCase.deductionQuestion.options.length,
        (sampleCase.limitationQuestion.correctIndex + 1) % sampleCase.limitationQuestion.options.length,
        'sure'
      );
      harness.assertEqual(totalBreach.score, 0, 'Total breach scores 0');
      harness.assert(totalBreach.feedback.includes('ANALYTICAL BREACH'), 'Breach feedback given');
    });

    await harness.it('filterToolkit() filters by category and keyword query', () => {
      const all = filterToolkit(osintData.bellingcat_toolkit, 'ALL');
      harness.assertEqual(all.length, osintData.bellingcat_toolkit.length, 'ALL returns all tools');

      const solar = filterToolkit(osintData.bellingcat_toolkit, 'CHRONOLOCATION');
      harness.assert(solar.length >= 2, 'Found chronolocation tools');
      harness.assert(solar.every((t) => t.category.includes('Chronolocation')), 'All match category');

      const queryMatch = filterToolkit(osintData.bellingcat_toolkit, 'ALL', 'shadow');
      harness.assert(queryMatch.length >= 2, 'Search for "shadow" finds tools');
      harness.assert(queryMatch.some((t) => t.name.toLowerCase().includes('suncalc')), 'Found SunCalc');

      const empty = filterToolkit(osintData.bellingcat_toolkit, 'ALL', 'nonexistent_xyz_query_token');
      harness.assertEqual(empty.length, 0, 'No match returns empty array');
    });
  });

  // =========================================================================
  // Tier 4b: Confidence honesty — no surface may fabricate a confidence claim
  // =========================================================================
  // The last audit finding on the game surfaces: the pivot drill hardcoded
  // `confidence: 'sure'` into every attempt and `evaluateCaseAnswer` defaulted its
  // confidence to 'sure'. Both fabricate a calibration measurement the operator never
  // made. These pins keep both paths honest.
  await harness.describe('Tier 4b: Confidence Honesty Invariants', async () => {
    await harness.it('evaluateCaseAnswer() fails closed when confidence is not stated', () => {
      const sampleCase = osintData.cases[0];
      const ci = sampleCase.deductionQuestion.correctIndex;
      const li = sampleCase.limitationQuestion.correctIndex;

      const unstated = evaluateCaseAnswer(sampleCase, ci, li);
      harness.assertEqual(unstated.score, 0, 'No confidence stated -> no score');
      harness.assert(!unstated.isFullyCorrect, 'No confidence stated -> not fully correct');
      harness.assert(unstated.feedback.includes('confidence'), 'Feedback says a stated confidence is required');

      for (const bad of [undefined, null, '', 'VERY SURE', 'certain', 1]) {
        const r = evaluateCaseAnswer(sampleCase, ci, li, bad);
        harness.assertEqual(r.score, 0, `Non-level value ${JSON.stringify(bad)} scores 0`);
      }
    });

    await harness.it('evaluateCaseAnswer() still scores all three real levels', () => {
      const sampleCase = osintData.cases[0];
      const ci = sampleCase.deductionQuestion.correctIndex;
      const li = sampleCase.limitationQuestion.correctIndex;

      harness.assert(evaluateCaseAnswer(sampleCase, ci, li, 'sure').score > 0, 'sure + correct scores');
      harness.assert(evaluateCaseAnswer(sampleCase, ci, li, 'unsure').score > 0, 'unsure + correct scores');
      harness.assert(evaluateCaseAnswer(sampleCase, ci, li, 'guess').score > 0, 'guess + correct scores');
    });

    await harness.it('the drill records through the shared control, not a hardcoded claim', () => {
      const src = readFileSync(new URL('../js/modules/osint.js', import.meta.url), 'utf8');
      harness.assert(src.includes("Confidence.mount(document.getElementById('drill-confidence-host')"),
        'the drill mounts the shared confidence control');
      harness.assert(!/confidence:\s*'sure'/.test(src),
        'no attempt site in osint.js hardcodes confidence \'sure\'');

      const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
      harness.assert(html.includes('id="drill-confidence-host"'), 'the drill panel has a confidence host');
      harness.assert(!src.includes("_selectedConfidence: 'sure'"),
        "the case desk does not preselect the flattering level ('unsure' initial, like the shared control)");
    });
  });

  // =========================================================================
  // Tier 5: Calibrated Arena Mode Brier Scoring Verification
  // =========================================================================
  await harness.describe('Tier 5: Calibrated Mode Brier Mathematics Invariants', async () => {
    // In calibrated mode:
    // P(sure) = 0.90, P(unsure) = 0.70, P(guess) = 0.50
    // Score = round(100 * (1 - (P - outcome)^2))
    const calcBrierPoints = (conf, isCorrect) => {
      const p = conf === 'sure' ? 0.90 : conf === 'unsure' ? 0.70 : 0.50;
      const o = isCorrect ? 1.0 : 0.0;
      return Math.round(100 * (1 - Math.pow(p - o, 2)));
    };

    await harness.it('rewards calibrated certainty when correct', () => {
      const sureCorrect = calcBrierPoints('sure', true); // 1 - 0.01 = 0.99 -> 99 pts
      const unsureCorrect = calcBrierPoints('unsure', true); // 1 - 0.09 = 0.91 -> 91 pts
      const guessCorrect = calcBrierPoints('guess', true); // 1 - 0.25 = 0.75 -> 75 pts

      harness.assertEqual(sureCorrect, 99, 'Sure and correct yields 99 pts');
      harness.assertEqual(unsureCorrect, 91, 'Unsure and correct yields 91 pts');
      harness.assertEqual(guessCorrect, 75, 'Guess and correct yields 75 pts');
      harness.assert(sureCorrect > unsureCorrect && unsureCorrect > guessCorrect, 'Higher confidence when right earns strictly more points');
    });

    await harness.it('punishes misplaced certainty when wrong, protecting honest uncertainty', () => {
      const sureWrong = calcBrierPoints('sure', false); // 1 - 0.81 = 0.19 -> 19 pts
      const unsureWrong = calcBrierPoints('unsure', false); // 1 - 0.49 = 0.51 -> 51 pts
      const guessWrong = calcBrierPoints('guess', false); // 1 - 0.25 = 0.75 -> 75 pts

      harness.assertEqual(sureWrong, 19, 'Sure and wrong yields only 19 pts');
      harness.assertEqual(unsureWrong, 51, 'Unsure and wrong yields 51 pts');
      harness.assertEqual(guessWrong, 75, 'Guess and wrong yields 75 pts');
      harness.assert(guessWrong > unsureWrong && unsureWrong > sureWrong, 'Honest guess when wrong earns 56 MORE points than arrogant certainty (75 vs 19)');
    });
  });

  return harness.summary();
}

runTests().then((r) => {
  if (r.failed > 0) process.exitCode = 1;
});
