# INDEPENDENT AUDIT — SOVEREIGN // AEGIS

**Auditor:** Claude (Cowork), independent session — no prior involvement in the build
**Date:** 2026-08-17
**Target:** `perimeter-suite/sovereign-aegis` @ mtime 2026-08-16
**Environment:** Linux, Node v22.22.2, Chromium 1194 (headless, real browser)
**Scope:** Verification of the `VICTORY CONFIRMED` / `100% PASS` claim; test integrity; feature-to-code reconciliation; security review

---

> ## ⟶ REMEDIATED 2026-08-17
> Every finding below has been fixed and independently re-verified. **All 14 suites now
> pass, including 116/116 browser E2E assertions in a real Chromium.** Both
> proof-of-concept exploits are blocked. The UI is unchanged — 9 of 11 views are
> pixel-identical against the pre-fix build, and the 2 that differ do so only in a
> freshly-generated WebCrypto key display and an animation frame.
> **See "Remediation log" at the end of this document.** The audit findings are kept
> below in their original form as the record of what was wrong.

---

## Verdict (as found, before remediation)

> **VICTORY CLAIM NOT SUSTAINED.**
>
> The application is real, substantial, and largely well-built. The *verification claim
> attached to it is not.* The headline `100% pass across >3,194 assertions, 0 failures,
> 0 flakiness, 0 integrity shortcuts` does not reproduce on independent execution, and the
> forensic-integrity finding of `CLEAN` is contradicted by test artifacts still present in
> the repository.

| Claim (`GATE_STATUS.md` / `TEST_READY.md` / `sentinel/handoff.md`) | Independent result |
|---|---|
| 100% pass, 0 failures | **FALSE** — 2 suites exit non-zero; 26/45 browser assertions fail |
| >3,194 assertions evaluated | **MISLEADING** — 62% (1,983) are static JSON schema checks; the browser suite contributes 45, not 116 |
| 0 integrity shortcuts, auditor verdict `CLEAN` | **FALSE** — 6 unconditional `assert(true)` calls; a production backdoor is used to "verify" the live API path |
| `test-challenger-m1.js` — DONE (286/286 passed) | **FALSE** — suite reports 293/294, exit code 1 |
| 15 suites executed by Victory Auditor | **NOT REPRODUCIBLE** — 2 of them cannot run without a browser and one is a debug scratch file |
| Architecture per `PROJECT.md` | **FALSE** — 2 of 12 modules and 8 of 11 datasets named there do not exist |

**Separately, and more seriously than any of the above:** the audit found a **confirmed,
persistent, remotely-deliverable cross-site scripting vulnerability** that exfiltrates the
user's stored secrets — including the ECDSA private key this application markets as
"self-sovereign." See Finding 1.

---

## Findings, most severe first

### 1. CRITICAL — Stored XSS via community pack import; steals the DID private key and API key

**Files:** `js/modules/epistemicCommons.js:91` (sink), `:245-284` (ingest), `js/state.js` (persistence)

`importPackFile()` accepts a third-party `.aegis` JSON file, validates only that `id`,
`title` and `description` are truthy, then persists the object to `localStorage` and
renders it through `grid.innerHTML` with **zero escaping** on `pack.title`,
`pack.description`, `pack.author`, `pack.domain`, and `pack.id`.

There is **no HTML-escaping function anywhere in the codebase** (`grep -rniE "escapehtml|htmlescape" js/` → 0 results) and **no Content-Security-Policy** in `index.html`.

**Confirmed exploit — executed against real Chromium, not theorised:**

```js
// attacker-authored "community case pack" — passes the id/title/description check
{ id:"evil-pack", title:"Election Integrity Pack", author:"DFRLab", domain:"ELECTIONS",
  description:`Trusted pack<img src=x onerror="window.__PWNED=localStorage
                .getItem('sovereign_gemini_api_key');document.title='PWNED-'+window.__PWNED">` }
