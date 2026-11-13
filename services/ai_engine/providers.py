"""LLM providers (contract §4): Ollama + OpenAI-compatible over httpx with tenacity retries."""
from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from typing import Any

import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from services.connector_kit.helpers import make_client

logger = logging.getLogger("policylab.ai.providers")

DEFAULT_TIMEOUT = 90.0
KILO_TIMEOUT = 600.0
KILO_MAX_TOKENS = 256_000
KILO_REASONING_EFFORT = "xhigh"
KILO_RETRY_SECONDS = 300.0
KILO_USER_AGENT = (
    "Kilo-Code/7.8.12 ai-sdk/provider-utils/4.0.23 runtime/bun/1.4.2"
)

_RETRY = dict(
    wait=wait_exponential(multiplier=0.3, max=6.0),
    stop=stop_after_attempt(3),
    reraise=True,
)


def _is_retryable(exc: BaseException) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code == 429 or exc.response.status_code >= 500
    return isinstance(exc, (httpx.TransportError, httpx.TimeoutException))


def _url(base: str, path: str) -> str:
    base = (base or "").rstrip("/")
    path = "/" + path.lstrip("/")
    if path.startswith("/v1/") and base.endswith("/v1"):
        return base + path[3:]
    return base + path


def _new_session_id() -> str:
    return "ses_" + uuid.uuid4().hex[:24]


class LLMProvider:
    """Abstract provider: chat / ping / embed."""

    name: str = "base"

    def __init__(self, *, transport: Any = None, timeout: float = DEFAULT_TIMEOUT) -> None:
        self.transport = transport
        self.timeout = timeout

    async def chat(
        self,
        messages: list[dict],
        *,
        temperature: float = 0.3,
        max_tokens: int = 2048,
    ) -> str:
        raise NotImplementedError

    async def stream_chat(
        self,
        messages: list[dict],
        *,
        temperature: float = 0.3,
        max_tokens: int = 2048,
    ):
        """Yield text deltas; providers without streaming fall back to one chunk."""
        text = await self.chat(messages, temperature=temperature, max_tokens=max_tokens)
        if text:
            yield text

    async def ping(self) -> bool:
        raise NotImplementedError

    async def embed(self, text: str) -> list[float]:
        raise NotImplementedError


