# Smoke test evidence (2026-11-14)

Command:

```powershell
powershell -ExecutionPolicy Bypass -File infrastructure/deployment/smoke.ps1 `
  -BaseUrl http://127.0.0.1:8000 -SkipLiveIngest
```

Result: **SMOKE PASSED (21 checks)** against a live local API with real DB (`mode=snapshot`
coverage: parks/facilities/population from `city_features`).

Covered journey: health → connectors (11 registered) → Ask the City → create policy →
greenspace simulation (passport + sha256 inputs checksum + snapshot metadata + real source
URLs) → persisted detail → reproduce with the same seed (identical checksum and metrics) →
impact (6 dimensions + reach) → research export (non-empty Markdown) → `/metrics`
(Prometheus counters).

Notes:
- `-SkipLiveIngest` was used because public Overpass endpoints were timing out during this
  session; the snapshot came from previously ingested `city_features`. Without the flag the
  script also exercises ingestion.
- The AI step uses a 180 s timeout because the model gateway can take 30–90 s.
