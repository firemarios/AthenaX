"""GovTech module (02): decisions list/detail."""
from __future__ import annotations

from app.deps import get_request_id
from app.envelope import DB_DOWN_NOTE, build_meta, ok
from app.services import catalog as catalog_service
from fastapi import APIRouter, HTTPException, Query, Request

router = APIRouter()


@router.get("/decisions")
async def list_decisions(
    request: Request,
    q: str | None = Query(None),
    org: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Decision[] — DB when populated, else live diavgeia search (graceful empty)."""
    items, total, degraded = await catalog_service.query_decisions(
        q=q, org=org, date_from=date_from, date_to=date_to, page=page, page_size=page_size
    )
    meta = build_meta(get_request_id(request), total=total, page=page, page_size=page_size)
    if degraded:
        meta["limitations"] = [DB_DOWN_NOTE]
    return ok(items, meta)


@router.get("/decisions/{id}")
async def get_decision(id: str, request: Request):
    item = await catalog_service.get_decision(id)
    if item is None:
        raise HTTPException(status_code=404, detail="Η απόφαση δεν βρέθηκε.")
    return ok(item, build_meta(get_request_id(request)))
