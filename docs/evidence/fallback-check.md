# Offline fallback check - dead LLM, no live Overpass

- Generated: **2026-11-14T09:49:45.601533+00:00**
- API: `:8011` with `POLICYLAB_LLM_BASE_URL=http://127.0.0.1:1/v1` and
  `POLICYLAB_SNAPSHOT_LIVE=0`.
- Wall time: **64.7s**
- `/health`: HTTP 200, `llm=degraded`

## AI answer without an LLM

- HTTP 200, `ok=True`
- summary: `Αποτυχία σύνδεσης με το μοντέλο γλώσσας.`
- limitations: `['llm unavailable']`
- sources: **1**
- Result: **PASS** (valid envelope + explicit limitation, no 500)

## Simulation without live data

- HTTP 200, `status=succeeded`
- snapshot mode: **snapshot**
- passport checksum: `12f3b40a144565cc…`
- Result: **PASS** (deterministic run still works offline)

## Verdict: **PASS**

This is the documented demo fallback: the AI layer degrades explicitly while the
snapshot and simulation path keeps working.

Reproduce: `python scripts/fallback_check.py`
