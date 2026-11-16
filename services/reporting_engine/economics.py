"""Cost-benefit estimates for policy simulations.

The numbers are planning estimates: they turn model outputs into a capex,
annual benefit, payback and value-for-money verdict. They are deterministic
and do not call an LLM.
"""
from __future__ import annotations

from typing import Any

ANNUAL_DAYS = 250
ANNUALIZATION_YEARS = 10
DEFAULT_POPULATION = 10_000
DEFAULT_BENEFIT_RATE = {
    "greenspace": 0.12,
    "accessibility": 0.15,
    "traffic_sumo": 0.14,
    "cost": 0.10,
}

# Planning benchmarks exposed to the AI planner so estimates are grounded in the
# same numbers the deterministic engine uses instead of being guessed.
BENCHMARKS: dict[str, Any] = {
    "green_capex_eur_per_m2": 95.0,
    "facility_capex_eur": 45_000.0,
    "traffic_capex_eur": {
        "open": 0.0,
        "congestion_charge": 550_000.0,
        "pedestrianize": 350_000.0,
        "closed": 500_000.0,
    },
    "annual_green_benefit_eur_per_m2": 12.0,
    "annual_green_benefit_eur_per_resident_covered": 18.0,
    "annual_access_benefit_eur_per_person": 30.0,
    "travel_time_value_eur_per_passenger_min": 0.12,
    "co2_value_eur_per_kg": 0.09,
    "noise_value_eur_per_db_per_resident": 2.5,
    "annualization_years": ANNUALIZATION_YEARS,
    "annual_maintenance_pct": {"greenspace": 0.04, "default": 0.025},
    "default_annual_benefit_rate_of_capex": DEFAULT_BENEFIT_RATE,
    "default_population": DEFAULT_POPULATION,
    "property_tax_eur_per_new_building": 1_600.0,
    "working_days_per_year": ANNUAL_DAYS,
}

_LABELS = {
    "estimated_benefit": {"el": "Εκτιμώμενο ετήσιο όφελος", "en": "Estimated annual benefit"},
    "green_area": {"el": "Δημιουργία / αναβάθμιση πρασίνου", "en": "Green space creation / upgrade"},
    "facilities": {"el": "Κατασκευή κοινωνικών υποδομών", "en": "Community facility construction"},
    "traffic": {"el": "Ρύθμιση κυκλοφορίας / ανάπλαση", "en": "Traffic intervention / street redesign"},
    "congestion_charge": {"el": "Σύστημα χρέωσης κυκλοφορίας", "en": "Congestion charging system"},
    "cost_model": {"el": "Εκτίμηση κόστους έργου", "en": "Works cost estimate"},
    "green_benefit": {"el": "Όφελος από πράσινο", "en": "Green-space benefit"},
    "access_benefit": {"el": "Όφελος προσβασιμότητας", "en": "Accessibility benefit"},
    "travel_benefit": {"el": "Όφελος χρόνου μετακίνησης", "en": "Travel-time benefit"},
    "emissions_benefit": {"el": "Όφελος μείωσης εκπομπών", "en": "Emissions benefit"},
    "noise_benefit": {"el": "Όφελος μείωσης θορύβου", "en": "Noise benefit"},
    "tax_benefit": {"el": "Φορολογικά έσοδα νέων κτιρίων", "en": "Property tax from new buildings"},
}


