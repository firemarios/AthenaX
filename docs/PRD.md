# POLICYLAB — Master Product Requirements Document (PRD)

| | |
|---|---|
| **Product** | POLICYLAB — Open GovTech Intelligence & Policy Experimentation |
| **Tagline** | Connect public data. Understand the city. Test better policies. |
| **Version** | 1.0 (MVP) |
| **Status** | Approved for parallel build |
| **Normative companion** | [`contracts.md`](architecture/contracts.md) (interfaces) · [`technical-specification.md`](architecture/technical-specification.md) (architecture) |

---

## 1. Product vision

POLICYLAB is an open-source civic intelligence platform that turns fragmented public data
into **understandable, question-able and testable** material for urban governance. It connects
real public sources (open data portals, public decisions, statistics, maps), lets anyone ask
the city questions with **evidence-first AI**, and lets practitioners design, simulate and
compare policy scenarios with full reproducibility.

**Athens-first, not Athens-only.** Every place-specific value (intervention areas, city layers,
default city) is data-driven and configurable; nothing is hard-coded to one municipality.

### 1.1 Principles

1. **Open by design** — Apache-2.0 code, public OpenAPI, public methodology, public data
   licences recorded everywhere. No black boxes.
2. **API-first** — every feature is reachable through the documented `/v1` envelope API;
   the web UI is a client of that API, never a privileged consumer.
3. **Evidence-first AI** — no answer without sources, or an explicit statement that the data
   is insufficient. Limitations are always visible next to the answer.
4. **Modular simulations** — small, individually validated models over one giant black box;
   each run carries a full Simulation Passport (inputs, assumptions, uncertainty, seed).
5. **Athens-first, not Athens-only** — ship deeply for a real city, generalize by data and
   configuration, not by abstraction debt.

---

## 2. Personas

| Persona | Profile | Primary needs | Modules they live in |
|---|---|---|---|
| **Citizen** (Πολίτης) | Athens resident, non-technical, mobile-first | Understand what is happening in the neighborhood; see sources; participate | 01, 02, 04, 07, 03 |
| **Municipality officer** (Υπάλληλος δήμου) | Works with public decisions, projects, budgets | Find decisions/projects fast; evaluate options; justify with evidence | 02, 01, 05, 06, 08 |
| **Researcher** (Ερευνητής) | Academic / think-tank, rigorous, export-driven | Reproducible data + models, provenance, exports, experiment history | 01, 06, 08, 09, 04 |
| **Developer** (Προγραμματιστής) | Builds on top of public APIs | Clean OpenAPI, examples, rate limits, licence clarity | 10, 01, 09 |
| **Policymaker** (Σχεδιαστής πολιτικής) | Needs decision-grade summaries, low time budget | Baseline-vs-scenario comparison, impact across 6 dimensions, clear uncertainty | 05, 06, 08, 03 |

Cross-cutting: **no accounts** — every persona is anonymous (see NFR-6). Participation modules
carry an explicit disclaimer that online input is not a representative or institutional process.

---

## 3. Modules

Each module: **Goal → Features → Acceptance criteria (AC)**. Endpoint references are normative
in [contracts §2](architecture/contracts.md).

### Module 01 — Open Data Hub

- **Goal:** one searchable, quality-annotated catalogue of connected public datasets with
  full provenance.
- **Features:** source registry with live health checks; dataset search/filters
  (source, tag, sort by freshness); dataset detail with quality score
  (completeness/freshness/validity), provenance (source version, retrieved_at, checksum),
  download resources, related datasets; version history; recompute quality on demand;
  CSV/GeoJSON/JSON export.
- **AC:**
  - `GET /v1/datasets?q=&source_id=&tag=&page=&page_size=&sort=` returns the envelope with
    `meta.total` and paginates correctly.
  - Every dataset detail shows license, original source URL, `last_updated`, `fetched_at`.
  - Sources degrade gracefully: a down connector shows `status: down`, never a 500.
  - Quality recompute (`POST /v1/datasets/{id}/quality`) persists a `QualityReport`.

### Module 02 — GovTech Explorer

- **Goal:** make public decisions and public projects legible and traceable.
- **Features:** decision search (full-text, org, date range); decision detail with link to the
  original Διαύγεια record; public project tracker (status, budget, org) with bbox search;
  project detail with linked decisions timeline; map of interventions from project geometries.
- **AC:**
  - `GET /v1/decisions` and `GET /v1/projects` support the contract filters and pagination.
  - Every decision/project links back to its `url` (original source, never a dead end).
  - `GET /v1/projects?bbox=` returns only intersecting geometries.
  - Empty results render an empty state with suggestions (el+en), not a blank screen.

### Module 03 — Ask the City (AI)

- **Goal:** let anyone ask a natural-language question about the city and get an
  **evidence-first** answer.
