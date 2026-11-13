"""AI engine tests (contract §4): orchestrator paths, RAG, evidence, providers factory."""
from __future__ import annotations

import asyncio
import json

import httpx

from services.ai_engine import evidence, rag
from services.ai_engine.orchestrator import answer_question
from services.ai_engine.providers import (
    OllamaProvider,
    OpenAICompatibleProvider,
    get_provider,
)

RECORDS = [
    {
        "title": "Πράσινοι χώροι στα Εξάρχεια",
        "source_url": "https://data.gov.gr/datasets/green",
        "description": "Απογραφή πρασίνων χώρων και δέντρων",
        "source_name": "ckan",
    },
    {
        "title": "Κυκλοφοριακή μελέτη κέντρου",
        "source_url": "https://data.gov.gr/datasets/traffic",
        "description": "Μετρήσεις κυκλοφορίας και θορύβου",
        "source_name": "ckan",
    },
]


class FakeProvider:
    name = "fake"

    def __init__(self, content: str) -> None:
        self.content = content
        self.messages: list[dict] = []

    async def chat(self, messages, *, temperature=0.3, max_tokens=2048):
        self.messages = list(messages)
        return self.content


class RaisingProvider:
    name = "boom"

    async def chat(self, messages, *, temperature=0.3, max_tokens=2048):
        raise RuntimeError("LLM down")


def test_empty_records_returns_insufficiency():
    answer = asyncio.run(answer_question("τι υπάρχει;", records=[], city="Athens"))
    assert answer["limitations"] == ["insufficient data"]
    assert answer["sources"] == []
    assert "ανεπαρκή" in answer["summary"].lower() or "δεν υπάρχουν" in answer["detailed_result"].lower()


def test_provider_raising_falls_back_to_llm_unavailable():
    answer = asyncio.run(
        answer_question("ερώτηση", records=RECORDS, city="Athens", provider=RaisingProvider())
    )
    assert answer["limitations"] == ["llm unavailable"]
    # graceful: still carries sources from the records
    assert {s["url"] for s in answer["sources"]} == {
        "https://data.gov.gr/datasets/green",
        "https://data.gov.gr/datasets/traffic",
    }


def test_malformed_json_falls_back():
    provider = FakeProvider("εντελώς λάθος κείμενο χωρίς JSON {")
    answer = asyncio.run(answer_question("ερώτηση", records=RECORDS, city="Athens", provider=provider))
    assert answer["limitations"] == ["llm unavailable"]
    assert answer["detailed_result"]


def test_happy_path_filters_sources_to_record_urls():
    payload = {
        "detailed_result": "Υπάρχουν δύο σχετικές εγγραφές.",
        "summary": "Δύο πηγές.",
        "sources": [
            {"url": "https://data.gov.gr/datasets/green", "title": "Πράσινο"},
            {"url": "https://evil.example/not-a-record", "title": "Εξωτερική"},
        ],
        "limitations": ["ελλιπής κάλυψη"],
    }
    provider = FakeProvider("```json\n" + json.dumps(payload, ensure_ascii=False) + "\n```")
    answer = asyncio.run(answer_question("πράσινο;", records=RECORDS, city="Athens", provider=provider))
    urls = [s["url"] for s in answer["sources"]]
    assert urls == ["https://data.gov.gr/datasets/green"]
    assert "evil" not in json.dumps(answer)
    assert answer["limitations"] == ["ελλιπής κάλυψη"]
    # strict system prompt injected
    assert provider.messages[0]["role"] == "system"
    assert "JSON" in provider.messages[0]["content"]


def test_single_quote_json_fallback_parses():
    payload = (
        "{'detailed_result': 'Απάντηση', 'summary': 'Σύνοψη', "
        "'sources': [{'url': 'https://data.gov.gr/datasets/traffic', 'title': 'Κυκλοφορία'}], "
        "'limitations': []}"
    )
    provider = FakeProvider(payload)
    answer = asyncio.run(answer_question("κυκλοφορία", records=RECORDS, city="Athens", provider=provider))
    assert answer["summary"] == "Σύνοψη"
    assert answer["sources"][0]["url"] == "https://data.gov.gr/datasets/traffic"


def test_rag_retrieve_orders_by_score_and_respects_limit():
    query = "πράσινοι χώροι δέντρα"
    ranked = rag.retrieve(query, RECORDS)
    assert ranked[0]["title"].startswith("Πράσινοι")
    assert len(ranked) == len(RECORDS)
    # scores descending
    scores = [rag.keyword_score(query, rag.record_text(r)) for r in ranked]
    assert scores == sorted(scores, reverse=True)
    # limit truncates to top-k
    limited = rag.retrieve(query, RECORDS, limit=1)
    assert len(limited) == 1
    assert limited[0] == ranked[0]
    # empty inputs safe
    assert rag.retrieve(query, []) == []


