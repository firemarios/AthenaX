"""Curated Athens sources shared by Ask the City and the simulation planner."""
from __future__ import annotations

from typing import Any

ATHENS_SANDBOX_URL = "https://athensgov.cityofathens.gr/sandbox/"
ATHENS_SANDBOX_TITLE = "AthensGov Sandbox API — Δεδομένα & υπηρεσίες Δήμου Αθηναίων"
ATHENS_SANDBOX_PROVIDER = "Δήμος Αθηναίων"
ATHENS_SANDBOX_DESCRIPTION = (
    "Δοκιμαστικό API του Δήμου Αθηναίων με μητρώο 570 υπηρεσιών, εκδηλώσεις, "
    "σημεία ενδιαφέροντος (ΚΕΠ, βιβλιοθήκες, πάρκα), έργα, ραντεβού και "
    "αναζήτηση στον ιστότοπο. Endpoints: /v1/registry/services, /v1/events, "
    "/v1/pois, /v1/projects, /v1/search."
)


def sandbox_record() -> dict[str, Any]:
    """Ask-the-City record so the sandbox is always an allowed, cited source."""
    return {
        "title": ATHENS_SANDBOX_TITLE,
        "description": ATHENS_SANDBOX_DESCRIPTION,
        "description_limit": 700,
        "provider": ATHENS_SANDBOX_PROVIDER,
        "source_name": "athensgov.cityofathens.gr",
        "source_url": ATHENS_SANDBOX_URL,
        "category": "data_catalog",
        "tags": ["athens", "sandbox", "api", "υπηρεσίες", "δεδομένα"],
        "pinned": True,
    }


def sandbox_source() -> dict[str, Any]:
    """Simulation grounding source entry."""
    return {
        "name": "AthensGov Sandbox API",
        "provider": ATHENS_SANDBOX_PROVIDER,
        "url": ATHENS_SANDBOX_URL,
        "kind": "api",
        "license": "Δοκιμαστικά δεδομένα — Δήμος Αθηναίων",
    }
