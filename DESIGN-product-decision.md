# Product Decision — "Secure Messenger with Epistemic Defense"

**Status:** decided (2026-08-19). D1 resolved to Option A — see below.

The premise change. SOVEREIGN // AEGIS is local-first, no-backend, by design.
A messenger is not: it needs a relay, peer identities, and some metadata (who talks to
whom, when). That is not a contradiction *if* the boundary is drawn deliberately.
`ROADMAP.md` §6 already flags the exact risk: *"whether 'cognitive sovereignty'
survives contact with any sync feature."* This document draws the boundary so it does.

---

## The product

A post-quantum E2EE messenger (transport: **BlackVault-Reema**, already built) whose
client carries the epistemic-defense brain (**SOVEREIGN // AEGIS**):

- **before you share** — a claim is analyzed and you get a `share / caution / block`
  signal, not after you have already spread it;
- **before you react** — an inbound message is flagged with its manipulation risk and
  the fallacies detected in it;
- **when you rebut** — the counter-narrative is a DID-signed payload the recipient can
  cryptographically verify, not a text blob.

## What syncs, what never leaves the device

| Data | Where it lives | Synced? | Why |
|---|---|---|---|
| Message ciphertext + routing addresses | Reema relay | ✅ (opaque to relay) | the product cannot exist otherwise |
| DID **public** key + signed credentials | published in messages | ✅ (public by nature) | verification requires it |
| Prebunk / rebuttal cards | message payloads | ✅ (signed) | collective defense is the point |
| Attempt log, mastery, calibration | IndexedDB, device only | ❌ **never** | it is a record of exactly what someone is bad at — the most sensitive data in the app (see `DESIGN-competency-spine.md` §8) |
| Journal, dossier, BYOK keys | device only | ❌ never | source-protection-grade material |
| E2EE **private** keys | non-extractable / OS keychain | ❌ never | the whole security model |

The rule in one sentence: **content of defense can travel (signed, encrypted); the
record of weakness never does.**

## The threat model, honestly

The relay sees ciphertext, addresses, and timing — **not** plaintext, not the analysis,
not the operator's mastery. This is already Reema's model (`ROADMAP.md`: "metadata is
visible to the relay … padding hides length, not timing/volume/graph"). The messenger
does **not** add new metadata exposure beyond what peer-to-peer messaging inherently
has; the analysis runs entirely client-side.

Two honest residuals, both inherited from Reema, neither fatal:

1. **Relay metadata** — who talks to whom and when. The cheap mitigation (mix/batch
   windows) is already designed in Reema's `ROADMAP.md` §8; a real mixnet is out of
   scope for v1 and must be said so in the UI.
2. **Relay trust for delivery** — the relay can drop or delay, not forge or read. That
   is acceptable and standard for E2EE.

## The decision (resolved)

**Decision D1 — RESOLVED: Option A.** The operator's AEGIS data (attempt log, mastery,
calibration, journal, dossier) is **device-local forever**. It never syncs, in any form,
in any future version. There is no designed-in escape hatch; if multi-device ever becomes
necessary, the only acceptable answer is a separate, end-to-end-encrypted-by-the-operator
channel for *message content only* — and even that does not carry assessment data.

This keeps the "record of weakness" guarantee unconditional, which is the load-bearing
privacy claim of the whole product.

---

## Consequences that flow from this

- VERDAD is a **client-side service** (no server-side analysis, ever — a remote
  "analyze my message" call would leak the message and the operator's interests).
- The competency spine can record "you almost shared a flagged claim" as an attempt —
  locally.
- "Collective defense" = signed prebunk cards + reputation attestations traveling as
  messages, never shared raw assessment data.
