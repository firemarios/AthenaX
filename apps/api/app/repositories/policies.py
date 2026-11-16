"""Policies repository — CRUD with in-memory fallback when the DB is down (never raises)."""
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

logger = logging.getLogger("policylab.repositories.policies")

TABLE = "policies"
VARIANTS_TABLE = "policy_variants"


def policy_from_row(row: Any, variants: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "title": str(row.title or ""),
        "description": row.description,
        "changes": getattr(row, "changes", None),
        "category": str(row.category or "other"),
        "status": str(row.status or "draft"),
        "area": row.area,
        "horizon": row.horizon,
        "parameters": as_json(row.parameters, {}) or {},
        "factors": as_json(getattr(row, "factors", None), []) or [],
        "budget_eur": getattr(row, "budget_eur", None),
        "assumptions": as_json(row.assumptions, []) or [],
        "kpis": as_json(row.kpis, []) or [],
        "variants": variants or [],
        "created_at": iso(row.created_at),
    }


def variant_from_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "policy_id": str(row.policy_id),
        "title": str(row.title or ""),
        "parameters": as_json(row.parameters, {}) or {},
        "created_at": iso(row.created_at),
    }


async def list_variants(policy_id: str) -> list[dict[str, Any]]:
    try:
        from app.database import session_scope
        from app.models import PolicyVariant
        from sqlalchemy import select

        async with session_scope() as session:
            rows = (
                await session.execute(
                    select(PolicyVariant)
                    .where(PolicyVariant.policy_id == str(policy_id))
                    .order_by(PolicyVariant.created_at)
                )
            ).scalars()
            return [variant_from_row(row) for row in rows]
    except Exception:  # noqa: BLE001
        return [
            dict(item)
            for item in mem_list(VARIANTS_TABLE)
            if str(item.get("policy_id")) == str(policy_id)
        ]


async def list_policies() -> tuple[list[dict[str, Any]], int, bool]:
    rows: list[Any] = []
    degraded = False
    try:
        from app.database import session_scope
        from app.models import Policy
        from sqlalchemy import select

        async with session_scope() as session:
            result = await session.execute(select(Policy).order_by(Policy.created_at.desc()))
            rows = list(result.scalars())
    except Exception as exc:  # noqa: BLE001
        logger.debug("list_policies: DB μη διαθέσιμη (%s)", exc)
        degraded = True
        rows = []

    items: list[dict[str, Any]] = []
    if rows:
        for row in rows:
            items.append(policy_from_row(row, await list_variants(str(row.id))))
    else:
        for stored in mem_list(TABLE):
            stored_variants = [
                dict(v)
                for v in mem_list(VARIANTS_TABLE)
                if str(v.get("policy_id")) == str(stored.get("id"))
            ]
            items.append(dict(stored, variants=stored_variants))
    items.sort(key=lambda item: str(item.get("created_at") or ""), reverse=True)
    return items, len(items), degraded


async def get_policy(policy_id: str) -> dict[str, Any] | None:
    try:
        from app.database import session_scope
        from app.models import Policy
        from sqlalchemy import select

        async with session_scope() as session:
            row = (
                await session.execute(select(Policy).where(Policy.id == str(policy_id)))
            ).scalar_one_or_none()
            if row is not None:
                return policy_from_row(row, await list_variants(str(row.id)))
    except Exception:  # noqa: BLE001
        pass
    stored = mem_get(TABLE, str(policy_id))
    if stored is not None:
        variants = [
            dict(v)
            for v in mem_list(VARIANTS_TABLE)
            if str(v.get("policy_id")) == str(stored.get("id"))
        ]
        return dict(stored, variants=variants)
    return None


async def create_policy(payload: dict[str, Any]) -> dict[str, Any]:
    policy_id = new_id()
    row_data = {
        "id": policy_id,
        "title": str(payload.get("title") or ""),
        "description": payload.get("description"),
        "changes": payload.get("changes"),
        "category": str(payload.get("category") or "other"),
        "status": str(payload.get("status") or "draft"),
        "area": payload.get("area"),
        "horizon": payload.get("horizon"),
        "parameters": payload.get("parameters") or {},
        "factors": payload.get("factors") or [],
        "budget_eur": payload.get("budget_eur"),
        "assumptions": payload.get("assumptions") or [],
        "kpis": payload.get("kpis") or [],
        "variants": [],
        "created_at": _now(),
        "updated_at": _now(),
    }
    try:
        from app.database import session_scope
        from app.models import Policy

        async with session_scope() as session:
            row = Policy(
                id=policy_id,
                title=row_data["title"],
                description=row_data["description"],
                changes=row_data["changes"],
                category=row_data["category"],
                status=row_data["status"],
                area=row_data["area"],
                horizon=row_data["horizon"],
                parameters=row_data["parameters"],
                factors=row_data["factors"],
                budget_eur=row_data["budget_eur"],
                assumptions=row_data["assumptions"],
                kpis=row_data["kpis"],
            )
            session.add(row)
            await session.flush()
            return policy_from_row(row, [])
    except Exception as exc:  # noqa: BLE001
        logger.debug("create_policy: DB μη διαθέσιμη (%s) — ενδομοική αποθήκευση", exc)
        return mem_put(TABLE, row_data)


async def delete_policy(policy_id: str) -> bool:
    """Delete a policy and its variants (DB first, then memory fallback)."""
    wanted = str(policy_id)
    try:
        from app.database import session_scope
        from app.models import Policy, PolicyVariant
        from sqlalchemy import delete

        async with session_scope() as session:
            await session.execute(
                delete(PolicyVariant).where(PolicyVariant.policy_id == wanted)
            )
            result = await session.execute(delete(Policy).where(Policy.id == wanted))
            if (result.rowcount or 0) > 0:
                return True
    except Exception as exc:  # noqa: BLE001
        logger.debug("delete_policy: DB μη διαθέσιμη (%s)", exc)

    for variant in mem_list(VARIANTS_TABLE):
        if str(variant.get("policy_id")) == wanted:
            mem_delete(VARIANTS_TABLE, str(variant.get("id")))
    return mem_delete(TABLE, wanted)


async def add_variant(policy_id: str, title: str, parameters: dict[str, Any]) -> dict[str, Any] | None:
    policy = await get_policy(policy_id)
    if policy is None:
        return None
    variant_id = new_id()
    data = {
        "id": variant_id,
        "policy_id": str(policy_id),
        "title": str(title or ""),
        "parameters": dict(parameters or {}),
        "created_at": _now(),
    }
    try:
        from app.database import session_scope
        from app.models import PolicyVariant

        async with session_scope() as session:
            row = PolicyVariant(
                id=variant_id,
                policy_id=str(policy_id),
                title=data["title"],
                parameters=data["parameters"],
            )
            session.add(row)
            await session.flush()
            return variant_from_row(row)
    except Exception as exc:  # noqa: BLE001
        logger.debug("add_variant: DB μη διαθέσιμη (%s)", exc)
        return mem_put(VARIANTS_TABLE, data)


def _now() -> str:
    from app.repositories.common import utcnow_iso

    return utcnow_iso()
