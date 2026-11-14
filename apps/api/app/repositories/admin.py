"""Admin repository — feature flags, connector registry, audit log, ingest persistence."""
from __future__ import annotations

import logging
from collections import deque
from typing import Any

from app.repositories.common import iso, mem_get, mem_list, mem_put, new_id, utcnow_iso

logger = logging.getLogger("policylab.repositories.admin")

FLAGS = "feature_flags"
CONNECTORS_MEM = "connectors"

DEFAULT_FLAGS: list[dict[str, Any]] = [
    {"name": "ai_enabled", "enabled": True, "description": "Ενεργοποίηση της υπηρεσίας ΤΝ (Ask the City)."},
    {"name": "map_enabled", "enabled": True, "description": "Ενεργοποίηση του χάρτη ψηφιακής δίδυμης πόλης."},
    {"name": "ingest_enabled", "enabled": True, "description": "Ενεργοποίηση του χειριστηρίου εισαγωγής δεδομένων."},
    {"name": "citizen_lab_enabled", "enabled": True, "description": "Ενεργοποίηση του Citizen Lab (διαβούλευση)."},
    {"name": "simulations_enabled", "enabled": True, "description": "Ενεργοποίηση προσομοιώσεων πολιτικής."},
]

# in-memory audit buffer used when the DB is unavailable (audit middleware appends here)
AUDIT_BUFFER: deque[dict[str, Any]] = deque(maxlen=500)


def append_audit(row: dict[str, Any]) -> None:
    AUDIT_BUFFER.append(row)


def clear_audit_buffer() -> None:
    AUDIT_BUFFER.clear()


# ---------------------------------------------------------------- feature flags
async def list_flags() -> tuple[list[dict[str, Any]], bool]:
    try:
        from app.database import session_scope
        from app.models import FeatureFlag
        from sqlalchemy import select

        async with session_scope() as session:
            rows = list((await session.execute(select(FeatureFlag).order_by(FeatureFlag.name))).scalars())
            items = [
                {
                    "id": row.id,
                    "name": row.name,
                    "enabled": bool(row.enabled),
                    "description": row.description,
                }
                for row in rows
            ]
        if items:
            return items, False
    except Exception as exc:  # noqa: BLE001
        logger.debug("list_flags: DB μη διαθέσιμη (%s)", exc)

    merged: dict[str, dict[str, Any]] = {flag["name"]: dict(flag) for flag in DEFAULT_FLAGS}
    for stored in mem_list(FLAGS):
        if stored.get("name"):
            merged[str(stored["name"])] = dict(stored)
    items = sorted(merged.values(), key=lambda item: str(item.get("name")))
    return items, False


async def patch_flag(name: str, enabled: bool) -> dict[str, Any] | None:
    flags, _ = await list_flags()
    current = next((flag for flag in flags if flag.get("name") == name), None)
    if current is None:
        return None
    updated = {
        "id": current.get("id") or new_id(),
        "name": str(name),
        "enabled": bool(enabled),
        "description": current.get("description"),
    }
    try:
        from app.database import session_scope
        from app.models import FeatureFlag
        from sqlalchemy import select

        async with session_scope() as session:
            row = (
                await session.execute(select(FeatureFlag).where(FeatureFlag.name == str(name)))
            ).scalar_one_or_none()
            if row is None:
                row = FeatureFlag(id=str(updated["id"]), name=str(name))
                session.add(row)
            row.enabled = bool(enabled)
            row.description = updated["description"]
            await session.flush()
            updated["id"] = row.id
    except Exception as exc:  # noqa: BLE001
        logger.debug("patch_flag: DB μη διαθέσιμη (%s)", exc)
        mem_put(FLAGS, updated)
    return updated


# ---------------------------------------------------------------- connectors
def _yaml_connectors() -> list[dict[str, Any]]:
    from app.repositories.sources import catalog_sources

    items: list[dict[str, Any]] = []
    for entry in catalog_sources():
        name = str(entry.get("name"))
        overrides = mem_get(CONNECTORS_MEM, name) or {}
        items.append(
            {
                "name": name,
                "display_name": entry.get("display_name") or name,
                "endpoint_url": overrides.get("endpoint_url") or entry.get("endpoint_url"),
                "source_url": entry.get("base_url"),
                "enabled": bool(overrides.get("enabled", entry.get("enabled", True))),
                "source_type": entry.get("source_type"),
                "priority": entry.get("priority"),
                "status": "unknown",
            }
        )
    return items


