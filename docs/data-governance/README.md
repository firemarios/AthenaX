# POLICYLAB — Data Governance

Data licensing, provenance, retention and personal-data rules for everything POLICYLAB
ingests, stores, displays or exports. **Normative for data work**; interfaces live in
[`../architecture/contracts.md`](../architecture/contracts.md).

> ## ⚠️ "Public" ≠ "Free to reuse"
> A dataset being publicly downloadable says nothing about whether you may redistribute,
> transform, or commercially reuse it. **Never assume a dataset is free to reuse.**
> Check and record the licence *per dataset* before ingest, display, or export.

---

## 1. Per-source licence table

Seed: [`data/source-registry/catalog.yaml`](../../data/source-registry/catalog.yaml)
(9 sources). Licence values below mirror the catalog; **per-dataset licences may differ**
(marked "varies") and must be read from each dataset's metadata before redistribution.

| # | Source | Type | Licence (catalog) | Reuse notes |
|---|---|---|---|---|
| 1 | **data.gov.gr (CKAN)** | open data | Διάφορες — ελέγχεται ανά dataset *(varies per dataset)* | Each dataset carries its own licence — record it on `datasets.license`; do not blanket-reuse |
| 2 | **Διαύγεια (Diavgeia)** | govtech | Ελεύθερη χρήση δημοσίων αποφάσεων *(free use of public decisions)* | Attribute the decision URL on every display/export |
| 3 | **Open Data Δήμου Αθηναίων** | govtech | Διάφορες — ελέγχεται ανά dataset *(varies)* | Municipal datasets may carry additional terms — verify per dataset |
| 4 | **ΚΗΜΔΗΣ** | govtech | Δημόσια πληροφορία *(public information)* | Public info ≠ open licence: attribute source; avoid bulk redistribution claims |
| 5 | **ΕΛΣΤΑΤ (ELSTAT)** | statistics | Ελεύθερη χρήση με αναφορά πηγής *(free use with attribution)* | **Attribution mandatory** in UI and in every export/report |
| 6 | **Eurostat** | statistics | **CC BY 4.0 (EU)** | Attribution + licence link; indicate changes if modified |
| 7 | **OpenStreetMap (Overpass)** | geospatial | **ODbL 1.0** | **Share-alike:** distributing a derivative database requires ODbL licensing; © OpenStreetMap contributors on maps |
| 8 | **Open-Meteo** | weather | **CC BY 4.0** | Attribution required; non-commercial caveats do not apply (CC BY) |
| 9 | **data.europa.eu** | open data | Διάφορες — ελέγχεται ανά dataset *(varies)* | Hub aggregates third-party licences — follow the dataset-level licence |

**Operational rules**

- `datasets.license` and `sources.license` are **required** fields (contracts §5.7 provenance
  columns). Empty licence ⇒ dataset is *display-only* (metadata shown, redistribution blocked).
- ODbL (OSM) data: any derived database shipped or served must be ODbL-compatible; map tiles
  must show attribution.
- ELSTAT / Eurostat: attribution strings ship in exports and reports, not just in the UI.
- Licence changes upstream: re-check on ingestion; `dataset_versions` keep history so old
  versions retain their original licence snapshot.

---

## 2. Provenance requirements

Every unified record must answer **where from, when, which version, under which licence,
unchanged how**:

| Field | Column / location | Required |
|---|---|---|
| Origin | `datasets.source_id` → `data_sources`, `original_source.url` | yes |
| Licence | `datasets.license` | yes (or display-only) |
| Last upstream update | `datasets.last_updated` | when known |
| Retrieval time | `datasets.fetched_at` / `NormalizedRecord.fetched_at` | yes |
| Integrity | `datasets.checksum` | yes for raw snapshots |
| Source version | `dataset_versions` + `provenance.source_version` | when the source versions |
| Free-form | `datasets.metadata JSONB` | as needed |

