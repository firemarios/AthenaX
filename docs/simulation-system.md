# Simulation system workflow

How AthenaX turns a policy into a reproducible simulation run, a decision report
and a six-dimension impact assessment.

This document describes the current implementation. The code is the source of truth;
paths are relative to the repository root.

## 1. Scope and design principles

The simulation subsystem covers:

- a catalog of deterministic simulation models,
- optional AI planning and AI report composition,
- run execution and persistence,
- passports (inputs, assumptions, checksums),
- cost-benefit estimates,
- impact reporting across six dimensions,
- the web pages that create, list and display runs.

Design rules the implementation relies on:

1. **A simulation never fails because of AI.** Both AI passes are optional and
   defensive; on any error the deterministic result is kept.
2. **`run_model` never raises.** Unknown models, bad parameters and execution errors
   return `status: "failed"` with warnings instead.
3. **Runs are reproducible.** The same model name, merged parameters and seed produce
   identical metrics. The default seed is `42`.
4. **Persistence never fails the request.** If the database is unavailable the run is
   stored in the in-memory fallback.
5. **Impact reporting is additive.** Simulation metrics come first; economics and
   clearly labelled AI estimates are merged in afterwards.

## 2. High-level architecture

```
Web UI
  /policies/[id]  "Run with AI"  ─┐
  /simulations/[id] "Re-run"     ─┼─> POST /v1/simulations
                                  │
API (FastAPI)                     │
  app/api/v1/simulations.py ──────┘
      │
      ├─ optional: AI planner (model + parameters + title + report seed)
      ├─ simulation_engine.runner.run_model
      │      └─ model registry: accessibility | greenspace | traffic_sumo | cost
      ├─ build_passport
      ├─ reporting_engine.economics.compute_economics
      ├─ optional: AI report composer (uses actual metrics/economics)
      └─ repository.create_run (DB, memory fallback)
             │
             └─> GET /v1/simulations, GET /v1/simulations/{id}
                    GET /v1/impact/{run_id}
```

Relevant code:

| Concern | File |
| --- | --- |
| HTTP endpoints | `apps/api/app/api/v1/simulations.py`, `apps/api/app/api/v1/impact.py`, `apps/api/app/api/v1/models.py` |
| Orchestration | `apps/api/app/api/v1/simulations.py` (`create_simulation`) |
| Model registry | `services/simulation_engine/registry.py` |
| Runner / passport | `services/simulation_engine/runner.py` |
| Model specs | `services/simulation_engine/model_spec.py` |
| Models | `services/simulation_engine/models/` |
| AI planner | `services/ai_engine/policy_planner.py` |
| AI report composer | `services/ai_engine/report_composer.py` |
| Economics | `services/reporting_engine/economics.py` |
| Impact report | `services/reporting_engine/impact.py` |
| Persistence | `apps/api/app/repositories/simulations.py` |
| DB entity | `apps/api/app/models/entities.py` (`SimulationRun`) |
| Web list/detail | `apps/web/app/simulations/page.tsx`, `apps/web/app/simulations/[id]/page.tsx` |
| Web creation | `apps/web/app/policies/[id]/page.tsx` |

## 3. Entry points

### 3.1 Web

- **Create from a policy.** `/policies/[id]` builds a request from the policy factors,
  optional area and budget, then posts it with `use_ai: true` and
  `compare_baseline: true`. On success the browser is routed to
  `/simulations/{run_id}`.
- **Re-run.** `/simulations/[id]` rebuilds a request from the stored run. If the run
  used AI, it sends `model: ""`, `parameters: {}` and `use_ai: true` so the planner
  can choose again. Otherwise it sends the stored model and parameters.
- **List.** `/simulations` calls `GET /v1/simulations` and shows status, model,
  metrics and links to detail and impact pages.

The web client calls `/v1/...` through the same-origin `/api` rewrite (see
`apps/web/next.config.ts` and `packages/api-client/src/index.ts`).

### 3.2 API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/v1/models` | Return all `ModelSpec` entries from the registry |
| `GET` | `/v1/simulations?policy_id=` | List runs, newest first |
| `GET` | `/v1/simulations/{id}` | Fetch one run |
| `POST` | `/v1/simulations` | Execute and persist a run |
| `GET` | `/v1/impact/{run_id}` | Build the six-dimension impact report |

All responses use the standard envelope (`ok`, `data`, `meta`) produced by
`app/envelope.py`.

## 4. Creating a run: request lifecycle

`POST /v1/simulations` accepts:

```json
{
  "model": "greenspace",
  "parameters": { "area_id": "exarchia", "population": 10000 },
  "policy_id": "optional-policy-id",
  "area": "optional area name",
  "changes": "optional free-text change description",
  "compare_baseline": true,
  "budget_eur": 250000,
  "use_ai": false
}
```

