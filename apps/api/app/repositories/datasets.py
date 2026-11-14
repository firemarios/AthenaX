"""Datasets repository — DB first, in-memory fallback for ingested rows (never raises)."""
from __future__ import annotations

import logging
from typing import Any

from app.repositories.common import as_json, iso, mem_get, mem_list, mem_put, new_id

logger = logging.getLogger("policylab.repositories.datasets")

_QUALITY_DEFAULT = {
    "completeness": None,
    "freshness": None,
    "validity": None,
    "validation_status": "pending",
}


def _source_name_of(row: dict[str, Any]) -> str:
    return str(row.get("source_name") or row.get("provider") or "—" )


def dataset_to_dict(row: dict[str, Any]) -> dict[str, Any]:
    """Normalize a stored dataset row into the TS `Dataset` shape (contract §3)."""
    quality = as_json(row.get("quality"), {}) or {}
    provenance = as_json(row.get("provenance"), {}) or {}
    return {
        "id": str(row.get("id") or ""),
        "title": str(row.get("title") or ""),
        "description": row.get("description"),
        "provider": row.get("provider"),
        "original_source": {
            "name": str(row.get("source_name") or row.get("provider") or "—"),
            "url": str(row.get("source_url") or ""),
        },
        "format": row.get("format"),
        "geographic_scope": row.get("geographic_scope"),
        "category": row.get("category"),
        "license": row.get("license"),
        "last_updated": row.get("last_updated"),
        "tags": list(as_json(row.get("tags"), []) or []),
        "quality": {
            "completeness": quality.get("completeness"),
            "freshness": quality.get("freshness"),
            "validity": quality.get("validity"),
            "validation_status": str(quality.get("validation_status") or "pending"),
        },
        "provenance": {
            "source_version": provenance.get("source_version"),
            "retrieved_at": provenance.get("retrieved_at") or row.get("fetched_at"),
            "checksum": provenance.get("checksum") or row.get("checksum"),
        },
        "resources": list(as_json(row.get("resources"), []) or []),
        "related_ids": list(as_json(row.get("related_ids"), []) or []),
        "source_id": row.get("source_id"),
        "fetched_at": row.get("fetched_at"),
        "checksum": row.get("checksum"),
    }


def _matches(row: dict[str, Any], q: str | None, source_id: str | None, tag: str | None) -> bool:
    if q:
        needle = q.lower()
        haystack = f"{row.get('title') or ''} {row.get('description') or ''}".lower()
        if needle not in haystack:
            return False
    if source_id and str(row.get("source_id") or "") != str(source_id):
        return False
    if tag:
        tags = [str(t).lower() for t in (as_json(row.get("tags"), []) or [])]
        if str(tag).lower() not in tags:
            return False
    return True


def _sort_rows(rows: list[dict[str, Any]], sort: str | None) -> list[dict[str, Any]]:
    if sort == "title":
        return sorted(rows, key=lambda r: str(r.get("title") or "").lower())
    if sort == "relevance" or not sort:
        return rows
    # freshness (default): newest last_updated first, unknown dates last
    return sorted(
        rows,
        key=lambda r: str(r.get("last_updated") or ""),
        reverse=True,
    )


async def _db_rows() -> list[dict[str, Any]]:
    from app.database import session_scope
    from app.models import Dataset
    from sqlalchemy import select

    async with session_scope() as session:
        rows = (await session.execute(select(Dataset))).scalars()
        return [{column.name: getattr(row, column.name) for column in row.__table__.columns} for row in rows]


def _all_rows() -> tuple[list[dict[str, Any]], bool]:
    """Synchronous source of truth: MEM rows (DB rows are fetched separately)."""
    return mem_list("datasets"), False


async def list_datasets(
    q: str | None = None,
    source_id: str | None = None,
    tag: str | None = None,
    page: int = 1,
    page_size: int = 20,
    sort: str | None = "freshness",
) -> tuple[list[dict[str, Any]], int, bool]:
    """(Dataset[], total, degraded) with filters + pagination (contract §2)."""
    rows: list[dict[str, Any]] = []
    degraded = False
    try:
        rows = await _db_rows()
    except Exception as exc:  # noqa: BLE001
        logger.debug("list_datasets: DB μη διαθέσιμη (%s) — ενδομοική αποθήκευση", exc)
        rows, degraded = _all_rows()
        degraded = True

    filtered = [row for row in rows if _matches(row, q, source_id, tag)]
    filtered = _sort_rows(filtered, sort)
    total = len(filtered)
    start = max(0, (int(page) - 1) * int(page_size))
    page_rows = filtered[start : start + int(page_size)]
    return [dataset_to_dict(row) for row in page_rows], total, degraded


async def search_relevant_datasets(
    query: str, *, limit: int = 6
) -> list[dict[str, Any]]:
    """Ingested datasets ranked for the Ask pipeline (DB, keyword + topic matching)."""
    from services.ai_engine.lexicon import relevance

    try:
        rows = await _db_rows()
    except Exception as exc:  # noqa: BLE001
        logger.debug("search_relevant_datasets: DB μη διαθέσιμη (%s)", exc)
        return []

    scored: list[tuple[float, int, dict[str, Any]]] = []
    for index, row in enumerate(rows):
        record = {
            "title": str(row.get("title") or ""),
            "description": row.get("description"),
            "provider": row.get("provider"),
            "source_name": row.get("source_name") or row.get("provider"),
            "category": row.get("category"),
            "tags": as_json(row.get("tags"), []) or [],
        }
        score = relevance(query, record)
        if score > 0:
            scored.append((score, index, row))

    scored.sort(key=lambda item: (-item[0], item[1]))
    results: list[dict[str, Any]] = []
    for _score, _index, row in scored[: max(0, int(limit))]:
        quality = as_json(row.get("quality"), {}) or {}
        results.append(
            {
                "title": str(row.get("title") or "Χωρίς τίτλο"),
                "description": row.get("description"),
                "provider": row.get("provider") or row.get("source_name"),
                "source_name": row.get("source_name") or row.get("provider") or "POLICYLAB",
                "source_url": row.get("source_url") or "",
                "category": row.get("category"),
                "tags": list(as_json(row.get("tags"), []) or []),
                "extra": {
                    "dataset_id": row.get("id"),
                    "quality": quality.get("completeness"),
                    "format": row.get("format"),
                },
            }
        )
    return results