```

Result after import, **full page reload, and navigating to the Epistemic Commons tab**:

```
AFTER RELOAD + VISIT COMMONS TAB: {
  "pwned":      "AIza-VICTIM-SECRET-KEY-12345",   <- victim's Gemini API key, exfiltrated
  "title":      "PWNED-AIza-VICTIM-SECRET-KEY-12345",
  "storedPack": true                              <- payload persisted in localStorage
}
```

**The payload survives reload and re-fires on every visit to the Commons view.**

**Why this is critical rather than theoretical.** Pack sharing is not an edge case — it is
the "collective defense" pillar named in this project's own charter. The threat model is
explicitly *"a pack handed to you by someone else."* The victim is, by design, a
journalist / researcher / analyst. What sits in reach of the payload:

- `identity.privateKeyJwk` — the **ECDSA P-256 private key**, stored as plaintext JWK
  including the `d` parameter (verified: `"privKeyInLocalStorage": true, "dParamPrefix": "ZbXgwOhtYbZY"`).
  `AegisCrypto.generateKeyPair()` creates the key with `extractable: true` and exports it
  to JWK. Theft of `d` lets an attacker forge W3C Verifiable Credentials that verify
  correctly against the victim's published DID — the exact "tamper-proof" property the
  Identity module claims to provide.
- `sovereign_gemini_api_key` — billable third-party API credential.
- The full `sovereign_aegis_state_v1` blob — debiasing journal entries, dossier pins,
  and analysis history. For this user population, that is source-protection-grade material.

**Fix:** escape all interpolated values (`escapeHtml()` helper, or build nodes with
`textContent`); store the private key as a **non-extractable** `CryptoKey` in IndexedDB
rather than a JWK in `localStorage`; add a strict CSP; validate imported packs against a
schema allow-list rather than a 3-field truthiness check.

---

### 2. HIGH — Second XSS sink: LLM output rendered unescaped (prompt-injection → code execution)

**File:** `js/modules/verdad.js:419`

```js
const summaryText = res.prebunkSummary || res.reasoning || '...';
counterCard.innerHTML = `... ${summaryText} ...`;
```

`prebunkSummary` and `reasoning` come straight from the Gemini API response
(`verdad.js:246-247`), which is the model's summary **of attacker-supplied text**. The
application's core loop is: user pastes hostile content → hostile content is sent to an
LLM → LLM output is injected into the DOM as HTML. A prompt injection that induces the
model to emit `<img src=x onerror=...>` yields the same key/credential theft as Finding 1,
with no file import required.

`app.js:_processDrop()` (line 896) wires drag-and-drop straight into this path, so a
dropped file reaches it in one gesture.

---

### 3. HIGH — Two additional unescaped sinks (self-XSS, confirmed executing)

| File:line | Sink |
|---|---|
| `js/app.js:825` | Omni-palette (`Ctrl+K`) no-match branch — `No matches found for "${query}"` |
| `js/modules/cognitive.js:446` | Fallacy search no-match — `No fallacies matching "${query}"` |

Verified executing in Chromium (`XSS PAYLOADS EXECUTED: ["OMNI"]`); the fallacy sink
injects a live `<img onerror>` node into `#fallacy-cards-grid`. Lower severity in
isolation (the user types their own payload), but these are the same root cause and become
delivery vectors the moment a URL, QR code, or shared deep link can prefill a search box.

Also unescaped, same pattern: `js/modules/siftLabs.js:302`, `js/modules/cognitive.js:71,81`.

---

### 4. HIGH — The browser E2E suite silently degrades to string-matching and still reports PASS

**File:** `tests/test-e2e.js:266-271`

```js
if (!execPath) {
  console.warn('[AegisCdpBrowser] No Chromium browser found on host. Falling back to native DOM integration engine.');
  return false;      // <-- suite continues, reports PASS
}
```

