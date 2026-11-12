"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Badge, Skeleton, useI18n } from "@policylab/ui";
import type { Passport, SimulationRun } from "@policylab/types";
import { doPost, useApi } from "@/_shared/hooks";
import { AIPlanPanel, EconomicsPanel, MetricComparisonChart } from "@/_shared/charts";
import { fmtDateTime, fmtNum, fmtRange } from "@/_shared/format";
import {
  ErrorPanel,
  KeyValueTable,
  PageFallback,
  PageHeader,
  SectionCard,
  btnPrimary,
  btnSecondary,
  headingCls,
  mutedText,
} from "@/_shared/ui";

const STR = {
  backPolicy: { el: "← Πίσω στην πολιτική", en: "← Back to policy" },
  backList: { el: "← Πίσω στις πολιτικές", en: "← Back to policies" },
  run: { el: "Προσομοίωση", en: "Simulation" },
  model: { el: "Μοντέλο", en: "Model" },
  version: { el: "Έκδοση", en: "Version" },
  created: { el: "Δημιουργήθηκε", en: "Created" },
  status: { el: "Κατάσταση", en: "Status" },
  chart: { el: "Οπτική σύγκριση", en: "Visual comparison" },
  economics: { el: "Κόστος & αξία", en: "Cost & value" },
  aiReport: { el: "Αναλυτική αναφορά AI", en: "Detailed AI report" },
  metrics: { el: "Αποτελέσματα (μετρικές)", en: "Results (metrics)" },
  metric: { el: "Μετρική", en: "Metric" },
  baseline: { el: "Βασικό", en: "Baseline" },
  value: { el: "Τιμή", en: "Value" },
  delta: { el: "Διαφορά", en: "Delta" },
  uncertainty: { el: "Ασφάλεια (εύρος)", en: "Uncertainty (range)" },
  assumptions: { el: "Υποθέσεις", en: "Assumptions" },
  noAssumptions: { el: "Δεν καταγράφηκαν υποθέσεις.", en: "No assumptions recorded." },
  warnings: { el: "Προειδοποιήσεις", en: "Warnings" },
  logs: { el: "Αρχείο εκτέλεσης (logs)", en: "Execution logs" },
  noLogs: { el: "Δεν υπάρχουν καταχωρήσεις αρχείου.", en: "No log entries." },
  passport: {
    el: "Διαβατήριο προσομοίωσης (Simulation Passport)",
    en: "Simulation Passport",
  },
  passportDesc: {
    el: "Πλήρες εγγυητικό ιστορικό: πηγές δεδομένων, υποθέσεις, ασφάλεια, επαλήθευση και ακεραιότητα εισόδων.",
    en: "Full accountability record: data sources, assumptions, reliability, validation and input integrity.",
  },
  dataSources: { el: "Πηγές δεδομένων", en: "Data sources" },
  reliability: { el: "Όριο αξιοπιστίας", en: "Reliability limits" },
  uncertaintyField: { el: "Αβεβαιότητα", en: "Uncertainty" },
  validatedBy: { el: "Επαλήθευση από", en: "Validated by" },
  executedAt: { el: "Εκτελέστηκε", en: "Executed at" },
  seed: { el: "Seed", en: "Seed" },
  checksum: { el: "Checksum εισόδων", en: "Inputs checksum" },
  retrieved: { el: "Ανάκτηση", en: "Retrieved" },
  failed: { el: "Η προσομοίωση απέτυχε", en: "The simulation failed" },
  rerun: { el: "Εκτέλεση ξανά", en: "Re-run" },
  rerunning: { el: "Νέα εκτέλεση…", en: "Re-running…" },
  rerunningAi: { el: "Το AI υπολογίζει ξανά…", en: "AI is re-calculating…" },
  rerunAiWait: {
    el: "Η ανάλυση AI μπορεί να διαρκέσει 30–90 δευτερόλεπτα.",
    en: "The AI analysis can take 30–90 seconds.",
  },
  impactLink: { el: "Αναφορά επιπτώσεων", en: "Impact report" },
  loading: { el: "Φόρτωση προσομοίωσης…", en: "Loading simulation…" },
  notFound: { el: "Η προσομοίωση δεν βρέθηκε.", en: "The simulation was not found." },
  better: { el: "βελτίωση", en: "better" },
  worse: { el: "χείρον", en: "worse" },
  neutral: { el: "όμοιο", en: "unchanged" },
  params: { el: "Παράμετροι εισόδου", en: "Input parameters" },
};

