"""AI policy planner: turns a policy topic/free text/factors into simulation inputs.

This is the only place where a policy simulation uses an LLM. The planner is
defensive: bad JSON, invalid models or provider failures fall back to a
deterministic plan so a simulation never fails because of AI.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import math
import os
import re
import unicodedata
from pathlib import Path
from typing import Any

from services.ai_engine.providers import get_provider
from services.simulation_engine.registry import MODELS, get_model

logger = logging.getLogger("athenax.ai.policy_planner")

BASE_TAX_EUR_PER_BUILDING = 1_600.0
MAX_NEW_BUILDINGS = 20_000
PLANNER_TIMEOUT_SECONDS = 150.0

_PLAN_CACHE_VERSION = "v2"

_CHART_TYPES = {"bar", "line", "donut"}
_CHART_FORMATS = {"number", "currency", "percent"}
_KPI_TONES = {"positive", "negative", "neutral"}
_COLOR_RE = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
_DIMENSION_ALIASES = {
    "environment": "environment",
    "περιβάλλον": "environment",
    "society": "society",
    "social": "society",
    "κοινωνία": "society",
    "economy": "economy",
    "economics": "economy",
    "οικονομία": "economy",
    "mobility": "mobility",
    "transport": "mobility",
    "κινητικότητα": "mobility",
    "quality_of_life": "quality_of_life",
    "quality": "quality_of_life",
    "quality-of-life": "quality_of_life",
    "ποιότητα_ζωής": "quality_of_life",
    "administration": "administration",
    "governance": "administration",
    "διοίκηση": "administration",
}

PLANNER_SYSTEM_PROMPT = """You are AthenaX's policy simulation planner for the City of Athens.
You receive a policy topic, a free-text description of the changes, the user's
changing factors (for example new_buildings or tax_change_pct), a location and a
budget. Convert them into one simulation model and its parameters, estimate the
annual property-tax effect of new buildings, and write a concise bilingual
report. Use realistic, internally consistent planning assumptions.

