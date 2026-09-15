# Seam Analysis — SOVEREIGN // AEGIS ↔ BlackVault-Reema

**Status:** analysis. Ground truth read from both trees on 2026-08-19.

## What actually exists (not what the docs claim)

**BlackVault-Reema** is a complete, tested messaging spine:

- v6 protocol: X25519 + ML-KEM-768 hybrid bootstrap, ML-DSA-65 signatures, prekey
  bundles, one-time prekeys, key directory with proof-of-possession.
- Ciphertext-only relay (`src/server.js`): `publish` / `fetch-directory` / `send` /
  `subscribe` / `ping`, fixed-size padding, store-and-forward.
- Node + browser clients sharing one core (`public/crypto-core.js`); sessions,
  serialization, crash recovery, delivery receipts, groups (`group-core.js`).
- **A messenger UI already exists** (`public/messenger.html`), plus `npm test` covering
  integration + fuzz + browser E2E + XSS + interop.

**SOVEREIGN // AEGIS** is the brain, and the only part that moves the product:

- `VerdadEngine.analyzeClaim(text, {apiKey, mode})` — pure, DOM-free, already importable
  in Node. Offline heuristics + BYOK Gemini + published fact-check citations.
- Competency spine (`competency.js`, `attemptlog.js`) — mastery, calibration, transfer.
- Prebunk counter-cards, source reputation, DID signing (ECDSA P-256, `did:key`).

## The seam in one diagram

```
  ┌────────────────────────────  messenger client  ────────────────────────────┐
  │                                                                             │
  │  AEGIS (brain, client-side only)          Reema (spine)                     │
  │  ┌─────────────────────────────┐          ┌──────────────────────────────┐ │
  │  │ verdad-service.js           │          │ crypto-core / browser-crypto │ │
  │  │  shouldShare(draft) → gate  │──────────│ session.encrypt / decrypt     │ │
  │  │  analyzeMessage(inbound)    │          │  ── envelope ──► relay ──►    │ │
  │  │  prebunk → signed payload   │          │  identity (X25519 + PQ)      │ │
  │  └─────────────┬───────────────┘          └──────────────┬───────────────┘ │
  │                │  DID (P-256)                            │ routing address  │
  │                └─────────── binding credential ───────────┘                  │
  └─────────────────────────────────────────────────────────────────────────────┘
```

## The two identities, and why we do NOT unify them

| | AEGIS | Reema |
|---|---|---|
| Crypto | WebCrypto ECDSA P-256 | libsodium X25519 + ML-DSA-65 + ML-KEM-768 |
| Identifier | `did:key` | 44-char `BLAKE2b(signPk ‖ dhPk)` address |
| Storage | non-extractable CryptoKey (IndexedDB) | `.identity.json` (8 keypairs + OTK pool) |
| Job | sign statements/credentials | establish sessions + encrypt |

They are two different crypto stacks for two different jobs, and **forcibly merging them
would be a rewrite of one stack for zero MVP benefit.** WebCrypto cannot do ML-DSA /
ML-KEM / X25519 without adding libsodium to AEGIS; replacing Reema's PQ identity with
P-256 would throw away the post-quantum property that is the spine's entire point.

### Reconciliation: a signed binding credential (recommended)

Keep both identities. At first contact, the operator's AEGIS DID signs one attestation:

```
{
  "@context": "https://aegis.example/v1",
  "type": "KeyBinding",
  "did": "did:key:z6Mk...",                    // AEGIS P-256 DID
  "routingAddress": "BLAKE2b(signPk ‖ dhPk)",  // Reema address (44 b64 chars)
  "signPk": "...",                              // Reema ML-DSA public key
  "signedAt": "2026-08-19T...Z",
  "proof": { ... }                              // AEGIS DID signature
}
```

- **Transport + encryption** trust Reema's keys (unchanged).
- **Attestation / credentials / prebunk cards** trust the DID.
- The binding credential is itself a message payload; a peer verifies the DID signature
  and that the sender holds the Reema private key (the session already proves that).
- No core change to either project. This is the only identity work that is not a rewrite.

The one residual to state in the UI: the DID and the routing address are *bound by a
signature the operator made*, not by any authority — which is the honest, self-sovereign
property anyway.

## VERDAD as a service — the contract the messenger imports

`js/verdad-service.js` (pure, DOM-free, importable from Node and the browser):

