"""AI module (03) + Policy/Simulation modules (05/06/08)."""
from __future__ import annotations

import asyncio
import json

import pytest

from services.ai_engine.policy_planner import (
    _fallback_model,
    _normalise_sections,
    plan_policy_simulation,
)
from services.ai_engine.report_composer import compose_simulation_report
from services.reporting_engine.economics import compute_economics
from services.reporting_engine.impact import compute_impact


@pytest.fixture(autouse=True)
def _no_live_extras(monkeypatch):
    """Keep these unit tests offline: no DB datasets, live statistics or web search."""

    async def _empty(*args, **kwargs):
        return []

    monkeypatch.setattr("app.services.intelligence.statistics_records", _empty)
    monkeypatch.setattr("app.services.intelligence.web_records", _empty)
    monkeypatch.setattr("app.services.intelligence.govtech_records", _empty)
    monkeypatch.setattr("app.repositories.datasets.search_relevant_datasets", _empty)
    yield


async def _fake_answer(question, records=None, city=None):
    return {
        "summary": "Σύνοψη",
        "detailed_result": "Λεπτομερής απάντηση",
        "sources": [],
        "limitations": [],
    }


class _FakeAIConnector:
    name = "openmeteo"
    source_url = "https://api.open-meteo.com/v1/forecast"

    async def search(self, query=None, limit=30):
        return [
            {"title": "Athens weather", "lat": 37.98, "lon": 23.73, "provider": "Open-Meteo"},
            {"title": "Thessaloniki weather", "lat": 40.64, "lon": 22.94, "provider": "Open-Meteo"},
            {"title": "Weather bulletin (no coords)", "provider": "Open-Meteo"},
        ]


def test_ai_query_happy_path(client, monkeypatch):
    monkeypatch.setattr(
        "app.services.intelligence.select_connectors",
        lambda question, enabled: [("openmeteo", _FakeAIConnector())],
    )
    monkeypatch.setattr("app.services.intelligence.answer_question", _fake_answer)

    resp = client.post("/v1/ai/query", json={"question": "Πώς είναι ο καιρός στην Αθήνα;"})
    body = resp.json()
    assert resp.status_code == 200 and body["ok"] is True
    assert body["data"]["summary"] == "Σύνοψη"
    meta = body["meta"]
    assert meta["record_count"] == 2
    assert meta["sources"] == ["https://api.open-meteo.com/v1/forecast"]
    assert meta["ui"]["show_map"] is True
    assert meta["ui"]["empty_state"] is False
    assert meta["ui"]["alert"] is None
    assert meta["limitations"] == []
    assert meta["ui"]["suggested_actions"]


def test_ai_query_no_connectors_alert(client, monkeypatch):
    monkeypatch.setattr("app.services.intelligence.select_connectors", lambda q, e: [])
    monkeypatch.setattr("app.services.intelligence.answer_question", _fake_answer)

    resp = client.post("/v1/ai/query", json={"question": "τίποτα"})
    body = resp.json()
    assert resp.status_code == 200 and body["ok"] is True
    meta = body["meta"]
    assert meta["ui"]["alert"] == "Δεν υπάρχουν ενεργοποιημένοι συνθέτες δεδομένων."
    assert meta["ui"]["empty_state"] is True
    assert meta["record_count"] == 0
    assert meta["ui"]["alert"] in meta["limitations"]


def test_ai_chat_alias(client, monkeypatch):
    monkeypatch.setattr("app.services.intelligence.select_connectors", lambda q, e: [])
    monkeypatch.setattr("app.services.intelligence.answer_question", _fake_answer)
    resp = client.post("/v1/ai/chat", json={"question": "γεια"})
    assert resp.status_code == 200 and resp.json()["ok"] is True


def test_models_list(client):
    resp = client.get("/v1/models")
    body = resp.json()
    assert resp.status_code == 200 and body["ok"] is True
    assert len(body["data"]) == 4
    spec = body["data"][0]
    assert {"name", "version", "category", "description", "label", "parameters"} <= set(spec)
    assert spec["label"]["en"]


