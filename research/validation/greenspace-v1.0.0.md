# Validation Report — `greenspace` v`1.0.0`

| Field | Value |
|---|---|
| **Model** | `greenspace` |
| **Version** | `1.0.0` (matches `model_registry` / passport) |
| **Validation level** | **V1 — methodology review** (determinism + assumptions + failure modes). V2 benchmark is **not** claimed. |
| **Date** | 2026-11-14 |
| **Reviewer(s)** | Assigned project mentor / urban-planning reviewer — name and signature to be added at the review session (see §8). |
| **Status** | draft — pending reviewer signature |

> Honesty note: this report does not claim external predictive validation. It documents what
> the model computes, proves determinism, declares assumptions and failure modes, and shows
> sensitivity. A V2 benchmark (WHO/EEA m² per capita or an official Athens statistic) is only
> claimed when a citable benchmark with a retrieval date is added to §5.2.

---

## 1. Purpose & scope

- **Intended use:** compare park scenarios (number and average size) for a named Athens
  neighbourhood and estimate (a) green m² per capita and (b) the share of the population
  within 300 m of a park. It supports prioritisation and communication, not engineering design.
- **Explicitly out of scope:** predicting actual park usage, health outcomes, property values,
  air-quality effects, or exact cadastral areas. Do not use for legal/permitting decisions.
- **Related PRD KPI:** K4 (validated pilot model) — V1 contributes determinism, assumptions
  and failure-mode transparency.

## 2. Inputs

| Parameter | Type | Default | Min–Max | Label (el / en) | Notes |
|---|---|---|---|---|---|
| `area_id` | str | `exarchia` | — | Περιοχή / Area | Resolved via `city_areas` (DB → catalog.yaml → fixtures) |
| `population` | int | 10000 | 100–1,000,000 | Πληθυσμός / Population | Must be measured for the area; no silent default in a real dossier |
| `park_count` | int | 6 | 0–200 | Πάρκα / Park count | Intervention lever |
| `avg_park_m2` | float | 5000 | 0–10,000,000 | Μέση έκταση πάρκου (m²) / Average park area (m²) | Applied to all parks when no snapshot provides individual areas |

- **Data sources** (must match passport `data_sources[]`):

  | Source | URL | Retrieved at | Licence |
  |---|---|---|---|
  | OpenStreetMap Overpass (live snapshot) | https://overpass-api.de/api/interpreter | runtime (`retrieved_at` in passport) | ODbL 1.0 |
  | AthenaX `city_features` (Overpass ingest) | https://www.openstreetmap.org | ingest time | ODbL 1.0 |
  | Deterministic synthetic fixtures (fallback) | — | runtime | internal, flagged `mode=synthetic` |

- **Input snapshot / `inputs_checksum`:** computed at runtime as SHA-256 of canonical JSON of
  the merged parameters; stored in the passport. No fixed value is quoted here because it
  depends on the scenario.
- **Seed used for determinism tests:** `42`.

## 3. Assumptions

These are the runtime `ASSUMPTIONS` strings in `services/simulation_engine/models/greenspace.py`
and the additional snapshot assumptions:

1. Parks are represented as points with an equivalent circular area
   `radius = sqrt(area_m2 / π)`; geometry is not used.
2. When no snapshot provides individual park areas, every park uses `avg_park_m2`.
3. The 300 m access buffer is measured with haversine great-circle distance; street network,
   barriers and entrances are ignored.
4. Population is modelled as a deterministic point cloud inside the area radius (240 points,
   seed 42) unless a `population` layer exists in `city_features`.
5. Snapshot fallbacks are explicit: `mode=snapshot` means at least one layer came from the DB
   or live OSM; `mode=synthetic` means no external data was available and the numbers are a
   fixture, not a measurement.
6. Census population is assumed uniform within the area unless a weighted population layer is
   supplied.

## 4. Method

For each park `i` with area `A_i` (m²):

```
total_green = Σ A_i
green_m2_per_capita = total_green / population
park_radius_i = sqrt(A_i / π)
covered = |{ p ∈ population_points : ∃ i, haversine(p, park_i) ≤ park_radius_i + 300 m }|
pct_within_300m = 100 · covered / |population_points|
```

