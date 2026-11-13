"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge, DataCard, EmptyState, Skeleton, useI18n } from "@policylab/ui";
import type { Policy, SimulationRun } from "@policylab/types";
import { useApi } from "@/_shared/hooks";
import { fmtDateTime } from "@/_shared/format";
import {
  ErrorPanel,
  PageFallback,
  PageHeader,
  inputCls,
  mutedText,
} from "@/_shared/ui";

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
  search: { el: "Αναζήτηση", en: "Search" },
  searchPh: {
    el: "Αναζήτηση με μοντέλο ή πολιτική…",
    en: "Search by model or policy…",
  },
  status: { el: "Κατάσταση", en: "Status" },
  allStatuses: { el: "Όλες οι καταστάσεις", en: "All statuses" },
  filteredBy: { el: "Φιλτράρισμα πολιτικής", en: "Filtered by policy" },
  clear: { el: "Καθαρισμός φίλτρων", en: "Clear filters" },
  noMatches: { el: "Δεν βρέθηκαν προσομοιώσεις", en: "No simulations found" },
  noMatchesDesc: {
    el: "Δοκιμάστε διαφορετικό όρο αναζήτησης ή κατάσταση.",
    en: "Try a different search term or status.",
  },
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

function SimulationsView() {
  const { t, lang } = useI18n();
  const sp = useSearchParams();
  const policyFilter = sp.get("policy_id") ?? "";
  const runs = useApi<SimulationRun[]>("/v1/simulations");
  const policies = useApi<Policy[]>("/v1/policies");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SimulationRun["status"] | "">("");

  const policyTitles = useMemo(() => {
    const map = new Map<string, string>();
    for (const policy of policies.data ?? []) map.set(policy.id, policy.title);
    return map;
  }, [policies.data]);

  const all = useMemo(() => runs.data ?? [], [runs.data]);

  const list = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return all.filter((run) => {
      if (policyFilter && run.policy_id !== policyFilter) return false;
      if (status && run.status !== status) return false;
      if (!term) return true;
      const title = run.policy_id ? (policyTitles.get(run.policy_id) ?? "") : "";
      return `${run.model_name} ${title} ${run.status}`
        .toLocaleLowerCase()
        .includes(term);
    });
  }, [all, policyFilter, status, query, policyTitles]);

  const hasFilters = Boolean(policyFilter || status || query.trim());
  const filteredPolicyTitle = policyFilter
    ? (policyTitles.get(policyFilter) ?? policyFilter)
    : null;

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
                className="h-40 animate-pulse rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
              />
            ))}
          </div>
          <Skeleton rows={3} />
        </div>
      ) : runs.error ? (
        <ErrorPanel message={runs.error} onRetry={runs.reload} />
      ) : all.length === 0 ? (
        <EmptyState
          title={t(STR.empty)}
          description={t(STR.emptyDesc)}
          action={
            <Link
              href="/policies"
              className="rounded font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              {t(STR.toPolicies)}
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <label htmlFor="simulation-search" className="sr-only">
              {t(STR.search)}
            </label>
            <input
              id="simulation-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t(STR.searchPh)}
              className={`${inputCls} sm:max-w-sm`}
            />
            <label htmlFor="simulation-status" className="sr-only">
              {t(STR.status)}
            </label>
            <select
              id="simulation-status"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as SimulationRun["status"] | "")
              }
              className={`${inputCls} sm:w-52`}
            >
              <option value="">{t(STR.allStatuses)}</option>
              {(Object.keys(STATUS_LABELS) as SimulationRun["status"][]).map((key) => (
                <option key={key} value={key}>
                  {t(STATUS_LABELS[key])}
                </option>
              ))}
            </select>
          </div>

          {policyFilter ? (
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                {t(STR.filteredBy)}: {filteredPolicyTitle}
              </span>
              <Link
                href="/simulations"
                className="rounded font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                {t(STR.clear)}
              </Link>
            </div>
          ) : null}

          <p className={`mb-4 ${mutedText}`} aria-live="polite">
            {list.length} {t(STR.count)}
          </p>

          {list.length === 0 ? (
            <EmptyState
              title={t(STR.noMatches)}
              description={t(STR.noMatchesDesc)}
              action={
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setStatus("");
                  }}
                  className="rounded font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                >
                  {t(STR.clear)}
                </button>
              }
            />
          ) : (
            <ul className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                          href={`/simulations/${run.id}`}
                          className="rounded font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                        >
                          {t(STR.details)}
                        </Link>
                        {run.status === "succeeded" ? (
                          <Link
                            href={`/impact/${run.id}`}
                            className="rounded font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
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
          )}

          {hasFilters && list.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setStatus("");
              }}
              className="mt-4 text-sm font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {t(STR.clear)}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function SimulationsPage() {
  return (
    <Suspense fallback={<PageFallback rows={6} />}>
      <SimulationsView />
    </Suspense>
  );
}
