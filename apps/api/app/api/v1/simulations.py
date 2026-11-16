"""Policy module (06/08): simulations list/detail/create + passport persistence."""
from __future__ import annotations

import logging
from typing import Any

from app.deps import get_request_id
from app.envelope import DB_DOWN_NOTE, build_meta, ok
from app.repositories import datasets as datasets_repo
from app.repositories import policies as policies_repo
from app.repositories import simulations as simulations_repo
from app.repositories import sources as sources_repo
from app.repositories.common import new_id, utcnow_iso
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request
from pydantic import BaseModel, Field

from services.ai_engine.policy_planner import plan_policy_simulation
from services.ai_engine.report_composer import compose_simulation_report
from services.data_ingestion.snapshot import build_snapshot, summarise
from services.reporting_engine.economics import BENCHMARKS, compute_economics
from services.reporting_engine.sensitivity import compute_sensitivity
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
    seed: int | None = Field(None, ge=0, description="Seed for a reproducible run")


def _model_version(name: str) -> str:
    try:
        return str(get_model(name).version)
    except Exception:  # noqa: BLE001 — unknown model → "unknown"
        return "unknown"


async def _build_grounding(
    *,
    area_ref: Any,
    model_name: str,
    policy: dict[str, Any] | None,
    payload: SimulationCreate,
    snapshot: dict[str, Any] | None,
) -> dict[str, Any]:
    """Real data the planner must use instead of guessing (never raises)."""
    grounding: dict[str, Any] = {"benchmarks": BENCHMARKS}
    if snapshot:
        grounding["snapshot_mode"] = snapshot.get("mode")
        grounding["retrieved_at"] = snapshot.get("retrieved_at")
        grounding["area_profile"] = snapshot.get("reach") or {}
        grounding["observed"] = snapshot.get("observed") or {}
        grounding["coverage"] = snapshot.get("coverage") or {}
        grounding["sources"] = [
            {
                "name": str(src.get("name") or ""),
                "url": src.get("url"),
                "kind": src.get("kind"),
                "retrieved_at": src.get("retrieved_at"),
            }
            for src in (snapshot.get("sources") or [])[:8]
            if isinstance(src, dict) and src.get("name")
        ]

    query = " ".join(
        part
        for part in (
            str((policy or {}).get("title") or ""),
            str(payload.changes or ""),
            str((policy or {}).get("category") or ""),
            str(area_ref or ""),
        )
        if part
    )
    if query:
        try:
            rows = await datasets_repo.search_relevant_datasets(query, limit=5)
            grounding["datasets"] = [
                {
                    "title": str(row.get("title") or ""),
                    "provider": row.get("provider"),
                    "url": row.get("source_url") or None,
                }
                for row in rows
            ]
        except Exception as exc:  # noqa: BLE001
            logger.debug("grounding datasets skipped: %s", exc)

    try:
        items, _, _ = await sources_repo.list_sources()
        grounding["source_registry"] = [
            {
                "name": str(item.get("name") or item.get("id") or ""),
                "provider": item.get("provider"),
                "url": item.get("base_url") or None,
                "license": item.get("license"),
                "status": item.get("status"),
            }
            for item in items[:12]
            if isinstance(item, dict)
        ]
    except Exception as exc:  # noqa: BLE001
        logger.debug("grounding registry skipped: %s", exc)

    try:
        runs, _, _ = await simulations_repo.list_runs()
        comparables: list[dict[str, Any]] = []
        for run in runs:
            results = run.get("results") or {}
            economics = results.get("economics") if isinstance(results, dict) else None
            if not isinstance(economics, dict) or not economics:
                continue
            same_model = run.get("model_name") == model_name
            same_area = str((run.get("parameters") or {}).get("area_id") or "") == str(
                area_ref or ""
            )
            if not (same_model or same_area):
                continue
            comparables.append(
                {
                    "model": run.get("model_name"),
                    "area": (run.get("parameters") or {}).get("area_id"),
                    "capex_eur": economics.get("capex_eur"),
                    "annual_benefit_eur": economics.get("annual_benefit_eur"),
                    "benefit_cost_ratio": economics.get("benefit_cost_ratio"),
                    "verdict": economics.get("verdict"),
                }
            )
            if len(comparables) >= 5:
                break
        grounding["comparables"] = comparables
    except Exception as exc:  # noqa: BLE001
        logger.debug("grounding comparables skipped: %s", exc)

    return grounding


def _grounding_summary(grounding: dict[str, Any]) -> dict[str, Any]:
    return {
        "snapshot_mode": grounding.get("snapshot_mode"),
        "retrieved_at": grounding.get("retrieved_at"),
        "area_profile": grounding.get("area_profile") or {},
        "sources": [
            src.get("name")
            for src in (grounding.get("sources") or [])[:6]
            if isinstance(src, dict) and src.get("name")
        ],
        "datasets": [
            row.get("title")
            for row in (grounding.get("datasets") or [])[:5]
            if isinstance(row, dict) and row.get("title")
        ],
        "comparables": len(grounding.get("comparables") or []),
    }


