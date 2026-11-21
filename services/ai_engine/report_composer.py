"""Post-run AI report composer.

The planner picks the model and parameters before a run. This composer runs after
the simulation and turns the *actual* metrics, uncertainty and economics into
flexible report sections (KPIs, charts, tables, findings, risks) plus optional
AI impact estimates. It is defensive: any failure returns None and the run keeps
its deterministic/legacy AI report.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from services.ai_engine.policy_planner import (
    _localized,
    _normalise_ai_impact,
    _normalise_ai_metrics,
    _normalise_optimization,
    _normalise_sections,
    _parse_json_answer,
)
from services.ai_engine.providers import get_provider

logger = logging.getLogger("athenax.ai.report_composer")

COMPOSER_TIMEOUT_SECONDS = 180.0

COMPOSER_SYSTEM_PROMPT = """You are AthenaX's simulation report writer for the City of Athens.
You receive a policy, the selected simulation model and its parameters, the ACTUAL
simulation metrics, baseline, uncertainty, economics and passport assumptions.
Write a short, specific, decision-useful bilingual report.

Return ONLY a JSON object with this shape:
{
  "title": {"el": "...", "en": "..."},
  "model_reason": {"el": "...", "en": "..."},
  "sections": [
    {
      "title": {"el": "...", "en": "..."},
      "description": {"el": "...", "en": "..."},
      "blocks": [
        {"kind": "kpis", "items": [
          {"label": {"el": "...", "en": "..."}, "value": 42.3,
           "unit": "%", "hint": {"el": "...", "en": "..."}, "tone": "positive"}
        ]},
        {"kind": "chart", "chart": {
          "type": "bar | line | donut",
          "title": {"el": "...", "en": "..."},
          "labels": [{"el": "...", "en": "..."}],
          "datasets": [{"label": {"el": "...", "en": "..."}, "data": [1, 2, 3]}],
          "unit": "%", "format": "number | currency | percent", "horizontal": false
        }},
        {"kind": "table", "table": {
          "title": {"el": "...", "en": "..."},
          "columns": [{"el": "...", "en": "..."}],
          "rows": [["label", 12.3]]
        }},
        {"kind": "text", "text": {"el": "...", "en": "..."}},
        {"kind": "findings", "items": [{"el": "...", "en": "..."}]},
        {"kind": "risks", "items": [{"el": "...", "en": "..."}]}
      ]
    }
  ],
  "metrics": [
    {"key": "custom_metric", "label": {"el": "...", "en": "..."},
     "value": 12.3, "baseline": 10.0, "unit": "%", "confidence": 0.6}
  ],
  "impact": [
    {"dimension": "environment | society | economy | mobility | quality_of_life | administration",
     "name": "indicator_key", "label": {"el": "...", "en": "..."},
     "value": 12.3, "baseline": null, "unit": "%", "confidence": 0.6,
     "note": {"el": "...", "en": "..."}}
  ],
  "optimization": {
    "negatives": [{"el": "...", "en": "..."}],
    "improvements": [{"el": "...", "en": "..."}]
  }
}

Rules:
- Use the ACTUAL metrics/economics for numbers. Never contradict them.
- You have the full AthenaX data catalog in `grounding.datasets` (every dataset on
  the Data page). Ground every qualitative claim in it, prefer its `area_profile`,
  `sources` and `source_registry`, and cite the relevant dataset titles/URLs.
  Never invent sources or contradict the catalog.
