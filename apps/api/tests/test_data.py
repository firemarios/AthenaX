"""Data module (01): sources + datasets."""
from __future__ import annotations


def test_list_sources_from_catalog(client):
    resp = client.get("/v1/sources")
    body = resp.json()
    assert resp.status_code == 200 and body["ok"] is True
    assert isinstance(body["data"], list) and body["data"]
    assert body["meta"]["total"] == len(body["data"])
    assert "name" in body["data"][0]


def test_source_detail_and_health(client, monkeypatch):
    source_id = client.get("/v1/sources").json()["data"][0]["id"]
    resp = client.get(f"/v1/sources/{source_id}")
    assert resp.status_code == 200
    assert resp.json()["data"]["id"] == source_id

    async def fake_health(source_id):
        return {"status": "ok", "latency_ms": 42, "checked_at": "2026-01-01T00:00:00+00:00"}

    monkeypatch.setattr("app.repositories.sources.check_health", fake_health)
    resp = client.post(f"/v1/sources/{source_id}/health")
    body = resp.json()
    assert resp.status_code == 200 and body["ok"] is True
    assert body["meta"]["health"]["status"] == "ok"


def test_datasets_list_envelope(client):
    resp = client.get("/v1/datasets", params={"page": 1, "page_size": 10})
    body = resp.json()
    assert resp.status_code == 200 and body["ok"] is True
    assert isinstance(body["data"], list)
    meta = body["meta"]
    assert meta["page"] == 1 and meta["page_size"] == 10
    assert isinstance(meta["total"], int)


def test_dataset_detail_404(client):
    resp = client.get("/v1/datasets/missing-id")
    assert resp.status_code == 404
    assert resp.json()["error"]["message"] == "Το dataset δεν βρέθηκε."


def test_dataset_versions(client, monkeypatch):
    async def fake_get(dataset_id):
        return {"id": dataset_id, "title": "τίτλος"}

    monkeypatch.setattr("app.repositories.datasets.get_dataset", fake_get)
    resp = client.get("/v1/datasets/ds-test-1/versions")
    body = resp.json()
    assert resp.status_code == 200 and body["ok"] is True
    assert isinstance(body["data"], list)


def test_dataset_quality_recompute(client, monkeypatch):
    dataset = {
        "id": "ds-test-1",
        "title": "Traffic counts Athens",
        "description": "Daily traffic counts",
        "provider": "OPENDATA",
        "license": "CC BY 4.0",
        "category": "mobility",
        "tags": ["traffic"],
        "last_updated": "2026-11-01T00:00:00+00:00",
        "original_source": {"url": "https://example.org/data"},
        "provenance": {"retrieved_at": "2026-11-02T00:00:00+00:00"},
        "quality": {},
        "resources": [],
        "related_ids": [],
    }

    async def fake_get(dataset_id):
        return dataset if dataset_id == "ds-test-1" else None

    async def fake_save(dataset_id, report):
        return dict(report, id="qr-1", dataset_id=dataset_id)

    monkeypatch.setattr("app.repositories.datasets.get_dataset", fake_get)
    monkeypatch.setattr("app.repositories.datasets.save_quality_report", fake_save)

    resp = client.post("/v1/datasets/ds-test-1/quality")
    body = resp.json()
    assert resp.status_code == 200 and body["ok"] is True
    report = body["data"]
    assert report["dataset_id"] == "ds-test-1"
    assert {"completeness", "freshness", "validity", "validation_status"} <= set(report)
    assert report["validation_status"] in {"valid", "warning", "invalid"}
