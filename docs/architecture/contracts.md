# AthenaX — Shared Build Contracts (v1)

**This document is the single source of truth for all parallel build agents.**
Every agent MUST implement exactly these interfaces. If you believe a contract is wrong,
note it in your final report instead of silently deviating.

Repo root: `C:\MyApps\Sites\athenax-v2 - Copy`

---

## 0. Ownership matrix (write ONLY inside your paths)

| Agent | Owns (exclusive write access) |
|---|---|
| **A services** | `services/**`, `data/source-registry/**` |
| **B backend** | `apps/api/**`, `infrastructure/database/**` |
| **C infra-docs** | `docker-compose.yml`, `infrastructure/**` (except `database/`), `docs/**` (except `architecture/contracts.md`), `README.md`, `LICENSE`, `CONTRIBUTING.md`, `research/**` |
| **D frontend-core** | `apps/web/app/{layout.tsx,page.tsx,globals.css,admin/**,developers/**,components/**,providers/**,lib/**}`, `packages/**` |
| **E frontend-modules** | `apps/web/app/{data/**,govtech/**,ask/**,city/**,policies/**,simulations/**,citizen/**,impact/**,research/**,_shared/**}` |

NEVER edit files owned by another agent. NEVER run `git commit`. NEVER run `npm install`
(dependencies are already installed: next 16.4.6, react 19, maplibre-gl, cesium, lucide-react,
clsx, tailwind-merge, tailwindcss v4, @tailwindcss/turbopack). Python deps already installed:
fastapi, uvicorn, sqlalchemy, asyncpg, psycopg, alembic, geoalchemy2, httpx, tenacity,
pydantic, pydantic-settings, pytest, ruff. **No new dependencies** (no pip, no npm).

Windows + PowerShell environment: `npm.cmd`, `python`.

---

## 1. Cross-cutting conventions

- **Language**: all user-facing strings Greek (primary) with English available. Backend error
  messages in Greek. Code/identifiers in English.
- **No auth.** No API keys, no logins, no user accounts. Protection = per-IP in-memory rate
  limiting (120 req/min default) + input validation + audit logging.
- **Response envelope** for EVERY HTTP endpoint (200, 4xx, 5xx):

```json
{ "ok": true,  "data": <T|null>, "meta": {"request_id": "...", "timestamp": "...", ...}|null, "error": null }
{ "ok": false, "data": null, "meta": null, "error": {"code": 422, "message": "Μη έγκυρη είσοδος", "details": [{"field":"q","message":"..."}]} }
```

- **Env prefix**: `ATHENAX_` (see `.env.example` at repo root). Settings class uses
  `env_prefix="ATHENAX_"` AND also accepts unprefixed names for backwards compat is NOT required —
  use prefix only, but list fields WITHOUT prefix in code (`database_url` ← `ATHENAX_DATABASE_URL`).
- **Optional deps** (redis, minio/prefect NOT installed): import lazily inside try/except and
  degrade gracefully (in-memory / local disk fallback).
- **CORS**: allow `http://localhost:3000`.
- **Python import roots** (pytest `pythonpath = [".", "apps/api"]`):
  - backend code: `from app.... import ...` (package = `apps/api/app`)
  - services code: `from services.<pkg>... import ...` (package = `services/`)
- **HTTP client**: `httpx` with `tenacity` retries (3 attempts, exp backoff) in connectors/providers.
- **No arbitrary SQL from AI input** — only whitelisted read-only query builders (see §5.4).

---

## 2. Endpoint catalog (backend `apps/api`, prefix `/v1`)

All return the envelope. `GET /` → `{name, version, status}`; `GET /health` →
`{db, llm, storage, rate_limiter}` (each `ok|degraded|down|disabled`).
FastAPI serves `/openapi.json` and `/docs` (public).