- **Features:** single input + example chips; `POST /v1/ai/query` orchestrator; answer shows
  detailed result, short summary, source cards (url+title) and limitations; optional map
  (`meta.ui.show_map`); suggested follow-up actions; empty/error/insufficient states;
  `?q=` deep-linking from the universal search (Ctrl+K).
- **AC:**
  - Every answer carries `sources[]` **or** `limitations` containing `insufficient data`
    or `llm unavailable` — never an unsourced claim.
  - If the LLM is unreachable, the endpoint still returns 200 with a graceful fallback.
  - `meta.limitations` and `meta.record_count` are always rendered.
  - Question length validated 1..2000; Greek error messages on 422.
  - No arbitrary SQL from AI input (whitelisted read-only queries only).

### Module 04 — City Intelligence / Digital Twin

- **Goal:** a multi-layer geospatial view of the city that policies act upon.
- **Features:** layer catalogue (8 layers: buildings, roads, green_spaces, schools, hospitals,
  public_facilities, pois, population) with feature counts; GeoJSON feature queries by layer +
  bbox + limit; named intervention areas (6 seeded Athens areas); 2D MapLibre map with layer
  sidebar, popups, feature list; 3D mode (CesiumJS, optional) with graceful fallback to
  MapLibre fill-extrusion.
- **AC:**
  - `GET /v1/city/layers` returns bilingual titles (`title.el`/`title.en`).
  - `GET /v1/city/features?layer=buildings&bbox=w,s,e,n&limit=500` returns a valid GeoJSON
    FeatureCollection; unknown layer → 422 with Greek message (whitelist, no user SQL).
  - Map works with zero data loaded (empty state + basemap), SSR-safe (MapLibre mounts in
    `useEffect`).
  - 3D view failure never breaks the 2D page (fallback path exercised).

### Module 05 — Policy Builder

- **Goal:** structure a policy idea into a testable object: parameters, assumptions, KPIs.
- **Features:** policy list + detail; create form (title, description, category, area, horizon,
  parameters, assumptions, KPIs); variants (same policy, different parameter sets); status
  lifecycle; links to simulations and impact.
- **AC:**
  - `POST /v1/policies` → 201 with the created `Policy` in the envelope.
  - `POST /v1/policies/{id}/variants` creates variants retrievable on the policy detail.
  - Form validation errors return the envelope `error.details[]` field mapping.
  - All labels/disclaimers bilingual (el+en).

### Module 06 — Policy Simulation Engine

- **Goal:** run deterministic, reproducible policy scenarios and compare them to a baseline.
- **Features:** model catalogue (`GET /v1/models`) with typed parameters and bilingual labels;
  synchronous run for local models; baseline comparison; run detail with metrics, logs,
  **Simulation Passport** (all fields), uncertainty ranges; seeded determinism.
- **AC:**
  - Same model + parameters + seed → identical metrics (determinism test in CI).
  - Every succeeded run has a non-null passport with: model name/version, data sources,
    assumptions, reliability limits, uncertainty, executed_at, seed, inputs_checksum.
  - Unknown model → run `status: failed` with warning, never a 500.
  - `compare_baseline: true` returns `results.baseline` alongside scenario metrics.

### Module 07 — Citizen Lab

- **Goal:** structured, honest online participation — consultations, proposals, comments.
- **Features:** consultations list/detail (status, time window, proposals); create proposal
  (title, description, area, category); comment threads; visible participation disclaimer.
- **AC:**
  - `GET/POST /v1/consultations`, `/v1/proposals`, `/v1/proposals/{id}/comments` per contract.
  - Every citizen-facing surface shows the disclaimer (el+en): online participation is not a
    representative/institutional decision.
  - No accounts, no personal data collected beyond free-text content (see data governance).
  - Rate limiting applies (120 req/min/IP default) — spam is throttled, not blocked by auth.

### Module 08 — Impact Assessment

- **Goal:** translate simulation metrics into a decision-grade, 6-dimension impact view.
- **Features:** impact report per run across environment, society, economy, mobility,
  quality_of_life, administration; per-indicator baseline/value/delta/unit/direction/confidence;
  bilingual labels; summary text; comparison view vs baseline run.
- **AC:**
  - `GET /v1/impact/{run_id}` returns exactly the 6 contract dimensions.
  - Each indicator carries `direction` and `confidence`; deltas computed vs baseline when present.
  - Missing metrics degrade to indicators with `baseline: null`, not errors.
  - Report is exportable (csv/json) with provenance section.

### Module 09 — Research Workspace

- **Goal:** keep experiments, runs and reports together with provenance — reproducible research.
- **Features:** research projects (name, description); experiments referencing model + run ids +
  notes; export as md/csv/json **with provenance section**; experiment history timeline.
