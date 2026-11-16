"""Ingestion pipeline (contract §5.3): clean_record + async ingest (never raises)."""
from __future__ import annotations

import inspect
import json
import logging
from typing import Any

from services.connector_kit.base import NormalizedRecord, utcnow

logger = logging.getLogger("athenax.ingest")

_MAX_KEY_LEN = 120
_MAX_STR_LEN = 10_000


def clean_record(raw: dict) -> dict:
    """Strip strings, drop empties/None, dedupe keys (first wins), cap sizes."""
    if not isinstance(raw, dict):
        return {}
    cleaned: dict[str, Any] = {}
    for key, value in raw.items():
        if not isinstance(key, str):
            key = str(key)
        key = key.strip()[:_MAX_KEY_LEN]
        if not key or key in cleaned:
            continue
        if value is None:
            continue
        if isinstance(value, str):
            value = value.strip()
            if not value:
                continue
            if len(value) > _MAX_STR_LEN:
                value = value[:_MAX_STR_LEN]
        elif isinstance(value, (list, tuple)):
            items = list(value)
            if not items:
                continue
            value = items
        elif isinstance(value, dict):
            if not value:
                continue
        elif isinstance(value, bool):
            pass
        elif isinstance(value, (int, float)):
            pass
        else:
            value = str(value)
        cleaned[key] = value
    return cleaned


def _record_payload(record: Any) -> dict:
    if isinstance(record, NormalizedRecord):
        return record.to_dict()
    if isinstance(record, dict):
        return dict(record)
    return {"title": str(record)}


async def ingest(
    connector: Any,
    *,
    query: str | None = None,
    limit: int = 50,
    store: Any = None,
    persist: Any = None,
) -> dict[str, int]:
    """connector.search → optional persist callback → optional ObjectStore snapshot.

    Returns {"ingested": int, "skipped": int, "errors": int}. Never raises.
    """
    ingested = 0
    skipped = 0
    errors = 0

    try:
        records = await connector.search(query=query, limit=limit)
    except Exception as exc:  # noqa: BLE001 — search should never raise; be extra safe
        logger.warning("ingest: search failed on %s: %s", getattr(connector, "name", "?"), exc)
        records = []
        errors += 1

    if not records:
        return {"ingested": 0, "skipped": 0, "errors": errors}

    if persist is not None:
        try:
            result = persist(records)
            if inspect.isawaitable(result):
                result = await result
            ingested = int(result)
        except Exception as exc:  # noqa: BLE001
            logger.warning("ingest: persist failed on %s: %s", getattr(connector, "name", "?"), exc)
            ingested = 0
            errors += 1
        skipped = max(0, len(records) - ingested)
    else:
        ingested = len(records)

    if store is not None:
        try:
            payload = {
                "connector": getattr(connector, "name", None),
                "query": query,
                "count": len(records),
                "retrieved_at": utcnow().isoformat(),
                "records": [_record_payload(r) for r in records],
            }
            data = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
            stamp = utcnow().strftime("%Y%m%dT%H%M%S%f")
            name = str(getattr(connector, "name", "unknown")).strip() or "unknown"
            store.put(f"snapshots/{name}/{stamp}.json", data)
        except Exception as exc:  # noqa: BLE001
            logger.warning("ingest: snapshot store failed: %s", exc)
            errors += 1

    return {"ingested": ingested, "skipped": skipped, "errors": errors}
