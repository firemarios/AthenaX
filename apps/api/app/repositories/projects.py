"""Projects repository — DB rows for the Public Project Tracker (live search in services)."""
from __future__ import annotations

import logging
from typing import Any

from app.repositories.common import as_json

logger = logging.getLogger("policylab.repositories.projects")


def project_from_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "name": str(row.name or ""),
        "status": row.status,
        "org": row.org,
        "budget": row.budget,
        "url": row.url,
        "geometry": as_json(row.geometry, None),
        "decisions": [],
    }


def project_from_record(record: dict[str, Any]) -> dict[str, Any]:
    """NormalizedRecord dict → Project (contract §3)."""
    extra = dict(record.get("extra") or {})
    geometry = record.get("geometry") or extra.get("geometry")
    return {
        "id": str(extra.get("id") or record.get("source_url") or record.get("title") or ""),
        "name": str(record.get("title") or ""),
        "status": extra.get("status") or record.get("category"),
        "org": record.get("provider") or extra.get("org"),
        "budget": extra.get("budget"),
        "url": str(record.get("source_url") or "") or None,
        "geometry": geometry if isinstance(geometry, dict) else None,
        "decisions": [],
    }


def _flatten_coords(geometry: Any, out: list[tuple[float, float]]) -> None:
    if isinstance(geometry, dict):
        for value in geometry.values():
            _flatten_coords(value, out)
    elif isinstance(geometry, (list, tuple)):
        if (
            len(geometry) >= 2
            and isinstance(geometry[0], (int, float))
            and isinstance(geometry[1], (int, float))
        ):
            out.append((float(geometry[0]), float(geometry[1])))
        else:
            for item in geometry:
                _flatten_coords(item, out)


def geometry_intersects_bbox(geometry: Any, bbox: list[float] | None) -> bool:
    """True when a GeoJSON geometry's bounding box intersects bbox [w,s,e,n]."""
    if not bbox or not isinstance(geometry, dict):
        return True
    coords: list[tuple[float, float]] = []
    _flatten_coords(geometry, coords)
    if not coords:
        return True
    w, s, e, n = bbox
    xs = [c[0] for c in coords]
    ys = [c[1] for c in coords]
    return not (max(xs) < w or min(xs) > e or max(ys) < s or min(ys) > n)


def _match(
    item: dict[str, Any], q: str | None, status: str | None, bbox: list[float] | None
) -> bool:
    if q and q.lower() not in f"{item.get('name') or ''} {item.get('org') or ''}".lower():
        return False
    if status and str(item.get("status") or "").lower() != str(status).lower():
        return False
    if bbox and item.get("geometry"):
        return geometry_intersects_bbox(item.get("geometry"), bbox)
    return True


async def list_from_db(
    q: str | None = None,
    status: str | None = None,
    bbox: list[float] | None = None,
) -> tuple[list[dict[str, Any]], int, bool, bool]:
    """(Project[], total, db_reachable, populated). Never raises."""
    try:
        from app.database import session_scope
        from app.models import Decision as DecisionModel
        from app.models import Project as ProjectModel
        from sqlalchemy import select

        async with session_scope() as session:
            rows = (await session.execute(select(ProjectModel))).scalars()
            items = [project_from_row(row) for row in rows]
            decisions = (await session.execute(select(DecisionModel))).scalars()
            by_project: dict[str, list[dict[str, Any]]] = {}
            for dec in decisions:
                if dec.project_id:
                    by_project.setdefault(str(dec.project_id), []).append(
                        {
                            "id": str(dec.id),
                            "title": str(dec.title or ""),
                            "org": dec.org,
                            "decision_type": dec.decision_type,
                            "date": dec.date,
                            "url": dec.url or "",
                            "project_id": dec.project_id,
                            "extra": as_json(dec.extra, {}) or {},
                        }
                    )
            for item in items:
                item["decisions"] = by_project.get(item["id"], [])
    except Exception as exc:  # noqa: BLE001
        logger.debug("projects: DB μη διαθέσιμη (%s)", exc)
        return [], 0, False, False

    filtered = [item for item in items if _match(item, q, status, bbox)]
    return filtered, len(filtered), True, bool(items)


async def get_from_db(project_id: str) -> dict[str, Any] | None:
    try:
        from app.database import session_scope
        from app.models import Project as ProjectModel
        from sqlalchemy import select

        async with session_scope() as session:
            row = (
                await session.execute(select(ProjectModel).where(ProjectModel.id == str(project_id)))
            ).scalar_one_or_none()
            return project_from_row(row) if row is not None else None
    except Exception:  # noqa: BLE001
        return None
