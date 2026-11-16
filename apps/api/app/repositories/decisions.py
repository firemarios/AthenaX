"""Decisions repository — DB rows for Diavgeia decisions (live search handled in services)."""
from __future__ import annotations

import logging
from typing import Any

from app.repositories.common import as_json

logger = logging.getLogger("athenax.repositories.decisions")


def decision_from_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "title": str(row.title or ""),
        "org": row.org,
        "decision_type": row.decision_type,
        "date": row.date,
        "url": row.url or "",
        "project_id": row.project_id,
        "extra": as_json(row.extra, {}) or {},
    }


def decision_from_record(record: dict[str, Any]) -> dict[str, Any]:
    """NormalizedRecord dict → Decision (contract §3)."""
    extra = dict(record.get("extra") or {})
    return {
        "id": str(extra.get("id") or record.get("source_url") or record.get("title") or ""),
        "title": str(record.get("title") or ""),
        "org": record.get("provider") or extra.get("org"),
        "decision_type": extra.get("decision_type") or record.get("category"),
        "date": extra.get("date") or record.get("published_at"),
        "url": str(record.get("source_url") or ""),
        "project_id": extra.get("project_id"),
        "extra": extra,
    }


def _match(row: dict[str, Any], q: str | None, org: str | None,
           date_from: str | None, date_to: str | None) -> bool:
    if q:
        needle = q.lower()
        if needle not in f"{row.get('title') or ''} {row.get('org') or ''}".lower():
            return False
    if org and org.lower() not in str(row.get("org") or "").lower():
        return False
    date = str(row.get("date") or "")
    if date_from and date and date < date_from:
        return False
    if date_to and date and date > date_to:
        return False
    return True


async def list_from_db(
    q: str | None = None,
    org: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[dict[str, Any]], int, bool, bool]:
    """(Decision[], total, db_reachable, populated). Never raises."""
    try:
        from app.database import session_scope
        from app.models import Decision as DecisionModel
        from sqlalchemy import select

        async with session_scope() as session:
            rows = (await session.execute(select(DecisionModel))).scalars()
            items = [decision_from_row(row) for row in rows]
    except Exception as exc:  # noqa: BLE001
        logger.debug("decisions: DB μη διαθέσιμη (%s)", exc)
        return [], 0, False, False

    filtered = [item for item in items if _match(item, q, org, date_from, date_to)]
    filtered.sort(key=lambda item: str(item.get("date") or ""), reverse=True)
    total = len(filtered)
    start = max(0, (int(page) - 1) * int(page_size))
    return filtered[start : start + int(page_size)], total, True, bool(items)


async def get_from_db(decision_id: str) -> dict[str, Any] | None:
    try:
        from app.database import session_scope
        from app.models import Decision as DecisionModel
        from sqlalchemy import select

        async with session_scope() as session:
            row = (
                await session.execute(select(DecisionModel).where(DecisionModel.id == str(decision_id)))
            ).scalar_one_or_none()
            return decision_from_row(row) if row is not None else None
    except Exception:  # noqa: BLE001
        return None


async def linked_to_project(project_id: str) -> list[dict[str, Any]]:
    """Decisions linked to a project (DB only; graceful empty). Never raises."""
    try:
        from app.database import session_scope
        from app.models import Decision as DecisionModel
        from sqlalchemy import select

        async with session_scope() as session:
            rows = (
                await session.execute(
                    select(DecisionModel)
                    .where(DecisionModel.project_id == str(project_id))
                    .order_by(DecisionModel.date.desc())
                )
            ).scalars()
            return [decision_from_row(row) for row in rows]
    except Exception:  # noqa: BLE001
        return []
