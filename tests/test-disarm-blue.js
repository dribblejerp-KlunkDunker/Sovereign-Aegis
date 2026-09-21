/**
 * SOVEREIGN // AEGIS — Test Suite: DISARM Blue countermeasure dataset & AAR wiring
 *
 * The InfoWar AAR now grades against the genuine DISARM Blue framework (data/disarm_blue.json,
 * C-codes by tactic stage, CC-BY-SA-4.0) instead of only hand-written remedies. This suite checks
 * the two facts the feature depends on:
 *
 *   1. the dataset is well-formed — real C-codes, unique within the set, each placed in a valid
 *      DISARM tactic stage, with the framework's own "not recommended" flags preserved;
 *   2. every post-mortem diagnostic in DISARM_DIAGNOSTICS points at a stage that actually has
 *      countermeasures, so the AAR cannot silently fall back to an invented remedy.
 *
 * Zero external runtime dependencies.
 */

import { readFileSync } from 'node:fs';
import { DISARM_DIAGNOSTICS } from '../js/modules/infowar.js';

const blue = JSON.parse(readFileSync(new URL('../data/disarm_blue.json', import.meta.url), 'utf8'));

class TestHarness {
  constructor(name) {
    this.suiteName = name; this.totalAssertions = 0; this.passed = 0;
    this.failed = 0; this.failures = []; this.currentSuite = '';
  }
  describe(name, fn) { this.currentSuite = name; console.log(`\n  --- ${name} ---`); return fn(); }
  async it(name, fn) {
    try { await fn(); } catch (err) {
      this.failed++; this.totalAssertions++;
      this.failures.push({ suite: this.currentSuite, test: name, error: err.message });
      console.error(`  ✗ [FAIL] ${name} (${err.message})`);
    }
  }
  assert(cond, msg) {
    this.totalAssertions++;
    if (cond) { this.passed++; console.log(`    ✓ ${msg}`); }
    else { this.failed++; this.failures.push({ suite: this.currentSuite, test: msg, error: 'Assertion failed' }); console.error(`    ✗ [FAIL] ${msg}`); }
  }
  assertEqual(a, e, m) { this.assert(a === e, `${m} | got ${JSON.stringify(a)}, expected ${JSON.stringify(e)}`); }
  summary() {
    console.log('\n====================================================');
    console.log(`[${this.suiteName}] Summary: ${this.passed}/${this.totalAssertions} Passed (${this.failed} Failed)`);
    console.log('====================================================');
    if (this.failed > 0) {
      console.error('\nFailure Details:');
      this.failures.forEach(f => console.error(` - [${f.suite}] ${f.test}: ${f.error}`));
      process.exitCode = 1;
    }
    return { passed: this.passed, failed: this.failed, total: this.totalAssertions };
  }
}

const harness = new TestHarness('DISARM Blue Dataset & InfoWar AAR Suite');

async function runTests() {
  await harness.describe('Tier 1: data/disarm_blue.json is a faithful, well-formed dataset', async () => {
    await harness.it('carries provenance and licence metadata', () => {
      harness.assert(typeof blue.framework === 'string' && /Blue/i.test(blue.framework), 'names the Blue framework');
      harness.assert(/disarmfoundation\/DISARMframeworks/i.test(blue.source || ''), 'cites the DISARM Foundation source');
      harness.assertEqual(blue.license, 'CC-BY-SA-4.0', 'licence is CC-BY-SA-4.0');
    });

    await harness.it('every stage has an id, a name, and a countermeasures array', () => {
      harness.assert(Array.isArray(blue.stages) && blue.stages.length >= 16, `at least 16 tactic stages (${blue.stages?.length})`);
      const bad = blue.stages.filter(s => !/^TA\d{2}$/.test(s.id) || typeof s.name !== 'string' || !s.name
        || !Array.isArray(s.countermeasures));
      harness.assertEqual(bad.length, 0, 'no stage lacks id/name/countermeasures');
    });

    await harness.it('every countermeasure has a real C-code and a name', () => {
      const flat = blue.stages.flatMap(s => s.countermeasures);
      harness.assert(flat.length > 100, `substantial dataset (${flat.length} countermeasures)`);
      const bad = flat.filter(c => !/^C\d{5}$/.test(c.id) || typeof c.name !== 'string' || !c.name.trim());
      harness.assertEqual(bad.length, 0, `all ${flat.length} entries have a C-code id and name`);
    });

    await harness.it('C-codes are unique across the whole dataset', () => {
      const flat = blue.stages.flatMap(s => s.countermeasures);
      const ids = flat.map(c => c.id);
      harness.assertEqual(new Set(ids).size, ids.length, 'no duplicate C-code');
    });

    await harness.it('the framework\'s own "not recommended" flags are preserved and consistent', () => {
      const flat = blue.stages.flatMap(s => s.countermeasures);
      for (const c of flat) {
        const saysNotRecommended = /not recommended/i.test(c.name);
        harness.assertEqual(Boolean(c.notRecommended), saysNotRecommended,
          `${c.id} flag matches its name (${saysNotRecommended ? 'flagged' : 'not flagged'})`);
      }
      harness.assert(flat.filter(c => c.notRecommended).length >= 3, 'at least three entries are flagged not-recommended');
    });

    await harness.it('stages with content are the ones the AAR actually uses', () => {
      const byId = Object.fromEntries(blue.stages.map(s => [s.id, s]));
      for (const stageId of ['TA01', 'TA02', 'TA05', 'TA06', 'TA08', 'TA15']) {
        harness.assert(byId[stageId] && byId[stageId].countermeasures.length > 0,
          `${stageId} has countermeasures available`);
      }
    });
  });

  await harness.describe('Tier 2: InfoWar AAR diagnostics are wired to real Blue stages', async () => {
    const byId = Object.fromEntries(blue.stages.map(s => [s.id, s]));

    await harness.it('the six post-mortem diagnostics all resolve to a populated Blue stage', () => {
      harness.assert(Object.keys(DISARM_DIAGNOSTICS).length >= 6, `at least 6 diagnostics (${Object.keys(DISARM_DIAGNOSTICS).length})`);
      for (const [key, diag] of Object.entries(DISARM_DIAGNOSTICS)) {
        harness.assert(/^TA\d{2}$/.test(diag.blueStage || ''), `${key} has a valid blueStage (${diag.blueStage})`);
        const stage = byId[diag.blueStage];
        harness.assert(Boolean(stage), `${key}.blueStage (${diag.blueStage}) exists in the dataset`);
        harness.assert(Array.isArray(stage.countermeasures) && stage.countermeasures.length > 0,
          `${key} → ${diag.blueStage} has countermeasures to render (${stage.countermeasures.length})`);
      }
    });

    await harness.it('the diagnostics still reference the app\'s canonical Red T-codes', () => {
      const expected = ['T0002', 'T0004', 'T0008', 'T0009', 'T0015', 'T0026'];
      for (const id of expected) {
        harness.assert(Boolean(DISARM_DIAGNOSTICS[id]), `diagnostic ${id} present`);
      }
    });
  });

  return harness.summary();
}

runTests().then((r) => { if (r.failed > 0) process.exitCode = 1; });
