"""Audit middleware: request_id assignment + audit_logs persistence (contract §1).

Writes method/path/status/ip/request_id to the `audit_logs` table when the DB works;
otherwise falls back to an in-memory buffer + structured logger. Never raises.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("policylab.audit")

_AUDIT_EXEMPT = {"/health", "/openapi.json", "/docs", "/redoc", "/docs/oauth2-redirect"}


def _ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


async def record_audit(
    method: str, path: str, status: int, ip: str | None, request_id: str
) -> None:
    """Append one audit row — DB first, else buffer + structured log. Never raises."""
    try:
        from app.database import session_scope
        from app.models import AuditLog

        async with session_scope() as session:
            session.add(
                AuditLog(
                    id=uuid4().hex,
                    method=method,
                    path=path,
                    status=int(status),
                    ip=ip,
                    request_id=request_id,
                )
            )
        return
    except Exception:  # noqa: BLE001 — audit must never break a response
        pass
    try:
        from app.repositories import admin as admin_repo

        admin_repo.append_audit(
            {
                "id": uuid4().hex,
                "method": method,
                "path": path,
                "status": int(status),
                "ip": ip,
                "request_id": request_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
    except Exception:  # noqa: BLE001
        pass
    logger.info(
        "audit method=%s path=%s status=%s ip=%s request_id=%s",
        method,
        path,
        status,
        ip,
        request_id,
    )


def create_audit_middleware():  # noqa: ANN201 — returns an ASGI dispatch callable
    async def dispatch(request: Request, call_next):  # noqa: ANN001, ANN202
        request_id = (request.headers.get("x-request-id") or "").strip() or uuid4().hex
        request.state.request_id = request_id
        response = await call_next(request)
        path = request.url.path
        if path not in _AUDIT_EXEMPT and not path.startswith(("/static", "/assets")):
            try:
                await record_audit(
                    request.method, path, response.status_code, _ip(request), request_id
                )
            except Exception:  # noqa: BLE001 — never break the response path
                logger.warning("Αποτυχία καταγραφής audit", exc_info=True)
        return response

    return dispatch


def audit_middleware():  # noqa: ANN201
    return BaseHTTPMiddleware(dispatch=create_audit_middleware())
