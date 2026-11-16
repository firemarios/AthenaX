"use client";

import {
  Leaf,
  Users,
  Euro,
  Bus,
  Smile,
  Landmark,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import { Badge, ExportButton, useI18n } from "@athenax/ui";
import type { ImpactIndicator, ImpactReport } from "@athenax/types";
import { downloadBlob, fmtConfidence, fmtDelta, fmtNum } from "./format";
import { SectionCard, headingCls, mutedText } from "./ui";

const DIMENSION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  environment: Leaf,
  society: Users,
  economy: Euro,
  mobility: Bus,
  quality_of_life: Smile,
  administration: Landmark,
};

const STR = {
  summary: { el: "Σύνοψη", en: "Summary" },
  baseline: { el: "Σενάριο βάσης", en: "Baseline" },
  scenario: { el: "Σενάριο", en: "Scenario" },
  confidence: { el: "Εμπιστοσύνη", en: "Confidence" },
  limitations: {
    el: "Περιορισμοί: οι τιμές προέρχονται από προσομοίωση με δηλωμένη αβεβαιότητα και δεν αποτελούν πρόβλεψη ή δέσμευση. Η σύγκριση με το σενάριο βάσης είναι σχετική στο ίδιο μοντέλο.",
    en: "Limitations: values come from a simulation with declared uncertainty and are not a forecast or commitment. Comparison with the baseline is relative to the same model.",
  },
  empty: { el: "Δεν υπάρχουν δείκτες σε αυτήν την έκθεση.", en: "No indicators in this report." },
  noIndicators: {
    el: "Δεν υπάρχουν δείκτες για αυτό το μοντέλο.",
    en: "No indicators for this model.",
  },
};

const SOURCE_LABELS = {
  simulation: { el: "Προσομοίωση", en: "Simulation" },
  economics: { el: "Οικονομικό μοντέλο", en: "Economics model" },
  ai: { el: "Εκτίμηση AI", en: "AI estimate" },
} as const;

const SOURCE_TONES = {
  simulation: "neutral",
  economics: "info",
  ai: "warning",
} as const;

function deltaTone(delta: number | null): "neutral" | "success" | "warning" | "error" | "info" {
  if (delta === null || !Number.isFinite(delta) || delta === 0) return "neutral";
  return delta > 0 ? "success" : "error";
}

function DeltaBadge({ indicator }: { indicator: ImpactIndicator }) {
  const { t, lang } = useI18n();
  const delta = indicator.delta;
  const arrow =
    indicator.direction === "up" ? (
      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
    ) : indicator.direction === "down" ? (
      <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
    ) : (
      <Minus className="h-3.5 w-3.5" aria-hidden="true" />
    );
  if (delta === null || !Number.isFinite(delta)) {
    return (
      <Badge tone="neutral">
        {t({ el: "χωρίς σύγκριση", en: "no comparison" })}
      </Badge>
    );
  }
  return (
    <Badge tone={deltaTone(delta)}>
      <span className="inline-flex items-center gap-1 tabular-nums">
        {arrow}
        {fmtDelta(delta, lang)} {indicator.unit}
      </span>
    </Badge>
  );
}

