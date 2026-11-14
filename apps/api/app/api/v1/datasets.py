"""Data module (01): datasets list/detail/versions/quality recompute."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from app.deps import get_request_id
from app.envelope import DB_DOWN_NOTE, build_meta, ok
from app.repositories import datasets as datasets_repo
from fastapi import APIRouter, HTTPException, Query, Request

from services.data_ingestion.quality import score_quality

logger = logging.getLogger("policylab.api.datasets")

router = APIRouter()


@router.get("/datasets")
async def list_datasets(
    request: Request,
    q: str | None = Query(None),
    source_id: str | None = Query(None),
    tag: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort: str = Query("freshness"),
):
    """Dataset[] + meta.total/page/page_size (search q across title/description)."""
    items, total, degraded = await datasets_repo.list_datasets(
        q=q, source_id=source_id, tag=tag, page=page, page_size=page_size, sort=sort
    )
    meta = build_meta(get_request_id(request), total=total, page=page, page_size=page_size)
    if degraded:
        meta["limitations"] = [DB_DOWN_NOTE]
    return ok(items, meta)


@router.get("/datasets/{id}")
async def get_dataset(id: str, request: Request):
    item = await datasets_repo.get_dataset(id)
    if item is None:
        raise HTTPException(status_code=404, detail="Το dataset δεν βρέθηκε.")
    return ok(item, build_meta(get_request_id(request)))


@router.get("/datasets/{id}/versions")
async def dataset_versions(id: str, request: Request):
    item = await datasets_repo.get_dataset(id)
    if item is None:
        raise HTTPException(status_code=404, detail="Το dataset δεν βρέθηκε.")
    items, degraded = await datasets_repo.list_versions(id)
    meta = build_meta(get_request_id(request), total=len(items))
    if degraded:
        meta["limitations"] = [DB_DOWN_NOTE]
    return ok(items, meta)


def _scoring_record(dataset: dict[str, Any]) -> dict[str, Any]:
    """Project the Dataset shape onto the record keys score_quality expects (§5.3)."""
    source = dataset.get("original_source") or {}
    provenance = dataset.get("provenance") or {}
    return {
        "title": dataset.get("title"),
        "source_url": source.get("url"),
        "description": dataset.get("description"),
        "provider": dataset.get("provider") or source.get("name"),
        "license": dataset.get("license"),
        "category": dataset.get("category"),
        "tags": dataset.get("tags") or [],
        "published_at": dataset.get("last_updated"),
        "updated_at": dataset.get("last_updated") or provenance.get("retrieved_at"),
        "lat": None,
        "lon": None,
    }


def _parse_dt(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    except ValueError:
        return None


@router.post("/datasets/{id}/quality")
async def recompute_quality(id: str, request: Request):
    """QualityReport — recompute via services.data_ingestion.score_quality (§5.3)."""
    dataset = await datasets_repo.get_dataset(id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Το dataset δεν βρέθηκε.")
    fetched_at = _parse_dt(
        (dataset.get("provenance") or {}).get("retrieved_at") or dataset.get("fetched_at")
    )
    quality = score_quality(_scoring_record(dataset), fetched_at)
    report = {
        "id": id,
        **quality,
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }
    stored = await datasets_repo.save_quality_report(id, report)
    return ok(stored or report, build_meta(get_request_id(request)))
