# POLICYLAB — Validation Methodology

How POLICYLAB audits data sources, validates simulation models, and evaluates pilots.
Outputs live in [`../validation/`](../validation/) (reports) and feed
[`../../docs/PRD.md`](../../docs/PRD.md) KPIs (K4–K7) and the Simulation Passport
(`validated_by`).

**Principle: evidence-first.** A claim of "validated" requires a filled report from
[`../validation/TEMPLATE.md`](../validation/TEMPLATE.md) with a named reviewer — no report,
no `validated_by`, and the UI must show the unvalidated warning.

---

## 1. Data source audits

**Goal:** every connected source is trustworthy, licensed and honestly described.

| Check | Method | Pass criteria |
|---|---|---|
| **Availability** | connector `health()` + `POST /v1/sources/{id}/health` | `status: healthy|degraded` with latency recorded; `down` sources documented, not hidden |
| **Licence** | read portal + dataset-level terms | licence recorded per §1 of [`docs/data-governance/README.md`](../../docs/data-governance/README.md); display-only if ambiguous |
| **Freshness** | compare `last_updated` vs `fetched_at` vs stated `update_frequency` | staleness within 2× stated frequency, else `degraded` + limitation surfaced |
| **Completeness** | `score_quality()` on a sample (≥ 30 records or full page) | completeness ≥ 0.7 or known gaps documented in dataset description |
| **Schema stability** | diff normalized output across two fetches | unexpected field/type changes flagged; connector updated or limitation noted |
| **Attribution** | UI + export spot-check | source name + URL + licence visible on dataset detail, AI sources, exports |

**Cadence:** on connector introduction, monthly for `P0` sources, quarterly for `P1`.
**Evidence:** store sample raw snapshot (retained per retention policy) + quality report ids
in the audit notes.

## 2. Model validation

**Goal:** each simulation model is honest about what it computes, how well, and when not to
trust it.

### 2.1 Levels

| Level | Name | Requirements | Effect |
|---|---|---|---|
| **V0** | Unvalidated | model implemented + unit tests pass | `validated_by: null` → UI shows "μη επαληθευμένο / not validated" badge |
| **V1** | Face-valid | V0 + assumptions reviewed + sanity bounds documented + reviewer named in report | usable in demos with visible caveat |
| **V2** | Benchmark-validated | V1 + comparison against a reference/baseline dataset or published method, error metrics reported | `validated_by: <reviewer>`; suitable for pilot studies |
| **V3** | Field-validated | V2 + evaluation against observed local (Athens) data with domain-expert sign-off | may be cited in published reports |

MVP target (PRD K4): **at least one model at V1/V2** with a completed report in
`research/validation/`.

### 2.2 Procedure

1. **Scope** — model name/version, intended use, explicitly out-of-scope uses.
2. **Inputs** — every parameter with type/range/default/label; data sources with URLs and
   `retrieved_at`; `inputs_checksum` computed on the parameter snapshot.
3. **Assumptions** — enumerated (must match passport `assumptions[]`); fallback paths
   (e.g. SUMO → synthetic queueing) declared explicitly.
4. **Determinism test** — same inputs + seed twice ⇒ identical metrics (automated test).
5. **Sensitivity** — vary each parameter across its range; record which metrics move and how;
   document non-monotonic or surprising responses.
6. **Benchmark / comparison** — V2+: run against reference values (published study, official
   statistic, observed count); report absolute/relative error; state tolerance *before* running.
7. **Uncertainty** — define intervals (method: expert range, literature, sensitivity band)
   that become passport `uncertainty` and UI ranges.
8. **Failure modes** — list conditions producing misleading output; these become
   `reliability_limits` text.
9. **Review** — a second person (or named external reviewer) signs the report; fill
   `validated_by`.
10. **Publish** — report filed in `research/validation/`, linked from the experiment log and,
    if used, from `research/reports/`.

## 3. Pilot evaluation

**Goal:** prove the platform changes understanding or decisions — not just that code runs.

| Pilot | Participants (PRD K7) | Evidence collected | Success signal |
|---|---|---|---|
| **Citizen Lab consultation** | 30–50 pilot participants | proposals, comments, consultation engagement (aggregate counts only — no personal data) | ≥ 30 submissions/comments; disclaimer shown on 100% of surfaces |
| **Policy scenario demo** (flagship journey) | officers/policymakers in workshop | 2–3 baseline-vs-scenario comparisons run end-to-end (K5) | participants can read passport + impact report unaided |
| **Research reproduction** | researcher | ≥ 1 exported report with provenance (K6) reproduced by a second person from the passport | identical metrics from same inputs/seed |

**Method:** pre/post short questionnaire (offline, not stored in the platform), workshop
observation notes, and platform-side aggregate metrics (no accounts ⇒ no per-user tracking).
**Ethics:** anonymous participation only; no personal data collected (data governance §4).

## 4. Cadence & ownership

| Activity | When | Output |
|---|---|---|
| Source audit | on introduction + monthly (P0) / quarterly (P1) | audit note + updated health/quality |
| Model validation | before claiming "validated" in UI or reports; re-run on model version bump | `research/validation/<model>-v<version>.md` |
| Pilot evaluation | per pilot cycle | section in `research/reports/` |
| Experiment log | every meaningful run batch | `research/experiments/` entry (see its README) |

Questions or deviations: open an issue referencing this file — methodology changes are
reviewed like code changes.
