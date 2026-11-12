"""Green-space model: green m² per capita + % of population within 300 m of a park."""
from __future__ import annotations

import math
import random

from services.geospatial_engine.queries import haversine_m
from services.simulation_engine.model_spec import ModelSpec
from services.simulation_engine.models._fixtures import (
    area_center,
    snapshot_points,
    synthetic_points,
)

_POPULATION_POINTS = 240


class GreenspaceModel:
    name = "greenspace"

    SPEC = ModelSpec(
        name="greenspace",
        version="1.0.0",
        category="environment",
        description={
            "el": "Πράσινο δίκτυο: τετραγωνικά μέτρα πράσινου ανά κάτοικο και ποσοστό εντός 300 μ από πάρκο.",
            "en": "Green space: green m² per capita and share of population within 300 m of a park.",
        },
        parameters=[
            {
                "name": "area_id",
                "type": "str",
                "default": "exarchia",
                "label": {"el": "Περιοχή", "en": "Area"},
            },
            {
                "name": "population",
                "type": "int",
                "default": 10000,
                "min": 100,
                "max": 1_000_000,
                "label": {"el": "Πληθυσμός", "en": "Population"},
            },
            {
                "name": "park_count",
                "type": "int",
                "default": 6,
                "min": 0,
                "max": 200,
                "label": {"el": "Αριθμός πάρκων", "en": "Park count"},
            },
            {
                "name": "avg_park_m2",
                "type": "float",
                "default": 5000.0,
                "min": 0.0,
                "max": 10_000_000.0,
                "label": {"el": "Μέσος όρος εμβαδού πάρκου (m²)", "en": "Average park area (m²)"},
            },
        ],
    )

    ASSUMPTIONS = [
        "Τα πάρκα και οι θέσεις πληθυσμού προκύπτουν δετερμιστικά από το seed όταν δεν παρέχεται snapshot.",
        "Κάθε πάρκο θεωρείται κυκλικό με εμβαδόν ίσο του avg_park_m2 (ακτίνα √(A/π)).",
        "«Εντός 300 μ» μετριέται ως ευθεία απόσταση (haversine) από το κέντρο του πάρκου.",
    ]

    def run(self, parameters: dict, *, snapshot: dict | None = None, seed: int = 42) -> dict:
        warnings: list[str] = []
        area, known = area_center(parameters.get("area_id"))
        if not known:
            warnings.append(f"Άγνωστη περιοχή — χρήση προεπιλεγμένου κέντρου ({area['name_el']}).")

        population = int(parameters.get("population", 10000))
        park_count = int(parameters.get("park_count", 6))
        avg_park_m2 = float(parameters.get("avg_park_m2", 5000.0))
        if population <= 0:
            population = 1
            warnings.append("Μηδενικός πληθυσμός — χρήση 1 για αποφυγή διαίρεσης με μηδέν.")

        rng = random.Random(seed)
        parks = snapshot_points(snapshot, "parks")
        if parks is None:
            parks = [
                {"lat": lat, "lon": lon, "area_m2": avg_park_m2}
                for lat, lon in synthetic_points(area["lat"], area["lon"], 700, park_count, rng)
            ]

        total_green = sum(float(p.get("area_m2", avg_park_m2) or avg_park_m2) for p in parks)
        green_m2_per_capita = total_green / population

        points = snapshot_points(snapshot, "population_points")
        if points is None:
            points = [
                {"lat": lat, "lon": lon}
                for lat, lon in synthetic_points(area["lat"], area["lon"], area["radius_m"], _POPULATION_POINTS, rng)
            ]

        radii = []
        for park in parks:
            area_m2 = float(park.get("area_m2", avg_park_m2) or avg_park_m2)
            radii.append(math.sqrt(max(area_m2, 0.0) / math.pi))

        covered = 0
        total = 0
        for point in points:
            total += 1
            lat, lon = float(point["lat"]), float(point["lon"])
            for index, park in enumerate(parks):
                if haversine_m(lat, lon, float(park["lat"]), float(park["lon"])) <= radii[index] + 300.0:
                    covered += 1
                    break
        pct = (covered / total * 100.0) if total else 0.0

        if not parks:
            warnings.append("Κανένα πάρκο — ποσοστό προσβασιμότητας 0%.")

        return {
            "metrics": {
                "green_m2_per_capita": round(green_m2_per_capita, 2),
                "pct_within_300m": round(pct, 2),
                "green_area_m2": round(total_green, 1),
            },
            "assumptions": list(self.ASSUMPTIONS),
            "warnings": warnings,
            "uncertainty": {
                "green_m2_per_capita": [
                    round(green_m2_per_capita * 0.9, 2),
                    round(green_m2_per_capita * 1.1, 2),
                ],
                "pct_within_300m": [round(max(0.0, pct - 5.0), 2), round(min(100.0, pct + 5.0), 2)],
            },
            "logs": [
                f"area={area['name_en'].lower()}",
                f"parks={len(parks)}",
                f"population_points={len(points)}",
                "mode=snapshot" if snapshot else "mode=synthetic",
            ],
        }


__all__ = ["GreenspaceModel"]
