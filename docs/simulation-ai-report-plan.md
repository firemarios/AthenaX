# Simulation AI report + impact upgrade — implementation plan

Status: IN PROGRESS. If the session was compacted, read this file first, then continue
from the checklist at the bottom.

## Goal

Make the simulation detail page show meaningful, non-zero, flexible AI reports instead of
fixed panels, and make impact reports populate more than Society/Mobility.

## Decisions (defaults chosen because the user did not answer the questions)

1. Two AI passes: planner (model/params/title) -> run model/economics -> report composer
   (uses actual results). Composer failure must never fail the run; keep legacy AI report.
2. AI impact estimates are merged into the 6 dimensions, clearly marked `source: "ai"`.
   Simulation/economics values win on duplicate keys.
3. Deterministic metrics table, economics, passport, warnings and logs stay below the AI
   report. The AI report is flexible and additive; legacy `AIPlanPanel` remains as fallback.
4. Chart types: bar, line, donut (existing Chart.js stack, no new dependency).

## Root causes found

- Page header uses raw `data.model_name`; planner defaults/falls back to `accessibility`.
- `compute_impact` only maps `results.metrics` keys in `_METRIC_SPECS`; accessibility emits
  3 metrics -> Society + Mobility. `results.economics` and AI estimates are ignored.
- `_normalise_tax` always returns numbers and `AIPlanPanel` renders tax when value is not
  null, so irrelevant cards show 0.
- `AIPlanPanel` is fixed: summary/factors/tax/findings/risks. No custom charts/KPIs/tables.

## Schema additions (`packages/types/src/index.ts`)

```ts
interface Localized { el: string; en: string } // reuse inline shape if no shared type

interface AIReportKpi {
  label: Localized;
  value: number | string;
  unit?: string;
  hint?: Localized;
  tone?: "positive" | "negative" | "neutral";
}
interface AIReportDataset {
  label: Localized;
  data: number[];
  color?: string;
}
interface AIReportChart {
  type: "bar" | "line" | "donut";
  title: Localized;
  labels: Localized[];
  datasets: AIReportDataset[];
  unit?: string;
  format?: "number" | "currency" | "percent";
  horizontal?: boolean;
}
interface AIReportTable {
  title?: Localized;
  columns: Localized[];
  rows: (string | number)[][];
}
type AIReportBlock =
  | { kind: "kpis"; items: AIReportKpi[] }
  | { kind: "chart"; chart: AIReportChart }
  | { kind: "table"; table: AIReportTable }
  | { kind: "text"; text: Localized }
  | { kind: "findings"; items: Localized[] }
  | { kind: "risks"; items: Localized[] };

interface AIReportSection {
  title: Localized;
  description?: Localized;
  blocks: AIReportBlock[];
}
interface AIEstimatedMetric {
  key: string;
  label: Localized;
  value: number;
  baseline?: number | null;
  unit?: string;
  confidence?: number;
  source?: "ai";
}
interface AIImpactEstimate {
  dimension: string; // environment|society|economy|mobility|quality_of_life|administration
  name: string;
  label: Localized;
  value: number;
  baseline?: number | null;
  unit?: string;
  confidence?: number;
  note?: Localized;
}
```

Extend `AISimulationPlan` with `title?`, `model_reason?`, `sections?`, `metrics?`, `impact?`.
Keep existing `factors/tax/report/assumptions/limitations` for backwards compatibility.

Add `label?: { el: string; en: string }` to `ModelSpec`.
Add `source?: "simulation" | "ai" | "economics"` and `note?: { el: string; en: string }` to
`ImpactIndicator`.

## Backend

### Model display names

- `services/simulation_engine/model_spec.py`: add `label: dict = field(default_factory=dict)`.
- Each model spec (`accessibility.py`, `greenspace.py`, `traffic_sumo.py`, `cost.py`) gets:
  - accessibility: `{"el": "Προσβασιμότητα πεζών", "en": "Walk accessibility"}`
  - greenspace: `{"el": "Πράσινο & πάρκα", "en": "Green space & parks"}`
  - traffic_sumo: `{"el": "Κυκλοφορία", "en": "Traffic"}`
  - cost: `{"el": "Κόστος έργου", "en": "Project cost"}`
- `/v1/models` already uses `asdict(spec)`, so the label is exposed automatically.

### Planner (`services/ai_engine/policy_planner.py`)

- Prompt: require `title` (short scenario name) and `model_reason` (why this model); keep
  model aliases/normalization; no zero placeholders for inapplicable factors.
- Add `_normalise_localized`, `_normalise_sections`, `_normalise_ai_metrics`,
  `_normalise_ai_impact`, `_normalise_chart` helpers (exported for the composer).
- Add `title`/`model_reason` normalization to `_normalise_plan`.
- Keep `_normalise_tax` shape for compatibility; frontend hides zero cards.

### New composer (`services/ai_engine/report_composer.py`)

`async def compose_simulation_report(*, policy, plan, metrics, baseline, uncertainty,
economics, passport, warnings) -> dict | None`

- Build a compact JSON-only prompt containing policy context, chosen model/params, actual
  metrics/baseline/uncertainty, economics and passport assumptions.
- Ask for 3-6 sections; blocks: kpis/chart/table/text/findings/risks; charts
  bar/line/donut; bilingual el/en; use actual metrics where available; custom AI metrics
  only when useful; no zeros/null placeholders; no HTML/markdown/URLs.
