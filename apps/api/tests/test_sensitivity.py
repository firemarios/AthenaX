"""Tests for the local sensitivity (tornado) helper and the BYO city pack."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import yaml
from app.repositories.simulations import run_from_row

from services.reporting_engine.sensitivity import compute_sensitivity
from services.simulation_engine.runner import run_model

ROOT = Path(__file__).resolve().parents[3]


def test_sensitivity_is_deterministic_and_sorted() -> None:
    parameters = {"area_id": "exarchia", "population": 10000, "park_count": 6, "avg_park_m2": 5000}
    metrics = run_model("greenspace", parameters, seed=42)["metrics"]

    first = compute_sensitivity("greenspace", parameters, metrics, seed=42)
    second = compute_sensitivity("greenspace", parameters, metrics, seed=42)

    assert first is not None and second is not None
    assert first == second
    names = [entry["parameter"] for entry in first["parameters"]]
    assert "area_id" not in names
    assert "park_count" in names
    assert first["parameters"] == sorted(
        first["parameters"], key=lambda item: item["total_swing"], reverse=True
    )
    for entry in first["parameters"]:
        assert entry["low_input"] != entry["high_input"]
        assert entry["total_swing"] >= 0


def test_sensitivity_unknown_model_returns_none() -> None:
    assert compute_sensitivity("no-such-model", {}, {"x": 1}) is None


def test_persisted_run_exposes_snapshot_mode() -> None:
    row = SimpleNamespace(
        id="run-1",
        policy_id=None,
        model_name="greenspace",
        model_version="1.0.0",
        parameters={},
        results={"metrics": {}, "snapshot": {"mode": "snapshot"}},
        passport={"inputs_checksum": "a" * 64},
        status="succeeded",
        error=None,
        seed=42,
        created_at=datetime.now(timezone.utc),
    )

    run = run_from_row(row)

    assert run["snapshot_mode"] == "snapshot"
    assert run["results"]["snapshot"]["mode"] == "snapshot"


def test_berlin_city_pack_is_valid() -> None:
    data = yaml.safe_load(
        (ROOT / "data" / "source-registry" / "catalog.berlin.yaml").read_text(encoding="utf-8")
    )
    assert data["city"]["id"] == "berlin"
    assert len(data["city"]["center"]) == 2
    area_ids = {area["id"] for area in data["city_areas"]}
    assert {"mitte", "kreuzberg", "neukoelln"} <= area_ids
    source_names = {source["name"] for source in data["sources"]}
    assert {"ckan", "overpass", "eurostat"} <= source_names
    for source in data["sources"]:
        assert source["endpoint_url"].startswith("http")
