"""Retrieval helpers (contract §4): chunking, Greek-aware keyword scoring, retrieve().

Keyword scoring is the always-working baseline. Embedding similarity is optional and
used only when an embed provider registered via set_embed_provider() returns vectors
synchronously; any failure silently degrades to keyword scoring (never raises).
"""
from __future__ import annotations

import inspect
import logging
import math
import re
import unicodedata
from typing import Any

logger = logging.getLogger("athenax.ai.rag")

_TOKEN_RE = re.compile(r"[0-9a-zα-ωά-ώ]+", re.IGNORECASE)

_STOPWORDS = {
    # Greek
    "ο", "η", "το", "οι", "τα", "του", "της", "των", "και", "ή", "ενα", "ένα", "μια", "μία",
    "σε", "απο", "από", "για", "με", "στο", "στη", "στον", "στην", "στα", "στις", "που", "τι",
    "την", "τον", "δεν", "να", "ως", "τη", "πιο", "αυτο", "αυτη", "αυτά", "αυτα",
    # English
    "the", "a", "an", "of", "in", "on", "for", "to", "and", "or", "is", "are", "with", "by",
}


def normalize_text(text: str) -> str:
    """Lowercase + strip accents (Greek diacritics included)."""
    if not text:
        return ""
    lowered = str(text).lower()
    decomposed = unicodedata.normalize("NFD", lowered)
    stripped = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return stripped.replace("ς", "σ")


def tokenize(text: str) -> list[str]:
    normalized = normalize_text(text)
    return [m.group(0) for m in _TOKEN_RE.finditer(normalized)]


def content_tokens(record: Any) -> list[str]:
    if not isinstance(record, dict):
        return tokenize(str(record or ""))
    pieces: list[str] = []
    for key in ("title", "name", "description", "summary", "category", "provider", "source_name"):
        value = record.get(key)
        if value:
            pieces.append(str(value))
    tags = record.get("tags")
    if isinstance(tags, list):
        pieces.extend(str(t) for t in tags if t)
    extra = record.get("extra")
    if isinstance(extra, dict):
        for value in extra.values():
            if isinstance(value, str):
                pieces.append(value)
    return tokenize(" ".join(pieces))


def record_text(record: dict) -> str:
    return " ".join(content_tokens(record))


def chunk_text(text: str, *, size: int = 1200, overlap: int = 150) -> list[str]:
    text = str(text or "")
    if not text:
        return []
    size = max(1, int(size))
    overlap = max(0, min(int(overlap), size - 1))
    step = max(1, size - overlap)
    chunks: list[str] = []
    start = 0
    length = len(text)
    while start < length:
        chunks.append(text[start : start + size])
        if start + size >= length:
            break
        start += step
    return chunks


def keyword_score(query: str, text: str) -> float:
    """Token-overlap ratio, case/accent-insensitive (Greek safe). Range [0, 1]."""
    query_tokens = [t for t in tokenize(query) if t not in _STOPWORDS]
    if not query_tokens:
        return 0.0
    text_tokens = [t for t in tokenize(text) if t not in _STOPWORDS]
    if not text_tokens:
        return 0.0
    text_set = set(text_tokens)
    hits = sum(1 for token in set(query_tokens) if token in text_set)
    return hits / len(set(query_tokens))


_embed_provider: Any = None


def set_embed_provider(provider: Any) -> None:
    """Optionally enable embedding similarity (contract §4 hybrid retrieval)."""
    global _embed_provider
    _embed_provider = provider


def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


def _embed_score(query: str, text: str) -> float | None:
    """Cosine similarity via the registered provider; None when unavailable/async/failing."""
    provider = _embed_provider
    if provider is None:
        return None
    try:
        query_vec = provider.embed(query)
        text_vec = provider.embed(text)
        if inspect.isawaitable(query_vec) or inspect.isawaitable(text_vec):
            # retrieve() is sync — async embedders are not supported here; close coroutines.
            for coro in (query_vec, text_vec):
                if inspect.iscoroutine(coro):
                    coro.close()
            return None
        if not isinstance(query_vec, list) or not isinstance(text_vec, list):
            return None
        return _cosine([float(v) for v in query_vec], [float(v) for v in text_vec])
    except Exception:  # noqa: BLE001 — embeddings are strictly optional
        logger.debug("embedding score unavailable", exc_info=True)
        return None


def retrieve(query: str, records: list[dict], *, limit: int = 40) -> list[dict]:
    """Keyword baseline retrieval (always works), ordered by descending score.

    Never raises. Zero-score records keep their original relative order after
    scored ones, so a non-empty input never returns an empty list (unless limit<=0).
    """
    records = [r for r in (records or []) if isinstance(r, dict)]
    limit = int(limit)
    if limit <= 0 or not records:
        return []

    scored: list[tuple[float, int, dict]] = []
    for index, record in enumerate(records):
        text = record_text(record)
        score = keyword_score(query or "", text)
        embed = _embed_score(query or "", text)
        if embed is not None:
            score = score + 0.5 * embed
        scored.append((score, index, record))

    scored.sort(key=lambda item: (-item[0], item[1]))
    return [record for _, _, record in scored[:limit]]
