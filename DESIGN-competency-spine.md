# Design — Competency Spine (Roadmap Phase 1)

**Status:** proposed, not built.
**Problem it solves:** 87 content items, 48 assessable items, 0 records of an attempt. Nothing in
SOVEREIGN // AEGIS knows whether a person got anything right, so nothing can adapt and nothing can
be evaluated.

---

## 1. Requirements

### Functional
- Record every right/wrong moment against **a skill**, not a screen.
- Estimate per-skill mastery, with an honest confidence that reflects sample size.
- Return a practice queue ordered by expected learning gain.
- Report performance on **held-out** items over time, so transfer can be measured.

### Non-functional
| Requirement | Target | Why this number |
|---|---|---|
| Attempt write latency | non-blocking, < 1 frame | it happens mid-interaction, during a quiz answer |
| Estimate read latency | < 5 ms for all 24 skills | called on every view render |
| Durability | survives a localStorage wipe | already solved by `persist.js`; reuse it |
| Log capacity | 10⁵ attempts without redesign | ~15 yrs of heavy daily use; past that, bucket by month |
| Network | none, ever | the product premise |
| Testability | pure functions, ground-truth tests | house standard set by `dsp.js` / `c2pa.js` |

### Constraints
- No build step. Plain ES modules.
- 20 existing modules; the contract between them must not churn.
- ~400 KB of existing content must be **tagged**, not rewritten.

---

## 2. High-level design

```
  data/skills.json ──┐
                     │  skillId is the only shared vocabulary
  content records ───┤  fallacies / disarm / sift / masterclass
    teaches: [id]    │  → declares what it TEACHES
                     │
  question records ──┤  sm2 cards / arena questions
    tests:   [id]    │  → declares what it TESTS
                     ▼
        ┌──────────────────────────────────────────┐
        │  js/competency.js        PURE, no I/O    │
        │    estimate(attempts)  -> Mastery        │
        │    rank(items, model)  -> ordered items  │
        │    transfer(attempts)  -> Report         │
        └──────────────┬───────────────────────────┘
                       │ takes attempts as an argument;
                       │ never reads storage itself
        ┌──────────────▼───────────────────────────┐
        │  js/attemptlog.js       I/O, append-only │
        │    append(attempt)                       │
        │    readAll() / readSince(ts)             │
        │    export() / import()                   │
        └──────────────┬───────────────────────────┘
                       │ IndexedDB, one store, monthly buckets
                       ▼
   modules call:  AttemptLog.append(...)  and  Competency.estimate(...)
```

**The load-bearing decision: `competency.js` performs no I/O.** It takes an array of attempts and
returns numbers. That makes every estimator claim testable against a simulated learner of known
ability, which is the only way to know the estimator works. `attemptlog.js` owns all storage and has
no opinions about learning.

---

## 3. Data model

### `data/skills.json`
```json
{
  "id": "skill.fallacy.ad-hominem",
  "label": "Recognise an ad hominem",
  "pillar": "cognitive",
  "prerequisites": [],
  "heldOutItemIds": ["arena-q-104", "sm2-card-31"]
}
```
Flat list, ~24 entries. `prerequisites` drives Phase 3's progressive disclosure. `heldOutItemIds`
is declared **here**, once, so held-out items cannot leak into practice by accident — the exclusion
lives with the skill definition rather than being re-derived in each module.

### Attempt record — append-only, never updated
```json
{
  "v": 1,
  "id": "att_01JQ...",
  "ts": 1786930000000,
  "skillId": "skill.fallacy.ad-hominem",
  "itemId": "arena-q-104",
  "correct": true,
  "latencyMs": 4210,
  "context": "arena",
  "heldOut": false
}
```
Seven fields, ~140 bytes. 10⁵ attempts ≈ 14 MB — comfortable in IndexedDB, and small enough that
`export()` produces a file a person can actually keep.

`v` is present from day one. A schema version costs one byte now and saves a migration later.

### What is deliberately **not** stored
Derived mastery numbers. They are recomputed from the log on load (~10⁵ records in well under
100 ms). Storing them would freeze today's guess at the estimator into the data — and the estimator
is the part most likely to be wrong.

---

## 4. API contracts

```js
// js/attemptlog.js  — I/O only
await AttemptLog.append({skillId, itemId, correct, latencyMs, context, heldOut});
await AttemptLog.readAll();                  // Attempt[]
await AttemptLog.readSince(timestamp);       // Attempt[]
await AttemptLog.export();                   // JSON string, user-facing backup
await AttemptLog.import(json, {merge:true}); // dedupe by attempt id
await AttemptLog.clear();                    // wired into Hard Reset

// js/competency.js  — pure
Competency.estimate(attempts, skillId) -> {
  mastery: 0.62,        // 0..1
  confidence: 0.41,     // 0..1, rises with n and recency
  n: 7,
  lastSeen: 1786930000000,
  trend: 'improving'    // 'improving' | 'flat' | 'declining'
}

Competency.estimateAll(attempts, skills) -> Map<skillId, Mastery>

Competency.rank(items, masteryMap, {now, limit}) -> Item[]

Competency.transfer(attempts) -> {
  baseline: {n: 10, accuracy: 0.30, at: ts},
  current:  {n: 10, accuracy: 0.70, at: ts},
  delta: 0.40,
  ci95: [0.05, 0.68],          // wide, and shown wide
  caveat: 'Within-subject, n=10 per point. Not a controlled trial.'
}
```

