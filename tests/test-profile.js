/**
 * SOVEREIGN // AEGIS — Test Suite: Personal Defense Profile scoring (js/profile.js)
 *
 * WHY GROUND-TRUTH TESTS, NOT PROPERTY TESTS
 * -------------------------------------------
 * The profile's scoring rules are the product's safety boundary: reverse-coding must flip
 * the right items, band edges must tie to `mixed` rather than guessing, and the salience
 * rule is the ONLY thing that decides which watchpoints rise. Every claim here is asserted
 * against synthetic responses of KNOWN value, hand-computed before the implementation —
 * the same standard the competency spine set.
 *
 * This suite also enforces DESIGN-personal-defense-profile.md §6: every route skillId in
 * data/profile-guides.json must exist in data/skills.json, so the map cannot rot when
 * skills are re-tagged.
 *
 * Zero external runtime dependencies.
 */

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
      console.error('\n[FAIL] Profile scoring suite FAILED.');
      process.exitCode = 1;
    } else {
      console.log('\n[PASS] All profile scoring assertions passed.');
    }
  }
}

const fsMod = await import('node:fs');
const urlMod = await import('node:url');
const readData = (rel) =>
  JSON.parse(fsMod.readFileSync(urlMod.fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8'));

const ITEMS = readData('data/profile-items.json').items;
const GUIDES = readData('data/profile-guides.json');
const SKILL_IDS = new Set(readData('data/skills.json').map((s) => s.id));

const {
  applyRecord, compute, latestRetake, salience, buildGuide, needsSupport,
  LENS_BAND_HIGH, LENS_BAND_LOW, MINI_SALIENCE, OBSERVATION_WINDOW_DAYS,
  SALIENCE_MIN_COUNT, CONFIDENT_ANSWER, SALIENCE_MIN_OBSERVATIONS
} = await import('../js/profile.js');

const NOW = 1786930000000;
const DAY = 86400000;

const t = new TestHarness('Profile');

// Answer every item of a lens/context so its CODED mean lands on the given values.
// raw = coded for record:1 items; raw = 6 - coded for record:-1 items (the flip under test).
function answerLens(lens, codedValues) {
  const items = ITEMS.filter((i) => i.lens === lens);
  if (codedValues.length > items.length) throw new Error(`lens ${lens} has only ${items.length} items`);
  return codedValues.map((c, i) => ({ itemId: items[i].id, value: items[i].record === -1 ? 6 - c : c, retake: 0 }));
}
function answerContext(ctx, codedValues, marksByIndex = []) {
  const items = ITEMS.filter((i) => i.lens === `ctx-${ctx}`);
  if (codedValues.length > items.length) throw new Error(`ctx ${ctx} has only ${items.length} items`);
  return codedValues.map((c, i) => ({
    itemId: items[i].id,
    value: c === null ? null : (items[i].record === -1 ? 6 - c : c),
    retake: 0,
    ...(marksByIndex[i] ? { scope: marksByIndex[i] } : {})
  }));
}

console.log('\n=== SOVEREIGN // AEGIS — PERSONAL DEFENSE PROFILE SCORING SUITE ===');

/* ---------------------------------------------------------------- inventory data */

await t.describe('Inventory data contract (data/profile-items.json)', async () => {
  await t.it('has 38 items: 6 lenses x 4, 7 contexts x 2', () => {
    t.assertEqual(ITEMS.length, 38, '38 items total');
    for (const lens of ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'emotional-stability', 'fairness-reciprocity']) {
      t.assertEqual(ITEMS.filter((i) => i.lens === lens).length, 4, `${lens}: 4 items`);
    }
    for (const ctx of ['urgency', 'authority', 'social-approval', 'scarcity', 'conflict', 'isolation', 'fatigue']) {
      t.assertEqual(ITEMS.filter((i) => i.lens === `ctx-${ctx}`).length, 2, `ctx-${ctx}: 2 mini-check items`);
    }
  });

  await t.it('every item is well-formed; ~1/3 of lens items are reverse-coded', () => {
    const bad = ITEMS.filter((i) =>
      !/^pitem\./.test(i.id) || !i.text || i.text.length < 40 ||
      !(i.record === 1 || i.record === -1));
    t.assertEqual(bad.length, 0, `no malformed items${bad.length ? ` (${bad.map((b) => b.id).join(', ')})` : ''}`);
    // Life-domain marks exist on the pressure-context items ONLY — the watchpoint domain
    // annotation (salience) is their single consumer, so trait items must carry none.
    const scopeShapeBad = ITEMS.filter((i) =>
      i.lens.startsWith('ctx-')
        ? !Array.isArray(i.scopes) || i.scopes.length === 0
        : Array.isArray(i.scopes) && i.scopes.length > 0);
    t.assertEqual(scopeShapeBad.length, 0, 'scopes live on ctx items only');
    t.assertEqual(new Set(ITEMS.map((i) => i.id)).size, 38, 'ids are unique');
    const ALLOWED = new Set(['online', 'work', 'close', 'money', 'health', 'civic']);
    const scopeBad = ITEMS.flatMap((i) => (i.scopes || []).filter((s) => !ALLOWED.has(s)));
    t.assertEqual(scopeBad.length, 0, 'scopes use the allowed vocabulary');
    const reversed = ITEMS.filter((i) => !i.lens.startsWith('ctx-') && i.record === -1).length;
    t.assert(reversed >= 7 && reversed <= 10, `${reversed}/24 lens items reverse-coded (spec: ~1/3)`);
    // Direction contract: the mini-check needs "high coded value = high pressure presence",
    // and every ctx item is worded so AGREEMENT marks the pressure — so they must all be
    // record +1. A record:-1 ctx item would make an honest "yes, this works on me" answer
    // read as NO pressure (this exact bug shipped once and was caught by the browser walk).
    t.assertEqual(ITEMS.filter((i) => i.lens.startsWith('ctx-') && i.record !== 1).length, 0,
      'all 14 ctx items: agreement = pressure presence (record +1)');
  });
});

/* --------------------------------------------------------------- applyRecord */

await t.describe('applyRecord — reverse-coding and rejection', async () => {
  await t.it('flips record:-1 items and passes record:1 items', () => {
    t.assertEqual(applyRecord({ record: 1 }, 4), 4, 'record:1 passes through');
    t.assertEqual(applyRecord({ record: -1 }, 4), 2, 'record:-1 flips 4 to 2');
    t.assertEqual(applyRecord({ record: -1 }, 1), 5, 'record:-1 flips 1 to 5');
    t.assertEqual(applyRecord({ record: -1 }, 5), 1, 'record:-1 flips 5 to 1');
    t.assertEqual(applyRecord({}, 3), 3, 'missing record defaults to forward coding');
  });

  await t.it('rejects anything outside 1..5 — an unanswered item is not a midpoint', () => {
    t.assertEqual(applyRecord({}, 0), null, '0 rejected');
    t.assertEqual(applyRecord({}, 6), null, '6 rejected');
    t.assertEqual(applyRecord({}, 3.5), null, 'non-integer rejected');
    t.assertEqual(applyRecord({}, '3'), null, 'string rejected');
    t.assertEqual(applyRecord({}, null), null, 'null rejected');
  });
});

/* --------------------------------------------------------------------- compute */

await t.describe('compute — lens bands from known responses', async () => {
  await t.it('zero responses is a well-defined cold start, not a verdict', () => {
    const m = compute([], ITEMS);
    for (const lens of ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'emotional-stability', 'fairness-reciprocity']) {
      t.assertEqual(m.get(lens).level, null, `${lens} reads unknown (null), never bad`);
      t.assertEqual(m.get(lens).n, 0, `${lens} n=0`);
    }
  });

  await t.it('all-5 coded answers on a lens read "more"', () => {
    const m = compute([...answerLens('openness', [5, 5, 5, 5])], ITEMS);
    t.assertEqual(m.get('openness').level, 'more', 'openness: more');
    t.assertEqual(m.get('openness').mean, 5, 'mean is exactly 5');
  });

  await t.it('reverse-coding is applied: agreeing with a vulnerable-wording item counts as pressure', () => {
    const responses = ITEMS.filter((i) => i.lens === 'openness').map((item) => ({
      itemId: item.id, value: item.record === -1 ? 1 : 5, retake: 0
    }));
    const m = compute(responses, ITEMS);
    t.assertEqual(m.get('openness').level, 'more', 'coded 5s (raw 1 on reversed items) read "more"');
    t.assertEqual(m.get('openness').mean, 5, 'and the mean confirms the flip happened');
  });

  await t.it('band edges: mean exactly 3.5 and exactly 2.5 tie to "mixed"', () => {
    t.assertEqual(compute([...answerLens('extraversion', [4, 4, 4, 2])], ITEMS).get('extraversion').level, 'mixed', `mean ${LENS_BAND_HIGH} ties to mixed`);
    t.assertEqual(compute([...answerLens('extraversion', [2, 3, 2, 3])], ITEMS).get('extraversion').level, 'mixed', `mean ${LENS_BAND_LOW} ties to mixed`);
    t.assertEqual(compute([...answerLens('extraversion', [4, 4, 4, 3])], ITEMS).get('extraversion').level, 'more', 'mean 3.75 above the high edge reads more');
    t.assertEqual(compute([...answerLens('extraversion', [2, 2, 2, 2])], ITEMS).get('extraversion').level, 'less', 'mean 2.0 below the low edge reads less');
  });

  await t.it('unanswered and unknown items never count — n is real answered items only', () => {
    const responses = [...answerLens('agreeableness', [5, 5, 5])]; // one item omitted
    responses.push({ itemId: 'pitem.does-not-exist', value: 5, retake: 0 });
    const m = compute(responses, ITEMS);
    t.assertEqual(m.get('agreeableness').n, 3, 'n=3 from 4 items');
    t.assertEqual(m.get('agreeableness').mean, 5, 'mean from answered items only');
  });
});

