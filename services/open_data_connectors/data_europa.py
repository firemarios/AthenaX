"""data.europa.eu catalogue connector — contract §5.2."""
from __future__ import annotations

from typing import Any

from services.connector_kit.base import BaseConnector, NormalizedRecord
from services.connector_kit.helpers import coerce_tags, first_str, get_json, lang_text, parse_dt


class DataEuropaConnector(BaseConnector):
    """European data catalogue search (data.europa.eu hub API)."""

    name = "data_europa"
    kind = "open_data"
    source_url = "https://data.europa.eu"
    default_reliability = 0.9

    DEFAULT_ENDPOINT = "https://data.europa.eu/api/hub/search/search"

    def __init__(self, endpoint_url: str = "", enabled: bool = True, config: dict | None = None) -> None:
        super().__init__(endpoint_url or self.DEFAULT_ENDPOINT, enabled, config)

    async def fetch(self, query: str | None = None, limit: int = 50) -> Any:
        params: dict[str, Any] = {"limit": int(self.config.get("limit", limit) or limit)}
        if query:
            params["q"] = str(query)
        return await get_json(self.endpoint_url, params=params, transport=self.config.get("transport"))

    @staticmethod
    def _item_url(item: dict) -> str | None:
        landing = lang_text(item.get("landing_page"))
        if landing and landing.startswith(("http://", "https://")):
            return landing
        raw_id = item.get("id") or item.get("uri") or item.get("url")
        text = lang_text(raw_id)
        if not text:
            return None
        if text.startswith("http://") or text.startswith("https://"):
            return text
        return f"https://data.europa.eu/data/datasets/{text}"

    async def normalize(self, raw: Any) -> list[NormalizedRecord]:
        items: list[Any] | None = None
        if isinstance(raw, list):
            items = raw
        elif isinstance(raw, dict):
            result = raw.get("result")
            container = result if isinstance(result, dict) else raw
            for key in ("items", "results", "datasets"):
                value = container.get(key)
                if isinstance(value, list):
                    items = value
                    break
            if items is None and isinstance(result, list):
                items = result
        if not isinstance(items, list):
            return []

        records: list[NormalizedRecord] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            try:
                title = first_str(item.get("title"), item.get("name"))
                url = self._item_url(item)
                if not title and not url:
                    continue
                records.append(
                    NormalizedRecord(
                        title=title or url or "χωρίς τίτλο",
                        source_name=self.name,
                        source_url=url or self.source_url,
                        description=first_str(item.get("description"), item.get("summary")),
                        provider=first_str(
                            item.get("publisher"),
                            item.get("creator"),
                            item.get("organisation"),
                            "data.europa.eu",
                        ),
                        license=first_str(item.get("license"), item.get("licence")),
                        category="open_data",
                        tags=coerce_tags(item.get("themes") or item.get("keywords")),
                        published_at=parse_dt(item.get("issued") or item.get("published")),
                        updated_at=parse_dt(item.get("modified") or item.get("updated")),
                        extra={"dataset_id": item.get("id"), "format": item.get("format")},
                        reliability=self.default_reliability,
                    )
                )
            except Exception:  # noqa: BLE001 — tolerate malformed rows
                continue
        return records
