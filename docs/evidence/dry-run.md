# Timed dry run - flagship journey

- Generated: **2026-11-14T09:47:07.736743+00:00**
- Command: `powershell -ExecutionPolicy Bypass -File infrastructure/deployment/smoke.ps1 -BaseUrl http://127.0.0.1:8000 -SkipLiveIngest`
- Result: **SMOKE PASSED (21 checks)**
- Checks: **21**
- Ingest: **skipped (pre-warmed `city_features`; live Overpass unavailable)**
- API journey time (sum of steps): **115.4s**
- Wall time including API cold start and teardown: **116.1s**
- AI step: **113.9s**
- 5-minute demo budget: **300s** (headroom **184.6s**)

## Measured steps

| Step | Measured |
|---|---|
| Health | 0.2s |
| Connector health (one live source) | 0.1s |
| Ask the City | 113.9s |
| Create policy | 0.1s |
| Simulate (greenspace, snapshot inputs) | 0.3s |
| Simulation detail | 0.1s |
| Reproduce with the same seed | 0.1s |
| Impact report | 0.2s |
| Research export | 0.4s |
| Metrics endpoint | 0.0s |

## Reading it

The 5-minute demo script budgets 300 s. The measured API journey above is the
machine time; the remainder is narration and UI transitions. The AI step is the
only variable cost and it has a 180 s client timeout in the smoke script.

Live ingest was skipped because the public Overpass mirrors were timing out;
the snapshot still came from the previously ingested `city_features`, which is
exactly the pre-warmed demo path in `docs/DEMO.md`.

## Rehearsal finding: live AI is slow

The AI step took **113.9s**. That is too long to wait in silence on stage.
Mitigation for the live demo:

1. Pre-warm `/ask` (send the question before the audience joins) and narrate the
   evidence panel from the loaded answer.
2. Or ask the question at 0:00 and keep talking through `/data` while it runs.
3. Keep the documented fallback: if the LLM is unreachable, the API returns an
   explicit `llm unavailable` limitation and the simulation path still works
   (proven in [`fallback-check.md`](fallback-check.md)).

Raw output: [`dry-run-smoke.log`](dry-run-smoke.log).

## Freeze rule

If this document is stale after a code change, re-run
`python scripts/demo_dry_run.py --skip-live-ingest` before using it as evidence.
