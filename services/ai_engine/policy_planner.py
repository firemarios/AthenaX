"""AI policy planner: turns a policy topic/free text/factors into simulation inputs.

This is the only place where a policy simulation uses an LLM. The planner is
defensive: bad JSON, invalid models or provider failures fall back to a
deterministic plan so a simulation never fails because of AI.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from services.ai_engine.providers import get_provider
from services.simulation_engine.registry import MODELS, get_model

logger = logging.getLogger("policylab.ai.policy_planner")

BASE_TAX_EUR_PER_BUILDING = 1_600.0
MAX_NEW_BUILDINGS = 20_000
PLANNER_TIMEOUT_SECONDS = 150.0

PLANNER_SYSTEM_PROMPT = """You are POLICYLAB's policy simulation planner for the City of Athens.
You receive a policy topic, a free-text description of the changes, the user's
changing factors (for example new_buildings or tax_change_pct), a location and a
budget. Convert them into one simulation model and its parameters, estimate the
annual property-tax effect of new buildings, and write a concise bilingual
report. Use realistic, internally consistent planning assumptions.

Return ONLY a JSON object with this shape:
{
  "model": "greenspace | accessibility | traffic_sumo | cost",
  "parameters": {"parameter_name": 123},
  "factors": [
    {"name": "new_buildings", "label": {"el": "...", "en": "..."},
     "value": 25, "unit": "buildings",
     "reason": {"el": "...", "en": "..."}}
  ],
  "tax": {
    "new_buildings": 25,
    "tax_change_pct": 0,
    "annual_tax_revenue_eur": 40000,
    "rationale": {"el": "...", "en": "..."}
  },
  "report": {
    "summary": {"el": "...", "en": "..."},
    "findings": [{"el": "...", "en": "..."}],
    "risks": [{"el": "...", "en": "..."}]
  },
  "confidence": 0.72,
  "assumptions": [{"el": "...", "en": "..."}]
}

Rules:
- Pick exactly one model from the supplied catalog and use only its parameter names.
- Use the supplied default property tax proxy: 1600 EUR per new building per year,
  adjusted by tax_change_pct. If the user supplies a total tax change, apply it.
