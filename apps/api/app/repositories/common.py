"""Shared repository helpers: in-memory fallback store, serialization, ids.

Tests never need a real DB: every repository degrades to in-memory/YAML data.
"""
from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

logger = logging.getLogger("policylab.repositories")

# table -> id -> row (in-memory fallback when the DB is unavailable)
MEM: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)


def new_id() -> str:
    return uuid4().hex


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def iso(value: Any) -> str | None:
    """Serialize datetimes/strings to ISO-8601 (JSON-safe)."""
    if value is None:
        return None
    if isinstance(value, datetime):
        dt = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        return dt.isoformat()
    return str(value)


def as_json(value: Any, default: Any = None) -> Any:
    """Coerce DB JSON columns (or None) into plain JSON-serializable data."""
    if value is None:
        return default
    if isinstance(value, (dict, list, str, int, float, bool)):
        return value
    try:
        import json

        return json.loads(value)
    except (ValueError, TypeError):
        return default


def mem_put(table: str, row: dict[str, Any]) -> dict[str, Any]:
    MEM[table][str(row.get("id"))] = row
    return row


def mem_get(table: str, row_id: str) -> dict[str, Any] | None:
    return MEM[table].get(str(row_id))


def mem_list(table: str) -> list[dict[str, Any]]:
    return list(MEM[table].values())


def mem_clear() -> None:
    MEM.clear()


def repo_root() -> Path:
    """Repo root resolved by walking up until data/source-registry/catalog.yaml is found.

    NOTE (verified): for apps/api/app/repositories/x.py the literal parents[3] is
    `apps/`, not the repo root (parents[4] is) — we resolve robustly instead.
    """
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "data" / "source-registry" / "catalog.yaml").exists():
            return parent
    return here.parents[4]
