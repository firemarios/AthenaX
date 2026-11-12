"""Policy module (05/06): GET /v1/models — ModelSpec[] from the simulation registry."""
from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Request

from app.deps import get_request_id
from app.envelope import build_meta, ok
from services.simulation_engine.registry import list_models

router = APIRouter()


@router.get("/models")
async def models(request: Request):
    """ModelSpec[] (name, version, category, description, parameters) as-is (§5.5)."""
    specs = [asdict(spec) for spec in list_models()]
    return ok(specs, build_meta(get_request_id(request), total=len(specs)))
