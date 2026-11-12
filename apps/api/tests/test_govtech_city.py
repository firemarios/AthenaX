"""GovTech module (02) + City / Digital Twin module (04)."""
from __future__ import annotations


class _FakeConnector:
    def __init__(self, name: str, url: str, records: list[dict]):
        self.name = name
        self.source_url = url
        self._records = records

    async def search(self, query=None, limit=30):
        return list(self._records)


def _patch_connectors(monkeypatch, mapping):
    def fake_make(name):
        return mapping.get(name)

    monkeypatch.setattr("app.repositories.sources.make_connector", fake_make)


def test_decisions_live_search(client, monkeypatch):
    records = [
        {
            "title": "Άδεια λειτουργίας κέντρου",
            "provider": "Δήμος Αθηναίων",
            "source_url": "https://diavgeia.gov.gr/doc/1",
            "published_at": "2024-05-01",
            "category": "decision",
            "extra": {"id": "1", "date": "2024-05-01"},
        },
        {
            "title": "Προμήθεια οχημάτων",
            "provider": "ΟΡΣΕΣ",
            "source_url": "https://diavgeia.gov.gr/doc/2",
            "published_at": "2024-06-01",
            "category": "decision",
            "extra": {"id": "2", "date": "2024-06-01"},
        },
    ]
    _patch_connectors(
        monkeypatch, {"diavgeia": _FakeConnector("diavgeia", "https://diavgeia.gov.gr", records)}
    )

    resp = client.get("/v1/decisions")
    body = resp.json()
    assert resp.status_code == 200 and body["ok"] is True
    assert len(body["data"]) == 2
    assert body["meta"]["total"] == 2

    resp = client.get("/v1/decisions/1")
    assert resp.status_code == 200
    assert resp.json()["data"]["title"] == "Άδεια λειτουργίας κέντρου"

    assert client.get("/v1/decisions/missing").status_code == 404


def test_projects_tracker(client, monkeypatch):
    records = [
        {
            "title": "Αναβάθμιση πάρκου Εξαρχείων",
            "provider": "Δήμος Αθηναίων",
            "source_url": "https://example.org/projects/p1",
            "category": "planning",
            "extra": {
                "id": "p1",
                "status": "in_progress",
                "geometry": {"type": "Point", "coordinates": [23.73, 37.98]},
            },
        }
    ]
    _patch_connectors(
        monkeypatch,
        {
            "kimdis": _FakeConnector("kimdis", "https://kimdis.gov.gr", records),
            "athens": _FakeConnector("athens", "https://cityofathens.gr", []),
        },
    )

    resp = client.get("/v1/projects")
    body = resp.json()
    assert resp.status_code == 200 and body["ok"] is True
    assert body["data"][0]["id"] == "p1"

    resp = client.get("/v1/projects/p1")
    detail = resp.json()["data"]
    assert detail["name"] == "Αναβάθμιση πάρκου Εξαρχείων"
    assert detail["decisions"] == []

    resp = client.get("/v1/projects", params={"bbox": "bad"})
    assert resp.status_code == 400
    assert "bbox" in resp.json()["error"]["message"]

    assert client.get("/v1/projects/missing").status_code == 404


def test_city_layers_registry(client):
    from services.geospatial_engine.layers import LAYER_REGISTRY

    resp = client.get("/v1/city/layers")
    body = resp.json()
    assert resp.status_code == 200 and body["ok"] is True
    assert {item["id"] for item in body["data"]} == set(LAYER_REGISTRY)
    for item in body["data"]:
        assert isinstance(item["feature_count"], int)
        assert "geometry_type" in item
        assert "title" in item


def test_city_features_collection(client):
    from services.geospatial_engine.layers import LAYER_REGISTRY

    layer_id = next(iter(LAYER_REGISTRY))
    resp = client.get("/v1/city/features", params={"layer": layer_id, "limit": 10})
    body = resp.json()
    assert resp.status_code == 200 and body["ok"] is True
    assert body["data"]["type"] == "FeatureCollection"
    assert isinstance(body["data"]["features"], list)


def test_city_features_unknown_layer_400(client):
    resp = client.get("/v1/city/features", params={"layer": "not-a-layer"})
    assert resp.status_code == 400
    assert "layer" in resp.json()["error"]["message"]


def test_city_features_invalid_bbox_400(client):
    from services.geospatial_engine.layers import LAYER_REGISTRY

    layer_id = next(iter(LAYER_REGISTRY))
    resp = client.get("/v1/city/features", params={"layer": layer_id, "bbox": "oops"})
    assert resp.status_code == 400
    assert "bbox" in resp.json()["error"]["message"]


def test_city_areas(client):
    resp = client.get("/v1/city/areas")
    body = resp.json()
    assert resp.status_code == 200 and body["ok"] is True
    assert isinstance(body["data"], list)
