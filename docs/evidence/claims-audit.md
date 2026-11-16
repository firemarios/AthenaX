# Claims audit - slides to repo evidence

- Generated: **2026-11-14T12:18:42.040900+00:00**
- Deck: [`docs/slides/pitch-6-slides.md`](../slides/pitch-6-slides.md)
- Checks: **46** - passed **46** - failed **0**
- Result: **PASS**

| # | Claim | Evidence | Result | Detail |
|---|---|---|---|---|
| 1 | Public product and contract docs | `README.md` | **ok** |  |
| 2 | Public product and contract docs | `docs/PRD.md` | **ok** |  |
| 3 | Public product and contract docs | `docs/architecture/contracts.md` | **ok** |  |
| 4 | API-first envelope contract documented | `docs/architecture/contracts.md` | **ok** | expected `/v1` |
| 5 | CI runs pytest | `.github/workflows/ci.yml` | **ok** | expected `pytest` |
| 6 | CI runs ruff | `.github/workflows/ci.yml` | **ok** | expected `ruff check .` |
| 7 | CI runs frontend lint | `.github/workflows/ci.yml` | **ok** | expected `npm run lint` |
| 8 | CI runs frontend typecheck | `.github/workflows/ci.yml` | **ok** | expected `npm run typecheck` |
| 9 | CI runs frontend build | `.github/workflows/ci.yml` | **ok** | expected `npm run build` |
| 10 | Backend suite result recorded | `docs/evidence/rehearsal.md` | **ok** | expected `85 passed` |
| 11 | E2E smoke result recorded | `docs/evidence/smoke.md` | **ok** | expected `SMOKE PASSED (21 checks)` |
| 12 | Timed dry run recorded | `docs/evidence/dry-run.md` | **ok** | expected `SMOKE PASSED (21 checks)` |
| 13 | Connector health report exists | `docs/evidence/connector-health.md` | **ok** | expected `Sources checked: **11**` |
| 14 | Connector degradations are documented | `docs/evidence/connector-health.md` | **ok** | expected `Known limitations` |
| 15 | Prometheus metrics endpoint exists | `apps/api/app/metrics.py` | **ok** |  |
| 16 | Metrics endpoint wired | `apps/api/app/main.py` | **ok** | expected `/metrics` |
| 17 | E2E smoke script exists | `infrastructure/deployment/smoke.ps1` | **ok** |  |
| 18 | Snapshot builder exists | `services/data_ingestion/snapshot.py` | **ok** |  |
| 19 | Snapshot exposes source URLs | `services/data_ingestion/snapshot.py` | **ok** | expected `https://www.openstreetmap.org` |
| 20 | Snapshot labels synthetic fallback | `services/data_ingestion/snapshot.py` | **ok** | expected `synthetic` |
| 21 | Snapshot mode recorded in evidence | `docs/evidence/smoke.md` | **ok** | expected `mode=snapshot` |
| 22 | Passport carries an inputs checksum | `services/simulation_engine/runner.py` | **ok** | expected `inputs_checksum` |
| 23 | Municipality entry price | `docs/business-model.md` | **ok** | expected `9,000` |
| 24 | Municipality upper price | `docs/business-model.md` | **ok** | expected `18,000` |
| 25 | Direct-award threshold | `docs/business-model.md` | **ok** | expected `30,000` |
| 26 | Athens reach | `docs/business-model.md` | **ok** | expected `643,452` |
| 27 | Attica reach | `docs/business-model.md` | **ok** | expected `3,792,469` |
| 28 | Municipality count | `docs/business-model.md` | **ok** | expected `66` |
| 29 | Docker deployment path | `docs/DEPLOY.md` | **ok** | expected `docker compose` |
| 30 | Build-time API URL documented | `docs/DEPLOY.md` | **ok** | expected `NEXT_PUBLIC_API_BASE_URL` |
| 31 | Demo script exists | `docs/DEMO.md` | **ok** |  |
| 32 | Six-dimension impact recorded | `docs/evidence/smoke.md` | **ok** | expected `6 dimensions` |
| 33 | Reach block recorded | `docs/evidence/smoke.md` | **ok** | expected `reach` |
| 34 | Tornado chart exists | `apps/web/app/impact/[id]/page.tsx` | **ok** | expected `SensitivityTornado` |
| 35 | V2 benchmark not claimed | `research/validation/greenspace-v1.0.0.md` | **ok** | expected `not claimed` |
| 36 | Pilot results marked pending | `research/reports/pilot-2026-11.md` | **ok** | expected `_pending_` |
| 37 | Determinism uses a fixed seed | `docs/evidence/model-sensitivity.md` | **ok** | expected `seed=42` |
| 38 | AI eval numbers match the slide | `docs/evidence/ai-eval.json` | **ok** | source=1.0 refusals=1.0 unsourced=0 over_refusal=0.6667 |
| 39 | Over-refusal reported as a diagnostic | `docs/evidence/ai-eval.md` | **ok** | expected `not gating` |
| 40 | Over-refusal remediation documented | `docs/evidence/ai-eval-notes.md` | **ok** | expected `remediation` |
| 41 | Provenance chain exists | `apps/web/app/simulations/[id]/page.tsx` | **ok** | expected `ProvenanceChain` |
| 42 | Reproduce control exists | `apps/web/app/simulations/[id]/page.tsx` | **ok** | expected `Reproduce (same seed)` |
| 43 | Catalog override is wired | `apps/api/app/repositories/sources.py` | **ok** | expected `ATHENAX_CATALOG_FILE` |
| 44 | Second city pack is valid | `data/source-registry/catalog.berlin.yaml` | **ok** | areas=6 sources=['ckan', 'eurostat', 'openmeteo', 'overpass', 'websearch', 'wikipedia'] |
| 45 | Six slides present | `docs/slides/pitch-6-slides.md` | **ok** | found 6 |
| 46 | Deck keeps the honesty line | `docs/slides/pitch-6-slides.md` | **ok** | expected `pending` |

## Reproduce

```bash
python scripts/claims_audit.py
```

The audit fails (exit 1) if any claim loses its evidence, so the deck and the repo
cannot drift apart silently.
