"""Real-data simulation snapshots (Phase 1, A +3.5).

`build_snapshot(area_id)` assembles the inputs the simulation models consume
(`parks`, `facilities`, `population_points`) from, in order:

1. `city_features` in the database (layers produced by the Overpass ingest);
2. a live Overpass/OSM query when the DB has no geo features;
3. deterministic synthetic fixtures (honestly flagged `mode="synthetic"`).

The returned dict always carries `mode`, per-layer `coverage`, `sources[]` with
real URLs and `retrieved_at`, so a Simulation Passport can prove where its
numbers came from. Never raises.
"""
from __future__ import annotations

import logging
import math
import random
import time
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger("athenax.snapshot")

_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_CACHE_TTL_SECONDS = 900

PARK_LEISURE = ("park", "garden", "nature_reserve", "recreation_ground")
FACILITY_AMENITY = (
    "school",
    "university",
    "college",
    "kindergarten",
    "hospital",
    "clinic",
    "doctors",
    "police",
    "townhall",
    "library",
    "courthouse",
    "fire_station",
)

_LAYER_TO_BUCKET = {
    "green_spaces": "parks",
    "schools": "facilities",
    "hospitals": "facilities",
    "public_facilities": "facilities",
    "population": "population_points",
}

_DEFAULT_PARK_M2 = 5000.0
_SYNTHETIC_POPULATION_POINTS = 240


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def _bbox(area: dict[str, Any]) -> list[float]:
    """[w, s, e, n] for a point + radius area."""
    lat = float(area.get("lat") or 37.9838)
    lon = float(area.get("lon") or 23.7275)
    radius = float(area.get("radius_m") or 700)
    d_lat = radius / 111_320.0
    d_lon = radius / (111_320.0 * max(math.cos(math.radians(lat)), 1e-6))
    return [lon - d_lon, lat - d_lat, lon + d_lon, lat + d_lat]


def _geometry_point(geometry: Any) -> tuple[float, float] | None:
    """Centroid-ish (lat, lon) from a GeoJSON geometry."""
    if not isinstance(geometry, dict):
        return None
    kind = geometry.get("type")
    coords = geometry.get("coordinates")
    if kind == "Point" and isinstance(coords, (list, tuple)) and len(coords) >= 2:
        try:
            return float(coords[1]), float(coords[0])
        except (TypeError, ValueError):
            return None
    if not isinstance(coords, list) or not coords:
        return None
    stack = [coords]
    lats: list[float] = []
    lons: list[float] = []
    while stack:
        node = stack.pop()
        if not isinstance(node, list):
            continue
        if len(node) >= 2 and isinstance(node[0], (int, float)) and isinstance(node[1], (int, float)):
            lons.append(float(node[0]))
            lats.append(float(node[1]))
        else:
            stack.extend(node)
    if not lats:
        return None
    return sum(lats) / len(lats), sum(lons) / len(lons)


def _props_area_m2(properties: dict[str, Any]) -> float:
    for key in ("area_m2", "area", "green_area_m2"):
        value = properties.get(key)
        if isinstance(value, (int, float)) and value > 0:
            return float(value)
    tags = properties.get("tags")
    if isinstance(tags, dict):
        value = tags.get("area") or tags.get("green_area_m2")
        if isinstance(value, (int, float)) and value > 0:
            return float(value)
    return _DEFAULT_PARK_M2


def _features_to_points(collection: Any, bucket: str) -> list[dict[str, Any]]:
    features = collection.get("features") if isinstance(collection, dict) else None
    if not isinstance(features, list):
        return []
    points: list[dict[str, Any]] = []
    for feature in features:
        if not isinstance(feature, dict):
            continue
        point = _geometry_point(feature.get("geometry"))
        if point is None:
            continue
        properties = feature.get("properties")
        properties = properties if isinstance(properties, dict) else {}
        lat, lon = point
        item: dict[str, Any] = {
            "lat": lat,
            "lon": lon,
            "title": properties.get("title") or properties.get("name"),
        }
        if bucket == "parks":
            item["area_m2"] = _props_area_m2(properties)
        if bucket == "population_points":
            weight = properties.get("weight") or properties.get("population")
            if isinstance(weight, (int, float)) and weight > 0:
                item["weight"] = float(weight)
        points.append(item)
    return points


async def _resolve_area(area_id: str | None) -> tuple[dict[str, Any], str]:
    wanted = str(area_id or "exarchia").strip().lower()
    try:
        from app.repositories import city as city_repo

        items, _ = await city_repo.list_areas()
        for item in items:
            keys = {
                str(item.get("id") or "").lower(),
                str(item.get("name_en") or "").lower(),
                str(item.get("name_el") or "").lower(),
            }
            if wanted in keys:
                return dict(item), wanted
    except Exception as exc:  # noqa: BLE001
        logger.debug("snapshot area lookup failed: %s", exc)
    from services.simulation_engine.models._fixtures import area_center

    area, _known = area_center(area_id)
    resolved = {
        "id": wanted,
        "name_el": area["name_el"],
        "name_en": area["name_en"],
        "lat": area["lat"],
        "lon": area["lon"],
        "radius_m": area["radius_m"],
    }
    return resolved, wanted