def test_policy_crud_flow(client):
    created = client.post(
        "/v1/policies",
        json={
            "title": "Πράσινη επένδυση",
            "category": "environment",
            "area": "exarchia",
        },
    )
    assert created.status_code == 201
    policy = created.json()["data"]
    assert policy["id"]

    listed = client.get("/v1/policies").json()
    assert any(item["id"] == policy["id"] for item in listed["data"])

    detail = client.get(f"/v1/policies/{policy['id']}")
    assert detail.status_code == 200

    variant = client.post(
        f"/v1/policies/{policy['id']}/variants",
        json={"title": "Σενάριο Α", "parameters": {"budget": 100000}},
    )
    assert variant.status_code == 201
    assert variant.json()["data"]["title"] == "Σενάριο Α"

    assert client.get("/v1/policies/missing").status_code == 404


def test_simulation_create_success(client):
    resp = client.post("/v1/simulations", json={"model": "cost", "parameters": {}})
    body = resp.json()
    assert resp.status_code == 200 and body["ok"] is True
    run = body["data"]
    assert run["status"] == "succeeded"
    assert run["model_name"] == "cost"
    assert run["model_version"] == "1.0.0"
    assert run["results"]["metrics"]
    assert isinstance(run["passport"], dict)

    detail = client.get(f"/v1/simulations/{run['id']}")
    assert detail.status_code == 200
    assert detail.json()["data"]["id"] == run["id"]

    listing = client.get("/v1/simulations").json()
    assert any(item["id"] == run["id"] for item in listing["data"])


def test_simulation_unknown_model_failed(client):
    resp = client.post("/v1/simulations", json={"model": "no-such-model", "parameters": {}})
    body = resp.json()
    assert resp.status_code == 200 and body["ok"] is True
    assert body["data"]["status"] == "failed"


def test_simulation_404(client):
    resp = client.get("/v1/simulations/missing-run")
    assert resp.status_code == 404
    assert resp.json()["error"]["message"] == "Η προσομοίωση δεν βρέθηκε."


def test_impact_report(client):
    run = client.post("/v1/simulations", json={"model": "cost", "parameters": {}}).json()["data"]
    resp = client.get(f"/v1/impact/{run['id']}")
    body = resp.json()
    assert resp.status_code == 200 and body["ok"] is True
    assert len(body["data"]["dimensions"]) == 6
    assert body["data"]["run_id"] == run["id"]
    assert "summary" in body["data"]

    assert client.get("/v1/impact/nope").status_code == 404


def test_policy_factors_and_simulation_economics(client):
    created = client.post(
        "/v1/policies",
        json={
            "title": "Πράσινο σενάριο",
            "category": "environment",
            "area": "Εξάρχεια",
            "budget_eur": 100000,
            "factors": [
                {
                    "name": "park_count",
                    "baseline": 8,
                    "min": 0,
                    "max": 30,
                    "unit": "parks",
                }
            ],
        },
    )
    assert created.status_code == 201
    policy = created.json()["data"]
    assert policy["budget_eur"] == 100000
    assert policy["factors"][0]["name"] == "park_count"

    resp = client.post(
        "/v1/simulations",
        json={
            "model": "greenspace",
            "policy_id": policy["id"],
            "area": "Εξάρχεια",
            "compare_baseline": True,
            "parameters": {"park_count": 12, "avg_park_m2": 5000, "population": 10000},
        },
    )
    run = resp.json()["data"]
    assert run["status"] == "succeeded"
    assert run["parameters"]["area_id"] == "Εξάρχεια"
    assert run["results"]["baseline"]

    economics = run["results"]["economics"]
    assert economics["capex_eur"] > 0
    assert economics["budget_eur"] == 100000
    assert economics["verdict"] in {"yes", "marginal", "no", "unknown"}
    assert economics["cost_breakdown"]

    sensitivity = run["results"].get("sensitivity")
    assert sensitivity and sensitivity["parameters"]
    assert all(entry["total_swing"] >= 0 for entry in sensitivity["parameters"])

    reproduced = client.post(
        "/v1/simulations",
        json={
            "model": run["model_name"],
            "parameters": run["parameters"],
            "compare_baseline": True,
            "area": run["parameters"]["area_id"],
            "seed": run["passport"]["seed"],
        },
    ).json()["data"]
    assert reproduced["passport"]["inputs_checksum"] == run["passport"]["inputs_checksum"]
    assert reproduced["results"]["metrics"] == run["results"]["metrics"]


