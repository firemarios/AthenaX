"""Citizen Lab (07) + Research (09) + Admin modules."""
from __future__ import annotations

import asyncio
import json

from services.ai_engine import proposal_evaluator


def test_consultation_flow(client):
    created = client.post(
        "/v1/consultations", json={"title": "Αναβάθμιση κέντρου", "description": "δοκιμή"}
    )
    assert created.status_code == 201
    item = created.json()["data"]
    assert item["id"]

    detail = client.get(f"/v1/consultations/{item['id']}")
    assert detail.status_code == 200

    listed = client.get("/v1/consultations").json()
    assert any(row["id"] == item["id"] for row in listed["data"])

    assert client.get("/v1/consultations/unknown").status_code == 404


def test_proposal_and_comments(client):
    proposal = client.post(
        "/v1/proposals", json={"title": "Πεζόδρομος", "area": "Εξάρχεια"}
    ).json()["data"]
    assert proposal["id"]

    comment = client.post(
        f"/v1/proposals/{proposal['id']}/comments", json={"body": "Συμφωνώ!"}
    )
    assert comment.status_code == 201

    comments = client.get(f"/v1/proposals/{proposal['id']}/comments").json()
    assert comments["ok"] is True
    assert comments["data"], comments
    assert comments["data"][0]["body"] == "Συμφωνώ!"

    assert client.get("/v1/proposals/unknown").status_code == 404


def test_delete_consultation(client):
    consultation = client.post(
        "/v1/consultations", json={"title": "Προς διαγραφή", "description": "δοκιμή"}
    ).json()["data"]

    deleted = client.delete(f"/v1/consultations/{consultation['id']}")
    assert deleted.status_code == 200
    assert deleted.json()["data"] == {"id": consultation["id"], "deleted": True}

    assert client.get(f"/v1/consultations/{consultation['id']}").status_code == 404
    assert client.delete(f"/v1/consultations/{consultation['id']}").status_code == 404
    assert client.delete("/v1/consultations/missing").status_code == 404


def test_delete_proposal_comment_and_proposal(client):
    proposal = client.post(
        "/v1/proposals", json={"title": "Προς διαγραφή", "description": "δοκιμή"}
    ).json()["data"]
    comment = client.post(
        f"/v1/proposals/{proposal['id']}/comments", json={"body": "προς διαγραφή"}
    ).json()["data"]

    deleted_comment = client.delete(
        f"/v1/proposals/{proposal['id']}/comments/{comment['id']}"
    )
    assert deleted_comment.status_code == 200
    assert deleted_comment.json()["data"]["deleted"] is True
    comments = client.get(f"/v1/proposals/{proposal['id']}/comments").json()["data"]
    assert all(row["id"] != comment["id"] for row in comments)
    assert (
        client.delete(f"/v1/proposals/{proposal['id']}/comments/{comment['id']}").status_code
        == 404
    )

    assert client.delete(f"/v1/proposals/{proposal['id']}").status_code == 200
    assert client.get(f"/v1/proposals/{proposal['id']}").status_code == 404
    assert client.delete(f"/v1/proposals/{proposal['id']}").status_code == 404


def test_delete_research_project(client):
    project = client.post(
        "/v1/research/projects", json={"name": "Προς διαγραφή", "description": "δοκιμή"}
    ).json()["data"]

    assert client.delete(f"/v1/research/projects/{project['id']}").status_code == 200
    assert client.get(f"/v1/research/projects/{project['id']}").status_code == 404
    assert client.delete(f"/v1/research/projects/{project['id']}").status_code == 404


def test_validation_greek_missing_title(client):
    resp = client.post("/v1/consultations", json={})
    assert resp.status_code == 422
    details = resp.json()["error"]["details"]
    assert details[0]["field"] == "title"
    assert "υποχρεωτικό" in details[0]["message"]


def test_research_project_export(client):
    created = client.post(
        "/v1/research/projects", json={"name": "Έρευνα Πράσινου", "description": "δοκιμή"}
    )
    assert created.status_code == 201
    project = created.json()["data"]

    md = client.get(
        f"/v1/research/projects/{project['id']}/export", params={"format": "md"}
    )
    assert md.status_code == 200
    assert "text/markdown" in md.headers["content-type"]
    assert "attachment" in md.headers["content-disposition"]
    assert "Έρευνα Πράσινου" in md.text

    csv = client.get(
        f"/v1/research/projects/{project['id']}/export", params={"format": "csv"}
    )
    assert csv.status_code == 200
    assert "text/csv" in csv.headers["content-type"]

    js = client.get(
        f"/v1/research/projects/{project['id']}/export", params={"format": "json"}
    )
    assert js.status_code == 200
    assert js.json()["project"]["name"] == "Έρευνα Πράσινου"

    bad = client.get(
        f"/v1/research/projects/{project['id']}/export", params={"format": "xml"}
    )
    assert bad.status_code == 400
    assert "format" in bad.json()["error"]["message"]

    assert client.get("/v1/research/projects/missing").status_code == 404


