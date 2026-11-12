"""Dataset quality scoring (contract §5.3): completeness / freshness / validity (0..1)."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from services.connector_kit.helpers import parse_dt
from services.data_ingestion.validation import validate_record

# Keys considered when measuring completeness of a unified record.
COMPLETENESS_KEYS = [
    "title",
    "source_url",
    "description",
    "provider",
    "license",
    "category",
    "tags",
    "published_at",
    "updated_at",
    "lat",
    "lon",
]

FRESHNESS_WINDOW_DAYS = 14


def _filled(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, tuple, dict)):
        return len(value) > 0
    return True


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def _record_date(record: dict, fetched_at: datetime | None) -> datetime | None:
    for key in ("updated_at", "published_at", "fetched_at"):
        parsed = parse_dt(record.get(key))
        if parsed is not None:
            return parsed
    return parse_dt(fetched_at)


def score_quality(record: dict, fetched_at: datetime | None = None) -> dict:
    """Quality {completeness, freshness, validity, validation_status} — deterministic per day."""
    if not isinstance(record, dict) or not record:
        return {
            "completeness": None,
            "freshness": None,
            "validity": None,
            "validation_status": "pending",
        }

    filled_count = sum(1 for key in COMPLETENESS_KEYS if _filled(record.get(key)))
    completeness = _clamp(filled_count / len(COMPLETENESS_KEYS))

    date = _record_date(record, fetched_at)
    if date is None:
        freshness = None
    else:
        now = datetime.now(timezone.utc)
        age_days = max(0, (now.date() - date.date()).days)
        freshness = _clamp(1.0 - age_days / FRESHNESS_WINDOW_DAYS)

    validation = validate_record(record)
    validity = 1.0 if validation["valid"] else 0.0

    if validation["valid"]:
        status = "valid" if completeness >= 0.5 else "warning"
    else:
        status = "invalid"

    return {
        "completeness": completeness,
        "freshness": freshness,
        "validity": validity,
        "validation_status": status,
    }
