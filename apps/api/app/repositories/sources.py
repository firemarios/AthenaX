"""Sources repository — DB first, YAML catalog fallback (data/source-registry/catalog.yaml).

`list_sources()` reads the DB when possible, else parses the real YAML catalog
(never raises; contract §9.3 — YAML is the fallback for /v1/sources when the DB is down).
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import yaml

from app.database import session_scope
from app.models import DataSource
from app.repositories.common import iso, mem_get, mem_list, mem_put, repo_root

logger = logging.getLogger("policylab.repositories.sources")

_CATALOG_CACHE: dict[str, Any] | None = None
_HEALTH: dict[str, dict[str, Any]] = {}


def catalog_path() -> Path:
    return repo_root() / "data" / "source-registry" / "catalog.yaml"


def load_catalog() -> dict[str, Any]:
    """Parse catalog.yaml (cached). Missing/broken file → {} (never raises)."""
    global _CATALOG_CACHE
    if _CATALOG_CACHE is not None:
        return _CATALOG_CACHE
    try:
        raw = catalog_path().read_text(encoding="utf-8")
        data = yaml.safe_load(raw) or {}
        if not isinstance(data, dict):
            data = {}
    except Exception as exc:  # noqa: BLE001 — YAML fallback must never break the API
        logger.warning("Αδυναμία ανάγνωσης catalog.yaml: %s", exc)
        data = {}
    _CATALOG_CACHE = data
    return data


def catalog_sources() -> list[dict[str, Any]]:
    entries = load_catalog().get("sources") or []
    return [dict(entry) for entry in entries if isinstance(entry, dict) and entry.get("name")]


def catalog_entry(name: str) -> dict[str, Any] | None:
    for entry in catalog_sources():
        if str(entry.get("name")) == str(name):
            return entry
    return None


def _provider_from(base_url: str | None) -> str | None:
    if not base_url:
        return None
    try:
        return urlparse(str(base_url)).netloc or str(base_url)
    except Exception:  # noqa: BLE001
        return str(base_url)


def source_from_entry(entry: dict[str, Any], *, status: str | None = None) -> dict[str, Any]:
    name = str(entry.get("name") or "")
    health = _HEALTH.get(name) or {}
    return {
        "id": name,
        "name": str(entry.get("display_name") or name),
        "provider": _provider_from(entry.get("base_url")),
        "source_type": str(entry.get("source_type") or "open_data"),
        "base_url": entry.get("base_url"),
        "license": entry.get("license"),
        "update_frequency": entry.get("update_frequency"),
        "status": status or health.get("status") or "unknown",
        "reliability": entry.get("reliability"),
        "last_checked_at": health.get("checked_at"),
        "enabled": bool(entry.get("enabled", True)),
        "dataset_count": None,
    }


def source_from_row(row: DataSource) -> dict[str, Any]:
    health = _HEALTH.get(row.name) or {}
    return {
        "id": row.name,
        "name": row.display_name or row.name,
        "provider": row.provider or _provider_from(row.base_url),
        "source_type": row.source_type or "open_data",
        "base_url": row.base_url,
        "license": row.license,
        "update_frequency": row.update_frequency,
        "status": health.get("status") or row.status or "unknown",
        "reliability": row.reliability,
        "last_checked_at": health.get("checked_at") or iso(row.last_checked_at),
        "enabled": bool(row.enabled) if row.enabled is not None else True,
        "dataset_count": None,
    }


def make_connector(name: str):  # noqa: ANN201 — BaseConnector | None
    """Instantiate a connector class from CONNECTOR_CLASSES + YAML entry (contract §5.2)."""
    from services.connector_kit.catalog import CONNECTOR_CLASSES

    cls = CONNECTOR_CLASSES.get(str(name))
    if cls is None:
        return None
    entry = catalog_entry(str(name)) or {}
    return cls(
        endpoint_url=str(entry.get("endpoint_url") or ""),
        enabled=bool(entry.get("enabled", True)),
        config=entry.get("config") or {},
    )


async def enabled_connectors() -> dict[str, bool]:
    """name -> enabled flag (DB → YAML → all-True). Never raises."""
    try:
        items, _, _ = await list_sources()
        return {str(item["id"]): bool(item.get("enabled", True)) for item in items}
    except Exception:  # noqa: BLE001
        return {str(entry["name"]): bool(entry.get("enabled", True)) for entry in catalog_sources()}


async def list_sources(
    source_type: str | None = None, status: str | None = None
) -> tuple[list[dict[str, Any]], int, bool]:
    """(sources, total, degraded). DB first, real YAML catalog fallback."""
    items: list[dict[str, Any]] = []
    degraded = False
    try:
        from sqlalchemy import select

        async with session_scope() as session:
            rows = (await session.execute(select(DataSource).order_by(DataSource.name))).scalars()
            items = [source_from_row(row) for row in rows]
    except Exception as exc:  # noqa: BLE001 — YAML fallback per contract §9.3
        logger.debug("list_sources: DB μη διαθέσιμη (%s) — χρήση YAML καταλόγου", exc)
        degraded = False  # YAML catalog is the designed fallback (data still complete)
        items = [source_from_entry(entry) for entry in catalog_sources()]

    if source_type:
        items = [item for item in items if item.get("source_type") == source_type]
    if status:
        items = [item for item in items if item.get("status") == status]

    # attach dataset counts when the DB is reachable
    try:
        from sqlalchemy import func, select

        from app.models import Dataset

        async with session_scope() as session:
            rows = (
                await session.execute(
                    select(Dataset.source_id, func.count(Dataset.id)).group_by(Dataset.source_id)
                )
            ).all()
            counts = {str(source_id): int(count) for source_id, count in rows}
        for item in items:
            count = counts.get(str(item["id"]))
            if count is not None:
                item["dataset_count"] = count
    except Exception:  # noqa: BLE001
        pass

    return items, len(items), degraded


async def get_source(source_id: str) -> dict[str, Any] | None:
    """Single source by id (== catalog name). DB → YAML. Never raises."""
    try:
        from sqlalchemy import select

        async with session_scope() as session:
            row = (
                await session.execute(select(DataSource).where(DataSource.name == str(source_id)))
            ).scalar_one_or_none()
            if row is not None:
                return source_from_row(row)
    except Exception:  # noqa: BLE001
        pass
    entry = catalog_entry(str(source_id))
    if entry is None:
        return None
    return source_from_entry(entry)


async def update_source_health(source_id: str, health: dict[str, Any]) -> dict[str, Any] | None:
    """Persist a live health check result (memory + DB). Never raises."""
    source_id = str(source_id)
    _HEALTH[source_id] = {
        "status": str(health.get("status") or "unknown"),
        "checked_at": iso(health.get("checked_at")),
        "latency_ms": health.get("latency_ms"),
        "detail": health.get("detail"),
    }
    try:
        from sqlalchemy import select

        async with session_scope() as session:
            row = (
                await session.execute(select(DataSource).where(DataSource.name == source_id))
            ).scalar_one_or_none()
            if row is not None:
                row.status = _HEALTH[source_id]["status"]
                row.last_checked_at = _HEALTH[source_id]["checked_at"]
                await session.flush()
    except Exception:  # noqa: BLE001
        pass
    return await get_source(source_id)


async def upsert_source(entry: dict[str, Any]) -> None:
    """Seed one catalog entry into data_sources (by name). Never raises."""
    name = str(entry.get("name") or "").strip()
    if not name:
        return
    async with session_scope() as session:
        from sqlalchemy import select

        row = (
            await session.execute(select(DataSource).where(DataSource.name == name))
        ).scalar_one_or_none()
        if row is None:
            row = DataSource(id=name, name=name)
            session.add(row)
        row.display_name = entry.get("display_name") or name
        row.provider = _provider_from(entry.get("base_url"))
        row.source_type = entry.get("source_type") or "open_data"
        row.base_url = entry.get("base_url")
        row.endpoint_url = entry.get("endpoint_url")
        row.license = entry.get("license")
        row.update_frequency = entry.get("update_frequency")
        row.reliability = float(entry.get("reliability") or 0.8) if entry.get("reliability") else None
        row.enabled = bool(entry.get("enabled", True))
        row.priority = entry.get("priority")
        row.config = entry.get("config") or {}
        if row.status is None:
            row.status = "unknown"


async def upsert_connector(entry: dict[str, Any]) -> None:
    """Seed one catalog entry into connectors (by name). Never raises."""
    name = str(entry.get("name") or "").strip()
    if not name:
        return
    from sqlalchemy import select

    from app.models import Connector

    async with session_scope() as session:
        row = (
            await session.execute(select(Connector).where(Connector.name == name))
        ).scalar_one_or_none()
        if row is None:
            row = Connector(id=name, name=name)
            session.add(row)
        row.display_name = entry.get("display_name") or name
        row.endpoint_url = entry.get("endpoint_url")
        row.source_url = entry.get("base_url")
        row.enabled = bool(entry.get("enabled", True))
        row.config = entry.get("config") or {}
        if row.status is None:
            row.status = "unknown"


async def check_health(source_id: str) -> dict[str, Any]:
    """Run a live connector health check and update the source status. Never raises."""
    source_id = str(source_id)
    connector = make_connector(source_id)
    if connector is None:
        return {"status": "unknown", "latency_ms": None, "detail": "άγνωστος συνθέτης"}
    try:
        health = await connector.health()
    except Exception as exc:  # noqa: BLE001
        health = {"status": "down", "latency_ms": None, "detail": str(exc)[:200]}
    await update_source_health(source_id, health)
    return health