- Numeric parameters must respect the catalog min/max. Do not invent locations.
- Write report text in Greek (el) and English (en), concise but specific.
- Keep findings and risks to at most 3 each, and assumptions to at most 3.
- Do not include markdown fences or prose outside the JSON object.
- Return a complete, valid JSON object; never stop mid-string.
"""


def _localized(value: Any, fallback: str = "") -> dict[str, str]:
    if isinstance(value, dict):
        el = value.get("el")
        en = value.get("en")
        if isinstance(el, str) and el.strip():
            return {"el": el.strip(), "en": str(en or el).strip()}
        if isinstance(en, str) and en.strip():
            return {"el": en.strip(), "en": en.strip()}
    if isinstance(value, str) and value.strip():
        return {"el": value.strip(), "en": value.strip()}
    return {"el": fallback, "en": fallback}


def _localized_list(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    items: list[dict[str, str]] = []
    for item in value:
        localized = _localized(item)
        if localized["en"]:
            items.append(localized)
    return items[:6]


def _num(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip().replace(",", "."))
        except ValueError:
            return None
    return None


def _factor_value(factors: Any, name: str) -> float | None:
    if not isinstance(factors, list):
        return None
    wanted = name.strip().lower()
    for factor in factors:
        if not isinstance(factor, dict):
            continue
        if str(factor.get("name") or "").strip().lower() != wanted:
            continue
        return _num(factor.get("value", factor.get("baseline")))
    return None


def _model_catalog() -> list[dict[str, Any]]:
    catalog: list[dict[str, Any]] = []
    for name in MODELS:
        spec = get_model(name)
        parameters = []
        for param in spec.parameters:
            parameters.append(
                {
                    "name": param.get("name"),
                    "type": param.get("type"),
                    "default": param.get("default"),
                    "min": param.get("min"),
                    "max": param.get("max"),
                    "choices": param.get("choices"),
                }
            )
        catalog.append(
            {
                "name": name,
                "category": spec.category,
                "description": spec.description,
                "parameters": parameters,
            }
        )
    return catalog


def _fallback_model(category: str | None, topic: str, factors: Any) -> str:
    text = f"{category or ''} {topic or ''}".lower()
    if any(word in text for word in ("πράσιν", "παρκ", "green", "park", "δένδρ", "tree")):
        return "greenspace"
    if any(word in text for word in ("κυκλοφορ", "δρόμ", "traffic", "road", "πεζ", "pedestrian")):
        return "traffic_sumo"
    if any(word in text for word in ("κόστος", "budget", "προϋπολογ", "cost")):
        return "cost"
    if _factor_value(factors, "new_buildings") is not None:
        return "accessibility"
    return "accessibility"


def _normalise_parameters(
    model_name: str,
    raw_parameters: Any,
    fallback_parameters: dict[str, Any],
    area: str | None,
) -> dict[str, Any]:
    spec = get_model(model_name)
    supplied = raw_parameters if isinstance(raw_parameters, dict) else {}
    parameters: dict[str, Any] = {}
    for param in spec.parameters:
        name = str(param.get("name") or "")
        if not name:
            continue
        if name == "area_id":
            parameters[name] = area or supplied.get(name) or fallback_parameters.get(name) or param.get("default")
            continue
        raw = supplied.get(name, fallback_parameters.get(name, param.get("default")))
        choices = param.get("choices")
        if isinstance(choices, list) and choices:
            match = next((choice for choice in choices if str(choice) == str(raw)), None)
            parameters[name] = match if match is not None else param.get("default")
            continue
        if param.get("type") in ("number", "int", "float", "range"):
            value = _num(raw)
            if value is None:
                value = _num(param.get("default"))
            if value is None:
                continue
            low = _num(param.get("min"))
            high = _num(param.get("max"))
            if low is not None:
                value = max(low, value)
            if high is not None:
                value = min(high, value)
            parameters[name] = int(value) if param.get("type") == "int" else value
        elif raw is not None:
            parameters[name] = raw
    return parameters


def _normalise_factors(raw_factors: Any, source_factors: Any, tax: dict[str, Any]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    if isinstance(raw_factors, list):
        for factor in raw_factors:
            if not isinstance(factor, dict):
                continue
            name = str(factor.get("name") or "").strip()
            if not name:
                continue
            result.append(
                {
                    "name": name,
                    "label": _localized(factor.get("label"), name),
                    "value": factor.get("value"),
                    "unit": factor.get("unit"),
                    "reason": _localized(factor.get("reason")),
                }
            )
    if not result and isinstance(source_factors, list):
        for factor in source_factors:
            if not isinstance(factor, dict):
                continue
            name = str(factor.get("name") or "").strip()
            if not name:
                continue
            result.append(
                {
                    "name": name,
                    "label": _localized(factor.get("label"), name),
                    "value": factor.get("baseline", factor.get("value")),
                    "unit": factor.get("unit"),
                    "reason": {"el": "Δόθηκε από τον χρήστη.", "en": "Provided by the user."},
                }
            )
    for name, value in (
        ("new_buildings", tax.get("new_buildings")),
        ("tax_change_pct", tax.get("tax_change_pct")),
    ):
        if value is None:
            continue
        if any(str(item.get("name")).strip().lower() == name for item in result):
            continue
        result.append(
            {
                "name": name,
                "label": {
                    "el": "Νέα κτίρια" if name == "new_buildings" else "Μεταβολή φόρου",
                    "en": "New buildings" if name == "new_buildings" else "Tax change",
                },
                "value": value,
                "unit": "buildings" if name == "new_buildings" else "%",
                "reason": {
                    "el": "Υπολογίστηκε από το AI.",
                    "en": "Calculated by the AI.",
                },
            }
        )
    return result[:10]


def _normalise_tax(raw_tax: Any, source_factors: Any) -> dict[str, Any]:
    tax = raw_tax if isinstance(raw_tax, dict) else {}
    new_buildings = _num(tax.get("new_buildings"))
    if new_buildings is None:
        new_buildings = _factor_value(source_factors, "new_buildings")
    tax_change_pct = _num(tax.get("tax_change_pct"))
    if tax_change_pct is None:
        tax_change_pct = _factor_value(source_factors, "tax_change_pct")
    if tax_change_pct is None:
        tax_change_pct = 0.0
    if new_buildings is not None:
        new_buildings = max(0.0, min(MAX_NEW_BUILDINGS, new_buildings))
    annual_tax = _num(tax.get("annual_tax_revenue_eur"))
    if annual_tax is None and new_buildings is not None:
        annual_tax = new_buildings * BASE_TAX_EUR_PER_BUILDING * (1 + tax_change_pct / 100.0)
    if annual_tax is not None:
        annual_tax = max(0.0, min(annual_tax, 1_000_000_000.0))
    return {
        "new_buildings": round(new_buildings, 2) if new_buildings is not None else None,
        "tax_change_pct": round(tax_change_pct, 2),
        "annual_tax_revenue_eur": round(annual_tax, 2) if annual_tax is not None else None,
        "rationale": _localized(tax.get("rationale")),
    }


def _normalise_report(raw_report: Any, model_name: str) -> dict[str, Any]:
    report = raw_report if isinstance(raw_report, dict) else {}
    summary = _localized(report.get("summary"))
    if not summary["en"]:
        summary = {
            "el": f"Το AI επέλεξε το μοντέλο {model_name} και υπολόγισε τις παραμέτρους από την πολιτική.",
            "en": f"The AI selected the {model_name} model and calculated parameters from the policy.",
        }
    return {
        "summary": summary,
        "findings": _localized_list(report.get("findings")),
        "risks": _localized_list(report.get("risks")),
    }


def _fallback_plan(
    *,
    category: str | None,
    topic: str,
    area: str | None,
    factors: Any,
    parameters: dict[str, Any],
    limitation: str,
) -> dict[str, Any]:
    model_name = _fallback_model(category, topic, factors)
    normalised_parameters = _normalise_parameters(model_name, {}, parameters, area)
    tax = _normalise_tax({}, factors)
    return {
        "ai_used": False,
        "model": model_name,
        "parameters": normalised_parameters,
        "factors": _normalise_factors([], factors, tax),
        "tax": tax,
        "report": {
            "summary": {
                "el": "Το AI δεν ήταν διαθέσιμο· χρησιμοποιήθηκε ντετερμινιστική εκτίμηση.",
                "en": "The AI was unavailable; a deterministic estimate was used.",
            },
            "findings": [],
            "risks": [],
        },
        "confidence": 0.35,
        "assumptions": [
            {
                "el": "Οι τιμές προέρχονται από τους παράγοντες και τις προεπιλογές του μοντέλου.",
                "en": "Values come from the policy factors and model defaults.",
            }
        ],
        "limitations": [limitation],
    }


async def plan_policy_simulation(
    *,
    title: str,
    description: str | None = None,
    changes: str | None = None,
    category: str | None = None,
    area: str | None = None,
    horizon: str | None = None,
    factors: Any = None,
    parameters: dict[str, Any] | None = None,
    budget_eur: float | None = None,
    model: str | None = None,
    provider: Any = None,
) -> dict[str, Any]:
    """Return an AI plan, never raising. The result is safe to persist as JSON."""
    topic = " · ".join(part for part in (title, description, changes) if part)
    fallback_parameters = dict(parameters or {})
    fallback_model = model if model in MODELS else _fallback_model(category, topic, factors)
    try:
        active_provider = provider
        if active_provider is None:
            from app.config import get_settings

            active_provider = get_provider(get_settings())
        prompt = {
            "policy": {
                "title": title,
                "description": description,
                "changes": changes,
                "category": category,
                "area": area,
                "horizon": horizon,
                "budget_eur": budget_eur,
                "changing_factors": factors,
                "requested_model": model or None,
            },
            "models": _model_catalog(),
            "tax_proxy": {
                "base_eur_per_building_per_year": BASE_TAX_EUR_PER_BUILDING,
                "explanation": "annual property tax revenue proxy for new buildings",
            },
        }
        messages = [
            {"role": "system", "content": PLANNER_SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
        ]
        content = await asyncio.wait_for(
            active_provider.chat(messages, temperature=0.1, max_tokens=8192),
            timeout=PLANNER_TIMEOUT_SECONDS,
        )
        payload = _parse_json_answer(content)
        if not isinstance(payload, dict):
            raise ValueError("invalid JSON from policy planner")

        model_name = str(payload.get("model") or "").strip()
        if model_name not in MODELS:
            model_name = fallback_model
        normalised_parameters = _normalise_parameters(
            model_name, payload.get("parameters"), fallback_parameters, area
        )
        tax = _normalise_tax(payload.get("tax"), factors)
        confidence = _num(payload.get("confidence"))
        confidence = max(0.0, min(1.0, confidence if confidence is not None else 0.6))
        return {
            "ai_used": True,
            "model": model_name,
            "parameters": normalised_parameters,
            "factors": _normalise_factors(payload.get("factors"), factors, tax),
            "tax": tax,
            "report": _normalise_report(payload.get("report"), model_name),
            "confidence": round(confidence, 2),
            "assumptions": _localized_list(payload.get("assumptions"))[:6],
            "limitations": ["ai-estimated values"],
        }
    except Exception as exc:  # noqa: BLE001 — AI must never fail a simulation
        logger.warning("policy planner fallback: %s", exc)
        return _fallback_plan(
            category=category,
            topic=topic,
            area=area,
            factors=factors,
            parameters=fallback_parameters,
            limitation="ai unavailable",
        )


def _parse_json_answer(content: str) -> dict | None:
    """Local copy of the defensive JSON parser used by the Ask orchestrator."""
    from services.ai_engine.orchestrator import _parse_json_answer as parse

    return parse(content)


__all__ = ["plan_policy_simulation"]
