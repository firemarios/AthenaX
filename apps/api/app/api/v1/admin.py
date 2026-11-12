"""Admin module: feature flags, connector registry, audit log, ingest trigger (§2)."""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.deps import get_request_id
from app.envelope import DB_DOWN_NOTE, build_meta, ok
from app.repositories import admin as admin_repo
from app.repositories import sources as sources_repo
from services.data_ingestion.pipeline import ingest

logger = logging.getLogger("policylab.api.admin")

router = APIRouter()


class FlagPatch(BaseModel):
    enabled: bool = Field(..., description="Νέα κατάσταση του flag")


class ConnectorPatch(BaseModel):
    enabled: bool | None = Field(None, description="Ενεργοποίηση/απενεργοποίηση")
    endpoint_url: str | None = Field(None, max_length=500, description="Προσαρμοσμένο endpoint")


class IngestRequest(BaseModel):
    source: str = Field(..., min_length=1, max_length=120, description="Όνομα συνθέτη/πηγής")


# ---------------------------------------------------------------- feature flags
@router.get("/admin/flags")
async def list_flags(request: Request):
    items, degraded = await admin_repo.list_flags()
    meta = build_meta(get_request_id(request), total=len(items))
    if degraded:
        meta["limitations"] = [DB_DOWN_NOTE]
    return ok(items, meta)


@router.patch("/admin/flags/{name}")
async def patch_flag(name: str, payload: FlagPatch, request: Request):
    item = await admin_repo.patch_flag(name, payload.enabled)
    if item is None:
        raise HTTPException(status_code=404, detail="Το flag δεν βρέθηκε.")
    return ok(item, build_meta(get_request_id(request)))


# ---------------------------------------------------------------- connectors
@router.get("/admin/connectors")
async def list_connectors(request: Request):
    items, degraded = await admin_repo.list_connectors()
    meta = build_meta(get_request_id(request), total=len(items))
    if degraded:
        meta["limitations"] = [DB_DOWN_NOTE]
    return ok(items, meta)


@router.patch("/admin/connectors/{name}")
async def patch_connector(name: str, payload: ConnectorPatch, request: Request):
    if payload.enabled is None and payload.endpoint_url is None:
        raise HTTPException(
            status_code=422, detail="Προσδιορίστε enabled ή endpoint_url."
        )
    item = await admin_repo.patch_connector(
        name, enabled=payload.enabled, endpoint_url=payload.endpoint_url
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Ο συνθέτης δεν βρέθηκε.")
    return ok(item, build_meta(get_request_id(request)))


# ---------------------------------------------------------------- audit
@router.get("/admin/audit")
async def list_audit(request: Request, page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200)):
    items, total, degraded = await admin_repo.list_audit(page=page, page_size=page_size)
    meta = build_meta(get_request_id(request), total=total, page=page, page_size=page_size)
    if degraded:
        meta["limitations"] = [DB_DOWN_NOTE]
    return ok(items, meta)


# ---------------------------------------------------------------- ingest
@router.post("/admin/ingest")
async def trigger_ingest(payload: IngestRequest, request: Request):
    """{ingested, skipped, errors} — triggers one connector → DB sync (contract §2)."""
    connector = sources_repo.make_connector(payload.source)
    if connector is None:
        raise HTTPException(
            status_code=404, detail="Άγνωστη πηγή. Δείτε GET /v1/admin/connectors."
        )
    source_name = payload.source

    def _persist(records):  # noqa: ANN001 — ingest persist callback (records → count)
        return admin_repo.persist_ingest_records(source_name, records)

    result = await ingest(connector, query=None, limit=50, persist=_persist)
    meta = build_meta(get_request_id(request), source=source_name)
    return ok(dict(result), meta)
