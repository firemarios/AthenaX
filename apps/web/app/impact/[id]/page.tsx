"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge, ExportButton, Skeleton, useI18n } from "@policylab/ui";
import type {
  ImpactIndicator,
  ImpactReport,
  SimulationRun,
  SimulationSensitivity,
} from "@policylab/types";
import { API_BASE } from "@policylab/api-client";
import { useApi } from "@/_shared/hooks";
import { deltaTone, downloadBlob, fmtConfidence, fmtDelta, fmtNum } from "@/_shared/format";
import {
  PageFallback,
  PageHeader,
  SectionCard,
  btnPrimary,
  btnSecondary,
  headingCls,
  mutedText,
} from "@/_shared/ui";

const STR = {
  title: { el: "Αναφορά επιπτώσεων", en: "Impact report" },
  back: { el: "← Πίσω", en: "← Back" },
  loading: { el: "Φόρτωση αναφοράς επιπτώσεων…", en: "Loading impact report…" },
  notFound: { el: "Η αναφορά επιπτώσεων δεν βρέθηκε", en: "Impact report not found" },
  notFoundDesc: {
    el: "Η προσομοίωση ενδέχεται να μην έχει ολοκληρωθεί ή το αναγνωριστικό δεν είναι έγκυρο. Δείτε τις διαθέσιμες πολιτικές για να ξεκινήσετε μια νέα προσομοίωση.",
    en: "The simulation may not have completed, or the identifier is invalid. Browse the policies to start a new simulation.",
  },
  toPolicies: { el: "Προς τις πολιτικές", en: "Go to policies" },
  summary: { el: "Σύνοψη", en: "Summary" },
  baseline: { el: "Βασικό", en: "Baseline" },
  value: { el: "Τιμή", en: "Value" },
  confidence: { el: "Εμπιστοσύνη", en: "Confidence" },
  delta: { el: "Διαφορά", en: "Delta" },
  limitations: {
    el: "Οι εκτιμήσεις βασίζονται στα δεδομένα και τις παραδόσεις κάθε προσομοίωσης.",
    en: "Estimates are based on the data and assumptions of each simulation.",
  },
  noDimensions: { el: "Δεν υπάρχουν διαστάσεις στην αναφορά.", en: "No dimensions in this report." },
  noIndicators: {
    el: "Δεν υπάρχουν δείκτες για αυτό το μοντέλο.",
    en: "No indicators for this model.",
  },
  retry: { el: "Δοκιμάστε ξανά", en: "Try again" },
  exportJson: { el: "Λήψη JSON", en: "Download JSON" },
  sensitivity: { el: "Ευαισθησία (tornado)", en: "Sensitivity (tornado)" },
  sensitivityDesc: {
    el: "Ποια παράμετρος μετακινεί περισσότερο τον δείκτη όταν αλλάξει ±20%, κρατώντας το ίδιο snapshot και seed.",
    en: "Which input moves the indicator most when varied ±20%, holding the snapshot and seed fixed.",
  },
  sensitivityMetric: { el: "Δείκτης", en: "Indicator" },
  sensitivityNoData: {
    el: "Δεν υπολογίστηκε ευαισθησία για αυτή την εκτέλεση.",
    en: "No sensitivity was computed for this run.",
  },
  sensitivityNoEffect: { el: "καμία επίδραση", en: "no effect" },
  parameter: { el: "Παράμετρος", en: "Parameter" },
};

function DeltaBadge({ indicator }: { indicator: ImpactIndicator }) {
  const { t, lang } = useI18n();
  const arrow =
    indicator.direction === "up" ? "↑" : indicator.direction === "down" ? "↓" : "→";
  const tone = deltaTone(indicator.name, indicator.delta);
  if (indicator.delta === null || !Number.isFinite(indicator.delta)) {
    return <Badge tone="neutral">{arrow} {t({ el: "χωρίς σύγκριση", en: "no comparison" })}</Badge>;
  }
  return (
    <Badge tone={tone}>
      <span className="inline-flex items-center gap-1 tabular-nums" aria-hidden="true">
        {arrow} {fmtDelta(indicator.delta, lang)} {indicator.unit}
      </span>
      <span className="sr-only">
        {t(STR.delta)}: {fmtDelta(indicator.delta, lang)} {indicator.unit}
      </span>
    </Badge>
  );
}

