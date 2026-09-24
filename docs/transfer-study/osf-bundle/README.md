# OSF Preregistration Bundle — SOVEREIGN // AEGIS Phase 4 Transfer Study

Assembled by `tools/transfer-study/osf-bundle.mjs` from the frozen study kit.

## Upload order on OSF
1. Create a new ** preregistration** draft (OSF Registries → New Registration) and pick
   "Preregistration Template" or "Standard Pre-Data Collection Registration".
2. Upload the protocol (`transfer-study-preregistration.md`) as the main document.
3. Upload `forms/`, `review/`, `analysis/`, and `power-simulation.json` as
   supplementary files, exactly as hashed in `MANIFEST.sha256`.
4. Complete the review workflow (`review/review-instructions.md`) BEFORE submitting —
   a completed, hashed worksheet is a protocol precondition; if any item was revised,
   rebuild forms and re-assemble this bundle rather than submitting stale hashes.
5. Submit and record the resulting OSF DOI in `SESSION-HANDOFF.md`.

## What a reviewer can verify offline
- Form integrity: `sha256sum -c MANIFEST.sha256` reproduces every file's hash.
- The primary estimand and CI procedure: read `analysis/analyze.mjs` (frozen; the
  bootstrap seed and replicate count are constants in the file header).
- The machinery works: `node analysis/analyze.mjs --selftest` plants a synthetic +15 pp
  effect and verifies recovery (needs only Node ≥18; no network).
- The enrollment target is adequate: see `power-simulation.json` verdict.

## Integrity
`MANIFEST.sha256` covers every file in this bundle. Regenerating the bundle after any
content change produces different hashes — that is the point. The bundle as uploaded to
OSF is the freeze; this local copy is its working mirror.