`model` is allowed to be empty when `use_ai` is true: the planner chooses it.

The handler performs these steps in order:

1. **Load the policy.** If `policy_id` is present, fetch it. A lookup failure is
   logged and ignored; the run continues.
2. **Resolve the budget.** Prefer the request's `budget_eur`, otherwise fall back to
   the policy budget.
3. **Optional AI planning.** If `use_ai` is true, call
   `plan_policy_simulation(...)` with the policy title, description, changes,
   category, area, horizon, factors, supplied parameters, budget and optional model.
   The planner returns a model, parameters, localized title and reasons, tax
   assumptions, report seed content and confidence. The planner's model and
   parameters replace the request's values.
4. **Attach the area.** If `area` is supplied and `parameters.area_id` is absent, set
   `parameters["area_id"] = area`.
5. **Execute.** Call
   `run_model(model_name, parameters, compare_baseline=...)`. This call is wrapped in
   a `try/except` as belt-and-braces, but the runner itself is designed not to raise.
6. **Build a passport.** Use the passport returned by the runner when present;
   otherwise call `build_passport(model_name, parameters, seed=...)`. Passport
   construction is also failure-tolerant.
7. **Build results for successful runs.** For `status == "succeeded"`:
   - copy `metrics`, `baseline` and `uncertainty`,
   - compute economics via `compute_economics(...)`,
   - if an AI plan exists and `ai_used` is true, call
     `compose_simulation_report(...)` with the actual metrics, baseline,
     uncertainty, economics, passport and warnings; merge the composed sections,
     metrics and impact estimates into the plan,
   - store the plan under `results.ai`.
8. **Assemble the run record.** Include id, policy id, model name/version, merged
   parameters, results, passport, status, error, seed, assumptions, warnings, logs
   and `created_at`.
9. **Persist.** Call `simulations_repo.create_run(run)`. Database errors fall back to
   memory and never produce a 500.
10. **Return** the persisted run in the response envelope.

### Status semantics

- `succeeded`: the model ran and returned metrics.
- `failed`: unknown model or execution error. The record is still created and
  returned; `error` holds the first warning.

The HTTP response remains `ok: true` even for a failed run, so the UI can display
the failure as data rather than as a transport error.

## 5. Deterministic execution

`services/simulation_engine/runner.py`:

- resolves the model class from `MODELS`,
- reads its `SPEC`,
- merges defaults with supplied parameters, coercing types and clamping numeric
  values to each parameter's `min`/`max`,
- runs the model with the seed (`42` by default),
- when `compare_baseline` is true, runs the same model again with pure defaults and
  stores those metrics as `baseline`,
- returns `metrics`, `baseline`, `uncertainty`, `assumptions`, `warnings`, `logs`
  and `seed`.

Logs include the model name/version, seed, a SHA-256 of the canonical merged
parameters and the sorted metric keys. Canonical JSON is
`json.dumps(..., sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)`.

### Passport

`build_passport(...)` returns:

| Field | Meaning |
| --- | --- |
| `model_name`, `model_version` | Registry identity; version is `"unknown"` for unknown models |
| `data_sources` | Snapshot sources when available, otherwise deterministic synthetic fixtures |
| `assumptions` | The model class's `ASSUMPTIONS` list |
| `reliability_limits` | Standard caveat about planning-grade estimates |
| `uncertainty` | Explanation of the uncertainty band |
| `validated_by` | `null` until a human validates the model |
| `executed_at` | UTC timestamp when the passport is built |
| `seed` | Seed used for the run |
| `inputs_checksum` | SHA-256 of the canonical supplied parameters |

## 6. Model catalog

All models live in `services/simulation_engine/models/` and expose a `SPEC`
(`ModelSpec`) plus a `run(parameters, snapshot=None, seed=42)` method.

### `accessibility` (v1.0.0, mobility)

Walk accessibility: share of population within a maximum walking distance of
facilities.

| Parameter | Type | Default | Range |
| --- | --- | --- | --- |
| `area_id` | str | `exarchia` | known area id or fallback center |
| `max_walk_m` | int | `500` | 100-5000 |
| `facility_count` | int | `8` | 0-200 |
| `population` | int | `10000` | 100-1,000,000 |

Uses area centers and haversine distance; unknown areas fall back to a default
center with a warning.

### `greenspace` (v1.0.0, environment)

Green space per capita and share of population within 300 m of a park.

