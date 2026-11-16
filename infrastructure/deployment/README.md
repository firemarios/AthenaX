# infrastructure/deployment — environments & runbook

## Environments

| | Development | Staging | Production |
|---|---|---|---|
| Config file | `.env` (from repo-root `.env.example`) | `.env.staging` | `.env.production` (from [`.env.production.example`](.env.production.example)) |
| `ATHENAX_ENV` | `development` | `staging` | `production` |
| DB | `docker compose up -d db` (local PostGIS) | managed PostGIS or compose on a staging host | managed PostgreSQL + PostGIS (HA recommended) |
| API | `python -m uvicorn app.main:app --app-dir apps/api --reload` | uvicorn behind reverse proxy, no `--reload` | uvicorn/gunicorn workers behind HTTPS reverse proxy |
| Web | `npm.cmd dev` (Turbopack dev) | `npm.cmd build && npm.cmd start` | `npm.cmd build && npm.cmd start` (or `next start` in Docker) |
| LLM | local Ollama (`http://localhost:11434`) | `ATHENAX_LLM_BASE_URL` to a private endpoint | private endpoint; `ATHENAX_LLM_API_KEY` from a secret store |
| Redis / MinIO | optional `--profile full` | optional | optional — code degrades to in-memory / `./storage` |
| Telemetry | off | off (collector optional) | off unless OTel packages approved — see `infrastructure/monitoring/README.md` |

**Rules:** no secrets in git (`.env*` is git-ignored except `*.example`); every setting uses the
`ATHENAX_` prefix; `NEXT_PUBLIC_*` values are fixed at **build** time.

## Runbook — development (Docker path)

```powershell
# 1. db up (PostGIS; init scripts mounted from infrastructure/database/init-db)
docker compose up -d db

# 2. migrations (repo root; PYTHONPATH includes apps/api)
$env:PYTHONPATH = "$PWD;$PWD\apps/api"
alembic upgrade head          # or: python -m alembic upgrade head

# 3. API — verified uvicorn flags: --app-dir, --reload
python -m uvicorn app.main:app --app-dir apps/api --reload
#    → http://localhost:8000/docs   (OpenAPI + Swagger, public)

# 4. Web (separate terminal, repo root)
npm.cmd install
npm.cmd dev                   # → http://localhost:3000
```

Or simply:

```powershell
powershell -ExecutionPolicy Bypass -File infrastructure\deployment\dev.ps1 -Web
```

Optional extras:

```powershell
docker compose --profile full up -d   # + redis + minio (9000/9001, minioadmin/minioadmin)
docker compose ps                     # health at a glance
docker compose logs -f api
docker compose down                   # stop (data volume kept)
docker compose down -v                # stop and DELETE the db volume
```

## Runbook — staging / production

1. Provision PostgreSQL 16 + PostGIS 3.4; create db `athenax`; run
   `CREATE EXTENSION IF NOT EXISTS postgis;` (no pgvector).
2. Copy `.env.production.example` → `.env.production`, fill values, keep out of git.
3. Build images: `docker compose build` (or per-service CI builds of
   `apps/api/Dockerfile` and `apps/web/Dockerfile`).
4. Migrate: `alembic upgrade head` (run once per release, before switching traffic).
5. Start: `docker compose up -d` (core: db + api + web; add `--profile full` only if
   Redis/MinIO are required).
6. Smoke checks:
   - `GET /health` on `:8000` → every dependency `ok|degraded|down|disabled`,
   - `GET /openapi.json` reachable,
   - web loads, language toggle el/en works, `Ctrl+K` search hits `/ask`,
   - `GET /v1/sources` returns data (YAML fallback works even if the DB is down).
7. Rollback: redeploy previous image tags; `alembic downgrade -1` only if the release
   included a destructive migration (avoid them).

## Verification checklist (no Docker on the authoring machine)

- [x] `python -c "import yaml; yaml.safe_load(open('docker-compose.yml'))"` parses
- [x] `infrastructure/deployment/dev.ps1` flag names verified against uvicorn CLI
      (`--app-dir`, `--reload`, `--host`, `--port`)
- [ ] `docker compose config` / actual image builds — **not validated here** (no Docker on
      the authoring machine); run on the target machine before first deploy.
