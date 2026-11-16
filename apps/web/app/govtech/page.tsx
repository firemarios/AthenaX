"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Badge,
  DataCard,
  EmptyState,
  MapPanel,
  SearchBar,
  useI18n,
} from "@athenax/ui";
import type { Decision, Project } from "@athenax/types";
import { doGet, useApi } from "@/_shared/hooks";
import { geomToFeature, type Feature, type Geometry } from "@/_shared/geo";
import { fmtDate, fmtEUR } from "@/_shared/format";
import {
  ErrorPanel,
  LoadingBlock,
  PageHeader,
  Pagination,
  SectionCard,
  Tag,
  btnPrimary,
  btnSecondary,
  inputCls,
  labelCls,
  mutedText,
  Tabs,
} from "@/_shared/ui";

const STR = {
  title: { el: "GovTech: Αποφάσεις & Έργα", en: "GovTech: Decisions & Projects" },
  desc: {
    el: "Αναζήτηση δημοσίων αποφάσεων και παρακολούθηση δημοσίων έργων με χρονολόγιο και χάρτη παρεμβάσεων.",
    en: "Search public decisions and track public projects with timelines and an interventions map.",
  },
  tabDecisions: { el: "Αποφάσεις", en: "Decisions" },
  tabProjects: { el: "Έργα", en: "Projects" },
  tabMap: { el: "Χάρτης", en: "Map" },
  searchDecisions: { el: "Αναζήτηση αποφάσεων…", en: "Search decisions…" },
  searchProjects: { el: "Αναζήτηση έργων…", en: "Search projects…" },
  org: { el: "Φορέας", en: "Organisation" },
  orgPh: { el: "π.χ. Δήμος Αθηναίων", en: "e.g. City of Athens" },
  status: { el: "Κατάσταση", en: "Status" },
  allStatuses: { el: "Όλες οι καταστάσεις", en: "All statuses" },
  view: { el: "Προβολή απόφασης ↗", en: "View decision ↗" },
  budget: { el: "Προϋπολογισμός", en: "Budget" },
  linked: { el: "Συνδεδεμένες αποφάσεις", en: "Linked decisions" },
  timeline: { el: "Χρονολόγιο αποφάσεων", en: "Decision timeline" },
  showTimeline: { el: "Προβολή χρονολογίου", en: "Show timeline" },
  hideTimeline: { el: "Απόκρυψη", en: "Hide" },
  disclaimer: {
    el: "Οι πληροφορίες προέρχονται από δημόσιες πηγές· η παρουσία απόφασης δεν σημαίνει ολοκλήρωση έργου.",
    en: "Information comes from public sources; the presence of a decision does not mean project completion.",
  },
  emptyDecisions: { el: "Δεν βρέθηκαν αποφάσεις", en: "No decisions found" },
  emptyDecisionsDesc: {
    el: "Δοκιμάστε διαφορετικό όρο ή καθαρίστε τον φορέα.",
    en: "Try a different term or clear the organisation filter.",
  },
  emptyProjects: { el: "Δεν βρέθηκαν έργα", en: "No projects found" },
  emptyProjectsDesc: {
    el: "Δοκιμάστε άλλον όρο αναζήτησης ή άλλη κατάσταση.",
    en: "Try another search term or status.",
  },
  mapEmpty: {
    el: "Καμία γεωμετρία έργου δεν είναι διαθέσιμη — ο χάρτης είναι κεντραρισμένος στην Αθήνα.",
    en: "No project geometry available — the map is centred on Athens.",
  },
  none: { el: "—", en: "—" },
  noDate: { el: "χωρίς ημερομηνία", en: "no date" },
  open: { el: "Επέκταση", en: "Expand" },
};

const STATUS_TONES: Record<string, "neutral" | "success" | "warning" | "error" | "info"> = {
  completed: "success",
  complete: "success",
  done: "success",
  delivered: "success",
  finished: "success",
  in_progress: "info",
  active: "info",
  ongoing: "info",
  construction: "info",
  underway: "info",
  planned: "neutral",
  design: "neutral",
  proposal: "neutral",
  delayed: "warning",
  on_hold: "warning",
  suspended: "warning",
  cancelled: "error",
  canceled: "error",
  failed: "error",
};

function statusTone(status: string | null | undefined) {
  return STATUS_TONES[(status ?? "").toLowerCase()] ?? "neutral";
}

const STATUS_OPTIONS = [
  "planned",
  "in_progress",
  "construction",
  "completed",
  "delayed",
  "cancelled",
];

function statusLabel(status: string, t: (d: { el: string; en: string }) => string) {
  const map: Record<string, { el: string; en: string }> = {
    planned: { el: "Προγραμματισμένο", en: "Planned" },
    in_progress: { el: "Σε εξέλιξη", en: "In progress" },
    construction: { el: "Κατασκευή", en: "Construction" },
    completed: { el: "Ολοκληρωμένο", en: "Completed" },
    delayed: { el: "Με καθυστέρηση", en: "Delayed" },
    cancelled: { el: "Ακυρωμένο", en: "Cancelled" },
  };
  return map[status?.toLowerCase()] ? t(map[status.toLowerCase()]) : status || t(STR.none);
}

