"""LLM providers (contract §4): Ollama + OpenAI-compatible over httpx with tenacity retries."""
from __future__ import annotations

import json
import logging
from typing import Any

import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from services.connector_kit.helpers import make_client

logger = logging.getLogger("policylab.ai.providers")

DEFAULT_TIMEOUT = 90.0

_RETRY = dict(
    wait=wait_exponential(multiplier=0.3, max=6.0),
    stop=stop_after_attempt(3),
    reraise=True,
)


def _is_retryable(exc: BaseException) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code >= 500
    return isinstance(exc, (httpx.TransportError, httpx.TimeoutException))


def _url(base: str, path: str) -> str:
    base = (base or "").rstrip("/")
    path = "/" + path.lstrip("/")
    if path.startswith("/v1/") and base.endswith("/v1"):
        return base + path[3:]
    return base + path


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
        timeout: float = DEFAULT_TIMEOUT,
    ) -> None:
        super().__init__(transport=transport, timeout=timeout)
        self.base_url = (base_url or "https://api.openai.com/v1").rstrip("/")
        self.model = model or "gpt-4o-mini"
        self.embedding_model = embedding_model or "text-embedding-3-small"
        self.api_key = api_key or None

    def _headers(self) -> dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "Accept": "*/*",
            "User-Agent": "POLICYLAB/1.0 (+https://github.com/policylab)",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        if "kilo.ai" in (self.base_url or ""):
            headers["x-kilocode-feature"] = "cli"
        return headers

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
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        async with make_client(transport=self.transport, timeout=self.timeout) as client:
            resp = await client.post(
                _url(self.base_url, "/v1/chat/completions"),
                json=payload,
                headers=self._headers(),
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
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }
        async with make_client(transport=self.transport, timeout=self.timeout) as client:
            async with client.stream(
                "POST",
                _url(self.base_url, "/v1/chat/completions"),
                json=payload,
                headers=self._headers(),
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
