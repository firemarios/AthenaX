"""Eurostat dissemination API connector (JSON-stat) — contract §5.2."""
from __future__ import annotations

import asyncio
import re
from typing import Any

from services.connector_kit.base import BaseConnector, NormalizedRecord
from services.connector_kit.helpers import first_str, get_json, parse_dt

_DEFAULT_DATASET = "demo_pjan"
_DATASET_RE = re.compile(r"^[a-z][a-z0-9_]{1,48}$")


class EurostatConnector(BaseConnector):
    """Eurostat statistics via the dissemination statistics 1.0 API."""

    name = "eurostat"
    kind = "statistics"
    source_url = "https://ec.europa.eu/eurostat"
    default_reliability = 0.97

    DEFAULT_ENDPOINT = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data"

    def __init__(self, endpoint_url: str = "", enabled: bool = True, config: dict | None = None) -> None:
        super().__init__(endpoint_url or self.DEFAULT_ENDPOINT, enabled, config)

    def _dataset_code(self, query: str | None) -> str:
        candidate = (query or "").strip().lower()
        if candidate and _DATASET_RE.fullmatch(candidate):
            return candidate
        configured = str(self.config.get("dataset") or _DEFAULT_DATASET).strip().lower()
        return configured if _DATASET_RE.fullmatch(configured) else _DEFAULT_DATASET

    async def fetch(self, query: str | None = None, limit: int = 50) -> Any:
        dataset = self._dataset_code(query)
        url = f"{self.endpoint_url.rstrip('/')}/{dataset}"
        params = {"format": "JSON", "lang": "EN"}
        raw = await get_json(url, params=params, transport=self.config.get("transport"))
        if isinstance(raw, dict):
            raw = dict(raw)
            raw.setdefault("_dataset", dataset)
        return raw

    def _dataset_url(self, code: str) -> str:
        return f"https://ec.europa.eu/eurostat/databrowser/view/{code}/table"

    @staticmethod
    def _dimension_summary(raw: dict) -> str | None:
        dimension = raw.get("dimension")
        if not isinstance(dimension, dict):
            return None
        parts: list[str] = []
        for dim_id in list(raw.get("id") or dimension.keys())[:6]:
            dim = dimension.get(dim_id)
            if not isinstance(dim, dict):
                continue
            label = first_str(dim.get("label"), dim_id)
            categories = dim.get("category")
            if isinstance(categories, dict):
                index = categories.get("index")
                labels = categories.get("label") or {}
                if isinstance(index, dict):
                    names = list(index.keys())[:4]
                elif isinstance(index, list):
                    names = [str(i) for i in index[:4]]
                elif isinstance(labels, dict):
                    names = list(labels.keys())[:4]
                else:
                    names = []
                values = [first_str(labels.get(n), n) for n in names]
                values = [v for v in values if v]
                if values:
                    parts.append(f"{label}: {', '.join(values)}")
                else:
                    parts.append(str(label))
            elif label:
                parts.append(str(label))
        return " · ".join(parts) if parts else None

    async def normalize(self, raw: Any) -> list[NormalizedRecord]:
        records: list[NormalizedRecord] = []
        if isinstance(raw, dict) and "value" in raw:
            # Single JSON-stat dataset
            code = str(raw.get("_dataset") or self.config.get("dataset") or _DEFAULT_DATASET)
            title = first_str(raw.get("label"), code)
            if not title:
                return []
            description = self._dimension_summary(raw) or first_str(raw.get("description"))
            records.append(
                NormalizedRecord(
                    title=title,
                    source_name=self.name,
                    source_url=self._dataset_url(code),
                    description=description,
                    provider="Eurostat",
                    license=first_str(raw.get("license"), "CC BY 4.0 (EU)"),
                    category="statistics",
                    tags=["eurostat", code],
                    updated_at=parse_dt(raw.get("updated")),
                    extra={"dataset_code": code, "dimensions": raw.get("id"), "unit_count": raw.get("size")},
                    reliability=self.default_reliability,
                )
            )
            return records

        # Catalogue-style payloads: list of datasets or wrapper dicts
        items: list[Any] | None = None
        if isinstance(raw, list):
            items = raw
        elif isinstance(raw, dict):
            for key in ("results", "items", "datasets"):
                value = raw.get(key)
                if isinstance(value, list):
                    items = value
                    break
            result = raw.get("result")
            if items is None and isinstance(result, dict):
                for key in ("results", "items", "datasets"):
                    value = result.get(key)
                    if isinstance(value, list):
                        items = value
                        break
            if items is None and isinstance(result, list):
                items = result
        if not isinstance(items, list):
            return []

        for item in items:
            if not isinstance(item, dict):
                continue
            try:
                code = first_str(item.get("dataset_code"), item.get("code"), item.get("id"))
                title = first_str(item.get("title"), item.get("label"), code)
                if not title:
                    continue
                url = first_str(item.get("url"))
                if not url and code:
                    url = self._dataset_url(str(code).lower())
                records.append(
                    NormalizedRecord(
                        title=title,
                        source_name=self.name,
                        source_url=url or self.source_url,
                        description=first_str(item.get("description"), item.get("summary")),
                        provider=first_str(item.get("provider"), "Eurostat"),
                        license=first_str(item.get("license"), "CC BY 4.0 (EU)"),
                        category="statistics",
                        tags=["eurostat"],
                        published_at=parse_dt(item.get("published") or item.get("issued")),
                        updated_at=parse_dt(item.get("updated") or item.get("modified")),
                        extra={"dataset_code": code},
                        reliability=self.default_reliability,
                    )
                )
            except Exception:  # noqa: BLE001 — tolerate malformed rows
                continue
        return records