| Parameter | Type | Default | Range |
| --- | --- | --- | --- |
| `area_id` | str | `exarchia` | known area id or fallback center |
| `population` | int | `10000` | 100-1,000,000 |
| `park_count` | int | `6` | 0-200 |
| `avg_park_m2` | float | `5000` | 0-10,000,000 |

### `traffic_sumo` (v1.0.0, mobility)

Effect of traffic interventions on travel time, queues, emissions and noise.

| Parameter | Type | Default | Range |
| --- | --- | --- | --- |
| `intervention` | str | `open` | `open`, `congestion_charge`, `pedestrianize`, `closed` |
| `demand` | int | `1200` | 0-10,000 vehicles/hour |
| `capacity` | int | `1600` | 100-10,000 vehicles/hour |

Checks for SUMO/sumolib and records the result in logs and assumptions. The current
implementation computes the deterministic queueing/BPR approximation in all cases;
it does not launch SUMO. When SUMO is unavailable it also adds a fallback warning.

### `cost` (v1.0.0, economy)

Expected, low and high project cost from unit cost and quantity.

| Parameter | Type | Default | Range |
| --- | --- | --- | --- |
| `unit_cost_eur` | float | `250` | 0-10,000,000 |
| `length_m` | int | `1000` | 0-1,000,000 |
| `area_m2` | int | `0` | 0-10,000,000 |
| `contingency_pct` | float | `10` | 0-100 |

## 7. AI passes

Both AI passes are optional. `get_provider(get_settings())` supplies the configured
LLM provider.

### 7.1 Planner (before the run)

`services/ai_engine/policy_planner.py::plan_policy_simulation`

Inputs: policy text, factors, supplied parameters, area, budget and optional model.

Outputs:

- localized `title`,
- one `model` from the catalog,
- `model_reason`,
- validated `parameters`,
- normalized `factors`,
- `tax` assumptions (default proxy: EUR 1,600 per new building per year, adjusted by
  `tax_change_pct`),
- a bilingual `report` seed (`summary`, `findings`, `risks`),
- `confidence` and `assumptions`,
- `ai_used` flag.

The planner validates model names and parameter names, clamps numeric values,
normalizes localized strings and rejects invalid JSON. Provider failures, timeouts
(150 s) and invalid output produce a deterministic fallback plan so the run still
executes.

### 7.2 Report composer (after the run)

`services/ai_engine/report_composer.py::compose_simulation_report`

Inputs: the policy, the plan, actual metrics, baseline, uncertainty, economics,
passport and warnings.

Outputs (all optional):

- localized `title` and `model_reason`,
- flexible `sections` containing blocks:
  `kpis`, `chart` (bar/line/donut), `table`, `text`, `findings`, `risks`,
- extra `metrics`,
- AI `impact` estimates for the six dimensions.

Normalization caps what is accepted: at most 6 sections, 8 blocks per section,
24 chart labels, 4 datasets, 8 table columns and 12 rows (the prompt asks the model
for tighter limits). The composer has a 180 s timeout and returns `None` on any
failure. A `None` result leaves the planner's
report seed and the deterministic panels intact.

## 8. Economics

`services/reporting_engine/economics.py::compute_economics` is deterministic and
never calls an LLM. It converts model outputs into planning estimates:

- capital cost (`capex_eur`, low/high range),
- annual maintenance,
- annual benefit lines,
- annual tax revenue from new buildings (when supplied by the planner),
- net annual benefit,
- benefit-cost ratio,
- payback years,
- confidence and value-for-money verdict.

Cost bases by model:

- `cost`: uses the model's own expected/low/high cost.
- `greenspace`: green area delta (or total) at EUR 95/m2.
- `accessibility`: facilities delta (or total) at EUR 45,000 each.
- `traffic_sumo`: fixed intervention ranges, e.g. congestion charge
  EUR 450k-700k, pedestrianisation EUR 280k-450k, closure EUR 400k-650k.

Benefit lines are derived from baseline deltas (green area, covered population,
travel time, emissions, noise). Economics failure is logged and does not fail the
run.

## 9. Persistence

`apps/api/app/repositories/simulations.py` stores `SimulationRun` rows:

| Column | Contents |
| --- | --- |
| `id` | 32-character run id |
| `policy_id` | optional policy reference |
| `model_name`, `model_version` | executed model identity |
| `parameters` | merged parameters |
| `results` | `metrics`, `baseline`, `uncertainty`, `economics`, optional `ai` |
| `passport` | passport object |
| `status` | `succeeded` or `failed` |
| `error` | first warning for failed runs |
| `seed` | execution seed |
| `created_at` | creation timestamp |

List and detail reads try the database first, then the in-memory table. The list
response includes `meta.limitations` when the DB read degraded. Create failures
fall back to memory. This keeps local development usable without Postgres.

