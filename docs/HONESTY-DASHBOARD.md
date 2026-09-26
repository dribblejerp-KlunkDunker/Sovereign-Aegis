# HONESTY DASHBOARD — every displayed value and its real source

**SOVEREIGN // AEGIS** · established 2026-09-26 · amended in place as surfaces change

The standard: *every displayed value is measured from real I/O, derived from real
state or a shipped local dataset, or a labeled fail-loud placeholder. Nothing is
simulated to look alive. Game fiction is allowed only inside declared game surfaces
(InfoWar campaign state, Narrative Topology personas, OSINT training-case fixtures).*

This map is pinned: `tests/test-dead-controls.js` — the "Honest chrome II/III/IV"
describes assert the purges and the derivation rules; the gate re-proves this whole
document on every run (48 suites; browser E2E 129; see the gate output for the
current assertion count — it is deliberately not hardcoded here, because a
hardcoded count would go stale the same way a fabricated value would).

**In-app edition:** the About panel (sidebar footer → "◈ About & Honesty Map",
`#modal-honesty-about`) renders this map inside the app, boot-painted from
`js/honestyDashboard.js`. The panel and this document are pinned to stay in sync
(same section titles, same placeholder strings); neither repeats volatile counts —
the live values are whatever each surface is actually measuring right now.

## Topbar & telemetry ribbon

| Surface | Source |
|---|---|
| UTC clock | Real system clock, 1 s tick |
| SENTINEL pill | `_computeSentinelPosture()`: `ARMED` only if real identity + vault/session key live + AttemptLog available; else `UNPROVEN` with reasons in the tooltip |
| ACTIVE DID | Real `identity.did` (auto-generated at boot or user-created); truncated with full DID in tooltip; `DID: — (NONE YET)` if identity creation failed or was cleared — no fake-looking placeholder |
| IMMUNITY INDEX | `competency.estimateAggregate()` over the raw attempt log (attempted skills only, decay-weighted); `UNMEASURED` before any attempts |
| ACTIVE AP | Real running campaign's `apPerTurn` via `telemetry.activeAp`; `AP: — (NO CAMPAIGN)` otherwise; nulled by `infowar.onUnmount` |
| STORAGE | Measured localStorage footprint (`_renderStorageFootprint()`, serialized size × 2 B); boot-painted, re-measured each 4 s tick; `MEASURING…` placeholder |
| LATENCY | Measured localStorage write+read round-trip (`aegis-latency-probe`, `performance.now()`); `<1ms (LOCAL)` / `Nms (LOCAL)`; `MEASURING…` before first sample |
| THREAT pill | `VerdadEngine.deriveThreat()` from the last *operator-submitted* audit only; `THREAT: UNAUDITED` until then |
| PRACTICE EPOCH | `competency.practiceDaySpan()` → `D+<days>`; `SESSION hh:mm:ss` before any history |

## Nav rail (all derived at module data-load; `app.js` boot backstop re-derives)

| Badge | Source |
|---|---|
| `N COURSES` | `data/masterclass.json` length |
| `N SCEN · M AP MAX` | `data/scenarios.json` → `infowarCampaigns` count + max `apPerTurn` |
| `N SITES` | Pivot toolkit platform templates in `js/modules/osint.js` |
| `N DOM · M INC` | `data/early_warning.json` domains + incidents |
| `N DOSSIERS` | `data/sources.json` length (55 — the old "60+" copy was wrong) |
| `N ITEMS` / `⚠ BACKUP` | `data/profile-items.json` length, or backup-clock verdict |
| All fallbacks | `<LABEL>: N/A` + explanatory tooltip on dataset load failure — never a stale number |

## View headers & cards (count-bearing copy only)