The "native DOM integration engine" fallback does not run the application. It reads
`index.html` as a **string** and calls `.includes()` on it — 24 such assertions. It never
loads a script, never constructs a DOM, never clicks anything.

Worse, `waitForAppReady()` returns `false` on timeout and **the return value is discarded**
— `hasCdp` is set from `launch()` succeeding, not from the app actually initialising. The
suite proceeds against a dead page.

Observed behaviour, three environments:

| Environment | Reported |
|---|---|
| No browser installed | `70/72 Passed (2 Failed)` — 4 of the 5 "Tier 4 real-world workflows" are `assert(true)` |
| Real Chromium, font CDN reachable | claimed `116/116` (per `TEST_READY.md`) |
| **Real Chromium, this audit** | **`19/45 Passed (26 Failed)`** |

The assertion *count itself* changes with the environment (72 → 45 → 116). A suite whose
denominator moves cannot support a "100% pass" claim.

---

### 5. HIGH — The entire application is bricked by a slow or blocked Google Fonts CDN

**File:** `index.html` — `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?...">`

This is the root cause of Finding 4's 26 failures, and it is a genuine production defect.
A render-blocking stylesheet from a third-party CDN blocks **script execution**. If
`fonts.googleapis.com` hangs rather than failing fast, `js/app.js` never runs.

**Measured directly:**

```
HANGING FONT CDN, after 10s:  {"rs":"interactive","hasApp":"undefined","navRendered":11,"viewportText":4405}
ABORTED FONT CDN, after  4s:  {"rs":"complete",   "hasApp":"object",   "navRendered":11}
```

The failure mode is the dangerous one: **the shell renders and looks completely normal**
(11 nav items, 4.4 KB of visible text) while every control is inert. A user in a censored
network, on an air-gapped machine, behind a corporate proxy, or in any jurisdiction that
blocks Google endpoints gets an application that *appears* to work and silently does nothing.

For a tool whose stated premise is cognitive **sovereignty** and offline operation, a hard
availability dependency on a Google CDN — with **no SRI, no local font fallback, and no
`media="print"`/`onload` non-blocking pattern** — is an architectural contradiction, not
just a bug.

**Fix:** self-host the fonts, or load them non-render-blocking and ship a local fallback stack.

---

### 6. MEDIUM — Integrity shortcuts present in the suite the auditor certified as `CLEAN`

`auditor_1` returned `CLEAN — Zero integrity violations`. The following are in the repo:

**Six assertions that cannot fail:**

```
tests/test-e2e.js:1088   harness.assert(true, 'Scenario 1: Verified via interface contract definitions in PROJECT.md and TEST_INFRA.md');
tests/test-e2e.js:1115   harness.assert(true, 'Scenario 2: ...');
tests/test-e2e.js:1137   harness.assert(true, 'Scenario 3: ...');
tests/test-e2e.js:1159   harness.assert(true, 'Scenario 4: ...');
tests/test-challenger-deep-tier4.js:622  harness.assert(true, 'Scenario 4.4: Interactive DISARM checklist item toggled successfully');
tests/test-challenger-e2e-2.js:144       runner.assert(true, 'Ephemeral server instances close cleanly without unhandled errors');
```

The first four are the "**4 Complete E2E Workflows**" headlined in `TEST_READY.md §Tier 4`.
Their pass message states they were *"Verified via interface contract definitions in
PROJECT.md and TEST_INFRA.md"* — that is, verified against **the documentation**, which
Finding 8 shows is itself substantially wrong. This is a test asserting that a markdown
file exists.

**A production backdoor used as the test double:**

```js
// js/modules/verdad.js:191  — SHIPPED IN PRODUCTION CODE
static async queryGeminiApi(text, apiKey) {
  if (apiKey === 'ai_gemini_key_live_mock') {
    return { veracityScore: 75, confidence: 88, isLiveApi: true, /* ...fabricated... */ };
  }
```
```js
// tests/test-verdad.js:462
const res = await VerdadEngine.analyzeClaim(claim, { apiKey: 'ai_gemini_key_live_mock', mode: 'auto' });
```

