"""AI streaming tests (contract §4): partial JSON extraction, orchestrator and SSE provider."""
from __future__ import annotations

import asyncio
import json

import httpx

from services.ai_engine.orchestrator import answer_question_stream
from services.ai_engine.providers import OpenAICompatibleProvider
from services.ai_engine.streaming import extract_string_field

RECORDS = [
    {
        "title": "Δεδομένα πρασίνου",
        "source_url": "https://data.gov.gr/datasets/green",
        "description": "Χώροι πρασίνου ανά γειτονιά",
        "source_name": "ckan",
    },
    {
        "title": "Κυκλοφοριακά δεδομένα",
        "source_url": "https://data.gov.gr/datasets/traffic",
        "description": "Ροές οχημάτων",
        "source_name": "ckan",
    },
]


class ChunkProvider:
    name = "fake"

    def __init__(self, chunks: list[str]) -> None:
        self.chunks = chunks

    async def stream_chat(self, messages, *, temperature=0.3, max_tokens=2048):
        for chunk in self.chunks:
            yield chunk


class RaisingStreamProvider:
    name = "boom"

    async def stream_chat(self, messages, *, temperature=0.3, max_tokens=2048):
        raise RuntimeError("LLM down")
        yield ""  # pragma: no cover


def collect(gen):
    async def run():
        return [event async for event in gen]

    return asyncio.run(run())


def test_extract_string_field_handles_partial_and_escapes():
    assert extract_string_field('{"detailed_result": "Γεια', "detailed_result") == "Γεια"
    assert extract_string_field('{"detailed_result": "Γεια σου', "detailed_result") == "Γεια σου"
    assert extract_string_field(
        '{"detailed_result": "Γραμμή\\nδεύτερη \\"εισαγωγικά\\""}', "detailed_result"
    ) == 'Γραμμή\nδεύτερη "εισαγωγικά"'
    # incomplete trailing escape is omitted, not raised
    assert extract_string_field('{"detailed_result": "abc\\', "detailed_result") == "abc"
    assert extract_string_field('{"summary": "x"}', "detailed_result") == ""


def test_stream_tokens_build_detailed_result_and_done_answer():
    payload = {
        "detailed_result": "Πρώτη γραμμή.\nΔεύτερη γραμμή με \"εισαγωγικά\".",
        "summary": "Σύνοψη.",
        "sources": [
            {"url": "https://data.gov.gr/datasets/green", "title": "Δεδομένα πρασίνου"},
            {"url": "https://evil.example/x", "title": "Άκυρο"},
        ],
        "limitations": [],
    }
    content = json.dumps(payload, ensure_ascii=False)
    chunks = [content[i : i + 7] for i in range(0, len(content), 7)]
    events = collect(
        answer_question_stream("πράσινο", records=RECORDS, city="Athens", provider=ChunkProvider(chunks))
    )

    tokens = "".join(e["text"] for e in events if e["type"] == "token")
    assert tokens == payload["detailed_result"]

    done = [e for e in events if e["type"] == "answer"]
    assert len(done) == 1
    answer = done[0]["answer"]
    assert answer["detailed_result"] == payload["detailed_result"]
    assert answer["summary"] == payload["summary"]
    assert [s["url"] for s in answer["sources"]] == ["https://data.gov.gr/datasets/green"]


def test_stream_falls_back_when_provider_raises():
    events = collect(
        answer_question_stream(
            "δέντρα", records=RECORDS, city="Athens", provider=RaisingStreamProvider()
        )
    )
    assert not [e for e in events if e["type"] == "token"]
    answer = events[-1]["answer"]
    assert answer["limitations"] == ["llm unavailable"]
    assert {s["url"] for s in answer["sources"]} == {
        "https://data.gov.gr/datasets/green",
        "https://data.gov.gr/datasets/traffic",
    }


def test_openai_provider_parses_sse_deltas():
    body = (
        'data: {"choices":[{"delta":{"content":"Α"}}]}\n\n'
        'data: {"choices":[{"delta":{"content":"θήνα"}}]}\n\n'
        "data: [DONE]\n\n"
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, text=body, headers={"content-type": "text/event-stream"}
        )

    provider = OpenAICompatibleProvider(
        transport=httpx.MockTransport(handler), api_key="test"
    )
    chunks = asyncio.run(_collect_stream(provider.stream_chat([{"role": "user", "content": "x"}])))
    assert "".join(chunks) == "Αθήνα"


async def _collect_stream(gen) -> list[str]:
    return [chunk async for chunk in gen]
