"""Policy module (08): GET /v1/impact/{run_id} — 6-dimension ImpactReport (§5.6)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from app.deps import get_request_id
from app.envelope import build_meta, ok
from app.repositories import simulations as simulations_repo
from services.reporting_engine.impact import compute_impact

router = APIRouter()


@router.get("/impact/{run_id}")
async def impact(run_id: str, request: Request):
    """ImpactReport over the run's metrics/baseline (6 dimensions, contract §5.6)."""
    run = await simulations_repo.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Η προσομοίωση δεν βρέθηκε.")
    results = run.get("results") if isinstance(run.get("results"), dict) else {}
    metrics = dict(results.get("metrics") or {}) if results else {}
    baseline = results.get("baseline") if results else None

    report = compute_impact({"run_id": run_id, **metrics}, baseline=baseline)
    report["run_id"] = run_id
    return ok(report, build_meta(get_request_id(request)))