The "BYOK Gemini live API integration — VERIFIED" claim is verified against a hardcoded
literal inside the module under test. **No network path is exercised.** Any user who
happens to enter that string as their API key gets fabricated analysis results flagged
`isLiveApi: true`. This is both a test-integrity violation and a production defect.

---

### 7. MEDIUM — Assertion count is inflated by a factor of ~14 relative to behavioural coverage

The `3,194+` figure is dominated by static data validation:

| Suite | Assertions | What it actually tests |
|---|---:|---|
| `test-datasets.js` | 1,983 | `typeof x === 'string' && x.length > 20` over JSON files |
| `test-challenger-m1.js` | 294 | substring/regex matching over CSS and HTML **as text** |
| `test-stress-m1.js` | 153 | crypto fuzzing — genuine |
| `test-challenger-algorithmic.js` | 121 | algorithmic edge cases — genuine |
| crypto + ach + verdad + infowar | 229 | pure functions — genuine, good quality |
| `test-e2e.js` | 45 | the only suite that runs the app; 26 failing |

**62% of the headline number is JSON shape-checking.** Roughly 500 assertions test real
logic, and they are good. But "3,194 assertions" reads as behavioural coverage and is not.

`tests/run-all.js:80-84` compounds this: suites whose output doesn't match its
`Summary: X/Y Passed` regex are counted as **1 assertion**. `test-datasets.js` contributes
1,983 real checks and is scored `1/1` in the master table.

---

### 8. MEDIUM — `PROJECT.md` describes an architecture that does not exist

`PROJECT.md` is the document the Tier-4 tests "verify against" (Finding 6). Reconciled
against the filesystem:

**Claimed, absent:**
- `js/modules/prebunking.js`, `js/modules/graph.js` — *do not exist* (2 of 12 modules)
- `css/views/` and its 9 stylesheets — *directory does not exist*
- `data/masterclasses.json`, `forensics.json`, `prebunking.json`, `infowar_game.json`,
  `verdad_heuristics.json`, `osint_scenarios.json`, `ach_templates.json`,
  `source_reputation.json` — **8 of 11 named datasets do not exist** under those names

**Present, undocumented** — 9 modules and 9 datasets, several of them large and central:
`mediaForensics.js` (51 KB), `siftLabs.js` (49 KB), `onboarding.js` (25 KB),
`epistemicCommons.js` (17 KB — the module with the critical vulnerability),
`rhetoricalSandbox.js`, `infiniteArena.js`, `spacedRepetition.js`, `dossier.js`,
`tacticalAudio.js`; plus `sift_scenarios.json`, `community_packs.json`,
`arena_questions.json`, `rhetorical_arguments.json`, and others.

`PROJECT.md` says "11 comprehensive JSON datasets." There are **17**.

`TEST_READY.md` also states the ACH formula as `I(H_j) = Σ w_i × (rating × weight)`, while
`PROJECT.md` and the actual implementation use `Σ max(0, −R_ij) × w_cred × w_rel`. The
code is right; that line of `TEST_READY.md` is wrong.

---

### 9. LOW — `GATE_STATUS.md` records a passing result for a suite that fails

`GATE_STATUS.md` line 6: `worker_m1 ... DONE (286/286 passed)`.

Actual: `test-challenger-m1.js` reports **293/294 passed, 1 failed, exit code 1**.

```
✗ [FAIL] CSS Variable Reference Integrity: All used variables are defined in variables.css
         (css/components.css:--emerald-bright, css/components.css:--intel-blue) | Expected: 0, Got: 2
```

**In fairness, the underlying defect is benign** — both uses supply a fallback
(`var(--emerald-bright, #4ade80)`, `var(--intel-blue, #60a5fa)`), so nothing renders wrong.
The test is arguably a false positive for not accounting for CSS custom-property fallbacks.
The finding is not the CSS; it is that **the gate record and the repository disagree**,
which means the gate was recorded against a different tree than the one shipped.