/* -------------------------------------------------------------- latestRetake */

await t.describe('latestRetake', async () => {
  await t.it('is null on an empty log and the max present otherwise', () => {
    t.assertEqual(latestRetake([]), null, 'empty -> null');
    t.assertEqual(latestRetake([{ retake: 1 }, { retake: 0 }]), 1, 'max wins');
    t.assertEqual(latestRetake([{ retake: 0 }, { retake: 2 }, { retake: 1 }]), 2, 'out-of-order log still reads the max');
    t.assertEqual(latestRetake([{}]), null, 'records without retake are not counted');
  });
});

/* ------------------------------------------------------------------ salience */

const obs = (over = {}) => ({ contextTag: 'urgency', ts: NOW, resisted: null, confidence: 3, ...over });

await t.describe('salience truth table — the only algorithm here is counted', async () => {
  await t.it('mini-check unanswered -> never salient, whatever the observations', () => {
    const s = salience('urgency', [], [obs(), obs()], ITEMS, { now: NOW });
    t.assertEqual(s.salient, false, 'not salient');
    t.assertEqual(s.miniAvg, null, 'miniAvg null');
    t.assert(/unanswered/.test(s.reason), `reason names the missing input (${s.reason})`);
  });

  await t.it('mini-check below threshold -> not salient', () => {
    const s = salience('urgency', [...answerContext('urgency', [3, 3])], [obs(), obs()], ITEMS, { now: NOW });
    t.assertEqual(s.salient, false, 'avg 3.0 not salient');
    t.assert(/< 3\.5/.test(s.reason), `reason states the number (${s.reason})`);
  });

  await t.it('threshold edge: mean exactly 3.5 IS salient with 2 observations', () => {
    const s = salience('urgency', [...answerContext('urgency', [4, 3])], [obs(), obs()], ITEMS, { now: NOW });
    t.assertEqual(s.miniAvg, 3.5, 'mean is exactly 3.5');
    t.assertEqual(s.salient, true, 'salient at the boundary');
  });

  await t.it('one neutral observation is not enough (net 1 < 2)', () => {
    const s = salience('urgency', [...answerContext('urgency', [5, 5])], [obs()], ITEMS, { now: NOW });
    t.assertEqual(s.salient, false, '1 observation not salient');
    t.assert(/net supporting observations 1 < 2/.test(s.reason), `reason states the count (${s.reason})`);
  });

  await t.it('two observations in the window -> salient', () => {
    const s = salience('urgency', [...answerContext('urgency', [5, 5])], [obs(), obs()], ITEMS, { now: NOW });
    t.assertEqual(s.salient, true, '2 observations salient');
    t.assertEqual(s.netCount, 2, 'net 2');
  });

  await t.it('one resisted:false observation alone is enough — a logged failure is direct evidence', () => {
    const s = salience('urgency', [...answerContext('urgency', [5, 5])], [obs({ resisted: false })], ITEMS, { now: NOW });
    t.assertEqual(s.salient, true, 'resisted:false promotes alone');
    t.assertEqual(s.unfavorableCount, 1, 'unfavorableCount 1');
  });

  await t.it('a confident disconfirmation subtracts one count', () => {
    // 3 observations: 2 neutral + 1 confident resisted -> net 3 - 1 = 2 -> still salient.
    const s = salience('urgency', [...answerContext('urgency', [5, 5])],
      [obs(), obs(), obs({ resisted: true, confidence: 2 })], ITEMS, { now: NOW });
    t.assertEqual(s.disconfirmCount, 1, 'one disconfirmation counted');
    t.assertEqual(s.netCount, 2, 'net 2 after subtraction');
    t.assertEqual(s.salient, true, 'still salient at net 2');
  });

  await t.it('...and can tip a borderline case back to not-salient', () => {
    // 2 observations: 1 neutral + 1 confident resisted -> net 2 - 1 = 1 -> not salient.
    const s = salience('urgency', [...answerContext('urgency', [5, 5])],
      [obs(), obs({ resisted: true, confidence: 2 })], ITEMS, { now: NOW });
    t.assertEqual(s.netCount, 1, 'net 1 after subtraction');
    t.assertEqual(s.salient, false, 'not salient');
  });

  await t.it('a disconfirmation the user is not confident in does not subtract — it stays a logged event', () => {
    const s = salience('urgency', [...answerContext('urgency', [5, 5])],
      [obs(), obs({ resisted: true, confidence: 1 })], ITEMS, { now: NOW });
    t.assertEqual(s.disconfirmCount, 0, 'low-confidence resisted is not a disconfirmation');
    t.assertEqual(s.netCount, 2, 'counts as a supporting observation');
    t.assertEqual(s.salient, true, 'salient');
  });

  await t.it('observations outside the 30-day window do not count', () => {
    const old1 = obs({ ts: NOW - 31 * DAY });
    const old2 = obs({ ts: NOW - 40 * DAY });
    const s = salience('urgency', [...answerContext('urgency', [5, 5])], [old1, old2], ITEMS, { now: NOW });
    t.assertEqual(s.recentCount, 0, 'no recent observations');
    t.assertEqual(s.salient, false, 'not salient');
    t.assertEqual(s.totalObservations, 2, 'but totalObservations still counts the full log');
  });

  await t.it('observations of other contexts never count toward this one', () => {
    const s = salience('urgency', [...answerContext('urgency', [5, 5])],
      [obs({ contextTag: 'fatigue' }), obs({ contextTag: 'fatigue' })], ITEMS, { now: NOW });
    t.assertEqual(s.recentCount, 0, 'other contexts excluded');
    t.assertEqual(s.salient, false, 'not salient');
  });
});

