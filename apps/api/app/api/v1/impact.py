"""Policy module (08): GET /v1/impact/{run_id} — 6-dimension ImpactReport (§5.6)."""
from __future__ import annotations

from app.deps import get_request_id
from app.envelope import build_meta, ok
from app.repositories import simulations as simulations_repo
from fastapi import APIRouter, HTTPException, Request

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
    economics = results.get("economics") if results else None
    ai = results.get("ai") if results else None
    ai_impact = ai.get("impact") if isinstance(ai, dict) else None
    optimization = ai.get("optimization") if isinstance(ai, dict) else None
    snapshot = results.get("snapshot") if results else None
    reach = snapshot.get("reach") if isinstance(snapshot, dict) else None
    reach = dict(reach) if isinstance(reach, dict) else {}
    parameters = run.get("parameters") if isinstance(run.get("parameters"), dict) else {}
    if reach.get("population") is None and parameters.get("population") is not None:
        try:
            reach["population"] = int(float(parameters["population"]))
        except (TypeError, ValueError):
            pass
    if reach.get("facilities") is None and parameters.get("facility_count") is not None:
        try:
            reach["facilities"] = int(float(parameters["facility_count"]))
        except (TypeError, ValueError):
            pass

    report = compute_impact(
        {"run_id": run_id, **metrics},
        baseline=baseline,
        economics=economics if isinstance(economics, dict) else None,
        ai_impact=ai_impact if isinstance(ai_impact, list) else None,
        reach=reach,
    )
    report["run_id"] = run_id
    report["snapshot"] = snapshot if isinstance(snapshot, dict) else None
    if isinstance(optimization, dict):
        report["optimization"] = optimization
    return ok(report, build_meta(get_request_id(request)))