- **AC:**
  - `POST /v1/research/projects` and nested experiments per contract.
  - `GET /v1/research/projects/{id}/export?format=md|csv|json` downloads a file whose content
    includes a provenance section (sources, model versions, run ids, timestamps).
  - Export works for an empty project (valid empty report, not a crash).

### Module 10 — Developer Portal

- **Goal:** make the platform consumable by third parties with clear rules.
- **Features:** API info (openapi_url, version, rate_limit, license, contact, endpoints_count);
  endpoint catalogue rendered from `/openapi.json`; copy-paste examples in multiple languages;
  rate-limit and licence notes; link to live `/docs`.
- **AC:**
  - `GET /v1/developers/info` and `/v1/developers/examples` per contract.
  - Endpoint catalogue matches the served OpenAPI (no drift).
  - Examples use the envelope and the documented base URL.

---

## 4. User journeys

### 4.1 Flagship demo — *"What happens if we change traffic in an Athens area?"*

1. **Land** — citizen opens `http://localhost:3000` (or the deployed site); sees the tagline
   *"Συνδέστε τα δημόσια δεδομένα. Κατανοήστε την πόλη. Δοκιμάστε καλύτερες πολιτικές."* and
   live metric cards (sources, datasets, connector health).
2. **Orient on the map** — navigates to **/city**, picks the **Exarchia** intervention area,
   toggles the *roads* and *buildings* layers; the map shows real GeoJSON features with
   bilingual popups.
3. **Ask** — presses **Ctrl+K** → `/ask`, types *"Πόσες εγκαταστάσεις καθαρισμού βρίσκονται
   εντός 300 m από την Εξάρχεια;"* → receives an answer with **source cards** and a visible
   **limitations** block (or an explicit "insufficient data").
4. **Design the policy** — goes to **/policies/new**, creates *"Περιορισμός κυκλοφορίας στην
   Εξάρχεια"* with category `mobility`, area `exarchia`, horizon `12 months`, parameters
   (traffic reduction %, bus frequency), assumptions and KPIs.
5. **Pick a model** — on the policy detail, opens the model picker (`GET /v1/models`),
   chooses `traffic_sumo` (or its deterministic fallback), sets parameters, enables
   **compare with baseline**.
6. **Simulate** — `POST /v1/simulations` runs synchronously; the run page shows metrics,
   baseline-vs-scenario bars, logs, uncertainty ranges and the full **Simulation Passport**
   (model version, sources, assumptions, seed, inputs checksum).
7. **Assess impact** — `GET /v1/impact/{run_id}` renders the 6-dimension report
   (mobility, environment, economy, society, quality_of_life, administration) with deltas,
   direction arrows and confidence; exports CSV for the meeting.
8. **Share** — creates a **Research Workspace** project *"Exarchia mobility pilot"*,
   attaches the run, exports the markdown report **with provenance**, and shares the link —
   a colleague reproduces the identical numbers from the passport.

### 4.2 Other journeys

- **Officer: "Which decisions touch my neighborhood?"** — /govtech → search Διαύγεια decisions
  by org + date → open decision → follow `project_id` → project detail with timeline + map
  geometry → export.
- **Researcher: "Reproduce this number"** — /research → open project → open experiment →
  open run → read passport (seed, inputs_checksum, sources) → re-run with same inputs →
  identical metrics → export md with provenance.
- **Developer: "Build on POLICYLAB"** — /developers → read rate-limit + licence notes →
  fetch `/openapi.json` → copy example → call `GET /v1/datasets` with pagination → handle
  the envelope.
- **Citizen: "I have an idea for my area"** — /citizen → read disclaimer → browse consultations
  → submit proposal (area = Κυψέλη) → comment on two existing proposals → see status.

---

## 5. Non-functional requirements

