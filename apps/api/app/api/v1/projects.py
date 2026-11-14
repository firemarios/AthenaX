"""GovTech module (02): Public Project Tracker list/detail (+ linked decisions)."""
from __future__ import annotations

from app.deps import get_request_id
from app.envelope import DB_DOWN_NOTE, build_meta, ok
from app.repositories import decisions as decisions_repo
from app.services import catalog as catalog_service
from fastapi import APIRouter, HTTPException, Query, Request

from services.geospatial_engine.queries import parse_bbox

router = APIRouter()


@router.get("/projects")
async def list_projects(
    request: Request,
    q: str | None = Query(None),
    status: str | None = Query(None),
    bbox: str | None = Query(None),
):
    """Project[] (Public Project Tracker) with q/status/bbox filters."""
    parsed_bbox = parse_bbox(bbox)
    if bbox and parsed_bbox is None:
        raise HTTPException(
            status_code=400, detail="Μη έγκυρο bbox. Αναμενόμενη μορφή: w,s,e,n."
        )
    items, total, degraded = await catalog_service.query_projects(
        q=q, status=status, bbox=parsed_bbox
    )
    meta = build_meta(get_request_id(request), total=total)
    if degraded:
        meta["limitations"] = [DB_DOWN_NOTE]
    return ok(items, meta)


@router.get("/projects/{id}")
async def get_project(id: str, request: Request):
    """Project incl. linked decisions timeline (contract §2)."""
    item = await catalog_service.get_project(id)
    if item is None:
        raise HTTPException(status_code=404, detail="Το έργο δεν βρέθηκε.")
    linked = await decisions_repo.linked_to_project(str(item.get("id")))
    if not linked and item.get("decisions"):
        linked = list(item.get("decisions"))
    item = dict(item, decisions=linked)
    return ok(item, build_meta(get_request_id(request)))
