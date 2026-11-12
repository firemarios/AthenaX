"""Διαύγεια public decisions connector — contract §5.2."""
from __future__ import annotations

from typing import Any

from services.connector_kit.base import BaseConnector, NormalizedRecord
from services.connector_kit.helpers import first_str, get_any, parse_dt


class DiavgeiaConnector(BaseConnector):
    """Δημόσιες αποφάσεις από το ανοικτό σύνολο δεδομένων της Διαύγειας."""

    name = "diavgeia"
    kind = "govtech"
    source_url = "https://diavgeia.gov.gr"
    default_reliability = 0.95

    DEFAULT_ENDPOINT = "https://diavgeia.gov.gr/luminapi/opendata/search"

    def __init__(self, endpoint_url: str = "", enabled: bool = True, config: dict | None = None) -> None:
        super().__init__(endpoint_url or self.DEFAULT_ENDPOINT, enabled, config)

    async def fetch(self, query: str | None = None, limit: int = 50) -> Any:
        params: dict[str, Any] = {"size": max(1, min(int(limit or 50), 100))}
        if query:
            params["q"] = str(query)
        page = self.config.get("page")
        if page:
            params["page"] = page
        return await get_any(self.endpoint_url, params=params, transport=self.config.get("transport"))

    async def normalize(self, raw: Any) -> list[NormalizedRecord]:
        items: list[Any] | None = None
        if isinstance(raw, list):
            items = raw
        elif isinstance(raw, dict):
            for key in ("decisions", "results", "items"):
                value = raw.get(key)
                if isinstance(value, list):
                    items = value
                    break
            if items is None and isinstance(raw.get("data"), list):
                items = raw.get("data")
        if not isinstance(items, list):
            return []

        records: list[NormalizedRecord] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            try:
                title = first_str(item.get("title"), item.get("subject"), item.get("name"))
                if not title:
                    continue
                ada = first_str(item.get("ada"), item.get("id"))
                url = first_str(item.get("documentUrl"), item.get("url"))
                if not url and ada:
                    url = f"{self.source_url}/doc/{ada}"
                url = url or self.source_url
                org = first_str(item.get("org"), item.get("orgName"), item.get("authority"), item.get("organization"))
                date_raw = (
                    item.get("date")
                    or item.get("decisionDate")
                    or item.get("issueDate")
                    or item.get("issued")
                    or item.get("published")
                )
                date_text = first_str(date_raw)
                date_dt = parse_dt(date_raw)
                if date_dt is not None:
                    date_text = date_dt.date().isoformat()
                elif date_text and date_text.isdigit() and len(date_text) >= 12:
                    from datetime import datetime, timezone

                    try:
                        date_text = datetime.fromtimestamp(
                            int(date_text) / 1000, tz=timezone.utc
                        ).date().isoformat()
                    except (OverflowError, ValueError):
                        pass
                decision_type = first_str(
                    item.get("decisionTypeName"),
                    item.get("decisionType"),
                    item.get("decision_type"),
                )
                if decision_type is None and item.get("decisionTypeId") is not None:
                    decision_type = str(item.get("decisionTypeId"))
                record = NormalizedRecord(
                    title=title,
                    source_name=self.name,
                    source_url=url,
                    description=first_str(item.get("summary"), item.get("description")) or title,
                    provider=org,
                    license="Ελεύθερη χρήση δημοσίων αποφάσεων",
                    category="decision",
                    tags=["διαύγεια", "απόφαση"],
                    published_at=date_dt,
                    extra={
                        "ada": ada,
                        "date": date_text,
                        "org": org,
                        "decision_type": decision_type,
                    },
                    reliability=self.default_reliability,
                )
                records.append(record)
            except Exception:  # noqa: BLE001 — tolerate malformed rows
                continue
        return records