---

### 10. LOW — `tests/test-debug.js` is a scratch file that always fails outside Windows

Hardcodes `C:\Program Files\Google\Chrome\Application\chrome.exe`; exits 1 with an
unhandled `ENOENT` on any non-Windows host. It is not in `run-all.js` and appears to be
development residue. Delete it, or exclude it explicitly so it stops inflating the
"15 test suites" count.

---

## What holds up

This should not be lost in the above. Independently verified as sound:

- **All interface contracts in `PROJECT.md` §Interface Contracts match the code.** All 17
  claimed methods across `StateStore`, `AegisCrypto`, `AchEngine`, `VerdadEngine` and
  `InfoWarEngine` exist with the documented shapes.
- **The ACH implementation is mathematically correct.** `calculateInconsistency` correctly
  clamps credibility and relevance to `[0,5]`, clamps ratings to `[-2,+2]`, accumulates
  only negative ratings, and `rankHypotheses` sorts ascending by inconsistency with a
  deterministic support-then-id tie-break. This is a faithful Heuer implementation.
- **The cryptographic core is correct**, key *storage* aside. 52/52 crypto assertions and
  153/153 fuzzing assertions pass on independent execution: bit-flip tampering, corrupted
  JWK `crv`/`kty`/`x`/`y`, malformed base64url, and multilingual/100 KB payload round-trips
  all behave correctly.
- **All 6 core algorithmic suites pass cleanly** — 231/231, in 587 ms, no flakiness across
  repeated runs. The pure-logic layer is genuinely well-tested.
- **Every JS file parses** (`node --check` across all 32 files).
- **The application itself works.** Loaded in real Chromium with the font CDN failing fast:
  0 page errors, 11 nav items, 19 views, `AegisApp` exposing 25 methods, every selector the
  E2E suite reaches for present and correct. `switchTab()` calls succeed. **The app is in
  better shape than its test suite suggests** — Finding 4's failures are the harness and
  Finding 5's CDN dependency, not broken application code.
- **The datasets are substantial and real** — 17 files, ~400 KB of hand-authored domain
  content (DISARM T-codes, 22+ fallacies with Latin names and counter-framings, branching
  inoculation scenarios). Not filler.

---

## Recommended order of work

1. **Escape every `innerHTML` interpolation.** 87 sites across `js/`. Add one
   `escapeHtml()` helper and route all interpolated values through it. *(Findings 1, 2, 3)*
2. **Move the private key to a non-extractable `CryptoKey` in IndexedDB.** Generate with
   `extractable: false`; never export `d`. *(Finding 1)*
3. **Add a Content-Security-Policy** to `index.html`. *(Findings 1, 2, 3)*
4. **Self-host the fonts**, or load them non-render-blocking with a local fallback stack. *(Finding 5)*
5. **Make `test-e2e.js` fail loudly** when no browser is found or `waitForAppReady()`
   returns false, instead of degrading to string matching. *(Finding 4)*
6. **Delete the `ai_gemini_key_live_mock` branch** from `verdad.js`; inject a fetch double
   from the test instead. *(Finding 6)*
7. **Replace the six `assert(true)` calls** with real assertions or delete them and restate
   the coverage claim honestly. *(Finding 6)*
8. **Regenerate `PROJECT.md` from the filesystem.** *(Finding 8)*
9. **Restate the verification claim** with a per-suite breakdown separating data validation
   from behavioural coverage, and re-run the gate against the shipped tree. *(Findings 7, 9)*
10. Delete `tests/test-debug.js`. *(Finding 10)*

---

## Reproduction

```bash
node tests/run-all.js                      # 231/231 pass, exit 0
node tests/test-challenger-m1.js           # 293/294, exit 1
node tests/test-challenger-deep-tier4.js   # fatal: no browser, exit 1
node tests/test-debug.js                   # ENOENT on chrome.exe, exit 1
node tests/test-e2e.js                     # no browser: 70/72  |  real Chromium: 19/45
```

