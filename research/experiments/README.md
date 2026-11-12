# POLICYLAB — Experiment Log

This folder records **what was run, with what inputs, and what it showed** — the connective
tissue between the platform (`/research` module), validation
([`../validation/`](../validation/)) and published reports
([`../reports/`](../reports/)).

## Conventions

- **One markdown file per experiment batch**: `YYYY-MM-DD-<slug>.md`
  (e.g. `2026-03-04-exarchia-traffic-baseline.md`).
- **Immutable log entries**: append corrections as a new dated section; do not rewrite
  history (auditability).
- Every entry links: run ids (`/simulations/[id]`), model + version, passport
  `inputs_checksum`, validation report (if any), and source datasets.
- **Evidence-first**: claims cite run ids, dataset ids or report files — no unsourced numbers.
- No personal data, no secrets, no raw third-party data dumps (see
  [`docs/data-governance/README.md`](../../docs/data-governance/README.md)).

## Entry template

```markdown
# <YYYY-MM-DD> — <short title>

- **Author:** <name/role or "workshop">
- **Goal:** what question this batch answers
- **Model(s):** <name> v<version> (validation: V__ / report: ../validation/<file>)
- **Run ids:** <uuids or /simulations links>
- **Inputs / seed / inputs_checksum:** ...
- **Datasets used:** <ids + sources>

## What was run
Steps, parameter sweeps, comparisons (baseline vs scenario).

## Results
Metrics tables, screenshots references, links to impact reports (`/v1/impact/{run_id}`).

## Interpretation
What the numbers do and do not show (limitations carried over from the passport).

## Next actions
Follow-ups, open questions, links to reports or issues.
```

## Relationship to other folders

| Folder | Holds |
|---|---|
| `research/experiments/` | this log — raw activity record |
| `research/validation/` | signed validation reports (model trust) |
| `research/reports/` | polished, citable outputs |
| `apps/web /research` | in-product view: projects, experiments, run history, exports |
| `docs/PRD.md` §7 | KPIs this log helps evidence (K4–K6) |
