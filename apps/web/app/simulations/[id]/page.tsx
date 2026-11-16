"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Badge, Skeleton, useI18n } from "@athenax/ui";
import type { Passport, SimulationRun } from "@athenax/types";
import { doDelete, doPost, useApi } from "@/_shared/hooks";
import { EconomicsPanel, MetricComparisonChart, metricLabel } from "@/_shared/charts";
import { AIReportView } from "@/_shared/ai-report";
import { fmtDateTime, fmtNum, fmtRange, metricTone } from "@/_shared/format";
import {
  DeleteButton,
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
  baseline: { el: "Βάση", en: "Baseline" },
  value: { el: "Τιμή", en: "Value" },
  delta: { el: "Διαφορά", en: "Delta" },
  uncertainty: { el: "Αβεβαιότητα (εύρος)", en: "Uncertainty (range)" },
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
    el: "Πλήρες εγγυητικό ιστορικό: πηγές δεδομένων, υποθέσεις, αβεβαιότητα, επαλήθευση και ακεραιότητα εισόδων.",
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
  snapshotMode: { el: "Πραγματικά δεδομένα (snapshot)", en: "Real data (snapshot)" },
  syntheticMode: { el: "Συνθετικά δεδομένα (synthetic)", en: "Synthetic data" },
  snapshotSources: { el: "Πηγές snapshot", en: "Snapshot sources" },
  snapshotCoverage: { el: "Κάλυψη ανά επίπεδο", en: "Coverage per layer" },
  reproduce: { el: "Αναπαραγωγή (ίδιο seed)", en: "Reproduce (same seed)" },
  reproducing: { el: "Αναπαραγωγή…", en: "Reproducing…" },
  reproduceOk: {
    el: "Η αναπαραγωγή επέστρεψε ταυτόσημο checksum και μετρικές.",
    en: "Reproduction returned an identical checksum and metrics.",
  },
  reproduceDiff: {
    el: "Η αναπαραγωγή διέφερε από την αρχική εκτέλεση.",
    en: "The reproduction differed from the original run.",
  },
  loading: { el: "Φόρτωση προσομοίωσης…", en: "Loading simulation…" },
  notFound: { el: "Η προσομοίωση δεν βρέθηκε.", en: "The simulation was not found." },
  better: { el: "Βελτίωση", en: "better" },
  worse: { el: "Χειρότερο", en: "worse" },
  neutral: { el: "Ίδιο", en: "unchanged" },
  params: { el: "Παράμετροι εισόδου", en: "Input parameters" },
  runId: { el: "Κωδικός εκτέλεσης", en: "Run ID" },
  provenance: { el: "Αλυσίδα προέλευσης", en: "Provenance chain" },
  provenanceDesc: {
    el: "Κάθε βήμα από την πηγή έως την αναφορά, με τους κωδικούς που το συνδέουν.",
    en: "Every step from source to report, with the identifiers that link them.",
  },
  provenanceVerified: { el: "Επαληθεύσιμο", en: "Verifiable" },
  provenanceDegraded: { el: "Μερικό", en: "Partial" },
  provenanceSynthetic: { el: "Συνθετικό", en: "Synthetic" },
  inProgress: { el: "Σε εξέλιξη", en: "In progress" },
  inProgressHint: {
    el: "Η προσομοίωση εκτελείται στο παρασκήνιο· η σελίδα ενημερώνεται αυτόματα.",
    en: "The simulation runs in the background; this page refreshes automatically.",
  },
};

const RUN_STEPS: { el: string; en: string }[] = [
  {
    el: "Διαβάζω την πολιτική και το ελεύθερο κείμενο",
    en: "Reading the policy and free text",
  },
  { el: "Επιλέγω το κατάλληλο μοντέλο", en: "Choosing the right model" },
  {
    el: "Υπολογίζω τις παραμέτρους και τους παράγοντες",
    en: "Calculating parameters and factors",
  },
  { el: "Εκτελώ την προσομοίωση", en: "Running the simulation" },
  {
    el: "Υπολογίζω κόστος, οφέλη και φορολογικά έσοδα",
    en: "Calculating costs, benefits and tax revenue",
  },
  { el: "Συντάσσω την αναφορά AI", en: "Composing the AI report" },
];

