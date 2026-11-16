export type Lang = "el" | "en";

export interface ApiError {
  code: number;
  message: string;
  details?: { field: string; message: string }[];
}

export interface Envelope<T> {
  ok: boolean;
  data: T | null;
  meta: Meta | null;
  error: ApiError | null;
}

export interface Meta {
  request_id?: string;
  timestamp?: string;
  total?: number;
  page?: number;
  page_size?: number;
  sources?: string[];
  limitations?: string[];
  record_count?: number;
  ui?: {
    show_map?: boolean;
    empty_state?: boolean;
    suggested_actions?: string[];
    alert?: string | null;
  };
  [k: string]: unknown;
}

export interface Quality {
  completeness: number | null;
  freshness: number | null;
  validity: number | null;
  validation_status: "pending" | "valid" | "invalid" | "warning";
}

export interface Provenance {
  source_version: string | null;
  retrieved_at: string | null;
  checksum?: string | null;
}

export interface Dataset {
  id: string;
  title: string;
  description: string | null;
  provider: string | null;
  original_source: { name: string; url: string };
  format: string | null;
  geographic_scope: string | null;
  category: string | null;
  license: string | null;
  last_updated: string | null;
  tags: string[];
  quality: Quality;
  provenance: Provenance;
  resources: { title: string; url: string; format: string; size_bytes: number | null }[];
  related_ids: string[];
}

export interface Source {
  id: string;
  name: string;
  provider: string | null;
  source_type: string;
  base_url: string | null;
  license: string | null;
  update_frequency: string | null;
  status: "healthy" | "degraded" | "down" | "unknown";
  reliability: number | null;
  last_checked_at: string | null;
  dataset_count?: number;
}

export interface Decision {
  id: string;
  title: string;
  org: string | null;
  decision_type: string | null;
  date: string | null;
  url: string;
  project_id: string | null;
  extra?: Record<string, unknown>;
}

export interface Project {
  id: string;
  name: string;
  status: string | null;
  org: string | null;
  budget: number | null;
  url: string | null;
  decisions: Decision[];
  geometry: GeoJSON.Geometry | null;
}

export interface CityLayer {
  id: string;
  title: { el: string; en: string };
  geometry_type: string;
  source: string;
  description?: string;
  feature_count: number;
}

export interface AIAnswer {
  detailed_result: string;
  summary: string;
  sources: { url: string; title: string }[];
  limitations: string[];
}

export interface ModelSpec {
  name: string;
  version: string;
  category: string;
  description: { el: string; en: string };
  label?: { el: string; en: string };
  parameters: {
    name: string;
    type: string;
    default: unknown;
    min?: number;
    max?: number;
    label: { el: string; en: string };
  }[];
}

export interface PolicyVariant {
  id: string;
  policy_id: string;
  title: string;
  parameters: Record<string, unknown>;
}

export interface PolicyFactor {
  name: string;
  label?: string | null;
  baseline: number;
  min: number;
  max: number;
  step?: number | null;
  unit?: string | null;
}

export interface AIPlanFactor {
  name: string;
  label?: { el: string; en: string } | null;
  value?: number | string | null;
  unit?: string | null;
  reason?: { el: string; en: string } | null;
}

export interface AITaxEstimate {
  new_buildings: number | null;
  tax_change_pct: number | null;
  annual_tax_revenue_eur: number | null;
  rationale?: { el: string; en: string } | null;
}

export interface AIReportKpi {
  label: { el: string; en: string };
  value: number | string;
  unit?: string;
  hint?: { el: string; en: string };
  tone?: "positive" | "negative" | "neutral";
}

export interface AIReportDataset {
  label: { el: string; en: string };
  data: number[];
  color?: string;
}

export interface AIReportChart {
  type: "bar" | "line" | "donut";
  title: { el: string; en: string };
  labels: { el: string; en: string }[];
  datasets: AIReportDataset[];
  unit?: string;
  format?: "number" | "currency" | "percent";
  horizontal?: boolean;
}

export interface AIReportTable {
  title?: { el: string; en: string };
  columns: { el: string; en: string }[];
  rows: (string | number)[][];
}

