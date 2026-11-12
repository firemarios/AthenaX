"""AI module (03): POST /v1/ai/query + alias /v1/ai/chat (Ask the City)."""
from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from app.deps import get_request_id
from app.envelope import ok
from app.services import intelligence

router = APIRouter()


class AIQueryRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000, description="Η ερώτηση")
    city: str | None = Field(None, max_length=120, description="Πόλη (προαιρετικά)")


@router.post("/ai/query")
async def ai_query(payload: AIQueryRequest, request: Request):
    """AIAnswer + meta {sources, limitations, record_count, ui} (contract §3/§2)."""
    request_id = get_request_id(request)
    answer, meta = await intelligence.run_ai_query(
        payload.question, city=payload.city, request_id=request_id
    )
    return ok(answer, meta)


@router.post("/ai/chat")
async def ai_chat(payload: AIQueryRequest, request: Request):
    """Alias of POST /v1/ai/query (contract §2)."""
    request_id = get_request_id(request)
    answer, meta = await intelligence.run_ai_query(
        payload.question, city=payload.city, request_id=request_id
    )
    return ok(answer, meta)

@router.post("/ai/query/stream")
async def ai_query_stream(payload: AIQueryRequest, request: Request):
    """Server-Sent Events: meta -> token* -> done {answer, meta} (contract §2 AI)."""
    from fastapi.responses import StreamingResponse

    from services.ai_engine.streaming import sse

    request_id = get_request_id(request)

    async def events():
        async for event in intelligence.stream_ai_query(
            payload.question, city=payload.city, request_id=request_id
        ):
            yield sse(str(event.get("type") or "message"), event)

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