/* ------------------------------------------- salience domain annotation */

await t.describe('salience domain annotation — recorded marks, never the item vocabulary', async () => {
  // What the checkboxes captured lives on the RESPONSE (r.scope), not the item: the
  // annotation must read the marks, not the full offer list — the browser walk caught
  // the first implementation leaking item.scopes wholesale.
  await t.it('unions the recorded marks of answers that cleared the bar', () => {
    const s = salience('urgency',
      [...answerContext('urgency', [5, 5], [['online', 'money', 'work'], ['online', 'money']])],
      [], ITEMS, { now: NOW });
    t.assertEqual(JSON.stringify(s.domains), '["online","money","work"]', 'union in answer order, deduped');
  });

  await t.it('a sub-bar answer contributes none of its marks, even when its sibling fires', () => {
    const s = salience('urgency',
      [...answerContext('urgency', [5, 3], [['online', 'money'], ['work', 'close']])],
      [], ITEMS, { now: NOW });
    t.assertEqual(JSON.stringify(s.domains), '["online","money"]', 'only the firing answer carries its marks in');
  });

  await t.it('an answer can fire with zero marks and stay silent', () => {
    const s = salience('urgency', [...answerContext('urgency', [5, 5])], [], ITEMS, { now: NOW });
    t.assertEqual(JSON.stringify(s.domains), '[]', 'no marks recorded -> no domains claimed');
  });

  await t.it('empty when nothing cleared the bar or the mini-check is unanswered', () => {
    const marks = [['online'], ['money']];
    t.assertEqual(salience('urgency', [...answerContext('urgency', [1, 1], marks)], [], ITEMS, { now: NOW }).domains.length, 0, 'all low: marks stay banked');
    t.assertEqual(salience('urgency', [], [], ITEMS, { now: NOW }).domains.length, 0, 'unanswered');
    t.assertEqual(salience('urgency', [...answerContext('urgency', [3, null], marks)], [], ITEMS, { now: NOW }).domains.length, 0, 'partial pass clears nothing');
  });

  await t.it('travels onto the buildGuide watchpoint; event-only watchpoints carry []', () => {
    const skills = readData('data/skills.json');
    const mini = [...answerContext('urgency', [5, 5], [['online', 'money'], []])];
    const g = buildGuide(mini, compute(mini, ITEMS), [], GUIDES, skills, { now: NOW, items: ITEMS });
    const u = g.watchpoints.find((w) => w.context === 'urgency');
    t.assertEqual(JSON.stringify(u.domains), '["online","money"]', 'mini-driven watchpoint annotated from marks');
    const g2 = buildGuide([], compute([], ITEMS), [obs({ resisted: false })], GUIDES, skills, { now: NOW, items: ITEMS });
    const e = g2.watchpoints.find((w) => w.context === 'urgency');
    t.assertEqual(JSON.stringify(e.domains), '[]', 'event-only watchpoint claims no domains');
  });
});

