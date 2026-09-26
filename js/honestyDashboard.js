/**
 * SOVEREIGN // AEGIS — in-app honesty panel (About dialog).
 *
 * WHY A MODULE, NOT A FETCH
 * -------------------------
 * docs/HONESTY-DASHBOARD.md is the operator-facing map of where every displayed
 * value comes from. The About modal (#modal-honesty-about) renders the same map
 * inside the app so the claim "nothing here is simulated" is itself inspectable
 * without leaving the app. The content ships as the structured arrays below and
 * is boot-painted into #honesty-about-body by app.js — deliberately NOT fetched
 * from the .md at runtime, because the single-file standalone build only shims
 * data/ fetches, and a panel about honesty must not be the one surface that
 * silently fails there.
 *
 * HONESTY RULES FOR THIS PANEL ITSELF
 * -----------------------------------
 * 1. It repeats NO volatile figures. Dataset counts belong to the badges that
 *    derive them; hardcoding "55 dossiers" here would create exactly the kind
 *    of stale copy this whole program exists to remove.
 * 2. It quotes placeholder strings (UNMEASURED, NOT CHECKED, MEASURING…) only
 *    as the names of real shipped states — never as illustrative sample values.
 * 3. Every string passes through esc() at render time, same as every other
 *    module (see js/security.js).
 * 4. Pinned by tests/test-dead-controls.js ("Honest chrome IV"), which also
 *    keeps this panel and docs/HONESTY-DASHBOARD.md in sync.
 */

import { esc } from './security.js';

// Section titles mirror docs/HONESTY-DASHBOARD.md headings verbatim; the pin
// test asserts both files carry them, so the panel cannot silently drift from
// the document it mirrors.
const SEC_TOPBAR = 'Topbar & telemetry ribbon';
const SEC_NAV = 'Nav rail';
const SEC_HEADERS = 'View headers & cards';
const SEC_BODIES = 'Module view bodies';
const SEC_REMOVED = 'Removed entirely';
const SEC_HOOKS = 'Verification hooks';

const TOPBAR_ROWS = [
  { k: 'UTC clock', v: 'The real system clock, ticked every second.' },
  { k: 'SENTINEL pill', v: "_computeSentinelPosture(): ARMED only when a real identity exists, a vault/session key is live, and the AttemptLog is writable; otherwise UNPROVEN, with the reasons in the tooltip." },
  { k: 'ACTIVE DID', v: "identity.did — the real keypair generated at boot (or by the operator); 'DID: — (NONE YET)' when no identity exists. No fake-looking placeholder." },
  { k: 'IMMUNITY INDEX', v: 'competency.estimateAggregate() over the raw attempt log (attempted skills only, decay-weighted); UNMEASURED before any attempts.' },
  { k: 'ACTIVE AP', v: "The running InfoWar campaign's real AP budget via telemetry.activeAp; 'AP: — (NO CAMPAIGN)' otherwise, and nulled when the campaign unmounts." },
  { k: 'STORAGE', v: "_renderStorageFootprint() measures the real localStorage footprint (JSON-serialized size × 2 bytes), boot-painted and re-measured on every heartbeat tick; 'MEASURING…' until sampled." },
  { k: 'LATENCY', v: "Measured localStorage write+read round-trip (aegis-latency-probe, performance.now()); 'MEASURING…' until the first sample. A local device metric — no network." },
  { k: 'THREAT pill', v: "Derived from the last operator-submitted VERDAD audit only; 'THREAT: UNAUDITED' until a real audit completes." },
  { k: 'PRACTICE EPOCH', v: "practiceDaySpan() over the attempt log → 'D+<days>'; before any history it shows the labeled SESSION age so it cannot masquerade as an epoch." }
];

const NAV_ROWS = [
  { k: 'N COURSES', v: 'data/masterclass.json length, rendered by the cognitive module.' },
  { k: 'N SCEN · M AP MAX', v: 'data/scenarios.json — campaign count plus the ruleset maximum apPerTurn.' },
  { k: 'N SITES', v: 'The pivot toolkit templates shipped in js/modules/osint.js — no live lookup is ever implied.' },
  { k: 'N DOM · M INC', v: 'data/early_warning.json — monitored domains and incidents.' },
  { k: 'N DOSSIERS', v: 'data/sources.json length — the current count is exactly what the DOSSIERS badge shows.' },
  { k: 'N ITEMS / ⚠ BACKUP', v: 'data/profile-items.json length, or the backup-clock verdict.' },
  { k: 'Any dataset failure', v: "The badge renders '<LABEL>: N/A' with an explanatory tooltip — never a stale or invented number." }
];

const HEADER_ROWS = [
  { k: 'Cognitive header', v: "'N MASTERCLASSES • N FALLACIES' derived from the loaded curriculum and fallacy datasets at runtime — never inflated count copy." },
  { k: 'Source Directory header', v: "'N SOURCE DOSSIERS' derived from data/sources.json." },
  { k: 'OSINT headers', v: 'No count claims at all: the toolkit ships what it ships, and the nav badge derives its count from the shipped templates.' },
  { k: 'View 08 dataset badge', v: "DATASET: N DOMAINS / M INCIDENTS from early_warning.json — the radar claims only what the dataset contains; 'DATASET: UNAVAILABLE' on load failure." },
  { k: 'Training-game HUDs', v: 'Declared game-fiction surfaces (InfoWar campaign, Sift Labs cases, Narrative personas) show real game state from their fixtures — fiction stays inside the declared game.' }
];