Return ONLY a JSON object with this shape:
{
  "title": {"el": "...", "en": "..."},
  "model": "greenspace | accessibility | traffic_sumo | cost",
  "model_reason": {"el": "...", "en": "..."},
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
  "benefit": {
    "annual_benefit_eur": 55000,
    "rationale": {"el": "...", "en": "..."}
  },
  "grounding_used": ["OpenStreetMap Overpass API"],
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
- Model choice must follow the policy mechanism, not a metaphor:
  * accessibility ONLY when the policy changes physical walking distance or proximity
    to facilities (new/closed facilities, a different max walk distance). Never use it
    for digital access, data access, platforms, software, transparency or citizen
    participation, even when they are described as "access".
  * cost for digital platforms, software, data integration, procurement, administrative
    services, or policies with no physical footprint. Prefer cost when a budget is given
    and no domain model measures the policy.
  * traffic_sumo for roads, traffic, pedestrianisation, parking or street mobility.
  * greenspace for parks, trees, gardens or green area.
- Findings and risks must only claim effects the selected model measures. Do not mention
  accessibility, walkability, health or environmental benefits unless that is the selected
  model's actual output.
- Respect each parameter's label, unit and choices in the catalog.
- For traffic_sumo, demand and capacity are vehicles per hour. Keep them on the
  same scale as the defaults (around 1,200 demand and 1,600 capacity); never put
  a daily vehicle total directly into demand.
- Supported traffic interventions are open, congestion_charge, pedestrianize and
  closed.
- "title" must be a specific scenario name (for example "Πεζοδρόμηση πλατείας
  Εξαρχείων"), never just the technical model id.
- "model_reason" must explain in one sentence why that model fits the policy.
- Use the supplied default property tax proxy: 1600 EUR per new building per year,
  adjusted by tax_change_pct. If the user supplies a total tax change, apply it.
- Always return `benefit.annual_benefit_eur`: the realistic annual monetary benefit of the
  policy (avoided costs, time savings, tax revenue, or efficiency gains). Never leave it
  null. Use 0 only when the policy genuinely has no measurable benefit, and explain the
  basis in `benefit.rationale`.
- If a factor or tax value is not applicable, omit it or use null; never invent 0
  placeholders just to fill the schema.
- Numeric parameters must respect the catalog min/max. Do not invent locations.
- Write report text in Greek (el) and English (en), concise but specific.
- You have the FULL AthenaX data catalog in `grounding.datasets`: every dataset
  shown on the Data page, with `dataset_count`, `sources`, `source_registry`,
  `benchmarks`, `observed`, `area_profile` and `comparables`.
- You MUST use this catalog. Base every number, assumption and claim on
  `grounding` before relying on general knowledge. Never invent population,
  counts, areas or unit costs that contradict those values.
- You MUST cite the sources you relied on in `grounding_used`, using the dataset
  titles or URLs from `grounding.datasets` (or names from `grounding.sources` /
  `grounding.source_registry`). Never claim a source that is not in the catalog.
- The catalog always includes the AthensGov Sandbox API
  (https://athensgov.cityofathens.gr/sandbox/), which exposes the municipality's
  services, events, POIs, projects and reports. Use and cite it when the policy
  touches municipal services, events, POIs, projects or citizen requests.
- If no catalog dataset is relevant to the policy, say so explicitly in
  `assumptions` and keep the plan conservative.
- If `grounding.snapshot_mode` is "snapshot", state that real data were used in the
  assumptions. If it is "synthetic", state that the area data are synthetic.
- Prefer the benefit and benefit-cost ratio of the most similar entries in
  `grounding.comparables` unless the supplied benchmarks justify a different value.
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


def _text(value: Any, max_len: int = 300) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip()[:max_len]


def _finite(value: Any) -> float | None:
    number = _num(value)
    if number is None or not math.isfinite(number):
        return None
    return number


def _slug(value: Any, fallback: str) -> str:
    slug = re.sub(r"[^a-z0-9_]+", "_", _text(value, 80).lower()).strip("_")
    return slug or fallback


def _string_list(value: Any, *, limit: int = 12) -> list[str]:
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, list):
        return []
    items: list[str] = []
    seen: set[str] = set()
    for raw in value[:limit]:
        text = _text(raw, 300)
        if text and text not in seen:
            seen.add(text)
            items.append(text)
    return items


def _enforce_grounding_used(items: list[str], grounding: dict[str, Any]) -> list[str]:
    """Force the plan to cite the supplied data catalog when one was provided."""
    datasets = [
        row for row in (grounding.get("datasets") or []) if isinstance(row, dict)
    ]
    if not datasets:
        return items

    allowed: set[str] = set()
    for row in datasets:
        for key in ("title", "url"):
            value = str(row.get(key) or "").strip().lower()
            if value:
                allowed.add(value)
    for key in ("sources", "source_registry"):
        for row in grounding.get(key) or []:
            if not isinstance(row, dict):
                continue
            for field in ("name", "url"):
                value = str(row.get(field) or "").strip().lower()
                if value:
                    allowed.add(value)

    kept: list[str] = []
    for item in items:
        text = str(item).strip().lower()
        if not text:
            continue
        if any(
            text == candidate
            or (len(text) >= 4 and text in candidate)
            or (len(candidate) >= 4 and candidate in text)
            for candidate in allowed
        ):
            kept.append(item)
    if not kept:
        kept = [
            str(row.get("title") or "").strip()
            for row in datasets[:3]
            if str(row.get("title") or "").strip()
        ]
    return kept[:8]


def _cache_dir() -> Path:
    try:
        from app.config import get_settings

        base = Path(get_settings().storage_dir or "./storage").expanduser()
    except Exception:  # noqa: BLE001
        base = Path("./storage").expanduser()
    return base / "ai-plan-cache"


def _plan_cache_key(payload: dict[str, Any]) -> str:
    blob = json.dumps(
        payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str
    )
    return hashlib.sha256(f"{_PLAN_CACHE_VERSION}:{blob}".encode("utf-8")).hexdigest()


def _stable_grounding(grounding: dict[str, Any]) -> dict[str, Any]:
    """Grounding subset for the cache key: stable facts only, no timestamps/statuses.

    Comparables are excluded on purpose: they change as soon as a run is saved, and
    including them would make a repeated run miss the cache and drift.
    """
    stable: dict[str, Any] = {}
    for key in ("snapshot_mode", "area_profile", "observed", "coverage", "benchmarks"):
        if key in grounding:
            stable[key] = grounding.get(key)
    stable["sources"] = [
        {"name": src.get("name"), "url": src.get("url")}
        for src in grounding.get("sources") or []
        if isinstance(src, dict)
    ]
    stable["source_registry"] = [
        {"name": src.get("name"), "provider": src.get("provider")}
        for src in grounding.get("source_registry") or []
        if isinstance(src, dict)
    ]
    stable["datasets"] = [
        {"title": row.get("title"), "provider": row.get("provider")}
        for row in grounding.get("datasets") or []
        if isinstance(row, dict)
    ]
    return stable


def _read_cached_plan(key: str) -> dict[str, Any] | None:
    try:
        path = _cache_dir() / f"{key}.json"
        if not path.exists():
            return None
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else None
    except Exception:  # noqa: BLE001
        return None


def _write_cached_plan(key: str, plan: dict[str, Any]) -> None:
    try:
        directory = _cache_dir()
        directory.mkdir(parents=True, exist_ok=True)
        (directory / f"{key}.json").write_text(
            json.dumps(plan, ensure_ascii=False, sort_keys=True), encoding="utf-8"
        )
    except Exception as exc:  # noqa: BLE001
        logger.debug("plan cache write skipped: %s", exc)


def _normalise_kpis(raw_items: Any) -> list[dict[str, Any]]:
    if not isinstance(raw_items, list):
        return []
    items: list[dict[str, Any]] = []
    for raw in raw_items[:6]:
        if not isinstance(raw, dict):
            continue
        label = _localized(raw.get("label"))
        if not label["en"]:
            continue
        value = raw.get("value")
        if isinstance(value, bool):
            continue
        if isinstance(value, (int, float)):
            number = _finite(value)
            if number is None:
                continue
            value = round(number, 4)
        elif isinstance(value, str):
            value = _text(value, 120)
            if not value:
                continue
        else:
            continue
        tone = str(raw.get("tone") or "").strip().lower()
        items.append(
            {
                "label": label,
                "value": value,
                "unit": _text(raw.get("unit"), 20) or None,
                "hint": _localized(raw.get("hint")) if raw.get("hint") else None,
                "tone": tone if tone in _KPI_TONES else "neutral",
            }
        )
    return items


def _normalise_chart(raw_chart: Any) -> dict[str, Any] | None:
    if not isinstance(raw_chart, dict):
        return None
    chart_type = str(raw_chart.get("type") or "").strip().lower()
    if chart_type not in _CHART_TYPES:
        return None
    raw_labels = raw_chart.get("labels")
    if not isinstance(raw_labels, list) or not raw_labels:
        return None
    labels = [_localized(label, str(index + 1)) for index, label in enumerate(raw_labels[:24])]
    raw_datasets = raw_chart.get("datasets")
    if not isinstance(raw_datasets, list):
        return None
    datasets: list[dict[str, Any]] = []
    for index, raw_dataset in enumerate(raw_datasets[:4]):
        if not isinstance(raw_dataset, dict):
            continue
        raw_data = raw_dataset.get("data")
        if not isinstance(raw_data, list):
            continue
        data = [_finite(value) for value in raw_data[: len(labels)]]
        if not any(value is not None for value in data):
            continue
        cleaned = [float(value) if value is not None else 0.0 for value in data]
        if len(cleaned) < len(labels):
            cleaned.extend([0.0] * (len(labels) - len(cleaned)))
        dataset: dict[str, Any] = {
            "label": _localized(raw_dataset.get("label"), f"Series {index + 1}"),
            "data": cleaned,
        }
        color = str(raw_dataset.get("color") or "").strip()
        if _COLOR_RE.match(color):
            dataset["color"] = color
        datasets.append(dataset)
    if not datasets:
        return None
    fmt = str(raw_chart.get("format") or "").strip().lower()
    return {
        "type": chart_type,
        "title": _localized(raw_chart.get("title"), "Chart"),
        "labels": labels,
        "datasets": datasets,
        "unit": _text(raw_chart.get("unit"), 20) or None,
        "format": fmt if fmt in _CHART_FORMATS else "number",
        "horizontal": bool(raw_chart.get("horizontal")),
    }


def _normalise_table(raw_table: Any) -> dict[str, Any] | None:
    if not isinstance(raw_table, dict):
        return None
    raw_columns = raw_table.get("columns")
    if not isinstance(raw_columns, list) or not raw_columns:
        return None
    columns = [_localized(column, f"Column {index + 1}") for index, column in enumerate(raw_columns[:8])]
    raw_rows = raw_table.get("rows")
    if not isinstance(raw_rows, list) or not raw_rows:
        return None
    rows: list[list[Any]] = []
    for raw_row in raw_rows[:12]:
        if not isinstance(raw_row, list):
            continue
        row: list[Any] = []
        for cell in raw_row[: len(columns)]:
            if isinstance(cell, bool):
                row.append(str(cell).lower())
            elif isinstance(cell, (int, float)):
                number = _finite(cell)
                row.append(round(number, 4) if number is not None else "")
            else:
                row.append(_text(cell, 120))
        if len(row) < len(columns):
            row.extend([""] * (len(columns) - len(row)))
        rows.append(row)
    if not rows:
        return None
    table: dict[str, Any] = {"columns": columns, "rows": rows}
    if raw_table.get("title"):
        table["title"] = _localized(raw_table.get("title"))
    return table


def _normalise_sections(raw_sections: Any) -> list[dict[str, Any]]:
    if not isinstance(raw_sections, list):
        return []
    sections: list[dict[str, Any]] = []
    for raw_section in raw_sections[:6]:
        if not isinstance(raw_section, dict):
            continue
        raw_blocks = raw_section.get("blocks")
        if not isinstance(raw_blocks, list):
            continue
        blocks: list[dict[str, Any]] = []
        for raw_block in raw_blocks[:8]:
            if not isinstance(raw_block, dict):
                continue
            kind = str(raw_block.get("kind") or "").strip().lower()
            if kind == "kpis":
                items = _normalise_kpis(raw_block.get("items"))
                if items:
                    blocks.append({"kind": "kpis", "items": items})
            elif kind == "chart":
                chart = _normalise_chart(raw_block.get("chart"))
                if chart:
                    blocks.append({"kind": "chart", "chart": chart})
            elif kind == "table":
                table = _normalise_table(raw_block.get("table"))
                if table:
                    blocks.append({"kind": "table", "table": table})
            elif kind == "text":
                text = _localized(raw_block.get("text"))
                if text["en"]:
                    blocks.append({"kind": "text", "text": text})
            elif kind in ("findings", "risks"):
                items = _localized_list(raw_block.get("items"))
                if items:
                    blocks.append({"kind": kind, "items": items})
        if not blocks:
            continue
        section: dict[str, Any] = {
            "title": _localized(raw_section.get("title"), "Insights"),
            "blocks": blocks,
        }
        if raw_section.get("description"):
            description = _localized(raw_section.get("description"))
            if description["en"]:
                section["description"] = description
        sections.append(section)
    return sections


def _normalise_optimization(raw_optimization: Any) -> dict[str, Any] | None:
    """Scenario optimisation: what goes wrong and how to improve the scenario."""
    if not isinstance(raw_optimization, dict):
        return None
    negatives = _localized_list(
        raw_optimization.get("negatives")
        or raw_optimization.get("drawbacks")
        or raw_optimization.get("risks")
    )[:6]
    improvements = _localized_list(
        raw_optimization.get("improvements")
        or raw_optimization.get("recommendations")
        or raw_optimization.get("actions")
    )[:6]
    if not negatives and not improvements:
        return None
    return {"negatives": negatives, "improvements": improvements}


def _normalise_ai_metrics(raw_metrics: Any) -> list[dict[str, Any]]:
    if not isinstance(raw_metrics, list):
        return []
    metrics: list[dict[str, Any]] = []
    seen: set[str] = set()
    for index, raw in enumerate(raw_metrics[:12]):
        if not isinstance(raw, dict):
            continue
        label = _localized(raw.get("label"))
        if not label["en"]:
            continue
        value = _finite(raw.get("value"))
        if value is None:
            continue
        key = _slug(raw.get("key"), f"metric_{index + 1}")
        if key in seen:
            continue
        seen.add(key)
        baseline = _finite(raw.get("baseline"))
        confidence = _finite(raw.get("confidence"))
        metrics.append(
            {
                "key": key,
                "label": label,
                "value": round(value, 4),
                "baseline": round(baseline, 4) if baseline is not None else None,
                "unit": _text(raw.get("unit"), 20) or None,
                "confidence": round(max(0.0, min(1.0, confidence)), 2)
                if confidence is not None
                else 0.6,
                "source": "ai",
            }
        )
    return metrics


def _normalise_ai_impact(raw_impact: Any) -> list[dict[str, Any]]:
    if not isinstance(raw_impact, list):
        return []
    indicators: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for index, raw in enumerate(raw_impact[:12]):
        if not isinstance(raw, dict):
            continue
        dimension = re.sub(r"[\s-]+", "_", str(raw.get("dimension") or "").strip().lower())
        dimension = _DIMENSION_ALIASES.get(dimension, "")
        if not dimension:
            continue
        label = _localized(raw.get("label"))
        if not label["en"]:
            continue
        value = _finite(raw.get("value"))
        if value is None:
            continue
        name = _slug(raw.get("name"), f"ai_indicator_{index + 1}")
        if (dimension, name) in seen:
            continue
        seen.add((dimension, name))
        baseline = _finite(raw.get("baseline"))
        confidence = _finite(raw.get("confidence"))
        indicator: dict[str, Any] = {
            "dimension": dimension,
            "name": name,
            "label": label,
            "value": round(value, 4),
            "baseline": round(baseline, 4) if baseline is not None else None,
            "unit": _text(raw.get("unit"), 20) or "",
            "confidence": round(max(0.0, min(1.0, confidence)), 2)
            if confidence is not None
            else 0.55,
            "source": "ai",
        }
        note = _localized(raw.get("note")) if raw.get("note") else None
        if note and note["en"]:
            indicator["note"] = note
        indicators.append(indicator)
    return indicators


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
                    "label": param.get("label"),
                    "unit": param.get("unit"),
                    "default": param.get("default"),
                    "min": param.get("min"),
                    "max": param.get("max"),
                    "choices": param.get("choices"),
                }
            )
        catalog.append(
            {
                "name": name,
                "label": spec.label,
                "category": spec.category,
                "description": spec.description,
                "parameters": parameters,
            }
        )
    return catalog