### Data (Module 01)
| Endpoint | Request | data payload |
|---|---|---|
| `GET /v1/sources` | `?type=&status=` | `Source[]` + `meta.total` |
| `GET /v1/sources/{id}` | | `Source` |
| `POST /v1/sources/{id}/health` | | `Source` (runs live check, updates status) |
| `GET /v1/datasets` | `?q=&source_id=&tag=&page=1&page_size=20&sort=freshness` | `Dataset[]` + `meta.total,page,page_size` |
| `GET /v1/datasets/{id}` | | `Dataset` (incl. quality, provenance, resources, related ids) |
| `GET /v1/datasets/{id}/versions` | | `DatasetVersion[]` |
| `POST /v1/datasets/{id}/quality` | | `QualityReport` (recompute score) |

### GovTech (Module 02)
| `GET /v1/decisions` | `?q=&org=&date_from=&date_to=&page=` | `Decision[]` |
| `GET /v1/decisions/{id}` | | `Decision` |
| `GET /v1/projects` | `?q=&status=&bbox=` | `Project[]` (Public Project Tracker) |
| `GET /v1/projects/{id}` | | `Project` incl. linked decisions timeline |

### City / Digital Twin (Module 04)
| `GET /v1/city/layers` | | `CityLayer[]` (id, title_el/en, geometry_type, source, feature_count) |
| `GET /v1/city/features` | `?layer=buildings&bbox=w,s,e,n&limit=500` | `FeatureCollection` (GeoJSON) |
| `GET /v1/city/areas` | | `Area[]` (named intervention areas for policy lab) |

### AI (Module 03)
| `POST /v1/ai/query` | `{question: str(1..2000), city?: str}` | `AIAnswer` (see §3) + `meta.sources, meta.limitations, meta.record_count, meta.ui` |
| `POST /v1/ai/chat` | same | alias of `/v1/ai/query` |

`meta.ui = {show_map: bool, empty_state: bool, suggested_actions: string[], alert: string|null}`

### Policy (Modules 05/06/08)
| `GET /v1/models` | | `ModelSpec[]` (name, version, category, description, parameters[]) |
| `GET /v1/policies` / `GET /v1/policies/{id}` | | `Policy` / `Policy[]` |
| `POST /v1/policies` | `{title, description?, category, area, horizon?, parameters?, assumptions?, kpis?}` | `Policy` (201) |
| `POST /v1/policies/{id}/variants` | `{title, parameters}` | `PolicyVariant` |
| `GET /v1/simulations` / `GET /v1/simulations/{id}` | `?policy_id=` | `SimulationRun` / list |
| `POST /v1/simulations` | `{model: str, parameters: dict, policy_id?: uuid, area?: str, compare_baseline?: bool}` | `SimulationRun` (executes synchronously for local models; `status: succeeded|failed`) |
| `GET /v1/impact/{run_id}` | | `ImpactReport` (6 dimensions) |

### Citizen Lab (Module 07)
| `GET/POST /v1/consultations`, `GET /v1/consultations/{id}` | | `Consultation` |
| `GET/POST /v1/proposals`, `GET /v1/proposals/{id}` | POST `{title, description, area?, category?}` | `Proposal` |
| `GET/POST /v1/proposals/{id}/comments` | POST `{body}` | `Comment` |

### Research (Module 09)
| `GET/POST /v1/research/projects`, `GET /v1/research/projects/{id}` | | `ResearchProject` |
| `GET /v1/research/projects/{id}/export?format=md\|csv\|json` | | file (text/csv, markdown, json) with provenance section |

### Developer (Module 10)
| `GET /v1/developers/examples` | | `Example[]` (`{language, title, code, endpoint}`) |
| `GET /v1/developers/info` | | `{openapi_url, version, rate_limit, license, contact, endpoints_count}` |

### Admin (route `/admin` in web)
| `GET /v1/admin/flags` / `PATCH /v1/admin/flags/{name}` | | `FeatureFlag` |
| `GET /v1/admin/connectors` / `PATCH /v1/admin/connectors/{name}` | | registry entries (enable/disable, endpoint_url) |
| `GET /v1/admin/audit` | `?page=` | `AuditLog[]` |
| `POST /v1/admin/ingest` | `{source: str}` | `{ingested, skipped, errors}` — triggers one connector → DB sync |

---

## 3. Core TS types (`packages/types/src/index.ts` — agent D)

