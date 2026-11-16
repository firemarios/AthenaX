# infrastructure/docker — image builds

AthenaX ships **two application images** built from the repo root (build context `.`), plus the
database image pulled from Docker Hub. This folder documents how they are built and how the
root [`.dockerignore`](../../.dockerignore) applies.

## Build targets

| Image | Dockerfile | Context | Exposed port | Notes |
|---|---|---|---|---|
| `athenax-api` | `apps/api/Dockerfile` (owned by backend agent B) | repo root | `8000` | FastAPI + uvicorn; runs Alembic migrations on start or via `alembic upgrade head` |
| `athenax-web` | `apps/web/Dockerfile` (owned by frontend agent D) | repo root | `3000` | Next.js 16 production build (`next start`) |
| `db` | none (image `postgis/postgis:16-3.4`) | — | `5432` | `CREATE EXTENSION IF NOT EXISTS postgis;` only — **no pgvector** (contracts §9.3) |

Both Dockerfiles may not exist yet while the repo is being built in parallel — `docker compose up`
fails with a clear "dockerfile not found" until they land. Compose references them anyway so the
wiring is final.

## Commands

```powershell
# Build both app images (no run)
docker compose build

# Build one service only
docker compose build api
docker compose build web

# Full core stack (db healthy → api → web)
docker compose up -d --build

# Optional profile: adds redis + minio
docker compose --profile full up -d --build
```

## `.dockerignore` policy

There is a **single root `.dockerignore`** (repo root) shared by both builds — one context, one
ignore file, no drift. It excludes:

- `node_modules`, `.next`, build artifacts (each image installs/builds its own),
- `.env*` files (except `*.example`) — **secrets are injected by compose at run time, never baked in**,
- `docs/`, `research/`, `infrastructure/monitoring/`, `infrastructure/deployment/`, `docker-compose.yml` —
  not needed inside runtime images,
- `storage/`, `__pycache__`, test caches.

**Kept** (needed at build/run time): `apps/`, `packages/`, `services/`, `data/`,
`infrastructure/database/` (Alembic migrations), `requirements*.txt`, `pyproject.toml`,
`package*.json`, `next.config.*`, `tailwind`/`tsconfig` files.

If you need an extra per-image ignore rule, add it to the root `.dockerignore` with a comment —
do **not** create a second ignore file (they cannot be scoped per Dockerfile anyway).

## Environment injection

- Local dev: compose hard-codes safe defaults (`postgres:postgres@db:5432/athenax`).
- Production: use [`../deployment/.env.production.example`](../deployment/.env.production.example)
  as the template; never commit a real `.env`.
- The API reaches a host-level Ollama through `http://host.docker.internal:11434`
  (`extra_hosts: host-gateway` is set on the `api` service for Linux hosts).

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `open apps/api/Dockerfile: no such file` | backend agent's Dockerfile not written yet | wait for `apps/api/Dockerfile` |
| `db` unhealthy, logs mention vector | wrong image/env | ensure `postgis/postgis:16-3.4`, no `shared_preload_libraries` |
| web container can't reach API | browser-side URL | `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` must be the **host** URL (public env, inlined at build) |
| api can't reach Ollama | host service not running / Linux | start Ollama on the host; `host-gateway` extra_host is already configured |