const RUN_STEP_MS = 8_000;

const MODEL_LABELS: Record<string, { el: string; en: string }> = {
  accessibility: { el: "Προσβασιμότητα πεζών", en: "Walk accessibility" },
  greenspace: { el: "Πράσινο & πάρκα", en: "Green space & parks" },
  traffic_sumo: { el: "Κυκλοφορία", en: "Traffic" },
  cost: { el: "Κόστος έργου", en: "Project cost" },
};

function modelLabel(name: string): { el: string; en: string } {
  return MODEL_LABELS[name] ?? { el: name, en: name };
}

function warningsOf(run: SimulationRun): string[] {
  const extra = (run as { warnings?: unknown }).warnings;
  return Array.isArray(extra) ? extra.filter((w): w is string => typeof w === "string") : [];
}

function logsOf(run: SimulationRun): string[] {
  const extra = (run as { logs?: unknown }).logs;
  return Array.isArray(extra) ? extra.filter((l): l is string => typeof l === "string") : [];
}

function metricsEqual(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (!Object.is(a[key], b[key])) return false;
  }
  return true;
}

function PassportCard({ passport }: { passport: Passport }) {
  const { t, lang } = useI18n();
  return (
    <SectionCard className="border-blue-300 dark:border-blue-700 ring-1 ring-blue-200 dark:ring-blue-900">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white"
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
                            className="text-blue-600 underline underline-offset-2 hover:text-blue-500 dark:text-blue-400"
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

function ProvenanceChain({ run }: { run: SimulationRun }) {
  const { t, lang } = useI18n();
  const snapshot = run.results?.snapshot;
  const sources = snapshot?.sources ?? run.passport?.data_sources ?? [];
  const mode = snapshot?.mode ?? (sources.length > 0 ? "snapshot" : "unknown");
  const layers = snapshot?.coverage ? Object.keys(snapshot.coverage) : [];
  const steps = [
    {
      label: t({ el: "Κατάλογος πηγών", en: "Source registry" }),
      detail: `${sources.length} ${t({ el: "πηγές", en: "sources" })}`,
      href: "/sources",
      tone: sources.length > 0 ? "success" : "warning",
    },
    {
      label: t({ el: "Ingest → city_features", en: "Ingest → city_features" }),
      detail: layers.length > 0 ? layers.join(", ") : t({ el: "χωρίς επίπεδα", en: "no layers" }),
      href: "/datasets",
      tone: layers.length > 0 ? "success" : "neutral",
    },
    {
      label: t({ el: "Snapshot", en: "Snapshot" }),
      detail:
        mode === "snapshot"
          ? `${t(STR.provenanceVerified)} · ${snapshot?.retrieved_at ? fmtDateTime(snapshot.retrieved_at, lang) : "—"}`
          : mode === "synthetic"
            ? t(STR.provenanceSynthetic)
            : t(STR.provenanceDegraded),
      href: null,
      tone: mode === "snapshot" ? "success" : "warning",
    },
    {
      label: t(STR.run),
      detail: `${run.model_name} v${run.model_version}`,
      href: null,
      tone: run.status === "succeeded" ? "success" : "warning",
    },
    {
      label: t(STR.passport),
      detail: run.passport?.inputs_checksum
        ? `sha256:${run.passport.inputs_checksum.slice(0, 12)}…`
        : "—",
      href: null,
      tone: run.passport?.inputs_checksum ? "success" : "warning",
    },
    {
      label: t({ el: "Αναφορά επιπτώσεων", en: "Impact report" }),
      detail: t({ el: "6 διαστάσεις + reach", en: "6 dimensions + reach" }),
      href: run.status === "succeeded" ? `/impact/${run.id}` : null,
      tone: run.status === "succeeded" ? "success" : "neutral",
    },
  ];
  return (
    <SectionCard title={t(STR.provenance)} className="mb-6">
      <p className={`mb-4 ${mutedText}`}>{t(STR.provenanceDesc)}</p>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step.label}
            className="rounded-lg border border-zinc-200 bg-white/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/40"
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {index + 1}
              </span>
              <Badge tone={step.tone as "success" | "warning" | "neutral"}>{step.label}</Badge>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {step.href ? (
                <Link
                  href={step.href}
                  className="text-blue-600 underline underline-offset-2 hover:text-blue-500 dark:text-blue-400"
                >
                  {step.detail}
                </Link>
              ) : (
                step.detail
              )}
            </p>
          </li>
        ))}
      </ol>
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
  const [reproducing, setReproducing] = useState(false);
  const [reproResult, setReproResult] = useState<
    { ok: boolean; runId: string; checksum: string } | null
  >(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const data = run.data;

  const runStatus = run.data?.status;
  const reloadRun = run.reload;
  const startedAt = run.data?.created_at ? Date.parse(run.data.created_at) : Number.NaN;
  const runStep = Number.isFinite(startedAt)
    ? Math.min(
        Math.max(Math.floor((nowMs - startedAt) / RUN_STEP_MS), 0),
        RUN_STEPS.length - 1,
      )
    : 0;
  useEffect(() => {
    if (runStatus !== "running" && runStatus !== "queued") return;
    const timer = window.setTimeout(reloadRun, 3000);
    return () => window.clearTimeout(timer);
  }, [runStatus, reloadRun]);

  useEffect(() => {
    if (runStatus !== "running" && runStatus !== "queued") return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [runStatus]);

  const buildReproduceBody = (runData: SimulationRun): Record<string, unknown> => {
    const parameters = runData.parameters ?? {};
    const body: Record<string, unknown> = {
      model: runData.model_name,
      parameters,
      compare_baseline: Boolean(runData.results?.baseline),
      use_ai: false,
    };
    if (runData.policy_id) body.policy_id = runData.policy_id;
    if (runData.passport?.seed !== null && runData.passport?.seed !== undefined) {
      body.seed = runData.passport.seed;
    }
    const areaId = parameters.area_id;
    if (areaId !== undefined && areaId !== null && areaId !== "") {
      body.area = String(areaId);
    }
    return body;
  };

  const handleReproduce = async () => {
    if (!data) return;
    setRerunError(null);
    setReproResult(null);
    setReproducing(true);
    const res = await doPost<SimulationRun>("/v1/simulations", buildReproduceBody(data));
    setReproducing(false);
    if (res.error || !res.data) {
      setRerunError(
        res.error ?? t({ el: "Η αναπαραγωγή απέτυχε.", en: "Reproduction failed." }),
      );
      return;
    }
    const originalMetrics = data.results?.metrics ?? {};
    const reproducedMetrics = res.data.results?.metrics ?? {};
    const sameChecksum =
      Boolean(data.passport?.inputs_checksum) &&
      data.passport?.inputs_checksum === res.data.passport?.inputs_checksum;
    const sameMetrics = metricsEqual(originalMetrics, reproducedMetrics);
    setReproResult({
      ok: sameChecksum && sameMetrics,
      runId: res.data.id,
      checksum: res.data.passport?.inputs_checksum ?? "—",
    });
  };

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
      <div className="mx-auto w-full max-w-[96rem] px-4 py-8 sm:px-6" aria-busy="true" aria-live="polite">
        <span className="sr-only">{t(STR.loading)}</span>
        <Skeleton rows={8} />
      </div>
    );
  }

  if (run.error || !data) {
    return (
      <div className="mx-auto w-full max-w-[96rem] px-4 py-8 sm:px-6">
        <ErrorPanel message={run.error ?? t(STR.notFound)} onRetry={run.reload} />
        <p className="mt-4">
          <Link
            href="/policies"
            className="rounded font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
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
  const displayModel = modelLabel(data.model_name);
  const area = data.parameters?.area_id;
  const scenarioTitle = ai?.title
    ? t(ai.title)
    : data.policy_id
      ? t({ el: "Προσομοίωση πολιτικής", en: "Policy simulation" })
      : `${t(STR.run)} · ${t(displayModel)}`;

  return (
    <div className="mx-auto w-full max-w-[96rem] px-4 py-8 sm:px-6">
      <PageHeader
        title={scenarioTitle}
        description={`${t(displayModel)} · ${t(STR.version)} ${data.model_version}${
          area ? ` · ${String(area)}` : ""
        }`}
        breadcrumbs={[
          { label: t({ el: "Πολιτικές", en: "Policies" }), href: "/policies" },
          ...(data.policy_id
            ? [
                {
                  label: t({ el: "Πολιτική", en: "Policy" }),
                  href: `/policies/${data.policy_id}`,
                },
              ]
            : []),
          { label: t(STR.run) },
        ]}
        actions={
          <>
            {data.results?.snapshot ? (
              <Badge
                tone={data.results.snapshot.mode === "snapshot" ? "success" : "warning"}
              >
                {data.results.snapshot.mode === "snapshot"
                  ? t(STR.snapshotMode)
                  : t(STR.syntheticMode)}
              </Badge>
            ) : null}
            <Badge tone={statusToneMap[data.status] ?? "neutral"}>
              {t(statusLabels[data.status] ?? { el: data.status, en: data.status })}
            </Badge>
          </>
        }
      />

      {data.status === "running" ? (
        <div
          role="status"
          aria-live="polite"
          className="pl-reveal mb-6 overflow-hidden rounded-xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-800 dark:bg-blue-950/30"
        >
          <div className="flex items-start gap-3">
            <span
              className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white"
              aria-hidden="true"
            >
              <span className="absolute inset-0 animate-ping rounded-full bg-blue-400 opacity-40" />
              <span className="relative">✦</span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                  {t(STR.inProgress)}
                </p>
                <span className="text-xs tabular-nums text-blue-700/70 dark:text-blue-300/70">
                  {runStep + 1}/{RUN_STEPS.length}
                </span>
              </div>
              <p className="mt-1 text-xs text-blue-700/80 dark:text-blue-300/80">
                {t(STR.inProgressHint)}
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-900/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500 transition-[width] duration-700 ease-out"
                  style={{ width: `${((runStep + 1) / RUN_STEPS.length) * 100}%` }}
                />
              </div>
              <p className="sr-only">{t(RUN_STEPS[runStep])}</p>
            </div>
          </div>
          <ol className="mt-4 space-y-2" aria-hidden="true">
            {RUN_STEPS.map((step, index) => {
              const done = index < runStep;
              const active = index === runStep;
              return (
                <li key={step.en} className="flex items-start gap-2.5 text-sm">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                      done
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : active
                          ? "border-blue-500 bg-white text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                          : "border-blue-200 bg-white/60 text-blue-400 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-600"
                    }`}
                  >
                    {done ? (
                      "✓"
                    ) : active ? (
                      <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600 dark:border-blue-800 dark:border-t-blue-300" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span
                    className={
                      done
                        ? "text-blue-900/80 dark:text-blue-100/80"
                        : active
                          ? "font-medium text-blue-900 dark:text-blue-100"
                          : "text-blue-700/60 dark:text-blue-300/50"
                    }
                  >
                    {t(step)}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-3">
        <Link href="/simulations" className={btnSecondary}>
          {t({ el: "Όλες οι προσομοιώσεις", en: "All simulations" })}
        </Link>
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
        {data.passport?.seed !== null && data.passport?.seed !== undefined ? (
          <button
            type="button"
            className={btnSecondary}
            onClick={handleReproduce}
            disabled={reproducing || data.status !== "succeeded"}
            title={t({
              el: "Εκτελεί ξανά με το αποθηκευμένο seed και συγκρίνει checksum/μετρικές.",
              en: "Runs again with the stored seed and compares checksum/metrics.",
            })}
          >
            {reproducing ? t(STR.reproducing) : `⇄ ${t(STR.reproduce)}`}
          </button>
        ) : null}
        {data.status === "succeeded" ? (
          <Link href={`/impact/${data.id}`} className={btnSecondary}>
            {t(STR.impactLink)} →
          </Link>
        ) : null}
        <DeleteButton
          onConfirm={async () => {
            const res = await doDelete(`/v1/simulations/${encodeURIComponent(data.id)}`);
            if (res.error) return res.error;
            router.push("/simulations");
            return null;
          }}
        />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span>
          {t(STR.created)}: {fmtDateTime(data.created_at, lang)}
        </span>
        <span className="flex items-center gap-1.5">
          {t(STR.runId)}:
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {data.id}
          </code>
        </span>
        {area ? <span>{String(area)}</span> : null}
        {data.passport?.seed !== null && data.passport?.seed !== undefined ? (
          <span>
            {t(STR.seed)}: {data.passport.seed}
          </span>
        ) : null}
      </div>

      {rerunning && data.results?.ai ? (
        <div
          role="status"
          aria-live="polite"
          className="pl-reveal mb-6 rounded-xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-800 dark:bg-blue-950/30"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
            <span className="flex gap-1" aria-hidden="true">
              <span className="pl-ai-dot h-2 w-2 rounded-full bg-blue-500" />
              <span className="pl-ai-dot h-2 w-2 rounded-full bg-blue-500" style={{ animationDelay: "0.18s" }} />
              <span className="pl-ai-dot h-2 w-2 rounded-full bg-blue-500" style={{ animationDelay: "0.36s" }} />
            </span>
            {t(STR.rerunningAi)}
          </div>
          <p className="mt-1 text-xs text-blue-700/80 dark:text-blue-300/80">{t(STR.rerunAiWait)}</p>
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

      {reproResult ? (
        <div
          role="status"
          aria-live="polite"
          className={`mb-6 rounded-xl border p-4 ${
            reproResult.ok
              ? "border-green-300 bg-green-50/80 dark:border-green-800 dark:bg-green-950/30"
              : "border-amber-300 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/30"
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              reproResult.ok
                ? "text-green-800 dark:text-green-200"
                : "text-amber-800 dark:text-amber-200"
            }`}
          >
            {reproResult.ok ? `✓ ${t(STR.reproduceOk)}` : `⚠ ${t(STR.reproduceDiff)}`}
          </p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            {t(STR.checksum)}:{" "}
            <code className="break-all font-mono">{reproResult.checksum}</code>
          </p>
          <Link
            href={`/simulations/${reproResult.runId}`}
            className="mt-2 inline-block text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
          >
            {t({ el: "Άνοιγμα νέας εκτέλεσης", en: "Open the new run" })} →
          </Link>
        </div>
      ) : null}

      {data.results?.snapshot ? (
        <SectionCard title={t(STR.snapshotSources)} className="mb-6">
          <KeyValueTable
            rows={[
              {
                k: t({ el: "Λειτουργία", en: "Mode" }),
                v: (
                  <span className="font-mono">
                    {data.results.snapshot.mode}
                    {data.results.snapshot.degraded ? " · degraded" : ""}
                  </span>
                ),
              },
              {
                k: t({ el: "Ανάκτηση", en: "Retrieved" }),
                v: data.results.snapshot.retrieved_at
                  ? fmtDateTime(data.results.snapshot.retrieved_at, lang)
                  : "—",
              },
              {
                k: t(STR.snapshotCoverage),
                v: data.results.snapshot.coverage ? (
                  <span className="font-mono text-xs">
                    {Object.entries(data.results.snapshot.coverage)
                      .map(([layer, origin]) => `${layer}=${origin}`)
                      .join(" · ")}
                  </span>
                ) : (
                  "—"
                ),
              },
              {
                k: t(STR.dataSources),
                v:
                  data.results.snapshot.sources && data.results.snapshot.sources.length > 0 ? (
                    <ul className="space-y-1">
                      {data.results.snapshot.sources.map((src, i) => (
                        <li key={`${src.name}-${i}`} className="text-sm">
                          <span className="font-medium">{src.name}</span>
                          {src.url ? (
                            <>
                              {" — "}
                              <a
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 underline underline-offset-2 hover:text-blue-500 dark:text-blue-400"
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
            ]}
          />
        </SectionCard>
      ) : null}

      <ProvenanceChain run={data} />

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
            <AIReportView ai={ai} modelLabel={t(displayModel)} />
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
                          {t(metricLabel(key))}
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
              <summary className="cursor-pointer rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
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
