"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge, EmptyState, useI18n } from "@policylab/ui";
import type { Dataset } from "@policylab/types";
import { doGet, useApi } from "@/_shared/hooks";
import { fmtBytes, fmtDate, fmtDateTime } from "@/_shared/format";
import {
  ErrorPanel,
  KeyValueTable,
  PageFallback,
  PageHeader,
  QualityBars,
  SectionCard,
  Tag,
  btnSecondary,
  mutedText,
  validationTone,
} from "@/_shared/ui";

const STR = {
  back: { el: "← Πίσω στα δεδομένα", en: "← Back to datasets" },
  metadata: { el: "Μεταδεδομένα", en: "Metadata" },
  provenance: { el: "Προέλευση & ακεραιότητα", en: "Provenance & integrity" },
  quality: { el: "Ποιότητα", en: "Quality" },
  resources: { el: "Πόροι για λήψη", en: "Download resources" },
  related: { el: "Σχετικά σύνολα", en: "Related datasets" },
  noRelated: { el: "Δεν υπάρχουν σχετικά σύνολα.", en: "No related datasets." },
  source: { el: "Αρχική πηγή", en: "Original source" },
  provider: { el: "Πάροχος", en: "Provider" },
  category: { el: "Κατηγορία", en: "Category" },
  format: { el: "Μορφή", en: "Format" },
  scope: { el: "Γεωγραφική κάλυψη", en: "Geographic scope" },
  license: { el: "Άδεια χρήσης", en: "Licence" },
  updated: { el: "Τελευταία ενημέρωση", en: "Last updated" },
  tags: { el: "Ετικέτες", en: "Tags" },
  description: { el: "Περιγραφή", en: "Description" },
  retrieved: { el: "Ημερομηνία ανάκτησης", en: "Retrieved at" },
  checksum: { el: "Checksum", en: "Checksum" },
  version: { el: "Έκδοση πηγής", en: "Source version" },
  download: { el: "Λήψη", en: "Download" },
  openSource: { el: "Προβολή πηγής ↗", en: "View source ↗" },
  none: { el: "—", en: "—" },
};

