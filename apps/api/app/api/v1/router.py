"""v1 router aggregation + ROUTE_CATALOG (contracts §2 endpoint checklist).

ROUTE_CATALOG is the single source of truth for:
- seeding the api_registry table (app.repositories.seed)
- GET /v1/developers/info → endpoints_count
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.api.v1 import (
    admin,
    ai,
    city,
    citizen,
    datasets,
    decisions,
    developers,
    impact,
    models,
    policies,
    projects,
    research,
    simulations,
    sources,
)

api_router = APIRouter()

# order matters only for docs grouping; each path is unique
api_router.include_router(sources.router, tags=["Data"])
api_router.include_router(datasets.router, tags=["Data"])
api_router.include_router(decisions.router, tags=["GovTech"])
api_router.include_router(projects.router, tags=["GovTech"])
api_router.include_router(city.router, tags=["City"])
api_router.include_router(ai.router, tags=["AI"])
api_router.include_router(models.router, tags=["Policy"])
api_router.include_router(policies.router, tags=["Policy"])
api_router.include_router(simulations.router, tags=["Policy"])
api_router.include_router(impact.router, tags=["Policy"])
api_router.include_router(citizen.router, tags=["Citizen"])
api_router.include_router(research.router, tags=["Research"])
api_router.include_router(developers.router, tags=["Developers"])
api_router.include_router(admin.router, tags=["Admin"])

ROUTE_CATALOG: list[dict[str, Any]] = [
    # Data (01)
    {"group": "Data (01)", "method": "GET", "path": "/v1/sources", "summary": "Πηγές δεδομένων"},
    {"group": "Data (01)", "method": "GET", "path": "/v1/sources/{id}", "summary": "Λεπτομέρεια πηγής"},
    {"group": "Data (01)", "method": "POST", "path": "/v1/sources/{id}/health", "summary": "Έλεγχος υγείας πηγής"},
    {"group": "Data (01)", "method": "GET", "path": "/v1/datasets", "summary": "Κατάλογος datasets"},
    {"group": "Data (01)", "method": "GET", "path": "/v1/datasets/{id}", "summary": "Λεπτομέρεια dataset"},
    {"group": "Data (01)", "method": "GET", "path": "/v1/datasets/{id}/versions", "summary": "Εκδόσεις dataset"},
    {"group": "Data (01)", "method": "POST", "path": "/v1/datasets/{id}/quality", "summary": "Υπολογισμός ποιότητας"},
    # GovTech (02)
    {"group": "GovTech (02)", "method": "GET", "path": "/v1/decisions", "summary": "Δημόσιες αποφάσεις"},
    {"group": "GovTech (02)", "method": "GET", "path": "/v1/decisions/{id}", "summary": "Λεπτομέρεια απόφασης"},
    {"group": "GovTech (02)", "method": "GET", "path": "/v1/projects", "summary": "Public Project Tracker"},
    {"group": "GovTech (02)", "method": "GET", "path": "/v1/projects/{id}", "summary": "Έργο + χρονολόγιο αποφάσεων"},
    # City (04)
    {"group": "City (04)", "method": "GET", "path": "/v1/city/layers", "summary": "Layers ψηφιακής δίδυμης πόλης"},
    {"group": "City (04)", "method": "GET", "path": "/v1/city/features", "summary": "Features GeoJSON"},
    {"group": "City (04)", "method": "GET", "path": "/v1/city/areas", "summary": "Ορισμένες περιοχές παρέμβασης"},
    # AI (03)
    {"group": "AI (03)", "method": "POST", "path": "/v1/ai/query", "summary": "Ask the City"},
    {"group": "AI (03)", "method": "POST", "path": "/v1/ai/chat", "summary": "Alias του /v1/ai/query"},
    {"group": "AI (03)", "method": "POST", "path": "/v1/ai/query/stream", "summary": "Ask the City (SSE streaming)"},
    # Policy/Sim (05/06/08)
    {"group": "Policy (05)", "method": "GET", "path": "/v1/models", "summary": "Μοντέλα προσομοίωσης"},
    {"group": "Policy (05)", "method": "GET", "path": "/v1/policies", "summary": "Λίστα πολιτικών"},
    {"group": "Policy (05)", "method": "GET", "path": "/v1/policies/{id}", "summary": "Λεπτομέρεια πολιτικής"},
    {"group": "Policy (05)", "method": "POST", "path": "/v1/policies", "summary": "Δημιουργία πολιτικής"},
    {"group": "Policy (05)", "method": "POST", "path": "/v1/policies/{id}/variants", "summary": "Παραλλαγή πολιτικής"},
    {"group": "Policy (06)", "method": "GET", "path": "/v1/simulations", "summary": "Λίστα προσομοιώσεων"},
    {"group": "Policy (06)", "method": "GET", "path": "/v1/simulations/{id}", "summary": "Λεπτομέρεια προσομοίωσης"},
    {"group": "Policy (06)", "method": "POST", "path": "/v1/simulations", "summary": "Εκτέλεση προσομοίωσης"},
    {"group": "Policy (08)", "method": "GET", "path": "/v1/impact/{run_id}", "summary": "ImpactReport 6 διαστάσεων"},
    # Citizen (07)
    {"group": "Citizen (07)", "method": "GET", "path": "/v1/consultations", "summary": "Λίστα διαβουλεύσεων"},
    {"group": "Citizen (07)", "method": "POST", "path": "/v1/consultations", "summary": "Δημιουργία διαβούλευσης"},
    {"group": "Citizen (07)", "method": "GET", "path": "/v1/consultations/{id}", "summary": "Λεπτομέρεια διαβούλευσης"},
    {"group": "Citizen (07)", "method": "GET", "path": "/v1/proposals", "summary": "Λίστα προτάσεων"},
    {"group": "Citizen (07)", "method": "POST", "path": "/v1/proposals", "summary": "Νέα πρόταση"},
    {"group": "Citizen (07)", "method": "GET", "path": "/v1/proposals/{id}", "summary": "Λεπτομέρεια πρότασης"},
    {"group": "Citizen (07)", "method": "GET", "path": "/v1/proposals/{id}/comments", "summary": "Σχόλια πρότασης"},
    {"group": "Citizen (07)", "method": "POST", "path": "/v1/proposals/{id}/comments", "summary": "Νέο σχόλιο"},
    # Research (09)
    {"group": "Research (09)", "method": "GET", "path": "/v1/research/projects", "summary": "Ερευνητικά έργα"},
    {"group": "Research (09)", "method": "POST", "path": "/v1/research/projects", "summary": "Νέο ερευνητικό έργο"},
    {"group": "Research (09)", "method": "GET", "path": "/v1/research/projects/{id}", "summary": "Λεπτομέρεια έργου"},
    {"group": "Research (09)", "method": "GET", "path": "/v1/research/projects/{id}/export", "summary": "Εξαγωγή md/csv/json"},
    # Developer (10)
    {"group": "Developer (10)", "method": "GET", "path": "/v1/developers/examples", "summary": "Παραδείγματα κώδικα"},
    {"group": "Developer (10)", "method": "GET", "path": "/v1/developers/info", "summary": "Πληροφορίες API"},
    # Admin
    {"group": "Admin", "method": "GET", "path": "/v1/admin/flags", "summary": "Feature flags"},
    {"group": "Admin", "method": "PATCH", "path": "/v1/admin/flags/{name}", "summary": "Ενημέρωση flag"},
    {"group": "Admin", "method": "GET", "path": "/v1/admin/connectors", "summary": "Μητρώο συνθετών"},
    {"group": "Admin", "method": "PATCH", "path": "/v1/admin/connectors/{name}", "summary": "Ενημέρωση συνθέτη"},
    {"group": "Admin", "method": "GET", "path": "/v1/admin/audit", "summary": "Αρχείο audit"},
    {"group": "Admin", "method": "POST", "path": "/v1/admin/ingest", "summary": "Εκκίνηση εισαγωγής δεδομένων"},
]