```ts
export type Lang = "el" | "en";
export interface ApiError { code: number; message: string; details?: { field: string; message: string }[] }
export interface Envelope<T> { ok: boolean; data: T | null; meta: Meta | null; error: ApiError | null }
export interface Meta { request_id?: string; timestamp?: string; total?: number; page?: number;
  page_size?: number; sources?: string[]; limitations?: string[]; record_count?: number;
  ui?: { show_map?: boolean; empty_state?: boolean; suggested_actions?: string[]; alert?: string | null };
  [k: string]: unknown }

export interface Quality { completeness: number | null; freshness: number | null;
  validity: number | null; validation_status: "pending" | "valid" | "invalid" | "warning" }
export interface Provenance { source_version: string | null; retrieved_at: string | null; checksum?: string | null }
export interface Dataset {
  id: string; title: string; description: string | null; provider: string | null;
  original_source: { name: string; url: string }; format: string | null;
  geographic_scope: string | null; category: string | null; license: string | null;
  last_updated: string | null; tags: string[]; quality: Quality; provenance: Provenance;
  resources: { title: string; url: string; format: string; size_bytes: number | null }[];
  related_ids: string[];
}
export interface Source { id: string; name: string; provider: string | null; source_type: string;
  base_url: string | null; license: string | null; update_frequency: string | null;
  status: "healthy" | "degraded" | "down" | "unknown"; reliability: number | null;
  last_checked_at: string | null; dataset_count?: number }
export interface Decision { id: string; title: string; org: string | null; decision_type: string | null;
  date: string | null; url: string; project_id: string | null; extra?: Record<string, unknown> }
export interface Project { id: string; name: string; status: string | null; org: string | null;
  budget: number | null; url: string | null; decisions: Decision[];
  geometry: GeoJSON.Geometry | null }
export interface CityLayer { id: string; title: { el: string; en: string }; geometry_type: string;
  source: string; description?: string; feature_count: number }
export interface AIAnswer { detailed_result: string; summary: string;
  sources: { url: string; title: string }[]; limitations: string[] }
export interface ModelSpec { name: string; version: string; category: string; description: string;
  parameters: { name: string; type: string; default: unknown; min?: number; max?: number; label: { el: string; en: string } }[] }
export interface Policy { id: string; title: string; description: string | null; category: string;
  status: string; area: string | null; horizon: string | null;
  parameters: Record<string, unknown>; assumptions: string[]; kpis: string[];
  variants: PolicyVariant[]; created_at: string }
export interface PolicyVariant { id: string; policy_id: string; title: string; parameters: Record<string, unknown> }
export interface Passport { model_name: string; model_version: string; data_sources: { name: string; url?: string; retrieved_at?: string }[];
  assumptions: string[]; reliability_limits: string; uncertainty: string; validated_by: string | null;
  executed_at: string; seed: number | null; inputs_checksum: string }
export interface SimulationRun { id: string; policy_id: string | null; model_name: string; model_version: string;
  parameters: Record<string, unknown>; results: { metrics: Record<string, number>;
    baseline?: Record<string, number>; uncertainty?: Record<string, [number, number]> } | null;
  status: "queued" | "running" | "succeeded" | "failed"; passport: Passport | null;
  created_at: string; error: string | null }
export interface ImpactIndicator { name: string; label: { el: string; en: string }; baseline: number | null;
  value: number; delta: number | null; unit: string; direction: "up" | "down" | "neutral"; confidence: number }
export interface ImpactDimension { key: string; label: { el: string; en: string }; indicators: ImpactIndicator[] }
export interface ImpactReport { run_id: string; dimensions: ImpactDimension[]; summary: { el: string; en: string } }
export interface Proposal { id: string; title: string; description: string; area: string | null;
  category: string | null; status: string; created_at: string; comments_count: number }
export interface Comment { id: string; proposal_id: string; body: string; created_at: string }
export interface Consultation { id: string; title: string; description: string; status: string;
  starts_at: string | null; ends_at: string | null; proposals: Proposal[] }
export interface ResearchProject { id: string; name: string; description: string | null; created_at: string;
  experiments: { id: string; title: string; model: string; run_ids: string[]; notes: string | null }[] }
export interface FeatureFlag { name: string; enabled: boolean; description: string | null }
export interface AuditLog { id: string; method: string; path: string; status: number;
  ip: string | null; created_at: string }
export type GeoJSON = { Geometry: { type: string; coordinates: unknown } }; // minimal; refine as needed
```