```js
// full structured verdict for rendering an inbound message
await analyzeMessage(text, { apiKey?, mode?, withFactChecks?, factCheckApiKey? })
  -> { claimText, veracityScore, manipulationRisk, recommendation, verdictClass,
       emotionalTriggers, detectedFallacies, biasIndicators, confidence,
       reasoning, prebunkSummary, isLiveApi, factChecks? }

// fast pre-send gate — defaults to offline heuristics (no network, private, ~ms)
await shouldShare(text, { mode?, apiKey? })
  -> { allow: boolean, recommendation: 'share'|'caution'|'block',
       headline: string, reason: string, result }

// pure classifier, exported so the thresholds are testable
classify(verdict) -> { recommendation, verdictClass }
```

Contract invariants (asserted in tests):

- `recommendation` derives only from `manipulationRisk` — never from the LLM's opinion
  directly, so a prompt injection that puffs `veracityScore` cannot unlock `block`.
- `shouldShare` never blocks on network: offline by default, no fact-check fetch, no
  Gemini, so the share gate is a few milliseconds and works air-gapped.
- The service touches no DOM. The messenger renders the result however it likes; the
  AEGIS UI and the messenger UI share this one module, not two verdict logics.

## What is genuinely missing (the build list)

1. ✅ `js/verdad-service.js` + tests — **built** (27 assertions, in `tests/run-all.js`).
2. ✅ Binding credential — **built** as `js/keybinding.js` (sign/verify + tamper and
   hostile-credential rejection, 12 assertions). It reuses `AegisCrypto.signStatement` /
   `verifyStatement`; the only new code is the credential shape and the DID↔JWK match check.
3. ✅ Messenger wiring — **built** (2026-08-19): the pure AEGIS modules are vendored
   into Reema's `public/aegis/` (hash-pinned by `tools/vendor-aegis.mjs`, `--check`
   in `npm test`), and `public/messenger.html` now runs the pre-send gate
   (`shouldShare`, advisory block + "Send anyway"), inbound flags (`analyzeMessage`,
   client-side only), and DID-signed prebunk rebuttals (a `KeyBinding` credential + a
   signed `PrebunkRebuttal` payload the recipient verifies in place, tamper fail-closed).
   Proven by `src/verdad-interop.js` (Node interop + fuzz) and `src/messenger-verdad.js`
   (headless two-context E2E through the real relay).
4. ✅ Competency hook — **built** (2026-08-19): the messenger vendors the spine's recorder
   (`attempts.js` / `attemptlog.js` / `confidence.js`) and, when the pre-send gate blocks a
   near-share, writes ONE `skill.sift.stop` attempt (`correct: false`, `context: 'messenger'`)
   into the same append-only local log AEGIS uses. Device-local only, per D1. Proven by
   `src/messenger-verdad.js` (exactly one attempt, right skill id, right context) and the
   AEGIS spine's ground-truth suites (2,740/2,740).
5. Hardening from the existing roadmaps (mixing, C2PA, OSINT honesty) — deferred, only
   if the messenger surfaces those tools.

## Reading the messenger's log from the dashboard (shared origin)

AEGIS's calibration + mastery panels read `sovereign-aegis-attempts` through the one
`AttemptLog.readAll()` path, recomputed on every Overview entry. The messenger writes to
that same IndexedDB name and schema (the recorder is vendored verbatim), so the two
half-logics are already one. The only thing that ever stood between them was **origin**:
IndexedDB is origin-scoped, and AEGIS (`serve.js:8000`) and the messenger
(`tools/serve.mjs:8000`) were two origins.

Resolved 2026-08-19 by mounting the dashboard *inside* the messenger origin:
`tools/serve.mjs` serves `AEGIS_ROOT` at `/dashboard/` (env `AEGIS_ROOT`, defaulting to
the sovereign-aegis directory; the mount is omitted when the directory is absent). One
origin → one `sovereign-aegis-attempts` store → a messenger near-share moves the
dashboard's stop-skill mastery with no export/import step. Two details that make the
mount actually work: `/dashboard` redirects (308) to `/dashboard/` so the dashboard's
relative `css/`·`js/`·`data/` URLs resolve against the mount, and `AEGIS_ROOT` is
`path.resolve`d so the containment guard compares like separators on Windows.

**What moves and what does not (honest split):** a near-share records `confidence: null`
(no self-rated certainty exists for an intercepted share), so it moves the **mastery**
curve (`skill.sift.stop` — proven: one miss drops the hero number 50% → 33%) but is
correctly invisible to **calibration**, which requires confidence-rated answers to draw
its reliability curve. Both panels read the same log; they answer different questions.

**Proof:** `src/messenger-verdad.js` now opens `/dashboard/` in the *same* browser
context that wrote the near-share and asserts the mastery panel shows
`MESSENGER NEAR-SHARES CAUGHT BY THE GATE: 1` and the stop-skill hero below the 50%
prior — the end-to-end demonstration that the messenger's misses visibly move AEGIS.

