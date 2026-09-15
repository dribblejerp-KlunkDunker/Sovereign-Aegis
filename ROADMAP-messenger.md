# Roadmap — Secure Messenger with Epistemic Defense

**Written:** 2026-08-19. Supersedes the feature-level ordering for the messenger effort;
the standalone AEGIS roadmap (`ROADMAP.md`, `ROADMAP-EVIDENCE.md`) remains the authority
for AEGIS-in-isolation phases.

**Foundations (read before this):**
- `DESIGN-product-decision.md` — what syncs, what never does; decision **D1** open.
- `DESIGN-aegis-reema-seam.md` — the boundary, identity reconciliation, VERDAD contract.

---

## Ordering principle

Order by what *everything else depends on*, then by what is *irreversible if delayed*,
then by felt value. Testing is not a final phase — every item ships with its proof, or it
does not ship.

---

## Phase 0 — Decide the premise (now)

Close decision **D1** (attempt-log sync: never vs E2EE-later) in
`DESIGN-product-decision.md`. Everything technical can proceed either way; this gates
what we design for, not what we build first.

**Deliverable:** D1 resolved and recorded. **Proof:** the decision doc is the proof.

---

## Phase 1 — VERDAD as a service *(first code; blocks the entire product)*

`js/verdad-service.js` exposing `analyzeMessage` / `shouldShare` / `classify`, plus
`tests/test-verdad-service.js` registered in `tests/run-all.js`.

**Why first:** every messenger feature — pre-send gate, inbound flags, rebuttals, the
competency hook — calls this one function. Until it exists with a stable contract, all
of it is speculative.

**Proof:**
- unit tests: classifier thresholds, offline default, no-DOM (imports in Node);
- property tests: for a corpus of hostile vs neutral claims, `shouldShare` never flips
  from a `veracityScore` the LLM can inflate (recommendation keys off `manipulationRisk`
  only);
- the existing 55-assertion `test-verdad.js` stays green (the engine is not re-inlined).

**Done when:** `analyzeMessage`/`shouldShare` are importable from a Node context with zero
DOM, and the thresholds are test-covered.

---

## Phase 2 — Identity reconciliation (binding credential)

Add `bindToReema(address, signPk)` → signed `KeyBinding` credential, and a verifier, on
AEGIS's existing `crypto.js`/`identity.js` primitives. No change to Reema's core.

**Why second:** trust in the messenger requires "this DID is this routing address" to be
checkable; VERDAD needs nothing from it, but rebuttals and reputation do.

**Proof:**
- unit: signature verifies; tampering the address/signPk fails;
- interop: a credential signed by the AEGIS Node identity verifies in the browser and
  vice versa;
- a hostile credential (attacker-signed binding to the victim's address) is rejected.

---

## Phase 3 — Messenger wiring (the product appears)

Import `verdad-service` into Reema's `public/messenger.html`:

1. **Pre-send gate** — `shouldShare(draft)` before send; `block` shows the reason and
   asks for confirmation, never silently refuses (advisory, matching the Phase-3 locks
   philosophy in `ROADMAP.md`).
2. **Inbound flags** — `analyzeMessage(inbound)` renders risk + fallacies beside the
   message; the relay never sees this, it is all client-side.
3. **Signed rebuttal** — the prebunk summary becomes a DID-signed message payload the
   recipient verifies in-place.

**Proof (this is where "survive and flourish" is earned):**
- **E2E** — two contexts exchange: a flagged claim triggers the pre-send gate; a rebuttal
  arrives signed and verifies; a tampered rebuttal fails verification.
- **Security** — XSS regression on VERDAD output rendered in the *messenger* context
  (not just AEGIS): hostile model response cannot inject markup; key hygiene (nothing in
  `localStorage`/`window`).
- **Fuzz** — hostile/malformed claims through `shouldShare` do not crash the gate.
- **Interop** — Node AEGIS service and browser messenger agree on one verdict for the
  same input.

---

## Phase 4 — Make the messenger also train

**Status:** built 2026-08-19.

Wire the competency spine into the messenger locally: a near-share of a flagged claim
records an attempt (`context: 'messenger'`), feeding mastery/calibration. **Local only**
per the product decision.

**What shipped, precisely:** when the pre-send gate blocks a draft (a near-share), the
messenger writes exactly one attempt — `skill.sift.stop`, `correct: false`, `context:
'messenger'` — into the same append-only log (`sovereign-aegis-attempts`) the AEGIS spine
uses, via the vendored `attempts.js`/`attemptlog.js`/`confidence.js`. An inbound flagged
claim alone does **not** record (receiving content is not a right/wrong moment);
propagating it funnels through the same send gate and records as a near-share.

**Proof:** the spine's existing ground-truth tests (simulated learner — `test-attemptlog.js`,
`test-competency.js`) plus a browser assertion in `src/messenger-verdad.js` that a
near-share wrote exactly one attempt with the right skill ids, while an un-gated message
wrote none.

**Read back by the dashboard (2026-08-19):** `tools/serve.mjs` mounts AEGIS at
`/dashboard/` on the messenger's own origin, so the two apps share
`sovereign-aegis-attempts` and no export/import is needed. The E2E now opens `/dashboard/`
in the same context that wrote the near-share and asserts the stop-skill mastery hero
moves below the 50% prior and the panel shows the near-share count. A near-share carries
`confidence: null`, so it moves **mastery**, not the calibration curve (which requires
confidence-rated answers) — the honest split stated in `DESIGN-aegis-reema-seam.md`.

---

## Phase 5 — Harden and close the honest gaps (only what the messenger surfaces)

- ✅ Reema relay mixing — **built 2026-08-19** (Reema `src/server.js`): a rolling
  `MIX_WINDOW_MS` batch window (crypto-shuffled order, `MIX_OFF`/`MIX_WINDOW_MS=0`
  opt-out), proven by Reema `src/mix-regression.js` (immediate `sent` ack, no delivery
  before the window closes, two messages → two members as one tick, immediate when off).
  Defense-in-depth for metadata — not a mixnet.
- Relabel OSINT / video / narrative simulations as methodology walkthroughs if they
  appear in the messenger, or leave them out entirely.
- C2PA verification only if media messages ship.

**Explicitly out of v1:** a mixnet/Tor-for-everyone claim, real C2PA crypto, and any
server-side analysis. Each is a product claim we are not yet able to make honestly.

---

## Testing strategy — "survive and flourish"

Four layers, all in CI (`npm test` on both trees), none advisory:

| Layer | What it proves | Where |
|---|---|---|
| Unit | every pure function has ground truth | `test-verdad-service`, `test-competency`, Reema `test.js` |
| Property/fuzz | hostile input cannot flip a verdict or crash a gate | Reema `fuzz.js` + new `shouldShare` corpus |
| Interop | AEGIS (Node/browser) and Reema (Node/browser) share one wire + one verdict | cross-import + two-context browser E2E |
| Security/E2E | the real user path with a hostile model + hostile peer | `browser-e2e.js`, `xss-regression.js`, `messenger-smoke.js` |

The standing rule from AEGIS's audit carries over verbatim: **no `assert(true)`, no
silent browser-skip, no inline copy of the class under test, and a headline assertion
count that separates data validation from behavioural coverage.**