(Adjust `GeoJSON` to a proper local definition — do NOT add dependencies.)

---

## 4. AI engine contract (Python — `services/ai_engine`, consumed by backend agent B)

```python
# services/ai_engine/providers.py
class LLMProvider:                       # abstract base
    name: str
    async def chat(self, messages: list[dict], *, temperature: float = 0.3,
                   max_tokens: int = 2048) -> str: ...
    async def ping(self) -> bool: ...
    async def embed(self, text: str) -> list[float]: ...   # may raise NotImplementedError

class OllamaProvider(LLMProvider): ...            # POST {base}/api/chat, /api/embeddings, /api/tags
class OpenAICompatibleProvider(LLMProvider): ...  # POST {base}/v1/chat/completions (+ Bearer key if set), /v1/embeddings
def get_provider(settings) -> LLMProvider: ...    # settings.llm_provider in {"ollama","openai_compatible"}

# services/ai_engine/orchestrator.py
async def answer_question(question: str, *, records: list[dict], city: str,
                          provider: LLMProvider | None = None) -> dict:
    """Returns AIAnswer: {"detailed_result": str, "summary": str,
       "sources": [{"url": str, "title": str}], "limitations": [str]}.
       - If records empty → answer explaining insufficiency in Greek (limitations=["insufficient data"]).
       - If provider unreachable → fallback dict, limitations=["llm unavailable"].
       - Must inject a strict system prompt: JSON-only output, cite sources, Greek, no invention."""

# services/ai_engine/rag.py
def chunk_text(text: str, *, size: int = 1200, overlap: int = 150) -> list[str]
def keyword_score(query: str, text: str) -> float
def retrieve(query: str, records: list[dict], *, limit: int = 40) -> list[dict]
    # hybrid: keyword scoring always works; embed() used only if provider supports it

# services/ai_engine/evidence.py
def build_sources(records: list[dict]) -> list[dict]     # dedup by url
def attach_limitations(base: list[str], extra: list[str]) -> list[str]
```

---

## 5. Other Python service contracts

### 5.1 `services/connector_kit` (shared — real base already provided by orchestrator; extend, don't break)
```python
# services/connector_kit/base.py  (FULL IMPLEMENTATION IS PART OF THE CONTRACT)
@dataclass
class NormalizedRecord:
    title: str; source_name: str; source_url: str
    description: str | None = None; provider: str | None = None; license: str | None = None
    category: str | None = None; tags: list[str] = field(default_factory=list)
    published_at: datetime | None = None; updated_at: datetime | None = None
    lat: float | None = None; lon: float | None = None
    geometry: dict | None = None          # GeoJSON geometry or None
    extra: dict = field(default_factory=dict)
    fetched_at: datetime = ...            # utcnow
    reliability: float = 0.8
    def to_dict(self) -> dict: ...

class BaseConnector:
    name: str; kind: str; source_url: str; default_reliability: float = 0.8
    def __init__(self, endpoint_url: str = "", enabled: bool = True,
                 config: dict | None = None): ...
    async def fetch(self, query: str | None = None, limit: int = 50) -> Any: ...   # raw HTTP
    async def normalize(self, raw: Any) -> list[NormalizedRecord]: ...
    async def search(self, query: str | None = None, limit: int = 50) -> list[NormalizedRecord]:
        # fetch + normalize; on error returns [] (never raises)
    async def health(self) -> dict:  # {"status": "healthy|degraded|down", "latency_ms": int|None,
                                     #  "detail": str|None, "checked_at": iso}
```

