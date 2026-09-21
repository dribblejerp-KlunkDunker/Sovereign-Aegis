# SOVEREIGN // AEGIS — MISP-Compatible DISARM Case-Pack Profile

**Version:** 1.0 · **Prepared:** 2026-08-21 · **Status:** export specification, not yet an implementation

This document defines how a future AEGIS export should carry an InfoWar after-action review or another explicitly DISARM-tagged analysis into MISP without pretending that a training simulation is a real-world incident. It uses the MISP core JSON event shape and MISP machine tags; it does not require a custom MISP server plugin for the portable profile.

The authoritative interoperability references are the [MISP core format](https://www.misp-standard.org/rfc/misp-standard-core.html), [MISP data models](https://www.misp-project.org/datamodels/), [MISP galaxy format](https://www.misp-standard.org/rfc/misp-standard-galaxy-format.html), and the [MISP automation guide](https://www.circl.lu/doc/misp/automation/).

---

## 1. File profile and compatibility promise

- **Filename:** `<case-id>.misp.json`.
- **MIME type:** `application/json`.
- **Root:** exactly one object with an `Event` member, suitable for import through a MISP event import or `POST /events` endpoint.
- **Core profile:** uses ordinary `Event`, `Attribute`, and `Tag` members only. It should import as an unpublished event on a current MISP instance without a custom object template.
- **Extended profile:** MAY add a native `Galaxy`/`GalaxyCluster` representation after resolving the installed MISP galaxy's current UUID, type, and tag name. Never guess or synthesize a canonical galaxy UUID; DISARM versions and local galaxy installations can change.
- **Encoding:** UTF-8 JSON, no comments, no executable attachments, and no HTML in values.
- **Lifecycle:** every new case pack receives a UUIDv4. An update to the same case preserves the event UUID; `timestamp` changes. The MISP instance assigns its local numeric `id` and `event_id` on import.

The portable profile deliberately carries both (a) a stable AEGIS tag and (b), when verified against the receiving instance, a native MISP galaxy tag. The stable tag prevents a failed galaxy lookup from silently dropping the DISARM classification.

## 2. Privacy and truth boundary

Export is an explicit operator action. The default case pack MUST NOT contain:

- attempt-log rows, confidence ratings, latency, chosen distractors, mastery, calibration, ELO, or DID material;
- a person's name, email, IP address, device fingerprint, private key, raw media, or dossier text;
- a claim that a simulated adversary, campaign, or countermeasure occurred in the real world;
- `to_ids: true` for narrative, training, or unverified observations.

The case pack SHOULD contain only the de-identified analytic result: the campaign identifier, AAR outcome, DISARM codes selected by the operator, stage-matched Blue C-codes, measured game metrics, source references, and a clear `training-simulation` label. An organization may add real evidence later in MISP under its own collection and handling rules; AEGIS must not infer it.

Default distribution is `"0"` (your organization only) or the receiving operator's explicitly selected policy. AEGIS MUST NOT default to public sharing merely because the data is synthetically generated.

## 3. Event envelope

The exporter creates this minimum MISP event:

| Field | Required value / rule |
|---|---|
| `uuid` | Stable UUIDv4 for this case pack; preserve on updates. |
| `info` | Single-line summary, ≤256 characters; begin with `AEGIS training simulation —`. |
| `date` | UTC calendar date of the simulated operation or AAR completion, documented in the case metadata. |
| `timestamp` | UTC Unix seconds when this export was generated. |
| `published` | `false` on first export. Publication is a MISP operator decision. |
| `analysis` | `"2"` because the AAR is complete; use `"1"` only for an explicitly incomplete draft. |
| `threat_level_id` | `"4"` (undefined) by default. A game grade MUST NOT be converted into a real-world threat level. |
| `distribution` | `"0"` by default; operator may choose a less restrictive MISP policy. |
| `sharing_group_id` | `"0"` unless distribution is `"4"` and a local sharing group is selected. |
| `Attribute` | One or more import-safe narrative, code, and reference attributes. |
| `Tag` | At least the case-type tag and one stable DISARM tag for every selected Red/Blue code. |

`id`, `org_id`, `orgc_id`, `attribute_count`, and local numeric fields are omitted from the create payload unless a MISP instance supplies them. A MISP server is responsible for local organization identity and counts.

## 4. Tag vocabulary

The following AEGIS tags are portable application tags, not claims that AEGIS owns the DISARM taxonomy:

- `aegis:case-type="training-simulation"`
- `aegis:source="sovereign-aegis"`
- `aegis:disarm:red="T0002"` for an operator-selected Red technique
- `aegis:disarm:blue="C00125"` for an operator-selected Blue countermeasure
- `aegis:disarm:tactic="TA02"` for the linked Blue/Red tactic stage
- `aegis:confidence="operator-selected"` MUST NOT be emitted; confidence is intentionally not exported in the default profile.

When and only when the receiving MISP installation's current galaxy catalog confirms the canonical tag name and cluster UUID, the exporter SHOULD additionally attach the native tag for the Red technique, for example:

```text
misp-galaxy:disarm-attack-pattern="T0002"
```

The exact native tag string is a deployment lookup, not a hard-coded promise. If it cannot be resolved, retain `aegis:disarm:red="T0002"` and add an explanatory source link. The same rule applies to detection, tactic, or Blue clusters. This avoids producing a plausible-looking tag that MISP renders as an unrelated or unknown cluster.

## 5. Attribute mapping

All attributes in the portable profile use `to_ids: false`, `distribution: "5"` (inherit event), and a stable UUIDv4. Use MISP's ordinary category/type/value triplet:

| AEGIS data | MISP attribute | Value rule |
|---|---|---|
| Case summary / AAR narrative | `category: "External analysis"`, `type: "text"` | Prefix with `TRAINING SIMULATION —`; include outcome and limitation. |
| Campaign name | `category: "Attribution"`, `type: "campaign-name"` | Synthetic campaign name only; never imply real attribution. |
| Red T-code | `category: "External analysis"`, `type: "text"` | `DISARM Red T0002 — <canonical title>`; code remains in a tag too. |
| Blue C-code | `category: "External analysis"`, `type: "text"` | `DISARM Blue C00125 — <canonical name>`; preserve `notRecommended` as text when present. |
| Tactic stage | `category: "External analysis"`, `type: "text"` | `DISARM stage TA02 — <stage name>`. |
| Source or framework reference | `category: "External analysis"`, `type: "link"` | HTTPS URL in `value`; set `comment` to its role. |
| AAR metric | `category: "External analysis"`, `type: "text"` | Human-readable metric string; do not map grade to threat level. |

A source link is not evidence that a case's narrative is true. It identifies the framework or methodology used.

## 6. Recommended JSON example

This is an import-safe **shape example**, not a real incident and not a canonical DISARM galaxy export. UUIDs and timestamps are illustrative and must be generated by the exporter.

```json
{
  "Event": {
    "uuid": "7b5d1c2e-8ad5-4d34-9b8f-7c1e2a9d4f60",
    "date": "2026-08-21",
    "info": "AEGIS training simulation — InfoWar AAR: campaign-alpha-apt",
    "published": false,
    "analysis": "2",
    "threat_level_id": "4",
    "distribution": "0",
    "sharing_group_id": "0",
    "Tag": [
      { "name": "aegis:case-type=\"training-simulation\"" },
      { "name": "aegis:source=\"sovereign-aegis\"" },
      { "name": "aegis:disarm:red=\"T0002\"" },
      { "name": "aegis:disarm:blue=\"C00125\"" },
      { "name": "aegis:disarm:tactic=\"TA02\"" }
    ],
    "Attribute": [
      {
        "uuid": "b2f5e5bd-7c9e-4a35-a2a1-8f4c1c89e2c1",
        "category": "External analysis",
        "type": "text",
        "value": "TRAINING SIMULATION — Outcome: defeat; containment grade D (31%). This record describes a game AAR, not an observed real-world influence operation.",
        "comment": "AEGIS AAR summary; not an incident assertion",
        "to_ids": false,
        "distribution": "5"
      },
      {
        "uuid": "1b4ca6f2-3f07-4fe3-99c8-2cc0a0a6f6d1",
        "category": "External analysis",
        "type": "text",
        "value": "DISARM Red T0002 — Establish Strategic Influence Objectives; DISARM Blue C00125 — Prebunking; stage TA02 Plan Objectives.",
        "comment": "Operator-selected classification; verify against the current DISARM/MISP catalog",
        "to_ids": false,
        "distribution": "5"
      },
      {
        "uuid": "f0d79f4f-c5e4-47f5-88e1-3e5e2b7b1aa2",
        "category": "External analysis",
        "type": "link",
        "value": "https://github.com/DISARMFoundation/DISARMframeworks/blob/main/generated_pages/disarm_blue_framework.md",
        "comment": "DISARM Blue framework source",
        "to_ids": false,
        "distribution": "5"
      }
    ]
  }
}
```

## 7. Optional structured extension

If a target MISP has an approved custom object template, an extended export MAY add an `Object` named `aegis-case-analysis` containing structured fields such as `campaign-id`, `outcome`, `containment-score`, `health`, `panic`, `turns`, `red-technique`, `blue-countermeasure`, and `source-url`. The portable exporter MUST still include the summary and tags as ordinary attributes, because a custom object template is not guaranteed to exist on the receiving instance.

Do not put arbitrary `aegis-*` objects into the core profile and call them MISP-native. Either register and version the object template, or use the import-safe attributes above.

## 8. Validation and import behavior

Before download, the exporter should:

1. Validate JSON syntax and the MISP `Event` wrapper.
2. Require `info`, `date`, `published`, `analysis`, `threat_level_id`, `distribution`, `sharing_group_id`, `Attribute`, and `Tag`.
3. Validate every attribute's category/type combination against the target MISP version; `External analysis` + `text`/`link` is the safe narrative/reference pair.
4. Ensure every DISARM code matches `T` + four digits or `C` + five digits and exists in the pinned data snapshot used for the analysis.
5. Ensure every `aegis:disarm:blue` tag has a source snapshot and preserve the framework's `notRecommended` marker in the attribute text.
6. Reject control characters, HTML, script URLs, private data, and attachments in the default profile.
7. Display the selected distribution policy and a privacy checklist immediately before download.

On import, the receiving analyst should keep the event unpublished until they have reviewed the training-simulation label, taxonomy version, source links, and sharing policy. A successful JSON import proves format compatibility, not analytic validity.

## 9. Versioning and provenance

The export should include its own metadata in a non-sensitive `External analysis` text attribute:

```text
AEGIS export profile: 1.0; app build: <immutable build identifier>; DISARM snapshot: <source URL or commit>; generated: <UTC ISO 8601>; simulation: true
```

The framework source snapshot, not the app's local display title, is authoritative for code names. If a future DISARM release changes a code or stage, export both the code and the snapshot reference; do not silently rewrite historical packs. Keep the local `data/disarm.json` adaptation and canonical DISARM identifiers visibly distinct.

## 10. Sources and non-goals

- [MISP core format](https://www.misp-standard.org/rfc/misp-standard-core.html) — Event and Attribute requirements, distribution values, UUID preservation, and category/type/value semantics.
- [MISP galaxy format](https://www.misp-standard.org/rfc/misp-standard-galaxy-format.html) — galaxy/cluster structure and UUID/version rules.
- [MISP Galaxy user guide](https://www.circl.lu/doc/misp/galaxy/) — attaching galaxy clusters and the need for matching galaxy/cluster metadata.
- [DISARM Foundation frameworks](https://github.com/DISARMFoundation/DISARMframeworks) — Red/Blue purpose, source data, and caution that Blue workshop outputs contain countermeasures requiring ethical and contextual judgment.
- [MISP DISARM detections](https://misp-galaxy.org/disarm-detections/) — an example of DISARM clusters and external IDs in the MISP ecosystem.

This profile does not export the private attempt log, create an automated threat feed, make `to_ids` indicators from narrative text, or assert that an AEGIS game result is an observed campaign. Those are separate decisions requiring separate review.