class _FakePlannerProvider:
    def __init__(self, content: str) -> None:
        self.content = content
        self.calls = 0

    async def chat(self, messages, *, temperature=0.3, max_tokens=2048):
        self.calls += 1
        return self.content


def test_policy_planner_calculates_model_factors_and_tax():
    claim = {
        "model": "greenspace",
        "parameters": {"park_count": 14, "avg_park_m2": 6200, "population": 12000},
        "factors": [
            {
                "name": "new_buildings",
                "label": {"el": "Νέα κτίρια", "en": "New buildings"},
                "value": 40,
                "unit": "buildings",
                "reason": {"el": "Από το κείμενο", "en": "From the text"},
            }
        ],
        "tax": {
            "new_buildings": 40,
            "tax_change_pct": 5,
            "annual_tax_revenue_eur": 67200,
            "rationale": {"el": "Νέες οικοδομές", "en": "New buildings"},
        },
        "report": {
            "summary": {"el": "Σύνοψη", "en": "Summary"},
            "findings": [{"el": "Εύρημα", "en": "Finding"}],
            "risks": [{"el": "Κίνδυνος", "en": "Risk"}],
        },
        "confidence": 0.81,
        "assumptions": [{"el": "Υπόθεση", "en": "Assumption"}],
    }
    plan = asyncio.run(
        plan_policy_simulation(
            title="Πράσινο σενάριο",
            changes="40 νέα κτίρια και 5% αύξηση φόρου",
            category="environment",
            area="Εξάρχεια",
            factors=[{"name": "new_buildings", "baseline": 25}],
            provider=_FakePlannerProvider(json.dumps(claim)),
        )
    )
    assert plan["ai_used"] is True
    assert plan["model"] == "greenspace"
    assert plan["parameters"]["area_id"] == "Εξάρχεια"
    assert plan["parameters"]["park_count"] == 14
    assert plan["tax"]["annual_tax_revenue_eur"] == 67200
    assert plan["report"]["findings"][0]["en"] == "Finding"
    assert plan["confidence"] == 0.81


def test_policy_planner_reuses_cached_plan_for_identical_inputs():
    claim = {
        "model": "greenspace",
        "parameters": {"area_id": "Exarchia", "park_count": 12},
        "benefit": {
            "annual_benefit_eur": 51000,
            "rationale": {"el": "Δεδομένα OSM", "en": "OSM data"},
        },
        "report": {"summary": {"el": "Σύνοψη", "en": "Summary"}},
        "grounding_used": ["OpenStreetMap Overpass API"],
    }
    provider = _FakePlannerProvider(json.dumps(claim))
    kwargs = {
        "title": "Deterministic cached plan check",
        "category": "environment",
        "area": "Exarchia",
        "provider": provider,
        "grounding": {
            "snapshot_mode": "snapshot",
            "retrieved_at": "t1",
            "area_profile": {"population": 9000, "parks": 4},
            "comparables": [{"capex_eur": 250000}],
        },
    }
    first = asyncio.run(plan_policy_simulation(**kwargs))
    second = asyncio.run(plan_policy_simulation(**kwargs))
    assert provider.calls == 1
    assert first == second
    assert second["benefit"]["annual_benefit_eur"] == 51000
    assert second["grounding_used"] == ["OpenStreetMap Overpass API"]