export default function GovTechPage() {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState("decisions");

  const [dq, setDq] = useState("");
  const [org, setOrg] = useState("");
  const [dpage, setDpage] = useState(1);

  const [pq, setPq] = useState("");
  const [pstatus, setPstatus] = useState("");

  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    id: string;
    loading: boolean;
    error: string | null;
    data: Project | null;
  }>({ id: "", loading: false, error: null, data: null });

  const decisionsPath = useMemo(() => {
    const p = new URLSearchParams();
    if (dq) p.set("q", dq);
    if (org) p.set("org", org);
    p.set("page", String(dpage));
    return `/v1/decisions?${p.toString()}`;
  }, [dq, org, dpage]);

  const projectsPath = useMemo(() => {
    const p = new URLSearchParams();
    if (pq) p.set("q", pq);
    if (pstatus) p.set("status", pstatus);
    return `/v1/projects?${p.toString()}`;
  }, [pq, pstatus]);

  const decisions = useApi<Decision[]>(decisionsPath);
  const projects = useApi<Project[]>(projectsPath);

  const dTotal = decisions.meta?.total ?? null;
  const dPageSize = decisions.meta?.page_size ?? 20;
  const dPageCount =
    dTotal !== null
      ? Math.max(1, Math.ceil(dTotal / dPageSize))
      : (decisions.data ?? []).length >= dPageSize
        ? dpage + 1
        : dpage;

  const mapFeatures = useMemo(() => {
    const out: Feature[] = [];
    for (const p of projects.data ?? []) {
      if (!p.geometry) continue;
      const f = geomToFeature(p.geometry as unknown as Geometry, {
        id: p.id,
        name: p.name,
        status: p.status,
      });
      if (f) out.push(f);
    }
    return out;
  }, [projects.data]);

  const toggleDetail = (id: string) => {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    setDetail({ id, loading: true, error: null, data: null });
    doGet<Project>(`/v1/projects/${encodeURIComponent(id)}`).then((res) => {
      setDetail((prev) =>
        prev.id === id ? { id, loading: false, error: res.error, data: res.data } : prev
      );
    });
  };

  const tabs = [
    { id: "decisions", label: t(STR.tabDecisions) },
    { id: "projects", label: t(STR.tabProjects) },
    { id: "map", label: t(STR.tabMap) },
  ];

  return (
    <div className="mx-auto w-full max-w-[96rem] px-4 py-8 sm:px-6">
      <PageHeader title={t(STR.title)} description={t(STR.desc)} />

      <Tabs tabs={tabs} active={tab} onChange={setTab} label={t(STR.title)} />

      <div className="mt-6">
        {tab === "decisions" ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <SearchBar
                  key={dq}
                  placeholder={t(STR.searchDecisions)}
                  initial={dq}
                  onSearch={(value) => {
                    setDq(value.trim());
                    setDpage(1);
                  }}
                />
              </div>
              <div>
                <label htmlFor="govtech-org" className={labelCls}>
                  {t(STR.org)}
                </label>
                <input
                  id="govtech-org"
                  type="search"
                  className={inputCls}
                  placeholder={t(STR.orgPh)}
                  value={org}
                  onChange={(e) => {
                    setOrg(e.target.value);
                    setDpage(1);
                  }}
                />
              </div>
            </div>

            {decisions.loading ? (
              <LoadingBlock rows={6} />
            ) : decisions.error ? (
              <ErrorPanel message={decisions.error} onRetry={decisions.reload} />
            ) : (decisions.data ?? []).length === 0 ? (
              <EmptyState title={t(STR.emptyDecisions)} description={t(STR.emptyDecisionsDesc)} />
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {(decisions.data ?? []).map((d) => (
                  <li key={d.id}>
                    <DataCard
                      title={d.title}
                      badge={
                        d.decision_type ? <Badge tone="info">{d.decision_type}</Badge> : undefined
                      }
                      meta={
                        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                          {d.org ? <span>{d.org}</span> : null}
                          <span>{d.date ? fmtDate(d.date, lang) : t(STR.noDate)}</span>
                        </div>
                      }
                      footer={
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          {t(STR.view)}
                        </a>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}

            <Pagination page={dpage} pageCount={dPageCount} onChange={setDpage} />
          </div>
        ) : null}

        {tab === "projects" ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <SearchBar
                  key={pq}
                  placeholder={t(STR.searchProjects)}
                  initial={pq}
                  onSearch={(value) => setPq(value.trim())}
                />
              </div>
              <div>
                <label htmlFor="govtech-status" className={labelCls}>
                  {t(STR.status)}
                </label>
                <select
                  id="govtech-status"
                  className={inputCls}
                  value={pstatus}
                  onChange={(e) => setPstatus(e.target.value)}
                >
                  <option value="">{t(STR.allStatuses)}</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s, t)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {projects.loading ? (
              <LoadingBlock rows={6} />
            ) : projects.error ? (
              <ErrorPanel message={projects.error} onRetry={projects.reload} />
            ) : (projects.data ?? []).length === 0 ? (
              <EmptyState title={t(STR.emptyProjects)} description={t(STR.emptyProjectsDesc)} />
            ) : (
              <ul className="space-y-4">
                {(projects.data ?? []).map((p) => {
                  const open = expanded === p.id;
                  return (
                    <li key={p.id}>
                      <DataCard
                        title={p.name}
                        badge={
                          p.status ? (
                            <Badge tone={statusTone(p.status)}>{statusLabel(p.status, t)}</Badge>
                          ) : undefined
                        }
                        meta={
                          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
                            <span>
                              {t(STR.budget)}:{" "}
                              <strong className="font-semibold text-zinc-800 dark:text-zinc-200">
                                {fmtEUR(p.budget, lang)}
                              </strong>
                            </span>
                            <span>
                              {t(STR.linked)}: {p.decisions?.length ?? 0}
                            </span>
                            {p.org ? <Tag>{p.org}</Tag> : null}
                          </div>
                        }
                        footer={
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              className={btnSecondary}
                              aria-expanded={open}
                              onClick={() => toggleDetail(p.id)}
                            >
                              {open ? t(STR.hideTimeline) : t(STR.showTimeline)}
                            </button>
                            {p.url ? (
                              <a
                                href={p.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                              >
                                {t({ el: "Πηγή ↗", en: "Source ↗" })}
                              </a>
                            ) : null}
                          </div>
                        }
                      />
                      {open ? (
                        <div className="mt-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-4">
                          {detail.loading ? (
                            <p className={mutedText}>{t({ el: "Φόρτωση…", en: "Loading…" })}</p>
                          ) : detail.error ? (
                            <ErrorPanel message={detail.error} onRetry={() => toggleDetail(p.id)} />
                          ) : detail.data ? (
                            <div className="space-y-3">
                              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                {t(STR.timeline)}
                              </h3>
                              {(() => {
                                const list = [...(detail.data.decisions ?? [])].sort((a, b) =>
                                  String(a.date ?? "9999").localeCompare(String(b.date ?? "9999"))
                                );
                                if (list.length === 0) {
                                  return (
                                    <p className={mutedText}>{t(STR.none)}</p>
                                  );
                                }
                                return (
                                  <ol className="space-y-3 border-l-2 border-blue-200 dark:border-blue-900 pl-4">
                                    {list.map((dec) => (
                                      <li key={dec.id} className="relative">
                                        <span
                                          aria-hidden="true"
                                          className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full bg-blue-600"
                                        />
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                          {dec.date ? fmtDate(dec.date, lang) : t(STR.noDate)}
                                        </p>
                                        <a
                                          href={dec.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-sm font-medium text-zinc-900 hover:text-blue-600 dark:text-zinc-100 dark:hover:text-blue-400 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                        >
                                          {dec.title}
                                        </a>
                                        {dec.org ? (
                                          <p className={`text-xs ${mutedText}`}>{dec.org}</p>
                                        ) : null}
                                      </li>
                                    ))}
                                  </ol>
                                );
                              })()}
                              <NoticeDisclaimer text={t(STR.disclaimer)} />
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}

        {tab === "map" ? (
          <div className="space-y-4">
            {projects.error ? (
              <ErrorPanel message={projects.error} onRetry={projects.reload} />
            ) : null}
            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <MapPanel
                features={mapFeatures.length > 0 ? (mapFeatures as never) : null}
                center={[23.7275, 37.9838]}
                zoom={12}
                height="440px"
              />
            </div>
            {projects.loading ? (
              <p className={mutedText}>{t({ el: "Φόρτωση έργων…", en: "Loading projects…" })}</p>
            ) : mapFeatures.length === 0 ? (
              <EmptyState title={t(STR.mapEmpty)} />
            ) : (
              <p className={mutedText}>
                {t({ el: "Σύνολο παρεμβάσεων:", en: "Total interventions:" })}{" "}
                {mapFeatures.length}
              </p>
            )}
          </div>
        ) : null}
      </div>

      <div className="mt-8">
        <SectionCard>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={mutedText}>{t(STR.disclaimer)}</p>
            <Link href="/ask" className={btnPrimary}>
              {t({ el: "Ρωτήστε για τις αποφάσεις →", en: "Ask about decisions →" })}
            </Link>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function NoticeDisclaimer({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-100">
      {text}
    </p>
  );
}