### 5.2 Connector classes (agents A) — exact import names used by backend B:
```python
from services.open_data_connectors.ckan import CkanConnector        # data.gov.gr (also used for Athens)
from services.open_data_connectors.eurostat import EurostatConnector
from services.open_data_connectors.overpass import OverpassConnector   # OSM POIs/buildings
from services.open_data_connectors.openmeteo import OpenMeteoConnector
from services.open_data_connectors.data_europa import DataEuropaConnector
from services.govtech_connectors.diavgeia import DiavgeiaConnector
from services.govtech_connectors.athens import AthensConnector
from services.govtech_connectors.kimdis import KimdisConnector         # ΚΗΜΔΗΣ contracts
from services.govtech_connectors.elstat import ElstatConnector         # ΕΛΣΤΑΤ
ALL_CONNECTORS: dict[str, type[BaseConnector]]  # in services/connector_kit/__init__.py? NO:
# registry dict lives in services/connector_kit/catalog.py as CONNECTOR_CLASSES: dict[str, type]
```
Endpoints (best-effort, real): data.gov.gr CKAN `/api/3/action/package_search`,
Diavgeia `https://diavgeia.gov.gr/opendata/decisions?format=json`,
Eurostat `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/...`,
Overpass `https://overpass-api.de/api/interpreter`, Open-Meteo `https://api.open-meteo.com/v1/forecast`,
data.europa.eu `/api/hub/search/datasets`, ΚΗΜΔΗΣ `https://kimdis.mou.gr/...` (best effort), ELSTAT best effort.
Connectors must degrade gracefully (empty list + health down) — tests mock httpx.

### 5.3 Ingestion (`services/data_ingestion`)
```python
def clean_record(raw: dict) -> dict                  # strip, dedupe keys, drop empties
def validate_record(record: dict, schema: dict | None = None) -> dict  # {"valid": bool, "errors": [str]}
def score_quality(record: dict, fetched_at: datetime | None) -> dict   # Quality {completeness,freshness,validity,validation_status}
class ObjectStore:
    def __init__(self, settings): ...                 # S3 if ATHENAX_S3_ENDPOINT_URL else local dir
    def put(self, key: str, data: bytes) -> str       # returns uri (s3://... or file://...)
    def get(self, uri: str) -> bytes
async def ingest(connector: BaseConnector, *, query=None, limit=50, store: ObjectStore | None = None) -> dict
    # returns {"ingested": int, "skipped": int, "errors": int}; stores raw snapshot + normalized rows
    # (backend B supplies a persist callback: callable[[list[NormalizedRecord]], Awaitable[int]]) —
    # signature: async def ingest(connector, *, query=None, limit=50, store=None, persist=None) -> dict
```

### 5.4 Geospatial (`services/geospatial_engine`)
```python
LAYER_REGISTRY: dict[str, dict]  # id -> {title:{el,en}, geometry_type, source, description}
# ids: buildings, roads, green_spaces, schools, hospitals, public_facilities, pois, population (8)
def allowed_layers() -> list[str]
def feature_query(layer_id: str, bbox: list[float] | None, limit: int = 500) -> tuple[str, dict]
    # raises ValueError on unknown layer; SELECT-safe whitelist ONLY (no user SQL ever reaches DB)
def rows_to_geojson(rows: list[dict], *, id_key: str = "id") -> dict  # FeatureCollection
def bbox_from_center(lat: float, lon: float, radius_m: float) -> list[float]  # [w,s,e,n]
def haversine_m(lat1, lon1, lat2, lon2) -> float
```

### 5.5 Simulation (`services/simulation_engine`)
```python
# registry.py
@dataclass class ModelSpec: name, version, category, description, parameters  # matches TS ModelSpec
def list_models() -> list[ModelSpec]
def get_model(name: str) -> ModelSpec            # KeyError if unknown
MODELS: dict[str, type]                          # name -> model class

# runner.py
def run_model(name: str, parameters: dict, *, snapshot: dict | None = None,
              seed: int | None = None, compare_baseline: bool = False) -> dict
    # returns {"status": "succeeded"|"failed", "metrics": {k: float}, "baseline": {..}|None,
    #  "uncertainty": {k: [lo,hi]}, "assumptions": [str], "warnings": [str], "logs": [str], "seed": int|None}
    # DETERMINISTIC given seed. Unknown model → status failed + warning (never raise to HTTP layer).
def build_passport(name, parameters, *, snapshot=None, seed=None) -> dict   # matches TS Passport
# models/ package: accessibility.py, greenspace.py, traffic_sumo.py, cost.py
#   - accessibility: walk-distance coverage to facilities (pure math over synthetic or snapshot geo inputs)
#   - greenspace: green m² per capita + % within 300 m
#   - traffic_sumo: SUMO adapter — if `sumolib`/sumo binary unavailable → deterministic synthetic
#     queueing model fallback (clearly marked in assumptions)
#   - cost.py: cost estimate ranges from unit costs
# worker.py: `python -m services.simulation_engine.worker <model> <params.json> <out.json>`
#   — subprocess entry for sandboxed execution (backend may call it; in-process run_model is fine for MVP)
```

