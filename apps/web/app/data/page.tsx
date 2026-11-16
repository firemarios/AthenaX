"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Badge,
  DataCard,
  EmptyState,
  ExportButton,
  FilterPanel,
  SearchBar,
  useI18n,
} from "@policylab/ui";
import type { Dataset, Source } from "@policylab/types";
import { useApi } from "@/_shared/hooks";
import { downloadBlob, fmtDate, toCSV } from "@/_shared/format";
import {
  ErrorPanel,
  PageFallback,
  PageHeader,
  Pagination,
  QualityBars,
  Tag,
  btnSecondary,
  inputCls,
  labelCls,
  mutedText,
} from "@/_shared/ui";

const STR = {
  title: { el: "Κέντρο Ανοικτών Δεδομένων", en: "Open Data Hub" },
  desc: {
    el: "Αναζήτηση συνόλων δεδομένων από δημόσιες πηγές με διαφάνεια ποιότητας, προέλευσης και άδειας χρήσης.",
    en: "Search public datasets with transparent quality, provenance and licence information.",
  },
  search: { el: "Αναζήτηση συνόλων δεδομένων…", en: "Search datasets…" },
  filters: { el: "Φίλτρα", en: "Filters" },
  source: { el: "Πηγή", en: "Source" },
  allSources: { el: "Όλες οι πηγές", en: "All sources" },
  tag: { el: "Ετικέτα", en: "Tag" },
  tagPh: { el: "π.χ. mobility", en: "e.g. mobility" },
  apply: { el: "Εφαρμογή", en: "Apply" },
  clear: { el: "Καθαρισμός", en: "Clear" },
  sort: { el: "Ταξινόμηση", en: "Sort" },
  sortFresh: { el: "Νεότερα πρώτα", en: "Freshest first" },
  sortTitle: { el: "Τίτλος (Α–Ω)", en: "Title (A–Z)" },
  results: { el: "σύνολα", en: "datasets" },
  empty: { el: "Δεν βρέθηκαν σύνολα δεδομένων", en: "No datasets found" },
  emptyDesc: {
    el: "Δοκιμάστε διαφορετικό όρο αναζήτησης ή αφαιρέστε κάποιο φίλτρο.",
    en: "Try a different search term or remove a filter.",
  },
  suggestions: ["μετακινητικότητα", "πράσινο", "πληθυσμός", "καιρός"],
  details: { el: "Λεπτομέρειες →", en: "Details →" },
  quality: { el: "Ποιότητα", en: "Quality" },
};

function buildDatasetsPath(params: {
  q: string;
  sourceId: string;
  tag: string;
  sort: string;
  page: number;
  pageSize: number;
}): string {
  const p = new URLSearchParams();
  if (params.q) p.set("q", params.q);
  if (params.sourceId) p.set("source_id", params.sourceId);
  if (params.tag) p.set("tag", params.tag);
  p.set("page", String(params.page));
  p.set("page_size", String(params.pageSize));
  p.set("sort", params.sort);
  return `/v1/datasets?${p.toString()}`;
}