def _num(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        text = value.strip()
        try:
            return float(text)
        except ValueError:
            if "," in text and "." in text:
                text = text.replace(",", "")
            else:
                text = text.replace(",", ".")
            try:
                return float(text)
            except ValueError:
                return None
    return None


def _line(label: dict[str, str], amount: float, *, quantity: float | None = None, unit: str | None = None) -> dict:
    item: dict[str, Any] = {"label": label, "amount_eur": round(amount, 2)}
    if quantity is not None:
        item["quantity"] = round(quantity, 2)
    if unit:
        item["unit"] = unit
    return item


def _metric_delta(metrics: dict, baseline: dict | None, key: str) -> float | None:
    if not baseline:
        return None
    value = _num(metrics.get(key))
    base = _num(baseline.get(key))
    if value is None or base is None:
        return None
    return value - base


def _cost_estimate(
    model_name: str, parameters: dict, metrics: dict, baseline: dict | None
) -> tuple[float, float, float, list[dict]]:
    if model_name == "cost":
        expected = _num(metrics.get("cost_eur"))
        if expected is not None:
            low = _num(metrics.get("cost_low_eur")) or expected * 0.85
            high = _num(metrics.get("cost_high_eur")) or expected * 1.15
            return low, expected, high, [_line(_LABELS["cost_model"], expected)]

    if model_name == "greenspace":
        delta_area = _metric_delta(metrics, baseline, "green_area_m2")
        area = delta_area if delta_area is not None and delta_area > 0 else None
        if area is None and delta_area is None:
            area = _num(metrics.get("green_area_m2"))
        if area is None:
            park_count = _num(parameters.get("park_count")) or 0.0
            avg_park = _num(parameters.get("avg_park_m2")) or 0.0
            area = park_count * avg_park
        area = max(0.0, area)
        unit_cost = 95.0
        expected = area * unit_cost
        return (
            expected * 0.8,
            expected,
            expected * 1.2,
            [_line(_LABELS["green_area"], expected, quantity=area, unit="m²")],
        )

    if model_name == "accessibility":
        delta_count = _metric_delta(metrics, baseline, "facilities_count")
        count = delta_count if delta_count is not None and delta_count > 0 else None
        if count is None and delta_count is None:
            count = _num(metrics.get("facilities_count"))
        if count is None:
            count = _num(parameters.get("facility_count")) or 0.0
        count = max(0.0, count)
        unit_cost = 45_000.0
        expected = count * unit_cost
        return (
            expected * 0.8,
            expected,
            expected * 1.2,
            [_line(_LABELS["facilities"], expected, quantity=count, unit="facilities")],
        )

    if model_name == "traffic_sumo":
        intervention = str(parameters.get("intervention") or "open").lower()
        table = {
            "open": (0.0, 0.0, 0.0),
            "congestion_charge": (450_000.0, 550_000.0, 700_000.0),
            "pedestrianize": (280_000.0, 350_000.0, 450_000.0),
            "closed": (400_000.0, 500_000.0, 650_000.0),
        }
        low, expected, high = table.get(intervention, table["open"])
        label = (
            _LABELS["congestion_charge"]
            if intervention == "congestion_charge"
            else _LABELS["traffic"]
        )
        lines = [_line(label, expected)] if expected > 0 else []
        return low, expected, high, lines

    return 0.0, 0.0, 0.0, []


def _benefit_estimate(
    model_name: str,
    parameters: dict,
    metrics: dict,
    baseline: dict | None,
) -> list[dict]:
    if not baseline:
        return []

    population = _num(parameters.get("population")) or DEFAULT_POPULATION
    lines: list[dict] = []

    def delta(key: str) -> float | None:
        value = _num(metrics.get(key))
        base = _num(baseline.get(key))
        if value is None or base is None:
            return None
        return value - base

    if model_name == "greenspace":
        area_delta = delta("green_area_m2")
        if area_delta is not None:
            if area_delta != 0:
                lines.append(
                    _line(
                        _LABELS["green_benefit"],
                        area_delta * 12.0,
                        quantity=area_delta,
                        unit="m²",
                    )
                )
        else:
            per_capita_delta = delta("green_m2_per_capita")
            if per_capita_delta is not None and per_capita_delta != 0:
                lines.append(
                    _line(
                        _LABELS["green_benefit"],
                        per_capita_delta * population * 12.0,
                        quantity=per_capita_delta * population,
                        unit="m²",
                    )
                )
        pct_delta = delta("pct_within_300m")
        if pct_delta is not None and pct_delta != 0:
            covered = pct_delta / 100.0 * population
            lines.append(
                _line(
                    _LABELS["green_benefit"],
                    covered * 18.0,
                    quantity=covered,
                    unit="people",
                )
            )

    if model_name == "accessibility":
        covered_delta = delta("covered_population")
        if covered_delta is not None:
            if covered_delta != 0:
                lines.append(
                    _line(
                        _LABELS["access_benefit"],
                        covered_delta * 30.0,
                        quantity=covered_delta,
                        unit="people",
                    )
                )
        else:
            pct_delta = delta("accessibility_pct")
            if pct_delta is not None and pct_delta != 0:
                covered = pct_delta / 100.0 * population
                lines.append(
                    _line(
                        _LABELS["access_benefit"],
                        covered * 30.0,
                        quantity=covered,
                        unit="people",
                    )
                )

    if model_name == "traffic_sumo":
        travel_delta = delta("avg_travel_min")
        if travel_delta is not None and travel_delta != 0:
            saved_min = -travel_delta
            demand = _num(parameters.get("demand")) or 1_200.0
            capacity = _num(parameters.get("capacity")) or 0.0
            intervention = str(parameters.get("intervention") or "").lower()
            daily_demand = intervention == "congestion_charge" and demand > capacity
            trips = demand * (ANNUAL_DAYS if daily_demand else 8.0 * ANNUAL_DAYS)
            lines.append(
                _line(
                    _LABELS["travel_benefit"],
                    saved_min * trips * 0.12,
                    quantity=saved_min * trips,
                    unit="passenger-min",
                )
            )
        emissions_delta = delta("emissions_kg")
        if emissions_delta is not None and emissions_delta != 0:
            saved_kg = -emissions_delta
            lines.append(
                _line(
                    _LABELS["emissions_benefit"],
                    saved_kg * 0.09,
                    quantity=saved_kg,
                    unit="kg",
                )
            )
        noise_delta = delta("noise_db")
        if noise_delta is not None and noise_delta != 0:
            lines.append(
                _line(
                    _LABELS["noise_benefit"],
                    -noise_delta * population * 2.5,
                    quantity=-noise_delta,
                    unit="dB",
                )
            )

    return lines


def _verdict(bcr: float | None, within_budget: bool | None, has_benefit: bool) -> str:
    if not has_benefit or bcr is None:
        return "unknown"
    if bcr >= 1.2 and within_budget is not False:
        return "yes"
    if bcr >= 0.8:
        return "marginal"
    return "no"


def _summary(
    bcr: float | None,
    payback: float | None,
    verdict: str,
    *,
    has_baseline: bool = True,
) -> dict[str, str]:
    verdict_el = {"yes": "αξίζει", "marginal": "οριακά", "no": "δεν αξίζει", "unknown": "δεν επαρκούν τα δεδομένα"}[verdict]
    verdict_en = {"yes": "worth it", "marginal": "marginal", "no": "not worth it", "unknown": "insufficient data"}[verdict]
    if bcr is None:
        if has_baseline:
            return {
                "el": "Υπάρχει σύγκριση με βασικό σενάριο, αλλά δεν υπάρχει εκτίμηση κόστους για αυτή την παρέμβαση, οπότε δεν υπολογίζεται σχέση οφέλους/κόστους.",
                "en": "A baseline comparison exists, but there is no cost estimate for this intervention, so a benefit-cost ratio cannot be calculated.",
            }
        return {
            "el": "Το μοντέλο δεν παράγει σύγκριση με βασικό σενάριο, οπότε δεν υπολογίζεται σχέση οφέλους/κόστους.",
            "en": "The model has no baseline comparison, so a benefit-cost ratio cannot be calculated.",
        }
    payback_el = f" Αποπληρωμή σε {payback:.1f} έτη." if payback else ""
    payback_en = f" Payback in {payback:.1f} years." if payback else ""
    if bcr < 0:
        payback_el += " Το σενάριο υπολείπεται του βασικού σεναρίου."
        payback_en += " The scenario falls short of the baseline."
    return {
        "el": f"Σχέση οφέλους/κόστους {bcr:.2f}× — {verdict_el}.{payback_el}",
        "en": f"Benefit-cost ratio {bcr:.2f}× — {verdict_en}.{payback_en}",
    }


def compute_economics(
    model_name: str,
    parameters: dict | None,
    metrics: dict | None,
    baseline: dict | None,
    *,
    budget_eur: float | None = None,
    annual_tax_revenue_eur: float | None = None,
    new_buildings: float | None = None,
    annual_benefit_eur: float | None = None,
) -> dict[str, Any]:
    parameters = parameters if isinstance(parameters, dict) else {}
    metrics = metrics if isinstance(metrics, dict) else {}
    baseline = baseline if isinstance(baseline, dict) else None

    low, expected, high, cost_lines = _cost_estimate(model_name, parameters, metrics, baseline)
    benefit_lines = _benefit_estimate(model_name, parameters, metrics, baseline)
    benefit_source = "model" if benefit_lines else "none"
    tax_revenue = _num(annual_tax_revenue_eur)
    if tax_revenue is not None and tax_revenue > 0:
        building_count = _num(new_buildings)
        benefit_lines.append(
            _line(
                _LABELS["tax_benefit"],
                tax_revenue,
                quantity=building_count,
                unit="buildings" if building_count is not None else None,
            )
        )
        benefit_source = "model"
    if not benefit_lines:
        ai_benefit = _num(annual_benefit_eur)
        if ai_benefit is not None and ai_benefit > 0:
            benefit_lines.append(_line(_LABELS["estimated_benefit"], ai_benefit))
            benefit_source = "ai"
        else:
            rate = DEFAULT_BENEFIT_RATE.get(model_name, 0.10)
            estimated = expected * rate
            if estimated > 0:
                benefit_lines.append(_line(_LABELS["estimated_benefit"], estimated))
                benefit_source = "heuristic"
    annual_benefit = sum(float(item["amount_eur"]) for item in benefit_lines)
    maintenance_pct = 0.04 if model_name == "greenspace" else 0.025
    annual_maintenance = expected * maintenance_pct
    annualized_cost = expected / ANNUALIZATION_YEARS + annual_maintenance
    bcr = (annual_benefit / annualized_cost) if annualized_cost > 0 else None
    payback = (expected / annual_benefit) if annual_benefit > 0 else None
    budget = _num(budget_eur)
    within_budget = (expected <= budget) if budget is not None and budget > 0 else None
    verdict = _verdict(bcr, within_budget, bool(benefit_lines))
    confidence = 0.75 if baseline else 0.35
    assumptions = [
        {
            "el": "Οι τιμές είναι προγραμματικές εκτιμήσεις για σύγκριση σεναρίων, όχι δεσμευτικός προϋπολογισμός.",
            "en": "Values are planning estimates for scenario comparison, not a committed budget.",
        },
        {
            "el": "Το κόστος κεφαλαίου αποσβένεται σε 10 έτη· το ετήσιο όφελος προκύπτει από τη διαφορά σεναρίου–βασικού σεναρίου.",
            "en": "Capex is annualised over 10 years; annual benefit comes from the scenario-minus-baseline delta.",
        },
    ]
    if benefit_source == "ai":
        assumptions.append(
            {
                "el": "Το ετήσιο όφελος είναι εκτίμηση του AI και όχι μετρημένη μεταβολή του μοντέλου.",
                "en": "Annual benefit is an AI estimate, not a measured model delta.",
            }
        )
    elif benefit_source == "heuristic":
        assumptions.append(
            {
                "el": "Το ετήσιο όφελος εκτιμάται ως ποσοστό του κεφαλαίου, επειδή το μοντέλο δεν παράγει μετρήσιμο όφελος.",
                "en": "Annual benefit is estimated as a share of capex because the model produces no measured benefit.",
            }
        )

    return {
        "currency": "EUR",
        "capex_eur": round(expected, 2),
        "capex_low_eur": round(low, 2),
        "capex_high_eur": round(high, 2),
        "annual_maintenance_eur": round(annual_maintenance, 2),
        "annualized_cost_eur": round(annualized_cost, 2),
        "annual_benefit_eur": round(annual_benefit, 2),
        "benefit_source": benefit_source,
        "annual_tax_revenue_eur": round(tax_revenue, 2) if tax_revenue is not None else 0.0,
        "new_buildings": round(_num(new_buildings), 2) if _num(new_buildings) is not None else None,
        "net_annual_eur": round(annual_benefit - annualized_cost, 2),
        "benefit_cost_ratio": round(bcr, 3) if bcr is not None else None,
        "payback_years": round(payback, 2) if payback is not None else None,
        "budget_eur": round(budget, 2) if budget is not None else None,
        "within_budget": within_budget,
        "verdict": verdict,
        "confidence": confidence,
        "cost_breakdown": cost_lines,
        "benefit_breakdown": benefit_lines,
        "summary": _summary(bcr, payback, verdict, has_baseline=baseline is not None),
        "assumptions": assumptions,
    }
