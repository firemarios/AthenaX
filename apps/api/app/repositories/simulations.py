"""Simulations repository — persist SimulationRun rows (DB → memory fallback)."""
from __future__ import annotations

import logging
from typing import Any

from app.repositories.common import (
    as_json,
    iso,
    mem_delete,
    mem_get,
    mem_list,
    mem_put,
    new_id,
)

logger = logging.getLogger("athenax.repositories.simulations")

TABLE = "simulation_runs"
IMPACT_TABLE = "impact_metrics"


def run_from_row(row: Any) -> dict[str, Any]:
    results = as_json(row.results, None)
    snapshot = results.get("snapshot") if isinstance(results, dict) else None
    return {
        "id": str(row.id),
        "policy_id": row.policy_id,
        "model_name": str(row.model_name or ""),
        "model_version": row.model_version,
        "parameters": as_json(row.parameters, {}) or {},
        "results": results,
        "passport": as_json(row.passport, None),
        "status": str(row.status or "queued"),
        "error": row.error,
        "seed": row.seed,
        "snapshot_mode": (snapshot or {}).get("mode") if isinstance(snapshot, dict) else None,
        "created_at": iso(row.created_at),
    }


def _sort_runs(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    items.sort(key=lambda item: str(item.get("created_at") or ""), reverse=True)
    return items


async def list_runs(policy_id: str | None = None) -> tuple[list[dict[str, Any]], int, bool]:
    rows: list[Any] = []
    degraded = False
    try:
        from app.database import session_scope
        from app.models import SimulationRun
        from sqlalchemy import select

        async with session_scope() as session:
            stmt = select(SimulationRun).order_by(SimulationRun.created_at.desc())
            if policy_id:
                stmt = stmt.where(SimulationRun.policy_id == str(policy_id))
            rows = list((await session.execute(stmt)).scalars())
    except Exception as exc:  # noqa: BLE001
        logger.debug("list_runs: DB μη διαθέσιμη (%s)", exc)
        degraded = True
        rows = []

    if rows:
        items = [run_from_row(row) for row in rows]
    else:
        items = [
            dict(item)
            for item in mem_list(TABLE)
            if not policy_id or str(item.get("policy_id")) == str(policy_id)
        ]
    items = _sort_runs(items)
    return items, len(items), degraded


async def get_run(run_id: str) -> dict[str, Any] | None:
    try:
        from app.database import session_scope
        from app.models import SimulationRun
        from sqlalchemy import select

        async with session_scope() as session:
            row = (
                await session.execute(select(SimulationRun).where(SimulationRun.id == str(run_id)))
            ).scalar_one_or_none()
            if row is not None:
                return run_from_row(row)
    except Exception:  # noqa: BLE001
        pass
    stored = mem_get(TABLE, str(run_id))
    return dict(stored) if stored is not None else None


async def create_run(payload: dict[str, Any]) -> dict[str, Any]:
    run_id = str(payload.get("id") or new_id())
    data = dict(payload)
    data["id"] = run_id
    try:
        from app.database import session_scope
        from app.models import SimulationRun

        async with session_scope() as session:
            row = SimulationRun(
                id=run_id,
                policy_id=data.get("policy_id"),
                model_name=str(data.get("model_name") or ""),
                model_version=data.get("model_version"),
                parameters=data.get("parameters") or {},
                results=data.get("results"),
                passport=data.get("passport"),
                status=str(data.get("status") or "queued"),
                error=data.get("error"),
                seed=data.get("seed"),
            )
            session.add(row)
            await session.flush()
            return run_from_row(row)
    except Exception as exc:  # noqa: BLE001
        logger.debug("create_run: DB μη διαθέσιμη (%s) — ενδομοική αποθήκευση", exc)
        data.setdefault("created_at", _now())
        return mem_put(TABLE, data)


async def update_run(run_id: str, fields: dict[str, Any]) -> dict[str, Any] | None:
    """Patch a run's mutable fields (DB → memory). Never raises."""
    wanted = str(run_id)
    clean = dict(fields)
    clean.pop("id", None)
    try:
        from app.database import session_scope
        from app.models import SimulationRun
        from sqlalchemy import select

        async with session_scope() as session:
            row = (
                await session.execute(select(SimulationRun).where(SimulationRun.id == wanted))
            ).scalar_one_or_none()
            if row is not None:
                for key in (
                    "policy_id",
                    "model_name",
                    "model_version",
                    "parameters",
                    "results",
                    "passport",
                    "status",
                    "error",
                    "seed",
                ):
                    if key in clean:
                        setattr(row, key, clean[key])
                await session.flush()
                return run_from_row(row)
    except Exception as exc:  # noqa: BLE001
        logger.debug("update_run: DB μη διαθέσιμη (%s)", exc)

    stored = mem_get(TABLE, wanted)
    if stored is None:
        return None
    updated = {**stored, **clean}
    return mem_put(TABLE, updated)


async def delete_run(run_id: str) -> bool:
    """Delete a simulation run and any persisted impact metrics (DB → memory)."""
    wanted = str(run_id)
    try:
        from app.database import session_scope
        from app.models import ImpactMetric, SimulationRun
        from sqlalchemy import delete

        async with session_scope() as session:
            await session.execute(delete(ImpactMetric).where(ImpactMetric.run_id == wanted))
            result = await session.execute(
                delete(SimulationRun).where(SimulationRun.id == wanted)
            )
            if (result.rowcount or 0) > 0:
                return True
    except Exception as exc:  # noqa: BLE001
        logger.debug("delete_run: DB μη διαθέσιμη (%s)", exc)

    if mem_delete(TABLE, wanted):
        return True
    return mem_delete(IMPACT_TABLE, wanted)


async def get_runs_by_ids(run_ids: list[str]) -> list[dict[str, Any]]:
    wanted = [str(rid) for rid in run_ids if rid]
    if not wanted:
        return []
    items: list[dict[str, Any]] = []
    try:
        from app.database import session_scope
        from app.models import SimulationRun
        from sqlalchemy import select

        async with session_scope() as session:
            rows = (
                await session.execute(select(SimulationRun).where(SimulationRun.id.in_(wanted)))
            ).scalars()
            items = [run_from_row(row) for row in rows]
    except Exception:  # noqa: BLE001
        items = []
    if not items:
        items = [dict(MEM_row) for rid in wanted if (MEM_row := mem_get(TABLE, rid)) is not None]
    return items


def _now() -> str:
    from app.repositories.common import utcnow_iso

    return utcnow_iso()
