"""Citizen Lab repository — consultations / proposals / comments (DB → memory, never raises)."""
from __future__ import annotations

import logging
from typing import Any

from app.repositories.common import (
    iso,
    mem_delete,
    mem_get,
    mem_list,
    mem_put,
    new_id,
)

logger = logging.getLogger("athenax.repositories.citizen")

CONSULTATIONS = "consultations"
PROPOSALS = "proposals"
COMMENTS = "comments"


def consultation_from_row(row: Any, proposals: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "title": str(row.title or ""),
        "description": row.description or "",
        "status": str(row.status or "open"),
        "starts_at": row.starts_at,
        "ends_at": row.ends_at,
        "proposals": proposals or [],
        "created_at": iso(row.created_at),
    }


def proposal_from_row(row: Any, comments_count: int = 0) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "title": str(row.title or ""),
        "description": str(row.description or ""),
        "area": row.area,
        "category": row.category,
        "status": str(row.status or "open"),
        "consultation_id": row.consultation_id,
        "comments_count": int(comments_count),
        "created_at": iso(row.created_at),
    }


def comment_from_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "proposal_id": str(row.proposal_id),
        "body": str(row.body or ""),
        "created_at": iso(row.created_at),
    }


async def _comments_count(proposal_id: str) -> int:
    try:
        from app.database import session_scope
        from app.models import Comment
        from sqlalchemy import func, select

        async with session_scope() as session:
            count = (
                await session.execute(
                    select(func.count(Comment.id)).where(Comment.proposal_id == str(proposal_id))
                )
            ).scalar()
            return int(count or 0)
    except Exception:  # noqa: BLE001
        return sum(
            1 for item in mem_list(COMMENTS) if str(item.get("proposal_id")) == str(proposal_id)
        )


# ---------------------------------------------------------------- consultations
async def list_consultations() -> tuple[list[dict[str, Any]], int, bool]:
    degraded = False
    try:
        from app.database import session_scope
        from app.models import Consultation
        from sqlalchemy import select

        async with session_scope() as session:
            rows = list(
                (await session.execute(select(Consultation).order_by(Consultation.created_at.desc())))
                .scalars()
            )
        items = [consultation_from_row(row) for row in rows]
    except Exception as exc:  # noqa: BLE001
        logger.debug("list_consultations: DB μη διαθέσιμη (%s)", exc)
        degraded = True
        items = []

    if not items:
        items = [dict(item, proposals=[]) for item in mem_list(CONSULTATIONS)]
        items.sort(key=lambda item: str(item.get("created_at") or ""), reverse=True)

    for item in items:
        item["proposals"] = await _proposals_for(str(item["id"]))
    return items, len(items), degraded


async def get_consultation(consultation_id: str) -> dict[str, Any] | None:
    try:
        from app.database import session_scope
        from app.models import Consultation
        from sqlalchemy import select

        async with session_scope() as session:
            row = (
                await session.execute(
                    select(Consultation).where(Consultation.id == str(consultation_id))
                )
            ).scalar_one_or_none()
            if row is not None:
                item = consultation_from_row(row)
                item["proposals"] = await _proposals_for(str(item["id"]))
                return item
    except Exception:  # noqa: BLE001
        pass
    stored = mem_get(CONSULTATIONS, str(consultation_id))
    if stored is None:
        return None
    item = dict(stored, proposals=await _proposals_for(str(stored["id"])))
    return item


async def create_consultation(payload: dict[str, Any]) -> dict[str, Any]:
    consultation_id = new_id()
    data = {
        "id": consultation_id,
        "title": str(payload.get("title") or ""),
        "description": str(payload.get("description") or ""),
        "status": str(payload.get("status") or "open"),
        "starts_at": payload.get("starts_at"),
        "ends_at": payload.get("ends_at"),
        "created_at": _now(),
    }
    try:
        from app.database import session_scope
        from app.models import Consultation

        async with session_scope() as session:
            row = Consultation(
                id=consultation_id,
                title=data["title"],
                description=data["description"],
                status=data["status"],
                starts_at=data["starts_at"],
                ends_at=data["ends_at"],
            )
            session.add(row)
            await session.flush()
            item = consultation_from_row(row, [])
            return item
    except Exception as exc:  # noqa: BLE001
        logger.debug("create_consultation: DB μη διαθέσιμη (%s)", exc)
        return dict(mem_put(CONSULTATIONS, data), proposals=[])