async def _collect_from_db(bbox: list[float], max_features: int) -> dict[str, list[dict[str, Any]]]:
    collected: dict[str, list[dict[str, Any]]] = {
        "parks": [],
        "facilities": [],
        "population_points": [],
    }
    try:
        from app.repositories import city as city_repo
    except Exception:  # noqa: BLE001
        return collected
    for layer, bucket in _LAYER_TO_BUCKET.items():
        try:
            collection, _degraded = await city_repo.query_features(layer, bbox, max_features)
        except Exception:  # noqa: BLE001
            continue
        points = _features_to_points(collection, bucket)
        if points:
            collected[bucket].extend(points)
    return collected


def _overpass_query(bbox: list[float]) -> str:
    w, s, e, n = bbox
    box = f"({s},{w},{n},{e})"
    leisure = "|".join(PARK_LEISURE)
    amenity = "|".join(FACILITY_AMENITY)
    return (
        "[out:json][timeout:25];"
        "("
        f'way["leisure"~"^({leisure})$"]{box};'
        f'node["leisure"~"^({leisure})$"]{box};'
        f'way["amenity"~"^({amenity})$"]{box};'
        f'node["amenity"~"^({amenity})$"]{box};'
        ");"
        "out center tags;"
    )


async def _collect_from_overpass(bbox: list[float], timeout: float) -> dict[str, list[dict[str, Any]]]:
    collected: dict[str, list[dict[str, Any]]] = {
        "parks": [],
        "facilities": [],
        "population_points": [],
    }
    import httpx

    headers = {"User-Agent": "AthenaX/1.0 (+https://github.com/firemarios/AthenaX-V2)"}
    endpoints = (
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
        "https://overpass.private.coffee/api/interpreter",
    )
    payload: Any = None
    per_endpoint = max(4.0, min(float(timeout), 12.0) / len(endpoints) + 2.0)
    async with httpx.AsyncClient(timeout=per_endpoint, follow_redirects=True) as client:
        for endpoint in endpoints:
            try:
                response = await client.post(
                    endpoint,
                    data={"data": _overpass_query(bbox)},
                    headers=headers,
                )
                response.raise_for_status()
                payload = response.json()
                break
            except Exception as exc:  # noqa: BLE001 — try the next mirror
                logger.info("snapshot: live Overpass %s unavailable (%s)", endpoint, exc)
    if payload is None:
        return collected

    elements = payload.get("elements") if isinstance(payload, dict) else None
    if not isinstance(elements, list):
        return collected
    for element in elements:
        if not isinstance(element, dict):
            continue
        tags = element.get("tags")
        if not isinstance(tags, dict):
            continue
        lat = element.get("lat")
        lon = element.get("lon")
        center = element.get("center")
        if (lat is None or lon is None) and isinstance(center, dict):
            lat, lon = center.get("lat"), center.get("lon")
        if lat is None or lon is None:
            continue
        try:
            item = {"lat": float(lat), "lon": float(lon), "title": tags.get("name")}
        except (TypeError, ValueError):
            continue
        leisure_tag = str(tags.get("leisure") or "")
        amenity_tag = str(tags.get("amenity") or "")
        if leisure_tag in PARK_LEISURE:
            area = tags.get("area")
            if isinstance(area, (int, float)) and area > 0:
                item["area_m2"] = float(area)
            else:
                item["area_m2"] = _DEFAULT_PARK_M2
            collected["parks"].append(item)
        elif amenity_tag in FACILITY_AMENITY:
            item["kind"] = amenity_tag
            collected["facilities"].append(item)
    return collected


def _synthetic(
    area: dict[str, Any], *, parks: bool, facilities: bool, population: bool
) -> dict[str, list[dict[str, Any]]]:
    from services.simulation_engine.models._fixtures import synthetic_points

    rng = random.Random(42)
    lat = float(area.get("lat") or 37.9838)
    lon = float(area.get("lon") or 23.7275)
    radius = float(area.get("radius_m") or 700)
    result: dict[str, list[dict[str, Any]]] = {
        "parks": [],
        "facilities": [],
        "population_points": [],
    }
    if parks:
        result["parks"] = [
            {"lat": plat, "lon": plon, "area_m2": _DEFAULT_PARK_M2}
            for plat, plon in synthetic_points(lat, lon, radius * 0.9, 6, rng)
        ]
    if facilities:
        result["facilities"] = [
            {"lat": flat, "lon": flon}
            for flat, flon in synthetic_points(lat, lon, radius * 0.9, 8, rng)
        ]
    if population:
        result["population_points"] = [
            {"lat": pp_lat, "lon": pp_lon}
            for pp_lat, pp_lon in synthetic_points(
                lat, lon, radius, _SYNTHETIC_POPULATION_POINTS, rng
            )
        ]
    return result


