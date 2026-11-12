"use client";

import { Trash2 } from "lucide-react";
import { btnSecondary, inputCls } from "./ui";

export interface KvRow {
  key: string;
  value: string;
}

export function coerceScalar(raw: string): unknown {
  const v = raw.trim();
  if (v === "") return "";
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return raw;
}

export function kvToRows(obj: Record<string, unknown> | null | undefined): KvRow[] {
  if (!obj) return [];
  return Object.entries(obj).map(([key, value]) => ({
    key,
    value:
      value === null || value === undefined
        ? ""
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value),
  }));
}

export function rowsToKv(rows: KvRow[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (!key) continue;
    out[key] = coerceScalar(row.value);
  }
  return out;
}

export function KeyValueEditor({
  idPrefix,
  rows,
  onChange,
  keyLabel,
  valueLabel,
  addLabel,
  removeLabel,
  keyPlaceholder,
  valuePlaceholder,
}: {
  idPrefix: string;
  rows: KvRow[];
  onChange: (rows: KvRow[]) => void;
  keyLabel: string;
  valueLabel: string;
  addLabel: string;
  removeLabel: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  const update = (index: number, patch: Partial<KvRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };
  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={`${idPrefix}-${index}`} className="flex flex-wrap items-center gap-2">
          <label htmlFor={`${idPrefix}-k-${index}`} className="sr-only">
            {keyLabel}
          </label>
          <input
            id={`${idPrefix}-k-${index}`}
            className={`${inputCls} w-full sm:w-2/5`}
            placeholder={keyPlaceholder ?? keyLabel}
            value={row.key}
            onChange={(e) => update(index, { key: e.target.value })}
          />
          <label htmlFor={`${idPrefix}-v-${index}`} className="sr-only">
            {valueLabel}
          </label>
          <input
            id={`${idPrefix}-v-${index}`}
            className={`${inputCls} w-full sm:w-2/5`}
            placeholder={valuePlaceholder ?? valueLabel}
            value={row.value}
            onChange={(e) => update(index, { value: e.target.value })}
          />
          <button
            type="button"
            aria-label={`${removeLabel}: ${row.key || index + 1}`}
            className={`${btnSecondary} px-3`}
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" className={btnSecondary} onClick={() => onChange([...rows, { key: "", value: "" }])}>
        + {addLabel}
      </button>
    </div>
  );
}

export function ListEditor({
  idPrefix,
  items,
  onChange,
  label,
  addLabel,
  removeLabel,
  placeholder,
}: {
  idPrefix: string;
  items: string[];
  onChange: (items: string[]) => void;
  label: string;
  addLabel: string;
  removeLabel: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={`${idPrefix}-${index}`} className="flex items-center gap-2">
          <label htmlFor={`${idPrefix}-i-${index}`} className="sr-only">
            {label}
          </label>
          <input
            id={`${idPrefix}-i-${index}`}
            className={inputCls}
            placeholder={placeholder ?? label}
            value={item}
            onChange={(e) =>
              onChange(items.map((value, i) => (i === index ? e.target.value : value)))
            }
          />
          <button
            type="button"
            aria-label={`${removeLabel}: ${item || index + 1}`}
            className={`${btnSecondary} px-3`}
            onClick={() => onChange(items.filter((_, i) => i !== index))}
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" className={btnSecondary} onClick={() => onChange([...items, ""])}>
        + {addLabel}
      </button>
    </div>
  );
}

export interface FactorRow {
  name: string;
  baseline: string;
  min: string;
  max: string;
  unit: string;
}

export function FactorEditor({
  idPrefix,
  rows,
  onChange,
  nameLabel,
  baseLabel,
  minLabel,
  maxLabel,
  unitLabel,
  addLabel,
  removeLabel,
  namePlaceholder,
}: {
  idPrefix: string;
  rows: FactorRow[];
  onChange: (rows: FactorRow[]) => void;
  nameLabel: string;
  baseLabel: string;
  minLabel: string;
  maxLabel: string;
  unitLabel: string;
  addLabel: string;
  removeLabel: string;
  namePlaceholder?: string;
}) {
  const update = (index: number, patch: Partial<FactorRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };
  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div
          key={`${idPrefix}-${index}`}
          className="grid gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800 sm:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))_auto] sm:items-end"
        >
          <div>
            <label htmlFor={`${idPrefix}-n-${index}`} className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              {nameLabel}
            </label>
            <input
              id={`${idPrefix}-n-${index}`}
              className={inputCls}
              placeholder={namePlaceholder ?? "park_count"}
              value={row.name}
              onChange={(e) => update(index, { name: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-b-${index}`} className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              {baseLabel}
            </label>
            <input
              id={`${idPrefix}-b-${index}`}
              type="number"
              step="any"
              className={inputCls}
              value={row.baseline}
              onChange={(e) => update(index, { baseline: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-min-${index}`} className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              {minLabel}
            </label>
            <input
              id={`${idPrefix}-min-${index}`}
              type="number"
              step="any"
              className={inputCls}
              value={row.min}
              onChange={(e) => update(index, { min: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-max-${index}`} className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              {maxLabel}
            </label>
            <input
              id={`${idPrefix}-max-${index}`}
              type="number"
              step="any"
              className={inputCls}
              value={row.max}
              onChange={(e) => update(index, { max: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-u-${index}`} className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              {unitLabel}
            </label>
            <input
              id={`${idPrefix}-u-${index}`}
              className={inputCls}
              placeholder="unit"
              value={row.unit}
              onChange={(e) => update(index, { unit: e.target.value })}
            />
          </div>
          <button
            type="button"
            aria-label={`${removeLabel}: ${row.name || index + 1}`}
            className={`${btnSecondary} h-10 px-3`}
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ))}
      <button
        type="button"
        className={btnSecondary}
        onClick={() =>
          onChange([...rows, { name: "", baseline: "0", min: "0", max: "1000", unit: "" }])
        }
      >
        + {addLabel}
      </button>
    </div>
  );
}