def test_keyword_score_is_case_and_accent_insensitive():
    assert rag.keyword_score("Κίνηση", "ΚΙΝΗΣΗ στον κεντρικό άξονα") == 1.0
    assert rag.keyword_score("ΑΘΗΝΑ", "αθήνα πόλη") > 0.5
    assert rag.keyword_score("διαφορετικό", "τελείως άσχετο κείμενο") == 0.0
    assert rag.keyword_score("", "οτιδήποτε") == 0.0


def test_chunk_text_overlap_and_completeness():
    text = "x" * 5000
    chunks = rag.chunk_text(text, size=1000, overlap=150)
    assert len(chunks) == 6  # steps of 850: 0,850,1700,2550,3400,4250
    assert all(len(c) <= 1000 for c in chunks)
    assert rag.chunk_text("") == []


def test_build_sources_dedups_by_url_and_attach_limitations():
    records = [
        {"title": "Α", "source_url": "https://a.gr/1"},
        {"title": "Β", "source_url": "https://a.gr/1"},
        {"title": "Γ", "source_url": "https://b.gr/2"},
        {"title": "Δ"},  # no url → ignored
    ]
    sources = evidence.build_sources(records)
    assert [s["url"] for s in sources] == ["https://a.gr/1", "https://b.gr/2"]
    assert sources[0]["title"] == "Α"  # first title wins

    merged = evidence.attach_limitations(["a", "b", ""], ["b", "c", None])
    assert merged == ["a", "b", "c"]


def test_get_provider_defaults_and_settings():
    default = get_provider(None)
    assert isinstance(default, OllamaProvider)
    assert default.base_url == "http://127.0.0.1:11434"
    assert default.model == "llama3.2"

    class Settings:
        llm_provider = "openai_compatible"
        llm_base_url = "https://llm.example/v1"
        llm_api_key = "secret"
        llm_model = "some-model"

    provider = get_provider(Settings())
    assert isinstance(provider, OpenAICompatibleProvider)
    assert provider.base_url == "https://llm.example/v1"
    assert provider.api_key == "secret"
    assert provider.model == "some-model"

def test_kilo_provider_uses_gateway_payload_and_headers():
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["headers"] = request.headers
        seen["payload"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": "ok"}}]},
        )

    provider = OpenAICompatibleProvider(
        base_url="https://ai-gateway.kilo.ai/api/v1",
        model="nvidia/nemotron-3.5-super-vl:free",
        api_key="anonymous",
        transport=httpx.MockTransport(handler),
    )

    result = asyncio.run(provider.chat([{"role": "user", "content": "hi"}]))

    assert result == "ok"
    assert seen["url"] == "https://ai-gateway.kilo.ai/api/v1/chat/completions"
    assert provider.timeout == 600.0
    assert seen["payload"]["model"] == "nvidia/nemotron-3.5-super-vl:free"
    assert seen["payload"]["max_tokens"] == 256_000
    assert seen["payload"]["reasoning"] == {"enabled": True, "effort": "xhigh"}
    assert seen["payload"]["tool_choice"] == "none"
    assert "temperature" not in seen["payload"]
    assert seen["headers"]["authorization"] == "Bearer anonymous"
    assert seen["headers"]["x-kilocode-feature"] == "cli"
    assert seen["headers"]["x-session-id"].startswith("ses_")
    assert seen["headers"]["user-agent"].startswith("Kilo-Code/7.8.12")


def test_kilo_provider_streams_with_usage_and_ignores_reasoning_chunks():
    seen: dict = {}
    body = (
        'data: {"choices":[{"delta":{"reasoning_content":"thinking"}}]}\n\n'
        'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n'
        'data: {"choices":[],"usage":{"total_tokens":12}}\n\n'
        "data: [DONE]\n\n"
    )

    def handler(request: httpx.Request) -> httpx.Response:
        seen["headers"] = request.headers
        seen["payload"] = json.loads(request.content)
        return httpx.Response(
            200,
            content=body.encode("utf-8"),
            headers={"content-type": "text/event-stream"},
        )

    provider = OpenAICompatibleProvider(
        base_url="https://ai-gateway.kilo.ai/api/v1",
        model="nvidia/nemotron-3.5-super-vl:free",
        api_key="anonymous",
        transport=httpx.MockTransport(handler),
    )

    async def collect() -> list[str]:
        return [
            chunk
            async for chunk in provider.stream_chat(
                [{"role": "user", "content": "hi"}]
            )
        ]

    assert asyncio.run(collect()) == ["hello"]
    assert seen["payload"]["stream"] is True
    assert seen["payload"]["stream_options"] == {"include_usage": True}
    assert seen["payload"]["max_tokens"] == 256_000
    assert seen["payload"]["reasoning"] == {"enabled": True, "effort": "xhigh"}
    assert seen["headers"]["x-session-id"].startswith("ses_")