function SensitivityTornado({ sensitivity }: { sensitivity: SimulationSensitivity }) {
  const { t, lang } = useI18n();
  const metricKeys = Array.from(
    new Set(sensitivity.parameters.flatMap((param) => Object.keys(param.metrics))),
  );
  const [metric, setMetric] = useState(metricKeys[0] ?? "");
  if (metricKeys.length === 0) return null;
  const activeMetric = metricKeys.includes(metric) ? metric : metricKeys[0];

  const rows = sensitivity.parameters.flatMap((param) => {
    const movement = param.metrics[activeMetric];
    return movement ? [{ param, movement }] : [];
  });
  const maxAbs = Math.max(
    1e-9,
    ...rows.flatMap(({ movement }) => [
      Math.abs(movement.low - movement.base),
      Math.abs(movement.high - movement.base),
    ]),
  );

  return (
    <SectionCard title={t(STR.sensitivity)}>
      <p className={`mb-3 text-sm ${mutedText}`}>{t(STR.sensitivityDesc)}</p>
      <label className="mb-4 flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
        <span>{t(STR.sensitivityMetric)}</span>
        <select
          value={activeMetric}
          onChange={(event) => setMetric(event.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        >
          {metricKeys.map((key) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>
      </label>
      <div className="space-y-3">
        <div className="flex justify-between text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          <span>−20%</span>
          <span>{t({ el: "βάση", en: "base" })}</span>
          <span>+20%</span>
        </div>
        {rows.map(({ param, movement }) => {
          const lowDelta = movement.low - movement.base;
          const highDelta = movement.high - movement.base;
          const left = (Math.abs(Math.min(0, lowDelta)) / maxAbs) * 50;
          const right = (Math.abs(Math.max(0, highDelta)) / maxAbs) * 50;
          const leftValue = (Math.abs(Math.min(0, highDelta)) / maxAbs) * 50;
          const rightValue = (Math.abs(Math.max(0, lowDelta)) / maxAbs) * 50;
          return (
            <div key={param.parameter}>
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-xs">
                <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
                  {param.parameter}
                </span>
                <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                  {fmtNum(param.low_input, lang)} → {fmtNum(param.high_input, lang)}
                </span>
              </div>
              <div className="relative h-5 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                <span className="absolute inset-y-0 left-1/2 w-px bg-zinc-400 dark:bg-zinc-500" />
                {lowDelta < 0 ? (
                  <span
                    className="absolute inset-y-1 rounded-sm bg-blue-500/80"
                    style={{ right: "50%", width: `${Math.max(left, leftValue)}%` }}
                    title={`${activeMetric}: ${fmtNum(movement.low, lang)}`}
                  />
                ) : (
                  <span
                    className="absolute inset-y-1 rounded-sm bg-emerald-500/80"
                    style={{ left: "50%", width: `${rightValue}%` }}
                    title={`${activeMetric}: ${fmtNum(movement.low, lang)}`}
                  />
                )}
                {highDelta > 0 ? (
                  <span
                    className="absolute inset-y-1 rounded-sm bg-blue-500/80"
                    style={{ left: "50%", width: `${right}%` }}
                    title={`${activeMetric}: ${fmtNum(movement.high, lang)}`}
                  />
                ) : null}
              </div>
              <div className="mt-1 flex justify-between text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                <span>{fmtNum(movement.low, lang)}</span>
                <span>
                  {movement.swing === 0
                    ? t(STR.sensitivityNoEffect)
                    : `Δ ${fmtNum(movement.swing, lang)}`}
                </span>
                <span>{fmtNum(movement.high, lang)}</span>
              </div>
            </div>
          );
        })}
      </div>
      {sensitivity.note ? (
        <p className="mt-4 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          {sensitivity.note}
        </p>
      ) : null}
    </SectionCard>
  );
}

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

function IndicatorRow({ indicator }: { indicator: ImpactIndicator }) {
  const { t, lang } = useI18n();
  return (
    <li className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t(indicator.label)}
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
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        <div className="flex gap-1.5">
          <dt className="text-zinc-500 dark:text-zinc-400">{t(STR.baseline)}:</dt>
          <dd className="tabular-nums text-zinc-800 dark:text-zinc-200">
            {indicator.baseline !== null && Number.isFinite(indicator.baseline)
              ? `${fmtNum(indicator.baseline, lang)} ${indicator.unit}`
              : "—"}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-zinc-500 dark:text-zinc-400">{t(STR.value)}:</dt>
          <dd className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {fmtNum(indicator.value, lang)} {indicator.unit}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-zinc-500 dark:text-zinc-400">{t(STR.confidence)}:</dt>
          <dd className="tabular-nums text-zinc-800 dark:text-zinc-200">
            {fmtConfidence(indicator.confidence)}
          </dd>
        </div>
      </dl>
    </li>
  );
}

function ImpactDetailView() {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const report = useApi<ImpactReport>(id ? `/v1/impact/${encodeURIComponent(id)}` : null);
  const run = useApi<SimulationRun>(
    report.data ? `/v1/simulations/${encodeURIComponent(report.data.run_id)}` : null,
  );

  const onExport = async (format: "csv" | "geojson" | "json") => {
    if (format === "csv" && report.data) {
      const rows = report.data.dimensions.flatMap((dim) =>
        dim.indicators.map((ind) => ({
          dimension: dim.key,
          indicator: ind.name,
          label: ind.label.en || ind.label.el,
          baseline: ind.baseline ?? "",
          value: ind.value,
          delta: ind.delta ?? "",
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
        v === null || v === undefined
          ? ""
          : /[",\n]/.test(String(v))
            ? `"${String(v).replace(/"/g, '""')}"`
            : String(v);
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
      downloadBlob(csv, `impact-${id}.csv`, "text/csv;charset=utf-8");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/v1/impact/${encodeURIComponent(id)}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      downloadBlob(blob, `impact-${id}.json`, "application/json");
    } catch {
      if (report.data) {
        downloadBlob(
          JSON.stringify(report.data, null, 2),
          `impact-${id}.json`,
          "application/json"
        );
      }
    }
  };

  if (report.loading) {
    return (
      <div className="mx-auto w-full max-w-[96rem] px-4 py-8 sm:px-6" aria-busy="true" aria-live="polite">
        <span className="sr-only">{t(STR.loading)}</span>
        <Skeleton rows={8} />
      </div>
    );
  }

  if (report.error || !report.data) {
    return (
      <div className="mx-auto w-full max-w-[96rem] px-4 py-8 sm:px-6">
        <PageHeader title={t(STR.title)} />
        <div aria-live="polite">
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-6 py-12 text-center">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {t(STR.notFound)}
            </h3>
            <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">
              {report.error ?? t(STR.notFoundDesc)}
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              <Link href="/policies" className={btnPrimary}>
                {t(STR.toPolicies)}
              </Link>
              <button type="button" className={btnSecondary} onClick={report.reload}>
                {t(STR.retry)}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const data = report.data;

  return (
    <div className="mx-auto w-full max-w-[96rem] px-4 py-8 sm:px-6">
      <PageHeader
        title={t(STR.title)}
        description={`run_id: ${data.run_id}`}
        breadcrumbs={[
          { label: t({ el: "Προσομοιώσεις", en: "Simulations" }), href: "/simulations" },
          { label: t(STR.title) },
        ]}
        actions={
          <>
            {run.data?.policy_id ? (
              <Link
                href={`/policies/${run.data.policy_id}`}
                className={btnSecondary}
              >
                {t({ el: "Πολιτική", en: "Policy" })}
              </Link>
            ) : null}
            <Link href={`/simulations/${data.run_id}`} className={btnSecondary}>
              {t({ el: "Προσομοίωση", en: "Simulation" })}
            </Link>
            <ExportButton onExport={onExport} />
          </>
        }
      />

      <div className="space-y-6">
        <SectionCard title={t(STR.summary)}>
          <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
            {t(data.summary)}
          </p>
        </SectionCard>

        {run.data?.results?.sensitivity ? (
          <SensitivityTornado sensitivity={run.data.results.sensitivity} />
        ) : null}

        {data.dimensions.length === 0 ? (
          <SectionCard>
            <p className={mutedText}>{t(STR.noDimensions)}</p>
          </SectionCard>
        ) : (
          data.dimensions.map((dim) => {
            const letter = (t(dim.label) || dim.key).trim().charAt(0).toUpperCase();
            return (
              <SectionCard key={dim.key}>
                <div className="mb-4 flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/50 text-base font-bold text-blue-600 dark:text-blue-400"
                  >
                    {letter}
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

        <SectionCard title={t({ el: "Περιορισμοί", en: "Limitations" })}>
          <p className={`text-sm ${mutedText}`}>{t(STR.limitations)}</p>
        </SectionCard>
      </div>
    </div>
  );
}

export default function ImpactPage() {
  return (
    <Suspense fallback={<PageFallback rows={8} />}>
      <ImpactDetailView />
    </Suspense>
  );
}
