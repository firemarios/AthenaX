"""GeoJSON helpers — convert DB rows / records into FeatureCollections."""

from __future__ import annotations

from typing import Any


def rows_to_geojson(rows: list[dict[str, Any]], *, id_key: str = "id") -> dict[str, Any]:
    """Convert rows with (id, properties, geometry) into a GeoJSON FeatureCollection."""
    features: list[dict[str, Any]] = []
    for row in rows or []:
        geometry = row.get("geometry") or row.get("geom")
        if isinstance(geometry, str):
            import json

            try:
                geometry = json.loads(geometry)
            except (ValueError, TypeError):
                continue
        if not geometry:
            continue
        properties = row.get("properties") or {}
        if isinstance(properties, str):
            import json

            try:
                properties = json.loads(properties)
            except (ValueError, TypeError):
                properties = {}
        features.append(
            {
                "type": "Feature",
                "id": row.get(id_key),
                "geometry": geometry,
                "properties": properties,
            }
        )
    return {"type": "FeatureCollection", "features": features}


def records_to_geojson(records: list[dict[str, Any]]) -> dict[str, Any]:
    """Convert NormalizedRecord dicts (lat/lon/geometry) into a FeatureCollection."""
    features: list[dict[str, Any]] = []
    for record in records or []:
        geometry = record.get("geometry")
        if not geometry and record.get("lat") is not None and record.get("lon") is not None:
            geometry = {"type": "Point", "coordinates": [record["lon"], record["lat"]]}
        if not geometry:
            continue
        props = {
            k: v
            for k, v in record.items()
            if k not in ("geometry", "lat", "lon") and v is not None
        }
        features.append({"type": "Feature", "geometry": geometry, "properties": props})
    return {"type": "FeatureCollection", "features": features}
