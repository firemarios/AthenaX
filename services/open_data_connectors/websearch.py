"""DuckDuckGo HTML search connector (web fallback / «google it»)."""
from __future__ import annotations

import re
from html import unescape
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

from services.connector_kit.base import BaseConnector, NormalizedRecord
from services.connector_kit.helpers import get_any, lang_text

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}
_TAG_RE = re.compile(r"<[^>]+>")
_SPACE_RE = re.compile(r"\s+")
_RESULT_RE = re.compile(
    r'class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', re.S
)
_SNIPPET_RE = re.compile(r'class="result__snippet"[^>]*>(.*?)</a>', re.S)


def _clean_html(value: Any) -> str:
    text = lang_text(value) or ""
    if not text:
        return ""
    return _SPACE_RE.sub(" ", unescape(_TAG_RE.sub(" ", text))).strip()


def _target_url(href: str) -> str | None:
    href = unescape(href or "").strip()
    if not href:
        return None
    if "uddg=" in href:
        try:
            query = parse_qs(urlparse(href).query)
            candidate = (query.get("uddg") or [""])[0]
            href = unquote(candidate) or href
        except Exception:  # noqa: BLE001
            pass
    if href.startswith("//"):
        href = "https:" + href
    if not href.startswith(("http://", "https://")):
        return None
    host = (urlparse(href).netloc or "").lower()
    if "duckduckgo.com" in host:
        return None
    return href


class WebSearchConnector(BaseConnector):
    """Anonymous DuckDuckGo HTML search; used only when curated sources are thin."""

    name = "websearch"
    kind = "web"
    source_url = "https://duckduckgo.com"
    default_reliability = 0.55

    DEFAULT_ENDPOINT = "https://html.duckduckgo.com/html/"

    def __init__(self, endpoint_url: str = "", enabled: bool = True, config: dict | None = None) -> None:
        super().__init__(endpoint_url or self.DEFAULT_ENDPOINT, enabled, config)

    async def fetch(self, query: str | None = None, limit: int = 5) -> Any:
        term = (query or "").strip()
        if not term:
            return ""
        return await get_any(
            self.endpoint_url,
            params={"q": term},
            headers=_HEADERS,
            transport=self.config.get("transport"),
            timeout=15.0,
        )

    async def normalize(self, raw: Any) -> list[NormalizedRecord]:
        if not isinstance(raw, str) or "result__a" not in raw:
            return []
        titles = _RESULT_RE.findall(raw)
        snippets = _SNIPPET_RE.findall(raw)
        records: list[NormalizedRecord] = []
        seen: set[str] = set()
        for index, (href, title_html) in enumerate(titles):
            url = _target_url(href)
            title = _clean_html(title_html)
            if not url or not title or url in seen:
                continue
            seen.add(url)
            snippet = _clean_html(snippets[index]) if index < len(snippets) else ""
            host = (urlparse(url).netloc or "").lower().removeprefix("www.")
            records.append(
                NormalizedRecord(
                    title=title,
                    source_name=self.name,
                    source_url=url,
                    description=snippet or None,
                    provider=host or "Διαδίκτυο",
                    license=None,
                    category="web",
                    tags=["web", "αναζήτηση"],
                    extra={"host": host, "query": title},
                    reliability=self.default_reliability,
                )
            )
        return records
