"""Athens open-data connector — CKAN search scoped to «Αθήνα» (contract §5.2)."""
from __future__ import annotations

from services.open_data_connectors.ckan import CkanConnector


class AthensConnector(CkanConnector):
    """Open Data Δήμου Αθηναίων via the data.gov.gr CKAN API (q=«Αθήνα»)."""

    name = "athens"
    kind = "govtech"
    source_url = "https://data.cityofathens.gr"
    default_reliability = 0.85

    def __init__(self, endpoint_url: str = "", enabled: bool = True, config: dict | None = None) -> None:
        cfg = dict(config or {})
        cfg.setdefault("q", "Αθήνα")
        super().__init__(endpoint_url or self.DEFAULT_ENDPOINT, enabled, cfg)
