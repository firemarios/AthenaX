"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Badge, DataCard, EmptyState, Skeleton, useI18n } from "@athenax/ui";
import type { Policy, SimulationRun } from "@athenax/types";
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
  policy: { el: "Πολιτική", en: "Policy" },
  created: { el: "Εκτελέστηκε", en: "Executed" },
  view: { el: "Άνοιγμα αναφοράς →", en: "Open report →" },
  simulation: { el: "Προσομοίωση", en: "Simulation" },
};

export default function ImpactPage() {
  const { t, lang } = useI18n();
  const runs = useApi<SimulationRun[]>("/v1/simulations");
  const policies = useApi<Policy[]>("/v1/policies");
  const policyTitles = useMemo(() => {
    const map = new Map<string, string>();
    for (const policy of policies.data ?? []) map.set(policy.id, policy.title);
    return map;
  }, [policies.data]);
  const list = (runs.data ?? []).filter(
    (run) => run.status === "succeeded" && run.results
  );

  return (
    <div className="mx-auto w-full max-w-[96rem] px-4 py-8 sm:px-6">
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
            <Link href="/simulations" className="rounded font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
              {t(STR.toSimulations)}
            </Link>
          }
        />
      ) : (
        <>
          <p className={`mb-4 ${mutedText}`} aria-live="polite">
            {list.length} {t(STR.count)}
          </p>
          <ul className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                      {run.policy_id ? (
                        <span>
                          {t(STR.policy)}:{" "}
                          <Link
                            href={`/policies/${run.policy_id}`}
                            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                          >
                            {policyTitles.get(run.policy_id) ?? run.policy_id}
                          </Link>
                        </span>
                      ) : null}
                    </>
                  }
                  footer={
                    <span className="flex flex-wrap gap-4">
                      <Link
                        href={`/impact/${run.id}`}
                        className="rounded font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                      >
                        {t(STR.view)}
                      </Link>
                      <Link
                        href={`/simulations/${run.id}`}
                        className="rounded font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                      >
                        {t(STR.simulation)}
                      </Link>
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
