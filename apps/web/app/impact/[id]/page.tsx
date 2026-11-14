"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge, ExportButton, Skeleton, useI18n } from "@policylab/ui";
import type { ImpactIndicator, ImpactReport, SimulationRun } from "@policylab/types";
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