def test_report_sections_normalizer_drops_invalid_blocks():
    sections = _normalise_sections(
        [
            {
                "title": {"el": "Ανάλυση", "en": "Analysis"},
                "blocks": [
                    {"kind": "kpis", "items": [{"label": {"el": "Κάλυψη", "en": "Coverage"}, "value": 72.5, "unit": "%"}]},
                    {
                        "kind": "chart",
                        "chart": {
                            "type": "bar",
                            "title": {"el": "Σύγκριση", "en": "Comparison"},
                            "labels": [{"el": "Α", "en": "A"}, {"el": "Β", "en": "B"}],
                            "datasets": [{"label": {"el": "Σενάριο", "en": "Scenario"}, "data": [10, 12]}],
                            "format": "percent",
                        },
                    },
                    {"kind": "chart", "chart": {"type": "radar", "labels": [], "datasets": []}},
                    {"kind": "kpis", "items": [{"label": {"el": "", "en": ""}, "value": 4}]},
                ],
            }
        ]
    )
    assert len(sections) == 1
    kinds = [block["kind"] for block in sections[0]["blocks"]]
    assert kinds == ["kpis", "chart"]
    chart = sections[0]["blocks"][1]["chart"]
    assert len(chart["labels"]) == len(chart["datasets"][0]["data"]) == 2


def test_report_composer_returns_flexible_sections():
    class _ComposerProvider:
        async def chat(self, messages, *, temperature=0.3, max_tokens=2048):
            return json.dumps(
                {
                    "title": {"el": "Πεζοδρόμηση", "en": "Pedestrianisation"},
                    "model_reason": {"el": "Ταίριασμα", "en": "Fits"},
                    "sections": [
                        {
                            "title": {"el": "Αποτελέσματα", "en": "Results"},
                            "blocks": [
                                {
                                    "kind": "kpis",
                                    "items": [
                                        {
                                            "label": {"el": "Κάλυψη", "en": "Coverage"},
                                            "value": 72.5,
                                            "unit": "%",
                                            "tone": "positive",
                                        }
                                    ],
                                }
                            ],
                        }
                    ],
                    "metrics": [
                        {
                            "key": "extra",
                            "label": {"el": "Πρόσθετο", "en": "Extra"},
                            "value": 3.2,
                            "unit": "t",
                        }
                    ],
                }
            )

    composed = asyncio.run(
        compose_simulation_report(
            policy={"title": "Πεζοδρόμηση"},
            plan={"model": "traffic_sumo", "ai_used": True},
            metrics={"avg_travel_min": 14.2},
            baseline=None,
            uncertainty={},
            economics={"capex_eur": 100000},
            passport={},
            provider=_ComposerProvider(),
        )
    )
    assert composed is not None
    assert composed["title"]["en"] == "Pedestrianisation"
    assert composed["sections"][0]["blocks"][0]["kind"] == "kpis"
    assert composed["metrics"][0]["source"] == "ai"


def test_impact_merges_economics_and_ai_indicators():
    report = compute_impact(
        {"accessibility_pct": 70.0},
        baseline={"accessibility_pct": 60.0},
        economics={"capex_eur": 50000.0, "benefit_cost_ratio": 1.4, "confidence": 0.8},
        ai_impact=[
            {
                "dimension": "environment",
                "name": "co2_saved",
                "label": {"el": "CO2", "en": "CO2 saved"},
                "value": 12.0,
                "unit": "t",
                "confidence": 0.6,
            }
        ],
    )
    dimensions = {dimension["key"]: dimension for dimension in report["dimensions"]}
    assert dimensions["mobility"]["indicators"][0]["source"] == "simulation"
    economy = {item["name"]: item for item in dimensions["economy"]["indicators"]}
    assert economy["capex_eur"]["source"] == "economics"
    assert economy["benefit_cost_ratio"]["value"] == 1.4
    environment = {item["name"]: item for item in dimensions["environment"]["indicators"]}
    assert environment["co2_saved"]["source"] == "ai"


def test_policy_planner_falls_back_without_failing():
    class _BrokenProvider:
        async def chat(self, messages, *, temperature=0.3, max_tokens=2048):
            raise RuntimeError("provider down")

    plan = asyncio.run(
        plan_policy_simulation(
            title="Νέα κτίρια",
            category="housing",
            area="Κυψέλη",
            factors=[{"name": "new_buildings", "baseline": 10}],
            provider=_BrokenProvider(),
        )
    )
    assert plan["ai_used"] is False
    assert plan["model"] == "accessibility"
    assert plan["tax"]["annual_tax_revenue_eur"] == 16000
    assert plan["report"]["summary"]["en"]


