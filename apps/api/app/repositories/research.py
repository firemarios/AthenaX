"""Research repository — research_projects + experiments (DB → memory, never raises)."""
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

logger = logging.getLogger("athenax.repositories.research")

PROJECTS = "research_projects"
EXPERIMENTS = "experiments"


def project_from_row(row: Any, experiments: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "name": str(row.name or ""),
        "description": row.description,
        "experiments": experiments or [],
        "created_at": iso(row.created_at),
    }


def experiment_from_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "project_id": str(row.project_id),
        "title": str(row.title or ""),
        "model": row.model,
        "run_ids": list(as_json(row.run_ids, []) or []),
        "notes": row.notes,
        "created_at": iso(row.created_at),
    }


async def _experiments_for(project_id: str) -> list[dict[str, Any]]:
    try:
        from app.database import session_scope
        from app.models import Experiment
        from sqlalchemy import select

        async with session_scope() as session:
            rows = (
                await session.execute(
                    select(Experiment)
                    .where(Experiment.project_id == str(project_id))
                    .order_by(Experiment.created_at)
                )
            ).scalars()
            return [experiment_from_row(row) for row in rows]
    except Exception:  # noqa: BLE001
        return [
            dict(item)
            for item in mem_list(EXPERIMENTS)
            if str(item.get("project_id")) == str(project_id)
        ]


async def list_projects() -> tuple[list[dict[str, Any]], int, bool]:
    degraded = False
    try:
        from app.database import session_scope
        from app.models import ResearchProject
        from sqlalchemy import select

        async with session_scope() as session:
            rows = list(
                (
                    await session.execute(
                        select(ResearchProject).order_by(ResearchProject.created_at.desc())
                    )
                ).scalars()
            )
        items = [project_from_row(row, await _experiments_for(str(row.id))) for row in rows]
    except Exception as exc:  # noqa: BLE001
        logger.debug("research.list_projects: DB μη διαθέσιμη (%s)", exc)
        degraded = True
        items = []
        for stored in mem_list(PROJECTS):
            experiments = [
                dict(item)
                for item in mem_list(EXPERIMENTS)
                if str(item.get("project_id")) == str(stored.get("id"))
            ]
            items.append(dict(stored, experiments=experiments))
        items.sort(key=lambda item: str(item.get("created_at") or ""), reverse=True)
    return items, len(items), degraded


async def get_project(project_id: str) -> dict[str, Any] | None:
    try:
        from app.database import session_scope
        from app.models import ResearchProject
        from sqlalchemy import select

        async with session_scope() as session:
            row = (
                await session.execute(
                    select(ResearchProject).where(ResearchProject.id == str(project_id))
                )
            ).scalar_one_or_none()
            if row is not None:
                return project_from_row(row, await _experiments_for(str(row.id)))
    except Exception:  # noqa: BLE001
        pass
    stored = mem_get(PROJECTS, str(project_id))
    if stored is None:
        return None
    return dict(stored, experiments=await _experiments_for(str(stored["id"])))


async def create_project(payload: dict[str, Any]) -> dict[str, Any]:
    project_id = new_id()
    data = {
        "id": project_id,
        "name": str(payload.get("name") or ""),
        "description": payload.get("description"),
        "created_at": _now(),
    }
    try:
        from app.database import session_scope
        from app.models import ResearchProject

        async with session_scope() as session:
            row = ResearchProject(id=project_id, name=data["name"], description=data["description"])
            session.add(row)
            await session.flush()
            return project_from_row(row, [])
    except Exception as exc:  # noqa: BLE001
        logger.debug("research.create_project: DB μη διαθέσιμη (%s)", exc)
        return dict(mem_put(PROJECTS, data), experiments=[])


async def delete_project(project_id: str) -> bool:
    """Delete a research project and its experiments (DB → memory)."""
    wanted = str(project_id)
    try:
        from app.database import session_scope
        from app.models import Experiment, ResearchProject
        from sqlalchemy import delete

        async with session_scope() as session:
            await session.execute(delete(Experiment).where(Experiment.project_id == wanted))
            result = await session.execute(
                delete(ResearchProject).where(ResearchProject.id == wanted)
            )
            if (result.rowcount or 0) > 0:
                return True
    except Exception as exc:  # noqa: BLE001
        logger.debug("research.delete_project: DB μη διαθέσιμη (%s)", exc)

    for experiment in mem_list(EXPERIMENTS):
        if str(experiment.get("project_id")) == wanted:
            mem_delete(EXPERIMENTS, str(experiment.get("id")))
    return mem_delete(PROJECTS, wanted)


async def runs_for_project(project: dict[str, Any]) -> list[dict[str, Any]]:
    """Collect simulation runs referenced by the project's experiments."""
    from app.repositories.simulations import get_runs_by_ids

    run_ids: list[str] = []
    for experiment in project.get("experiments") or []:
        for run_id in (experiment.get("run_ids") or []) if isinstance(experiment, dict) else []:
            if run_id and str(run_id) not in run_ids:
                run_ids.append(str(run_id))
    if not run_ids:
        # fall back to all runs (helpful for exports of ad-hoc experiments)
        from app.repositories.simulations import list_runs

        items, _, _ = await list_runs()
        return items
    return await get_runs_by_ids(run_ids)


def _now() -> str:
    from app.repositories.common import utcnow_iso

    return utcnow_iso()
