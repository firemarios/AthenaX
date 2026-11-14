# Day 4 rehearsal & claims checklist (2026-11-14)

## Executed locally

| Gate / rehearsal step | Result | Artifact |
|---|---|---|
| Backend tests | **85 passed** (`python -m pytest`) | — |
| Backend lint | pass (`python -m ruff check .`) | — |
| Frontend lint | pass (`npm run lint`) | — |
| Frontend typecheck | pass (`npm run typecheck`) | — |
| Production build | pass, 22 routes (`npm run build`) | — |
| E2E API journey | **SMOKE PASSED (21 checks)** | [`smoke.md`](smoke.md) |
| Timed dry run | **SMOKE PASSED (21 checks)**, **115.4s** journey, AI **113.9s** | [`dry-run.md`](dry-run.md) |
| Offline fallback (dead LLM, no live Overpass) | **PASS** — `llm unavailable` limitation, simulation still `mode=snapshot` | [`fallback-check.md`](fallback-check.md) |
| Connector health | 11 checked, 7 healthy / 2 degraded / 2 down, degradations documented | [`connector-health.md`](connector-health.md) |
| AI evidence-first eval | source 1.00, refusals 1.00, unsourced 0; over-refusal 0.67 flagged | [`ai-eval.md`](ai-eval.md), [`ai-eval-notes.md`](ai-eval-notes.md) |
| Model determinism | seed 42 reproducibility | [`model-sensitivity.md`](model-sensitivity.md) |
| Slide claims audit | **46/46** claims verified against repo evidence | [`claims-audit.md`](claims-audit.md) |

## Claims → evidence

| Claim | Where the judge can verify it |
|---|---|
| CI + tests | `.github/workflows/ci.yml`, `85 passed` |
| Third-party real data | Passport in a simulation response: real source URLs + `mode=snapshot` + `coverage` |
| Reproducible results | `POST /v1/simulations` with the same `seed` → identical `inputs_checksum` and metrics (smoke step) |
| Full journey works | `infrastructure/deployment/smoke.ps1` (21 checks) |
| Operational visibility | `GET /metrics`, `GET /health`, connector health report |
| Business viability | `docs/business-model.md` (pricing, costs, procurement path) |
| Validation honesty | `research/validation/greenspace-v1.0.0.md` (V1, V2 not claimed) |
| User research status | `research/reports/pilot-2026-11.md` (protocol frozen, sessions pending) |
| AI evidence discipline | `scripts/ai_eval.py` + golden set + generated report |
| Deployable | `docs/DEPLOY.md`, `infrastructure/deployment/`, Docker |

## Backup plan (network/LLM failure)

- SQLite demo DB + previously ingested `city_features` (snapshot mode) — proven in smoke.
- Deterministic synthetic snapshot if `city_features` and Overpass are both unavailable.
- LLM fallback answer already in `services/ai_engine/orchestrator.py`.
- `docs/DEMO.md` lists per-failure fallbacks; API `/docs` + smoke output can carry the demo.

## Pitch artifacts

- 6-slide deck: [`docs/slides/pitch-6-slides.md`](../slides/pitch-6-slides.md) — one slide per
  sub-criterion, each claim linked to a repo artifact.
- Claim audit: [`claims-audit.md`](claims-audit.md) — `python scripts/claims_audit.py` verifies
  every deck claim and fails if evidence disappears.

## Demo risk found by the timed run

- The AI step measured **113.9s**. The 5-minute script must pre-warm `/ask` or ask at 0:00 and
  narrate `/data` while it runs; the rest of the journey is under 1 s per step.
- If the LLM is unreachable, the API still returns a valid answer envelope with
  `limitations: ["llm unavailable"]`, and the simulation path works offline
  ([`fallback-check.md`](fallback-check.md)).

## Not yet verified

- Live browser click-through of the Next.js UI (build and typecheck pass; pages not opened
  in this session).
- Recorded backup video (rehearsal notes only; recording is a manual step before the demo).
