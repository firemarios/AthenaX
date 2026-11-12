"""Accessibility model: walk-distance coverage of population by facilities (pure math)."""
from __future__ import annotations

import random

from services.geospatial_engine.queries import haversine_m
from services.simulation_engine.model_spec import ModelSpec
from services.simulation_engine.models._fixtures import (
    AREAS,
    area_center,
    snapshot_points,
    synthetic_points,
)

_POPULATION_POINTS = 240


class AccessibilityModel:
    """% of population within max_walk_m (haversine) of a facility."""

    name = "accessibility"

    SPEC = ModelSpec(
        name="accessibility",
        version="1.0.0",
        category="mobility",
        description={
            "el": "Προσβασιμότητα με τα πόδις: ποσοστό πληθυσμού εντός μέγιστης απόστασης από εγκαταστάσεις.",
            "en": "Walk accessibility: share of population within max walk distance of facilities.",
        },
        parameters=[
            {
                "name": "area_id",
                "type": "str",
                "default": "exarchia",
                "label": {"el": "Περιοχή", "en": "Area"},
            },
            {
                "name": "max_walk_m",
                "type": "int",
                "default": 500,
                "min": 100,
                "max": 5000,
                "label": {"el": "Μέγιστη απόσταση βόλτας (μ)", "en": "Max walk distance (m)"},
            },
            {
                "name": "facility_count",
                "type": "int",
                "default": 8,
                "min": 0,
                "max": 200,
                "label": {"el": "Αριθμός εγκαταστάσεων", "en": "Facility count"},
            },
            {
                "name": "population",
                "type": "int",
                "default": 10000,
                "min": 100,
                "max": 1_000_000,
                "label": {"el": "Πληθυσμός", "en": "Population"},
            },
        ],
    )

    ASSUMPTIONS = [
        "Οι εγκαταστάσεις και οι θέσεις πληθυσμού προκύπτουν δετερμιστικά από το seed όταν δεν παρέχεται snapshot.",
        "Απόσταση πεζής μετακίνησης: ευθεία γραμμή (haversine), όχι πραγματικό δίκτυο δρόμων.",
        "Κάθε σημείο πληθυσμού έχει ίσο βάρος (σταθμισμένος κάτοικοι ανά σημείο).",
    ]

    def run(self, parameters: dict, *, snapshot: dict | None = None, seed: int = 42) -> dict:
        warnings: list[str] = []
        area_id = parameters.get("area_id")
        area, known = area_center(area_id)
        if not known:
            warnings.append(
                f"Άγνωστη περιοχή «{area_id}» — χρήση προεπιλεγμένου κέντρου ({area['name_el']})."
            )
        max_walk_m = float(parameters.get("max_walk_m", 500))
        facility_count = int(parameters.get("facility_count", 8))
        population = int(parameters.get("population", 10000))

        rng = random.Random(seed)
        facilities = snapshot_points(snapshot, "facilities")
        if facilities is None:
            facilities = [
                {"lat": lat, "lon": lon}
                for lat, lon in synthetic_points(area["lat"], area["lon"], 700, facility_count, rng)
            ]
            if facility_count == 0:
                warnings.append("Μηδενικός αριθμός εγκαταστάσεων — πρόσβαση 0%.")

        points = snapshot_points(snapshot, "population_points")
        if points is None:
            points = [
                {"lat": lat, "lon": lon}
                for lat, lon in synthetic_points(area["lat"], area["lon"], area["radius_m"], _POPULATION_POINTS, rng)
            ]
        if not points or not facilities:
            return {
                "metrics": {
                    "accessibility_pct": 0.0,
                    "covered_population": 0.0,
                    "facilities_count": float(len(facilities)),
                },
                "assumptions": list(self.ASSUMPTIONS),
                "warnings": warnings + ["Κενά δεδομένα εγκαταστάσεων ή πληθυσμού."],
                "uncertainty": {"accessibility_pct": [0.0, 0.0]},
                "logs": [f"area={area['name_en'].lower()}", f"facilities={len(facilities)}", "mode=synthetic"],
            }

        weight_total = 0.0
        weight_covered = 0.0
        for point in points:
            weight = float(point.get("weight", 1.0) or 1.0)
            weight_total += weight
            lat, lon = float(point["lat"]), float(point["lon"])
            covered = any(
                haversine_m(lat, lon, float(f["lat"]), float(f["lon"])) <= max_walk_m for f in facilities
            )
            if covered:
                weight_covered += weight

        pct = (weight_covered / weight_total * 100.0) if weight_total else 0.0
        covered_population = (weight_covered / weight_total * population) if weight_total else 0.0

        return {
            "metrics": {
                "accessibility_pct": round(pct, 2),
                "covered_population": round(covered_population, 1),
                "facilities_count": float(len(facilities)),
            },
            "assumptions": list(self.ASSUMPTIONS),
            "warnings": warnings,
            "uncertainty": {
                "accessibility_pct": [round(max(0.0, pct - 5.0), 2), round(min(100.0, pct + 5.0), 2)]
            },
            "logs": [
                f"area={area['name_en'].lower()}",
                f"population_points={len(points)}",
                f"max_walk_m={max_walk_m:g}",
                "mode=snapshot" if snapshot else "mode=synthetic",
            ],
        }


__all__ = ["AccessibilityModel", "AREAS"]