def test_fallback_model_routes_services_to_cost_and_handles_accented_greek():
    assert _fallback_model(
        "services", "Ψηφιακή πλατφόρμα GovTech με ανοικτά δεδομένα και APIs", None
    ) == "cost"
    assert _fallback_model(
        "environment", "Αύξηση διαθέσιμου πρασίνου στα Εξάρχεια", None
    ) == "greenspace"
    assert _fallback_model("mobility", "Νέα πεζοδρόμια και πεζοδρομήσεις", None) == "traffic_sumo"


class _AccessibilityForEverythingProvider:
    async def chat(self, messages, *, temperature=0.3, max_tokens=2048):
        return json.dumps(
            {
                "title": {"el": "Ψηφιακή πλατφόρμα", "en": "Digital platform"},
                "model": "accessibility",
                "model_reason": {
                    "el": "Αναλογικό μοντέλο πρόσβασης.",
                    "en": "Analogous access model.",
                },
                "parameters": {},
                "confidence": 0.6,
            }
        )


def test_planner_does_not_use_accessibility_for_a_digital_platform():
    plan = asyncio.run(
        plan_policy_simulation(
            title="Ψηφιακή πλατφόρμα GovTech με ανοικτά δεδομένα",
            description="Πλατφόρμα λογισμικού και δημόσιες ψηφιακές υπηρεσίες.",
            category="services",
            provider=_AccessibilityForEverythingProvider(),
        )
    )
    assert plan["ai_used"] is True
    assert plan["model"] == "cost"


def test_planner_respects_an_explicit_model_request():
    plan = asyncio.run(
        plan_policy_simulation(
            title="Ψηφιακή πλατφόρμα GovTech",
            category="services",
            model="greenspace",
            provider=_AccessibilityForEverythingProvider(),
        )
    )
    assert plan["model"] == "greenspace"


def test_simulation_use_ai_persists_plan_and_tax(client, monkeypatch):
    policy = client.post(
        "/v1/policies",
        json={
            "title": "Νέα κτίρια στην Κυψέλη",
            "changes": "40 νέα κτίρια με 5% αύξηση φόρου",
            "category": "housing",
            "area": "Κυψέλη",
            "budget_eur": 200000,
            "factors": [{"name": "new_buildings", "baseline": 40}],
        },
    ).json()["data"]

    async def _fake_plan(**kwargs):
        return {
            "ai_used": True,
            "model": "accessibility",
            "parameters": {
                "area_id": kwargs["area"],
                "max_walk_m": 600,
                "facility_count": 12,
                "population": 15000,
            },
            "factors": [],
            "tax": {
                "new_buildings": 40,
                "tax_change_pct": 5,
                "annual_tax_revenue_eur": 67200,
                "rationale": {"el": "Νέα κτίρια", "en": "New buildings"},
            },
            "report": {
                "summary": {"el": "Σύνοψη", "en": "Summary"},
                "findings": [],
                "risks": [],
            },
            "confidence": 0.8,
            "assumptions": [],
            "limitations": [],
        }

    async def _fake_compose(**kwargs):
        return None

    monkeypatch.setattr("app.api.v1.simulations.plan_policy_simulation", _fake_plan)
    monkeypatch.setattr("app.api.v1.simulations.compose_simulation_report", _fake_compose)
    resp = client.post(
        "/v1/simulations",
        json={"policy_id": policy["id"], "use_ai": True, "parameters": {}, "compare_baseline": True},
    )
    created = resp.json()["data"]
    assert created["status"] == "running"
    run = client.get(f"/v1/simulations/{created['id']}").json()["data"]
    assert run["status"] == "succeeded"
    assert run["model_name"] == "accessibility"
    assert run["results"]["ai"]["tax"]["annual_tax_revenue_eur"] == 67200
    assert run["parameters"]["area_id"] == "Κυψέλη"
    assert run["results"]["economics"]["annual_tax_revenue_eur"] == 67200
    assert run["results"]["economics"]["new_buildings"] == 40


