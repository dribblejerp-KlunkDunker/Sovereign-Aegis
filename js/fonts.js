/**
 * SOVEREIGN // AEGIS — Non-blocking webfont activation
 *
 * The webfont stylesheet is declared in index.html with media="print" so it is never
 * render-blocking. A render-blocking stylesheet from a third-party CDN also blocks
 * script execution, which previously meant that a hanging fonts.googleapis.com left
 * the shell fully rendered and every control inert — the app looked fine and did
 * nothing. For a tool that is expected to work on censored, air-gapped and
 * proxy-restricted networks, that failure mode was unacceptable.
 *
 * This module promotes the sheet to media="all" once it has actually loaded. If it
 * never loads, css/typography.css's local fallback stack carries the design and the
 * application remains fully operational.
 *
 * Kept as a separate module (rather than an inline onload attribute) so the strict
 * Content-Security-Policy in index.html can forbid inline script entirely.
 *
 * @module fonts
 */

const link = document.getElementById('aegis-webfonts');

if (link) {
  const activate = () => {
    link.media = 'all';
    link.removeEventListener('load', activate);
  };

  // Already resolved by the time this deferred module ran.
  if (link.sheet) {
    activate();
  } else {
    link.addEventListener('load', activate, { once: true });
    link.addEventListener('error', () => {
      // Leave media="print" in place: the local fallback stack is authoritative.
      console.info('[Aegis] Webfonts unavailable — using local typography fallback stack.');
    }, { once: true });
  }
}
