"""City / Digital Twin module (04): layers, features (GeoJSON), areas."""
from __future__ import annotations

from app.deps import get_request_id
from app.envelope import DB_DOWN_NOTE, build_meta, ok
from app.repositories import city as city_repo
from fastapi import APIRouter, HTTPException, Query, Request

from services.geospatial_engine.layers import LAYER_REGISTRY
from services.geospatial_engine.queries import parse_bbox

router = APIRouter()


@router.get("/city/layers")
async def city_layers(request: Request):
    """CityLayer[] from services LAYER_REGISTRY + live feature counts (contract §5.4)."""
    counts, degraded = await city_repo.layer_counts()
    layers = []
    for layer_id, spec in LAYER_REGISTRY.items():
        description = spec.get("description")
        if isinstance(description, dict):
            description = description.get("el")
        layers.append(
            {
                "id": layer_id,
                "title": spec.get("title") or {"el": layer_id, "en": layer_id},
                "geometry_type": spec.get("geometry_type") or "Unknown",
                "source": spec.get("source") or "",
                "description": description,
                "feature_count": int(counts.get(layer_id, 0)),
            }
        )
    meta = build_meta(get_request_id(request), total=len(layers))
    if degraded:
        meta["limitations"] = [DB_DOWN_NOTE]
    return ok(layers, meta)


@router.get("/city/features")
async def city_features(
    request: Request,
    layer: str = Query(..., description="Layer id (λευκός κατάλογος: LAYER_REGISTRY)"),
    bbox: str | None = Query(None, description="w,s,e,n σε μοίρες"),
    limit: int = Query(500, ge=1, le=5000),
):
    """GeoJSON FeatureCollection for a whitelisted layer. Unknown layer → 400 (Greek)."""
    parsed_bbox = parse_bbox(bbox)
    if bbox and parsed_bbox is None:
        raise HTTPException(
            status_code=400, detail="Μη έγκυρο bbox. Αναμενόμενη μορφή: w,s,e,n."
        )
    try:
        collection, degraded = await city_repo.query_features(layer, parsed_bbox, limit)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    meta = build_meta(
        get_request_id(request), total=len(collection.get("features") or [])
    )
    if degraded:
        meta["limitations"] = [DB_DOWN_NOTE]
    return ok(collection, meta)


@router.get("/city/areas")
async def city_areas(request: Request):
    """Area[] — named intervention areas for the Policy Lab (seeded from catalog.yaml)."""
    items, degraded = await city_repo.list_areas()
    meta = build_meta(get_request_id(request), total=len(items))
    if degraded:
        meta["limitations"] = [DB_DOWN_NOTE]
    return ok(items, meta)