def test_delete_policy_and_simulation(client):
    policy = client.post(
        "/v1/policies", json={"title": "Προς διαγραφή", "category": "environment"}
    ).json()["data"]
    client.post(
        f"/v1/policies/{policy['id']}/variants",
        json={"title": "Παραλλαγή", "parameters": {"budget": 1000}},
    )

    deleted = client.delete(f"/v1/policies/{policy['id']}")
    assert deleted.status_code == 200
    assert deleted.json()["data"] == {"id": policy["id"], "deleted": True}
    assert client.get(f"/v1/policies/{policy['id']}").status_code == 404
    assert client.delete(f"/v1/policies/{policy['id']}").status_code == 404

    run = client.post("/v1/simulations", json={"model": "cost", "parameters": {}}).json()["data"]
    assert client.delete(f"/v1/simulations/{run['id']}").status_code == 200
    assert client.get(f"/v1/simulations/{run['id']}").status_code == 404
    assert client.delete(f"/v1/simulations/{run['id']}").status_code == 404


def test_economics_cost_model_always_gets_a_verdict():
    economics = compute_economics(
        "cost",
        {"unit_cost_eur": 250, "length_m": 1000, "contingency_pct": 10},
        {
            "cost_eur": 275000.0,
            "cost_low_eur": 212500.0,
            "cost_high_eur": 316250.0,
        },
        None,
    )
    assert economics["capex_eur"] == 275000.0
    assert economics["annual_benefit_eur"] > 0
    assert economics["benefit_source"] == "heuristic"
    assert economics["benefit_cost_ratio"] is not None
    assert economics["verdict"] != "unknown"
    assert economics["benefit_breakdown"][0]["label"]["en"] == "Estimated annual benefit"


def test_economics_uses_ai_benefit_estimate():
    economics = compute_economics(
        "cost",
        {"unit_cost_eur": 250, "length_m": 1000, "contingency_pct": 10},
        {
            "cost_eur": 275000.0,
            "cost_low_eur": 212500.0,
            "cost_high_eur": 316250.0,
        },
        None,
        annual_benefit_eur=90000,
    )
    assert economics["annual_benefit_eur"] == 90000
    assert economics["benefit_source"] == "ai"
    assert economics["verdict"] != "unknown"


def test_economics_negative_greenspace_delta_is_not_worth_it():
    economics = compute_economics(
        "greenspace",
        {"park_count": 5, "avg_park_m2": 1500, "population": 9500},
        {
            "green_area_m2": 7500.0,
            "green_m2_per_capita": 0.79,
            "pct_within_300m": 50.83,
        },
        {
            "green_area_m2": 30000.0,
            "green_m2_per_capita": 3.0,
            "pct_within_300m": 77.08,
        },
    )
    assert economics["annual_benefit_eur"] < 0
    assert economics["benefit_cost_ratio"] < 0
    assert economics["verdict"] == "no"
    assert economics["benefit_breakdown"]
    assert "falls short of the baseline" in economics["summary"]["en"]


def test_economics_congestion_charge_has_cost_and_positive_value():
    economics = compute_economics(
        "traffic_sumo",
        {"intervention": "congestion_charge", "demand": 8000, "capacity": 6000},
        {
            "avg_travel_min": 12.0,
            "throughput_vph": 530.4,
            "queue_length_m": 0.0,
            "emissions_kg": 1.28,
            "noise_db": 56.8,
        },
        {
            "avg_travel_min": 12.6,
            "throughput_vph": 1216.7,
            "queue_length_m": 0.0,
            "emissions_kg": 1.344,
            "noise_db": 62.2,
        },
    )
    assert economics["capex_eur"] == 550000.0
    assert economics["cost_breakdown"][0]["label"]["en"] == "Congestion charging system"
    assert economics["annual_benefit_eur"] > 0
    assert economics["verdict"] == "yes"
    assert "worth it" in economics["summary"]["en"]


def test_economics_includes_new_building_tax_revenue():
    economics = compute_economics(
        "cost",
        {},
        {},
        None,
        budget_eur=100000,
        annual_tax_revenue_eur=64000,
        new_buildings=40,
    )
    assert economics["annual_tax_revenue_eur"] == 64000
    assert economics["new_buildings"] == 40
    assert economics["annual_benefit_eur"] >= 64000
    assert any(line["label"]["en"] == "Property tax from new buildings" for line in economics["benefit_breakdown"])