- Call the configured provider (same helper as planner), `temperature=0.25`,
  `max_tokens=16000`, timeout 180s. The configured reasoning model spends most of a
  small budget on hidden reasoning, so a high cap plus "Do not write reasoning" is
  required to get JSON content back.
- Parse + normalize via planner helpers; return `{title?, model_reason?, sections,
  metrics, impact}` or `None` on any failure (log warning, never raise).

### API flow (`apps/api/app/api/v1/simulations.py`)

After metrics/baseline/economics are computed and status is succeeded:
- call `compose_simulation_report(...)` with the policy dict, `ai_plan`, metrics,
  baseline, uncertainty, economics, passport, warnings;
- `ai_plan.update(composed)` for non-empty fields;
- keep `results["ai"] = ai_plan`;
- composer errors must be caught and logged.

### Impact (`services/reporting_engine/impact.py`)

- `compute_impact(metrics, baseline=None, economics=None, ai_impact=None)`.
- Metric indicators get `source: "simulation"`.
- Economy dimension gets economics indicators (capex, annual benefit, net annual,
  benefit-cost ratio, payback) with `source: "economics"`, unit and confidence.
- Merge `ai_impact` items: map dimension aliases, skip duplicate `name` (simulation wins),
  clamp confidence, add `source: "ai"` and optional note.
- Fix Greek typo `πόδις` -> `πόδια`.
- `apps/api/app/api/v1/impact.py`: pass `economics=results.get("economics")` and
  `ai_impact=(results.get("ai") or {}).get("impact")`.

## Frontend

### Charts (`apps/web/app/_shared/charts.tsx`)

- Register `LineElement`, `PointElement` (and `Filler` only if area fill is used).
- Export/reuse palette + tooltip/axis options.
- Add generic `AIChart({ chart })` for bar/line/donut; bilingual labels; format numbers,
  currency, percent; horizontal bars; palette colors; `aria-label`.
- Keep `AIPlanPanel` for legacy runs; hide tax block when all values are zero and skip
  zero-valued factors.

### New report renderer (`apps/web/app/_shared/ai-report.tsx`)

- `AIReportView({ ai, modelLabel })`: if `ai.sections?.length` render sections/blocks,
  otherwise `<AIPlanPanel ai={ai} />`.
- Blocks: KPI grid (use `StatCard`), chart (`AIChart`), table, text, findings, risks.
- Show `model_reason`, AI-estimate badges, source badges, empty-safe rendering.
- No `dangerouslySetInnerHTML`.

### Simulation page (`apps/web/app/simulations/[id]/page.tsx`)

- Header title: `ai.title` -> policy/model label; subtitle: model label + version + area.
- Replace direct `AIPlanPanel` usage with `AIReportView`.
- Add a compact run meta row: run id (copy), created time, area, seed.
- Export `METRIC_LABELS`/metric label helper and use human labels in the metrics table.
- Keep deterministic metrics/economics/passport/warnings/logs.

### Impact UI

- `apps/web/app/_shared/impact.tsx` and `apps/web/app/impact/[id]/page.tsx`: render source
  badges (Simulation / Economics / AI estimate) and notes; empty dimension copy becomes
  "No indicators for this model"; keep all 6 dimensions visible.
- Fix Greek labels.

## Tests / verification

- `python -m pytest apps/api/tests/test_ai_policy.py -q` (expect existing tests + new ones).
- Add tests for composer normalizers (invalid blocks dropped, caps, NaN rejected) and impact
  merge (economics + AI + source).
- `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- Manual: run an AI simulation, confirm title/model label, custom charts/KPIs, non-zero
  cards, >2 impact dimensions, AI badges, legacy run still renders.

## Checklist

- [x] Write this plan file.
- [x] Types: AI report schema, `ModelSpec.label`, `ImpactIndicator.source/note`.
- [x] Backend model labels.
- [x] Planner prompt/normalizers (`title`, `model_reason`, sections/metrics/impact).
- [x] Composer service.
- [x] Wire composer into simulations API.
- [x] Impact economics + AI merge + API wiring + typo.
- [x] Charts: line registration + generic AIChart + hide zero legacy cards.
- [x] `ai-report.tsx` renderer.
- [x] Simulation page header/run meta/metric labels/report renderer.
- [x] Impact UI source badges + empty copy.
- [x] Tests + tsc/lint/build.
- [x] Manual verification/screenshots.

Verified 2026-11-13: 17 pytest tests pass, `tsc --noEmit` clean, eslint clean,
`next build` succeeds, AI run renders flexible sections/charts/tables and the impact
page merges simulation + economics + AI sources without duplicate capex rows. A new
accessibility AI run (`eed93ee99644460a925500511ae65ea7`) now returns 3 populated
impact dimensions: society, economy, mobility.

## Environment notes

- Repo: `C:\MyApps\Sites\athenax-v2 - Copy`.
- Dev: `http://localhost:3000` (do NOT use 127.0.0.1 for dev hydration).
- API: `http://localhost:8000`; DB: repo-root `storage/policylab.db`.
- Commands: `& "C:\Program Files\nodejs\npm.cmd" run build`,
  `& "C:\Program Files\nodejs\npx.cmd" tsc --noEmit`, `npm.cmd run lint`.
- Python tests: `$env:PYTHONIOENCODING="utf-8"` then
  `python -m pytest apps/api/tests/test_ai_policy.py -q`.
- No new dependencies.
