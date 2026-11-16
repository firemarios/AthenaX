"""Deterministic synthetic fixtures shared by the simulation models (contract §5.5)."""
from __future__ import annotations

import math
import os
import random
from pathlib import Path

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

_CATALOG_CACHE: dict[str, dict] | None = None


def _catalog_areas() -> dict[str, dict]:
    """Extra areas from the active city pack (ATHENAX_CATALOG_FILE or default catalog)."""
    global _CATALOG_CACHE
    if _CATALOG_CACHE is not None:
        return _CATALOG_CACHE
    _CATALOG_CACHE = {}
    try:
        import yaml

        path = os.getenv("ATHENAX_CATALOG_FILE")
        if path:
            file_path = Path(path)
        else:
            file_path = Path(__file__).resolve().parents[3] / "data" / "source-registry" / "catalog.yaml"
        data = yaml.safe_load(file_path.read_text(encoding="utf-8")) or {}
        for entry in data.get("city_areas") or []:
            if not isinstance(entry, dict) or not entry.get("id"):
                continue
            try:
                _CATALOG_CACHE[str(entry["id"]).lower()] = {
                    "name_el": str(entry.get("name_el") or entry.get("name_en") or entry["id"]),
                    "name_en": str(entry.get("name_en") or entry.get("name_el") or entry["id"]),
                    "lat": float(entry["lat"]),
                    "lon": float(entry["lon"]),
                    "radius_m": int(entry.get("radius_m") or 700),
                }
            except (TypeError, ValueError, KeyError):
                continue
    except Exception:  # noqa: BLE001 — a missing/broken pack must not break simulations
        _CATALOG_CACHE = {}
    return _CATALOG_CACHE


def all_areas() -> dict[str, dict]:
    return {**AREAS, **_catalog_areas()}


def area_center(area_id: str | None) -> tuple[dict, bool]:
    """Return (area dict, known?) - accepts ids or Greek/English names."""
    areas = all_areas()
    key = str(area_id or "").strip().lower()
    if key in areas:
        return areas[key], True
    for area in areas.values():
        names = {str(area["name_el"]).strip().lower(), str(area["name_en"]).strip().lower()}
        if key in names:
            return area, True
    return areas.get(DEFAULT_AREA_ID, AREAS[DEFAULT_AREA_ID]), False


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
