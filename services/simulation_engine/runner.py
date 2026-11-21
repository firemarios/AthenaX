"""Deterministic model runner + passports (contract §5.5).

run_model NEVER raises: unknown model / execution errors → {"status": "failed", ...}.
Success → {"status": "succeeded", "metrics", "baseline", "uncertainty",
"assumptions", "warnings", "logs", "seed"}. Same name+params+seed → identical metrics.
"""
from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any

from services.simulation_engine.model_spec import ModelSpec
from services.simulation_engine.registry import MODELS, get_model

logger = logging.getLogger("athenax.simulation")

DEFAULT_SEED = 42


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)


def inputs_checksum(parameters: Any) -> str:
    """sha256 of the canonical JSON of the parameters."""
    return hashlib.sha256(canonical_json(parameters).encode("utf-8")).hexdigest()


def _coerce(value: Any, spec_type: str) -> Any:
    try:
        if spec_type in ("int", "integer"):
            return int(float(value))
        if spec_type in ("float", "number"):
            return float(value)
        if spec_type in ("str", "string"):
            return str(value)
        if spec_type in ("bool", "boolean"):
            return bool(value)
    except (TypeError, ValueError):
        return value
    return value


def _clamp(value: Any, spec: dict) -> Any:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return value
    if isinstance(spec.get("min"), (int, float)):
        value = max(float(spec["min"]), float(value))
    if isinstance(spec.get("max"), (int, float)):
        value = min(float(spec["max"]), float(value))
    if spec.get("type") in ("int", "integer") and isinstance(value, float):
        return int(value)
    return value


def merge_parameters(spec: ModelSpec, parameters: dict | None) -> dict:
    """Defaults ← user parameters, type-coerced and clamped to min/max."""
    merged: dict[str, Any] = {}
    given = parameters if isinstance(parameters, dict) else {}
    for param in spec.parameters:
        name = param.get("name")
        if not name:
            continue
        if name in given and given[name] is not None:
            value = _coerce(given[name], str(param.get("type", "str")))
            value = _clamp(value, param)
        else:
            value = param.get("default")
        merged[name] = value
    return merged


def _failed(name: str, warning: str, *, seed: int | None, logs: list[str] | None = None) -> dict:
    return {
        "status": "failed",
        "metrics": {},
        "baseline": None,
        "uncertainty": {},
        "assumptions": [],
        "warnings": [warning],
        "logs": logs or [f"model={name}", "status=failed"],
        "seed": seed,
    }


def run_model(
    name: str,
    parameters: dict,
    *,
    snapshot: dict | None = None,
    seed: int | None = None,
    compare_baseline: bool = False,
) -> dict:
    """Execute a registered model. NEVER raises (contract §5.5)."""
    seed_val = DEFAULT_SEED if seed is None else int(seed)
    parameters = parameters if isinstance(parameters, dict) else {}

    try:
        model_cls = MODELS.get(name)
        if model_cls is None:
            return _failed(
                name,
                f"Άγνωστο μοντέλο: {name}",
                seed=seed_val,
                logs=[f"model={name}", "status=failed", "reason=unknown_model"],
            )

        spec: ModelSpec = model_cls.SPEC
        merged = merge_parameters(spec, parameters)
        model = model_cls()

        result = model.run(merged, snapshot=snapshot, seed=seed_val)
        metrics = dict(result.get("metrics") or {})
        uncertainty = dict(result.get("uncertainty") or {})
        assumptions = list(result.get("assumptions") or [])
        warnings = list(result.get("warnings") or [])
        model_logs = list(result.get("logs") or [])

        baseline: dict | None = None
        if compare_baseline:
            baseline_input = merge_parameters(spec, {})
            baseline_hook = getattr(model, "baseline_parameters", None)
            if callable(baseline_hook):
                try:
                    baseline_input = merge_parameters(spec, baseline_hook(dict(merged)))
                except Exception as exc:  # noqa: BLE001 — fall back to defaults
                    logger.debug("baseline_parameters(%s) failed: %s", name, exc)
            base_result = model.run(baseline_input, snapshot=snapshot, seed=seed_val)
            baseline = dict(base_result.get("metrics") or {})

        logs = [
            f"model={name} version={spec.version}",
            f"seed={seed_val}",
            f"params_sha256={inputs_checksum(merged)}",
            f"metrics={','.join(sorted(metrics))}",
            *model_logs,
        ]

        return {
            "status": "succeeded",
            "metrics": metrics,
            "baseline": baseline,
            "uncertainty": uncertainty,
            "assumptions": assumptions,
            "warnings": warnings,
            "logs": logs,
            "seed": seed_val,
        }
    except Exception as exc:  # noqa: BLE001 — HTTP layer must never see exceptions
        logger.warning("run_model(%s) failed: %s", name, exc)
        return _failed(name, f"Σφάλμα εκτέλεσης μοντέλου {name}: {exc}", seed=seed_val)


def build_passport(
    name: str,
    parameters: dict,
    *,
    snapshot: dict | None = None,
    seed: int | None = None,
) -> dict:
    """Simulation Passport (TS Passport). Never raises; unknown models get version «unknown»."""
    parameters = parameters if isinstance(parameters, dict) else {}
    seed_val = DEFAULT_SEED if seed is None else int(seed)

    spec: ModelSpec | None = None
    assumptions: list[str] = []
    try:
        spec = get_model(name)
        assumptions = list(getattr(MODELS[name], "ASSUMPTIONS", []) or [])
    except KeyError:
        spec = None

    data_sources: list[dict] = []
    if isinstance(snapshot, dict) and isinstance(snapshot.get("sources"), list):
        for item in snapshot["sources"]:
            if isinstance(item, dict):
                entry = {"name": str(item.get("name") or "snapshot")}
                if item.get("url"):
                    entry["url"] = str(item["url"])
                if item.get("retrieved_at"):
                    entry["retrieved_at"] = str(item["retrieved_at"])
                data_sources.append(entry)
    elif isinstance(snapshot, dict) and snapshot:
        entry = {"name": "simulation snapshot"}
        if snapshot.get("retrieved_at"):
            entry["retrieved_at"] = str(snapshot["retrieved_at"])
        data_sources.append(entry)
    else:
        data_sources.append({"name": "Deterministic synthetic fixtures (model internal)"})

    return {
        "model_name": str(name),
        "model_version": spec.version if spec else "unknown",
        "data_sources": data_sources,
        "assumptions": assumptions,
        "reliability_limits": (
            "Τα αποτελέσματα βασίζονται σε δετερμιστικά συνθετικά δεδομένα και αναλυτικές υποθέσεις· "
            "δεν αποτελούν πραγματική παρατήρηση ή μελέτη εφαρμογής."
        ),
        "uncertainty": (
            "Τα εύρη αβεβαιότητας ανά μετρική παρατίθενται στο πεδίο uncertainty της εκτέλεσης "
            "(σταθερές αναλογίες γύρω από την κεντρική τιμή)."
        ),
        "validated_by": None,
        "executed_at": datetime.now(timezone.utc).isoformat(),
        "seed": seed_val,
        "inputs_checksum": inputs_checksum(parameters),
    }
