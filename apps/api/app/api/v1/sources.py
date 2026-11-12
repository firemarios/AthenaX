"""Data module (01): GET /v1/sources, /v1/sources/{id}, POST /v1/sources/{id}/health."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request

from app.deps import get_request_id
from app.envelope import DB_DOWN_NOTE, build_meta, ok
from app.repositories import sources as sources_repo

router = APIRouter()


@router.get("/sources")
async def list_sources(
    request: Request,
    source_type: str | None = Query(None, alias="type"),
    status: str | None = Query(None),
):
    """Source[] + meta.total (DB → YAML catalog fallback, contract §9.3)."""
    items, total, degraded = await sources_repo.list_sources(source_type=source_type, status=status)
    meta = build_meta(get_request_id(request), total=total)
    if degraded:
        meta["limitations"] = [DB_DOWN_NOTE]
    return ok(items, meta)


@router.get("/sources/{id}")
async def get_source(id: str, request: Request):
    item = await sources_repo.get_source(id)
    if item is None:
        raise HTTPException(status_code=404, detail="Η πηγή δεν βρέθηκε.")
    return ok(item, build_meta(get_request_id(request)))


@router.post("/sources/{id}/health")
async def source_health(id: str, request: Request):
    """Run a live connector health check and update the source status."""
    item = await sources_repo.get_source(id)
    if item is None:
        raise HTTPException(status_code=404, detail="Η πηγή δεν βρέθηκε.")
    health = await sources_repo.check_health(id)
    updated = await sources_repo.get_source(id) or item
    meta = build_meta(get_request_id(request), health=health)
    return ok(updated, meta)
