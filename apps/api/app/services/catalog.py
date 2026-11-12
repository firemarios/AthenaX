"""Catalog queries: datasets / decisions / projects (contracts §2 GovTech + Data modules).

Decisions and projects are served from the DB when populated, otherwise via live
connector search (diavgeia for decisions; kimdis + athens for projects), with a
graceful empty fallback. Never raises.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from app.repositories import datasets as datasets_repo
from app.repositories import decisions as decisions_repo
from app.repositories import projects as projects_repo

logger = logging.getLogger("policylab.catalog")

EMPTY_NOTE = "Δεν βρέθηκαν εγγραφές ή οι πηγές δεν είναι διαθέσιμες προσωρινά."


def paginate(items: list[dict[str, Any]], page: int, page_size: int) -> list[dict[str, Any]]:
    start = max(0, (int(page) - 1) * int(page_size))
    return items[start : start + int(page_size)]


# ---------------------------------------------------------------- datasets
async def query_datasets(
    q: str | None = None,
    source_id: str | None = None,
    tag: str | None = None,
    page: int = 1,
    page_size: int = 20,
    sort: str | None = "freshness",
) -> tuple[list[dict[str, Any]], int, bool]:
    """Dataset[] with search + filters + pagination (meta.total/page/page_size)."""
    try:
        return await datasets_repo.list_datasets(
            q=q, source_id=source_id, tag=tag, page=page, page_size=page_size, sort=sort
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("query_datasets: %s", exc)
        return [], 0, True


# ---------------------------------------------------------------- decisions
async def _live_decisions(
    q: str | None,
    org: str | None,
    date_from: str | None,
    date_to: str | None,
    page: int,
    page_size: int,
) -> tuple[list[dict[str, Any]], int, bool]:
    from app.repositories.decisions import decision_from_record
    from app.repositories.sources import make_connector

    connector = make_connector("diavgeia")
    if connector is None:
        return [], 0, True
    try:
        records = await connector.search(query=q or None, limit=100)
    except Exception as exc:  # noqa: BLE001
        logger.warning("live decisions: %s", exc)
        return [], 0, True

    items = [decision_from_record(record.to_dict() if hasattr(record, "to_dict") else dict(record))
             for record in records or []]
    if org:
        org_lower = org.lower()
        items = [item for item in items if org_lower in str(item.get("org") or "").lower()]
    if date_from:
        items = [item for item in items if str(item.get("date") or "") >= date_from]
    if date_to:
        items = [item for item in items if str(item.get("date") or "") <= date_to]
    items.sort(key=lambda item: str(item.get("date") or ""), reverse=True)
    return paginate(items, page, page_size), len(items), False


async def query_decisions(
    q: str | None = None,
    org: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[dict[str, Any]], int, bool]:
    """Decision[] — DB when populated, else live diavgeia search, else empty."""
    try:
        items, total, db_ok, populated = await decisions_repo.list_from_db(
            q=q, org=org, date_from=date_from, date_to=date_to, page=page, page_size=page_size
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("query_decisions: %s", exc)
        items, total, db_ok, populated = [], 0, False, False

    if db_ok and populated:
        return items, total, False
    return await _live_decisions(q, org, date_from, date_to, page, page_size)


async def get_decision(decision_id: str) -> dict[str, Any] | None:
    try:
        item = await decisions_repo.get_from_db(decision_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("get_decision: %s", exc)
        item = None
    if item is not None:
        return item
    # live fallback: search by id/title fragment
    try:
        items, _, _ = await query_decisions(q=str(decision_id), page=1, page_size=50)
    except Exception:  # noqa: BLE001
        return None
    for item in items:
        if str(item.get("id")) == str(decision_id):
            return item
    return None


# ---------------------------------------------------------------- projects
async def _live_projects(
    q: str | None, status: str | None, bbox: list[float] | None
) -> tuple[list[dict[str, Any]], int, bool]:
    from app.repositories.projects import geometry_intersects_bbox, project_from_record
    from app.repositories.sources import make_connector

    connectors = [make_connector(name) for name in ("kimdis", "athens")]
    connectors = [connector for connector in connectors if connector is not None]
    if not connectors:
        return [], 0, True
    try:
        results = await asyncio.gather(
            *[connector.search(query=q or None, limit=50) for connector in connectors],
            return_exceptions=True,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("live projects: %s", exc)
        return [], 0, True

    items: list[dict[str, Any]] = []
    seen: set[str] = set()
    for result in results:
        if isinstance(result, BaseException) or not result:
            continue
        for record in result:
            payload = record.to_dict() if hasattr(record, "to_dict") else dict(record)
            item = project_from_record(payload)
            if item["id"] in seen:
                continue
            seen.add(item["id"])
            items.append(item)

    if q:
        needle = q.lower()
        items = [
            item
            for item in items
            if needle in f"{item.get('name') or ''} {item.get('org') or ''}".lower()
        ]
    if status:
        items = [
            item
            for item in items
            if str(item.get("status") or "").lower() == str(status).lower()
        ]
    if bbox and items:
        items = [
            item
            for item in items
            if not item.get("geometry") or geometry_intersects_bbox(item.get("geometry"), bbox)
        ]
    return items, len(items), False


async def query_projects(
    q: str | None = None,
    status: str | None = None,
    bbox: list[float] | None = None,
) -> tuple[list[dict[str, Any]], int, bool]:
    """Project[] — DB when populated, else live kimdis/athens search, else empty."""
    try:
        items, total, db_ok, populated = await projects_repo.list_from_db(
            q=q, status=status, bbox=bbox
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("query_projects: %s", exc)
        items, total, db_ok, populated = [], 0, False, False

    if db_ok and populated:
        return items, total, False
    return await _live_projects(q, status, bbox)


async def get_project(project_id: str) -> dict[str, Any] | None:
    try:
        item = await projects_repo.get_from_db(project_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("get_project: %s", exc)
        item = None
    if item is not None:
        return item
    try:
        items, _, _ = await query_projects()
    except Exception:  # noqa: BLE001
        return None
    for item in items:
        if str(item.get("id")) == str(project_id):
            return item
    return None
