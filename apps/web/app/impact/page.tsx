"use client";

import Link from "next/link";
import { Badge, DataCard, EmptyState, Skeleton, useI18n } from "@policylab/ui";
import type { SimulationRun } from "@policylab/types";
import { useApi } from "@/_shared/hooks";
import { fmtDateTime } from "@/_shared/format";
import { ErrorPanel, PageHeader, mutedText } from "@/_shared/ui";

const STR = {
  title: { el: "Επιπτώσεις", en: "Impact" },
  desc: {
    el: "Αποτιμήσεις έξι διαστάσεων για κάθε ολοκληρωμένη προσομοίωση, με σύγκριση σεναρίου και βάσης.",
    en: "Six-dimension assessments for every completed simulation, comparing scenario against baseline.",
  },
  count: { el: "αναφορές", en: "reports" },
  loading: { el: "Φόρτωση αποτιμήσεων…", en: "Loading impact reports…" },
  empty: { el: "Δεν υπάρχουν αποτιμήσεις ακόμη", en: "No impact reports yet" },
  emptyDesc: {
    el: "Οι αποτιμήσεις παράγονται από ολοκληρωμένες προσομοιώσεις. Εκτελέστε μια προσομοίωση για να δημιουργηθεί η πρώτη αναφορά.",
    en: "Reports are generated from completed simulations. Run a simulation to create the first report.",
  },
  toSimulations: { el: "Μετάβαση στις προσομοιώσεις", en: "Go to simulations" },
  model: { el: "Μοντέλο", en: "Model" },
  created: { el: "Εκτελέστηκε", en: "Executed" },
  view: { el: "Άνοιγμα αναφοράς →", en: "Open report →" },
};

export default function ImpactPage() {
  const { t, lang } = useI18n();
  const runs = useApi<SimulationRun[]>("/v1/simulations");
  const list = (runs.data ?? []).filter(
    (run) => run.status === "succeeded" && run.results
  );

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
            <Link href="/simulations" className="rounded font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
              {t(STR.toSimulations)}
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
                  subtitle={`${t(STR.model)} · ${run.model_version}`}
                  badge={<Badge tone="success">{t({ el: "Έτοιμη", en: "Ready" })}</Badge>}
                  meta={
                    <>
                      <span>
                        {t(STR.created)}: {fmtDateTime(run.created_at, lang)}
                      </span>
                      {run.policy_id ? <span>{run.policy_id}</span> : null}
                    </>
                  }
                  footer={
                    <Link
                      href={`/impact/${run.id}`}
                      className="rounded font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                    >
                      {t(STR.view)}
                    </Link>
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