- **Raw tier is kept** (see §3) so any unified row can be re-derived and audited.
- AI answers, research exports and impact reports must be able to cite sources
  (evidence-first rule — contracts §4).
- Exports (`md|csv|json`) embed a **provenance section**: sources, licences, model versions,
  run ids, timestamps.

---

## 3. Retention policy

| Data class | Retention | Rationale |
|---|---|---|
| **Raw ingestion snapshots** (ObjectStore: `s3://` or `./storage`) | **Kept** — retained indefinitely for MVP; re-processable audit trail | reproducibility, licence audit, source dispute resolution |
| **Unified dataset rows + versions** | Kept; superseded versions preserved in `dataset_versions` | history & provenance |
| **Quality reports** | Kept (append-only) | trend of source health |
| **Audit logs** (`audit_logs`) | **90 days**, then purged | abuse investigation window without indefinite IP retention |
| **Simulation runs + passports** | Kept (research value; no personal data) | reproducibility of published results |
| **Citizen Lab content** (proposals, comments, consultations) | Kept while the consultation is relevant; purge on documented request | see §4 |
| **Feature flags / settings / registry** | Kept; current state only | operational |
| **LLM prompts/completions** | Not persisted by POLICYLAB (transient per request) | minimization |

Purge job notes: audit-log purge is a simple `DELETE ... WHERE created_at < now() - 90 days`
(admin or maintenance task); raw snapshots are **not** purged in MVP.

---

## 4. Personal data stance

- **POLICYLAB collects no personal data.** No accounts, no logins, no emails, no profiles,
  no cookies for tracking, no analytics beacons (contracts §1: no auth anywhere).
- The only free-text a visitor may submit is **Citizen Lab content** (proposal title/body,
  comment body) — submitted **anonymously, without identity**. Submitters must not include
  personal data; UI copy advises this (el+en).
- `audit_logs` store `ip` solely for rate limiting and abuse investigation, retained 90 days
  (§3) and never displayed beyond the admin audit page.
- No third-party trackers; map tiles and CDN assets are the only external calls.
- If a future feature needs accounts, it requires: a data-protection review, a documented
  legal basis, retention limits, and a contract update — it is explicitly **out of MVP scope**
  (Keycloak deferred).

---

## 5. Open-source licensing matrix

| Asset | Licence | Where |
|---|---|---|
| **Source code** (apps, packages, services, infrastructure scripts) | **Apache License 2.0** | [`../../LICENSE`](../../LICENSE) |
| **Documentation & guides** in `docs/`, `README.md`, `research/` prose | **CC BY 4.0** (attribution: POLICYLAB contributors) | stated in README §8 |
| **Contracts & specs** | CC BY 4.0 (same as docs) | `docs/architecture/` |
| **Seed registry data** (`data/source-registry/catalog.yaml`) — our compilation | CC BY 4.0 | — |
| **Third-party datasets** (fetched at runtime) | **Their own licences** — see §1 table | never re-licensed by us |
| **OpenStreetMap data** | ODbL 1.0 © OpenStreetMap contributors | attribution on maps/exports |
| **Design tokens / third-party assets** | per their licences; no asset re-licensing implied | — |

**Rules:** never strip licence/attribution fields from ingested data; never re-license
third-party content as Apache-2.0; CI/review rejects PRs that commit raw third-party data
dumps; the Developer Portal surfaces rate limits **and** licence notes
(`GET /v1/developers/info` → `license` field).

---

## 6. Checklist for new data sources

- [ ] Licence identified at **dataset level**, not just portal level (§1)
- [ ] "Public ≠ free" reviewed; redistribution/display-only decision recorded
- [ ] Attribution string prepared (el+en where user-facing)
- [ ] Provenance fields mapped (§2) · raw snapshot enabled (§3)
- [ ] ODbL/CC-BY/other obligations noted (share-alike? attribution? modification notice?)
- [ ] Entry added/updated in `data/source-registry/catalog.yaml` with `license`
- [ ] No personal data in the source (§4) — if present, redact at ingest
