"use client";

import Link from "next/link";
import { Badge, DataCard, EmptyState, Skeleton, useI18n } from "@policylab/ui";
import type { SimulationRun } from "@policylab/types";
import { useApi } from "@/_shared/hooks";
import { fmtDateTime } from "@/_shared/format";
import { ErrorPanel, PageHeader, mutedText } from "@/_shared/ui";

const STR = {
  title: { el: "Προσομοιώσεις", en: "Simulations" },
  desc: {
    el: "Εκτελέσεις μοντέλων με διαφάνεια: παράμετροι, αβεβαιότητα και διαβατήριο προσομοίωσης.",
    en: "Model runs with full transparency: parameters, uncertainty and a simulation passport.",
  },
  count: { el: "εκτελέσεις", en: "runs" },
  loading: { el: "Φόρτωση προσομοιώσεων…", en: "Loading simulations…" },
  empty: { el: "Δεν υπάρχουν προσομοιώσεις ακόμη", en: "No simulations yet" },
  emptyDesc: {
    el: "Ξεκινήστε από μια πολιτική και εκτελέστε ένα μοντέλο για να δημιουργηθεί η πρώτη προσομοίωση.",
    en: "Start from a policy and run a model to create your first simulation.",
  },
  toPolicies: { el: "Μετάβαση στις πολιτικές", en: "Go to policies" },
  model: { el: "Μοντέλο", en: "Model" },
  version: { el: "Έκδοση", en: "Version" },
  created: { el: "Εκτελέστηκε", en: "Executed" },
  policy: { el: "Πολιτική", en: "Policy" },
  details: { el: "Λεπτομέρειες →", en: "Details →" },
  impact: { el: "Αποτίμηση επιπτώσεων", en: "Impact report" },
};

function statusTone(status: SimulationRun["status"]) {
  if (status === "succeeded") return "success" as const;
  if (status === "failed") return "error" as const;
  if (status === "running") return "info" as const;
  return "neutral" as const;
}

const STATUS_LABELS: Record<SimulationRun["status"], { el: string; en: string }> = {
  queued: { el: "Σε αναμονή", en: "Queued" },
  running: { el: "Σε εξέλιξη", en: "Running" },
  succeeded: { el: "Ολοκληρώθηκε", en: "Succeeded" },
  failed: { el: "Απέτυχε", en: "Failed" },
};

export default function SimulationsPage() {
  const { t, lang } = useI18n();
  const runs = useApi<SimulationRun[]>("/v1/simulations");
  const list = runs.data ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader title={t(STR.title)} description={t(STR.desc)} />

      {runs.loading ? (
        <div aria-busy="true" aria-live="polite" className="space-y-4">
          <span className="sr-only">{t(STR.loading)}</span>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
              />
            ))}
          </div>
          <Skeleton rows={3} />
        </div>
      ) : runs.error ? (
        <ErrorPanel message={runs.error} onRetry={runs.reload} />
      ) : list.length === 0 ? (
        <EmptyState
          title={t(STR.empty)}
          description={t(STR.emptyDesc)}
          action={
            <Link href="/policies" className="rounded font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
              {t(STR.toPolicies)}
            </Link>
          }
        />
      ) : (
        <>
          <p className={`mb-4 ${mutedText}`} aria-live="polite">
            {list.length} {t(STR.count)}
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((run) => (
              <li key={run.id} className="flex">
                <DataCard
                  title={run.model_name}
                  subtitle={`${t(STR.version)} ${run.model_version}`}
                  badge={
                    <Badge tone={statusTone(run.status)}>
                      {t(STATUS_LABELS[run.status])}
                    </Badge>
                  }
                  meta={
                    <>
                      <span>
                        {t(STR.created)}: {fmtDateTime(run.created_at, lang)}
                      </span>
                      {run.policy_id ? (
                        <span>
                          {t(STR.policy)}: {run.policy_id}
                        </span>
                      ) : null}
                    </>
                  }
                  footer={
                    <span className="flex flex-wrap gap-4">
                      <Link
                        href={`/simulations/${run.id}`}
                        className="rounded font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                      >
                        {t(STR.details)}
                      </Link>
                      {run.status === "succeeded" ? (
                        <Link
                          href={`/impact/${run.id}`}
                          className="rounded font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                        >
                          {t(STR.impact)}
                        </Link>
                      ) : null}
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
