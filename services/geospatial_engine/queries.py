"""Whitelisted, read-only SQL builders — user input NEVER becomes SQL (contract §5.4)."""

from __future__ import annotations

import math

from services.geospatial_engine.layers import LAYER_REGISTRY


def feature_query(layer_id: str, bbox: list[float] | None, limit: int = 500) -> tuple[str, dict]:
    """Return (sql, params) for a known layer. Raises ValueError on unknown layer."""
    if layer_id not in LAYER_REGISTRY:
        raise ValueError(f"Άγνωστο layer: {layer_id}")
    limit = max(1, min(int(limit), 5000))
    params: dict = {"layer": layer_id, "limit": limit}
    sql = (
        "SELECT id, layer, properties, ST_AsGeoJSON(geom)::json AS geometry "
        "FROM city_features WHERE layer = :layer"
    )
    if bbox and len(bbox) == 4:
        w, s, e, n = (float(v) for v in bbox)
        params.update({"w": w, "s": s, "e": e, "n": n})
        sql += " AND geom && ST_MakeEnvelope(:w, :s, :e, :n, 4326)"
    sql += " ORDER BY id LIMIT :limit"
    return sql, params


def feature_query_sqlite(
    layer_id: str, bbox: list[float] | None, limit: int = 500
) -> tuple[str, dict]:
    """SQLite variant: geometry is stored as GeoJSON text (no PostGIS functions)."""
    if layer_id not in LAYER_REGISTRY:
        raise ValueError(f"Άγνωστο layer: {layer_id}")
    limit = max(1, min(int(limit), 5000))
    sql = (
        "SELECT id, layer, properties, geom AS geometry "
        "FROM city_features WHERE layer = :layer ORDER BY id LIMIT :limit"
    )
    return sql, {"layer": layer_id, "limit": limit}


def bbox_from_center(lat: float, lon: float, radius_m: float) -> list[float]:
    """Bounding box [w, s, e, n] around a center point (WGS84)."""
    deg_lat = radius_m / 111_320.0
    cos_lat = max(math.cos(math.radians(lat)), 1e-6)
    deg_lon = radius_m / (111_320.0 * cos_lat)
    return [lon - deg_lon, lat - deg_lat, lon + deg_lon, lat + deg_lat]


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in metres."""
    r = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def parse_bbox(raw: str | None) -> list[float] | None:
    """Parse 'w,s,e,n' query param into floats; None/invalid → None."""
    if not raw:
        return None
    try:
        parts = [float(p.strip()) for p in raw.split(",")]
    except (ValueError, AttributeError):
        return None
    if len(parts) != 4:
        return None
    w, s, e, n = parts
    if not (-180 <= w < e <= 180 and -90 <= s < n <= 90):
        return None
    return [w, s, e, n]
