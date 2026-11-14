# POLICYLAB — 6-slide pitch deck

> One slide per sub-criterion. Every claim below has a path or command the judge can open.
> Companion material: [`docs/DEMO.md`](../DEMO.md) (5- and 10-minute scripts).

---

## Slide 1 — POLICYLAB: evidence-first GovTech, testable policies

**Connect public data. Understand the city. Test better policies.**

- Greek-first, API-first, Apache-2.0.
- Ask the city: every answer cites sources **or** says the data is insufficient.
- Simulate: deterministic models with a Simulation Passport and a same-seed **Reproduce**.
- Built for Athens, not Athens-only: the city is a catalog file.

**Proof:** `README.md` · `docs/PRD.md` · `docs/architecture/contracts.md`

---

## Slide 2 — A · It runs, and we prove it

| Gate | Result |
|---|---|
| Backend tests | **85 passed** |
| Backend lint | `ruff check .` pass |
| Frontend lint · typecheck · build | pass · pass · **22 routes** |
| End-to-end journey | **SMOKE PASSED (21 checks)**, **115.4s** measured |
| Operational visibility | `GET /health`, `GET /metrics` (Prometheus) |
| Connector health | **11 checked**; degraded/down sources documented, not hidden |

**Proof:** `.github/workflows/ci.yml` · `infrastructure/deployment/smoke.ps1` ·
[`docs/evidence/smoke.md`](../evidence/smoke.md) · [`docs/evidence/rehearsal.md`](../evidence/rehearsal.md)

**Say:** "One command walks health → ingest → ask → policy → simulate → passport → impact →
export, and fails on any contract break."

---

## Slide 3 — A · Third-party data is real, and its origin is visible

- Simulations consume a **snapshot** built from `city_features` (OSM ingest), then live
  Overpass, then deterministic synthetic — the mode is always labelled.
- The passport carries **real source URLs**, `retrieved_at`, per-layer `coverage`, and a
  **sha256 inputs checksum**.
- Verified run: `mode=snapshot`, coverage `parks/facilities/population_points = database`,
  source `https://www.openstreetmap.org`.

**Proof:** `services/data_ingestion/snapshot.py` · `POST /v1/simulations` passport ·
`infrastructure/deployment/smoke.ps1` snapshot assertions

**Say:** "Synthetic is allowed, but it can never masquerade as measured data."

---

## Slide 4 — B · How a municipality adopts it

- **Licence ladder:** Municipality **€9–18k/yr** · Region €25–45k/yr · Research €3–6k/yr ·
  community self-host €0.
- **Run cost:** **€0–4.2k/yr** cloud before staff time; the pilot can run on free tiers.
- **Procurement:** direct award for services up to **€30k**, then a controlled tender.
- **Deploy:** `docker compose --env-file .env.production build`, migrate, `up -d api web`;
  or Render + Neon + Vercel.

**Proof:** [`docs/business-model.md`](../business-model.md) · [`docs/DEPLOY.md`](../DEPLOY.md) ·
[`docs/DEMO.md`](../DEMO.md)

**Say:** "The buyer is a municipality; the entry price fits a direct award, so adoption does
not wait for a national tender."

---

## Slide 5 — B · Impact is measured, validated and honest

- **6-dimension impact report** per run (environment, accessibility, economy, social,
  governance, health) plus a **reach** block.
- **Tornado chart** shows which input actually moves the result.
- **Validation:** `greenspace-v1.0.0` is a **V1 methodology review** — benchmark **not
  claimed** (no V2 benchmark found).
- **Pilot:** internal usability pilot, **n=6–8**, protocol frozen, results **pending**.
- **Reach:** Athens **643,452** · Attica **3,792,469** residents, **66** municipalities.

**Proof:** `research/validation/greenspace-v1.0.0.md` ·
`research/reports/pilot-2026-11.md` · [`docs/evidence/model-sensitivity.md`](../evidence/model-sensitivity.md)

**Say:** "We separate what is measured from what is pending, and we show the delta."

---

## Slide 6 — C · Innovation: evidence discipline you can re-run

- **AI eval:** 20 Greek questions, real LLM key — **source-hit 1.00**, **correct refusals
  1.00**, **unsourced claims 0**.
- **Honest diagnostic:** over-refusal **0.67** on answerable questions, reported openly with
  a remediation plan (retrieval, prompt, partial-evidence UI).
- **Provenance chain:** source registry → ingest → snapshot → run → passport → impact.
- **Reproduce:** same seed → identical `inputs_checksum` and metrics.
- **BYO city:** `data/source-registry/catalog.berlin.yaml` via `POLICYLAB_CATALOG_FILE`.

**Proof:** [`docs/evidence/ai-eval.md`](../evidence/ai-eval.md) ·
[`docs/evidence/ai-eval-notes.md`](../evidence/ai-eval-notes.md) ·
`apps/web/app/simulations/[id]/page.tsx` · `data/source-registry/catalog.berlin.yaml`

**Say:** "The innovation is not a bigger model; it is a measurable evidence contract that
survives a second city and a second run."

---

## Before presenting

1. Run `powershell -ExecutionPolicy Bypass -File infrastructure/deployment/smoke.ps1 -BaseUrl http://127.0.0.1:8000`.
2. Re-run `python scripts/ai_eval.py` only if the LLM/model changed; keep the golden set fixed.
3. Record the 90-second walkthrough from [`docs/DEMO.md`](../DEMO.md) (manual step).
4. Keep the honesty line: V1 validation, pending pilot, flagged over-refusal.