| ID | Requirement | Target / notes |
|---|---|---|
| NFR-1 | **Bilingual (el+en)** | Greek default, English always available; every user-facing string has both; backend errors in Greek; no untranslated string in MVP surfaces. |
| NFR-2 | **Accessibility** | WCAG 2.1 AA: contrast ≥ 4.5:1, keyboard operable, visible focus rings, semantic landmarks, `aria-label` on icon buttons, map controls reachable. |
| NFR-3 | **Performance** | API p95 < 500 ms for catalogue queries (warm, DB up); web LCP < 2.5 s on 4G; dataset lists paginate (page_size ≤ 100); GeoJSON features capped at `limit` (default 500); AI answers stream-of-one with ≤ 3 retrieval attempts. |
| NFR-4 | **Graceful degradation** | Every dependency optional: DB down → YAML fallback for sources + clear health states; LLM down → fallback answer with `llm unavailable`; Redis/MinIO absent → in-memory rate limit + `./storage`; Cesium fails → MapLibre 3D fallback; connectors down → empty list + `status: down`. Never a raw stack trace to the user. |
| NFR-5 | **Observability** | `GET /health` reports `db, llm, storage, rate_limiter` as `ok\|degraded\|down\|disabled`; audit log of every request (method, path, status, ip); connector health timestamps. |
| NFR-6 | **No-auth open access** | No accounts, no API keys, no personal data collection. Protection = per-IP in-memory rate limiting (120 req/min default), strict input validation (pydantic), audit logging, sandboxed simulation workers, prompt-injection defenses. See technical spec §Security. |
| NFR-7 | **Security & privacy** | Secrets only via env (never committed); CORS restricted to configured origins; only whitelisted read-only SQL; output escaping (React default); no PII stored (see data governance). |
| NFR-8 | **Reproducibility** | Simulation deterministic given seed; full Simulation Passport on every run; exports carry provenance; models versioned in `model_registry`. |
| NFR-9 | **Reliability of ingestion** | Connectors never raise to HTTP: `search()` returns `[]`, health reports `down`; retries via tenacity (3 attempts, exp backoff); raw snapshots retained for audit. |
| NFR-10 | **Standards compliance** | DCAT-AP metadata, GeoJSON, GTFS where relevant, OGC API Features-compatible query semantics, STAC-style asset descriptors, JSON Schema for payloads (see technical spec). |

---

## 6. MVP scope

| In scope (MVP) | Explicitly out of scope (post-MVP) |
|---|---|
| 9 connectors (CKAN/data.gov.gr, Διαύγεια, Athens, ΚΗΜΔΗΣ, ΕΛΣΤΑΤ, Eurostat, Overpass/OSM, Open-Meteo, data.europa) | User accounts, SSO, roles (Keycloak deferred) |
| Dataset catalogue w/ quality + provenance (30–50 datasets) | Automated legal licence parsing |
| Decision + project explorer with map | Predictive budget analytics |
| Evidence-first AI Q&A (Ollama / OpenAI-compatible) | Fine-tuned domain models, voice, vision |
| 8 city layers + 6 intervention areas, 2D map, optional 3D | Real-time sensor streaming / IoT |
| Policy Builder + variants | Multi-user policy collaboration & permissions |
| Simulation engine: accessibility, greenspace, traffic (SUMO adapter + synthetic fallback), cost — **1 validated pilot model** | Large-scale agent-based city simulation |
| 2–3 scenario comparison with baseline + uncertainty | Monte-Carlo campaign orchestration |
| 6-dimension impact report | Formal cost–benefit accounting standards |
| Citizen Lab (consultations/proposals/comments + disclaimer) | Identity verification, e-delivery to municipality |
| Research Workspace + md/csv/json export with provenance | Journal-format publication pipeline |
| Developer Portal + OpenAPI + examples | API key issuance, developer analytics |
| Admin: connectors, feature flags, audit log, ingest trigger | Multi-tenant admin, SSO-backed RBAC |
| Rate limiting, audit logs, envelope everywhere | WAF, bot management |
| Optional Redis / MinIO / OTel collector configs | Full observability stack (Prometheus/Grafana) as default |

---

## 7. Success metrics (KPIs)

| # | KPI | MVP target |
|---|---|---|
| K1 | Connected **connectors** (live, health-checked) | **8–10** |
| K2 | Indexed **datasets** (searchable, with provenance) | **30–50** |
| K3 | City **layers** available on the map | **5–8** |
| K4 | **Validated pilot models** (documented validation report in `research/validation/`) | **1** |
| K5 | **Scenario comparisons** (baseline vs policy) demonstrated end-to-end | **2–3** |
| K6 | **Research reports** exported with full provenance | **1** |
| K7 | **Pilot participants** in Citizen Lab consultations/proposals/comments | **30–50** |
| K8 | Evidence-first compliance | 100% of AI answers carry sources or explicit insufficiency |
| K9 | i18n coverage | 100% of user-facing strings in `el` + `en` |
| K10 | Quality gates | `pytest`, `npm run lint`, `npm run build` all green |

Validation methodology for K4–K6: [`research/methodology/README.md`](../research/methodology/README.md);
report template: [`research/validation/TEMPLATE.md`](../research/validation/TEMPLATE.md).

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Source APIs change/break | Connectors degrade gracefully + health status + raw snapshots retained |
| LLM unavailable or hallucinating | Fallback answer, mandatory sources/limitations, strict system prompt, record grounding |
| Licence ambiguity of third-party data | Per-source licence table, "public ≠ free" rule, exports attribute sources |
| Scope creep toward "smart city platform" | MVP scope table is binding; new features go through contracts update |
| No-auth abuse | Rate limiting + validation + audit logs + sandboxed workers (NFR-6/7) |
| Model mistrust | Simulation Passport + validation reports + uncertainty ranges always shown |

---

*This PRD is normative for product scope; interfaces are normative in
[`contracts.md`](architecture/contracts.md). Deviations require an agreed contract update.*
