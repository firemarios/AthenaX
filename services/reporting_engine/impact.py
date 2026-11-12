"""Impact assessment across 6 dimensions (contract §5.6): matches TS ImpactReport."""
from __future__ import annotations

import logging
import uuid
from typing import Any

logger = logging.getLogger("policylab.reporting")

DIMENSIONS: list[dict] = [
    {"key": "environment", "label": {"el": "Περιβάλλον", "en": "Environment"}},
    {"key": "society", "label": {"el": "Κοινωνία", "en": "Society"}},
    {"key": "economy", "label": {"el": "Οικονομία", "en": "Economy"}},
    {"key": "mobility", "label": {"el": "Αστική κινητικότητα", "en": "Mobility"}},
    {"key": "quality_of_life", "label": {"el": "Ποιότητα ζωής", "en": "Quality of life"}},
    {"key": "administration", "label": {"el": "Δημόσια διοίκηση", "en": "Public administration"}},
]

# metric key → {dimension, label, unit}
_METRIC_SPECS: dict[str, dict] = {
    # environment
    "emissions_kg": {
        "dim": "environment",
        "label": {"el": "Εκπομπές αερίων", "en": "Emissions"},
        "unit": "kg",
    },
    "green_m2_per_capita": {
        "dim": "environment",
        "label": {"el": "Πράσινο ανά κάτοικο", "en": "Green space per capita"},
        "unit": "m²/κάτοικο",
    },
    "green_area_m2": {
        "dim": "environment",
        "label": {"el": "Συνολική πράσινη επιφάνεια", "en": "Total green area"},
        "unit": "m²",
    },
    "energy_kwh": {
        "dim": "environment",
        "label": {"el": "Κατανάλωση ενέργειας", "en": "Energy consumption"},
        "unit": "kWh",
    },
    # society
    "covered_population": {
        "dim": "society",
        "label": {"el": "Κάτοικοι που εξυπηρετούνται", "en": "Population served"},
        "unit": "κάτοικοι",
    },
    "population": {
        "dim": "society",
        "label": {"el": "Πληθυσμός", "en": "Population"},
        "unit": "κάτοικοι",
    },
    "facilities_count": {
        "dim": "society",
        "label": {"el": "Εγκαταστάσεις", "en": "Facilities"},
        "unit": "μονάδες",
    },
    "facility_count": {
        "dim": "society",
        "label": {"el": "Εγκαταστάσεις", "en": "Facilities"},
        "unit": "μονάδες",
    },
    "proposals_count": {
        "dim": "society",
        "label": {"el": "Προτάσεις πολιτών", "en": "Citizen proposals"},
        "unit": "προτάσεις",
    },
    "participation_rate": {
        "dim": "society",
        "label": {"el": "Ποσοστό συμμετοχής", "en": "Participation rate"},
        "unit": "%",
    },
    # economy
    "cost_eur": {
        "dim": "economy",
        "label": {"el": "Κόστος (αναμενόμενο)", "en": "Cost (expected)"},
        "unit": "€",
    },
    "cost_low_eur": {
        "dim": "economy",
        "label": {"el": "Κόστος (κάτω όριο)", "en": "Cost (low)"},
        "unit": "€",
    },
    "cost_high_eur": {
        "dim": "economy",
        "label": {"el": "Κόστος (πάνω όριο)", "en": "Cost (high)"},
        "unit": "€",
    },
    "housing_cost_index": {
        "dim": "economy",
        "label": {"el": "Ευρετήριο κόστους στέγης", "en": "Housing cost index"},
        "unit": "δείκτης",
    },
    "jobs_created": {
        "dim": "economy",
        "label": {"el": "Νέες θέσεις εργασίας", "en": "Jobs created"},
        "unit": "θέσεις",
    },
    "unemployment_rate": {
        "dim": "economy",
        "label": {"el": "Ανεργία", "en": "Unemployment"},
        "unit": "%",
    },
    # mobility
    "accessibility_pct": {
        "dim": "mobility",
        "label": {"el": "Προσβασιμότητα με τα πόδις", "en": "Walk accessibility"},
        "unit": "%",
    },
    "avg_travel_min": {
        "dim": "mobility",
        "label": {"el": "Μέσος χρόνος μετακίνησης", "en": "Average travel time"},
        "unit": "λεπτά",
    },
    "throughput_vph": {
        "dim": "mobility",
        "label": {"el": "Ροή οχημάτων", "en": "Vehicle throughput"},
        "unit": "οχ./ώρα",
    },
    "queue_length_m": {
        "dim": "mobility",
        "label": {"el": "Μήκος ουράς", "en": "Queue length"},
        "unit": "m",
    },
    # quality of life
    "pct_within_300m": {
        "dim": "quality_of_life",
        "label": {"el": "Πρόσβαση σε πράσινο (300 μ)", "en": "Green access (300 m)"},
        "unit": "%",
    },
    "services_within_15min": {
        "dim": "quality_of_life",
        "label": {"el": "Υπηρεσίες εντός 15′", "en": "Services within 15 min"},
        "unit": "μονάδες",
    },
    "noise_db": {
        "dim": "quality_of_life",
        "label": {"el": "Επίπεδο θορύβου", "en": "Noise level"},
        "unit": "dB",
    },
    # administration
    "admin_days": {
        "dim": "administration",
        "label": {"el": "Ημέρες διαδικασίας", "en": "Administrative days"},
        "unit": "ημέρες",
    },
    "processing_days": {
        "dim": "administration",
        "label": {"el": "Χρόνος επεξεργασίας", "en": "Processing time"},
        "unit": "ημέρες",
    },
    "digital_coverage_pct": {
        "dim": "administration",
        "label": {"el": "Ψηφιακή κάλυψη υπηρεσιών", "en": "Digital service coverage"},
        "unit": "%",
    },
}

