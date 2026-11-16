"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Badge, EmptyState, Skeleton, useI18n } from "@athenax/ui";
import type { ResearchProject } from "@athenax/types";
import { API_BASE } from "@athenax/api-client";
import { doDelete, useApi } from "@/_shared/hooks";
import { downloadBlob, fmtDate } from "@/_shared/format";
import {
  DeleteButton,
  ErrorPanel,
  NoticeBox,
  PageFallback,
  PageHeader,
  SectionCard,
  btnSecondary,
  mutedText,
} from "@/_shared/ui";

const STR = {
  back: { el: "← Πίσω στα έργα", en: "← Back to projects" },
  loading: { el: "Φόρτωση έργου…", en: "Loading project…" },
  notFound: { el: "Το έργο δεν βρέθηκε.", en: "The project was not found." },
  experiments: { el: "Πειράματα", en: "Experiments" },
  noExperiments: {
    el: "Κανένα πείραμα ακόμη σε αυτό το έργο.",
    en: "No experiments in this project yet.",
  },
  model: { el: "Μοντέλο", en: "Model" },
  runs: { el: "Προσομοιώσεις", en: "Simulations" },
  openRun: { el: "Προβολή προσομοίωσης", en: "View simulation" },
  notes: { el: "Σημειώσεις", en: "Notes" },
  noNotes: { el: "Χωρίς σημειώσεις.", en: "No notes." },
  export: { el: "Εξαγωγή", en: "Export" },
  exportMd: { el: "Εξαγωγή md", en: "Export md" },
  exportCsv: { el: "Εξαγωγή csv", en: "Export csv" },
  exportJson: { el: "Εξαγωγή json", en: "Export json" },
  exporting: { el: "Εξαγωγή…", en: "Exporting…" },
  exportFail: {
    el: "Η εξαγωγή απέτυχε. Δοκιμάστε ξανά.",
    en: "Export failed. Try again.",
  },
  repro: { el: "Επαναληψιμότητα", en: "Reproducibility" },
  reproBody: {
    el: "Κάθε πείραμα βασίζεται σε σταθερό seed, στιγμιότυπα δεδομένων και τα πεδία του διαβατηρίου προσομοίωσης (passport): μοντέλο και έκδοση, πηγές με ημερομηνία ανάκτησης, υποθέσεις, όρια αξιοπιστίας, αβεβαιότητα, επαλήθευση, checksum εισόδων. Έτσι, τα αποτελέσματα μπορούν να αναπαραχθούν.",
    en: "Every experiment relies on a stable seed, data snapshots and the simulation passport fields: model and version, sources with retrieval dates, assumptions, reliability limits, uncertainty, validation and inputs checksum. This makes the results reproducible.",
  },
  created: { el: "Δημιουργήθηκε", en: "Created" },
  description: { el: "Περιγραφή", en: "Description" },
  experimentCount: { el: "Πειράματα", en: "Experiments" },
};

type ExportFormat = "md" | "csv" | "json";

const MIME: Record<ExportFormat, string> = {
  md: "text/markdown;charset=utf-8",
  csv: "text/csv;charset=utf-8",
  json: "application/json",
};