export type AIReportBlock =
  | { kind: "kpis"; items: AIReportKpi[] }
  | { kind: "chart"; chart: AIReportChart }
  | { kind: "table"; table: AIReportTable }
  | { kind: "text"; text: { el: string; en: string } }
  | { kind: "findings"; items: { el: string; en: string }[] }
  | { kind: "risks"; items: { el: string; en: string }[] };

export interface AIReportSection {
  title: { el: string; en: string };
  description?: { el: string; en: string };
  blocks: AIReportBlock[];
}

export interface AIEstimatedMetric {
  key: string;
  label: { el: string; en: string };
  value: number;
  baseline?: number | null;
  unit?: string;
  confidence?: number;
  source?: "ai";
}

export interface AIImpactEstimate {
  dimension: string;
  name: string;
  label: { el: string; en: string };
  value: number;
  baseline?: number | null;
  unit?: string;
  confidence?: number;
  note?: { el: string; en: string };
}

export interface AISimulationPlan {
  ai_used: boolean;
  model: string;
  parameters: Record<string, unknown>;
  factors: AIPlanFactor[];
  tax: AITaxEstimate;
  benefit?: {
    annual_benefit_eur: number | null;
    rationale: { el: string; en: string };
  };
  grounding_used?: string[];
  report: {
    summary: { el: string; en: string };
    findings: { el: string; en: string }[];
    risks: { el: string; en: string }[];
  };
  confidence: number;
  assumptions: { el: string; en: string }[];
  limitations: string[];
  title?: { el: string; en: string };
  model_reason?: { el: string; en: string };
  sections?: AIReportSection[];
  metrics?: AIEstimatedMetric[];
  impact?: AIImpactEstimate[];
}

export interface Policy {
  id: string;
  title: string;
  description: string | null;
  changes?: string | null;
  category: string;
  status: string;
  area: string | null;
  horizon: string | null;
  parameters: Record<string, unknown>;
  factors?: PolicyFactor[];
  budget_eur?: number | null;
  assumptions: string[];
  kpis: string[];
  variants: PolicyVariant[];
  created_at: string;
}

export interface EconomicsLine {
  label: { el: string; en: string };
  amount_eur: number;
  quantity?: number;
  unit?: string;
}

export interface PolicyEconomics {
  currency: "EUR";
  capex_eur: number;
  capex_low_eur: number;
  capex_high_eur: number;
  annual_maintenance_eur: number;
  annualized_cost_eur: number;
  annual_benefit_eur: number;
  benefit_source?: "model" | "ai" | "heuristic" | "none";
  annual_tax_revenue_eur?: number;
  new_buildings?: number | null;
  net_annual_eur: number;
  benefit_cost_ratio: number | null;
  payback_years: number | null;
  budget_eur: number | null;
  within_budget: boolean | null;
  verdict: "yes" | "marginal" | "no" | "unknown";
  confidence: number;
  cost_breakdown: EconomicsLine[];
  benefit_breakdown: EconomicsLine[];
  summary: { el: string; en: string };
  assumptions: { el: string; en: string }[];
}

export interface Passport {
  model_name: string;
  model_version: string;
  data_sources: { name: string; url?: string; retrieved_at?: string }[];
  assumptions: string[];
  reliability_limits: string;
  uncertainty: string;
  validated_by: string | null;
  executed_at: string;
  seed: number | null;
  inputs_checksum: string;
}

export interface SnapshotSource {
  name: string;
  url?: string;
  kind?: "database" | "live" | "synthetic" | string;
  retrieved_at?: string;
}

export interface SnapshotCoverage {
  parks: string;
  facilities: string;
  population_points: string;
}

export interface SnapshotReach {
  population: number | null;
  area_km2: number | null;
  facilities: number | null;
  parks?: number | null;
}

export interface SimulationSnapshot {
  area_id: string;
  area?: {
    id?: string;
    name_el?: string;
    name_en?: string;
    lat?: number;
    lon?: number;
    radius_m?: number;
  };
  bbox?: number[];
  mode: "snapshot" | "synthetic" | string;
  coverage?: SnapshotCoverage;
  observed?: Record<string, number>;
  sources?: SnapshotSource[];
  reach?: SnapshotReach;
  retrieved_at?: string;
  degraded?: boolean;
}

export interface SensitivityMovement {
  low: number;
  high: number;
  base: number;
  swing: number;
}