### 5.6 Reporting (`services/reporting_engine`)
```python
DIMENSIONS: list[dict]  # 6 keys: environment, society, economy, mobility, quality_of_life, administration
def compute_impact(metrics: dict, *, baseline: dict | None = None) -> dict  # matches TS ImpactReport
def build_research_report(project: dict, runs: list[dict]) -> str          # markdown w/ provenance section
def to_csv(rows: list[dict]) -> str
def to_geojson(features: list[dict]) -> str
```

### 5.7 Backend DB models (agent B owns — `apps/api/app/models/`)
Tables (SQLAlchemy, snake_case, UUID pk strings via `uuid4().hex` or `Uuid` type):
`data_sources, datasets, dataset_versions, data_quality_reports, documents, decisions, projects,
connectors, cities, feature_flags, settings, policies, policy_variants, simulation_runs,
model_registry, impact_metrics, consultations, proposals, comments, research_projects,
experiments, audit_logs, api_registry`.
- Every entity created/updated carries `created_at TIMESTAMPTZ` (+ `updated_at` where useful).
- `datasets` MUST carry provenance columns: `source_id FK, license, last_updated, fetched_at, checksum, metadata JSONB`.
- Geometry: `GeoAlchemy2 Geometry` when DB supports it; code must ALSO work when DB is unavailable
  (tests mock the session). Alembic initial migration in `infrastructure/database/alembic/`.
- Registry/flags/cities/settings seeded from `data/source-registry/*.yaml` on startup (non-fatal if DB down).

---

## 6. Frontend contracts (agents D & E)

### 6.1 `@athenax/ui` exports (agent D implements; agent E consumes)
```ts
export function I18nProvider({children}): JSX.Element        // client; persists lang in localStorage
export function useI18n(): { lang: "el"|"en"; setLang: (l: "el"|"en") => void;
                             t: (dict: Record<"el"|"en", string>) => string }
export function ThemeProvider({children}): JSX.Element       // dark/light, .dark class on <html>
export function useTheme(): { theme: "light"|"dark"; toggle: () => void }
export function ErrorBoundary({children}): JSX.Element       // Greek friendly error + retry
export function LayoutShell(props: { title?: string; children: React.ReactNode }): JSX.Element
export function Nav(): JSX.Element                           // sticky bar: logo AthenaX, universal search
                                                              // (Ctrl+K → /ask?q=), links:
                                                              // /data, /govtech, /ask, /city, /policies,
                                                              // /citizen, /research, /developers, /admin
                                                              // + LanguageToggle + ThemeToggle + health chip
export function SearchBar(props: { placeholder?: string; onSearch?: (q: string) => void;
                                   initial?: string }): JSX.Element
export function DataCard(props: { title: string; subtitle?: string; badge?: React.ReactNode;
  meta?: React.ReactNode; sourceUrl?: string; footer?: React.ReactNode; onClick?: () => void }): JSX.Element
export function StatCard(props: { label: string; value: React.ReactNode; hint?: string }): JSX.Element
export function EmptyState(props: { title: string; description?: string;
  action?: React.ReactNode; suggestions?: string[] }): JSX.Element
export function Skeleton(props: { rows?: number; className?: string }): JSX.Element
export function Badge(props: { tone?: "neutral"|"success"|"warning"|"error"|"info";
  children: React.ReactNode }): JSX.Element
export function ConnectorStatusChip(props: { status: "healthy"|"degraded"|"down"|"unknown";
  detail?: string }): JSX.Element
export function FilterPanel(props: { children: React.ReactNode; defaultOpen?: boolean }): JSX.Element
export function ExportButton(props: { onExport: (format: "csv"|"geojson"|"json") => void }): JSX.Element
export function ExampleChips(props: { items: string[]; onPick: (q: string) => void }): JSX.Element
export function AIResponse(props: { answer: AIAnswer; meta?: Meta | null }): JSX.Element
export function MapPanel(props: { features?: GeoJSON.Feature[] | null; layers?: CityLayer[];
  activeLayer?: string | null; onLayerChange?: (id: string) => void;
  center?: [number, number]; zoom?: number; height?: string; onFeatureClick?: (f: GeoJSON.Feature) => void }): JSX.Element
```
- All components Tailwind v4 classes w/ design tokens (indigo primary `#4f46e5`, zinc neutrals,
  rounded tokens as in `globals.css`), WCAG AA contrast, keyboard focus rings, responsive.
