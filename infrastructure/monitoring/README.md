# infrastructure/monitoring — observability (opt-in)

POLICYLAB ships a **minimal OpenTelemetry Collector config** and documents how tracing *would* be
enabled. Observability is deliberately **off by default**: the MVP must run with zero extra
dependencies (contracts §0: no new deps).

## What is here

| File | Purpose |
|---|---|
| `otel-collector-config.yaml` | OTLP receiver (gRPC `:4317`, HTTP `:4318`) → `logging` exporter (stdout). Traces only. |

## Status of OpenTelemetry in this repo

- **The `opentelemetry-*` Python packages are NOT installed.** `requirements.txt` /
  `requirements-dev.txt` contain no OpenTelemetry entry, and adding one requires orchestrator
  approval (see `docs/ai-development-master-prompt.md`, hard guardrails).
- **Instrumentation hooks are documented, not active.** If/when the packages are approved, the
  integration points are:
  - `apps/api/app/main.py` — FastAPI app: `opentelemetry.instrumentation.fastapi.FastAPIInstrumentor.instrument_app(app)`
  - `services/connector_kit/base.py` — outbound HTTP: `opentelemetry.instrumentation.httpx.HTTPXClientInstrumentor().instrument()`
  - `services/ai_engine/orchestrator.py` — one span per `answer_question()` call
    (`tracer.start_as_current_span("ai.answer")`) with attributes `ai.provider`, `ai.model`,
    `ai.record_count`.
- **The exporter is off by default.** Even with the packages present, export only happens when the
  standard OTEL env vars point at a collector (`OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`,
  `OTEL_TRACES_EXPORTER=otlp`). Never set these in `docker-compose.yml` defaults.

## Enabling tracing (when approved)

1. Install (requires approval): `opentelemetry-api`, `opentelemetry-sdk`,
   `opentelemetry-instrumentation-fastapi`, `opentelemetry-instrumentation-httpx`,
   `opentelemetry-exporter-otlp`.
2. Start the collector:

   ```powershell
   docker run --rm -p 4317:4317 -p 4318:4318 `
     -v ${PWD}/infrastructure/monitoring/otel-collector-config.yaml:/etc/otelcol/config.yaml `
     otel/opentelemetry-collector:latest
   ```

3. Set env on the API process (all `POLICYLAB_` settings live in `.env.example`; OTEL uses the
   standard unprefixed names because they belong to the OTel SDK, not to our settings class):

   ```powershell
   $env:OTEL_SERVICE_NAME = "policylab-api"
   $env:OTEL_TRACES_EXPORTER = "otlp"
   $env:OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318"
   $env:OTEL_EXPORTER_OTLP_PROTOCOL = "http/protobuf"
   python -m uvicorn app.main:app --app-dir apps/api --reload
   ```

4. Verify: spans appear in the collector's stdout (logging exporter).

> Note: on OpenTelemetry Collector ≥ v0.100 the `logging` exporter was replaced by `debug`.
> If the collector refuses to start, rename `logging` → `debug` and set `verbosity: normal`.
> The config here uses `logging` because it remains the canonical "basic" example.

## What we do instead (MVP)

- **Health endpoint** `GET /health` → `{db, llm, storage, rate_limiter}` each
  `ok|degraded|down|disabled` (contracts §2) — surfaced as a health chip in the UI nav.
- **Audit logs** table `audit_logs` (method, path, status, ip, created_at) exposed via
  `GET /v1/admin/audit`.
- **Connector health** per source (`POST /v1/sources/{id}/health`, `Source.status`).
- **Simulation logs** persisted on each `SimulationRun` (`logs: string[]`).

These give request-level and pipeline-level visibility without any tracing dependency.