`transfer()` returning its own `caveat` string is intentional: the honest qualifier travels with the
number instead of depending on whoever writes the UI remembering to add it.

---

## 5. Deep dive — the two algorithms

### Mastery estimate
Start with **exponentially-weighted accuracy with a Beta prior**:

```
mastery    = (Σ wᵢ·correctᵢ + α) / (Σ wᵢ + α + β)      wᵢ = λ^(age in days), λ = 0.97
confidence = n / (n + k)                                 k = 5
```

Beta(α=1, β=1) means a skill with zero attempts reads 0.5 mastery / 0.0 confidence — "unknown", not
"bad". The decay makes recent evidence dominate, so improvement is visible and stale competence
decays rather than being banked forever.

**Trade-off:** this is weaker than BKT or IRT — no guess/slip parameters, no item difficulty. It is
~30 lines, has two tunable constants, and can be explained to a user in one sentence. Item difficulty
needs cross-user data to estimate, and there is no cross-user data here by design. Revisit only when
real logs exist.

### Practice ranking
Expected learning gain, three factors multiplied:

```
gain = zone(mastery) × due(lastSeen, mastery) × coverage(n)

zone(m)  = 1 - |m - 0.7| / 0.7     peak at 70% — hard enough to learn, not to demoralise
due(...) = SM-2 interval already in spacedRepetition.js, reused not reinvented
coverage = 1 / (1 + n)             break ties toward skills with the least evidence
```

Never-attempted skills surface early via `coverage`, mastered skills fall away via `zone`, and the
existing SM-2 scheduler keeps doing the job it already does well.

---

## 6. Storage, scale, reliability

- **One IndexedDB store**, key `att_<ulid>` (ULIDs sort by time, so `readSince` is a range scan).
- **Monthly buckets** past 10⁵ records: `attempts_2026_08`. Deferred — `readAll()` is fine until then.
- **Write path:** `append()` resolves after the IDB transaction commits, but callers do not await it.
  A dropped attempt costs one data point and must never block a quiz answer.
- **No migration risk:** the log is append-only and versioned, so a schema change means new records
  with `v: 2` and a reader that handles both.
- **Cold start:** zero attempts is a valid, well-defined state — everything reads "unknown". Phase 3's
  placement diagnostic seeds it; nothing depends on it being seeded.
- **Corruption:** `import()` validates every record and rejects the file rather than half-loading it,
  matching the pack-import behaviour hardened during the audit.

### Migration from what exists
| Existing | Becomes |
|---|---|
| `sm2.deck` ease/interval | kept as-is; `due()` still reads it |
| `arena.elo` | left in place as a score; not used for mastery |
| `cognitive.progress.*` | one synthetic attempt per completed item, `context: 'migrated'` |

Marking migrated attempts distinguishable matters — otherwise the first transfer report silently
mixes real evidence with a backfill.

---

## 7. Trade-offs made explicit

| Decision | Cost | Why anyway |
|---|---|---|
| Recompute mastery from the log | CPU on load | the estimator will change; the log will not |
| Pure `competency.js`, separate I/O | one extra module | it is the only way to test the estimator |
| Simple estimator over BKT/IRT | less accurate | no cross-user data exists; complexity buys nothing yet |
| Held-out set declared in `skills.json` | 20% fewer practice items | without it, transfer cannot be measured at all |
| Tag content rather than restructure it | tagging 87 records | the content is the best asset in the repo |
| No cross-device sync | mastery is per-device | the premise; export covers the real need |

---

## 8. What I would revisit

- **After ~1,000 attempts:** whether 24 skills is right. Expect merges (never separately failed) and
  splits (conflating two things). The log makes re-tagging a recompute.
- **λ = 0.97 and k = 5** are guesses. Once there is data, fit them against actual retention curves.
- **`readAll()` on every load** stops being acceptable somewhere past 10⁵ attempts. Bucket then.
- **If `transfer()` shows no improvement**, that is the finding, and the honest response is to change
  the training — not the metric.
- **If sync ever ships**, attempt logs are the most sensitive data in the app: a record of exactly
  what someone is bad at. It should be the last thing to sync, and only end-to-end encrypted.

---

## 9. First commit's worth of work

1. `data/skills.json` — 24 skills, derived from existing content.
2. `js/attemptlog.js` + `tests/test-attemptlog.js` — append, read, export/import, corrupt-file rejection.
3. `js/competency.js` + `tests/test-competency.js` — **simulated learner of known ability p=0.3 must
   converge to mastery ≈ 0.3 ± 0.1 within 40 attempts.** That single test is what makes the estimator
   trustworthy rather than plausible.
4. Tag one pillar's content (fallacies, 24 records) end to end.
5. Wire `recordAttempt()` into Arena only — prove the loop on one module before touching eight.