/* ----------------------------------------------------------------- buildGuide */

await t.describe('buildGuide — practice map from the same counted inputs', async () => {
  const skills = readData('data/skills.json');
  const base = () => ({
    responses: [...answerLens('openness', [5, 5, 5, 5]), ...answerContext('urgency', [5, 5])],
    observations: [],
    guides: GUIDES,
    opts: { now: NOW, items: ITEMS }
  });

  await t.it('every route skillId in profile-guides.json exists in skills.json', () => {
    const missing = Object.values(GUIDES.contexts)
      .map((c) => c.routeSkillId)
      .filter((id) => !SKILL_IDS.has(id));
    t.assertEqual(missing.length, 0, `all 7 route skillIds resolve${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`);
  });

  await t.it('assets come only from lenses that read "more", with the lens named', () => {
    const g = buildGuide(base().responses, compute(base().responses, ITEMS), base().observations, GUIDES, skills, base().opts);
    const assetLenses = new Set(g.assets.map((a) => a.lens));
    t.assertEqual(assetLenses.has('openness'), true, 'openness (more) contributes assets');
    t.assertEqual(assetLenses.has('extraversion'), false, 'extraversion (unknown) contributes none');
    t.assert(g.assets.length >= 2, `${g.assets.length} asset lines`);
    t.assert(g.assets.every((a) => typeof a.text === 'string' && a.text.length > 20), 'asset text is real copy');
  });

  await t.it('watchpoints appear for active contexts only, noted vs promoted by the counted rule', () => {
    const g = buildGuide(base().responses, compute(base().responses, ITEMS), [], GUIDES, skills, base().opts);
    const urgency = g.watchpoints.find((w) => w.context === 'urgency');
    t.assert(urgency, 'urgency watchpoint shown (mini-check active)');
    t.assertEqual(urgency.salience, 'noted', 'mini-check alone -> noted');
    t.assertEqual(urgency.evidence, 'mini-check only', 'evidence states its source');
    t.assertEqual(g.watchpoints.some((w) => w.context === 'fatigue'), false, 'fatigue (mini unanswered) not shown');
  });

  await t.it('observations promote a watchpoint and re-label its evidence', () => {
    const opts = base().opts;
    const observations = [
      { contextTag: 'urgency', ts: NOW, resisted: null, confidence: 3 },
      { contextTag: 'urgency', ts: NOW - DAY, resisted: null, confidence: 2 }
    ];
    const g = buildGuide(base().responses, compute(base().responses, ITEMS), observations, GUIDES, skills, opts);
    const urgency = g.watchpoints.find((w) => w.context === 'urgency');
    t.assertEqual(urgency.salience, 'promoted', '2 logged events promote');
    t.assertEqual(urgency.evidence, 'mini-check + logged events', 'evidence combines both signals');
  });

  await t.it('countermeasures carry the if-then plans from the guide data', () => {
    const g = buildGuide(base().responses, compute(base().responses, ITEMS), [], GUIDES, skills, base().opts);
    const cm = g.countermeasures.find((c) => c.context === 'urgency');
    t.assertEqual(cm.plan, GUIDES.contexts.urgency.countermeasure, 'plan matches the data verbatim');
    t.assertEqual(cm.tacticFamily, GUIDES.contexts.urgency.tacticFamily, 'tactic family matches');
  });

  await t.it('routes resolve skill labels and deep-link ids', () => {
    const g = buildGuide(base().responses, compute(base().responses, ITEMS), [], GUIDES, skills, base().opts);
    for (const r of g.routes) {
      const def = skills.find((s) => s.id === r.skillId);
      t.assertEqual(r.skillLabel, def ? def.label : r.skillId, `${r.context} label resolves`);
    }
  });

  await t.it('the disconfirmation prompt and evidence note travel with the map', () => {
    const g = buildGuide(base().responses, compute(base().responses, ITEMS), [], GUIDES, skills, base().opts);
    t.assertEqual(g.disconfirmation, GUIDES.disconfirmationPrompt, 'disconfirmation prompt present');
    t.assertEqual(g.evidenceNote, GUIDES.evidenceNote, 'evidence note present');
    t.assert(/trait prediction/.test(g.evidenceNote), 'the honest qualifier is in the note');
  });

  await t.it('an unfavorable observation shows its context even without the mini-check', () => {
    // Fatigue mini-check unanswered, but one resisted:false event: shown, evidence = logged event.
    const responses = [...answerLens('openness', [5, 5, 5, 5])];
    const observations = [{ contextTag: 'fatigue', ts: NOW, resisted: false, confidence: 3 }];
    const g = buildGuide(responses, compute(responses, ITEMS), observations, GUIDES, skills, { now: NOW, items: ITEMS });
    const f = g.watchpoints.find((w) => w.context === 'fatigue');
    t.assert(f, 'fatigue shown from the logged event alone');
    t.assertEqual(f.evidence, 'logged event', 'evidence is the event, honestly labelled');
  });
});

