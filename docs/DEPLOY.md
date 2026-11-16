# Deploy AthenaX

> Concrete deployment for a pilot: **Render (API) + Neon (Postgres/PostGIS) + Vercel (web)**,
> plus a single-host Docker path. Every step below is copy-pasteable; secrets never go in git.
> Authoring machine has no Docker, so image builds are marked as target-machine steps.

## 0. What you need

- A GitHub fork with this repository.
- Accounts: Render (or Fly), Neon (or Supabase), Vercel.
- An OpenAI-compatible LLM key **or** a local Ollama reachable from the API (the product
  degrades with an explicit "AI unavailable" answer; connectors/simulations still work).

## 1. Database (Neon, free tier is enough for a pilot)

1. Create a project, database `athenax`, region `eu-central` (Frankfurt).
2. Enable PostGIS: in the SQL editor run
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
3. Copy the pooled connection string and convert it to the async driver:
   ```
   postgresql+asyncpg://USER:PASSWORD@HOST/DB?ssl=require
   ```
   Keep `?ssl=require`; asyncpg needs it for Neon.

## 2. API (Render)

1. New → **Web Service** → connect the repo.
2. Runtime **Python 3.11**, build command:
   ```bash
   pip install -r requirements.txt
   ```
   start command:
   ```bash
   python -m uvicorn app.main:app --app-dir apps/api --host 0.0.0.0 --port $PORT
   ```
3. Health check path: `/health`.
4. Environment (minimum):
   | Key | Value |
   |---|---|
   | `ATHENAX_ENV` | `production` |
   | `ATHENAX_DATABASE_URL` | the async Neon URL |
   | `ATHENAX_CORS_ORIGINS` | `https://<your-vercel-app>` |
   | `ATHENAX_LLM_PROVIDER` | `openai_compatible` (or `ollama`) |
   | `ATHENAX_LLM_BASE_URL` | provider base URL |
   | `ATHENAX_LLM_API_KEY` | secret |
   | `ATHENAX_LLM_MODEL` | e.g. `gpt-4o-mini` |
   | `ATHENAX_SNAPSHOT_LIVE` | `1` (live Overpass; `0` forces DB/synthetic) |
   | `ATHENAX_DEFAULT_CITY` | `Athens` |
5. Run migrations once from the Render shell (or locally against Neon):
   ```bash
   PYTHONPATH=.:apps/api alembic upgrade head
   ```
6. Verify: `https://<api>/health`, `https://<api>/metrics`, `https://<api>/v1/models`.

> Free-tier cold starts: first request may take 30-60 s. The web app shows skeletons; the
> smoke script retries. For a demo, ping `/health` 5 minutes before.

## 3. Web (Vercel)

1. Import the repo; **Root Directory** = `apps/web` (monorepo). Vercel detects Next.js.
2. Install command (repo root, because of the workspace):
   ```bash
   cd ../.. && npm ci
   ```
   Build command:
   ```bash
   cd ../.. && npm run build --workspace=@athenax/web
   ```
   (Or set Root Directory to the repo root with output `apps/web/.next`; keep it consistent.)
3. Environment (set at **build** time — `NEXT_PUBLIC_*` is inlined):
   ```
   NEXT_PUBLIC_API_BASE_URL=https://<your-render-api>
   ```
4. Deploy, open the app, switch `el/en`, and run the smoke script (below).

## 4. Single-host Docker (alternative)

```powershell
Copy-Item infrastructure\deployment\.env.production.example .env.production
# edit .env.production (DB password, LLM, CORS, API URL)
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d db
$env:PYTHONPATH="$PWD;$PWD\apps/api"; alembic upgrade head
docker compose --env-file .env.production up -d api web
```

Put Nginx/Caddy in front for TLS. Rollback = redeploy the previous image tags; avoid
destructive migrations (prefer additive).

## 5. Smoke test (the acceptance gate)

```powershell
powershell -ExecutionPolicy Bypass -File infrastructure\deployment\smoke.ps1 `
  -ApiBase https://<api> -WebBase https://<web>
```

It checks: `/health` → `/v1/sources` → ingest → `/v1/ai/query` → policy → simulation →
simulation detail → **reproduce** → `/v1/impact/{id}` → export → `/metrics`.
A failure exits non-zero and prints the failing step.

## 6. Observability & evidence

- `GET /metrics` — Prometheus text: request count/latency, connector health gauges, DB status.
  Scrape it from Grafana Cloud / Uptime Kuma if desired; no agent required.
- `GET /health` — dependency matrix (`ok` / `degraded` / `down` / `disabled`).
- `python scripts/connector_health.py` — writes `docs/evidence/connector-health.md`.
- `python scripts/validate_model.py` — writes `docs/evidence/model-sensitivity.md`.
- `python scripts/ai_eval.py --base-url https://<api>` — writes `docs/evidence/ai-eval.md`
  (needs a working LLM key).

## 7. BYO city (second deployment)

```bash
ATHENAX_CATALOG_FILE=data/source-registry/catalog.berlin.yaml
```

Restart the API. The source registry, city centre and intervention areas come from the pack;
the same models and UI run unchanged. See `data/source-registry/catalog.berlin.yaml`.
A real second deployment should also re-run the connector health report and the AI eval, and
record both in `docs/evidence/`.

## 8. Known limitations (honest)

- The API is stateless and runs the model in-process; long AI calls should stay behind a
  request timeout (default 120 s on the smoke script).
- No background queue is required for the pilot; add Redis/Celery only when concurrent load
  demands it.
- `ATHENAX_SNAPSHOT_LIVE=0` is the hermetic mode for CI and for air-gapped demos.
- Free tiers sleep; the first request after idle is slow. Pre-warm before a demo.