function IndicatorRow({ indicator }: { indicator: ImpactIndicator }) {
  const { t, lang } = useI18n();
  const baseline = indicator.baseline;
  const value = indicator.value;
  const max = Math.max(Math.abs(value), baseline !== null ? Math.abs(baseline) : 0, 1);
  const valuePct = Math.min(100, (Math.abs(value) / max) * 100);
  const basePct =
    baseline !== null && Number.isFinite(baseline)
      ? Math.min(100, (Math.abs(baseline) / max) * 100)
      : 0;

  return (
    <li className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t(indicator.label)}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {t(STR.confidence)}: {fmtConfidence(indicator.confidence)}
          </p>
          {indicator.note ? (
            <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              {t(indicator.note)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {indicator.source ? (
            <Badge tone={SOURCE_TONES[indicator.source]}>
              {t(SOURCE_LABELS[indicator.source])}
            </Badge>
          ) : null}
          <DeltaBadge indicator={indicator} />
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-24 shrink-0 text-xs text-zinc-600 dark:text-zinc-400">
            {t(STR.scenario)}
          </span>
          <div className="h-3 w-full overflow-hidden rounded bg-zinc-200 dark:bg-zinc-700">
            <div className="h-full rounded bg-blue-600" style={{ width: `${valuePct}%` }} />
          </div>
          <span className="w-28 shrink-0 text-right text-xs font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
            {fmtNum(value, lang)} {indicator.unit}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-24 shrink-0 text-xs text-zinc-600 dark:text-zinc-400">
            {t(STR.baseline)}
          </span>
          <div className="h-3 w-full overflow-hidden rounded bg-zinc-200 dark:bg-zinc-700">
            <div
              className="h-full rounded bg-zinc-500 dark:bg-zinc-400"
              style={{ width: `${basePct}%` }}
            />
          </div>
          <span className="w-28 shrink-0 text-right text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
            {baseline !== null && Number.isFinite(baseline)
              ? `${fmtNum(baseline, lang)} ${indicator.unit}`
              : "—"}
          </span>
        </div>
      </div>
    </li>
  );
}

export function ImpactReportView({ report }: { report: ImpactReport }) {
  const { t } = useI18n();

  const onExport = (format: "csv" | "geojson" | "json") => {
    if (format === "csv") {
      const rows = report.dimensions.flatMap((dim) =>
        dim.indicators.map((ind) => ({
          dimension: dim.key,
          indicator: ind.name,
          label: ind.label.en || ind.label.el,
          baseline: ind.baseline,
          value: ind.value,
          delta: ind.delta,
          unit: ind.unit,
          direction: ind.direction,
          confidence: ind.confidence,
        }))
      );
      const header = [
        "dimension",
        "indicator",
        "label",
        "baseline",
        "value",
        "delta",
        "unit",
        "direction",
        "confidence",
      ];
      const esc = (v: unknown) =>
        v === null || v === undefined ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
      const csv = [
        header.join(","),
        ...rows.map((r) =>
          [
            r.dimension,
            r.indicator,
            r.label,
            r.baseline,
            r.value,
            r.delta,
            r.unit,
            r.direction,
            r.confidence,
          ]
            .map(esc)
            .join(",")
        ),
      ].join("\r\n");
      downloadBlob(csv, `impact-${report.run_id}.csv`, "text/csv;charset=utf-8");
      return;
    }
    downloadBlob(
      JSON.stringify(report, null, 2),
      `impact-${report.run_id}.json`,
      "application/json"
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={mutedText}>
          run_id: <code className="font-mono text-xs">{report.run_id}</code>
        </p>
        <ExportButton onExport={onExport} />
      </div>

      {report.dimensions.length === 0 ? (
        <SectionCard>
          <p className={mutedText}>{t(STR.empty)}</p>
        </SectionCard>
      ) : (
        report.dimensions.map((dim) => {
          const Icon = DIMENSION_ICONS[dim.key] ?? Leaf;
          return (
            <SectionCard key={dim.key}>
              <div className="mb-4 flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400"
                >
                  <Icon className="h-5 w-5" />
                </span>
                <h2 className={headingCls}>{t(dim.label)}</h2>
              </div>
              {dim.indicators.length === 0 ? (
                <p className={mutedText}>{t(STR.noIndicators)}</p>
              ) : (
                <ul className="space-y-3">
                  {dim.indicators.map((ind) => (
                    <IndicatorRow key={ind.name} indicator={ind} />
                  ))}
                </ul>
              )}
            </SectionCard>
          );
        })
      )}

      <SectionCard title={t(STR.summary)}>
        <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
          {t(report.summary)}
        </p>
        <p className={`mt-4 border-t border-zinc-200 dark:border-zinc-800 pt-3 ${mutedText}`}>
          {t(STR.limitations)}
        </p>
      </SectionCard>
    </div>
  );
}
