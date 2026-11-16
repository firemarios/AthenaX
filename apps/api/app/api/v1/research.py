"""Research module (09): projects + experiments + export (md/csv/json)."""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.deps import get_request_id
from app.envelope import DB_DOWN_NOTE, build_meta, ok
from app.repositories import research as research_repo
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

from services.reporting_engine.reports import build_research_report, to_csv

logger = logging.getLogger("policylab.api.research")

router = APIRouter()


class ResearchCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=300)
    description: str | None = Field(None, max_length=5000)


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9._-]+", "-", str(value or "export")).strip("-").lower()
    return slug or "export"


@router.get("/research/projects")
async def list_projects(request: Request):
    items, total, degraded = await research_repo.list_projects()
    meta = build_meta(get_request_id(request), total=total)
    if degraded:
        meta["limitations"] = [DB_DOWN_NOTE]
    return ok(items, meta)


@router.post("/research/projects")
async def create_project(payload: ResearchCreate, request: Request):
    item = await research_repo.create_project(payload.model_dump())
    return JSONResponse(status_code=201, content=ok(item, build_meta(get_request_id(request))))


@router.get("/research/projects/{id}")
async def get_project(id: str, request: Request):
    item = await research_repo.get_project(id)
    if item is None:
        raise HTTPException(status_code=404, detail="Το ερευνητικό έργο δεν βρέθηκε.")
    return ok(item, build_meta(get_request_id(request)))


@router.delete("/research/projects/{id}")
async def delete_project(id: str, request: Request):
    """Delete a research project and its experiments."""
    deleted = await research_repo.delete_project(id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Το ερευνητικό έργο δεν βρέθηκε.")
    return ok({"id": id, "deleted": True}, build_meta(get_request_id(request)))


def _metric_rows(runs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for run in runs or []:
        results = run.get("results") if isinstance(run.get("results"), dict) else {}
        metrics = (results or {}).get("metrics") or {}
        baseline = (results or {}).get("baseline") or {}
        for key in sorted(metrics):
            rows.append(
                {
                    "run_id": run.get("id"),
                    "model": run.get("model_name"),
                    "status": run.get("status"),
                    "metric": key,
                    "value": metrics.get(key),
                    "baseline": baseline.get(key),
                }
            )
    return rows


@router.get("/research/projects/{id}/export")
async def export_project(
    id: str,
    request: Request,
    format: str = Query("md", description="md | csv | json"),
):
    """File export (text/markdown | text/csv | application/json) with provenance section."""
    project = await research_repo.get_project(id)
    if project is None:
        raise HTTPException(status_code=404, detail="Το ερευνητικό έργο δεν βρέθηκε.")
    runs = await research_repo.runs_for_project(project)

    fmt = str(format or "md").lower()
    if fmt == "md":
        body = build_research_report(project, runs)
        media_type = "text/markdown; charset=utf-8"
        filename = f"{_slug(project.get('name'))}.md"
    elif fmt == "csv":
        body = to_csv(_metric_rows(runs))
        media_type = "text/csv; charset=utf-8"
        filename = f"{_slug(project.get('name'))}.csv"
    elif fmt == "json":
        body = json.dumps({"project": project, "runs": runs}, ensure_ascii=False, default=str)
        media_type = "application/json; charset=utf-8"
        filename = f"{_slug(project.get('name'))}.json"
    else:
        raise HTTPException(
            status_code=400,
            detail="Μη έγκυρο format. Επιτρεπτά: md, csv, json.",
        )

    return Response(
        content=body,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
