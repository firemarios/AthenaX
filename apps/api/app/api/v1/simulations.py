"""Policy module (06/08): simulations list/detail/create + passport persistence."""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from app.deps import get_request_id
from app.envelope import DB_DOWN_NOTE, build_meta, ok
from app.repositories import policies as policies_repo
from app.repositories import simulations as simulations_repo
from app.repositories.common import new_id, utcnow_iso
from services.ai_engine.policy_planner import plan_policy_simulation
from services.reporting_engine.economics import compute_economics
from services.simulation_engine.registry import get_model
from services.simulation_engine.runner import build_passport, run_model

logger = logging.getLogger("policylab.api.simulations")

router = APIRouter()


class SimulationCreate(BaseModel):
    model: str = Field("", max_length=100, description="Model name")
    parameters: dict[str, Any] = Field(default_factory=dict)
    policy_id: str | None = Field(None, max_length=32)
    area: str | None = Field(None, max_length=120)
    changes: str | None = Field(None, max_length=5000)
    compare_baseline: bool = False
    budget_eur: float | None = Field(None, ge=0)
    use_ai: bool = False


def _model_version(name: str) -> str:
    try:
        return str(get_model(name).version)
    except Exception:  # noqa: BLE001 — unknown model → "unknown"
        return "unknown"


@router.get("/simulations")
async def list_simulations(
    request: Request, policy_id: str | None = Query(None)
):
    items, total, degraded = await simulations_repo.list_runs(policy_id=policy_id)
    meta = build_meta(get_request_id(request), total=total)
    if policy_id:
        meta["policy_id"] = policy_id
    if degraded:
        meta["limitations"] = [DB_DOWN_NOTE]
    return ok(items, meta)


@router.get("/simulations/{id}")
async def get_simulation(id: str, request: Request):
    item = await simulations_repo.get_run(id)
    if item is None:
        raise HTTPException(status_code=404, detail="Η προσομοίωση δεν βρέθηκε.")
    return ok(item, build_meta(get_request_id(request)))


@router.post("/simulations")
async def create_simulation(payload: SimulationCreate, request: Request):
    """Execute the model in-process and persist run + passport (contract §2/§5.5).

    Failures (incl. unknown models) → status "failed" with envelope ok:true.
    """
    parameters = dict(payload.parameters or {})
    policy: dict[str, Any] | None = None
    if payload.policy_id:
        try:
            policy = await policies_repo.get_policy(payload.policy_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning("policy lookup failed: %s", exc)

    budget_eur = payload.budget_eur
    if budget_eur is None and policy and policy.get("budget_eur") is not None:
        try:
            budget_eur = float(policy["budget_eur"])
        except (TypeError, ValueError):
            budget_eur = None

    model_name = payload.model
    ai_plan: dict[str, Any] | None = None
    if payload.use_ai:
        ai_plan = await plan_policy_simulation(
            title=str((policy or {}).get("title") or "Policy simulation"),
            description=(policy or {}).get("description"),
            changes=payload.changes or (policy or {}).get("changes"),
            category=(policy or {}).get("category"),
            area=payload.area or (policy or {}).get("area"),
            horizon=(policy or {}).get("horizon"),
            factors=(policy or {}).get("factors") or [],
            parameters=parameters,
            budget_eur=budget_eur,
            model=payload.model or None,
        )
        model_name = str(ai_plan.get("model") or model_name or "accessibility")
        parameters = dict(ai_plan.get("parameters") or {})

    if payload.area and "area_id" not in parameters:
        parameters["area_id"] = payload.area

    try:
        result = run_model(
            model_name, parameters, compare_baseline=bool(payload.compare_baseline)
        )
    except Exception as exc:  # noqa: BLE001 — run_model must never raise; belt & braces
        logger.warning("run_model εξαιρέθηκε: %s", exc)
        result = {
            "status": "failed",
            "metrics": {},
            "baseline": None,
            "uncertainty": {},
            "assumptions": [],
            "warnings": [f"Σφάλμα εκτέλεσης μοντέλου {model_name}: {exc}"],
            "logs": [],
            "seed": None,
        }

    status = str(result.get("status") or "failed")
    warnings = [str(w) for w in (result.get("warnings") or []) if w]
    passport = result.get("passport")
    if not isinstance(passport, dict):
        try:
            passport = build_passport(model_name, parameters, seed=result.get("seed"))
        except Exception:  # noqa: BLE001
            passport = None

    tax_plan = (ai_plan or {}).get("tax") if isinstance(ai_plan, dict) else None
    annual_tax = tax_plan.get("annual_tax_revenue_eur") if isinstance(tax_plan, dict) else None
    new_buildings = tax_plan.get("new_buildings") if isinstance(tax_plan, dict) else None

    results: dict[str, Any] | None = None
    if status == "succeeded":
        metrics = dict(result.get("metrics") or {})
        baseline = result.get("baseline")
        results = {
            "metrics": metrics,
            "baseline": baseline,
            "uncertainty": dict(result.get("uncertainty") or {}),
        }
        if ai_plan is not None:
            results["ai"] = ai_plan
        try:
            results["economics"] = compute_economics(
                model_name,
                parameters,
                metrics,
                baseline if isinstance(baseline, dict) else None,
                budget_eur=budget_eur,
                annual_tax_revenue_eur=annual_tax,
                new_buildings=new_buildings,
            )
        except Exception as exc:  # noqa: BLE001 — economics must not fail the run
            logger.warning("compute_economics: %s", exc)

    run: dict[str, Any] = {
        "id": new_id(),
        "policy_id": payload.policy_id,
        "model_name": model_name,
        "model_version": _model_version(model_name),
        "parameters": parameters,
        "results": results,
        "passport": passport,
        "status": status,
        "error": warnings[0] if status != "succeeded" else None,
        "seed": result.get("seed"),
        "assumptions": list(result.get("assumptions") or []),
        "warnings": warnings,
        "logs": list(result.get("logs") or []),
        "created_at": utcnow_iso(),
    }

    try:
        persisted = await simulations_repo.create_run(run)
    except Exception as exc:  # noqa: BLE001 — persistence must never 500
        logger.warning("create_run: %s", exc)
        persisted = run

    meta = build_meta(get_request_id(request))
    return ok(persisted, meta)