/* ---------------------------------------------------------------- needsSupport */

await t.describe('needsSupport — coercive-control routing on the operator\'s OWN text', async () => {
  await t.it('flags coercive-control markers in the operator\'s own words', () => {
    const card = GUIDES.supportCard;
    t.assertEqual(needsSupport({ outcome: 'they are isolating me from my friends' }, card), true, 'isolat matches');
    t.assertEqual(needsSupport({ initialReaction: 'felt afraid of what would happen' }, card), true, 'afraid of matches');
    t.assertEqual(needsSupport({ tactic: 'control me financially' }, card), true, 'control me matches');
    t.assertEqual(needsSupport({ action: 'I paused before replying' }, card), false, 'ordinary copy does not match');
    t.assertEqual(needsSupport({ outcome: 'they said I could not leave the house' }, card), false, 'copy outside the keyword set does not match');
  });

  await t.it('degrades safely on missing inputs', () => {
    t.assertEqual(needsSupport(null, GUIDES.supportCard), false, 'null observation -> false');
    t.assertEqual(needsSupport({ outcome: 'they hurt me' }, undefined), false, 'no card -> false');
    t.assertEqual(needsSupport({ outcome: 'THEY CONTROL ME FINANCIALLY' }, GUIDES.supportCard), true, 'match is case-insensitive');
  });
});

t.summary();
