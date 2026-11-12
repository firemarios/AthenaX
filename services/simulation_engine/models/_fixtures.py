"""Deterministic synthetic fixtures shared by the simulation models (contract §5.5)."""
from __future__ import annotations

import math
import random

# Seeded intervention areas (data/source-registry/catalog.yaml → city_areas)
AREAS: dict[str, dict] = {
    "exarchia": {"name_el": "Εξάρχεια", "name_en": "Exarchia", "lat": 37.9880, "lon": 23.7330, "radius_m": 700},
    "kolonaki": {"name_el": "Κολωνάκι", "name_en": "Kolonaki", "lat": 37.9790, "lon": 23.7430, "radius_m": 700},
    "kerameikos": {"name_el": "Κεραμεικός", "name_en": "Kerameikos", "lat": 37.9780, "lon": 23.7170, "radius_m": 700},
    "kypseli": {"name_el": "Κυψέλη", "name_en": "Kypseli", "lat": 38.0000, "lon": 23.7350, "radius_m": 800},
    "pagkrati": {"name_el": "Παγκράτι", "name_en": "Pagkrati", "lat": 37.9650, "lon": 23.7480, "radius_m": 700},
    "metaxourgio": {"name_el": "Μεταξουργείο", "name_en": "Metaxourgeio", "lat": 37.9850, "lon": 23.7230, "radius_m": 700},
}

DEFAULT_AREA_ID = "exarchia"


def area_center(area_id: str | None) -> tuple[dict, bool]:
    """Return (area dict, known?) — accepts ids or Greek/English names."""
    key = str(area_id or "").strip().lower()
    if key in AREAS:
        return AREAS[key], True
    for area in AREAS.values():
        names = {str(area["name_el"]).strip().lower(), str(area["name_en"]).strip().lower()}
        if key in names:
            return area, True
    return AREAS[DEFAULT_AREA_ID], False


def offset_point(lat: float, lon: float, dist_m: float, bearing_rad: float) -> tuple[float, float]:
    d_lat = (dist_m * math.cos(bearing_rad)) / 111_320.0
    cos_lat = max(math.cos(math.radians(lat)), 1e-6)
    d_lon = (dist_m * math.sin(bearing_rad)) / (111_320.0 * cos_lat)
    return lat + d_lat, lon + d_lon


def synthetic_points(
    lat: float,
    lon: float,
    radius_m: float,
    count: int,
    rng: random.Random,
) -> list[tuple[float, float]]:
    """Deterministic points uniformly distributed inside a circle (given rng/seed)."""
    count = max(0, int(count))
    points: list[tuple[float, float]] = []
    for _ in range(count):
        dist = math.sqrt(rng.random()) * radius_m
        bearing = rng.uniform(0.0, 2.0 * math.pi)
        points.append(offset_point(lat, lon, dist, bearing))
    return points


def snapshot_points(snapshot: dict | None, key: str) -> list[dict] | None:
    """Read [{lat, lon, ...}] lists from a snapshot dict, if present."""
    if not isinstance(snapshot, dict):
        return None
    value = snapshot.get(key)
    if not isinstance(value, list):
        return None
    cleaned: list[dict] = []
    for item in value:
        if isinstance(item, dict) and item.get("lat") is not None and item.get("lon") is not None:
            cleaned.append(item)
    return cleaned or None
