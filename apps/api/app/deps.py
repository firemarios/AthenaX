"""Shared FastAPI dependencies: get_settings, get_session, get_request_id (contract §1)."""
from __future__ import annotations

import logging
from uuid import uuid4

from app.config import get_settings  # noqa: F401 — re-exported per contract
from app.database import AsyncSessionLocal
from fastapi import Request

logger = logging.getLogger("athenax.deps")

__all__ = ["get_settings", "get_session", "get_request_id"]


async def get_session():  # noqa: ANN202 — AsyncIterator[AsyncSession | None]
    """Yield a DB session or None. NEVER raises (DB may be down)."""
    if AsyncSessionLocal is None:
        yield None
        return
    session = AsyncSessionLocal()
    try:
        yield session
    except Exception as exc:  # noqa: BLE001
        logger.warning("get_session: %s", exc)
    finally:
        try:
            await session.close()
        except Exception:  # noqa: BLE001
            pass


def get_request_id(request: Request) -> str:
    """Request id set by the audit middleware (generated on demand)."""
    request_id = getattr(request.state, "request_id", None)
    if not request_id:
        request_id = uuid4().hex
        request.state.request_id = request_id
    return str(request_id)
