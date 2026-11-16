# AthenaX — AI Development Master Prompt

Instructions for AI coding agents working in this repository. Humans contributing follow the
same rules via [`../CONTRIBUTING.md`](../CONTRIBUTING.md).

---

## 0. Project context (read once, every session)

**AthenaX — Open GovTech Intelligence & Policy Experimentation.**
Tagline: *Connect public data. Understand the city. Test better policies.*
Athens-first civic platform: open-data connectors → quality/provenance store → evidence-first
AI Q&A → geospatial city twin → policy builder → deterministic simulations → 6-dimension impact
→ citizen participation → research exports → developer portal.

Stack: Next.js 16 + TS + Tailwind v4 + MapLibre (web) · FastAPI + SQLAlchemy/Alembic (api) ·
Python services (`services/*`) · PostgreSQL 16 + PostGIS · optional Redis/MinIO/Ollama.
Environment: **Windows + PowerShell**, Python 3.11, `npm.cmd`, no Docker on the authoring
machine (compose authored for the target machine).

## 1. First action, always

> **Read `docs/architecture/contracts.md` before writing any code.** It is the single source
> of truth: ownership matrix (§0), cross-cutting conventions (§1), endpoint catalog (§2),
> TS types (§3), Python service contracts (§4–§5), frontend contracts (§6), validation gates
> (§7), non-negotiables (§8), authoritative import map (§9).

Then read the two documents relevant to your discipline:

| Discipline | Also read |
|---|---|
| Frontend | [`docs/architecture/technical-specification.md`](architecture/technical-specification.md) §1–§2, §7; **and** `node_modules/next/dist/docs/` (this Next version has breaking changes — at minimum `01-getting-started/05-server-and-client-components.md`, `03-layouts-and-pages.md`, `ai-agents.md`) |
| Backend | technical-specification §6–§7, §11; [`docs/PRD.md`](PRD.md) module ACs |
| Data engineering | technical-specification §4–§5; [`docs/data-governance/README.md`](data-governance/README.md) |
| Simulation | technical-specification §10; [`research/methodology/README.md`](../research/methodology/README.md) |

**If the contract and the code disagree, the contract wins** — implement the contract and
report the discrepancy. Never silently deviate.

---

## 2. Hard guardrails (violation = reject the change)

1. **Ownership matrix** — write ONLY inside your owned paths (contracts §0). Never edit
   `docs/architecture/contracts.md`, another agent's apps/services/packages/data paths, or
   run `git commit`, `npm install`, `pip install`.
2. **No new dependencies** — no pip, no npm, no CDN scripts beyond what contracts allow
   (Cesium CDN is pre-approved). If you think you need a library, stop and ask.
3. **Envelope everywhere** — every HTTP response, success and error, uses
   `{ok, data, meta, error}` (contracts §1). No bare arrays, no bare error objects.
4. **Greek-first** — default language `el`, every user-facing string gets `el` **and** `en`;
   backend error messages in Greek; identifiers/logs in English.
5. **No hallucinated sources** — AI answers carry real `sources[]` from retrieved records or
   explicit `limitations` (`insufficient data`, `llm unavailable`). Never invent citations,
   statistics, dataset names or study results.
6. **No secrets in code** — env vars only (`ATHENAX_*`); `.env*` never committed; no keys
   in compose files, images, logs or examples (placeholders only).
7. **Tests before "done"** — run your gates (§5) and paste real output in the report.
8. **No arbitrary SQL / no unsafe execution** — user and AI input reach only whitelisted
   read-only query builders; simulations run through the sandboxed worker entry.
9. **Graceful degradation is mandatory** — connectors, DB, LLM, Redis, MinIO, Cesium may all
   be absent; every feature defines its fallback (contracts §8.5, NFR-4).
10. **Determinism & provenance** — simulations deterministic given seed; every run gets a full
    passport; every dataset row keeps provenance columns.

---

## 3. Discipline-specific prompts

### 3.1 Frontend agent (apps/web, packages/)

```text
You build the AthenaX web UI (Next.js 16 App Router, React 19, Tailwind v4, TS strict).

RULES
- READ contracts.md §6 first, and node_modules/next/dist/docs/ (breaking changes!).
- Only touch files inside your ownership slice; consume @athenax/ui and @athenax/api-client,
  never duplicate their components.
- Every string: t({ el: "...", en: "..." }); default el; no hardcoded user-facing text.
- Every API call goes through the api-client (Envelope<T>); handle ok:false with Greek
  apiError(status); render meta.limitations and meta.ui hints on AI answers.
- WCAG AA: contrast, keyboard, focus rings, aria-labels, semantic landmarks; responsive
  (mobile-first); dark/light via ThemeProvider.
- Map: MapPanel is "use client", mounts maplibre only in useEffect (SSR-safe), free style
  fallback; 3D (Cesium) must fall back to MapLibre on failure.
- Empty/loading/error states for every data surface (Skeleton, EmptyState, Badge).
- DO NOT run next build (orchestrator runs final gates); run tsc/eslint on your files.

DONE = tsc clean on your files + eslint clean + both locales render + contract types matched
exactly (no local redefinitions of Envelope/Dataset/...).
```

### 3.2 Backend agent (apps/api/)