async def get_dataset(dataset_id: str) -> dict[str, Any] | None:
    """Single dataset by id (DB → memory). Never raises."""
    try:
        from app.database import session_scope
        from app.models import Dataset
        from sqlalchemy import select

        async with session_scope() as session:
            row = (
                await session.execute(select(Dataset).where(Dataset.id == str(dataset_id)))
            ).scalar_one_or_none()
            if row is not None:
                return dataset_to_dict(
                    {column.name: getattr(row, column.name) for column in row.__table__.columns}
                )
    except Exception:  # noqa: BLE001
        pass
    stored = mem_get("datasets", str(dataset_id))
    if stored is not None:
        return dataset_to_dict(stored)
    return None


async def list_versions(dataset_id: str) -> tuple[list[dict[str, Any]], bool]:
    """DatasetVersion[] for a dataset (DB → memory). Never raises."""
    try:
        from app.database import session_scope
        from app.models import DatasetVersion
        from sqlalchemy import select

        async with session_scope() as session:
            rows = (
                await session.execute(
                    select(DatasetVersion)
                    .where(DatasetVersion.dataset_id == str(dataset_id))
                    .order_by(DatasetVersion.created_at.desc())
                )
            ).scalars()
            items = [
                {
                    "id": row.id,
                    "dataset_id": row.dataset_id,
                    "version": row.version,
                    "checksum": row.checksum,
                    "notes": row.notes,
                    "created_at": iso(row.created_at),
                }
                for row in rows
            ]
            return items, False
    except Exception as exc:  # noqa: BLE001
        logger.debug("list_versions: DB μη διαθέσιμη (%s)", exc)
        return list(mem_list("dataset_versions")), True


async def upsert_dataset(payload: dict[str, Any]) -> str:
    """Insert/update a dataset row (DB first, memory fallback). Returns the id. Never raises."""
    dataset_id = str(payload.get("id") or new_id())
    payload = dict(payload)
    payload["id"] = dataset_id
    try:
        from app.database import session_scope
        from app.models import Dataset
        from sqlalchemy import select

        async with session_scope() as session:
            row = (
                await session.execute(select(Dataset).where(Dataset.id == dataset_id))
            ).scalar_one_or_none()
            if row is None:
                row = Dataset(id=dataset_id)
                session.add(row)
            row.title = str(payload.get("title") or "Χωρίς τίτλο")
            row.description = payload.get("description")
            row.provider = payload.get("provider")
            row.source_id = payload.get("source_id")
            row.source_name = payload.get("source_name")
            row.source_url = payload.get("source_url")
            row.license = payload.get("license")
            row.last_updated = payload.get("last_updated")
            row.fetched_at = payload.get("fetched_at")
            row.checksum = payload.get("checksum")
            row.metadata_ = payload.get("metadata") or {}
            row.format = payload.get("format")
            row.geographic_scope = payload.get("geographic_scope")
            row.category = payload.get("category")
            row.tags = payload.get("tags") or []
            row.quality = payload.get("quality") or dict(_QUALITY_DEFAULT)
            row.provenance = payload.get("provenance") or {}
            row.resources = payload.get("resources") or []
            row.related_ids = payload.get("related_ids") or []
        return dataset_id
    except Exception as exc:  # noqa: BLE001
        logger.debug("upsert_dataset: DB μη διαθέσιμη (%s) — ενδομοική αποθήκευση", exc)
        mem_put("datasets", payload)
        return dataset_id


async def save_quality_report(dataset_id: str, report: dict[str, Any]) -> dict[str, Any]:
    """Persist a quality recompute result (data_quality_reports + datasets.quality)."""
    try:
        from app.database import session_scope
        from app.models import DataQualityReport, Dataset
        from sqlalchemy import select

        async with session_scope() as session:
            ds = (
                await session.execute(select(Dataset).where(Dataset.id == str(dataset_id)))
            ).scalar_one_or_none()
            if ds is not None:
                quality = {
                    "completeness": report.get("completeness"),
                    "freshness": report.get("freshness"),
                    "validity": report.get("validity"),
                    "validation_status": report.get("validation_status"),
                }
                ds.quality = quality
            session.add(
                DataQualityReport(
                    dataset_id=str(dataset_id),
                    completeness=report.get("completeness"),
                    freshness=report.get("freshness"),
                    validity=report.get("validity"),
                    validation_status=report.get("validation_status"),
                    computed_at=report.get("computed_at"),
                )
            )
    except Exception as exc:  # noqa: BLE001
        logger.debug("save_quality_report: DB μη διαθέσιμη (%s)", exc)
        stored = mem_get("datasets", str(dataset_id))
        if stored is not None:
            stored["quality"] = {
                "completeness": report.get("completeness"),
                "freshness": report.get("freshness"),
                "validity": report.get("validity"),
                "validation_status": report.get("validation_status"),
            }
    return report
