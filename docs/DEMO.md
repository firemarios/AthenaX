# Demo script — 5 minutes (and a 10-minute version)

> Goal: show **evidence → policy → simulation → reproducibility → impact** in one continuous
> journey. Do not explain the architecture slide first; the product should carry the story.

## Before the demo (T-10 minutes)

```powershell
# 1. API + web up (demo-safe: no uvicorn reload, pre-built web)
powershell -ExecutionPolicy Bypass -File infrastructure\deployment\dev.ps1 -Web -NoReload -Prod

# 2. Pre-warm the hosted API (free tiers sleep)
Invoke-WebRequest https://<api>/health -UseBasicParsing | Out-Null

# 3. Run the smoke test once so no step surprises you (AI can take up to 3 min)
powershell -ExecutionPolicy Bypass -File infrastructure/deployment/smoke.ps1 `
  -BaseUrl http://127.0.0.1:8000
```

Open in tabs: `/ask`, `/data`, `/policies`, `/simulations`, `/impact/<last-run>`, `/metrics`.
Have `docs/_internal/evidence/model-sensitivity.md` open as a backup.

> **Measured on 2026-11-14:** the AI step took **113.9s** on the demo gateway. Pre-warm the
> `/ask` question in a background tab before the audience joins, or ask it at 0:00 and narrate
> `/data` while it runs. See [`docs/_internal/evidence/dry-run.md`](_internal/evidence/dry-run.md).

## 5-minute script

| Time | Screen | Say | Do |
|---|---|---|---|
| 0:00 | `/` | "AthenaX answers city questions with sources or says it cannot — then tests policies reproducibly." | Point at the three modules in the hero. |
| 0:30 | `/ask` | "Ask a real question. Watch the evidence panel." | Ask: **«Ποια ανοικτά δεδομένα υπάρχουν για τα πάρκα στην Αθήνα;»** Expand sources, point at `retrieved_at`, licence, limitations. |
| 1:15 | `/ask` | "Now a question the data cannot answer." | Ask: **«Πόσοι τουρίστες επισκέφτηκαν την Ακρόπολη χθες;»** Show the explicit insufficiency limitation. **This is the honesty moment.** |
| 1:45 | `/data` | "Every layer is real data or explicitly flagged synthetic." | Open a layer, show provenance/quality badges. |
| 2:15 | `/policies/new` | "A policy is structured, not a prompt." | Create: title «Πιλοτικό πράσινο στα Εξάρχεια», area **Εξάρχεια**, category environment; add KPI. Save. |
| 3:00 | Policy page | "Simulate with a fixed seed." | Click **Simulate**; wait for the run; open it. |
| 3:30 | `/simulations/<id>` | "The passport is the accountability record." | Point at model+version, data sources with retrieval time, assumptions, **checksum**, seed, snapshot badge (`snapshot` vs `synthetic`). |
| 3:50 | same | "Run it again with the same seed — same result." | Click **Reproduce (same seed)**; show the green "identical checksum and metrics" panel. |
| 4:10 | `/impact/<id>` | "Six dimensions, with deltas and confidence." | Scroll: summary → tornado (which input matters) → dimensions → reach. |
| 4:40 | Export | "The output is a research dossier, not a screenshot." | Download JSON/CSV; open the file. |
| 4:50 | `/metrics` | "And it is operable: requests, connector health, DB status." | Show the Prometheus text. Close with the honest-limits line. |

## 10-minute version (adds validation + AI evaluation)

After 4:50:

| Time | Screen | Say | Do |
|---|---|---|---|
| 5:00 | `docs/_internal/evidence/connector-health.md` | "We measure connectors, including the ones that are down." | Point at `down/degraded` rows and the known-limitations section. |
| 5:45 | `docs/_internal/evidence/model-sensitivity.md` | "The model is deterministic and sensitivity-tested; green m² per capita moves linearly with park area." | Show the sweep tables. |
| 6:30 | `research/validation/greenspace-v1.0.0.md` | "V1 = methodology review; we do **not** claim a benchmark we do not have." | Point at §5.2 "not claimed" and §8. |
| 7:15 | `docs/_internal/evidence/ai-eval.md` | "20 Greek questions: source-hit rate, correct refusals, zero unsourced claims." | Show the pass/fail table (run `python scripts/ai_eval.py` beforehand). |
| 8:00 | `docs/business-model.md` | "Who pays: a €9-18k/year municipality licence; pilot runs on free tiers." | Show the cost table and procurement path. |
| 8:45 | `docs/_internal/pilot/README.md` | "Internal usability pilot, n=6-8, honest sample; results pending." | Show the protocol and `docs/_internal/research/reports/pilot-2026-11.md` status. |
| 9:30 | `data/source-registry/catalog.berlin.yaml` | "Same stack, second city: swap the catalog, restart." | Show `ATHENAX_CATALOG_FILE`. |

## Fallbacks (when the demo environment fights back)

| Failure | What to do | What to say |
|---|---|---|
| LLM key missing / slow | Use a question with cached answer, or switch to `/data` → policy → simulation (no AI needed) | "The AI layer degrades explicitly; the deterministic simulation and evidence path still work." |
| LLM unreachable (offline check) | Run the local API; `/ask` returns a valid envelope with `limitations: ["llm unavailable"]` | "No 500, no invented answer; the limitation is the product." |
| Overpass/live data down | Set `ATHENAX_SNAPSHOT_LIVE=0`, restart API, re-run | "The snapshot shows `synthetic`; we never present synthetic as measured." |
| Neon/Postgres down | Run the local SQLite demo (`ATHENAX_DATABASE_URL=sqlite+aiosqlite:///./athenax.db`) | "The API serves the YAML catalog and in-memory demo; `/health` reports the DB as down." |
| Web build not ready | Demo the API + OpenAPI (`/docs`) + `smoke.ps1` output | "The contract-first API is the product; the UI is one client." |
| `Failed to proxy ... ECONNRESET` | Restart with `dev.ps1 -Web -NoReload -Prod`. `--reload` resets in-flight requests when any `.py` changes; `next dev` can reset one while compiling. | "A dev-server reload, not a product failure; the production path is unaffected." |
| Reproduce differs | Open the two passports and compare checksums | "We show the difference and its inputs instead of hiding it." |

## Do not say

- Do not claim the models are validated against reality (they are V1, not V2).
- Do not call synthetic fixtures "real data".
- Do not claim citizen adoption from the internal usability pilot.
- Do not invent pilot numbers, reviewer names or connector uptime.