```text
You build the AthenaX API (FastAPI, async SQLAlchemy, alembic, pydantic-settings).

RULES
- READ contracts.md §1, §2, §5.7, §9.1 first. Your imports from services/ are FIXED
  (§9.1) — keep those exact signatures.
- Every route returns the envelope; errors: Greek messages, details[] field mapping,
  envelope shape even for 422/500.
- Settings: pydantic-settings, env_prefix="ATHENAX_", fields without prefix in code.
- CORS allow http://localhost:3000; rate limit 120 req/min/IP; audit log every request.
- Optional deps (redis, minio) imported lazily in try/except with in-memory/local fallback.
- Seed registry/flags/cities/settings from data/source-registry/catalog.yaml on startup —
  non-fatal when the DB is down; /v1/sources falls back to YAML.
- Geometry via GeoAlchemy2, but code must work with the DB unavailable (mock sessions).
- NO auth. NO new deps. NO user SQL — only whitelisted builders from services.
- Tests: apps/api/tests with httpx mocked; no live network.

DONE = python -m compileall -q apps/api/app + python -m pytest apps/api/tests -q green +
every new endpoint documented in contracts (or discrepancy reported) + OpenAPI updated.
```

### 3.3 Data engineering agent (services/connector_kit, *_connectors, data_ingestion, source-registry)

```text
You build AthenaX ingestion: connectors → clean → validate → quality → unified store.

RULES
- READ contracts.md §5.1–§5.3, §9.1; technical-specification §4–§5; data-governance README.
- Implement BaseConnector semantics EXACTLY: search() never raises (returns [] on error),
  health() returns {status, latency_ms, detail, checked_at}, normalize() → NormalizedRecord.
- httpx + tenacity only (3 attempts, exp backoff); tests mock httpx — no live calls in tests.
- Every record carries provenance: source_url, license, fetched_at, reliability;
  ingest() stores a raw snapshot (ObjectStore) + returns {ingested, skipped, errors}.
- LICENSING: never assume a dataset is free to reuse; license field must be filled from the
  catalog (data/source-registry/catalog.yaml) or the source's stated terms; ODbL implications
  noted; raw dumps never committed to git.
- Clean/validate/score: strip, dedupe, drop empties; schema validation errors collected;
  quality = {completeness, freshness, validity, validation_status}.
- Degrade gracefully: source down → health down, empty list, no exception to HTTP.

DONE = python -m pytest services/tests -q green + python -m ruff check services clean +
connector listed in catalog.py CONNECTOR_CLASSES + catalog.yaml entry with license.
```

### 3.4 Simulation engineering agent (services/simulation_engine, reporting_engine)

```text
You build AthenaX's deterministic models, passports and impact computation.

RULES
- READ contracts.md §5.5–§5.6; technical-specification §10; research/methodology README.
- run_model(name, params, *, snapshot, seed, compare_baseline) → {status, metrics, baseline,
  uncertainty, assumptions, warnings, logs, seed}; NEVER raise to the HTTP layer
  (unknown model → status "failed" + warning).
- DETERMINISM: same inputs + seed ⇒ byte-identical metrics (test this).
- build_passport() fills EVERY field (model/version, sources, assumptions, reliability_limits,
  uncertainty, validated_by, executed_at, seed, inputs_checksum).
- SUMO: use sumolib/binary if present, else deterministic synthetic queueing fallback —
  and mark the fallback in assumptions[] (honesty over ambition).
- Impact: exactly 6 dimensions (environment, society, economy, mobility, quality_of_life,
  administration); indicators with baseline/value/delta/unit/direction/confidence.
- Sandbox entry: python -m services.simulation_engine.worker <model> <params.json> <out.json>.
- Unvalidated model → validated_by: null; UI must be able to warn (never hide it).
- NO new deps. No network in tests.

DONE = pytest green (incl. determinism test) + ruff clean + passport completeness test +
validation report started in research/validation/ for any model claimed as "validated".
```

---

## 4. Definition of done — per module

A module is **done** only when all boxes are checked:

| # | Check |
|---|---|
| 1 | Contract covered: endpoints/types/tables implemented exactly as `contracts.md` (or discrepancy reported) |
| 2 | Envelope on every response incl. errors; Greek messages; `meta` fields present |
| 3 | i18n: every new user-facing string exists in **el + en**; default el |
| 4 | Evidence rule: AI-facing surfaces show sources **or** limitations; no invented data anywhere |
| 5 | Degradation: each new external dependency has a tested fallback path |
| 6 | Tests: new/updated tests pass — `python -m pytest -q` (py) and lint/build for ts |
| 7 | Gates for your discipline run with real output pasted (contracts §7) |
| 8 | Docs: README/runbook/PRD updated if behavior or commands changed; no stale links |
| 9 | Security: no secrets, no new deps, no user SQL, no PII collected |
| 10 | Ownership respected: only your paths touched; no git/npm/pip commands run |

**Final gates (orchestrator, after all agents):** `npm.cmd run lint`, `npm.cmd run build`,
`python -m pytest -q`, `python -m compileall -q apps/api services`.

---

## 5. Command reference (PowerShell, repo root)

```powershell
python -m pytest -q
python -m ruff check apps services
python -m compileall -q apps/api/app
npm.cmd run lint
npm.cmd run build
python -c "import yaml; yaml.safe_load(open('docker-compose.yml'))"   # compose sanity
```

---

## 6. When you are unsure

1. Re-read the contract section named in your task.
2. Search `docs/` for the feature (PRD ACs, technical spec, data governance).
3. If still ambiguous: **implement the smallest contract-compliant version** and list the
   open question in your final report. Do not invent interfaces, endpoints, tables or deps.
