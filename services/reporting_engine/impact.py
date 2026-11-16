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
        "label": {"el": "Προσβασιμότητα με τα πόδια", "en": "Walk accessibility"},
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
    with_delta = [
        ind
        for ind in all_indicators
        if ind["delta"] is not None and abs(float(ind["delta"] or 0.0)) > 1e-9
    ]
    if not with_delta:
        return {
            "el": "Δεν υπάρχει ουσιαστική μεταβολή έναντι της βάσης· παρατίθενται οι τρέχουσες τιμές.",
            "en": "No material change against the baseline; current values are listed as-is.",
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


_ECONOMICS_SPECS: list[tuple[str, dict, str]] = [
    (
        "capex_eur",
        {"el": "Κόστος επένδυσης", "en": "Capital cost"},
        "€",
    ),
    (
        "capex_low_eur",
        {"el": "Κόστος επένδυσης (κάτω όριο)", "en": "Capital cost (low)"},
        "€",
    ),
    (
        "capex_high_eur",
        {"el": "Κόστος επένδυσης (πάνω όριο)", "en": "Capital cost (high)"},
        "€",
    ),
    (
        "annual_maintenance_eur",
        {"el": "Ετήσια συντήρηση", "en": "Annual maintenance"},
        "€",
    ),
    (
        "annual_benefit_eur",
        {"el": "Ετήσιο όφελος", "en": "Annual benefit"},
        "€",
    ),
    (
        "annual_tax_revenue_eur",
        {"el": "Ετήσια φορολογικά έσοδα", "en": "Annual tax revenue"},
        "€",
    ),
    (
        "net_annual_eur",
        {"el": "Καθαρό ετήσιο όφελος", "en": "Net annual benefit"},
        "€",
    ),
    (
        "benefit_cost_ratio",
        {"el": "Δείκτης οφέλους/κόστους", "en": "Benefit-cost ratio"},
        "×",
    ),
    (
        "payback_years",
        {"el": "Απόσβεση", "en": "Payback"},
        "έτη",
    ),
]

_ECONOMICS_DUPLICATES = {
    "capex_eur": ("cost_eur",),
    "capex_low_eur": ("cost_low_eur",),
    "capex_high_eur": ("cost_high_eur",),
}

_AI_DIMENSION_ALIASES = {
    "environment": "environment",
    "society": "society",
    "social": "society",
    "economy": "economy",
    "economics": "economy",
    "mobility": "mobility",
    "transport": "mobility",
    "quality_of_life": "quality_of_life",
    "quality": "quality_of_life",
    "quality-of-life": "quality_of_life",
    "administration": "administration",
    "governance": "administration",
}


def _clamp_confidence(value: Any, default: float) -> float:
    number = _number(value)
    if number is None:
        return default
    return max(0.0, min(1.0, number))


def _economics_indicators(economics: dict | None) -> list[dict]:
    if not isinstance(economics, dict):
        return []
    confidence = _clamp_confidence(economics.get("confidence"), 0.7)
    indicators: list[dict] = []
    for key, label, unit in _ECONOMICS_SPECS:
        value = _number(economics.get(key))
        if value is None or value == 0:
            continue
        indicators.append(
            {
                "name": key,
                "label": dict(label),
                "baseline": None,
                "value": value,
                "delta": None,
                "unit": unit,
                "direction": "neutral",
                "confidence": confidence,
                "source": "economics",
            }
        )
    return indicators


def _merge_ai_impact(dimensions: list[dict], ai_impact: Any) -> None:
    if not isinstance(ai_impact, list):
        return
    by_key = {dimension["key"]: dimension for dimension in dimensions}
    for raw in ai_impact:
        if not isinstance(raw, dict):
            continue
        dimension_key = str(raw.get("dimension") or "").strip().lower().replace(" ", "_")
        dimension_key = _AI_DIMENSION_ALIASES.get(dimension_key, "")
        dimension = by_key.get(dimension_key)
        if dimension is None:
            continue
        name = str(raw.get("name") or "").strip()
        if not name:
            continue
        if any(str(item.get("name")) == name for item in dimension["indicators"]):
            continue
        value = _number(raw.get("value"))
        if value is None:
            continue
        label = raw.get("label")
        if not isinstance(label, dict):
            label = {"el": name, "en": name}
        base_value = _number(raw.get("baseline"))
        delta = (value - base_value) if base_value is not None else None
        indicator: dict = {
            "name": name,
            "label": {
                "el": str(label.get("el") or label.get("en") or name),
                "en": str(label.get("en") or label.get("el") or name),
            },
            "baseline": base_value,
            "value": value,
            "delta": delta,
            "unit": str(raw.get("unit") or ""),
            "direction": _delta_direction(delta),
            "confidence": _clamp_confidence(raw.get("confidence"), 0.55),
            "source": "ai",
        }
        note = raw.get("note")
        if isinstance(note, dict) and (note.get("el") or note.get("en")):
            indicator["note"] = {
                "el": str(note.get("el") or note.get("en") or ""),
                "en": str(note.get("en") or note.get("el") or ""),
            }
        dimension["indicators"].append(indicator)


def compute_impact(
    metrics: dict,
    *,
    baseline: dict | None = None,
    economics: dict | None = None,
    ai_impact: list | None = None,
    reach: dict | None = None,
) -> dict:
    """ImpactReport {run_id, dimensions[6], summary{el,en}, reach}.

    Unknown metrics are ignored. Economics indicators and clearly-labelled AI
    estimates are merged into the six dimensions.
    """
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
                    "confidence": 0.7,
                    "source": "simulation",
                }
            )
        if dimension["key"] == "economy":
            existing_names = {str(item.get("name")) for item in indicators}
            for indicator in _economics_indicators(economics):
                duplicates = _ECONOMICS_DUPLICATES.get(indicator["name"], ())
                if indicator["name"] in existing_names or any(
                    name in existing_names for name in duplicates
                ):
                    continue
                indicators.append(indicator)
        dimensions.append(
            {"key": dimension["key"], "label": dict(dimension["label"]), "indicators": indicators}
        )

    _merge_ai_impact(dimensions, ai_impact)

    run_id = str(metrics.get("run_id") or metrics.get("id") or uuid.uuid4().hex)
    return {
        "run_id": run_id,
        "dimensions": dimensions,
        "summary": _summary(dimensions, has_baseline),
        "reach": _reach_block(reach),
    }


def _reach_block(reach: dict | None) -> dict:
    """Normalised reach block: population x area x facilities covered by the run."""
    source = reach if isinstance(reach, dict) else {}
    population = _number(source.get("population"))
    area_km2 = _number(source.get("area_km2"))
    facilities = _number(source.get("facilities"))
    return {
        "population": int(population) if population is not None else None,
        "area_km2": round(area_km2, 3) if area_km2 is not None else None,
        "facilities": int(facilities) if facilities is not None else None,
    }