const LOWER_IS_BETTER = [
  "cost",
  "time",
  "delay",
  "congestion",
  "emission",
  "co2",
  "pollution",
  "accident",
  "crash",
  "noise",
  "fatalities",
  "queue",
];

const HIGHER_IS_BETTER = [
  "coverage",
  "green",
  "access",
  "score",
  "jobs",
  "gdp",
  "satisfaction",
  "percent",
  "share",
  "capacity",
  "riders",
  "users",
];

type DeltaTone = "success" | "error" | "neutral";

function metricTone(
  key: string,
  value: number,
  baseline: number | undefined
): DeltaTone {
  if (baseline === undefined || !Number.isFinite(baseline)) return "neutral";
  const delta = value - baseline;
  if (delta === 0) return "neutral";
  const lower = key.toLowerCase();
  const isLowerBetter = LOWER_IS_BETTER.some((k) => lower.includes(k));
  const isHigherBetter = HIGHER_IS_BETTER.some((k) => lower.includes(k));
  if (isLowerBetter) return delta < 0 ? "success" : "error";
  if (isHigherBetter) return delta > 0 ? "success" : "error";
  return "neutral";
}

function warningsOf(run: SimulationRun): string[] {
  const extra = (run as { warnings?: unknown }).warnings;
  return Array.isArray(extra) ? extra.filter((w): w is string => typeof w === "string") : [];
}

function logsOf(run: SimulationRun): string[] {
  const extra = (run as { logs?: unknown }).logs;
  return Array.isArray(extra) ? extra.filter((l): l is string => typeof l === "string") : [];
}

