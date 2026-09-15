# Design — Zero-Click Capture Surfaces (VERDAD)

**Status:** built and verified.
**Purpose:** shrink the distance between encountering a claim and having it in the
analyzer — the "intercept at the moment of encounter" promise of Pillar II. These surfaces
serve *protection*, not *training*: they make VERDAD easier to reach, and deliberately do
not touch the competency spine.

---

## What shipped

Three in-app surfaces, no extension and no service worker:

1. **Clipboard** — a "📋 Analyze Clipboard" button in the VERDAD panel and the topbar, plus
   a global paste-to-verify offer. Both route text through the single `_routeToVerdad()`
   path in `js/app.js`.
2. **`?verify=` deep link + bookmarklet** — `js/ingest.js` parses a `verify` query
   parameter (plain URL-encoded, or `b64:`-prefixed base64url) and routes it to VERDAD on
   boot. A bookmarklet affordance in VERDAD builds a `javascript:` snippet for the current
   app URL.
3. **Import dropzone** — the global sentinel dropzone now routes media files (image /
   audio / video) to the Media Forensics analyzer and text files to VERDAD. VERDAD gained
   a visible capture card so the drop-anywhere path is discoverable.

## The load-bearing decisions

- **One routing path.** Drag-drop, deep link, clipboard button, and paste detection all call
  `_routeToVerdad()`. The old drop handler called a nonexistent `runAnalysis()` on the wrong
  element id (`input-verdad-claim` vs `textarea-verdad-claim`), so dropping text silently
  failed; centralising the path fixed that latent bug as part of this work.
- **`b64:` is base64url, not standard base64.** `+` and `/` are URL-unsafe and `+` is
  decoded to a space by `URLSearchParams` before the decoder runs, so the plain-base64 form
  cannot survive transport. The decoder translates `-`/`_` and restores padding. Malformed
  input is `null`, never a guess.
- **No passive clipboard watching.** No browser exposes a clipboard-change event; the
  Clipboard API is read-on-demand and requires a user gesture + permission. The clipboard
  surface is therefore on-demand read with a "press Ctrl+V" degradation, and paste
  detection (a global `paste` listener that offers, never auto-runs, and ignores pastes
  into any input/textarea). This is the honest ceiling for a static page.
- **Images go to Media Forensics, not VERDAD.** VERDAD is text-only. The `?verify=` value
  and the clipboard text are written into the claim textarea via `.value`, never
  `innerHTML`, so a hostile deep link is inert text; the analysis output was already
  `esc()`-encoded.
- **The bookmarklet is copyable text, never executed here.** It runs in the *source* page's
  context, outside this app's CSP, and is surfaced in a read-only input plus a copy button.

## Honest limits (stated, not discovered)

- `?verify=` and the bookmarklet work on the HTTP-served app (`serve.js`) and any HTTPS
  deployment. The single-file `file://` standalone build can still follow a `?verify=` link
  only if the browser allows a query on a file URL — not guaranteed.
- Clipboard read requires a secure context and the `clipboard-read` permission; where
  blocked, the UI tells the operator to paste.

## Verification

- `tests/test-ingest.js` — 20 assertions: plain/b64 parsing, malformed and oversized input,
  hostile markup staying inert text, bookmarklet shape. Registered in `tests/run-all.js`.
- `node tests/run-all.js` — 2,701/2,701 across 11 core suites.
- `node tests/test-challenger-m1.js` — 294/294 (HTML/CSS/DOM structure).
- `node tests/test-e2e.js` — 116/116 in a real headless Chromium (boot path incl. the new
  paste binding and deep-link hook).