_DIRECTION_WORDS = {
    "el": {"up": "αύξηση", "down": "μείωση", "neutral": "χωρίς αλλαγή"},
    "en": {"up": "increase", "down": "decrease", "neutral": "no change"},
}


def _number(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip())
        except ValueError:
            return None
    return None


def _delta_direction(delta: float | None) -> str:
    if delta is None:
        return "neutral"
    if delta > 1e-12:
        return "up"
    if delta < -1e-12:
        return "down"
    return "neutral"


def _summary(dimensions: list[dict], has_baseline: bool) -> dict:
    all_indicators = [ind for dim in dimensions for ind in dim["indicators"]]
    if not all_indicators:
        return {
            "el": "Δεν αναγνωρίστηκαν μετρήσεις για αναφορά επιδράσεων.",
            "en": "No measurable indicators recognised for the impact report.",
        }
    with_delta = [ind for ind in all_indicators if ind["delta"] is not None]
    if not with_delta:
        return {
            "el": "Δεν παρέχεται βάση σύγκρισης· παρατίθενται οι τρέχουσες τιμές.",
            "en": "No baseline provided; current values are listed as-is.",
        }
    top = max(with_delta, key=lambda ind: abs(ind["delta"] or 0.0))
    delta = float(top["delta"] or 0.0)
    direction = _DIRECTION_WORDS["el"][top["direction"]]
    direction_en = _DIRECTION_WORDS["en"][top["direction"]]
    unit = top["unit"]
    label_el = top["label"]["el"]
    label_en = top["label"]["en"]
    return {
        "el": (
            f"Μεγαλύτερη μεταβολή: {label_el} {delta:+.2f} {unit} ({direction}). "
            f"Σύνολο δεικτών: {len(all_indicators)}."
        ),
        "en": (
            f"Largest change: {label_en} {delta:+.2f} {unit} ({direction_en}). "
            f"Total indicators: {len(all_indicators)}."
        ),
    }


def compute_impact(metrics: dict, *, baseline: dict | None = None) -> dict:
    """ImpactReport {run_id, dimensions[6], summary{el,en}} — unknown metrics are ignored."""
    metrics = metrics if isinstance(metrics, dict) else {}
    baseline = baseline if isinstance(baseline, dict) else None
    has_baseline = baseline is not None

    dimensions: list[dict] = []
    for dimension in DIMENSIONS:
        indicators: list[dict] = []
        for key, spec in _METRIC_SPECS.items():
            if spec["dim"] != dimension["key"] or key not in metrics:
                continue
            value = _number(metrics.get(key))
            if value is None:
                continue
            base_value = _number(baseline.get(key)) if baseline else None
            delta = (value - base_value) if base_value is not None else None
            indicators.append(
                {
                    "name": key,
                    "label": dict(spec["label"]),
                    "baseline": base_value,
                    "value": value,
                    "delta": delta,
                    "unit": spec["unit"],
                    "direction": _delta_direction(delta),
                    "confidence": 0.7 if base_value is not None else None,
                }
            )
        dimensions.append(
            {"key": dimension["key"], "label": dict(dimension["label"]), "indicators": indicators}
        )

    run_id = str(metrics.get("run_id") or metrics.get("id") or uuid.uuid4().hex)
    return {
        "run_id": run_id,
        "dimensions": dimensions,
        "summary": _summary(dimensions, has_baseline),
    }