function PassportCard({ passport }: { passport: Passport }) {
  const { t, lang } = useI18n();
  return (
    <SectionCard className="border-indigo-300 dark:border-indigo-700 ring-1 ring-indigo-200 dark:ring-indigo-900">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white"
        >
          P
        </span>
        <h2 className={headingCls}>{t(STR.passport)}</h2>
        <Badge tone="info">{t({ el: "Σημαία", en: "Flagship" })}</Badge>
      </div>
      <p className={`mb-4 ${mutedText}`}>{t(STR.passportDesc)}</p>

      <KeyValueTable
        rows={[
          { k: t(STR.model), v: <span className="font-mono">{passport.model_name}</span> },
          { k: t(STR.version), v: <span className="font-mono">{passport.model_version}</span> },
          {
            k: t(STR.dataSources),
            v:
              passport.data_sources && passport.data_sources.length > 0 ? (
                <ul className="space-y-1">
                  {passport.data_sources.map((src, i) => (
                    <li key={i} className="text-sm">
                      <span className="font-medium">{src.name}</span>
                      {src.url ? (
                        <>
                          {" — "}
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 underline underline-offset-2 hover:text-indigo-500 dark:text-indigo-400"
                          >
                            {src.url}
                          </a>
                        </>
                      ) : null}
                      {src.retrieved_at ? (
                        <span className={`ml-2 ${mutedText}`}>
                          ({t(STR.retrieved)}: {fmtDateTime(src.retrieved_at, lang)})
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                "—"
              ),
          },
          {
            k: t(STR.assumptions),
            v:
              passport.assumptions && passport.assumptions.length > 0 ? (
                <ul className="list-disc space-y-0.5 pl-5 text-sm">
                  {passport.assumptions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              ) : (
                t(STR.noAssumptions)
              ),
          },
          { k: t(STR.reliability), v: passport.reliability_limits || "—" },
          { k: t(STR.uncertaintyField), v: passport.uncertainty || "—" },
          { k: t(STR.validatedBy), v: passport.validated_by || "—" },
          { k: t(STR.executedAt), v: fmtDateTime(passport.executed_at, lang) },
          { k: t(STR.seed), v: <span className="font-mono">{String(passport.seed ?? "—")}</span> },
          {
            k: t(STR.checksum),
            v: (
              <code className="block break-all font-mono text-xs">
                {passport.inputs_checksum || "—"}
              </code>
            ),
          },
        ]}
      />
    </SectionCard>
  );
}

function SimulationDetailView() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const run = useApi<SimulationRun>(id ? `/v1/simulations/${encodeURIComponent(id)}` : null);
  const [rerunError, setRerunError] = useState<string | null>(null);
  const [rerunning, setRerunning] = useState(false);

  const data = run.data;

  const handleRerun = async () => {
    if (!data) return;
    setRerunError(null);
    setRerunning(true);
    const aiRun = data.results?.ai ?? null;
    const parameters = data.parameters ?? {};
    const body: Record<string, unknown> = {
      model: aiRun ? "" : data.model_name,
      parameters: aiRun ? {} : parameters,
      compare_baseline: Boolean(data.results?.baseline),
      use_ai: Boolean(aiRun),
    };
    if (data.policy_id) body.policy_id = data.policy_id;
    const areaId = parameters.area_id;
    if (areaId !== undefined && areaId !== null && areaId !== "") {
      body.area = String(areaId);
    }
    const res = await doPost<SimulationRun>("/v1/simulations", body);
    setRerunning(false);
    if (res.error || !res.data) {
      setRerunError(res.error ?? t({ el: "Η εκτέλεση ξανά απέτυχε.", en: "Re-run failed." }));
      return;
    }
    router.push(`/simulations/${res.data.id}`);
  };

  if (run.loading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6" aria-busy="true" aria-live="polite">
        <span className="sr-only">{t(STR.loading)}</span>
        <Skeleton rows={8} />
      </div>
    );
  }

  if (run.error || !data) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <ErrorPanel message={run.error ?? t(STR.notFound)} onRetry={run.reload} />
        <p className="mt-4">
          <Link
            href="/policies"
            className="rounded font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            {t(STR.backList)}
          </Link>
        </p>
      </div>
    );
  }

  const statusToneMap: Record<string, "neutral" | "success" | "warning" | "error" | "info"> = {
    succeeded: "success",
    running: "info",
    queued: "neutral",
    failed: "error",
  };
  const statusLabels: Record<string, { el: string; en: string }> = {
    succeeded: { el: "Ολοκληρώθηκε", en: "Succeeded" },
    running: { el: "Σε εξέλιξη", en: "Running" },
    queued: { el: "Σε αναμονή", en: "Queued" },
    failed: { el: "Απέτυχε", en: "Failed" },
  };

  const metrics = data.results?.metrics ?? {};
  const baseline = data.results?.baseline ?? {};
  const uncertainty = data.results?.uncertainty ?? {};
  const economics = data.results?.economics ?? null;
  const ai = data.results?.ai ?? null;
  const metricKeys = Object.keys(metrics);
  const warnings = warningsOf(data);
  const logs = logsOf(data);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title={`${t(STR.run)} · ${data.model_name}`}
        description={`${t(STR.model)}: ${data.model_name} · ${t(STR.version)} ${data.model_version}`}
        actions={
          <Badge tone={statusToneMap[data.status] ?? "neutral"}>
            {t(statusLabels[data.status] ?? { el: data.status, en: data.status })}
          </Badge>
        }
      />

      <div className="mb-6 flex flex-wrap gap-3">
        {data.policy_id ? (
          <Link href={`/policies/${data.policy_id}`} className={btnSecondary}>
            {t(STR.backPolicy)}
          </Link>
        ) : null}
        <button
          type="button"
          className={btnPrimary}
          onClick={handleRerun}
          disabled={rerunning}
        >
          {rerunning
            ? data.results?.ai
              ? t(STR.rerunningAi)
              : t(STR.rerunning)
            : `↻ ${t(STR.rerun)}`}
        </button>
        {data.status === "succeeded" ? (
          <Link href={`/impact/${data.id}`} className={btnSecondary}>
            {t(STR.impactLink)} →
          </Link>
        ) : null}
      </div>

      {rerunning && data.results?.ai ? (
        <div
          role="status"
          aria-live="polite"
          className="pl-reveal mb-6 rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-800 dark:bg-indigo-950/30"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-indigo-700 dark:text-indigo-300">
            <span className="flex gap-1" aria-hidden="true">
              <span className="pl-ai-dot h-2 w-2 rounded-full bg-indigo-500" />
              <span className="pl-ai-dot h-2 w-2 rounded-full bg-indigo-500" style={{ animationDelay: "0.18s" }} />
              <span className="pl-ai-dot h-2 w-2 rounded-full bg-indigo-500" style={{ animationDelay: "0.36s" }} />
            </span>
            {t(STR.rerunningAi)}
          </div>
          <p className="mt-1 text-xs text-indigo-700/80 dark:text-indigo-300/80">{t(STR.rerunAiWait)}</p>
          <div className="mt-3 space-y-2" aria-hidden="true">
            <div className="pl-ai-shimmer h-2.5 w-full rounded-full" />
            <div className="pl-ai-shimmer h-2.5 w-4/5 rounded-full" style={{ animationDelay: "0.15s" }} />
            <div className="pl-ai-shimmer h-2.5 w-3/5 rounded-full" style={{ animationDelay: "0.3s" }} />
          </div>
        </div>
      ) : null}

      {rerunError ? (
        <div className="mb-6">
          <ErrorPanel message={rerunError} onRetry={() => setRerunError(null)} />
        </div>
      ) : null}

      {data.status === "failed" ? (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-4"
        >
          <p className="text-sm font-semibold text-red-800 dark:text-red-200">
            {t(STR.failed)}
          </p>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">
            {data.error || t({ el: "Λεπτομέρειες μη διαθέσιμες.", en: "No details available." })}
          </p>
        </div>
      ) : null}

      <div className="space-y-6">
        {ai ? (
          <SectionCard title={t(STR.aiReport)}>
            <AIPlanPanel ai={ai} />
          </SectionCard>
        ) : null}

        {economics ? (
          <SectionCard title={t(STR.economics)}>
            <EconomicsPanel economics={economics} />
          </SectionCard>
        ) : null}

        {metricKeys.length > 0 && Object.keys(baseline).length > 0 ? (
          <SectionCard title={t(STR.chart)}>
            <MetricComparisonChart metrics={metrics} baseline={baseline} />
          </SectionCard>
        ) : null}

        <SectionCard title={t(STR.metrics)}>
          {metricKeys.length === 0 ? (
            <p className={mutedText}>
              {data.status === "succeeded"
                ? t({ el: "Καμία μετρική στην απάντηση.", en: "No metrics in the response." })
                : t({ el: "Δεν υπάρχουν ακόμη αποτελέσματα.", en: "No results yet." })}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    <th scope="col" className="py-2 pr-3 font-semibold">{t(STR.metric)}</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">{t(STR.baseline)}</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">{t(STR.value)}</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">{t(STR.delta)}</th>
                    <th scope="col" className="py-2 font-semibold">{t(STR.uncertainty)}</th>
                  </tr>
                </thead>
                <tbody>
                  {metricKeys.map((key) => {
                    const value = metrics[key];
                    const base = baseline[key];
                    const tone = metricTone(key, value, base);
                    const delta =
                      base !== undefined && Number.isFinite(base) ? value - base : null;
                    return (
                      <tr
                        key={key}
                        className="border-b border-zinc-100 dark:border-zinc-800/60"
                      >
                        <th scope="row" className="py-2 pr-3 text-left font-medium text-zinc-800 dark:text-zinc-200">
                          {key}
                        </th>
                        <td className="py-2 pr-3 tabular-nums text-zinc-600 dark:text-zinc-400">
                          {base !== undefined ? fmtNum(base, lang) : "—"}
                        </td>
                        <td className="py-2 pr-3 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                          {fmtNum(value, lang)}
                        </td>
                        <td className="py-2 pr-3">
                          <Badge tone={tone}>
                            {delta === null
                              ? "—"
                              : `${delta > 0 ? "+" : ""}${fmtNum(delta, lang)} · ${
                                  tone === "success"
                                    ? t(STR.better)
                                    : tone === "error"
                                      ? t(STR.worse)
                                      : t(STR.neutral)
                                }`}
                          </Badge>
                        </td>
                        <td className="py-2 tabular-nums text-zinc-600 dark:text-zinc-400">
                          {uncertainty[key] ? fmtRange(uncertainty[key], lang) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {data.passport ? <PassportCard passport={data.passport} /> : null}

        <SectionCard title={t(STR.assumptions)}>
          {data.passport?.assumptions && data.passport.assumptions.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-800 dark:text-zinc-200">
              {data.passport.assumptions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          ) : (
            <p className={mutedText}>{t(STR.noAssumptions)}</p>
          )}
        </SectionCard>

        {warnings.length > 0 ? (
          <SectionCard title={t(STR.warnings)}>
            <ul className="flex flex-wrap gap-2">
              {warnings.map((w, i) => (
                <li key={i}>
                  <Badge tone="warning">⚠ {w}</Badge>
                </li>
              ))}
            </ul>
          </SectionCard>
        ) : null}

        <SectionCard title={t(STR.params)}>
          <KeyValueTable
            rows={Object.entries(data.parameters ?? {}).map(([k, v]) => ({
              k,
              v:
                v !== null && typeof v === "object" ? JSON.stringify(v) : String(v),
            }))}
          />
        </SectionCard>

        <SectionCard title={t(STR.logs)}>
          {logs.length === 0 ? (
            <p className={mutedText}>{t(STR.noLogs)}</p>
          ) : (
            <details className="group">
              <summary className="cursor-pointer rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                {t(STR.logs)} ({logs.length})
              </summary>
              <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-100">
                {logs.join("\n")}
              </pre>
            </details>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

export default function SimulationPage() {
  return (
    <Suspense fallback={<PageFallback rows={8} />}>
      <SimulationDetailView />
    </Suspense>
  );
}
