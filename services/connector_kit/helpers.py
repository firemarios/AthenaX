"""Shared connector helpers: retried HTTP fetch (httpx + tenacity) and tolerant coercions.

Contract §1: HTTP client = httpx with tenacity retries (3 attempts, exp backoff); timeout 15s.
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any

import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

DEFAULT_TIMEOUT = 15.0

_RETRYABLE = dict(
    wait=wait_exponential(multiplier=0.2, max=3.0),
    stop=stop_after_attempt(3),
    reraise=True,
)


def _is_retryable(exc: BaseException) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code >= 500
    return isinstance(exc, (httpx.TransportError, httpx.TimeoutException))


def make_client(*, transport: Any = None, timeout: float = DEFAULT_TIMEOUT) -> httpx.AsyncClient:
    kwargs: dict[str, Any] = {"timeout": timeout, "follow_redirects": True}
    if transport is not None:
        kwargs["transport"] = transport
    return httpx.AsyncClient(**kwargs)


@retry(retry=retry_if_exception(_is_retryable), **_RETRYABLE)
async def get_json(
    url: str,
    *,
    params: dict | None = None,
    headers: dict | None = None,
    transport: Any = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> Any:
    async with make_client(transport=transport, timeout=timeout) as client:
        resp = await client.get(url, params=params, headers=headers)
        resp.raise_for_status()
        return resp.json()


@retry(retry=retry_if_exception(_is_retryable), **_RETRYABLE)
async def get_any(
    url: str,
    *,
    params: dict | None = None,
    headers: dict | None = None,
    transport: Any = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> Any:
    """GET returning parsed JSON when possible, otherwise the raw text."""
    async with make_client(transport=transport, timeout=timeout) as client:
        resp = await client.get(url, params=params, headers=headers)
        resp.raise_for_status()
        try:
            return resp.json()
        except ValueError:
            return resp.text


@retry(retry=retry_if_exception(_is_retryable), **_RETRYABLE)
async def post_json(
    url: str,
    *,
    json_body: Any = None,
    data: dict | None = None,
    headers: dict | None = None,
    transport: Any = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> Any:
    async with make_client(transport=transport, timeout=timeout) as client:
        resp = await client.post(url, json=json_body, data=data, headers=headers)
        resp.raise_for_status()
        return resp.json()


def parse_dt(value: Any) -> datetime | None:
    """Parse ISO strings (with/without Z), date-only strings, epoch ms and datetimes → aware UTC."""
    if isinstance(value, datetime):
        return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        try:
            seconds = float(value) / 1000.0 if float(value) > 1e11 else float(value)
            return datetime.fromtimestamp(seconds, tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            return None
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip()
    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        try:
            dt = datetime.strptime(text[:10], "%Y-%m-%d")
        except ValueError:
            return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def first_str(*values: Any) -> str | None:
    """First non-empty string among the given values (dicts with lang keys are unwrapped)."""
    for value in values:
        text = lang_text(value)
        if text:
            return text
    return None


def lang_text(value: Any) -> str | None:
    """Coerce str | {el:..., en:...} | [str, ...] → first non-empty string."""
    if isinstance(value, str):
        text = value.strip()
        return text or None
    if isinstance(value, dict):
        for key in ("el", "en", "gre", "ell", "default", "en-US"):
            text = lang_text(value.get(key))
            if text:
                return text
        for item in value.values():
            text = lang_text(item)
            if text:
                return text
        return None
    if isinstance(value, (list, tuple)):
        for item in value:
            text = lang_text(item)
            if text:
                return text
        return None
    return None


def coerce_tags(value: Any, *, limit: int = 20) -> list[str]:
    tags: list[str] = []
    if isinstance(value, dict):
        value = list(value.keys())
    if not isinstance(value, (list, tuple)):
        return tags
    for item in value:
        text = lang_text(item)
        if text and text not in tags:
            tags.append(text)
        if len(tags) >= limit:
            break
    return tags


def coerce_float(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = value.strip().replace(",", ".")
        if re.fullmatch(r"-?\d+(\.\d+)?", cleaned):
            return float(cleaned)
    return None


def safe_json_loads(value: Any) -> Any:
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except ValueError:
            return None
    return None


def sanitize_query_fragment(text: str, *, max_len: int = 80) -> str:
    """Strip characters that could break hand-built query languages (Overpass QL, regexes)."""
    cleaned = re.sub(r"[\"'`;\\<>]", " ", str(text or ""))
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned[:max_len]
