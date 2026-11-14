"""Local one-at-a-time sensitivity (tornado data) for a completed simulation.

For each numeric input parameter, re-run the same model with the parameter at ±20 %
(keeping the same snapshot and seed) and record how every metric moves. This is a
*local* sensitivity check, not a global/statistical analysis, and it is stored with the
run so the impact page can show which lever matters without re-running anything.
"""
from __future__ import annotations

from typing import Any

from services.simulation_engine.registry import MODELS
from services.simulation_engine.runner import merge_parameters, run_model

STEP = 0.2
MAX_PARAMETERS = 5
EXCLUDED = {"area_id"}


def _is_numeric(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _bounds(spec_param: dict, value: float, step: float) -> tuple[float, float]:
    low = value * (1.0 - step)
    high = value * (1.0 + step)
    if isinstance(spec_param.get("min"), (int, float)):
        low = max(float(spec_param["min"]), low)
    if isinstance(spec_param.get("max"), (int, float)):
        high = min(float(spec_param["max"]), high)
    if value == 0:
        low, high = 0.0, max(1.0, step)
    return low, high


def compute_sensitivity(
    name: str,
    parameters: dict,
    metrics: dict,
    *,
    snapshot: dict | None = None,
    seed: int | None = None,
    step: float = STEP,
) -> dict | None:
    """Return tornado data or None when the model/inputs do not allow it."""
    model_cls = MODELS.get(name)
    if model_cls is None or not isinstance(metrics, dict) or not metrics:
        return None
    spec = model_cls.SPEC
    merged = merge_parameters(spec, parameters)
    spec_by_name = {param.get("name"): param for param in spec.parameters}

    entries: list[dict] = []
    for param_name, value in merged.items():
        if param_name in EXCLUDED or not _is_numeric(value):
            continue
        if len(entries) >= MAX_PARAMETERS:
            break
        spec_param = spec_by_name.get(param_name) or {}
        low, high = _bounds(spec_param, float(value), step)
        if spec_param.get("type") in ("int", "integer"):
            low, high = float(round(low)), float(round(high))
            if low == high:
                continue
        if low == value or high == value:
            continue
        low_result = run_model(
            name, {**merged, param_name: low}, snapshot=snapshot, seed=seed
        )
        high_result = run_model(
            name, {**merged, param_name: high}, snapshot=snapshot, seed=seed
        )
        if low_result.get("status") != "succeeded" or high_result.get("status") != "succeeded":
            continue
        low_metrics = low_result.get("metrics") or {}
        high_metrics = high_result.get("metrics") or {}
        movements: dict[str, dict] = {}
        total_swing = 0.0
        for metric_name, base_value in metrics.items():
            if not _is_numeric(base_value):
                continue
            low_value = low_metrics.get(metric_name)
            high_value = high_metrics.get(metric_name)
            if not _is_numeric(low_value) or not _is_numeric(high_value):
                continue
            swing = abs(float(high_value) - float(low_value))
            total_swing += swing
            movements[metric_name] = {
                "low": low_value,
                "high": high_value,
                "base": base_value,
                "swing": round(swing, 4),
            }
        if not movements:
            continue
        entries.append(
            {
                "parameter": param_name,
                "step": step,
                "low_input": low,
                "high_input": high,
                "total_swing": round(total_swing, 4),
                "metrics": movements,
            }
        )

    if not entries:
        return None
    entries.sort(key=lambda item: item["total_swing"], reverse=True)
    return {
        "method": "one_at_a_time",
        "step": step,
        "parameters": entries,
        "note": (
            "Τοπική ευαισθησία ±20% γύρω από τις τιμές εισόδου, με το ίδιο snapshot και seed. "
            "Δεν είναι στατιστική ανάλυση και δεν αποδεικνύει αιτιότητα."
        ),
    }