# ---------------------------------------------------------------- live series
POPULATION_DATASET = "demo_r_pjanaggr3"
UNEMPLOYMENT_DATASET = "lfst_r_lfu3rt"
FINANCE_DATASET = "gov_10a_main"
DEBT_DATASET = "gov_10dd_edpt1"

_FIXED_POPULATION = {"freq": "A", "unit": "NR", "sex": "T", "age": "TOTAL", "geo": "EL30"}
_FIXED_UNEMPLOYMENT = {
    "freq": "A",
    "isced11": "TOTAL",
    "sex": "T",
    "age": "Y15-74",
    "unit": "PC",
    "geo": "EL30",
}
_FIXED_FINANCE = {"freq": "A", "sector": "S13", "geo": "EL"}
_FIXED_DEFICIT = {**_FIXED_FINANCE, "unit": "PC_GDP", "na_item": "B9"}
_FIXED_EXPENDITURE = {**_FIXED_FINANCE, "unit": "MIO_EUR", "na_item": "TE"}
_FIXED_REVENUE = {**_FIXED_FINANCE, "unit": "MIO_EUR", "na_item": "TR"}
_FIXED_DEBT = {**_FIXED_FINANCE, "unit": "PC_GDP", "na_item": "GD"}


def _index_map(category: Any) -> dict[str, int] | None:
    if not isinstance(category, dict):
        return None
    index = category.get("index")
    if isinstance(index, dict):
        return {str(key): int(value) for key, value in index.items()}
    if isinstance(index, list):
        return {str(value): pos for pos, value in enumerate(index)}
    labels = category.get("label")
    if isinstance(labels, dict):
        return {str(key): pos for pos, key in enumerate(labels.keys())}
    return None


def _jsonstat_series(raw: dict, fixed: dict[str, str]) -> list[tuple[str, float]]:
    """Extract one time series from a JSON-stat 2.0 response for fixed dimensions."""
    ids = raw.get("id")
    sizes = raw.get("size")
    if not isinstance(ids, list) or not isinstance(sizes, list) or len(ids) != len(sizes):
        return []
    dimension = raw.get("dimension")
    if not isinstance(dimension, dict) or "time" not in ids:
        return []

    positions: dict[str, int] = {}
    for dim in ids:
        if dim in fixed:
            category = (dimension.get(dim) or {}).get("category")
            codes = _index_map(category) or {}
            if fixed[dim] not in codes:
                return []
            positions[dim] = codes[fixed[dim]]
        elif dim == "time":
            positions[dim] = 0
        else:
            category = (dimension.get(dim) or {}).get("category")
            codes = _index_map(category) or {}
            positions[dim] = min(codes.values()) if codes else 0

    time_codes = _index_map((dimension.get("time") or {}).get("category")) or {}
    if not time_codes:
        return []

    strides: list[int] = []
    acc = 1
    for size in reversed([int(s) for s in sizes]):
        strides.insert(0, acc)
        acc *= size

    values = raw.get("value") or {}
    series: list[tuple[str, float]] = []
    for code, pos in time_codes.items():
        positions["time"] = pos
        flat = sum(positions[dim] * strides[idx] for idx, dim in enumerate(ids))
        value = values.get(str(flat), values.get(flat))
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            series.append((code, float(value)))
    series.sort(key=lambda pair: pair[0])
    return series


async def fetch_jsonstat_series(
    dataset: str,
    fixed: dict[str, str],
    *,
    transport: Any = None,
    timeout: float = 20.0,
) -> dict[str, Any] | None:
    """Fetch one Eurostat dataset and return its metadata + time series."""
    url = f"{EurostatConnector.DEFAULT_ENDPOINT}/{dataset}"
    params = {"format": "JSON", "lang": "EN", **fixed}
    raw = await get_json(url, params=params, transport=transport, timeout=timeout)
    if not isinstance(raw, dict):
        return None
    series = _jsonstat_series(raw, fixed)
    if not series:
        return None
    return {
        "dataset": dataset,
        "label": first_str(raw.get("label"), dataset) or dataset,
        "updated": raw.get("updated"),
        "series": series,
    }


async def fetch_population_series(*, transport: Any = None) -> dict[str, Any] | None:
    return await fetch_jsonstat_series(POPULATION_DATASET, _FIXED_POPULATION, transport=transport)


async def fetch_unemployment_series(*, transport: Any = None) -> dict[str, Any] | None:
    return await fetch_jsonstat_series(UNEMPLOYMENT_DATASET, _FIXED_UNEMPLOYMENT, transport=transport)


async def fetch_finance_series(*, transport: Any = None) -> dict[str, Any] | None:
    """Greece general-government deficit, debt, revenue and expenditure."""
    deficit, debt, revenue, expenditure = await asyncio.gather(
        fetch_jsonstat_series(FINANCE_DATASET, _FIXED_DEFICIT, transport=transport, timeout=25.0),
        fetch_jsonstat_series(DEBT_DATASET, _FIXED_DEBT, transport=transport, timeout=25.0),
        fetch_jsonstat_series(FINANCE_DATASET, _FIXED_REVENUE, transport=transport, timeout=25.0),
        fetch_jsonstat_series(FINANCE_DATASET, _FIXED_EXPENDITURE, transport=transport, timeout=25.0),
        return_exceptions=True,
    )
    result: dict[str, Any] = {}
    for key, value in (
        ("deficit", deficit),
        ("debt", debt),
        ("revenue", revenue),
        ("expenditure", expenditure),
    ):
        if isinstance(value, dict) and value.get("series"):
            result[key] = value
    return result or None
