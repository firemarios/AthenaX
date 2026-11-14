# POLICYLAB

[![CI](https://github.com/firemarios/AthenaX-V2/actions/workflows/ci.yml/badge.svg)](https://github.com/firemarios/AthenaX-V2/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

**Open GovTech Intelligence & Policy Experimentation**

> Connect public data. Understand the city. Test better policies.

POLICYLAB is an open-source platform that connects public open-data and GovTech sources,
makes them explorable and question-able with **evidence-first AI**, and lets practitioners
**design, simulate and compare policy scenarios** with full reproducibility — starting with
Athens, built to work for any city.

- **License:** [Apache-2.0](LICENSE)
- **Language:** Greek-first UI (English fully available) - every user-facing string ships `el` + `en`
- **Contracts (normative):** [`docs/architecture/contracts.md`](docs/architecture/contracts.md)
- **Evidence for reviewers:** [`docs/evidence/`](docs/evidence/) - smoke run, connector health,
  AI evidence-first eval, model determinism, rehearsal checklist. Demo/deploy:
  [`docs/DEMO.md`](docs/DEMO.md), [`docs/DEPLOY.md`](docs/DEPLOY.md).

---

## 1. Vision & principles

POLICYLAB balances four forces instead of optimizing for one:

| Force | What it means here |
|---|---|
| **GovTech** | Real public decisions, projects and procurement (Διαύγεια, ΚΗΜΔΗΣ, municipal open data) — not a mock dashboard |
| **Open Data** | Public datasets first, licensed and attributed, with provenance on every record |
| **AI** | Answers **with sources or explicit insufficiency** — never an unsourced claim |
| **Policy Simulation** | Deterministic models, validated inputs, full *Simulation Passports*, baseline-vs-scenario comparison |

Principles:

1. **Open by design** — Apache-2.0 code, public API, public data, public methodology.
2. **API-first** — every feature is reachable through the documented `/v1` envelope API.
3. **Evidence-first AI** — no answer without sources; limitations always visible.
4. **Modular simulations** — small validated models over one giant black box.
5. **Athens-first, not Athens-only** — all areas/layers/cities are data-driven and configurable.

---

## 2. Modules (10)

| # | Module | One-liner | Key endpoints |
|---|---|---|---|
| 01 | **Open Data Hub** | Search, quality-score and download public datasets with provenance | `GET /v1/sources`, `GET /v1/datasets` |
| 02 | **GovTech Explorer** | Public decisions & project tracker with map + timelines | `GET /v1/decisions`, `GET /v1/projects` |
| 03 | **Ask the City** | Evidence-first AI Q&A over connected records | `POST /v1/ai/query` |
| 04 | **City Intelligence / Digital Twin** | Multi-layer geospatial view of the city (2D → 3D roadmap) | `GET /v1/city/layers`, `GET /v1/city/features` |
| 05 | **Policy Builder** | Structured policy design: parameters, assumptions, KPIs, variants | `POST /v1/policies` |
| 06 | **Policy Simulation Engine** | Deterministic models + Simulation Passport + uncertainty | `POST /v1/simulations`, `GET /v1/models` |
| 07 | **Citizen Lab** | Consultations, proposals, comments (with participation disclaimer) | `GET/POST /v1/consultations`, `/v1/proposals` |
| 08 | **Impact Assessment** | 6-dimension impact report per simulation run | `GET /v1/impact/{run_id}` |
| 09 | **Research Workspace** | Projects, experiment history, exportable reports w/ provenance | `GET/POST /v1/research/projects` |
| 10 | **Developer Portal** | OpenAPI catalogue, code examples, rate-limit & license notes | `GET /v1/developers/info` |

Full product definition: [`docs/PRD.md`](docs/PRD.md).

---

## 3. Architecture (7 layers)

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ 7. GOVERNANCE      audit logs · feature flags · rate limits · licenses  │
│                    provenance · Simulation Passport · no-auth posture    │
├──────────────────────────────────────────────────────────────────────────┤
│ 6. SIMULATION      policy models · runner · uncertainty · impact report  │
│                    (accessibility, greenspace, traffic, cost)            │
├──────────────────────────────────────────────────────────────────────────┤
│ 5. AI              orchestrator · 6 agents · evidence layer · RAG        │
│                    controlled tools — NO arbitrary SQL from AI input     │
├──────────────────────────────────────────────────────────────────────────┤
│ 4. DATA            cleaning · validation · quality scoring · unified     │
│    INTELLIGENCE    store · geospatial engine (whitelisted queries only)  │
├──────────────────────────────────────────────────────────────────────────┤
│ 3. CONNECTORS      CKAN · Διαύγεια · Athens · ΚΗΜΔΗΣ · ΕΛΣΤΑΤ ·        │
│                    Eurostat · OSM Overpass · Open-Meteo · data.europa    │
├──────────────────────────────────────────────────────────────────────────┤
│ 2. API GATEWAY     FastAPI /v1 · response envelope · rate limiting ·     │
│                    validation · OpenAPI · health · audit                 │
├──────────────────────────────────────────────────────────────────────────┤
│ 1. PRESENTATION    Next.js 16 web app · MapLibre GL · Cesium (opt.) ·    │
│                    Greek-first i18n · dark/light · WCAG AA               │
└──────────────────────────────────────────────────────────────────────────┘
        │                │                    │                 │
   PostgreSQL 16 +   Redis (optional)    MinIO (optional)   LLM provider
      PostGIS 3.4    in-memory fallback   ./storage fallback  (Ollama/OpenAI-compat)
```

Detailed specification: [`docs/architecture/technical-specification.md`](docs/architecture/technical-specification.md).

---

## 4. Repository map

```text
policylab/
├── apps/
│   ├── api/                 FastAPI backend (agent B) — app.main:app, /v1 routes
│   └── web/                 Next.js 16 frontend (agents D & E)
├── packages/                shared TS packages (@policylab/ui, types, api-client)
├── services/                Python domain services (ai_engine, connector_kit,
│                            data_ingestion, geospatial_engine, simulation_engine,
│                            reporting_engine, open_data_connectors, govtech_connectors)
├── data/
│   └── source-registry/     catalog.yaml — 9 sources + 6 Athens intervention areas
├── infrastructure/
│   ├── database/            Alembic migrations + init-db (agent B)
│   ├── docker/              image build docs
│   ├── monitoring/          OTel collector config (opt-in)
│   └── deployment/          env templates, dev.ps1, runbooks
├── research/                methodology, validation templates, experiments, reports
├── docs/                    PRD, technical spec, contracts, AI prompt, data governance
├── docker-compose.yml       db + api + web (+ redis/minio via --profile full)
└── CONTRIBUTING.md · LICENSE · README.md
```

---

## 5. Quickstart

### 5.1 Prerequisites

- Docker Desktop (for the DB, or the full stack)
- Python **3.11** (`python` on PATH; `requirements.txt` / `requirements-dev.txt`)
- Node **≥ 20** (`npm.cmd` on Windows PowerShell)
- Optional: [Ollama](https://ollama.com) for Ask-the-City (`POLICYLAB_LLM_BASE_URL=http://localhost:11434`)

### 5.2 Docker path (database only — recommended)

```powershell
docker compose up -d db          # PostGIS 16-3.4 on localhost:5432
docker compose ps                # wait until "healthy"
```

### 5.3 Local path (backend)

```powershell
# from the repo root
python -m pip install -r requirements-dev.txt

# migrations — PYTHONPATH must include the repo root AND apps/api (contracts §1)
$env:PYTHONPATH = "$PWD;$PWD\apps/api"
alembic upgrade head             # schema; run after every pull

# API — verified uvicorn flags: --app-dir (import path), --reload (auto-reload)
python -m uvicorn app.main:app --app-dir apps/api --reload
# → http://localhost:8000/docs   (public OpenAPI/Swagger)
# → http://localhost:8000/health (db, llm, storage, rate_limiter)
```

No Docker at all? The API still starts: it degrades gracefully (YAML source fallback,
in-memory rate limiter, local `./storage`) — but geospatial endpoints need PostGIS.

### 5.4 Frontend

```powershell
npm.cmd install
npm.cmd dev                     # → http://localhost:3000
```

### 5.5 One-shot dev script

```powershell
powershell -ExecutionPolicy Bypass -File infrastructure\deployment\dev.ps1 -Web
```

### 5.6 Full stack in Docker (optional services included)

```powershell
docker compose --profile full up -d --build   # + redis + minio (minioadmin/minioadmin)
```

---

## 6. Testing

```powershell
python -m pytest -q             # backend + services (pytest pythonpath: . and apps/api)
npm.cmd run lint                # eslint (eslint-config-next, strict)
npm.cmd run build               # Next.js production build — must pass before PR
```

Agent-specific gates are listed in [`docs/architecture/contracts.md` §7](docs/architecture/contracts.md);
the orchestrator runs the final combined gates.

---

## 7. Documentation

| Document | Purpose |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Master product requirements: personas, 10 modules, journeys, MVP scope, KPIs |
| [`docs/architecture/contracts.md`](docs/architecture/contracts.md) | **Normative** shared build contracts (endpoints, types, DB tables, ownership) |
| [`docs/architecture/technical-specification.md`](docs/architecture/technical-specification.md) | 7-layer technical spec, stack, standards, security posture |
| [`docs/ai-development-master-prompt.md`](docs/ai-development-master-prompt.md) | Instructions for AI coding agents working in this repo |
| [`docs/data-governance/README.md`](docs/data-governance/README.md) | Data licensing, provenance, retention, personal-data stance |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Workflow, code style, i18n & evidence rules |
| [`research/`](research/) | Validation methodology, report templates, experiment log |

---

## 8. License & language

- Code: **Apache License 2.0** — see [`LICENSE`](LICENSE).
- Documentation: CC BY 4.0 (attribution to POLICYLAB contributors); third-party datasets keep
  **their own** licenses — see [`docs/data-governance/README.md`](docs/data-governance/README.md).
  *Public does not mean free to reuse.*
- **Bilingual:** the product UI is **Greek-first** with English available everywhere
  (`el` default, `en` one click away); error messages are Greek; code and identifiers are English.