- The catalog always includes the AthensGov Sandbox API
  (https://athensgov.cityofathens.gr/sandbox/) for municipal services, events,
  POIs, projects and citizen requests. Cite it when the report relies on them.
- Report only what the selected model measures. Do not mention accessibility,
  walkability or pedestrian access unless the selected model is accessibility or the
  supplied metrics include such a measure.
- Prefer real metric values over invented ones. Only add custom metrics/impact
  estimates when they add insight that the actual metrics do not cover.
- Never emit 0 or null placeholders for values that are simply not applicable.
  Omit the KPI/chart/indicator instead.
- Charts must use at most 6 labels and 3 datasets. Tables at most 6 columns and
  8 rows. Sections at most 5. Blocks at most 6 per section.
- Always return `optimization` (Scenario optimisation). In `negatives` list 2-4
  specific downsides, trade-offs or side effects that the ACTUAL metrics,
  economics or uncertainty reveal (who loses, what gets worse, hidden cost,
  distributional impact, implementation risk). In `improvements` list 2-4
  concrete, actionable changes to the scenario (parameter values, phasing,
  mitigation measures, complementary actions) and the expected effect of each.
  Ground them in the catalog and actual metrics; do not repeat the risks block
  verbatim. If the scenario is mostly positive, state residual risks and
  safeguards instead of inventing failures.
- Keep labels short. Write every label and text in Greek (el) and English (en).
- "title" is a specific scenario name, not the technical model id.
- No HTML, markdown, URLs or prose outside the JSON object.
- Do not write reasoning or analysis. Output the JSON object immediately.
- Return complete valid JSON; never stop mid-string.
"""


def _compact_grounding(grounding: dict[str, Any] | None) -> dict[str, Any]:
    data = grounding or {}
    datasets = [row for row in (data.get("datasets") or []) if isinstance(row, dict)]
    return {
        "dataset_count": data.get("dataset_count") or len(datasets),
        "data_page": data.get("data_page"),
        "snapshot_mode": data.get("snapshot_mode"),
        "area_profile": data.get("area_profile") or {},
        "datasets": [
            {
                "title": row.get("title"),
                "provider": row.get("provider"),
                "url": row.get("url"),
                "category": row.get("category"),
                "tags": list(row.get("tags") or [])[:6],
            }
            for row in datasets
        ],
        "sources": data.get("sources") or [],
        "source_registry": data.get("source_registry") or [],
    }


def _compact_policy(policy: dict[str, Any] | None, fallback_title: str) -> dict[str, Any]:
    data = policy or {}
    return {
        "title": data.get("title") or fallback_title,
        "description": data.get("description"),
        "changes": data.get("changes"),
        "category": data.get("category"),
        "area": data.get("area"),
        "horizon": data.get("horizon"),
        "budget_eur": data.get("budget_eur"),
        "factors": data.get("factors") or [],
        "kpis": data.get("kpis") or [],
    }


async def compose_simulation_report(
    *,
    policy: dict[str, Any] | None,
    plan: dict[str, Any],
    metrics: dict[str, Any],
    baseline: dict[str, Any] | None,
    uncertainty: dict[str, Any] | None,
    economics: dict[str, Any] | None,
    passport: dict[str, Any] | None,
    warnings: list[str] | None = None,
    provider: Any = None,
    grounding: dict[str, Any] | None = None,
    timeout: float = COMPOSER_TIMEOUT_SECONDS,
) -> dict[str, Any] | None:
    """Return flexible AI report fields, or None when composition is unavailable."""
    try:
        active_provider = provider
        if active_provider is None:
            from app.config import get_settings

            active_provider = get_provider(get_settings())
            if hasattr(active_provider, "timeout"):
                active_provider.timeout = max(float(active_provider.timeout or 0.0), 150.0)

        prompt = {
            "policy": _compact_policy(policy, str(plan.get("title") or "Policy simulation")),
            "model": {
                "name": plan.get("model"),
                "reason": plan.get("model_reason"),
                "parameters": plan.get("parameters") or {},
            },
            "grounding": _compact_grounding(grounding),
            "simulation": {
                "metrics": metrics,
                "baseline": baseline,
                "uncertainty": uncertainty or {},
                "economics": economics,
                "passport": passport,
                "warnings": warnings or [],
            },
        }
        messages = [
            {"role": "system", "content": COMPOSER_SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(prompt, ensure_ascii=False, default=str)},
        ]
        content = await asyncio.wait_for(
            active_provider.chat(messages, temperature=0.25, max_tokens=16000),
            timeout=timeout,
        )
        payload = _parse_json_answer(content)
        if not isinstance(payload, dict):
            logger.warning(
                "report composer invalid JSON (%d chars): %r",
                len(content or ""),
                (content or "")[:1200],
            )
            raise ValueError("invalid JSON from report composer")

        composed: dict[str, Any] = {}
        title = _localized(payload.get("title"))
        if title["en"]:
            composed["title"] = title
        reason = _localized(payload.get("model_reason"))
        if reason["en"]:
            composed["model_reason"] = reason
        sections = _normalise_sections(payload.get("sections"))
        if sections:
            composed["sections"] = sections
        custom_metrics = _normalise_ai_metrics(payload.get("metrics"))
        if custom_metrics:
            composed["metrics"] = custom_metrics
        impact = _normalise_ai_impact(payload.get("impact"))
        if impact:
            composed["impact"] = impact
        optimization = _normalise_optimization(payload.get("optimization"))
        if optimization:
            composed["optimization"] = optimization
        return composed or None
    except Exception as exc:  # noqa: BLE001 — the report is optional
        logger.warning("report composer fallback: %s", exc)
        return None
