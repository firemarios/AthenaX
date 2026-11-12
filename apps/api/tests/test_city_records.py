"""Digital Twin derived records for Ask the City (green spaces per neighbourhood)."""
from __future__ import annotations

from app.services.intelligence import _greenspace_records


def _square(lat: float, lon: float, half_deg: float = 0.00045) -> dict:
    ring = [
        [lon - half_deg, lat - half_deg],
        [lon + half_deg, lat - half_deg],
        [lon + half_deg, lat + half_deg],
        [lon - half_deg, lat + half_deg],
        [lon - half_deg, lat - half_deg],
    ]
    return {
        "type": "Feature",
        "geometry": {"type": "Polygon", "coordinates": [ring]},
        "properties": {"name": "Πλατεία δοκιμής"},
    }


def test_greenspace_records_rank_least_green_first():
    areas = [
        {"id": "a", "name_el": "Περιοχή Α", "lat": 37.98, "lon": 23.73, "radius_m": 700},
        {"id": "b", "name_el": "Περιοχή Β", "lat": 37.99, "lon": 23.75, "radius_m": 700},
    ]
    population = [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [23.73, 37.98]},
            "properties": {"name": "a", "population": 10000},
        },
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [23.75, 37.99]},
            "properties": {"name": "b", "population": 20000},
        },
    ]
    records = _greenspace_records([_square(37.98, 23.73)], areas, population)
    assert len(records) == 2
    assert records[0]["extra"]["area"] == "Περιοχή Β"
    assert records[0]["extra"]["green_m2"] == 0
    assert records[1]["extra"]["area"] == "Περιοχή Α"
    assert 7_000 <= records[1]["extra"]["green_m2"] <= 11_000
    assert "Κατάταξη συνολικού πρασίνου: 2 από 2" in records[1]["description"]
