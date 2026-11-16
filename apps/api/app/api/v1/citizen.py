"""Citizen Lab module (07): consultations, proposals, comments."""
from __future__ import annotations

from app.deps import get_request_id
from app.envelope import DB_DOWN_NOTE, build_meta, ok
from app.repositories import citizen as citizen_repo
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

router = APIRouter()


class ConsultationCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    description: str = Field("", max_length=5000)
    status: str = Field("open", max_length=30)
    starts_at: str | None = Field(None, max_length=40)
    ends_at: str | None = Field(None, max_length=40)


class ProposalCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    description: str = Field("", max_length=5000)
    area: str | None = Field(None, max_length=200)
    category: str | None = Field(None, max_length=100)
    id: str | None = Field(None, max_length=32)


class CommentCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=5000)


# ---------------------------------------------------------------- consultations
@router.get("/consultations")
async def list_consultations(request: Request):
    items, total, degraded = await citizen_repo.list_consultations()
    meta = build_meta(get_request_id(request), total=total)
    if degraded:
        meta["limitations"] = [DB_DOWN_NOTE]
    return ok(items, meta)


@router.post("/consultations")
async def create_consultation(payload: ConsultationCreate, request: Request):
    item = await citizen_repo.create_consultation(payload.model_dump())
    return JSONResponse(status_code=201, content=ok(item, build_meta(get_request_id(request))))


@router.get("/consultations/{id}")
async def get_consultation(id: str, request: Request):
    item = await citizen_repo.get_consultation(id)
    if item is None:
        raise HTTPException(status_code=404, detail="Η διαβούλευση δεν βρέθηκε.")
    return ok(item, build_meta(get_request_id(request)))


@router.delete("/consultations/{id}")
async def delete_consultation(id: str, request: Request):
    """Delete a consultation with its proposals and comments."""
    deleted = await citizen_repo.delete_consultation(id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Η διαβούλευση δεν βρέθηκε.")
    return ok({"id": id, "deleted": True}, build_meta(get_request_id(request)))


# ---------------------------------------------------------------- proposals
@router.get("/proposals")
async def list_proposals(request: Request):
    items, total, degraded = await citizen_repo.list_proposals()
    meta = build_meta(get_request_id(request), total=total)
    if degraded:
        meta["limitations"] = [DB_DOWN_NOTE]
    return ok(items, meta)


@router.post("/proposals")
async def create_proposal(payload: ProposalCreate, request: Request):
    item = await citizen_repo.create_proposal(payload.model_dump())
    return JSONResponse(status_code=201, content=ok(item, build_meta(get_request_id(request))))


@router.get("/proposals/{id}")
async def get_proposal(id: str, request: Request):
    item = await citizen_repo.get_proposal(id)
    if item is None:
        raise HTTPException(status_code=404, detail="Η πρόταση δεν βρέθηκε.")
    return ok(item, build_meta(get_request_id(request)))


@router.delete("/proposals/{id}")
async def delete_proposal(id: str, request: Request):
    """Delete a proposal and its comments."""
    deleted = await citizen_repo.delete_proposal(id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Η πρόταση δεν βρέθηκε.")
    return ok({"id": id, "deleted": True}, build_meta(get_request_id(request)))


# ---------------------------------------------------------------- comments
@router.get("/proposals/{id}/comments")
async def list_comments(id: str, request: Request):
    item = await citizen_repo.get_proposal(id)
    if item is None:
        raise HTTPException(status_code=404, detail="Η πρόταση δεν βρέθηκε.")
    items, total, degraded = await citizen_repo.list_comments(id)
    meta = build_meta(get_request_id(request), total=total)
    if degraded:
        meta["limitations"] = [DB_DOWN_NOTE]
    return ok(items, meta)


@router.post("/proposals/{id}/comments")
async def create_comment(id: str, payload: CommentCreate, request: Request):
    item = await citizen_repo.create_comment(id, payload.body)
    if item is None:
        raise HTTPException(status_code=404, detail="Η πρόταση δεν βρέθηκε.")
    return JSONResponse(status_code=201, content=ok(item, build_meta(get_request_id(request))))


@router.delete("/proposals/{id}/comments/{comment_id}")
async def delete_comment(id: str, comment_id: str, request: Request):
    """Delete a single comment that belongs to the proposal."""
    deleted = await citizen_repo.delete_comment(id, comment_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Το σχόλιο δεν βρέθηκε.")
    return ok({"id": comment_id, "deleted": True}, build_meta(get_request_id(request)))