def _fold(value: Any) -> str:
    """Lowercase and strip accents so Greek keyword matching is stable."""
    text = str(value or "").lower()
    text = unicodedata.normalize("NFD", text)
    return "".join(ch for ch in text if unicodedata.category(ch) != "Mn")


def _has_term(text: str, term: str) -> bool:
    if term.isascii():
        return re.search(rf"\b{re.escape(term)}", text) is not None
    return term in text


_GREENSPACE_TERMS = (
    "πρασιν", "παρκ", "δενδρ", "κηπ", "green", "park", "tree", "garden", "forest",
)
_TRAFFIC_TERMS = (
    "κυκλοφορ", "δρομ", "πεζ", "κινητικοτητ", "ποδηλατ",
    "traffic", "road", "pedestrian", "mobility", "sidewalk", "bike", "parking",
)
_COST_TERMS = (
    "κοστο", "προυπολογ", "συμβασ", "λογισμικ", "πλατφορμ", "ψηφιακ", "δεδομεν",
    "υπηρεσι", "διαφανει", "συμμετοχ", "διοικησ", "διακυβερν",
    "govtech", "digital", "software", "platform", "data", "api", "service",
    "transparency", "participation", "governance", "administration",
    "procurement", "budget", "cost", "finance", "funding",
)
_ACCESSIBILITY_TERMS = (
    "προσβασ", "εγκαταστασ", "εγγυτητ",
    "accessib", "walk", "facilit", "proximity", "foot",
)


