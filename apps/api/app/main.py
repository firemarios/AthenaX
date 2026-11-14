"""POLICYLAB FastAPI application (contracts §1 envelope/middleware, §2 endpoints).

Startup NEVER fails: DB init, registry seed and LLM ping are all non-fatal.
"""
from __future__ import annotations

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from typing import Any

from app.api.v1.router import ROUTE_CATALOG, api_router
from app.audit import create_audit_middleware
from app.config import API_VERSION, get_settings
from app.database import init_db, ping_db
from app.deps import get_request_id
from app.envelope import build_meta, ok
from app.errors import register_error_handlers
from app.metrics import create_metrics_middleware, render_metrics
from app.ratelimit import create_rate_limit_middleware
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from starlette.middleware.base import BaseHTTPMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("policylab")

LLM_PING_TIMEOUT = 5.0
LLM_CACHE_TTL = 30.0
_llm_cache: dict[str, Any] = {"value": None, "at": 0.0}


async def _llm_status(*, refresh: bool = False) -> str:
    """ok | degraded | down — never raises, bounded by LLM_PING_TIMEOUT and cached."""
    now = time.monotonic()
    if not refresh and _llm_cache["value"] is not None and now - _llm_cache["at"] < LLM_CACHE_TTL:
        return str(_llm_cache["value"])
    status = "down"
    try:
        from services.ai_engine.providers import get_provider

        provider = get_provider(get_settings())
        alive = await asyncio.wait_for(provider.ping(), timeout=LLM_PING_TIMEOUT)
        status = "ok" if alive else "degraded"
    except asyncio.TimeoutError:
        status = "degraded"
    except Exception as exc:  # noqa: BLE001
        logger.info("LLM health: %s", exc)
        status = "down"
    _llm_cache["value"] = status
    _llm_cache["at"] = time.monotonic()
    return status


def _storage_status() -> str:
    try:
        from pathlib import Path

        target = Path(get_settings().storage_dir or "./storage")
        target.mkdir(parents=True, exist_ok=True)
        probe = target / ".healthcheck"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink(missing_ok=True)
        return "ok"
    except Exception as exc:  # noqa: BLE001
        logger.info("storage health: %s", exc)
        return "down"


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ANN001, ANN202
    """init_db → seed registry → LLM ping. Every step is non-fatal (contract §1)."""
    await init_db()
    try:
        from app.repositories.seed import seed_registry

        await seed_registry()
    except Exception as exc:  # noqa: BLE001
        logger.warning("seed_registry μη κρίσιμο σφάλμα: %s", exc)
    logger.info("LLM ping: %s", await _llm_status(refresh=True))
    yield


app = FastAPI(
    title="POLICYLAB",
    version=API_VERSION,
    description="Ψηφιακή δίδυμη πόλη — Open Data, GovTech, City, AI, Policy, Citizen, Research.",
    lifespan=lifespan,
)

# middleware order: metrics (inner) → audit → rate limit → CORS (outermost)
app.add_middleware(BaseHTTPMiddleware, dispatch=create_metrics_middleware())
app.add_middleware(BaseHTTPMiddleware, dispatch=create_audit_middleware())
app.add_middleware(BaseHTTPMiddleware, dispatch=create_rate_limit_middleware())
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)
app.include_router(api_router, prefix="/v1")


@app.get("/", include_in_schema=False)
async def root(request: Request):
    settings = get_settings()
    return ok(
        {
            "name": "POLICYLAB",
            "version": API_VERSION,
            "docs": "/docs",
            "openapi": "/openapi.json",
            "health": "/health",
            "api_base": settings.api_base_url,
            "endpoints": len(ROUTE_CATALOG),
        },
        build_meta(get_request_id(request)),
    )


@app.get("/health")
async def health(request: Request):
    """Component health for the admin/home dashboards (db/llm/storage/rate_limiter)."""
    settings = get_settings()
    db_ok, llm = await asyncio.gather(ping_db(), _llm_status())
    storage = _storage_status()
    data: dict[str, Any] = {
        "status": "ok" if (db_ok and llm == "ok" and storage == "ok") else "degraded",
        "db": "ok" if db_ok else "down",
        "llm": llm,
        "storage": storage,
        "rate_limiter": "ok",
        "version": API_VERSION,
        "env": settings.env,
        "sources": len(ROUTE_CATALOG),
    }
    return ok(data, build_meta(get_request_id(request)))


@app.get("/metrics", include_in_schema=False)
async def prometheus_metrics() -> PlainTextResponse:
    """Prometheus-compatible text metrics — no extra dependencies (Phase 0)."""
    return PlainTextResponse(render_metrics(), media_type="text/plain; version=0.0.4")
