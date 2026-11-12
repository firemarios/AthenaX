"use client";

import Link from "next/link";
import { Badge, DataCard, EmptyState, Skeleton, useI18n } from "@policylab/ui";
import type { Policy } from "@policylab/types";
import { useApi } from "@/_shared/hooks";
import { fmtDate } from "@/_shared/format";
import {
  ErrorPanel,
  PageHeader,
  Tag,
  btnPrimary,
  mutedText,
} from "@/_shared/ui";
import {
  categoryLabel,
  statusLabel,
  statusTone,
  POLICY_STATUS_LABELS,
} from "@/_shared/terms";

const STR = {
  title: { el: "Εργαστήριο Πολιτικών", en: "Policy Lab" },
  desc: {
    el: "Δημιουργήστε πολιτικές, ορίστε παραμέτρους και εκτελέστε προσομοιώσεις για να συγκρίνετε σενάρια πριν από την απόφαση.",
    en: "Create policies, set parameters and run simulations to compare scenarios before deciding.",
  },
  newPolicy: { el: "Νέα πολιτική", en: "New policy" },
  count: { el: "πολιτικές", en: "policies" },
  loading: { el: "Φόρτωση πολιτικών…", en: "Loading policies…" },
  empty: { el: "Δεν υπάρχουν πολιτικές ακόμη", en: "No policies yet" },
  emptyDesc: {
    el: "Ξεκινήστε δημιουργώντας την πρώτη σας πολιτική και προσθέστε παραμέτρους, υποθέσεις και δείκτες.",
    en: "Start by creating your first policy and adding parameters, assumptions and KPIs.",
  },
  details: { el: "Λεπτομέρειες →", en: "Details →" },
  area: { el: "Περιοχή", en: "Area" },
  citywide: { el: "Ολόκληρη η πόλη", en: "City-wide" },
  created: { el: "Δημιουργήθηκε", en: "Created" },
  category: { el: "Κατηγορία", en: "Category" },
  status: { el: "Κατάσταση", en: "Status" },
  noCategory: { el: "Χωρίς κατηγορία", en: "Uncategorised" },
};

export default function PoliciesPage() {
  const { t, lang } = useI18n();
  const policies = useApi<Policy[]>("/v1/policies");
  const list = policies.data ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title={t(STR.title)}
        description={t(STR.desc)}
        actions={
          <Link href="/policies/new" className={btnPrimary}>
            + {t(STR.newPolicy)}
          </Link>
        }
      />

      {policies.loading ? (
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
      ) : policies.error ? (
        <ErrorPanel message={policies.error} onRetry={policies.reload} />
      ) : list.length === 0 ? (
        <EmptyState
          title={t(STR.empty)}
          description={t(STR.emptyDesc)}
          action={
            <Link href="/policies/new" className={btnPrimary}>
              + {t(STR.newPolicy)}
            </Link>
          }
        />
      ) : (
        <>
          <p className={`mb-4 ${mutedText}`} aria-live="polite">
            {list.length} {t(STR.count)}
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((policy) => {
              const cat = categoryLabel(policy.category);
              return (
                <li key={policy.id} className="flex">
                  <DataCard
                    title={policy.title}
                    subtitle={policy.description ?? undefined}
                    badge={
                      <Badge tone="info">
                        {cat ? t(cat) : t(STR.noCategory)}
                      </Badge>
                    }
                    meta={
                      <>
                        <Badge tone={statusTone(policy.status)}>
                          {t(statusLabel(policy.status, POLICY_STATUS_LABELS))}
                        </Badge>
                        <span>
                          {t(STR.area)}: {policy.area || t(STR.citywide)}
                        </span>
                        <span>
                          {t(STR.created)}: {fmtDate(policy.created_at, lang)}
                        </span>
                        {policy.variants && policy.variants.length > 0 ? (
                          <Tag>
                            {policy.variants.length}{" "}
                            {t({ el: "παραλλαγές", en: "variants" })}
                          </Tag>
                        ) : null}
                      </>
                    }
                    footer={
                      <Link
                        href={`/policies/${policy.id}`}
                        className="rounded font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      >
                        {t(STR.details)}
                      </Link>
                    }
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