async def delete_consultation(consultation_id: str) -> bool:
    """Delete a consultation with its proposals and their comments (DB → memory)."""
    wanted = str(consultation_id)
    try:
        from app.database import session_scope
        from app.models import Comment, Consultation, Proposal
        from sqlalchemy import delete, select

        async with session_scope() as session:
            proposal_ids = list(
                (
                    await session.execute(
                        select(Proposal.id).where(Proposal.consultation_id == wanted)
                    )
                ).scalars()
            )
            if proposal_ids:
                await session.execute(
                    delete(Comment).where(Comment.proposal_id.in_(proposal_ids))
                )
                await session.execute(delete(Proposal).where(Proposal.id.in_(proposal_ids)))
            result = await session.execute(
                delete(Consultation).where(Consultation.id == wanted)
            )
            if (result.rowcount or 0) > 0:
                return True
    except Exception as exc:  # noqa: BLE001
        logger.debug("delete_consultation: DB μη διαθέσιμη (%s)", exc)

    for proposal in mem_list(PROPOSALS):
        if str(proposal.get("consultation_id")) == wanted:
            _mem_delete_proposal(str(proposal.get("id")))
    return mem_delete(CONSULTATIONS, wanted)


def _mem_delete_proposal(proposal_id: str) -> bool:
    for comment in mem_list(COMMENTS):
        if str(comment.get("proposal_id")) == proposal_id:
            mem_delete(COMMENTS, str(comment.get("id")))
    return mem_delete(PROPOSALS, proposal_id)


# ---------------------------------------------------------------- proposals
async def _proposals_for(consultation_id: str) -> list[dict[str, Any]]:
    try:
        from app.database import session_scope
        from app.models import Proposal
        from sqlalchemy import select

        async with session_scope() as session:
            rows = (
                await session.execute(
                    select(Proposal).where(Proposal.consultation_id == str(consultation_id))
                )
            ).scalars()
            return [proposal_from_row(row, await _comments_count(str(row.id))) for row in rows]
    except Exception:  # noqa: BLE001
        return [
            dict(item, comments_count=0)
            for item in mem_list(PROPOSALS)
            if str(item.get("consultation_id")) == str(consultation_id)
        ]


async def list_proposals() -> tuple[list[dict[str, Any]], int, bool]:
    degraded = False
    try:
        from app.database import session_scope
        from app.models import Proposal
        from sqlalchemy import select

        async with session_scope() as session:
            rows = list(
                (await session.execute(select(Proposal).order_by(Proposal.created_at.desc())))
                .scalars()
            )
        items = [proposal_from_row(row, await _comments_count(str(row.id))) for row in rows]
    except Exception as exc:  # noqa: BLE001
        logger.debug("list_proposals: DB μη διαθέσιμη (%s)", exc)
        degraded = True
        items = [
            dict(item, comments_count=await _comments_count(str(item.get("id"))))
            for item in mem_list(PROPOSALS)
        ]
        items.sort(key=lambda item: str(item.get("created_at") or ""), reverse=True)
    return items, len(items), degraded


async def get_proposal(proposal_id: str) -> dict[str, Any] | None:
    try:
        from app.database import session_scope
        from app.models import Proposal
        from sqlalchemy import select

        async with session_scope() as session:
            row = (
                await session.execute(select(Proposal).where(Proposal.id == str(proposal_id)))
            ).scalar_one_or_none()
            if row is not None:
                return proposal_from_row(row, await _comments_count(str(row.id)))
    except Exception:  # noqa: BLE001
        pass
    stored = mem_get(PROPOSALS, str(proposal_id))
    if stored is None:
        return None
    return dict(stored, comments_count=await _comments_count(str(stored["id"])))