async def _ensure_economics(item: dict[str, Any]) -> None:
    """Recompute a missing/unknown verdict so old runs also show "worth it"."""
    if str(item.get("status") or "") != "succeeded":
        return
    results = item.get("results")
    if not isinstance(results, dict):
        return
    economics = results.get("economics")
    verdict = str((economics or {}).get("verdict") or "").lower() if isinstance(economics, dict) else ""
    if verdict not in ("", "unknown"):
        return

    ai = results.get("ai") if isinstance(results.get("ai"), dict) else {}
    tax = ai.get("tax") if isinstance(ai.get("tax"), dict) else {}
    benefit = ai.get("benefit") if isinstance(ai.get("benefit"), dict) else {}

    budget_eur: float | None = None
    policy_id = item.get("policy_id")
    if policy_id:
        try:
            policy = await policies_repo.get_policy(str(policy_id))
            if policy and policy.get("budget_eur") is not None:
                budget_eur = float(policy["budget_eur"])
        except Exception:  # noqa: BLE001
            budget_eur = None

    baseline = results.get("baseline")
    results["economics"] = compute_economics(
        str(item.get("model_name") or ""),
        dict(item.get("parameters") or {}),
        dict(results.get("metrics") or {}),
        baseline if isinstance(baseline, dict) else None,
        budget_eur=budget_eur,
        annual_tax_revenue_eur=tax.get("annual_tax_revenue_eur"),
        new_buildings=tax.get("new_buildings"),
        annual_benefit_eur=benefit.get("annual_benefit_eur"),
    )


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
    try:
        await _ensure_economics(item)
    except Exception as exc:  # noqa: BLE001 — never fail a read because of economics
        logger.warning("ensure_economics: %s", exc)
    return ok(item, build_meta(get_request_id(request)))


