# Day-4 freeze manifest

- Frozen at: **2026-11-14T09:53:15.892978+00:00**
- Branch: `master`
- Git HEAD: `4d3ed1b6a68d` - 202611141013
- Working tree: **67** changed/untracked paths (left uncommitted; commit is left to the operator).

## Gates re-run after the last edit

| Gate | Result |
|---|---|
| `python -m pytest` | **85 passed** |
| `python -m ruff check .` | **All checks passed** |
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `npm run build` | pass (22 routes) |
| `python scripts/claims_audit.py` | **46/46 claims verified** |
| E2E smoke (timed dry run) | **21 checks**, 115.4s journey |
| Offline fallback check | **PASS** (dead LLM + no live data) |

## Frozen artifacts (sha256, first 16 hex)

| Artifact | Bytes | sha256 |
|---|---|---|
| `.github/workflows/ci.yml` | 1,044 | `6b422b26d092813b` |
| `infrastructure/deployment/smoke.ps1` | 7,805 | `af519be83ad5185e` |
| `scripts/ai_eval.py` | 9,182 | `943314080cb0f12e` |
| `scripts/claims_audit.py` | 8,827 | `3aafafb791f36325` |
| `scripts/demo_dry_run.py` | 8,736 | `ae6b7258ee05a3a2` |
| `scripts/fallback_check.py` | 7,178 | `83ed6e316b5ebc34` |
| `scripts/connector_health.py` | 5,330 | `8eae212d1bbb8bf1` |
| `scripts/validate_model.py` | 6,386 | `8cc6aaaa0f37767c` |
| `apps/api/app/metrics.py` | 5,552 | `8d00b9777d964669` |
| `services/data_ingestion/snapshot.py` | 15,828 | `eb9e5bf6d118a99e` |
| `services/reporting_engine/sensitivity.py` | 4,349 | `bfcbfaa7596c61c1` |
| `packages/types/src/index.ts` | 12,661 | `7200c4f6c502f311` |
| `apps/web/app/simulations/[id]/page.tsx` | 34,451 | `2b1986d87f7ab04a` |
| `apps/web/app/impact/[id]/page.tsx` | 17,718 | `12132fbabdd62c3e` |
| `data/source-registry/catalog.berlin.yaml` | 3,979 | `a727541736e72a25` |
| `docs/slides/pitch-6-slides.md` | 5,168 | `c46de0b880eeacfb` |
| `docs/evidence/smoke.md` | 1,045 | `e784986603825fb3` |
| `docs/evidence/dry-run.md` | 2,186 | `38b568f454413f6b` |
| `docs/evidence/fallback-check.md` | 949 | `de2f94483f7542fb` |
| `docs/evidence/claims-audit.md` | 5,170 | `4622a4debe7448d0` |
| `docs/evidence/rehearsal.md` | 3,599 | `7630916eabbd318a` |
| `docs/evidence/ai-eval.md` | 1,990 | `505eb16535b96d06` |
| `docs/evidence/ai-eval.json` | 11,130 | `6869be937bde2e6d` |
| `docs/evidence/ai-eval-notes.md` | 2,485 | `b5ae157114ad7ae2` |
| `docs/evidence/connector-health.md` | 2,768 | `60f089fce8a17c1d` |
| `docs/evidence/model-sensitivity.md` | 3,466 | `9a09f6aa49ca0096` |

## Freeze rule

After this manifest, do not change code or evidence unless you re-run the gates and this
manifest. A mismatch between a file and the hash above means the freeze is broken.

Manual steps still outside the repo: record the 90-second backup video and open the UI
once in a browser (see `rehearsal.md`).

## Post-freeze hotfix (2026-11-14T12:20Z)

A live run showed Failed to proxy ... /v1/simulations: socket hang up (ECONNRESET) twice.
Direct API calls and the Next proxy then passed 5/5 simulation POSTs, so it was a transient
reset: the API was launched with uvicorn --reload, and a reload drops in-flight requests;

ext dev can do the same while compiling. No application code changed.

- infrastructure/deployment/dev.ps1 (e7fd77ebec4591bf): added -NoReload (no
  --reload) and -Prod (
pm run build + 
ext start); demo path is now
  dev.ps1 -Web -NoReload -Prod. Parse-checked; API restarted without --reload.
- docs/DEMO.md (7cbc60bfbf15ac1): pre-demo command updated and an ECONNRESET
  fallback row added.
- Verification after the hotfix: /health ok (db ok, llm ok); proxy
  POST /api/v1/simulations 200 in 0.17s; running uvicorn command line has no --reload.

## Post-freeze fix: AI model selection (2026-11-14T12:35Z)

Unrelated policies produced walk-accessibility reports because the planner fell back to
`accessibility` for any category it did not recognise (including `services`/GovTech) and
because Greek keyword matching was accent-sensitive (`πράσιν` never matched `πρασίνου`).
The LLM was also free to pick accessibility by analogy for digital access.

- `services/ai_engine/policy_planner.py` (`03254929159d0648`): accent-folded, word-aware
  keyword routing; `services`/digital/platform/data/procurement -> `cost`; default fallback
  is now `cost`, not `accessibility`; accessibility only for explicit physical-proximity
  wording. LLM output is guarded against accessibility for non-physical policies; an
  explicit requested model is now honoured.
- `services/ai_engine/report_composer.py` (`aba52a4745e41f35`): only mention accessibility/
  walkability when the selected model or metrics actually measure it.
- `apps/api/tests/test_ai_policy.py` (`fcc541acf61e822e`): 3 new tests (services -> cost,
  accented Greek -> greenspace, explicit model honoured).

Verification: `python -m pytest` 88 passed; `python -m ruff check .` clean. Live AI run on
the GovTech policy (137.8s): model `cost`, `ai_used=true`, and the run JSON contains no
accessibility/walk/foot term.
