"""Developer module (10): GET /v1/developers/examples + /info."""
from __future__ import annotations

from app.config import API_VERSION, get_settings
from app.deps import get_request_id
from app.envelope import build_meta, ok
from app.repositories.sources import catalog_sources
from fastapi import APIRouter, Request

router = APIRouter()

EXAMPLES: list[dict[str, str]] = [
    {
        "language": "curl",
        "title": "Πηγές δεδομένων",
        "endpoint": "GET /v1/sources",
        "code": 'curl -s "$API_URL/v1/sources" | jq',
    },
    {
        "language": "python",
        "title": "Αναζήτηση datasets",
        "endpoint": "GET /v1/datasets",
        "code": (
            "import httpx\n"
            "r = httpx.get('http://localhost:8000/v1/datasets',"
            " params={'q': 'traffic', 'page_size': 10})\n"
            "print(r.json()['meta'], r.json()['data'][:3])"
        ),
    },
    {
        "language": "python",
        "title": "Ask the City (AI)",
        "endpoint": "POST /v1/ai/query",
        "code": (
            "import httpx\n"
            "r = httpx.post('http://localhost:8000/v1/ai/query',"
            " json={'question': 'Πώς είναι ο καιρός στην Αθήνα;'})\n"
            "print(r.json()['data']['summary'])"
        ),
    },
    {
        "language": "javascript",
        "title": "Προσομοίωση πολιτικής",
        "endpoint": "POST /v1/simulations",
        "code": (
            "const r = await fetch('http://localhost:8000/v1/simulations', {\n"
            "  method: 'POST',\n"
            "  headers: {'Content-Type': 'application/json'},\n"
            "  body: JSON.stringify({model: 'green_investment', parameters: {}}),\n"
            "});\n"
            "const {data} = await r.json();"
        ),
    },
    {
        "language": "javascript",
        "title": "Χάρτης πόλης (GeoJSON)",
        "endpoint": "GET /v1/city/features",
        "code": (
            "const r = await fetch(\n"
            "  'http://localhost:8000/v1/city/features?layer=buildings&limit=100'\n"
            ");\n"
            "const {data} = await r.json();\n"
            "console.log(data.features.length);"
        ),
    },
]


@router.get("/developers/examples")
async def developer_examples(request: Request):
    """Example[] — ready-to-copy snippets for the /developers page (contract §2)."""
    return ok(EXAMPLES, build_meta(get_request_id(request), total=len(EXAMPLES)))


@router.get("/developers/info")
async def developer_info(request: Request):
    """API info block: openapi_url, version, rate_limit, license, contact, endpoints_count."""
    settings = get_settings()
    from app.api.v1.router import ROUTE_CATALOG

    info = {
        "openapi_url": "/openapi.json",
        "version": API_VERSION,
        "rate_limit": settings.rate_limit_per_minute,
        "license": "CC BY-NC-SA 4.0",
        "contact": {"name": "POLICYLAB", "url": settings.api_base_url, "email": ""},
        "endpoints_count": len(ROUTE_CATALOG),
        "sources_count": len(catalog_sources()),
        "llm_provider": settings.llm_provider,
        "llm_model": settings.llm_model,
    }
    return ok(info, build_meta(get_request_id(request)))