async def create_proposal(payload: dict[str, Any]) -> dict[str, Any]:
    proposal_id = new_id()
    data = {
        "id": proposal_id,
        "title": str(payload.get("title") or ""),
        "description": str(payload.get("description") or ""),
        "area": payload.get("area"),
        "category": payload.get("category"),
        "status": str(payload.get("status") or "open"),
        "consultation_id": payload.get("consultation_id"),
        "created_at": _now(),
    }
    try:
        from app.database import session_scope
        from app.models import Proposal

        async with session_scope() as session:
            row = Proposal(
                id=proposal_id,
                title=data["title"],
                description=data["description"],
                area=data["area"],
                category=data["category"],
                status=data["status"],
                consultation_id=data["consultation_id"],
            )
            session.add(row)
            await session.flush()
            return proposal_from_row(row, 0)
    except Exception as exc:  # noqa: BLE001
        logger.debug("create_proposal: DB μη διαθέσιμη (%s)", exc)
        return dict(mem_put(PROPOSALS, data), comments_count=0)


async def delete_proposal(proposal_id: str) -> bool:
    """Delete a proposal and its comments (DB → memory)."""
    wanted = str(proposal_id)
    try:
        from app.database import session_scope
        from app.models import Comment, Proposal
        from sqlalchemy import delete

        async with session_scope() as session:
            await session.execute(delete(Comment).where(Comment.proposal_id == wanted))
            result = await session.execute(delete(Proposal).where(Proposal.id == wanted))
            if (result.rowcount or 0) > 0:
                return True
    except Exception as exc:  # noqa: BLE001
        logger.debug("delete_proposal: DB μη διαθέσιμη (%s)", exc)

    return _mem_delete_proposal(wanted)


# ---------------------------------------------------------------- comments
async def list_comments(proposal_id: str) -> tuple[list[dict[str, Any]], int, bool]:
    degraded = False
    try:
        from app.database import session_scope
        from app.models import Comment
        from sqlalchemy import select

        async with session_scope() as session:
            rows = (
                await session.execute(
                    select(Comment)
                    .where(Comment.proposal_id == str(proposal_id))
                    .order_by(Comment.created_at)
                )
            ).scalars()
            items = [comment_from_row(row) for row in rows]
    except Exception as exc:  # noqa: BLE001
        logger.debug("list_comments: DB μη διαθέσιμη (%s)", exc)
        degraded = True
        items = [
            dict(item)
            for item in mem_list(COMMENTS)
            if str(item.get("proposal_id")) == str(proposal_id)
        ]
    return items, len(items), degraded


async def create_comment(proposal_id: str, body: str) -> dict[str, Any] | None:
    proposal = await get_proposal(proposal_id)
    if proposal is None:
        return None
    comment_id = new_id()
    data = {
        "id": comment_id,
        "proposal_id": str(proposal_id),
        "body": str(body or ""),
        "created_at": _now(),
    }
    try:
        from app.database import session_scope
        from app.models import Comment

        async with session_scope() as session:
            row = Comment(id=comment_id, proposal_id=str(proposal_id), body=data["body"])
            session.add(row)
            await session.flush()
            return comment_from_row(row)
    except Exception as exc:  # noqa: BLE001
        logger.debug("create_comment: DB μη διαθέσιμη (%s)", exc)
        return mem_put(COMMENTS, data)


async def delete_comment(proposal_id: str, comment_id: str) -> bool:
    """Delete one comment that belongs to a proposal (DB → memory)."""
    wanted_proposal = str(proposal_id)
    wanted_comment = str(comment_id)
    try:
        from app.database import session_scope
        from app.models import Comment
        from sqlalchemy import delete

        async with session_scope() as session:
            result = await session.execute(
                delete(Comment).where(
                    Comment.id == wanted_comment,
                    Comment.proposal_id == wanted_proposal,
                )
            )
            if (result.rowcount or 0) > 0:
                return True
    except Exception as exc:  # noqa: BLE001
        logger.debug("delete_comment: DB μη διαθέσιμη (%s)", exc)

    stored = mem_get(COMMENTS, wanted_comment)
    if stored is not None and str(stored.get("proposal_id")) == wanted_proposal:
        return mem_delete(COMMENTS, wanted_comment)
    return False


def _now() -> str:
    from app.repositories.common import utcnow_iso

    return utcnow_iso()