function ResearchDetailView() {
  const { t, lang } = useI18n();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id ?? "";

  const project = useApi<ResearchProject>(
    id ? `/v1/research/projects/${encodeURIComponent(id)}` : null
  );

  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async (format: ExportFormat) => {
    if (!id) return;
    setExportError(null);
    setExporting(format);
    try {
      const res = await fetch(
        `${API_BASE}/v1/research/projects/${encodeURIComponent(id)}/export?format=${format}`,
        { headers: { Accept: "*/*" }, cache: "no-store" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      downloadBlob(blob, `research-${id}.${format}`, MIME[format]);
    } catch {
      setExportError(t(STR.exportFail));
    } finally {
      setExporting(null);
    }
  };

  if (project.loading) {
    return (
      <div className="mx-auto w-full max-w-[96rem] px-4 py-8 sm:px-6" aria-busy="true" aria-live="polite">
        <span className="sr-only">{t(STR.loading)}</span>
        <Skeleton rows={8} />
      </div>
    );
  }

  if (project.error || !project.data) {
    return (
      <div className="mx-auto w-full max-w-[96rem] px-4 py-8 sm:px-6">
        <ErrorPanel message={project.error ?? t(STR.notFound)} onRetry={project.reload} />
        <p className="mt-4">
          <Link
            href="/research"
            className="rounded font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
          >
            {t(STR.back)}
          </Link>
        </p>
      </div>
    );
  }

  const data = project.data;
  const experiments = data.experiments ?? [];

  return (
    <div className="mx-auto w-full max-w-[96rem] px-4 py-8 sm:px-6">
      <PageHeader
        title={data.name}
        description={data.description ?? undefined}
        breadcrumbs={[
          { label: t({ el: "Έρευνα", en: "Research" }), href: "/research" },
          { label: data.name },
        ]}
        actions={
          <>
            <Badge tone="info">
              {experiments.length} {t(STR.experimentCount)}
            </Badge>
            <DeleteButton
              onConfirm={async () => {
                const res = await doDelete(`/v1/research/projects/${encodeURIComponent(data.id)}`);
                if (res.error) return res.error;
                router.push("/research");
                return null;
              }}
            />
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label={t(STR.export)}>
          <button
            type="button"
            className={btnSecondary}
            onClick={() => handleExport("md")}
            disabled={exporting !== null}
          >
            {exporting === "md" ? t(STR.exporting) : t(STR.exportMd)}
          </button>
          <button
            type="button"
            className={btnSecondary}
            onClick={() => handleExport("csv")}
            disabled={exporting !== null}
          >
            {exporting === "csv" ? t(STR.exporting) : t(STR.exportCsv)}
          </button>
          <button
            type="button"
            className={btnSecondary}
            onClick={() => handleExport("json")}
            disabled={exporting !== null}
          >
            {exporting === "json" ? t(STR.exporting) : t(STR.exportJson)}
          </button>
        </div>
      </div>

      {exportError ? (
        <div className="mb-6">
          <ErrorPanel message={exportError} onRetry={() => setExportError(null)} />
        </div>
      ) : null}

      <div className="space-y-6">
        <SectionCard title={t(STR.description)}>
          <p className={`text-sm ${mutedText}`}>
            {data.description || "—"}
          </p>
          <p className={`mt-2 ${mutedText}`}>
            {t(STR.created)}: {fmtDate(data.created_at, lang)}
          </p>
        </SectionCard>

        <SectionCard title={t(STR.experiments)}>
          {experiments.length === 0 ? (
            <EmptyState
              title={t(STR.noExperiments)}
              description={t({
                el: "Εκτελέστε προσομοιώσεις από μια πολιτική και ενσωματώστε τες εδώ.",
                en: "Run simulations from a policy and attach them here.",
              })}
            />
          ) : (
            <ul className="space-y-3">
              {experiments.map((exp) => (
                <li
                  key={exp.id}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {exp.title}
                    </p>
                    <Badge tone="info">
                      {t(STR.model)}: {exp.model}
                    </Badge>
                  </div>
                  {exp.run_ids && exp.run_ids.length > 0 ? (
                    <div className="mt-2">
                      <p className={`mb-1 text-xs ${mutedText}`}>{t(STR.runs)}:</p>
                      <ul className="flex flex-wrap gap-2">
                        {exp.run_ids.map((runId) => (
                          <li key={runId}>
                            <Link
                              href={`/simulations/${runId}`}
                              className="inline-flex items-center rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                              {runId}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div className="mt-2">
                    <p className={`text-xs ${mutedText}`}>
                      <span className="font-medium">{t(STR.notes)}:</span>{" "}
                      {exp.notes || t(STR.noNotes)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <NoticeBox tone="info">
          <p className="font-semibold">{t(STR.repro)}</p>
          <p className="mt-1">{t(STR.reproBody)}</p>
        </NoticeBox>
      </div>
    </div>
  );
}

export default function ResearchDetailPage() {
  return (
    <Suspense fallback={<PageFallback rows={8} />}>
      <ResearchDetailView />
    </Suspense>
  );
}