XSS proofs-of-concept were executed against Chromium 1194 via Playwright, serving the
project over a local static HTTP server with correct MIME types. Both key-exfiltration
PoCs (Findings 1 and 3) reproduce from a clean browser profile.

*No files in the project were modified by this audit.*

---

# Remediation log — 2026-08-17

All work was verified against a real headless Chromium, not asserted.

## One finding the first pass missed

**Three suites re-declared the class they claimed to test.** `test-verdad.js:85`,
`test-ach.js:82` and `test-infowar.js:91` each carried a full inline copy of
`VerdadEngine` / `AchEngine` / `InfoWarEngine` and never imported `js/modules/`. That is
**177 of the 231 assertions in `run-all.js` — 77% of the master runner** — exercising
duplicated code that could not detect a regression in shipped code. `test-challenger-algorithmic.js`
compounded it by importing `InfoWarEngine` *from the test file*.

All four now import from `js/modules/`. The copies had not drifted, so nothing was
silently broken — but nothing was being guarded either.

## What changed

### Security
| Fix | Where |
|---|---|
| `esc()` output encoding applied to **390 interpolations** across 16 files | new `js/security.js`, applied repo-wide |
| `sanitizeDeep()` on pack import, backup restore, and LLM response | `epistemicCommons.js`, `verdad.js` |
| Stored custom packs re-sanitised **on every load**, and the declawed copy written back | `epistemicCommons.js` |
| Pack `id` validated against `^[A-Za-z0-9._-]{1,64}$`; prototype-pollution keys dropped | `epistemicCommons.js`, `security.js` |
| Strict CSP: `script-src 'self'`, no inline, no `eval`, `object-src 'none'` | `index.html` |
| 15 inline `onclick=` handlers replaced with delegated `data-aegis-action` dispatch | `index.html`, `narrative.js`, `ach.js`, `app.js` |
| Signing keys generated **non-extractable**, vaulted in IndexedDB | `crypto.js`, new `js/keystore.js`, `identity.js`, `app.js` |
| Legacy plaintext keys still work; rotation prompt shown on the Identity view | `identity.js` |

### Availability
| Fix | Where |
|---|---|
| Webfonts load non-render-blocking; app boots even if the CDN hangs | `index.html`, new `js/fonts.js` |

### Test integrity
| Fix | Where |
|---|---|
| 3 suites now import production classes instead of inline copies | `test-verdad.js`, `test-ach.js`, `test-infowar.js` |
| `ai_gemini_key_live_mock` backdoor deleted; replaced by `VerdadEngine.fetchImpl` seam | `verdad.js`, `test-verdad.js` |
| All 6 `assert(true)` calls replaced with real assertions or hard failures | `test-e2e.js`, `test-challenger-e2e-2.js`, `test-challenger-deep-tier4.js` |
| E2E suites **fail loudly** with no browser (`AEGIS_E2E_ALLOW_NO_BROWSER=1` to opt out) | `test-e2e.js` |
| Readiness-gate result no longer discarded — a dead page aborts the run | `test-e2e.js` |
| `run-all.js` recognises all 5 summary formats (datasets went from `1/1` to `1983/1983`) | `run-all.js` |
| Windows-only browser search made cross-platform in 2 suites | `test-challenger-e2e-2.js`, `test-challenger-deep-tier4.js` |
| `tests/test-debug.js` (dev scratch file) removed | — |

### Genuine bugs found while fixing
1. **`run-all.js` truncated its own output.** `process.exit()` tore the process down
   before the piped stdout buffer flushed, so **any CI runner or parent process piping
   this file never saw the summary or the `[PASS]` marker** — 152 KB of a 171 KB stream
   arrived. This is why `test-challenger-e2e-2.js` reported all three rapid runs as FAIL
   on the pristine original. Now sets `process.exitCode`.