async def list_connectors() -> tuple[list[dict[str, Any]], bool]:
    """Registry entries — YAML catalog (+DB status when reachable). Never raises."""
    items = _yaml_connectors()
    degraded = False
    try:
        from app.database import session_scope
        from app.models import Connector
        from sqlalchemy import select

        async with session_scope() as session:
            rows = list((await session.execute(select(Connector))).scalars())
            by_name = {row.name: row for row in rows}
        for item in items:
            row = by_name.get(item["name"])
            if row is not None:
                item["status"] = row.status or item["status"]
                item["enabled"] = bool(row.enabled) if row.enabled is not None else item["enabled"]
                if row.endpoint_url:
                    item["endpoint_url"] = row.endpoint_url
                item["last_checked_at"] = iso(row.last_checked_at)
    except Exception as exc:  # noqa: BLE001
        logger.debug("list_connectors: DB μη διαθέσιμη (%s)", exc)
        degraded = True
    return items, degraded


async def patch_connector(
    name: str, enabled: bool | None = None, endpoint_url: str | None = None
) -> dict[str, Any] | None:
    items, _ = await list_connectors()
    current = next((item for item in items if item.get("name") == name), None)
    if current is None:
        return None
    updated = dict(current)
    if enabled is not None:
        updated["enabled"] = bool(enabled)
    if endpoint_url is not None:
        updated["endpoint_url"] = str(endpoint_url)
    mem_put(CONNECTORS_MEM, updated)
    try:
        from app.database import session_scope
        from app.models import Connector
        from sqlalchemy import select

        async with session_scope() as session:
            row = (
                await session.execute(select(Connector).where(Connector.name == str(name)))
            ).scalar_one_or_none()
            if row is None:
                row = Connector(id=new_id(), name=str(name))
                session.add(row)
            row.enabled = bool(updated["enabled"])
            row.endpoint_url = updated.get("endpoint_url")
            row.display_name = updated.get("display_name")
            row.source_url = updated.get("source_url")
            row.config = row.config or {}
            await session.flush()
    except Exception as exc:  # noqa: BLE001
        logger.debug("patch_connector: DB μη διαθέσιμη (%s)", exc)
    return updated


# ---------------------------------------------------------------- audit
async def list_audit(page: int = 1, page_size: int = 50) -> tuple[list[dict[str, Any]], int, bool]:
    degraded = False
    try:
        from app.database import session_scope
        from app.models import AuditLog
        from sqlalchemy import select

        async with session_scope() as session:
            rows = list(
                (
                    await session.execute(
                        select(AuditLog).order_by(AuditLog.created_at.desc())
                    )
                ).scalars()
            )
            items = [
                {
                    "id": row.id,
                    "method": row.method,
                    "path": row.path,
                    "status": row.status,
                    "ip": row.ip,
                    "request_id": row.request_id,
                    "created_at": iso(row.created_at),
                }
                for row in rows
            ]
    except Exception as exc:  # noqa: BLE001
        logger.debug("list_audit: DB μη διαθέσιμη (%s)", exc)
        degraded = True
        items = [
            {
                "id": row.get("id"),
                "method": row.get("method"),
                "path": row.get("path"),
                "status": row.get("status"),
                "ip": row.get("ip"),
                "request_id": row.get("request_id"),
                "created_at": row.get("created_at"),
            }
            for row in reversed(AUDIT_BUFFER)
        ]

    total = len(items)
    start = max(0, (int(page) - 1) * int(page_size))
    return items[start : start + int(page_size)], total, degraded


# ---------------------------------------------------------------- ingest
def _score_ingested(payload: dict[str, Any], source_name: str) -> dict[str, Any]:
    """Score a freshly ingested record (completeness / freshness / validity)."""
    try:
        from services.data_ingestion.quality import score_quality

        return score_quality(
            {
                "title": payload.get("title"),
                "source_url": payload.get("source_url"),
                "description": payload.get("description"),
                "provider": payload.get("provider") or source_name,
                "license": payload.get("license"),
                "category": payload.get("category"),
                "tags": payload.get("tags") or [],
                "published_at": payload.get("published_at"),
                "updated_at": payload.get("updated_at")
                or payload.get("last_updated")
                or payload.get("fetched_at"),
                "lat": payload.get("lat"),
                "lon": payload.get("lon"),
            }
        )
    except Exception:  # noqa: BLE001 �?" scoring must never block ingestion
        logger.debug("_score_ingested failed", exc_info=True)
        return {
            "completeness": None,
            "freshness": None,
            "validity": None,
            "validation_status": "pending",
        }