- `MapPanel` is `"use client"`, mounts maplibre only in `useEffect` (SSR-safe), shows tiles from
  a free style (e.g. `https://demotiles.maplibre.org/style.json` fallback) + GeoJSON sources/layers.

### 6.2 API client (`@athenax/api-client`)
```ts
export const API_BASE: string  // process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"
export async function request<T>(path: string, opts?: { method?: string; body?: unknown;
  signal?: AbortSignal }): Promise<Envelope<T>>   // throws ApiError (with .status) on network/HTTP error
export function get<T>(path: string, opts?): Promise<{ data: T | null; meta: Meta | null }>
export function post<T>(path: string, body?: unknown, opts?): Promise<{ data: T | null; meta: Meta | null }>
// Greek error messages, 2-attempt retry on 5xx/network, never throws on 4xx envelope — returns {ok:false}
export function apiError(status: number): string   // Greek mapping
```

### 6.3 Pages (agent E)
- `/data` — dataset search + filters (source/tag/sort) + `DataCard` grid + pagination;
  `/data/[id]` — detail: metadata, quality bars, provenance, resources (download links), related.
- `/govtech` — tabs: Αποφάσεις (decision search), Έργα (project tracker w/ statuses + timeline),
  map of interventions (MapPanel from project geometries).
- `/ask` — big input + ExampleChips → `POST /v1/ai/query` → AIResponse + limitations + optional map + empty/error states. Reads `?q=` from URL.
- `/city` — full-screen MapPanel + layer sidebar (from `/v1/city/layers`) + feature list + popups;
  `/city/3d` — 3D mode: CesiumJS (dynamic import, `CESIUM_BASE_URL` via CDN
  `https://cdn.jsdelivr.net/npm/cesium@1.146.0/Build/Cesium/`) with **graceful fallback to
  MapLibre fill-extrusion globe view if Cesium fails**; 3D buildings from building footprints + heights.
- `/policies` — list + link to builder; `/policies/new` — Policy Builder form (title, type, area,
  horizon, cost, parameters, assumptions, KPIs) → `POST /v1/policies` → redirect `/policies/[id]`;
  `/policies/[id]` — detail + variants + "Εκτέλεση προσομοίωσης" (model picker from `/v1/models`,
  params form) → `POST /v1/simulations` → link to run; baseline vs scenario comparison bars;
  impact report section from `/v1/impact/{run_id}`.
- `/simulations/[id]` — run detail: metrics, passport (all fields!), uncertainty, logs.
- `/citizen` — consultations list + detail (status, window, proposals), create proposal form,
  comments; **visible disclaimer** (online participation ≠ representative/institutional decision, EL+EN).
- `/impact/[id]` — impact report across 6 dimensions (can also be embedded in policies page).
- `/research` — projects list + detail, experiment history, export buttons (md/csv/json).

### 6.4 Core pages (agent D)
- `/` — hero (tagline "Connect public data. Understand the city. Test better policies."),
  metric cards (sources/datasets/connectors/health from `/v1/sources` + `/health`),
  quick-start cards for every module (all links above), recent activity.
- `/admin` — connectors registry table (enable/disable PATCH), feature flags, audit log page,
  ingest trigger, health statuses (uses `/v1/admin/*`).