| Surface | Source |
|---|---|
| Cognitive header badge | `N MASTERCLASSES • N FALLACIES` from loaded datasets (replaced "22+" — dataset has 24) |
| Reputation header badge | `N SOURCE DOSSIERS` from `sources.json` (replaced "60+") |
| OSINT header / Sherlock title | No count claims (removed "50+ PLATFORMS / Sites" — toolkit ships 8) |
| View 08 dataset badge | `DATASET: N DOMAINS / M INCIDENTS` from `early_warning.json` (replaced "360° POLAR SWEEP ACTIVE") |
| Commons HUD | Real game state: installed packs, scenario count (`11 + 2×installed`), SM2 deck length |
| Sift Labs | 32 scenarios — real `sift_scenarios.json` length |
| Aftercare "4-7-8" | The breathing pattern's actual cadence, not a metric |

## Module view bodies

| Surface | Source |
|---|---|
| Verdad audit result | Pure rule engine over the submitted claim; bands published in code |
| OSINT pivot grid | **Honest plan**: platform URL templates with `NOT CHECKED`; "NO LIVE SCAN PERFORMED" brief. The old fabricated `FOUND`/`VERIFIED PGP` statuses, fake scan delay, "RECON COMPLETE (5 FOUND)" and "2 infrastructure ties" toast are gone |
| OSINT case fixtures / timeline | Labeled training fixtures (`osint_cases.json`) — declared game fiction |
| OSINT solar calculations | Real astronomy math (pure `dsp.js`-style computation, no data needed) |
| Threat Radar blips | Plotted from each domain's `radarAngle`/`radarDistance`/`threatLevel` in `early_warning.json`; hover shows real domain facts |
| Incident dossier + DISARM checklist | Selected domain's real first incident + its real playbook actions; "Execute" acknowledges, never claims off-device action |
| Source Reputation table | `sources.json` only; missing ratings render `UNRATED`/`UNRECORDED` (the fake-ratings fallback list and `\|\| 90` defaults are gone) |
| Calibration diagram | Real attempt log; refuses to draw under `MIN_RATED` samples, says why; SVG now valid (no `height="auto"`) |
| Node Inspector (Narrative) | In-simulation persona data; TEST-NET IPs by convention; populated per-node from the active campaign |
| Reflection inventory | `N ITEMS` = real loaded inventory (the invented "~6 MIN" is gone) |
| DID export modal | Built from the live identity at open; "No identity found" otherwise (static sample JSON removed) |

## Removed entirely (no replacement value exists)

Seed blocks: `attestation`, `consensus`, `alerts`, `identity.reputationScore`,
telemetry `activeNodes`/`blockHeight`/`syncStatus`/`threatLevel`/`sentinelMode`/
`epistemicHealth`/`uptimeSeconds`; heartbeat jitter against fictional peers
(`peer-alpha-01`, `HARDWARE_SECURE`, `24ms (EDGE)`); fake storage "48.2 KB" paint;
fake-looking DID placeholder; fake "5 FOUND"/infrastructure-ties recon results;
invented "~6 MIN" estimate; "22+/50+/60+" inflated counts. The boot migration
(state step 3.45) purges all of these from profiles persisted before the purges.

## Verification hooks

- `tests/test-dead-controls.js` — seed absence, derivation structure, placeholder
  strings, no-fictional-fallback pins, and the About-panel pins: the modal ships a
  labeled empty body (no stale copy in markup), the module is boot-painted with a
  fail-loud fallback, the panel mirrors this document's sections and placeholder
  strings, and the panel itself obeys the honesty standard (escaped output, no
  removed-fiction literals, no simulated values)
- `tests/test-attemptlog.js` — SVG validity + calibration honesty
- `tests/test-e2e.js` / tier-4 — live-browser asserts: dataset badge present and
  loaded, pivot plan honest (no `FOUND` anywhere), DID renders a real `did:key:z…`,
  the About modal opens from the sidebar footer and renders all six sections of
  this map with the fail-loud fallback never hit
- Gate: 48 suites (current totals in the latest `node tests/run-all.js` output) ·
  E2E **129/129** · boot console clean