class OllamaProvider(LLMProvider):
    """POST {base}/api/chat, /api/tags ping, /api/embeddings."""

    name = "ollama"

    def __init__(
        self,
        base_url: str = "http://127.0.0.1:11434",
        model: str = "llama3.2",
        embedding_model: str = "nomic-embed-text",
        *,
        transport: Any = None,
        timeout: float = DEFAULT_TIMEOUT,
        api_key: str | None = None,  # unused; accepted for uniform construction
    ) -> None:
        super().__init__(transport=transport, timeout=timeout)
        self.base_url = (base_url or "http://127.0.0.1:11434").rstrip("/")
        self.model = model or "llama3.2"
        self.embedding_model = embedding_model or "nomic-embed-text"
        self.api_key = api_key

    @retry(retry=retry_if_exception(_is_retryable), **_RETRY)
    async def chat(
        self,
        messages: list[dict],
        *,
        temperature: float = 0.3,
        max_tokens: int = 2048,
    ) -> str:
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": temperature, "num_predict": max_tokens},
        }
        async with make_client(transport=self.transport, timeout=self.timeout) as client:
            resp = await client.post(_url(self.base_url, "/api/chat"), json=payload)
            resp.raise_for_status()
            data = resp.json()
        if not isinstance(data, dict):
            return ""
        message = data.get("message")
        if isinstance(message, dict):
            return str(message.get("content") or "")
        return str(data.get("response") or "")

    async def stream_chat(
        self,
        messages: list[dict],
        *,
        temperature: float = 0.3,
        max_tokens: int = 2048,
    ):
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": True,
            "options": {"temperature": temperature, "num_predict": max_tokens},
        }
        async with make_client(transport=self.transport, timeout=self.timeout) as client:
            async with client.stream(
                "POST", _url(self.base_url, "/api/chat"), json=payload
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        data = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if not isinstance(data, dict):
                        continue
                    message = data.get("message")
                    if isinstance(message, dict):
                        text = message.get("content")
                    else:
                        text = data.get("response")
                    if isinstance(text, str) and text:
                        yield text
                    if data.get("done"):
                        break

    async def ping(self) -> bool:
        try:
            async with make_client(transport=self.transport, timeout=min(self.timeout, 15.0)) as client:
                resp = await client.get(_url(self.base_url, "/api/tags"))
                return resp.status_code == 200
        except Exception as exc:  # noqa: BLE001
            logger.debug("ollama ping failed: %s", exc)
            return False

    @retry(retry=retry_if_exception(_is_retryable), **_RETRY)
    async def embed(self, text: str) -> list[float]:
        payload = {"model": self.embedding_model, "prompt": text}
        async with make_client(transport=self.transport, timeout=self.timeout) as client:
            resp = await client.post(_url(self.base_url, "/api/embeddings"), json=payload)
            resp.raise_for_status()
            data = resp.json()
        embedding = data.get("embedding") if isinstance(data, dict) else None
        if not isinstance(embedding, list):
            raise ValueError("αποτυχία embeddings από τον Ollama")
        return [float(v) for v in embedding]


class OpenAICompatibleProvider(LLMProvider):
    """POST {base}/v1/chat/completions (+ Bearer key if set), /v1/embeddings."""

    name = "openai_compatible"

    def __init__(
        self,
        base_url: str = "https://api.openai.com/v1",
        model: str = "gpt-4o-mini",
        embedding_model: str = "text-embedding-3-small",
        *,
        api_key: str | None = None,
        transport: Any = None,
        timeout: float | None = None,
        reasoning_enabled: bool | None = None,
        reasoning_effort: str = KILO_REASONING_EFFORT,
        max_output_tokens: int | None = None,
    ) -> None:
        resolved_base = (base_url or "https://api.openai.com/v1").rstrip("/")
        self.is_kilo = "kilo.ai" in resolved_base
        resolved_timeout = (
            timeout
            if timeout is not None
            else (KILO_TIMEOUT if self.is_kilo else DEFAULT_TIMEOUT)
        )
        super().__init__(transport=transport, timeout=resolved_timeout)
        self.base_url = resolved_base
        self.model = model or "gpt-4o-mini"
        self.embedding_model = embedding_model or "text-embedding-3-small"
        self.api_key = api_key or None
        self.reasoning_enabled = (
            self.is_kilo if reasoning_enabled is None else reasoning_enabled
        )
        self.reasoning_effort = reasoning_effort or KILO_REASONING_EFFORT
        self.max_output_tokens = (
            max_output_tokens
            if max_output_tokens is not None
            else (KILO_MAX_TOKENS if self.is_kilo else None)
        )

    def _headers(self, session_id: str | None = None) -> dict[str, str]:
        if self.is_kilo:
            headers = {
                "Accept": "*/*",
                "Content-Type": "application/json",
                "User-Agent": KILO_USER_AGENT,
                "x-kilocode-feature": "cli",
            }
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"
            if session_id:
                headers["x-session-id"] = session_id
            return headers

        headers = {
            "Content-Type": "application/json",
            "Accept": "*/*",
            "User-Agent": "POLICYLAB/1.0 (+https://github.com/policylab)",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _payload(
        self,
        messages: list[dict],
        *,
        temperature: float,
        max_tokens: int,
        stream: bool,
    ) -> dict[str, Any]:
        if self.is_kilo:
            payload: dict[str, Any] = {
                "model": self.model,
                "max_tokens": self.max_output_tokens or max_tokens,
                "messages": messages,
                "tool_choice": "none",
            }
        else:
            payload = {
                "model": self.model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": self.max_output_tokens or max_tokens,
            }

        if self.reasoning_enabled:
            payload["reasoning"] = {
                "enabled": True,
                "effort": self.reasoning_effort,
            }

        if stream:
            payload["stream"] = True
            if self.is_kilo:
                payload["stream_options"] = {"include_usage": True}

        return payload

    @retry(retry=retry_if_exception(_is_retryable), **_RETRY)
    async def chat(
        self,
        messages: list[dict],
        *,
        temperature: float = 0.3,
        max_tokens: int = 2048,
    ) -> str:
        payload = self._payload(
            messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=False,
        )
        async with make_client(transport=self.transport, timeout=self.timeout) as client:
            resp = await client.post(
                _url(self.base_url, "/v1/chat/completions"),
                json=payload,
                headers=self._headers(_new_session_id()),
            )
            resp.raise_for_status()
            data = resp.json()
        if not isinstance(data, dict):
            return ""
        choices = data.get("choices")
        if isinstance(choices, list) and choices:
            first = choices[0]
            if isinstance(first, dict):
                message = first.get("message")
                if isinstance(message, dict):
                    return str(message.get("content") or "")
                return str(first.get("text") or "")
        return ""

    async def _stream_once(
        self,
        messages: list[dict],
        *,
        temperature: float,
        max_tokens: int,
        session_id: str,
    ):
        payload = self._payload(
            messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )
        async with make_client(transport=self.transport, timeout=self.timeout) as client:
            async with client.stream(
                "POST",
                _url(self.base_url, "/v1/chat/completions"),
                json=payload,
                headers=self._headers(session_id),
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        obj = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    choices = obj.get("choices") if isinstance(obj, dict) else None
                    if not isinstance(choices, list) or not choices:
                        continue
                    first = choices[0]
                    if not isinstance(first, dict):
                        continue
                    delta = first.get("delta")
                    text = delta.get("content") if isinstance(delta, dict) else None
                    if isinstance(text, str) and text:
                        yield text

    async def stream_chat(
        self,
        messages: list[dict],
        *,
        temperature: float = 0.3,
        max_tokens: int = 2048,
    ):
        deadline = time.monotonic() + KILO_RETRY_SECONDS if self.is_kilo else 0.0
        emitted = False
        delay = 0.5

        while True:
            session_id = _new_session_id()
            try:
                async for text in self._stream_once(
                    messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    session_id=session_id,
                ):
                    emitted = True
                    yield text
                return
            except Exception as exc:  # noqa: BLE001
                if (
                    emitted
                    or not self.is_kilo
                    or time.monotonic() >= deadline
                    or not _is_retryable(exc)
                ):
                    raise
                logger.warning("kilo stream retry in %.1fs: %s", delay, exc)
                await asyncio.sleep(delay)
                delay = min(delay * 2, 5.0)

    async def ping(self) -> bool:
        try:
            async with make_client(transport=self.transport, timeout=min(self.timeout, 15.0)) as client:
                resp = await client.get(_url(self.base_url, "/v1/models"), headers=self._headers())
                return resp.status_code == 200
        except Exception as exc:  # noqa: BLE001
            logger.debug("openai-compatible ping failed: %s", exc)
            return False

    @retry(retry=retry_if_exception(_is_retryable), **_RETRY)
    async def embed(self, text: str) -> list[float]:
        payload = {"model": self.embedding_model, "input": text}
        async with make_client(transport=self.transport, timeout=self.timeout) as client:
            resp = await client.post(
                _url(self.base_url, "/v1/embeddings"),
                json=payload,
                headers=self._headers(),
            )
            resp.raise_for_status()
            data = resp.json()
        items = data.get("data") if isinstance(data, dict) else None
        if not isinstance(items, list) or not items:
            raise ValueError("αποτυχία embeddings από τον OpenAI-compatible provider")
        first = items[0]
        embedding = first.get("embedding") if isinstance(first, dict) else None
        if not isinstance(embedding, list):
            raise ValueError("μη έγκυρη απάντηση embeddings")
        return [float(v) for v in embedding]


def _setting(settings: Any, name: str, default: Any = None) -> Any:
    if settings is None:
        return default
    if isinstance(settings, dict):
        value = settings.get(name, default)
    else:
        value = getattr(settings, name, default)
    return default if value is None else value


def get_provider(settings: Any = None) -> LLMProvider:
    """Build a provider from duck-typed settings (llm_provider/llm_base_url/llm_api_key/llm_model).

    None (or missing fields) → OllamaProvider with its defaults.
    """
    kind = str(_setting(settings, "llm_provider", "ollama") or "ollama").strip().lower()
    base_url = _setting(settings, "llm_base_url", None)
    api_key = _setting(settings, "llm_api_key", None)
    model = _setting(settings, "llm_model", None)
    embedding_model = (
        _setting(settings, "llm_embedding_model", None)
        or _setting(settings, "embedding_model", None)
    )

    if kind in ("openai_compatible", "openai-compatible", "openai"):
        return OpenAICompatibleProvider(
            base_url=str(base_url or "https://api.openai.com/v1"),
            model=str(model or "gpt-4o-mini"),
            embedding_model=str(embedding_model or "text-embedding-3-small"),
            api_key=str(api_key) if api_key else None,
        )
    return OllamaProvider(
        base_url=str(base_url or "http://127.0.0.1:11434"),
        model=str(model or "llama3.2"),
        embedding_model=str(embedding_model or "nomic-embed-text"),
        api_key=str(api_key) if api_key else None,
    )
