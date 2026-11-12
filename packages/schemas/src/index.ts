import datasetSchemaJson from "../json/dataset.schema.json";
import policySchemaJson from "../json/policy.schema.json";
import simulationSchemaJson from "../json/simulation.schema.json";
import type { AIAnswer, Dataset, Envelope } from "@policylab/types";

export const datasetSchema = datasetSchemaJson;
export const policySchema = policySchemaJson;
export const simulationSchema = simulationSchemaJson;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Runtime check for a minimal valid Dataset shape. */
export function isDataset(value: unknown): value is Dataset {
  if (!isPlainObject(value)) return false;
  if (typeof value.id !== "string" || value.id.length === 0) return false;
  if (typeof value.title !== "string" || value.title.length === 0) return false;
  if (!isPlainObject(value.original_source)) return false;
  if (typeof value.original_source.name !== "string") return false;
  if (typeof value.original_source.url !== "string") return false;
  if (!Array.isArray(value.tags)) return false;
  if (!Array.isArray(value.resources)) return false;
  if (!Array.isArray(value.related_ids)) return false;
  if (!isPlainObject(value.quality)) return false;
  const status = value.quality.validation_status;
  if (
    status !== "pending" &&
    status !== "valid" &&
    status !== "invalid" &&
    status !== "warning"
  ) {
    return false;
  }
  if (!isPlainObject(value.provenance)) return false;
  return true;
}

/** Runtime check for the response envelope shape. */
export function isEnvelope<T = unknown>(value: unknown): value is Envelope<T> {
  if (!isPlainObject(value)) return false;
  if (typeof value.ok !== "boolean") return false;
  if (!("data" in value)) return false;
  if (!("error" in value)) return false;
  if (value.error !== null && !isPlainObject(value.error)) return false;
  if (
    isPlainObject(value.error) &&
    typeof value.error.code !== "number" &&
    typeof value.error.code !== "string"
  ) {
    return false;
  }
  return true;
}

/** Runtime check for a minimal valid AIAnswer shape. */
export function isAIAnswer(value: unknown): value is AIAnswer {
  if (!isPlainObject(value)) return false;
  if (typeof value.summary !== "string") return false;
  if (typeof value.detailed_result !== "string") return false;
  if (!Array.isArray(value.sources)) return false;
  for (const source of value.sources) {
    if (!isPlainObject(source)) return false;
    if (typeof source.url !== "string") return false;
    if (typeof source.title !== "string") return false;
  }
  if (!Array.isArray(value.limitations)) return false;
  if (!value.limitations.every((item) => typeof item === "string")) return false;
  return true;
}