def test_flags_lifecycle(client):
    listed = client.get("/v1/admin/flags")
    body = listed.json()
    assert listed.status_code == 200 and body["ok"] is True
    assert any(flag["name"] == "ai_enabled" for flag in body["data"])

    patched = client.patch("/v1/admin/flags/ai_enabled", json={"enabled": False})
    assert patched.status_code == 200
    assert patched.json()["data"]["enabled"] is False

    missing = client.patch("/v1/admin/flags/nope", json={"enabled": True})
    assert missing.status_code == 404


def test_connectors_registry(client):
    listed = client.get("/v1/admin/connectors")
    body = listed.json()
    assert listed.status_code == 200 and body["ok"] is True
    assert body["data"], body
    name = body["data"][0]["name"]

    patched = client.patch(f"/v1/admin/connectors/{name}", json={"enabled": False})
    assert patched.status_code == 200
    assert patched.json()["data"]["enabled"] is False

    empty = client.patch(f"/v1/admin/connectors/{name}", json={})
    assert empty.status_code == 422

    missing = client.patch("/v1/admin/connectors/nope", json={"enabled": True})
    assert missing.status_code == 404


def test_admin_ingest(client, monkeypatch):
    async def fake_ingest(connector, *, query=None, limit=50, store=None, persist=None):
        return {"ingested": 7, "skipped": 3, "errors": 0}

    monkeypatch.setattr("app.api.v1.admin.ingest", fake_ingest)
    resp = client.post("/v1/admin/ingest", json={"source": "diavgeia"})
    body = resp.json()
    assert resp.status_code == 200 and body["ok"] is True
    assert body["data"] == {"ingested": 7, "skipped": 3, "errors": 0}
    assert body["meta"]["source"] == "diavgeia"

    unknown = client.post("/v1/admin/ingest", json={"source": "nope"})
    assert unknown.status_code == 404


def test_proposal_evaluator_uses_ai_json():
    class _Provider:
        async def chat(self, messages, *, temperature=0.3, max_tokens=2048):
            return json.dumps(
                {
                    "score": 82,
                    "verdict": "strong",
                    "summary": {"el": "Καλή πρόταση", "en": "Good proposal"},
                    "criteria": [
                        {"key": "clarity", "score": 90, "note": {"el": "Σαφής", "en": "Clear"}},
                        {"key": "feasibility", "score": 80, "note": {"el": "Εφικτή", "en": "Feasible"}},
                        {"key": "impact", "score": 75, "note": {"el": "Θετικός", "en": "Positive"}},
                        {"key": "equity", "score": 85, "note": {"el": "Δίκαιη", "en": "Fair"}},
                        {"key": "cost", "score": 70, "note": {"el": "Λογικό", "en": "Reasonable"}},
                    ],
                    "strengths": [{"el": "Σαφής στόχος", "en": "Clear goal"}],
                    "risks": [{"el": "Κόστος", "en": "Cost"}],
                    "suggestions": [{"el": "Χρονοδιάγραμμα", "en": "Timeline"}],
                }
            )

    evaluation = asyncio.run(
        proposal_evaluator.evaluate_proposal(
            {
                "title": "Νέα πεζοδρόμια στην Κυψέλη",
                "description": "Κατασκευή νέων πεζοδρομίων μήκους 800 μέτρων με φωτισμό.",
                "area": "Κυψέλη",
                "category": "mobility",
            },
            provider=_Provider(),
        )
    )
    assert evaluation["ai_used"] is True
    assert evaluation["score"] == 82
    assert evaluation["verdict"] == "strong"
    assert evaluation["summary"]["en"] == "Good proposal"
    assert [entry["key"] for entry in evaluation["criteria"]] == [
        "clarity",
        "feasibility",
        "impact",
        "equity",
        "cost",
    ]
    assert evaluation["strengths"][0]["en"] == "Clear goal"
    assert evaluation["risks"][0]["en"] == "Cost"
    assert evaluation["suggestions"][0]["en"] == "Timeline"


def test_proposal_ai_evaluation_endpoint_falls_back_without_llm(client, monkeypatch):
    class _BrokenProvider:
        async def chat(self, *args, **kwargs):
            raise RuntimeError("llm down")

    monkeypatch.setattr(
        proposal_evaluator, "get_provider", lambda settings=None: _BrokenProvider()
    )

    proposal = client.post(
        "/v1/proposals",
        json={
            "title": "Περισσότερα δέντρα στο Κολωνάκι",
            "description": "Φύτευση 50 δέντρων στα πεζοδρόμια της γειτονιάς.",
            "area": "Κολωνάκι",
            "category": "green",
        },
    ).json()["data"]

    resp = client.post(f"/v1/proposals/{proposal['id']}/evaluate")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["ai_used"] is False
    assert 0 <= data["score"] <= 100
    assert data["verdict"] in {"strong", "promising", "needs_work", "unclear"}
    assert len(data["criteria"]) == 5
    assert data["summary"]["en"]

    assert client.post("/v1/proposals/missing/evaluate").status_code == 404
