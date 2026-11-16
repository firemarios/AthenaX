"""Ask the City orchestrator (contract §4).

answer_question(question, *, records, city, provider=None) → AIAnswer dict.
Never raises: empty records → explicit insufficiency; provider/parse failure →
graceful fallback with limitations ["llm unavailable"].
"""
from __future__ import annotations

import ast
import json
import logging
from typing import Any

from services.ai_engine import evidence
from services.ai_engine.prompts import DEFAULT_MAX_CHARS, SYSTEM_PROMPT, build_user_prompt
from services.ai_engine.providers import get_provider
from services.ai_engine.rag import retrieve
from services.ai_engine.streaming import extract_string_field

logger = logging.getLogger("athenax.ai")

INSUFFICIENT_ANSWER = {
    "detailed_result": (
        "Δεν υπάρχουν αρκετά δεδομένα στη βάση γνώσης για να απαντηθεί η ερώτηση. "
        "Δοκιμάστε με διαφορετική διατύπωση ή επιλέξτε άλλη περιοχή/πηγή."
    ),
    "summary": "Ανεπαρκή δεδομένα για αξιόπιστη απάντηση.",
    "sources": [],
    "limitations": ["insufficient data"],
}

LLM_UNAVAILABLE_ANSWER = {
    "detailed_result": (
        "Η υπηρεσία τεχνητής νοημοσύνης δεν είναι διαθέσιμή αυτή τη στιγμή. "
        "Οι διαθέσιμες πηγές καταγράφονται παρακάτω, χωρίς σύνθεση απάντησης."
    ),
    "summary": "Αποτυχία σύνδεσης με το μοντέλο γλώσσας.",
    "sources": [],
    "limitations": ["llm unavailable"],
}


def _parse_json_answer(content: str) -> dict | None:
    """Defensive JSON extraction: fences, bare object, single-quote fallback."""
    if not isinstance(content, str) or not content.strip():
        return None
    text = content.strip()

    # ```json ... ``` or ``` ... ```
    if text.startswith("```"):
        body = text[3:]
        if body.lstrip().lower().startswith("json"):
            body = body.lstrip()[4:]
        if body.rstrip().endswith("```"):
            body = body.rstrip()[:-3]
        text = body.strip()

    candidates = [text]
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        candidates.append(text[start : end + 1])

    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, dict):
                return parsed
        except (ValueError, TypeError):
            pass
        try:
            parsed = ast.literal_eval(candidate)
            if isinstance(parsed, dict):
                return parsed
        except (ValueError, SyntaxError, TypeError):
            pass
    return None


def _coerce_answer(payload: dict) -> dict:
    detailed = payload.get("detailed_result")
    summary = payload.get("summary")
    if not isinstance(detailed, str) or not detailed.strip():
        if not isinstance(summary, str) or not summary.strip():
            raise ValueError("λείπουν detailed_result/summary")
        detailed = summary
    if not isinstance(summary, str) or not summary.strip():
        summary = detailed.split(".")[0][:300] or detailed

    raw_sources = payload.get("sources")
    sources: list[dict] = []
    if isinstance(raw_sources, list):
        for item in raw_sources:
            if isinstance(item, dict):
                url = item.get("url")
                title = item.get("title")
                if isinstance(url, str) and url.strip():
                    sources.append({"url": url.strip(), "title": str(title or url.strip())})
            elif isinstance(item, str) and item.strip():
                sources.append({"url": item.strip(), "title": item.strip()})

    raw_limits = payload.get("limitations")
    limitations: list[str] = []
    if isinstance(raw_limits, list):
        limitations = [str(x) for x in raw_limits if isinstance(x, str) and x.strip()]

    return {
        "detailed_result": detailed.strip(),
        "summary": summary.strip(),
        "sources": sources,
        "limitations": limitations,
    }


def _filter_sources(parsed_sources: list[dict], records: list[dict], fallback: list[dict]) -> list[dict]:
    """Keep only URLs actually present in the provided records (dedup by url)."""
    allowed = {s["url"] for s in evidence.build_sources(records)}
    kept = [s for s in parsed_sources if s.get("url") in allowed]
    if not kept:
        return fallback
    return evidence.build_sources(kept) or kept