def _fallback_model(category: str | None, topic: str, factors: Any) -> str:
    text = _fold(f"{category or ''} {topic or ''}")
    if any(_has_term(text, term) for term in _GREENSPACE_TERMS):
        return "greenspace"
    if any(_has_term(text, term) for term in _TRAFFIC_TERMS):
        return "traffic_sumo"
    if any(_has_term(text, term) for term in _COST_TERMS):
        return "cost"
    if any(_has_term(text, term) for term in _ACCESSIBILITY_TERMS):
        return "accessibility"
    if _factor_value(factors, "new_buildings") is not None:
        return "accessibility"
    return "cost"


def _guard_model(
    model_name: str, *, category: str | None, topic: str, requested: str | None
) -> str:
    """Keep the LLM from reusing accessibility for non-physical policies."""
    if requested in MODELS or model_name != "accessibility":
        return model_name
    text = _fold(f"{category or ''} {topic or ''}")
    if any(_has_term(text, term) for term in _ACCESSIBILITY_TERMS + _TRAFFIC_TERMS):
        return model_name
    if any(_has_term(text, term) for term in _COST_TERMS):
        return "cost"
    return model_name


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


def _normalise_benefit(raw_benefit: Any) -> dict[str, Any]:
    benefit = raw_benefit if isinstance(raw_benefit, dict) else {}
    annual = _num(benefit.get("annual_benefit_eur"))
    if annual is not None:
        annual = max(0.0, min(annual, 1_000_000_000.0))
    return {
        "annual_benefit_eur": round(annual, 2) if annual is not None else None,
        "rationale": _localized(benefit.get("rationale")),
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
        "title": _localized(topic, "Simulation"),
        "model_reason": {
            "el": "Επιλέχθηκε με βάση την κατηγορία και το θέμα της πολιτικής.",
            "en": "Selected from the policy category and topic.",
        },
        "parameters": normalised_parameters,
        "factors": _normalise_factors([], factors, tax),
        "tax": tax,
        "benefit": _normalise_benefit({}),
        "grounding_used": [],
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
    grounding: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Return an AI plan, never raising. The result is safe to persist as JSON.

    Identical inputs and grounding reuse the persisted plan, so repeated runs are
    reproducible instead of drifting between LLM calls.
    """
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
            "grounding": grounding or {},
        }
        cache_key = _plan_cache_key(
            {**prompt, "grounding": _stable_grounding(grounding or {})}
        )
        cached = _read_cached_plan(cache_key)
        if cached is not None:
            logger.info("policy planner: reused cached plan %s", cache_key[:12])
            return cached
        messages = [
            {"role": "system", "content": PLANNER_SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
        ]
        content = await asyncio.wait_for(
            active_provider.chat(messages, temperature=0.0, max_tokens=8192),
            timeout=PLANNER_TIMEOUT_SECONDS,
        )
        payload = _parse_json_answer(content)
        if not isinstance(payload, dict):
            raise ValueError("invalid JSON from policy planner")

        model_name = str(payload.get("model") or "").strip()
        if model in MODELS:
            model_name = model
        elif model_name not in MODELS:
            model_name = fallback_model
        else:
            model_name = _guard_model(
                model_name, category=category, topic=topic, requested=model
            )
        normalised_parameters = _normalise_parameters(
            model_name, payload.get("parameters"), fallback_parameters, area
        )
        tax = _normalise_tax(payload.get("tax"), factors)
        confidence = _num(payload.get("confidence"))
        confidence = max(0.0, min(1.0, confidence if confidence is not None else 0.6))
        title = _localized(payload.get("title"), topic or model_name)
        model_reason = _localized(payload.get("model_reason"))
        plan: dict[str, Any] = {
            "ai_used": True,
            "model": model_name,
            "title": title,
            "model_reason": model_reason
            if model_reason["en"]
            else {
                "el": f"Το μοντέλο {model_name} ταιριάζει καλύτερα στην πολιτική.",
                "en": f"The {model_name} model best matches the policy.",
            },
            "parameters": normalised_parameters,
            "factors": _normalise_factors(payload.get("factors"), factors, tax),
            "tax": tax,
            "benefit": _normalise_benefit(payload.get("benefit")),
            "grounding_used": _enforce_grounding_used(
                _string_list(payload.get("grounding_used"))[:8], grounding or {}
            ),
            "report": _normalise_report(payload.get("report"), model_name),
            "confidence": round(confidence, 2),
            "assumptions": _localized_list(payload.get("assumptions"))[:6],
            "limitations": ["ai-estimated values"],
            "sections": _normalise_sections(payload.get("sections")),
            "metrics": _normalise_ai_metrics(payload.get("metrics")),
            "impact": _normalise_ai_impact(payload.get("impact")),
            "optimization": _normalise_optimization(payload.get("optimization")),
        }
        _write_cached_plan(cache_key, plan)
        return plan
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


__all__ = [
    "plan_policy_simulation",
    "_localized",
    "_localized_list",
    "_normalise_ai_impact",
    "_normalise_ai_metrics",
    "_normalise_optimization",
    "_normalise_sections",
]