export interface SensitivityParameter {
  parameter: string;
  step: number;
  low_input: number;
  high_input: number;
  total_swing: number;
  metrics: Record<string, SensitivityMovement>;
}

export interface SimulationSensitivity {
  method: "one_at_a_time" | string;
  step: number;
  parameters: SensitivityParameter[];
  note?: string;
}

export interface SimulationRun {
  id: string;
  policy_id: string | null;
  model_name: string;
  model_version: string;
  parameters: Record<string, unknown>;
  results: {
    metrics: Record<string, number>;
    baseline?: Record<string, number>;
    uncertainty?: Record<string, [number, number]>;
    economics?: PolicyEconomics;
    ai?: AISimulationPlan;
    snapshot?: SimulationSnapshot;
    sensitivity?: SimulationSensitivity;
  } | null;
  status: "queued" | "running" | "succeeded" | "failed";
  passport: Passport | null;
  created_at: string;
  error: string | null;
  seed?: number | null;
  snapshot_mode?: string | null;
}

export interface ImpactIndicator {
  name: string;
  label: { el: string; en: string };
  baseline: number | null;
  value: number;
  delta: number | null;
  unit: string;
  direction: "up" | "down" | "neutral";
  confidence: number;
  source?: "simulation" | "ai" | "economics";
  note?: { el: string; en: string };
}

export interface ImpactDimension {
  key: string;
  label: { el: string; en: string };
  indicators: ImpactIndicator[];
}

export interface ImpactReport {
  run_id: string;
  dimensions: ImpactDimension[];
  summary: { el: string; en: string };
  reach?: SnapshotReach;
  snapshot?: SimulationSnapshot | null;
}

export interface Proposal {
  id: string;
  title: string;
  description: string;
  area: string | null;
  category: string | null;
  status: string;
  created_at: string;
  comments_count: number;
}

export interface Comment {
  id: string;
  proposal_id: string;
  body: string;
  created_at: string;
}

export interface Consultation {
  id: string;
  title: string;
  description: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  proposals: Proposal[];
}

export interface ResearchProject {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  experiments: {
    id: string;
    title: string;
    model: string;
    run_ids: string[];
    notes: string | null;
  }[];
}

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description: string | null;
}

export interface AuditLog {
  id: string;
  method: string;
  path: string;
  status: number;
  ip: string | null;
  created_at: string;
}

/**
 * Minimal local GeoJSON namespace (no dependencies).
 * Structurally compatible with @types/geojson so values can be passed
 * straight into maplibre-gl source/layer APIs.
 */
export namespace GeoJSON {
  export type Position = [number, number] | [number, number, number];
  export type BBox =
    | [number, number, number, number]
    | [number, number, number, number, number, number];
  export type GeoJsonProperties = Record<string, unknown> | null;

  export interface Point {
    type: "Point";
    coordinates: Position;
    bbox?: BBox;
  }

  export interface MultiPoint {
    type: "MultiPoint";
    coordinates: Position[];
    bbox?: BBox;
  }

  export interface LineString {
    type: "LineString";
    coordinates: Position[];
    bbox?: BBox;
  }

  export interface MultiLineString {
    type: "MultiLineString";
    coordinates: Position[][];
    bbox?: BBox;
  }

  export interface Polygon {
    type: "Polygon";
    coordinates: Position[][];
    bbox?: BBox;
  }

  export interface MultiPolygon {
    type: "MultiPolygon";
    coordinates: Position[][][];
    bbox?: BBox;
  }

  export interface GeometryCollection {
    type: "GeometryCollection";
    geometries: Geometry[];
    bbox?: BBox;
  }

  export type Geometry =
    | Point
    | MultiPoint
    | LineString
    | MultiLineString
    | Polygon
    | MultiPolygon
    | GeometryCollection;

  export interface Feature<
    G extends Geometry | null = Geometry,
    P = GeoJsonProperties,
  > {
    type: "Feature";
    geometry: G;
    properties: P;
    id?: string | number;
    bbox?: BBox;
  }

  export interface FeatureCollection<
    G extends Geometry | null = Geometry,
    P = GeoJsonProperties,
  > {
    type: "FeatureCollection";
    features: Feature<G, P>[];
    bbox?: BBox;
  }

  export type GeoJSON = Geometry | Feature | FeatureCollection;
}