const BODY_ROWS = [
  { k: 'VERDAD audit result', v: 'A pure rule-engine pass over the claim the operator actually submitted.' },
  { k: 'OSINT pivot grid', v: "An honest pivot plan: platform URL templates with 'NOT CHECKED' badges and a 'NO LIVE SCAN PERFORMED' brief — this offline build never fabricates recon results." },
  { k: 'OSINT cases & timeline', v: 'Labeled training fixtures (osint_cases.json) — declared game fiction.' },
  { k: 'THREAT RADAR BLIPS', v: 'Plotted from each domain radarAngle / radarDistance / threatLevel in early_warning.json; hover shows that domain real facts.' },
  { k: 'Incident dossier + checklist', v: 'The selected domain real first incident and its real DISARM playbook actions; the button acknowledges, never claims off-device execution.' },
  { k: 'SOURCE REPUTATION TABLE', v: 'data/sources.json only; missing ratings render UNRATED / UNRECORDED — no invented defaults.' },
  { k: 'Calibration diagram', v: 'Drawn from the real attempt log; refuses to draw under the minimum rated sample and says why.' },
  { k: 'DID export modal', v: 'Built from the live identity at open time; says No identity found otherwise.' }
];

const REMOVED_NOTE =
  'Some early chrome was theatrical rather than truthful: seeded attestation / consensus / alert blocks, fictional telemetry (block height, sync status, node counts, uptime), heartbeat jitter against imaginary peers, a fabricated storage footprint, a fake-looking DID placeholder, fabricated recon results, invented time estimates, and inflated "N+" count claims. ' +
  'All were removed outright — a replacement value exists only where something real can be measured or derived. The boot migration (state step 3.45) also purges these keys from profiles persisted before the purge.';

const HOOKS = [
  'tests/test-dead-controls.js pins this whole map: seed absence, derivation structure, placeholder strings, and that every string this panel calls removed is really gone from the app.',
  'tests/test-attemptlog.js pins the calibration diagram honesty and the SVG validity fix.',
  'tests/test-e2e.js (including tier 4) proves the live browser: the dataset badge reports real counts, the pivot plan never claims results, and the DID shown is a real did:key.',
  'Run node tests/run-all.js for the full gate and node tests/test-e2e.js for the browser suite.'
];

function renderTable(rows) {
  const body = rows
    .map((r) => `<tr><td style="font-family:var(--font-mono); font-size:0.72rem; color:var(--bronze-light); white-space:nowrap;">${esc(r.k)}</td><td>${esc(r.v)}</td></tr>`)
    .join('');
  return `<div class="table-container" style="margin-bottom: 6px;"><table class="data-table" style="font-size:0.78rem;"><thead><tr><th style="width:34%;">Surface</th><th>Real source</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

/**
 * Render the full honesty map as HTML. Pure function — app.js paints it into
 * #honesty-about-body once at boot; the modal machinery only opens the dialog.
 * @returns {string} HTML fragment (all dynamic strings escaped)
 */
export function renderHonestyDashboard() {
  return `
    <div style="border:1px solid var(--border-default); border-left:3px solid var(--bronze-bright); padding:12px 16px; margin-bottom:18px; border-radius:4px; background:var(--bg-surface-inset);">
      <div class="status-label text-bronze" style="margin-bottom:6px;">HONESTY DASHBOARD — THE STANDARD</div>
      <p style="margin:0;">Every displayed value is MEASURED from real I/O, DERIVED from real state or a shipped local dataset, or a labeled fail-loud placeholder — NOT SIMULATED to look alive. This panel is the in-app edition of <code>docs/HONESTY-DASHBOARD.md</code>, rendered from <code>js/honestyDashboard.js</code> at boot. It names where each number comes from instead of repeating volatile figures: the current values are whatever this session is actually measuring, one hover away on every surface.</p>
    </div>
    <div class="status-label text-bronze" style="margin-bottom:8px;">${esc(SEC_TOPBAR.toUpperCase())} — MEASURED OR DERIVED LIVE</div>
    ${renderTable(TOPBAR_ROWS)}
    <div class="status-label text-bronze" style="margin:16px 0 8px;">${esc(SEC_NAV.toUpperCase())} — EVERY BADGE DERIVED FROM ITS OWN DATASET AT LOAD</div>
    ${renderTable(NAV_ROWS)}
    <div class="status-label text-bronze" style="margin:16px 0 8px;">${esc(SEC_HEADERS.toUpperCase())}</div>
    ${renderTable(HEADER_ROWS)}
    <div class="status-label text-bronze" style="margin:16px 0 8px;">${esc(SEC_BODIES.toUpperCase())}</div>
    ${renderTable(BODY_ROWS)}
    <div class="status-label text-bronze" style="margin:16px 0 8px;">${esc(SEC_REMOVED.toUpperCase())} — NO REPLACEMENT EXISTS</div>
    <p class="body-muted" style="font-size:0.8rem; line-height:1.55; margin:0;">${esc(REMOVED_NOTE)}</p>
    <div class="status-label text-bronze" style="margin:16px 0 8px;">${esc(SEC_HOOKS.toUpperCase())}</div>
    <ul style="margin:0; padding-left:20px; font-size:0.8rem; line-height:1.55;">
      ${HOOKS.map((h) => `<li style="margin-bottom:6px;">${esc(h)}</li>`).join('')}
    </ul>
  `;
}

export default { renderHonestyDashboard };
