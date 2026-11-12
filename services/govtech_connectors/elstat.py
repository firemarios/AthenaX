"""ΕΛΣΤΑΤ releases/statistics connector (best effort) — contract §5.2."""
from __future__ import annotations

from typing import Any

from services.connector_kit.base import BaseConnector, NormalizedRecord
from services.connector_kit.helpers import first_str, get_any, parse_dt


class ElstatConnector(BaseConnector):
    """Ελληνική Στατιστική Αρχή — best effort JSON releases/statistics feed."""

    name = "elstat"
    kind = "statistics"
    source_url = "https://www.statistics.gr"
    default_reliability = 0.95

    DEFAULT_ENDPOINT = "https://www.statistics.gr/en"

    # Stable official publication pages (the portal exposes no public JSON search API).
    CURATED: tuple[dict[str, Any], ...] = (
        {
            "title": "Απογραφή Πληθυσμού–Κατοικιών 2021 — αποτελέσματα",
            "url": "https://www.statistics.gr/en/census_priv_results_1821-2021",
            "description": (
                "Επίσημα αποτελέσματα των απογραφών πληθυσμού της ΕΛΣΤΑΤ (1821–2021), "
                "με πληθυσμό, νοικοκυριά και δημογραφικά χαρακτηριστικά ανά δήμο."
            ),
            "tags": ["ελστατ", "πληθυσμός", "απογραφή", "δημογραφικά"],
        },
        {
            "title": "Πληθυσμός και κοινωνικές συνθήκες — ΕΛΣΤΑΤ",
            "url": "https://www.statistics.gr/en/statistics/pop",
            "description": (
                "Θεματική ενότητα ΕΛΣΤΑΤ για πληθυσμό, μετανάστευση, νοικοκυριά και "
                "κοινωνικούς δείκτες, με πίνακες και χρονοσειρές."
            ),
            "tags": ["ελστατ", "πληθυσμός", "κοινωνικά", "στατιστικά"],
        },
        {
            "title": "Έρευνα Εργατικού Δυναμικού — ανεργία (ΕΛΣΤΑΤ)",
            "url": "https://www.statistics.gr/en/statistics/-/publication/SJO01/",
            "description": (
                "Τριμηνιαία στοιχεία ΕΛΣΤΑΤ για απασχόληση και ανεργία στην Ελλάδα "
                "(ποσοστά, άνεργοι ανά ηλικία και φύλο)."
            ),
            "tags": ["ελστατ", "ανεργία", "απασχόληση", "στατιστικά"],
        },
    )

    def __init__(self, endpoint_url: str = "", enabled: bool = True, config: dict | None = None) -> None:
        super().__init__(endpoint_url or self.DEFAULT_ENDPOINT, enabled, config)

    def _curated_records(self) -> list[NormalizedRecord]:
        records: list[NormalizedRecord] = []
        for item in self.CURATED:
            records.append(
                NormalizedRecord(
                    title=str(item["title"]),
                    source_name=self.name,
                    source_url=str(item["url"]),
                    description=str(item["description"]),
                    provider="ΕΛΣΤΑΤ",
                    license="Ελεύθερη χρήση με αναφορά πηγής",
                    category="statistics",
                    tags=list(item.get("tags") or []),
                    extra={"curated": True},
                    reliability=self.default_reliability,
                )
            )
        return records

    async def fetch(self, query: str | None = None, limit: int = 50) -> Any:
        params: dict[str, Any] = {}
        if query:
            params["q"] = str(query)
        return await get_any(self.endpoint_url, params=params or None, transport=self.config.get("transport"))

    async def normalize(self, raw: Any) -> list[NormalizedRecord]:
        # HTML/text responses degrade to [] (no invented data).
        items: list[Any] | None = None
        if isinstance(raw, list):
            items = raw
        elif isinstance(raw, dict):
            for key in ("releases", "results", "items", "data", "publications"):
                value = raw.get(key)
                if isinstance(value, list):
                    items = value
                    break
        if not isinstance(items, list):
            return self._curated_records()

        records: list[NormalizedRecord] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            try:
                title = first_str(item.get("title"), item.get("subject"), item.get("name"))
                if not title:
                    continue
                url = first_str(item.get("url"), item.get("link"))
                if not url:
                    identifier = first_str(item.get("id"), item.get("slug"))
                    url = f"{self.source_url}/en/{identifier}" if identifier else self.source_url
                date_raw = item.get("date") or item.get("release_date") or item.get("published")
                records.append(
                    NormalizedRecord(
                        title=title,
                        source_name=self.name,
                        source_url=url,
                        description=first_str(item.get("description"), item.get("summary")),
                        provider=first_str(item.get("provider"), "ΕΛΣΤΑΤ"),
                        license=first_str(item.get("license"), "Ελεύθερη χρήση με αναφορά πηγής"),
                        category="statistics",
                        tags=["ελστατ", "στατιστικά"],
                        published_at=parse_dt(date_raw),
                        updated_at=parse_dt(item.get("modified") or item.get("updated")),
                        extra={
                            "identifier": first_str(item.get("id"), item.get("slug")),
                            "date": first_str(date_raw),
                            "org": first_str(item.get("org"), "ΕΛΣΤΑΤ"),
                        },
                        reliability=self.default_reliability,
                    )
                )
            except Exception:  # noqa: BLE001 — tolerate malformed rows
                continue
        for curated in self._curated_records():
            if all(existing.source_url != curated.source_url for existing in records):
                records.append(curated)
        return records
