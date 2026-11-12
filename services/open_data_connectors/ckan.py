"""data.gov.gr CKAN connector (package_search API) — contract §5.2."""
from __future__ import annotations

from typing import Any

from services.connector_kit.base import BaseConnector, NormalizedRecord
from services.connector_kit.helpers import coerce_tags, first_str, get_json, parse_dt


class CkanConnector(BaseConnector):
    """CKAN dataset search against data.gov.gr (also reused for Athens open data)."""

    name = "ckan"
    kind = "open_data"
    source_url = "https://data.gov.gr"
    default_reliability = 0.9

    DEFAULT_ENDPOINT = "https://data.gov.gr/api/3/action/package_search"

    def __init__(self, endpoint_url: str = "", enabled: bool = True, config: dict | None = None) -> None:
        super().__init__(endpoint_url or self.DEFAULT_ENDPOINT, enabled, config)

    def _base_url(self, dataset_name: str | None) -> str:
        if dataset_name:
            return f"https://data.gov.gr/datasets/{dataset_name}"
        return self.source_url

    async def fetch(self, query: str | None = None, limit: int = 50) -> Any:
        params: dict[str, Any] = {"rows": int(self.config.get("rows", limit) or limit)}
        q = query if query not in (None, "") else self.config.get("q")
        if q:
            params["q"] = str(q)
        return await get_json(self.endpoint_url, params=params, transport=self.config.get("transport"))

    async def normalize(self, raw: Any) -> list[NormalizedRecord]:
        if not isinstance(raw, dict):
            return []
        result = raw.get("result") if isinstance(raw.get("result"), dict) else raw
        items = None
        if isinstance(result, dict):
            items = result.get("results")
        if items is None:
            items = raw.get("results") if isinstance(raw.get("results"), list) else None
        if items is None and isinstance(raw.get("items"), list):
            items = raw.get("items")
        if not isinstance(items, list):
            return []

        records: list[NormalizedRecord] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            try:
                name = item.get("name")
                title = first_str(item.get("title"), name)
                if not title:
                    continue
                org = item.get("organization")
                org_name = first_str(org.get("title"), org.get("name")) if isinstance(org, dict) else first_str(org)
                record = NormalizedRecord(
                    title=title,
                    source_name=self.name,
                    source_url=self._base_url(name if isinstance(name, str) else None),
                    description=first_str(item.get("notes"), item.get("description")),
                    provider=org_name,
                    license=first_str(item.get("license_title"), item.get("license")),
                    category=first_str(item.get("category"), item.get("group_title")),
                    tags=coerce_tags(item.get("tags")),
                    published_at=parse_dt(item.get("metadata_created")),
                    updated_at=parse_dt(item.get("metadata_modified")),
                    extra={
                        "ckan_id": item.get("id"),
                        "ckan_name": name,
                        "organization": org_name,
                        "num_resources": item.get("num_resources"),
                    },
                    reliability=self.default_reliability,
                )
                records.append(record)
            except Exception:  # noqa: BLE001 — tolerate malformed rows
                continue
        return records