async def answer_question(
    question: str,
    *,
    records: list[dict],
    city: str,
    provider: Any = None,
) -> dict:
    """Returns AIAnswer {detailed_result, summary, sources, limitations} — never raises."""
    records = [r for r in (records or []) if isinstance(r, dict)]
    if not records:
        return dict(INSUFFICIENT_ANSWER)

    try:
        retrieved = retrieve(question or "", records)
    except Exception:  # noqa: BLE001 — retrieval must never break the answer
        logger.warning("retrieve failed; falling back to raw records", exc_info=True)
        retrieved = records

    fallback_sources = evidence.build_sources(retrieved)

    try:
        active_provider = provider
        if active_provider is None:
            try:
                from app.config import get_settings

                active_provider = get_provider(get_settings())
            except Exception:  # noqa: BLE001 — service layer may run without the app
                active_provider = get_provider(None)
        user_prompt = build_user_prompt(question or "", city or "", retrieved, max_chars=DEFAULT_MAX_CHARS)
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]
        content = await active_provider.chat(messages, temperature=0.2, max_tokens=8192)
        payload = _parse_json_answer(content)
        if payload is None:
            raise ValueError("μη έγκυρη JSON απάντηση από το LLM")
        answer = _coerce_answer(payload)
        answer["sources"] = _filter_sources(answer["sources"], retrieved, fallback_sources)
        answer["limitations"] = evidence.attach_limitations(answer["limitations"], [])
        if not answer["limitations"] and not answer["sources"]:
            answer["limitations"] = evidence.attach_limitations(
                answer["limitations"], ["insufficient data"]
            )
        return answer
    except Exception as exc:  # noqa: BLE001 — provider/parse failure → graceful fallback
        logger.warning("answer_question fallback: %s", exc)
        fallback = dict(LLM_UNAVAILABLE_ANSWER)
        fallback["sources"] = fallback_sources
        return fallback

async def answer_question_stream(
    question: str,
    *,
    records: list[dict],
    city: str,
    provider: Any = None,
):
    """Yield {"type": "token", "text"} deltas then {"type": "answer", "answer"}.

    Streams the `detailed_result` field of the model's JSON answer as it is written,
    then returns the same normalized AIAnswer dict as `answer_question`.
    Never raises.
    """
    records = [r for r in (records or []) if isinstance(r, dict)]
    if not records:
        yield {"type": "answer", "answer": dict(INSUFFICIENT_ANSWER)}
        return

    emitted = ""

    try:
        retrieved = retrieve(question or "", records)
    except Exception:  # noqa: BLE001
        logger.warning("retrieve failed; falling back to raw records", exc_info=True)
        retrieved = records
    fallback_sources = evidence.build_sources(retrieved)

    try:
        active_provider = provider
        if active_provider is None:
            try:
                from app.config import get_settings

                active_provider = get_provider(get_settings())
            except Exception:  # noqa: BLE001
                active_provider = get_provider(None)
        user_prompt = build_user_prompt(
            question or "", city or "", retrieved, max_chars=DEFAULT_MAX_CHARS
        )
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]

        stream = getattr(active_provider, "stream_chat", None)
        buffer: list[str] = []
        if stream is not None:
            async for delta in stream(messages, temperature=0.2, max_tokens=8192):
                if not isinstance(delta, str) or not delta:
                    continue
                buffer.append(delta)
                partial = extract_string_field("".join(buffer), "detailed_result")
                if len(partial) > len(emitted):
                    yield {"type": "token", "text": partial[len(emitted) :]}
                    emitted = partial
            content = "".join(buffer)
        else:
            content = await active_provider.chat(messages, temperature=0.2, max_tokens=8192)

        payload = _parse_json_answer(content)
        if payload is None:
            if emitted.strip():
                fallback = {
                    "detailed_result": emitted.strip(),
                    "summary": emitted.strip().split("\n", 1)[0][:280],
                    "sources": fallback_sources,
                    "limitations": ["llm partial"],
                }
                yield {"type": "answer", "answer": fallback}
                return
            raise ValueError("invalid JSON from LLM")

        answer = _coerce_answer(payload)
        answer["sources"] = _filter_sources(answer["sources"], retrieved, fallback_sources)
        answer["limitations"] = evidence.attach_limitations(answer["limitations"], [])
        if not answer["limitations"] and not answer["sources"]:
            answer["limitations"] = evidence.attach_limitations(
                answer["limitations"], ["insufficient data"]
            )
        yield {"type": "answer", "answer": answer}
    except Exception as exc:  # noqa: BLE001
        logger.warning("answer_question_stream fallback: %s", exc)
        if emitted.strip():
            yield {
                "type": "answer",
                "answer": {
                    "detailed_result": emitted.strip(),
                    "summary": emitted.strip().split("\n", 1)[0][:280],
                    "sources": fallback_sources,
                    "limitations": ["llm partial"],
                },
            }
            return
        fallback = dict(LLM_UNAVAILABLE_ANSWER)
        fallback["sources"] = fallback_sources
        yield {"type": "answer", "answer": fallback}
