"""Shared fixtures: deterministic DB-down fallbacks, no network, no repo side effects."""
from __future__ import annotations

import os
import tempfile

os.environ.setdefault(
    "ATHENAX_STORAGE_DIR", tempfile.mkdtemp(prefix="athenax-test-storage-")
)
# Tests must stay hermetic: never call the live Overpass API.
os.environ.setdefault("ATHENAX_SNAPSHOT_LIVE", "0")

import pytest
from fastapi.testclient import TestClient


class _FakeProvider:
    name = "fake"

    async def ping(self) -> bool:
        return True

    async def embed(self, text: str) -> list[float]:
        return [0.0] * 8


@pytest.fixture()
def client(monkeypatch):
    def _db_down(*_args, **_kwargs):
        raise RuntimeError("tests: database intentionally unavailable")

    monkeypatch.setattr("app.database.session_scope", _db_down)
    monkeypatch.setattr(
        "services.ai_engine.providers.get_provider",
        lambda *args, **kwargs: _FakeProvider(),
    )

    from app.ratelimit import limiter
    from app.repositories.admin import clear_audit_buffer
    from app.repositories.common import mem_clear

    mem_clear()
    clear_audit_buffer()
    limiter.reset()

    from app.main import app

    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client

    limiter.reset()
    mem_clear()
    clear_audit_buffer()
