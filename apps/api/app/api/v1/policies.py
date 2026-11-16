"""Policy module (05/06): policies CRUD + variants."""
from __future__ import annotations

from typing import Any

from app.deps import get_request_id
from app.envelope import DB_DOWN_NOTE, build_meta, ok
from app.repositories import policies as policies_repo
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

router = APIRouter()


class PolicyFactor(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    label: str | None = Field(None, max_length=200)
    baseline: float = 0.0
    min: float = 0.0
    max: float = 1_000_000.0
    step: float | None = Field(None, gt=0)
    unit: str | None = Field(None, max_length=30)


class PolicyCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    description: str | None = Field(None, max_length=5000)
    changes: str | None = Field(None, max_length=5000)
    category: str = Field(..., min_length=1, max_length=100)
    area: str | None = Field(None, max_length=200)
    horizon: str | None = Field(None, max_length=100)
    parameters: dict[str, Any] = Field(default_factory=dict)
    factors: list[PolicyFactor] = Field(default_factory=list)
    budget_eur: float | None = Field(None, ge=0)
    assumptions: list[str] = Field(default_factory=list)
    kpis: list[str] = Field(default_factory=list)


class VariantCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    parameters: dict[str, Any] = Field(default_factory=dict)


@router.get("/policies")
async def list_policies(request: Request):
    items, total, degraded = await policies_repo.list_policies()
    meta = build_meta(get_request_id(request), total=total)
    if degraded:
        meta["limitations"] = [DB_DOWN_NOTE]
    return ok(items, meta)


@router.get("/policies/{id}")
async def get_policy(id: str, request: Request):
    item = await policies_repo.get_policy(id)
    if item is None:
        raise HTTPException(status_code=404, detail="Η πολιτική δεν βρέθηκε.")
    return ok(item, build_meta(get_request_id(request)))


@router.post("/policies")
async def create_policy(payload: PolicyCreate, request: Request):
    """Policy → 201 (contract §2)."""
    item = await policies_repo.create_policy(payload.model_dump())
    return JSONResponse(status_code=201, content=ok(item, build_meta(get_request_id(request))))


@router.delete("/policies/{id}")
async def delete_policy(id: str, request: Request):
    """Delete a policy and its variants (404 when it does not exist)."""
    deleted = await policies_repo.delete_policy(id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Η πολιτική δεν βρέθηκε.")
    return ok({"id": id, "deleted": True}, build_meta(get_request_id(request)))


@router.post("/policies/{id}/variants")
async def create_variant(id: str, payload: VariantCreate, request: Request):
    item = await policies_repo.add_variant(id, payload.title, payload.parameters)
    if item is None:
        raise HTTPException(status_code=404, detail="Η πολιτική δεν βρέθηκε.")
    return JSONResponse(status_code=201, content=ok(item, build_meta(get_request_id(request))))
