# Validation Report — `<model_name>` v`<version>`

> Copy this file to `research/validation/<model_name>-v<version>.md` and fill every section.
> Methodology: [`../methodology/README.md`](../methodology/README.md).
> A model without a completed report is **unvalidated** (V0): `validated_by` stays `null`
> and the UI must show the unvalidated warning.

| Field | Value |
|---|---|
| **Model** | e.g. `greenspace` |
| **Version** | e.g. `1.0.0` (must match `model_registry` / passport) |
| **Validation level** | V0 / V1 / V2 / V3 (see methodology §2.1) |
| **Date** | YYYY-MM-DD |
| **Reviewer(s)** | name(s) — required for ≥ V1 |
| **Status** | draft / reviewed / accepted |

---

## 1. Purpose & scope

- **Intended use:** what decisions/questions this model supports.
- **Explicitly out of scope:** uses that must NOT rely on this model.
- **Related PRD KPI:** e.g. K4 (validated pilot model).

## 2. Inputs

| Parameter | Type | Default | Min–Max | Label (el / en) | Notes |
|---|---|---|---|---|---|
| | | | | | |

- **Data sources** (name, URL, `retrieved_at`) — must match passport `data_sources[]`:

  | Source | URL | Retrieved at | Licence |
  |---|---|---|---|
  | | | | |

- **Input snapshot / `inputs_checksum`:** `...`
- **Seed used for determinism tests:** `...`

## 3. Assumptions

Numbered list — each assumption must also appear in the runtime passport `assumptions[]`.
Declare fallbacks explicitly (e.g. *"SUMO binary unavailable ⇒ deterministic synthetic
queueing model used"*).

1.
2.

## 4. Method

How the model computes its metrics (formulas, references, data transformations).
Cite the paper/standard/manual where applicable — **no invented citations**.

## 5. Results

### 5.1 Determinism

| Run | Seed | Inputs | Metrics hash / values | Identical? |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |

Pass criterion: identical metrics for identical inputs + seed.

### 5.2 Benchmark / comparison (required for V2+)

| Metric | Reference value | Model value | Abs. error | Rel. error | Tolerance (declared *before* run) | Pass? |
|---|---|---|---|---|---|---|
| | | | | | | |

Reference source (URL + retrieval date):

### 5.3 Sensitivity

| Parameter varied (range) | Metric affected | Response observed | Unexpected? |
|---|---|---|---|
| | | | |

## 6. Uncertainty

- **Method** used to derive intervals (expert range / literature / sensitivity band):
- **Intervals delivered** (must match runtime `uncertainty` shape `[lo, hi]`):

  | Metric | Low | High | Basis |
  |---|---|---|---|
  | | | | |

- **Known failure modes / reliability limits** (passport `reliability_limits` text):

## 7. Limitations & risks

Honest list of what could make results misleading (data gaps, spatial resolution, seasonal
bias, fallback activation, small samples…). This text is user-visible via the passport.

## 8. Conclusion

- [ ] Determinism verified
- [ ] Assumptions reviewed & match passport
- [ ] Benchmark tolerances met (V2+) — or marked V1 with justification
- [ ] Uncertainty ranges documented
- [ ] Reliability limits written for UI display
- [ ] Validation level assigned: **V__**
- [ ] `validated_by` can be set to: ______________________

**Accepted by:** ______________________ **Date:** ____________

---

*File naming: `<model_name>-v<version>.md` · Link this report from the experiment log entry
and, if used in a publication, from `research/reports/`.*