function DataView() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const q = sp.get("q") ?? "";
  const sourceId = sp.get("source_id") ?? "";
  const tag = sp.get("tag") ?? "";
  const sort = sp.get("sort") ?? "freshness";
  const page = Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1);
  const pageSize = 12;

  const [tagDraft, setTagDraft] = useState(tag);
  const [prevTag, setPrevTag] = useState(tag);
  if (tag !== prevTag) {
    setPrevTag(tag);
    setTagDraft(tag);
  }

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const sources = useApi<Source[]>("/v1/sources");

  const datasetsPath = useMemo(
    () => buildDatasetsPath({ q, sourceId, tag, sort, page, pageSize }),
    [q, sourceId, tag, sort, page]
  );
  const datasets = useApi<Dataset[]>(datasetsPath);

  const total = datasets.meta?.total ?? null;
  const pageCount =
    total !== null ? Math.max(1, Math.ceil(total / (datasets.meta?.page_size ?? pageSize))) : 1;

  const onExport = (format: "csv" | "geojson" | "json") => {
    const rows = (datasets.data ?? []).map((d) => ({
      id: d.id,
      title: d.title,
      description: d.description ?? "",
      provider: d.provider ?? d.original_source?.name ?? "",
      category: d.category ?? "",
      license: d.license ?? "",
      format: d.format ?? "",
      geographic_scope: d.geographic_scope ?? "",
      last_updated: d.last_updated ?? "",
      completeness: d.quality?.completeness ?? "",
      freshness: d.quality?.freshness ?? "",
      validation_status: d.quality?.validation_status ?? "",
      source_url: d.original_source?.url ?? "",
      tags: (d.tags ?? []).join("; "),
    }));
    if (format === "csv") {
      const columns = [
        { key: "id", header: "id" },
        { key: "title", header: "title" },
        { key: "description", header: "description" },
        { key: "provider", header: "provider" },
        { key: "category", header: "category" },
        { key: "license", header: "license" },
        { key: "format", header: "format" },
        { key: "geographic_scope", header: "geographic_scope" },
        { key: "last_updated", header: "last_updated" },
        { key: "completeness", header: "completeness" },
        { key: "freshness", header: "freshness" },
        { key: "validation_status", header: "validation_status" },
        { key: "source_url", header: "source_url" },
        { key: "tags", header: "tags" },
      ];
      downloadBlob(toCSV(rows, columns), "datasets.csv", "text/csv;charset=utf-8");
      return;
    }
    downloadBlob(
      JSON.stringify(datasets.data ?? [], null, 2),
      "datasets.json",
      "application/json"
    );
  };

  const list = datasets.data ?? [];

  return (
    <div className="mx-auto w-full max-w-[96rem] px-4 py-8 sm:px-6">
      <PageHeader title={t(STR.title)} description={t(STR.desc)} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className={mutedText} aria-live="polite">
          {total !== null ? `${total} ${t(STR.results)}` : ""}
          {datasets.loading ? ` · ${t({ el: "Φόρτωση…", en: "Loading…" })}` : ""}
        </p>
        <ExportButton onExport={onExport} />
      </div>

      <FilterPanel defaultOpen>
        <div className="space-y-3">
          <SearchBar
            key={q}
            placeholder={t(STR.search)}
            initial={q}
            onSearch={(value) => update({ q: value.trim(), page: "1" })}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="data-source" className={labelCls}>
                {t(STR.source)}
              </label>
              <select
                id="data-source"
                className={inputCls}
                value={sourceId}
                onChange={(e) => update({ source_id: e.target.value, page: "1" })}
              >
                <option value="">{t(STR.allSources)}</option>
                {(sources.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <form
              className="contents"
              onSubmit={(e) => {
                e.preventDefault();
                update({ tag: tagDraft.trim(), page: "1" });
              }}
            >
              <div>
                <label htmlFor="data-tag" className={labelCls}>
                  {t(STR.tag)}
                </label>
                <div className="flex gap-2">
                  <input
                    id="data-tag"
                    type="search"
                    className={inputCls}
                    placeholder={t(STR.tagPh)}
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                  />
                  <button type="submit" className={btnSecondary}>
                    {t(STR.apply)}
                  </button>
                </div>
              </div>
            </form>
            <div>
              <label htmlFor="data-sort" className={labelCls}>
                {t(STR.sort)}
              </label>
              <select
                id="data-sort"
                className={inputCls}
                value={sort}
                onChange={(e) => update({ sort: e.target.value, page: "1" })}
              >
                <option value="freshness">{t(STR.sortFresh)}</option>
                <option value="title">{t(STR.sortTitle)}</option>
              </select>
            </div>
          </div>
          {tag || sourceId || q ? (
            <button
              type="button"
              className={btnSecondary}
              onClick={() => update({ q: "", source_id: "", tag: "", page: "" })}
            >
              {t(STR.clear)}
            </button>
          ) : null}
        </div>
      </FilterPanel>

      <div className="mt-6">
        {datasets.loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
              />
            ))}
          </div>
        ) : datasets.error ? (
          <ErrorPanel message={datasets.error} onRetry={datasets.reload} />
        ) : list.length === 0 ? (
          <EmptyState
            title={t(STR.empty)}
            description={t(STR.emptyDesc)}
            suggestions={STR.suggestions}
          />
        ) : (
          <ul className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((d) => {
              const provider =
                d.provider ?? d.original_source?.name ?? "";
              const providerLabel =
                provider.length > 30
                  ? `${provider.slice(0, 29).trimEnd()}…`
                  : provider;
              return (
              <li key={d.id} className="flex">
                <DataCard
                  title={d.title}
                  subtitle={d.description ?? undefined}
                  badge={
                    <Badge tone="info">
                      {providerLabel || t({ el: "Πηγή", en: "Source" })}
                    </Badge>
                  }
                  meta={
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                        {d.category ? <Tag>{d.category}</Tag> : null}
                        {d.format ? <Tag>{d.format}</Tag> : null}
                        <span>{fmtDate(d.last_updated, lang)}</span>
                        {d.license ? <span>{d.license}</span> : null}
                      </div>
                      <QualityBars quality={d.quality} compact />
                    </div>
                  }
                  footer={
                    <Link
                      href={`/data/${d.id}`}
                      className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                    >
                      {t(STR.details)}
                    </Link>
                  }
                />
              </li>
              );
            })}
          </ul>
        )}
      </div>

      <Pagination
        page={page}
        pageCount={pageCount}
        onChange={(next) => update({ page: String(next) })}
      />
    </div>
  );
}

export default function DataPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <DataView />
    </Suspense>
  );
}