function DatasetDetailView() {
  const { t, lang } = useI18n();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const ds = useApi<Dataset>(id ? `/v1/datasets/${encodeURIComponent(id)}` : null);

  const [related, setRelated] = useState<Dataset[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);

  const relatedIds = ds.data?.related_ids ?? [];

  useEffect(() => {
    const ids = (ds.data?.related_ids ?? []).slice(0, 6);
    if (!ds.data || ids.length === 0) {
      const clearId = window.setTimeout(() => {
        setRelated([]);
        setRelatedLoading(false);
      }, 0);
      return () => window.clearTimeout(clearId);
    }
    const ac = new AbortController();
    let cancelled = false;
    const loadId = window.setTimeout(() => {
      if (!cancelled) setRelatedLoading(true);
    }, 0);
    Promise.all(
      ids.map((rid) => doGet<Dataset>(`/v1/datasets/${encodeURIComponent(rid)}`, ac.signal))
    )
      .then((results) => {
        if (cancelled) return;
        setRelated(results.map((r) => r.data).filter((d): d is Dataset => d !== null));
        setRelatedLoading(false);
      })
      .catch(() => {
        if (!cancelled) setRelatedLoading(false);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(loadId);
      ac.abort();
    };
  }, [ds.data]);

  if (ds.loading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6" aria-busy="true">
        <PageFallback rows={10} />
      </div>
    );
  }

  if (ds.error) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <Link href="/data" className={`${btnSecondary} mb-4`}>
          {t(STR.back)}
        </Link>
        <ErrorPanel message={ds.error} onRetry={ds.reload} />
      </div>
    );
  }

  const d = ds.data;

  if (!d) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <EmptyState
          title={t({ el: "Το σύνολο δεδομένων δεν βρέθηκε", en: "Dataset not found" })}
          description={t({
            el: "Η καταχώρηση μπορεί να έχει αφαιρεθεί ή να μην είναι διαθέσιμη.",
            en: "The record may have been removed or is unavailable.",
          })}
          action={
            <Link href="/data" className={btnSecondary}>
              {t(STR.back)}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        title={d.title}
        description={d.description ?? undefined}
        breadcrumbs={[
          { label: t({ el: "Δεδομένα", en: "Data" }), href: "/data" },
          { label: d.title },
        ]}
        actions={
          d.original_source?.url ? (
            <a
              href={d.original_source.url}
              target="_blank"
              rel="noopener noreferrer"
              className={btnSecondary}
            >
              {t(STR.openSource)}
            </a>
          ) : undefined
        }
      />

      <div className="space-y-6">
        <SectionCard title={t(STR.metadata)}>
          <KeyValueTable
            rows={[
              {
                k: t(STR.provider),
                v: d.provider ?? d.original_source?.name ?? t(STR.none),
              },
              { k: t(STR.category), v: d.category ?? t(STR.none) },
              { k: t(STR.format), v: d.format ?? t(STR.none) },
              { k: t(STR.scope), v: d.geographic_scope ?? t(STR.none) },
              { k: t(STR.license), v: d.license ?? t(STR.none) },
              { k: t(STR.updated), v: fmtDate(d.last_updated, lang) },
              {
                k: t(STR.tags),
                v:
                  d.tags && d.tags.length > 0 ? (
                    <span className="flex flex-wrap gap-1.5">
                      {d.tags.map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </span>
                  ) : (
                    t(STR.none)
                  ),
              },
              {
                k: t(STR.description),
                v: d.description ?? t(STR.none),
              },
            ]}
          />
        </SectionCard>

        <SectionCard title={t(STR.provenance)}>
          <KeyValueTable
            rows={[
              {
                k: t(STR.source),
                v: d.original_source?.url ? (
                  <a
                    href={d.original_source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                  >
                    {d.original_source.name || d.original_source.url}
                  </a>
                ) : (
                  d.original_source?.name ?? t(STR.none)
                ),
              },
              {
                k: t(STR.retrieved),
                v: fmtDateTime(d.provenance?.retrieved_at, lang),
              },
              {
                k: t(STR.checksum),
                v: d.provenance?.checksum ? (
                  <code className="block break-all rounded bg-zinc-100 px-2 py-1 font-mono text-xs dark:bg-zinc-800">
                    {d.provenance.checksum}
                  </code>
                ) : (
                  t(STR.none)
                ),
              },
              { k: t(STR.version), v: d.provenance?.source_version ?? t(STR.none) },
            ]}
          />
        </SectionCard>

        <SectionCard title={t(STR.quality)}>
          <div className="flex flex-wrap items-start gap-6">
            <div className="min-w-56 flex-1">
              <QualityBars quality={d.quality} />
            </div>
            <div className="flex flex-col items-start gap-2">
              <span className={`text-xs ${mutedText}`}>
                {t({ el: "Κατάσταση επαλήθευσης", en: "Validation status" })}
              </span>
              <Badge tone={validationTone(d.quality?.validation_status)}>
                {String(d.quality?.validation_status ?? "pending")}
              </Badge>
            </div>
          </div>
        </SectionCard>

        <SectionCard title={t(STR.resources)}>
          {d.resources && d.resources.length > 0 ? (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {d.resources.map((r) => (
                <li
                  key={r.url + r.title}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {r.title || r.url}
                    </p>
                    <p className={`text-xs ${mutedText}`}>
                      <Tag>{r.format}</Tag>{" "}
                      <span className="ml-1">{fmtBytes(r.size_bytes)}</span>
                    </p>
                  </div>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={btnSecondary}
                  >
                    {t(STR.download)} ↓
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className={mutedText}>{t(STR.none)}</p>
          )}
        </SectionCard>

        <SectionCard title={t(STR.related)}>
          {relatedLoading ? (
            <p className={mutedText}>{t({ el: "Φόρτωση…", en: "Loading…" })}</p>
          ) : related.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {related.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/data/${r.id}`}
                    className="block rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 hover:border-blue-400 dark:hover:border-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {r.title}
                    </span>
                    <span className={`mt-1 block text-xs ${mutedText}`}>
                      {r.provider ?? r.original_source?.name ?? ""} ·{" "}
                      {fmtDate(r.last_updated, lang)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : relatedIds.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {relatedIds.slice(0, 6).map((rid) => (
                <li key={rid}>
                  <Link href={`/data/${rid}`} className={btnSecondary}>
                    {rid}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className={mutedText}>{t(STR.noRelated)}</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

export default function DatasetPage() {
  return (
    <Suspense fallback={<PageFallback rows={10} />}>
      <DatasetDetailView />
    </Suspense>
  );
}
