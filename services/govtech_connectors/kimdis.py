"""ΚΗΜΔΗΣ contracts/procurement connector (best effort) — contract §5.2."""
from __future__ import annotations

from typing import Any

from services.connector_kit.base import BaseConnector, NormalizedRecord
from services.connector_kit.helpers import coerce_float, first_str, get_any, parse_dt


class KimdisConnector(BaseConnector):
    """Συμβάσεις και προμήθειες από τον ΚΗΜΔΗΣ (best effort JSON)."""

    name = "kimdis"
    kind = "govtech"
    source_url = "https://kimdis.mou.gr"
    default_reliability = 0.8

    DEFAULT_ENDPOINT = "https://kimdis.mou.gr"

    def __init__(self, endpoint_url: str = "", enabled: bool = True, config: dict | None = None) -> None:
        super().__init__(endpoint_url or self.DEFAULT_ENDPOINT, enabled, config)

    async def fetch(self, query: str | None = None, limit: int = 50) -> Any:
        params: dict[str, Any] = {"limit": int(limit)}
        if query:
            params["q"] = str(query)
        return await get_any(self.endpoint_url, params=params, transport=self.config.get("transport"))

    async def normalize(self, raw: Any) -> list[NormalizedRecord]:
        # Only JSON payloads are accepted; HTML/text degrades to [] (search never raises).
        items: list[Any] | None = None
        if isinstance(raw, list):
            items = raw
        elif isinstance(raw, dict):
            for key in ("results", "items", "contracts", "data"):
                value = raw.get(key)
                if isinstance(value, list):
                    items = value
                    break
        if not isinstance(items, list):
            return []

        records: list[NormalizedRecord] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            try:
                title = first_str(item.get("title"), item.get("name"), item.get("subject"))
                if not title:
                    continue
                url = first_str(item.get("url"), item.get("link"))
                if not url:
                    identifier = first_str(item.get("id"), item.get("protocol"))
                    url = f"{self.source_url}/{identifier}" if identifier else self.source_url
                value = coerce_float(item.get("value") or item.get("budget") or item.get("amount"))
                date_raw = item.get("date") or item.get("announced_at") or item.get("published")
                records.append(
                    NormalizedRecord(
                        title=title,
                        source_name=self.name,
                        source_url=url,
                        description=first_str(item.get("description"), item.get("summary")),
                        provider=first_str(item.get("org"), item.get("buyer"), "ΚΗΜΔΗΣ"),
                        license="Δημόσια πληροφορία",
                        category="contract",
                        tags=["κημδησ", "σύμβαση"],
                        published_at=parse_dt(date_raw),
                        extra={
                            "identifier": first_str(item.get("id"), item.get("protocol")),
                            "value_eur": value,
                            "org": first_str(item.get("org"), item.get("buyer")),
                            "date": first_str(date_raw),
                        },
                        reliability=self.default_reliability,
                    )
                )
            except Exception:  # noqa: BLE001 — tolerate malformed rows
                continue
        return records