def _reach(area: dict[str, Any], snapshot: dict[str, Any]) -> dict[str, Any]:
    radius = float(area.get("radius_m") or 700)
    weights = [
        float(point.get("weight") or 0)
        for point in snapshot.get("population_points") or []
        if isinstance(point, dict)
    ]
    population = int(sum(weights)) if weights and any(weights) else None
    return {
        "area_km2": round(math.pi * (radius**2) / 1_000_000, 3),
        "population": population,
        "facilities": len(snapshot.get("facilities") or []),
        "parks": len(snapshot.get("parks") or []),
    }


def summarise(snapshot: dict[str, Any]) -> dict[str, Any]:
    """Small, persistable view of a snapshot (no point arrays)."""
    summary = {
        key: snapshot.get(key)
        for key in ("area_id", "area", "bbox", "mode", "coverage", "observed", "sources", "reach", "retrieved_at")
    }
    summary["degraded"] = bool(snapshot.get("degraded"))
    return summary


async def build_snapshot(
    area_id: str | None,
    *,
    live: bool | None = None,
    max_features: int = 2000,
    use_cache: bool = True,
) -> dict[str, Any]:
    """Build the simulation input snapshot for one area. Never raises."""
    key = str(area_id or "exarchia").strip().lower()
    now = time.monotonic()
    if use_cache and key in _CACHE:
        cached_at, cached = _CACHE[key]
        if now - cached_at < _CACHE_TTL_SECONDS:
            return cached

    area, resolved_id = await _resolve_area(area_id)
    bbox = _bbox(area)
    retrieved_at = _utcnow()

    db_points = await _collect_from_db(bbox, max_features)
    sources: list[dict[str, Any]] = []
    origins: dict[str, str] = {}
    for bucket in ("parks", "facilities", "population_points"):
        if db_points.get(bucket):
            origins[bucket] = "database"
    if origins:
        sources.append(
            {
                "name": "AthenaX city_features (OpenStreetMap ingest)",
                "url": "https://www.openstreetmap.org",
                "kind": "database",
                "retrieved_at": retrieved_at,
            }
        )

    live_enabled = live
    if live_enabled is None:
        try:
            from app.config import get_settings

            live_enabled = bool(get_settings().snapshot_live)
        except Exception:  # noqa: BLE001
            live_enabled = False

    degraded = False
    live_points: dict[str, list[dict[str, Any]]] = {
        "parks": [],
        "facilities": [],
        "population_points": [],
    }
    if live_enabled and (not origins.get("parks") or not origins.get("facilities")):
        timeout = 12.0
        try:
            from app.config import get_settings

            timeout = float(get_settings().snapshot_overpass_timeout)
        except Exception:  # noqa: BLE001
            pass
        live_points = await _collect_from_overpass(bbox, timeout)
        if live_points.get("parks") or live_points.get("facilities"):
            sources.append(
                {
                    "name": "OpenStreetMap Overpass API (ODbL 1.0)",
                    "url": "https://overpass-api.de/api/interpreter",
                    "kind": "live",
                    "retrieved_at": retrieved_at,
                }
            )
            for bucket in ("parks", "facilities"):
                if not origins.get(bucket) and live_points.get(bucket):
                    origins[bucket] = "live"
        else:
            degraded = True

    snapshot: dict[str, Any] = {
        "area_id": resolved_id,
        "area": area,
        "bbox": bbox,
        "parks": [],
        "facilities": [],
        "population_points": [],
    }
    for bucket in ("parks", "facilities", "population_points"):
        chosen = db_points.get(bucket) or []
        if not chosen and live_points.get(bucket):
            chosen = live_points[bucket]
        snapshot[bucket] = chosen

    synthetic = _synthetic(
        area,
        parks=not snapshot["parks"],
        facilities=not snapshot["facilities"],
        population=not snapshot["population_points"],
    )
    for bucket, values in synthetic.items():
        if values and not snapshot[bucket]:
            snapshot[bucket] = values
            origins[bucket] = "synthetic"

    mode = "snapshot" if any(origin in {"database", "live"} for origin in origins.values()) else "synthetic"
    snapshot["mode"] = mode
    snapshot["coverage"] = {
        bucket: origins.get(bucket, "synthetic")
        for bucket in ("parks", "facilities", "population_points")
    }
    snapshot["observed"] = {
        bucket: len(snapshot[bucket]) for bucket in ("parks", "facilities", "population_points")
    }
    if not sources:
        sources = [
            {
                "name": "Deterministic synthetic fixtures (no external data available)",
                "kind": "synthetic",
                "retrieved_at": retrieved_at,
            }
        ]
    snapshot["sources"] = sources
    snapshot["retrieved_at"] = retrieved_at
    snapshot["degraded"] = degraded
    snapshot["reach"] = _reach(area, snapshot)

    if use_cache:
        _CACHE[key] = (now, snapshot)
    return snapshot


def clear_cache() -> None:
    _CACHE.clear()


__all__ = ["build_snapshot", "clear_cache", "summarise"]
