"""OpenStreetMap Overpass API connector — contract §5.2."""
from __future__ import annotations

from typing import Any

import httpx

from services.connector_kit.base import BaseConnector, NormalizedRecord
from services.connector_kit.helpers import coerce_tags, post_json, sanitize_query_fragment

# Greater Athens bbox (w, s, e, n)
DEFAULT_BBOX = (23.65, 37.93, 23.87, 38.05)

_CATEGORIES = ("amenity", "shop", "leisure", "tourism", "office", "healthcare", "railway", "highway")
_USER_AGENT = "AthenaX/1.0 (+https://github.com/firemarios/AthenaX-V2)"
_FALLBACK_ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
)


class OverpassConnector(BaseConnector):
    """POIs / buildings / roads from the Overpass API (OSM, ODbL)."""

    name = "overpass"
    kind = "geospatial"
    source_url = "https://www.openstreetmap.org"
    default_reliability = 0.9

    DEFAULT_ENDPOINT = "https://overpass-api.de/api/interpreter"

    def __init__(self, endpoint_url: str = "", enabled: bool = True, config: dict | None = None) -> None:
        super().__init__(endpoint_url or self.DEFAULT_ENDPOINT, enabled, config)

    def _bbox(self) -> tuple[float, float, float, float]:
        configured = self.config.get("bbox")
        if isinstance(configured, (list, tuple)) and len(configured) == 4:
            try:
                w, s, e, n = (float(v) for v in configured)
                return (w, s, e, n)
            except (TypeError, ValueError):
                pass
        return DEFAULT_BBOX

    def build_query(self, query: str | None, limit: int) -> str:
        w, s, e, n = self._bbox()
        bbox = f"({s},{w},{n},{e})"
        fragment = sanitize_query_fragment(query)
        limit = max(1, min(int(limit), 200))
        if fragment:
            body = (
                f'node["name"~"{fragment}",i]{bbox};'
                f'way["name"~"{fragment}",i]{bbox};'
            )
        else:
            # Digital Twin layers: parks + the facilities simulations depend on.
            body = (
                f'way["leisure"~"^(park|garden|nature_reserve|recreation_ground)$"]{bbox};'
                f'node["leisure"~"^(park|garden|nature_reserve|recreation_ground)$"]{bbox};'
                f'way["amenity"~"^(school|university|college|kindergarten|hospital|clinic|doctors|pharmacy|police|townhall|library|courthouse|fire_station)$"]{bbox};'
                f'node["amenity"~"^(school|university|college|kindergarten|hospital|clinic|doctors|pharmacy|police|townhall|library|courthouse|fire_station)$"]{bbox};'
                f'way["amenity"]{bbox};'
                f'node["amenity"]{bbox};'
            )
        return f"[out:json][timeout:25];({body});out center {limit};"

    async def fetch(self, query: str | None = None, limit: int = 50) -> Any:
        ql = self.build_query(query, limit)
        transport = self.config.get("transport")
        endpoints = [self.endpoint_url] if transport else list(dict.fromkeys(
            [self.endpoint_url, *_FALLBACK_ENDPOINTS]
        ))
        last_error: Exception | None = None
        for endpoint in endpoints:
            try:
                return await post_json(
                    endpoint,
                    data={"data": ql},
                    headers={"User-Agent": _USER_AGENT},
                    transport=transport,
                    timeout=8.0,
                )
            except Exception as exc:  # noqa: BLE001 — try the next mirror
                last_error = exc
        raise last_error or RuntimeError("overpass: no endpoint available")

    async def health(self) -> dict[str, Any]:
        """Overpass rejects bare GETs (406); probe with a tiny real query instead."""
        from datetime import datetime, timezone
        from time import perf_counter

        checked_at = datetime.now(timezone.utc).isoformat()
        if not self.enabled:
            return {"status": "down", "latency_ms": None, "detail": "συνθήκη απενεργοποίησης",
                    "checked_at": checked_at}
        transport = self.config.get("transport")
        endpoints = [self.endpoint_url] if transport else list(dict.fromkeys(
            [self.endpoint_url, *_FALLBACK_ENDPOINTS]
        ))
        last_error: Exception | None = None
        for endpoint in endpoints:
            started = perf_counter()
            try:
                if transport:
                    await post_json(
                        endpoint,
                        data={"data": "[out:json][timeout:10];node(1);out 1;"},
                        headers={"User-Agent": _USER_AGENT},
                        transport=transport,
                        timeout=8.0,
                    )
                else:
                    async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                        response = await client.post(
                            endpoint,
                            data={"data": "[out:json][timeout:10];node(1);out 1;"},
                            headers={"User-Agent": _USER_AGENT},
                        )
                        response.raise_for_status()
                latency = int((perf_counter() - started) * 1000)
                return {"status": "healthy", "latency_ms": latency,
                        "detail": f"HTTP query ok ({endpoint})", "checked_at": checked_at}
            except Exception as exc:  # noqa: BLE001 — try the next mirror
                last_error = exc
        return {"status": "down", "latency_ms": None,
                "detail": f"{type(last_error).__name__}: {last_error}"[:200],
                "checked_at": checked_at}

    async def normalize(self, raw: Any) -> list[NormalizedRecord]:
        if not isinstance(raw, dict):
            return []
        elements = raw.get("elements")
        if not isinstance(elements, list):
            return []

        records: list[NormalizedRecord] = []
        for element in elements:
            if not isinstance(element, dict):
                continue
            try:
                tags = element.get("tags")
                if not isinstance(tags, dict):
                    continue
                title = tags.get("name")
                if not isinstance(title, str) or not title.strip():
                    continue
                category = next((str(tags[c]) for c in _CATEGORIES if tags.get(c)), None)
                lat = element.get("lat")
                lon = element.get("lon")
                center = element.get("center")
                if (lat is None or lon is None) and isinstance(center, dict):
                    lat, lon = center.get("lat"), center.get("lon")
                osm_type = element.get("type") or "node"
                osm_id = element.get("id")
                url = f"{self.source_url}/{osm_type}/{osm_id}" if osm_id is not None else self.source_url
                records.append(
                    NormalizedRecord(
                        title=title.strip(),
                        source_name=self.name,
                        source_url=url,
                        description=tags.get("description") or tags.get("name:en"),
                        provider="OpenStreetMap",
                        license="ODbL 1.0",
                        category=category,
                        tags=coerce_tags(list(tags.keys()), limit=12),
                        lat=float(lat) if isinstance(lat, (int, float)) else None,
                        lon=float(lon) if isinstance(lon, (int, float)) else None,
                        extra={"osm_type": osm_type, "osm_id": osm_id, "tags": dict(tags)},
                        reliability=self.default_reliability,
                    )
                )
            except Exception:  # noqa: BLE001 — tolerate malformed rows
                continue
        return records