async def persist_ingest_records(source_name: str, records: list[Any]) -> int:
    """Persist normalized records as datasets rows. Returns ingested count. Never raises."""
    from app.repositories.datasets import upsert_dataset

    ingested = 0
    for record in records or []:
        try:
            if hasattr(record, "to_dict"):
                payload = record.to_dict()
            elif isinstance(record, dict):
                payload = dict(record)
            else:
                payload = {"title": str(record)}
            title = str(payload.get("title") or "").strip()
            if not title:
                continue
            dataset = {
                "id": None,
                "title": title,
                "description": payload.get("description"),
                "provider": payload.get("provider") or source_name,
                "source_name": payload.get("source_name") or source_name,
                "source_url": payload.get("source_url"),
                "license": payload.get("license"),
                "last_updated": payload.get("updated_at") or payload.get("published_at"),
                "fetched_at": payload.get("fetched_at") or utcnow_iso(),
                "checksum": None,
                "metadata": {"source": source_name},
                "format": None,
                "geographic_scope": None,
                "category": payload.get("category"),
                "tags": payload.get("tags") or [],
                "quality": _score_ingested(payload, source_name),
                "provenance": {
                    "source_version": None,
                    "retrieved_at": payload.get("fetched_at") or utcnow_iso(),
                    "checksum": None,
                },
                "resources": [],
                "related_ids": [],
            }
            await upsert_dataset(dataset)
            await _persist_city_feature(payload, source_name)
            ingested += 1
        except Exception:  # noqa: BLE001
            logger.warning("persist_ingest_records: αποτυχία εγγραφής", exc_info=True)
    return ingested


_PARK_LEISURE = {"park", "garden", "nature_reserve", "recreation_ground"}
_FACILITY_LAYERS = {
    "schools": {"school", "university", "college", "kindergarten"},
    "hospitals": {"hospital", "clinic", "doctors", "pharmacy", "healthcare"},
    "public_facilities": {
        "townhall",
        "police",
        "library",
        "courthouse",
        "fire_station",
        "public_building",
    },
}


def _feature_layer(payload: dict[str, Any]) -> str:
    extra = payload.get("extra") if isinstance(payload.get("extra"), dict) else {}
    tags = extra.get("tags") if isinstance(extra.get("tags"), dict) else {}
    leisure = str(tags.get("leisure") or "").lower()
    amenity = str(tags.get("amenity") or "").lower()
    category = str(payload.get("category") or "").lower()
    if leisure in _PARK_LEISURE:
        return "green_spaces"
    if amenity:
        for layer, values in _FACILITY_LAYERS.items():
            if amenity in values:
                return layer
    if category in {"park", "garden", "green_space"}:
        return "green_spaces"
    if category in {"school", "education"}:
        return "schools"
    if category in {"hospital", "health", "clinic"}:
        return "hospitals"
    if category in {"public", "government"}:
        return "public_facilities"
    return "pois"


def _feature_id(payload: dict[str, Any], source_name: str, lat: float, lon: float) -> str:
    import hashlib

    extra = payload.get("extra") if isinstance(payload.get("extra"), dict) else {}
    osm_type = extra.get("osm_type")
    osm_id = extra.get("osm_id")
    if osm_type is not None and osm_id is not None:
        return f"{source_name}:{osm_type}/{osm_id}"
    seed = f"{source_name}|{payload.get('title')}|{lat:.6f}|{lon:.6f}"
    return f"{source_name}:{hashlib.sha1(seed.encode('utf-8')).hexdigest()[:20]}"


async def _persist_city_feature(payload: dict[str, Any], source_name: str) -> None:
    """Map a geolocated ingest record into city_features (Digital Twin). Never raises."""
    lat = payload.get("lat")
    lon = payload.get("lon")
    if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
        return
    layer = _feature_layer(payload)
    feature_id = _feature_id(payload, source_name, float(lat), float(lon))
    extra = payload.get("extra") if isinstance(payload.get("extra"), dict) else {}
    props = {
        "title": payload.get("title"),
        "name": payload.get("title"),
        "source_name": payload.get("source_name") or source_name,
        "source_url": payload.get("source_url"),
        "category": payload.get("category"),
        "tags": extra.get("tags") if isinstance(extra.get("tags"), dict) else {},
    }
    wkt = f"POINT({float(lon)} {float(lat)})"
    try:
        from app.database import session_scope
        from app.models import CityFeature
        from sqlalchemy import select

        geometry: Any = wkt
        try:
            from geoalchemy2.elements import WKTElement

            geometry = WKTElement(wkt, srid=4326)
        except Exception:  # noqa: BLE001 — SQLite stores WKT text
            geometry = wkt

        async with session_scope() as session:
            row = (
                await session.execute(select(CityFeature).where(CityFeature.id == feature_id))
            ).scalar_one_or_none()
            if row is None:
                row = CityFeature(id=feature_id, layer=layer)
                session.add(row)
            row.layer = layer
            row.properties = props
            row.geom = geometry
            await session.flush()
    except Exception as exc:  # noqa: BLE001
        logger.debug("persist city feature skipped (%s)", exc)
