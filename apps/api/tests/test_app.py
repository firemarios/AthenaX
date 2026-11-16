"""Envelope, error handling, health, OpenAPI catalog, rate limit, audit."""
from __future__ import annotations


def test_root_envelope(client):
    resp = client.get("/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True and body["error"] is None
    assert body["data"]["name"] == "POLICYLAB"
    assert body["data"]["endpoints"] == 52
    assert body["meta"]["request_id"]


def test_health_components(client):
    resp = client.get("/health")
    body = resp.json()
    assert resp.status_code == 200 and body["ok"] is True
    data = body["data"]
    for key in ("db", "llm", "storage", "rate_limiter"):
        assert data[key] in {"ok", "degraded", "down", "disabled"}
    assert data["llm"] == "ok"
    assert data["storage"] == "ok"
    assert data["status"] in {"ok", "degraded"}


def test_request_id_header_echoed(client):
    resp = client.get("/v1/models", headers={"X-Request-ID": "rid-42"})
    assert resp.json()["meta"]["request_id"] == "rid-42"


def test_404_greek_envelope(client):
    resp = client.get("/v1/sources/nope")
    assert resp.status_code == 404
    body = resp.json()
    assert body["ok"] is False and body["data"] is None and body["meta"] is None
    assert body["error"]["code"] == 404
    assert body["error"]["message"] == "Η πηγή δεν βρέθηκε."


def test_validation_422_greek_details(client):
    resp = client.post("/v1/ai/query", json={})
    assert resp.status_code == 422
    body = resp.json()
    assert body["ok"] is False
    assert body["error"]["code"] == 422
    details = body["error"]["details"]
    assert details[0]["field"] == "question"
    assert "υποχρεωτικό" in details[0]["message"]


def test_unhandled_exception_500_envelope(client, monkeypatch):
    def _boom():
        raise RuntimeError("προβληματικό μοντέλο")

    monkeypatch.setattr("app.api.v1.models.list_models", _boom)
    resp = client.get("/v1/models")
    assert resp.status_code == 500
    body = resp.json()
    assert body["ok"] is False
    assert body["error"]["message"] == "Εσωτερικό σφάλμα διακομιστή"


def test_openapi_matches_contract_catalog(client):
    from app.api.v1.router import ROUTE_CATALOG

    spec = client.get("/openapi.json").json()
    paths = spec["paths"]
    catalog_paths = {entry["path"] for entry in ROUTE_CATALOG}
    assert catalog_paths == {path for path in paths if path.startswith("/v1/")}
    for entry in ROUTE_CATALOG:
        assert entry["method"].lower() in paths[entry["path"]]
    assert len(ROUTE_CATALOG) == 52


def test_rate_limit_429(client, monkeypatch):
    from app.config import Settings

    monkeypatch.setattr(
        "app.ratelimit.get_settings", lambda: Settings(rate_limit_per_minute=2)
    )
    assert client.get("/").status_code == 200
    assert client.get("/").status_code == 200
    resp = client.get("/")
    assert resp.status_code == 429
    body = resp.json()
    assert body["ok"] is False
    assert body["error"]["message"] == "Πολλά αιτήματα. Δοκιμάστε ξανά σύντομα."


def test_audit_records_requests(client):
    client.get("/v1/models", headers={"X-Request-ID": "audit-rid-1"})
    resp = client.get("/v1/admin/audit")
    body = resp.json()
    assert resp.status_code == 200 and body["ok"] is True
    rows = body["data"]
    match = [row for row in rows if row.get("path") == "/v1/models"]
    assert match, rows
    assert match[0]["request_id"] == "audit-rid-1"
    assert match[0]["method"] == "GET"
