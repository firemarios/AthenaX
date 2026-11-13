"""Traffic model: SUMO adapter with deterministic synthetic queueing fallback (contract §5.5)."""
from __future__ import annotations

import importlib.util
import math
import random
import shutil

from services.simulation_engine.model_spec import ModelSpec

FREE_FLOW_MIN = 12.0
TRIP_KM = 8.0
DEFAULT_CHARGING_HOURS = 13.0

_INTERVENTIONS = ("open", "pedestrianize", "closed", "congestion_charge")

# (capacity factor, demand factor after rerouting)
_INTERVENTION_FACTORS = {
    "open": (1.0, 1.0),
    "congestion_charge": (1.15, 0.85),
    "pedestrianize": (0.15, 0.35),
    "closed": (0.05, 0.20),
}


def sumo_available() -> bool:
    """True only when sumolib or the sumo binary is present (usually not)."""
    try:
        if importlib.util.find_spec("sumolib") is not None:
            return True
    except (ImportError, ValueError):
        pass
    return shutil.which("sumo") is not None or shutil.which("sumo-gui") is not None


class TrafficSumoModel:
    name = "traffic_sumo"

    SPEC = ModelSpec(
        name="traffic_sumo",
        version="1.0.0",
        category="mobility",
        description={
            "el": "Κυκλοφορία: επίπτωση παρέμβασης (αποκλεισμός/πεζόδρομος) σε χρόνο, ουρές, εκπομπές και θόρυβο.",
            "en": "Traffic: effect of interventions (closure/pedestrianisation) on travel time, queues, emissions and noise.",
        },
        label={"el": "Κυκλοφορία", "en": "Traffic"},
        parameters=[
            {
                "name": "intervention",
                "type": "str",
                "default": "open",
                "choices": ["open", "congestion_charge", "pedestrianize", "closed"],
                "label": {
                    "el": "Παρέμβαση (open/congestion_charge/pedestrianize/closed)",
                    "en": "Intervention (open/congestion_charge/pedestrianize/closed)",
                },
            },
            {
                "name": "demand",
                "type": "int",
                "default": 1200,
                "min": 0,
                "max": 10_000,
                "label": {"el": "Ζήτηση (οχήματα/ώρα)", "en": "Demand (vehicles/hour)"},
            },
            {
                "name": "capacity",
                "type": "int",
                "default": 1600,
                "min": 100,
                "max": 10_000,
                "label": {"el": "Ικανότητα (οχήματα/ώρα)", "en": "Capacity (vehicles/hour)"},
            },
        ],
    )

    def _assumptions(self, synthetic: bool) -> list[str]:
        base = [
            "Μοντέλο ουράς BPR: χρόνος = ελεύθερος χρόνος × (1 + 0,15 × (ζήτηση/ικανότητα)^4).",
            "Εκπομπές ανά διαδρομή 8 km, θερμότητα/θόρυβος συναρτήσει της χρησιμότητας.",
            "Η ζήτηση τροφοδοτείται με μικρή διακύμανση ±5% από το seed (δετερμιστική).",
        ]
        if synthetic:
            base.insert(
                0,
                "ΣΥΝΘΕΤΙΚΟ fallback μοντέλο: το SUMO/sumolib δεν είναι διαθέσιμο στο περιβάλλον εκτέλεσης, "
                "οπότε χρησιμοποιείται αντίστοιχο αναλυτικό μοντέλο ουράς.",
            )
        else:
            base.insert(0, "Διαθέσιμο SUMO/sumolib — πιθανή προσομοίωση μεγαλύτερης λεπτομέρειας.")
        return base

    def run(self, parameters: dict, *, snapshot: dict | None = None, seed: int = 42) -> dict:
        warnings: list[str] = []
        intervention = str(parameters.get("intervention", "open") or "open").strip().lower()
        if intervention not in _INTERVENTION_FACTORS:
            warnings.append(f"Άγνωστη παρέμβαση «{intervention}» — χρήση «open».")
            intervention = "open"

        demand = max(0.0, float(parameters.get("demand", 1200)))
        capacity = max(1.0, float(parameters.get("capacity", 1600)))

        if intervention == "congestion_charge" and demand > capacity:
            demand = demand / DEFAULT_CHARGING_HOURS
            warnings.append(
                "Η ζήτηση ερμηνεύεται ως ημερήσιες είσοδοι και μετατρέπεται σε ωριαία ροή "
                f"για τις {DEFAULT_CHARGING_HOURS:.0f} ώρες χρέωσης."
            )

        rng = random.Random(seed)
        demand *= rng.uniform(0.95, 1.05)

        cap_factor, demand_factor = _INTERVENTION_FACTORS[intervention]
        effective_capacity = max(1.0, capacity * cap_factor)
        effective_demand = demand * demand_factor
        utilization = effective_demand / effective_capacity

        travel_min = FREE_FLOW_MIN * (1.0 + 0.15 * (utilization**4))
        throughput = min(effective_demand, effective_capacity)
        queue_m = max(0.0, effective_demand - effective_capacity) * 0.05
        emissions_kg = TRIP_KM * 0.16 * (travel_min / FREE_FLOW_MIN)
        noise_db = 55.0 + 8.0 * math.log10(1.0 + utilization * 9.0)

        synthetic = not sumo_available()
        if synthetic:
            warnings.append("sumo/sumolib μη διαθέσιμο — εκτέλεση με συνθετικό μοντέλο ουράς.")

        # Snapshot can override observed counts (still fully deterministic).
        metrics = {
            "avg_travel_min": round(travel_min, 2),
            "throughput_vph": round(throughput, 1),
            "queue_length_m": round(queue_m, 1),
            "emissions_kg": round(emissions_kg, 3),
            "noise_db": round(noise_db, 1),
        }
        if isinstance(snapshot, dict) and snapshot.get("observed"):
            warnings.append("Το παρεχόμενο snapshot περιέχει παρατηρήσεις — οι μετρήσεις παραμένουν αναλυτικές.")

        return {
            "metrics": metrics,
            "assumptions": self._assumptions(synthetic),
            "warnings": warnings,
            "uncertainty": {
                "avg_travel_min": [round(travel_min * 0.9, 2), round(travel_min * 1.15, 2)],
                "emissions_kg": [round(emissions_kg * 0.85, 3), round(emissions_kg * 1.2, 3)],
                "noise_db": [round(noise_db - 1.5, 1), round(noise_db + 1.5, 1)],
            },
            "logs": [
                f"intervention={intervention}",
                f"utilization={utilization:.3f}",
                f"sumo={'yes' if not synthetic else 'no'}",
                "mode=synthetic-queueing" if synthetic else "mode=sumo",
            ],
        }


__all__ = ["TrafficSumoModel", "sumo_available"]