Note: the API response also carries `assumptions`, `warnings` and `logs`, but the
`SimulationRun` entity persists the core fields above; those extra fields are
returned from the freshly built run and are not separate columns.

## 10. Impact report

`GET /v1/impact/{run_id}` loads the run and calls
`services/reporting_engine/impact.py::compute_impact` with:

- metrics (with `run_id`),
- baseline,
- economics,
- `results.ai.impact` when present.

The report has exactly six dimensions:

1. Environment
2. Society
3. Economy
4. Mobility
5. Quality of life
6. Public administration

For each known metric key in `_METRIC_SPECS`, an indicator is created with value,
baseline, delta, direction, unit, confidence `0.7` and `source: "simulation"`.
Economics adds indicators such as capital cost, annual benefit, benefit-cost ratio
and payback with `source: "economics"`. AI estimates are appended only when their
key is not already present, with `source: "ai"` and confidence defaulting to `0.55`.

Duplicate handling: simulation metrics win over economics for overlapping cost
keys; existing indicator names win over AI estimates. A bilingual summary highlights
the largest material change, or states that there was no material change.

Unknown metrics are ignored. This is why adding a new metric to a model requires
adding it to `_METRIC_SPECS` if it should appear in impact reports.

## 11. Web presentation

### Simulations list

`apps/web/app/simulations/page.tsx` loads `GET /v1/simulations`, supports search and
status filtering, and shows the model, status, key metrics and timestamps. Cards use
the shared `DataCard` primitive and stretch to full width.

### Simulation detail

`apps/web/app/simulations/[id]/page.tsx` loads one run and renders:

- status, model, version, seed and timestamps,
- the AI report when `results.ai` contains composed sections (KPIs, charts, tables,
  findings, risks),
- the legacy AI plan panel as a fallback,
- deterministic metrics with baseline deltas and tone-aware badges,
- economics,
- passport, assumptions, warnings and logs,
- a "Re-run" action.

Metric tone (whether an increase is good or bad) comes from
`apps/web/app/_shared/format.ts`. The shared `deltaTone`/`metricTone` helpers use an
explicit polarity map plus hint lists, so e.g. a fall in emissions is green while a
rise in travel time is red.

### Impact page

`apps/web/app/impact/page.tsx` lists completed runs and links to
`/impact/{run_id}`. `apps/web/app/impact/[id]/page.tsx` renders the six dimensions
with per-indicator deltas and a link back to the source simulation.

## 12. Failure and fallback matrix

| Failure | Behavior |
| --- | --- |
| Unknown model | Run persisted as `failed`; warning returned; HTTP 200 envelope |
| Invalid parameter type/value | Coerced and clamped; execution continues |
| Model exception | Runner catches it; run `failed` with warning |
| SUMO unavailable | Deterministic synthetic traffic fallback with warning |
| AI planner failure/timeout | Deterministic fallback plan; run continues |
| AI composer failure/timeout | Composer returns `None`; deterministic/AI-seed report kept |
| Economics failure | Logged; run keeps metrics and passport |
| Database unavailable | In-memory fallback for create/list/detail |
| Missing run on detail/impact | HTTP 404 |

## 13. Adding or changing a model

1. Add a module under `services/simulation_engine/models/` exposing a class with
   `SPEC = ModelSpec(...)`, `ASSUMPTIONS` and
   `run(self, parameters, *, snapshot=None, seed=42)`.
2. Register the class in `services/simulation_engine/registry.py::MODELS`.
3. Add any new metric keys to `services/reporting_engine/impact.py::_METRIC_SPECS`
   with their dimension, localized label and unit.
4. If the model should produce cost/benefit estimates, extend
   `services/reporting_engine/economics.py`.
5. Keep the model deterministic for a given seed and parameter set; derive any
   randomness from the seed.
6. Run the API tests and the web typecheck/lint.

The registry is also seeded into the `model_registry` table at API startup via
`app/repositories/seed.py`, so `/v1/models` and the database catalog stay aligned.

## 14. Local run and verification

Start both processes with `run-dev.bat`, or separately:

```powershell
python -m uvicorn app.main:app --app-dir apps/api --host 127.0.0.1 --port 8000 --reload
npm.cmd run dev
```

Useful checks:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/v1/models
Invoke-RestMethod http://127.0.0.1:8000/v1/simulations

$body = @{
  model = "greenspace"
  parameters = @{ area_id = "exarchia"; population = 10000; park_count = 8 }
  compare_baseline = $true
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/v1/simulations `
  -ContentType "application/json" -Body $body
```

Then open `http://localhost:3000/simulations` and the new run's detail and impact
pages. Repeating the same POST with the same parameters and default seed should
produce identical metrics.