- `/developers` — API info (`/v1/developers/info`), endpoint catalogue (from OpenAPI fetch
  `/openapi.json` — render grouped paths+summaries), examples (`/v1/developers/examples`),
  link to `/docs`, rate-limit + license notes.

---

## 7. Validation gates (each agent runs what applies, reports results)

| Agent | Commands |
|---|---|
| A services | `python -m pytest services/tests -q` (from repo root), `python -m ruff check services` (if ruff available) |
| B backend | `python -m compileall -q apps/api/app`, `python -m pytest apps/api/tests -q` |
| C infra-docs | file existence checklist; `python -c "import yaml,sys"` NOT available — validate compose by structure only (no pyyaml assumption) |
| D frontend-core | `npm.cmd run typecheck --workspace apps/web` may FAIL while E's files are in flux — instead run `npx tsc --noEmit -p apps/web` ONLY on your own files if possible; final gate is orchestrator's |
| E frontend-modules | write code; do NOT run `next build` (orchestrator runs final gates) |

**Final gates (orchestrator, after all agents report):** `npm.cmd run lint`, `npm.cmd run build`,
`python -m pytest -q`, `python -m compileall -q apps/api services`.

---

## 8. Non-negotiables recap

1. Envelope on every endpoint. 2. Greek-first UI/errors. 3. No auth anywhere. 4. No new deps.
5. Connectors always degrade gracefully. 6. AI answers always carry sources or explicit insufficiency.
7. Simulation deterministic + full passport. 8. Only whitelisted SQL. 9. Ownership matrix respected.
10. Frontend agents: READ the Next.js docs in `node_modules/next/dist/docs/` (at minimum
`01-getting-started/05-server-and-client-components.md`, `03-layouts-and-pages.md`, `ai-agents.md`)
before writing components — this Next version has breaking changes.

---

## 9. Addendum — exact import map + city tables (authoritative)

### 9.1 Backend (B) imports ONLY these service symbols (never connector classes directly):
```python
from services.connector_kit.catalog import CONNECTOR_CLASSES      # dict[name, class]
from services.connector_kit.base import BaseConnector, NormalizedRecord
from services.ai_engine.orchestrator import answer_question        # async
from services.ai_engine.providers import get_provider
from services.geospatial_engine.layers import LAYER_REGISTRY, allowed_layers
from services.geospatial_engine.queries import feature_query, bbox_from_center, haversine_m, parse_bbox
from services.geospatial_engine.geojson import rows_to_geojson, records_to_geojson
from services.simulation_engine.registry import list_models, get_model
from services.simulation_engine.runner import run_model, build_passport
from services.reporting_engine.impact import compute_impact, DIMENSIONS
from services.reporting_engine.reports import build_research_report, to_csv, to_geojson
from services.data_ingestion.pipeline import ingest                 # async
from services.data_ingestion.storage import ObjectStore
```
Other agents must KEEP these exact signatures when replacing stubs.

### 9.2 DB tables owned by B beyond §5.7
- `city_features(id TEXT PRIMARY KEY, layer TEXT NOT NULL, properties JSONB, geom GEOMETRY(Geometry,4326))`
  + GIST index on geom; `feature_query()` already targets this table.
- `city_areas(id TEXT PRIMARY KEY, name_el TEXT, name_en TEXT, lat DOUBLE PRECISION, lon DOUBLE PRECISION, radius_m INTEGER)`
  seeded from `data/source-registry/catalog.yaml` → `city_areas` (6 Athens areas).

### 9.3 Infrastructure notes
- PostGIS image `postgis/postgis:16-3.4`, `CREATE EXTENSION IF NOT EXISTS postgis;` only.
  **Do NOT enable pgvector preload** (image lacks it) — RAG uses keyword retrieval as baseline;
  embedding columns are optional and skipped when unavailable.
- Redis/MinIO are opt-in compose profiles; code degrades to in-memory / local `./storage`.
- `data/source-registry/catalog.yaml` (9 sources) is the seed for `data_sources`/`connectors`
  and the YAML fallback for `/v1/sources` when the DB is down.
