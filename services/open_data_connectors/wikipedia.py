"""Wikipedia search connector (web fallback) — Greek Wikipedia MediaWiki API."""
from __future__ import annotations

import re
from typing import Any
from urllib.parse import quote

from services.connector_kit.base import BaseConnector, NormalizedRecord
from services.connector_kit.helpers import get_json, lang_text

_TAG_RE = re.compile(r"<[^>]+>")
_SPACE_RE = re.compile(r"\s+")
_HEADERS = {"User-Agent": "PolicyLab/1.0 (public policy research; https://policylab.local)"}


def _clean(text: Any) -> str | None:
    value = lang_text(text)
    if not value:
        return None
    value = _TAG_RE.sub(" ", value)
    value = _SPACE_RE.sub(" ", value).strip()
    return value or None


class WikipediaConnector(BaseConnector):
    """Greek Wikipedia search + intro extracts, used when curated sources are thin."""

    name = "wikipedia"
    kind = "web"
    source_url = "https://el.wikipedia.org"
    default_reliability = 0.6

    DEFAULT_ENDPOINT = "https://el.wikipedia.org/w/api.php"

    def __init__(self, endpoint_url: str = "", enabled: bool = True, config: dict | None = None) -> None:
        super().__init__(endpoint_url or self.DEFAULT_ENDPOINT, enabled, config)

    async def fetch(self, query: str | None = None, limit: int = 5) -> Any:
        term = (query or "").strip()
        if not term:
            return {}
        params = {
            "action": "query",
            "list": "search",
            "srsearch": term,
            "format": "json",
            "srlimit": max(1, min(int(limit), 5)),
            "srprop": "snippet",
        }
        return await get_json(
            self.endpoint_url,
            params=params,
            headers=_HEADERS,
            transport=self.config.get("transport"),
            timeout=12.0,
        )

    def _page_url(self, title: str) -> str:
        return f"{self.source_url}/wiki/{quote(title.replace(' ', '_'))}"

    async def _extracts(self, titles: list[str]) -> dict[str, str]:
        if not titles:
            return {}
        params = {
            "action": "query",
            "prop": "extracts",
            "exintro": 1,
            "explaintext": 1,
            "exchars": 900,
            "titles": "|".join(titles),
            "format": "json",
            "redirects": 1,
        }
        try:
            raw = await get_json(
                self.endpoint_url,
                params=params,
                headers=_HEADERS,
                transport=self.config.get("transport"),
                timeout=12.0,
            )
        except Exception:  # noqa: BLE001 — snippets are enough
            return {}
        pages = ((raw or {}).get("query") or {}).get("pages") if isinstance(raw, dict) else None
        extracts: dict[str, str] = {}
        if isinstance(pages, dict):
            for page in pages.values():
                if not isinstance(page, dict):
                    continue
                title = str(page.get("title") or "")
                extract = _clean(page.get("extract"))
                if title and extract:
                    extracts[title] = extract
        return extracts

    async def normalize(self, raw: Any) -> list[NormalizedRecord]:
        if not isinstance(raw, dict):
            return []
        items = ((raw.get("query") or {}).get("search") if isinstance(raw.get("query"), dict) else None)
        if not isinstance(items, list):
            return []

        candidates: list[tuple[str, str | None]] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            title = str(item.get("title") or "").strip()
            if title:
                candidates.append((title, _clean(item.get("snippet"))))
        if not candidates:
            return []

        extracts: dict[str, str] = {}
        try:
            extracts = await self._extracts([title for title, _ in candidates[:3]])
        except Exception:  # noqa: BLE001
            extracts = {}

        records: list[NormalizedRecord] = []
        for title, snippet in candidates:
            description = extracts.get(title) or snippet
            records.append(
                NormalizedRecord(
                    title=title,
                    source_name="wikipedia",
                    source_url=self._page_url(title),
                    description=description,
                    provider="Wikipedia (Ελληνική)",
                    license="CC BY-SA 4.0",
                    category="web",
                    tags=["wikipedia", "web", "εγκυκλοπαίδεια"],
                    extra={"page_title": title},
                    reliability=self.default_reliability,
                )
            )
        return records