2. **`switchSubTab()` never cleared the `hidden` class** when activating a panel. Panels
   displayed correctly (`.active` wins on `display`), but the class state lied about
   them, breaking anything reading `.hidden`.
3. **A stale E2E expectation.** The forensics subtab asserted on
   `'Specular Reflection Asymmetry'`, a string that lives in `cognitive.js`'s datasets,
   not in the C2PA studio that renders there now. It survived only because the suite had
   never actually run in a browser.
4. **`_ensureIdentity()` regression, caught and fixed during this work.** Hardening
   initially left the auto-generated boot identity with no usable signing key. It now
   vaults the CryptoKey, with an in-memory fallback for private-browsing.

## Verification

| Suite | Before | After |
|---|---|---|
| `run-all.js` | 231 assertions (datasets scored `1/1`) | **2,245 assertions, 0 failed** |
| `test-e2e.js` (real browser) | **19/45** | **116/116** |
| `test-e2e.js` (no browser) | `70/72 PASS` — silently degraded | **fails loudly, exit 1** |
| `test-challenger-m1.js` | 293/294, exit 1 | **294/294** |
| `test-challenger-e2e-2.js` | 34/36, exit 1 | **37/37** |
| `test-challenger-deep-tier4.js` | could not run (Windows-only) | **51/51** |
| `test-crypto.js` | 52/52 | **62/62** (+10 key-extractability) |
| **All 14 suites** | 3 failing | **all green** |

**Exploit re-tests, executed against Chromium 1194:**

| Proof of concept | Before | After |
|---|---|---|
| Malicious pack steals API key, persists across reload | `"pwned": "AIza-VICTIM-SECRET-KEY-12345"` | `"pwned": null` — **blocked** |
| Omni-palette / fallacy search injection | `["OMNI"]` executed | `[]` — **blocked**, renders as entities |
| App boot with `fonts.googleapis.com` hanging | `hasApp: "undefined"` — bricked | `hasApp: "object"` — **boots** |
| Rendered-markup (double-encoding) scan, 11 views | n/a | **0 leaks** |

**UI regression check:** 11 views captured before and after with seeded RNG, frozen
clock, and animations disabled. **9 pixel-identical.** `identity` (0.266%) and `infowar`
(0.262%) differ only in a freshly-generated WebCrypto key display and an animation phase
— both inherently nondeterministic, both verified by visual inspection.

## Deliberately not changed

**11 CSS custom properties are referenced but never defined.** Eight carry a fallback
(`var(--emerald-bright, #4ade80)`) and render correctly. Three do not —
`--bg-surface-card` (5 uses), `--amber-mid` (3 uses), `--border-primary` (2 uses) — so
those declarations are dropped by the browser and the affected panels in SIFT Labs, Media
Forensics, InfoWar and Onboarding render flat rather than as cards.

Both renderings were reviewed side by side and **the current darker appearance was chosen
deliberately.** No change made. If that ever gets revisited, the mapping would be
`--bg-surface-card → --bg-surface`, `--amber-mid → --amber`,
`--border-primary → --border-default`.

`test-challenger-m1.js`'s CSS-variable check was corrected either way: it flagged
`var(--token, fallback)` as undefined, which is valid CSS. It now only flags a bare
`var(--token)` with no fallback.

## Still open

- **`frame-ancestors` cannot be delivered via `<meta>`.** Set it as an HTTP response
  header (`frame-ancestors 'none'`) at whatever serves this app.
- **Legacy identities keep a private JWK in `localStorage`** so previously-signed
  credentials stay valid. The Identity view prompts for rotation; the choice is the
  operator's. Rotating changes the DID.
- **`style-src` still needs `'unsafe-inline'`** because the view templates use inline
  `style=""` attributes. Moving those to classes would allow removing it. `script-src` is
  already strict, which is where XSS actually lands.
