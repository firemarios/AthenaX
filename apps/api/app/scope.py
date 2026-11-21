"""City scope — which ingested sources/rows feed the Athens platform."""
from __future__ import annotations

from typing import Any

# Sources that provide Athens city data or live city feeds.
ATHENS_SOURCE_IDS = frozenset(
    {"athens", "overpass", "openmeteo", "eurostat", "elstat"}
)

_ATHENS_TERMS = ("αθη", "athens", "αττικ", "attica")


def _tags_text(value: Any) -> str:
    if isinstance(value, (list, tuple, set)):
        return " ".join(str(item) for item in value)
    return str(value or "")


def is_athens_row(row: dict[str, Any]) -> bool:
    """True when a dataset row belongs to the Athens scope."""
    source_id = str(row.get("source_id") or row.get("source_name") or "").strip().lower()
    if source_id in ATHENS_SOURCE_IDS:
        return True
    haystack = " ".join(
        (
            str(row.get("title") or ""),
            str(row.get("description") or ""),
            _tags_text(row.get("tags")),
        )
    ).lower()
    return any(term in haystack for term in _ATHENS_TERMS)
