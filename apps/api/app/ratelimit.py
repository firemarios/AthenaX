"""Per-IP in-memory sliding-window rate limiting (contract §1).

Pure in-memory — NO redis import (POLICYLAB_REDIS_URL only logs a notice).
Exempt: /health, /openapi.json, /docs, static, OPTIONS preflights.
"""
from __future__ import annotations

import logging
import time
from collections import deque

from app.config import get_settings
from app.envelope import fail
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("policylab.ratelimit")

EXEMPT_PATHS = {"/health", "/openapi.json", "/docs", "/redoc", "/docs/oauth2-redirect"}
EXEMPT_PREFIXES = ("/static", "/assets")
RATE_LIMIT_MESSAGE = "Πολλά αιτήματα. Δοκιμάστε ξανά σύντομα."


class SlidingWindowLimiter:
    """Fixed-window-safe sliding window: deque of monotonic timestamps per key."""

    def __init__(self, window: float = 60.0) -> None:
        self.window = window
        self._hits: dict[str, deque[float]] = {}

    def reset(self) -> None:
        self._hits.clear()

    def allow(self, key: str, limit: int, now: float | None = None) -> bool:
        if limit <= 0:
            return True
        now = time.monotonic() if now is None else now
        hits = self._hits.setdefault(key, deque())
        cutoff = now - self.window
        while hits and hits[0] <= cutoff:
            hits.popleft()
        if len(hits) >= limit:
            return False
        hits.append(now)
        return True


limiter = SlidingWindowLimiter()
_redis_notice_logged = False


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def is_exempt(request: Request) -> bool:
    path = request.url.path
    if request.method == "OPTIONS":
        return True
    if path in EXEMPT_PATHS:
        return True
    return path.startswith(EXEMPT_PREFIXES)


def create_rate_limit_middleware():  # noqa: ANN201 — returns an ASGI dispatch callable
    async def dispatch(request: Request, call_next):  # noqa: ANN001, ANN202
        global _redis_notice_logged
        settings = get_settings()
        if (settings.redis_url or "").strip() and not _redis_notice_logged:
            _redis_notice_logged = True
            logger.info(
                "POLICYLAB_REDIS_URL ορίστηκε — χρήση in-memory rate limiting (δεν εισάγεται redis)."
            )
        if not is_exempt(request):
            allowed = limiter.allow(client_ip(request), int(settings.rate_limit_per_minute or 0))
            if not allowed:
                return JSONResponse(status_code=429, content=fail(429, RATE_LIMIT_MESSAGE))
        return await call_next(request)

    return dispatch


def rate_limit_middleware():  # noqa: ANN201
    return BaseHTTPMiddleware(dispatch=create_rate_limit_middleware())
