"""Response envelope helpers (contract §1).

Every HTTP endpoint returns:
  {"ok": true,  "data": <T|null>, "meta": {...}|null, "error": null}
  {"ok": false, "data": null, "meta": null, "error": {"code", "message", "details"?}}
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

DB_DOWN_NOTE = (
    "Η βάση δεδομένων δεν είναι διαθέσιμη — επιστρέφονται προσωρινά ελάχιστα δεδομένα."
)


def ok(data: Any = None, meta: dict | None = None) -> dict[str, Any]:
    return {"ok": True, "data": data, "meta": meta, "error": None}


def fail(code: int, message: str, details: list[dict] | None = None) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message}
    if details:
        error["details"] = details
    return {"ok": False, "data": None, "meta": None, "error": error}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_meta(request_id: str | None = None, **extra: Any) -> dict[str, Any]:
    """meta = {request_id, timestamp, ...extras (None values dropped)}."""
    meta: dict[str, Any] = {
        "request_id": request_id or uuid4().hex,
        "timestamp": now_iso(),
    }
    for key, value in extra.items():
        if value is not None:
            meta[key] = value
    return meta
