"""City repository — layers/counts, whitelisted feature queries, areas, city centre."""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("policylab.repositories.city")

# Athens default centre (contracts §2 / Digital Twin)
DEFAULT_CENTER = (37.9838, 23.7275)

# id -> {el, en} intervention areas fallback (mirrors catalog.yaml city_areas)
_DEFAULT_AREAS: list[dict[str, Any]] = [
    {"id": "exarchia", "name_el": "Εξάρχεια", "name_en": "Exarchia",
     "lat": 37.9880, "lon": 23.7330, "radius_m": 700},
    {"id": "kolonaki", "name_el": "Κολωνάκι", "name_en": "Kolonaki",
     "lat": 37.9790, "lon": 23.7430, "radius_m": 700},
    {"id": "kerameikos", "name_el": "Κεραμεικός", "name_en": "Kerameikos",
     "lat": 37.9780, "lon": 23.7170, "radius_m": 700},
    {"id": "kypseli", "name_el": "Κυψέλη", "name_en": "Kypseli",
     "lat": 38.0000, "lon": 23.7350, "radius_m": 800},
    {"id": "pagkrati", "name_el": "Παγκράτι", "name_en": "Pagkrati",
     "lat": 37.9650, "lon": 23.7480, "radius_m": 700},
    {"id": "metaxourgio", "name_el": "Μεταξουργείο", "name_en": "Metaxourgeio",
     "lat": 37.9850, "lon": 23.7230, "radius_m": 700},
]


async def layer_counts() -> tuple[dict[str, int], bool]:
    """layer -> feature count from city_features (DB). ({}, True) when unavailable."""
    try:
        from app.database import session_scope
        from app.models import CityFeature
        from sqlalchemy import func, select

        counts: dict[str, int] = {}
        async with session_scope() as session:
            rows = (
                await session.execute(
                    select(CityFeature.layer, func.count(CityFeature.id)).group_by(CityFeature.layer)
                )
            ).all()
            for layer, count in rows:
                counts[str(layer)] = int(count)
        return counts, False
    except Exception as exc:  # noqa: BLE001
        logger.debug("layer_counts: DB μη διαθέσιμη (%s)", exc)
        return {}, True


async def query_features(
    layer: str, bbox: list[float] | None, limit: int
) -> tuple[dict[str, Any], bool]:
    """Whitelisted feature query via services.feature_query → GeoJSON FeatureCollection.

    Raises ValueError for unknown layers (whitelist enforced by the service).
    """
    from services.geospatial_engine.geojson import rows_to_geojson
    from services.geospatial_engine.queries import feature_query, feature_query_sqlite

    try:
        from app.database import engine, session_scope
        from sqlalchemy import text

        builder = (
            feature_query_sqlite
            if engine.url.get_backend_name() == "sqlite"
            else feature_query
        )
        sql, params = builder(layer, bbox, limit)  # ValueError on unknown layer
        async with session_scope() as session:
            result = await session.execute(text(sql), params)
            rows = [dict(mapping) for mapping in result.mappings()]
        return rows_to_geojson(rows), False
    except ValueError:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.debug("query_features: DB μη διαθέσιμη (%s)", exc)
        return {"type": "FeatureCollection", "features": []}, True


async def list_areas() -> tuple[list[dict[str, Any]], bool]:
    """city_areas — DB (seeded from catalog.yaml) → YAML → static defaults. Never raises."""
    try:
        from app.database import session_scope
        from app.models import CityArea
        from sqlalchemy import select

        async with session_scope() as session:
            rows = (await session.execute(select(CityArea).order_by(CityArea.id))).scalars()
            items = [
                {
                    "id": row.id,
                    "name_el": row.name_el,
                    "name_en": row.name_en,
                    "lat": row.lat,
                    "lon": row.lon,
                    "radius_m": row.radius_m,
                }
                for row in rows
            ]
        if items:
            return items, False
    except Exception as exc:  # noqa: BLE001
        logger.debug("list_areas: DB μη διαθέσιμη (%s)", exc)

    # YAML fallback (catalog.yaml city_areas, contract §9.2)
    try:
        from app.repositories.sources import load_catalog

        entries = load_catalog().get("city_areas") or []
        items = [dict(entry) for entry in entries if isinstance(entry, dict)]
        if items:
            return items, False
    except Exception:  # noqa: BLE001
        pass
    return [dict(area) for area in _DEFAULT_AREAS], False


async def get_city_center(city: str | None = None) -> tuple[float, float]:
    """(lat, lon) for a city — DB `cities` table → Athens default. Never raises."""
    if city:
        try:
            from app.database import session_scope
            from app.models import City
            from sqlalchemy import select

            async with session_scope() as session:
                row = (
                    await session.execute(select(City).where(City.name.ilike(str(city))))
                ).scalar_one_or_none()
                if row is None:
                    row = (
                        await session.execute(select(City).where(City.name_el.ilike(str(city))))
                    ).scalar_one_or_none()
                if row is not None and row.lat is not None and row.lon is not None:
                    return float(row.lat), float(row.lon)
        except Exception:  # noqa: BLE001
            pass
        lowered = str(city).lower()
        for area in await _areas_for_center():
            if lowered in (str(area.get("name_en") or "").lower(), str(area.get("name_el") or "").lower(),
                           str(area.get("id") or "").lower()):
                try:
                    return float(area["lat"]), float(area["lon"])
                except (KeyError, TypeError, ValueError):
                    break
    try:
        from app.repositories.sources import load_catalog

        center = (load_catalog().get("city") or {}).get("center") or []
        if len(center) == 2:
            return float(center[0]), float(center[1])
    except Exception:  # noqa: BLE001
        pass
    return DEFAULT_CENTER


async def _areas_for_center() -> list[dict[str, Any]]:
    try:
        items, _ = await list_areas()
        return items
    except Exception:  # noqa: BLE001
        return []


async def upsert_area(entry: dict[str, Any]) -> None:
    """Seed one city_areas row. Never raises."""
    area_id = str(entry.get("id") or "").strip()
    if not area_id:
        return
    from app.database import session_scope
    from app.models import CityArea
    from sqlalchemy import select

    async with session_scope() as session:
        row = (await session.execute(select(CityArea).where(CityArea.id == area_id))).scalar_one_or_none()
        if row is None:
            row = CityArea(id=area_id)
            session.add(row)
        row.name_el = entry.get("name_el")
        row.name_en = entry.get("name_en")
        row.lat = float(entry["lat"]) if entry.get("lat") is not None else None
        row.lon = float(entry["lon"]) if entry.get("lon") is not None else None
        row.radius_m = int(entry["radius_m"]) if entry.get("radius_m") is not None else None