@router.delete("/simulations/{id}")
async def delete_simulation(id: str, request: Request):
    """Delete a simulation run (404 when it does not exist)."""
    deleted = await simulations_repo.delete_run(id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Η προσομοίωση δεν βρέθηκε.")
    return ok({"id": id, "deleted": True}, build_meta(get_request_id(request)))


@router.post("/simulations")
async def create_simulation(
    payload: SimulationCreate, request: Request, background: BackgroundTasks
):
    """Create and persist a simulation run.

    AI runs take minutes (planner + composer LLMs), longer than most proxies allow,
    so they are created as status "running" and executed in a background task while
    the client polls GET /simulations/{id}. Deterministic runs stay synchronous.
    """
    if payload.use_ai:
        run_id = new_id()
        run: dict[str, Any] = {
            "id": run_id,
            "policy_id": payload.policy_id,
            "model_name": payload.model or "",
            "model_version": "unknown",
            "parameters": dict(payload.parameters or {}),
            "results": None,
            "passport": None,
            "status": "running",
            "error": None,
            "seed": payload.seed,
            "snapshot_mode": None,
            "assumptions": [],
            "warnings": [],
            "logs": [],
            "created_at": utcnow_iso(),
        }
        try:
            persisted = await simulations_repo.create_run(run)
        except Exception as exc:  # noqa: BLE001 — persistence must never 500
            logger.warning("create_run (running): %s", exc)
            persisted = run
        background.add_task(
            _execute_simulation,
            run_id=str(persisted.get("id") or run_id),
            payload=payload,
        )
        return ok(persisted, build_meta(get_request_id(request)))

    run = await _execute_simulation(run_id=None, payload=payload)
    return ok(run, build_meta(get_request_id(request)))


async def _execute_simulation(
    *, run_id: str | None, payload: SimulationCreate
) -> dict[str, Any]:
    """Run the model (and AI planner when requested), then persist or update the run."""
    try:
        return await _run_simulation(run_id=run_id, payload=payload)
    except Exception as exc:  # noqa: BLE001 — never leave a run stuck on "running"
        logger.exception("simulation failed: %s", exc)
        failure: dict[str, Any] = {
            "results": None,
            "passport": None,
            "status": "failed",
            "error": str(exc),
            "warnings": [str(exc)],
            "logs": [],
        }
        if run_id:
            try:
                updated = await simulations_repo.update_run(run_id, failure)
                if updated is not None:
                    return updated
            except Exception:  # noqa: BLE001
                pass
            return {"id": run_id, **failure}
        return {
            "id": new_id(),
            "policy_id": payload.policy_id,
            "model_name": payload.model,
            "model_version": "unknown",
            "parameters": dict(payload.parameters or {}),
            "seed": payload.seed,
            "created_at": utcnow_iso(),
            **failure,
        }


async def _run_simulation(
    *, run_id: str | None, payload: SimulationCreate
) -> dict[str, Any]:
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
    area_ref: Any = (
        payload.area
        or parameters.get("area_id")
        or (policy or {}).get("area")
    )
    snapshot: dict[str, Any] | None = None
    if area_ref:
        try:
            snapshot = await build_snapshot(str(area_ref))
        except Exception as exc:  # noqa: BLE001 — snapshot never blocks a run
            logger.info("snapshot unavailable for %s: %s", area_ref, exc)

    ai_plan: dict[str, Any] | None = None
    grounding: dict[str, Any] | None = None
    if payload.use_ai:
        grounding = await _build_grounding(
            area_ref=area_ref,
            model_name=model_name or "accessibility",
            policy=policy,
            payload=payload,
            snapshot=snapshot,
        )
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
            grounding=grounding,
        )
        model_name = str(ai_plan.get("model") or model_name or "accessibility")
        parameters = dict(ai_plan.get("parameters") or {})

    if payload.area and "area_id" not in parameters:
        parameters["area_id"] = payload.area

    resolved_area = (
        payload.area
        or parameters.get("area_id")
        or (policy or {}).get("area")
    )
    if resolved_area and str(resolved_area) != str(area_ref or ""):
        area_ref = resolved_area
        try:
            snapshot = await build_snapshot(str(area_ref))
        except Exception as exc:  # noqa: BLE001
            logger.info("snapshot unavailable for %s: %s", area_ref, exc)

    try:
        result = run_model(
            model_name,
            parameters,
            snapshot=snapshot,
            seed=payload.seed,
            compare_baseline=bool(payload.compare_baseline),
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
            passport = build_passport(
                model_name, parameters, snapshot=snapshot, seed=result.get("seed")
            )
        except Exception:  # noqa: BLE001
            passport = None

    tax_plan = (ai_plan or {}).get("tax") if isinstance(ai_plan, dict) else None
    annual_tax = tax_plan.get("annual_tax_revenue_eur") if isinstance(tax_plan, dict) else None
    new_buildings = tax_plan.get("new_buildings") if isinstance(tax_plan, dict) else None
    benefit_plan = (ai_plan or {}).get("benefit") if isinstance(ai_plan, dict) else None
    annual_benefit = (
        benefit_plan.get("annual_benefit_eur") if isinstance(benefit_plan, dict) else None
    )

    results: dict[str, Any] | None = None
    if status == "succeeded":
        metrics = dict(result.get("metrics") or {})
        baseline = result.get("baseline")
        results = {
            "metrics": metrics,
            "baseline": baseline,
            "uncertainty": dict(result.get("uncertainty") or {}),
        }
        if snapshot is not None:
            results["snapshot"] = summarise(snapshot)
        if grounding is not None:
            results["grounding"] = _grounding_summary(grounding)
        try:
            results["economics"] = compute_economics(
                model_name,
                parameters,
                metrics,
                baseline if isinstance(baseline, dict) else None,
                budget_eur=budget_eur,
                annual_tax_revenue_eur=annual_tax,
                new_buildings=new_buildings,
                annual_benefit_eur=annual_benefit,
            )
        except Exception as exc:  # noqa: BLE001 — economics must not fail the run
            logger.warning("compute_economics: %s", exc)

        try:
            sensitivity = compute_sensitivity(
                model_name,
                parameters,
                metrics,
                snapshot=snapshot,
                seed=result.get("seed"),
            )
            if sensitivity:
                results["sensitivity"] = sensitivity
        except Exception as exc:  # noqa: BLE001 — sensitivity must not fail the run
            logger.warning("compute_sensitivity: %s", exc)

        if ai_plan is not None:
            if ai_plan.get("ai_used"):
                composed = await compose_simulation_report(
                    policy=policy,
                    plan=ai_plan,
                    metrics=metrics,
                    baseline=baseline if isinstance(baseline, dict) else None,
                    uncertainty=results.get("uncertainty"),
                    economics=results.get("economics"),
                    passport=passport,
                    warnings=warnings,
                )
                if composed:
                    ai_plan.update(composed)
            results["ai"] = ai_plan

    run: dict[str, Any] = {
        "id": run_id or new_id(),
        "policy_id": payload.policy_id,
        "model_name": model_name,
        "model_version": _model_version(model_name),
        "parameters": parameters,
        "results": results,
        "passport": passport,
        "status": status,
        "error": warnings[0] if status != "succeeded" else None,
        "seed": result.get("seed"),
        "snapshot_mode": (snapshot or {}).get("mode"),
        "assumptions": list(result.get("assumptions") or []),
        "warnings": warnings,
        "logs": list(result.get("logs") or []),
        "created_at": utcnow_iso(),
    }

    if run_id:
        updated = await simulations_repo.update_run(run_id, run)
        return updated if updated is not None else run

    try:
        persisted = await simulations_repo.create_run(run)
    except Exception as exc:  # noqa: BLE001 — persistence must never 500
        logger.warning("create_run: %s", exc)
        persisted = run
    return persisted