`haversine_m` lives in `services/geospatial_engine/queries.py`. The model is pure math: no
randomness except the deterministic synthetic point cloud (`random.Random(seed)`). No external
citation is needed for the formula; the 300 m threshold is a declared planning convention, not
a literature-validated health threshold (that is exactly why it is a V1, not V2, claim).

## 5. Results

All numbers below are reproducible with `python scripts/validate_model.py` (generated file:
`docs/evidence/model-sensitivity.md`).

### 5.1 Determinism

| Run | Seed | Inputs | Metrics | Identical? |
|---|---|---|---|---|
| 1 | 42 | `area_id=exarchia, population=10000, park_count=6, avg_park_m2=5000` | `green_m2_per_capita=3.0, pct_within_300m=77.08, green_area_m2=30000.0` | — |
| 2 | 42 | same | same | **Yes** |

Pass criterion (identical metrics for identical inputs + seed): **met**. The test compares the
full metrics dict, not a rounded display value.

### 5.2 Benchmark / comparison (required for V2+ — NOT claimed)

| Metric | Reference value | Model value | Abs. error | Rel. error | Tolerance (declared before run) | Pass? |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | **not run** |

No benchmark is claimed. The model is **V1**: it is deterministic, documented and sensitivity-
tested, but its absolute values are not validated against an external standard. Any future
benchmark must be added here with URL, retrieval date and a tolerance declared in advance.

### 5.3 Sensitivity

| Parameter varied (range) | Metric affected | Response observed | Unexpected? |
|---|---|---|---|
| `park_count` 0 → 30 | `green_m2_per_capita` | linear 0 → 15.0 (0.5 per park at 5,000 m² / 10,000 people) | No |
| `park_count` 0 → 30 | `pct_within_300m` | 0 → 95.83 %, saturating after ~8 parks | No |
| `avg_park_m2` 0 → 20,000 | `green_m2_per_capita` | linear 0 → 12.0 | No |
| `population` 5,000 → 20,000 | `green_m2_per_capita` | inverse 6.0 → 1.5 | No |
| `max_walk_m` (accessibility model) 100 → 2,000 | `accessibility_pct` | monotone step increase, saturating | No |
| `facility_count` (accessibility model) 0 → 20 | `accessibility_pct` | monotone increase | No |

Key substantive finding: **park count drives 300 m coverage more strongly than total m²** —
fragmentation matters. This is a falsifiable modelling choice and should be challenged in the
review session.

## 6. Uncertainty

- **Method:** declared expert band (not statistical sampling error): ±10 % for
  `green_m2_per_capita`; ±5 percentage points for `pct_within_300m`.
- **Intervals delivered** (matches runtime `uncertainty` shape `[lo, hi]`):

  | Metric | Low | High | Basis |
  |---|---|---|---|
  | `green_m2_per_capita` | 0.9 × value | 1.1 × value | input/geometry uncertainty |
  | `pct_within_300m` | value − 5 pp (≥0) | value + 5 pp (≤100) | point-cloud / geometry uncertainty |

- **Known failure modes / reliability limits** (passport `reliability_limits` text): the model
  is a transparent first-order estimate, not a substitute for cadastral/field measurement.
  Results are only as good as the snapshot; synthetic mode must never be presented as measured
  data.

## 7. Limitations & risks

- **Spatial resolution:** points + circular buffers overestimate access near barriers (rivers,
  motorways, railway lines) and ignore park entrances.
- **Population distribution:** uniform synthetic points can misstate who lives near a park;
  weighted population layers are preferable.
- **Area data:** OSM `area` tags are frequently missing, so park sizes may fall back to the
  scenario average.
- **Fallback activation:** when connectors are down, `mode=synthetic` is shown in the UI and
  passport; a dossier based on synthetic input must say so.
- **Threshold convention:** 300 m is a planning convention, not a health standard; do not
  present it as a WHO recommendation.

## 8. Conclusion

- [x] Determinism verified
- [x] Assumptions reviewed & match passport
- [ ] Benchmark tolerances met (V2+) — **not claimed**
- [x] Uncertainty ranges documented
- [x] Reliability limits written for UI display
- [x] Validation level assigned: **V1**
- [ ] `validated_by` can be set to: assigned project mentor — **after the review session**

**Reviewer acknowledgement:** ______________________________ **Date:** ____________

---

*File naming: `<model_name>-v<version>.md` · Generated sensitivity tables:
`docs/evidence/model-sensitivity.md`.*
