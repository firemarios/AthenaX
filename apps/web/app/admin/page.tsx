"use client";

import { useEffect, useRef, useState } from "react";
import { Play, RefreshCw } from "lucide-react";
import {
  Badge,
  ConnectorStatusChip,
  EmptyState,
  Skeleton,
  StatCard,
  cn,
  useI18n,
} from "@athenax/ui";
import { get, patch, post } from "@athenax/api-client";
import type { AuditLog, FeatureFlag, Lang, Meta, Source } from "@athenax/types";

const GENERIC_ERROR =
  "Δεν ήταν δυνατή η ανάκτηση των δεδομένων από τον διακομιστή. Δοκιμάστε ξανά.";

const DISCLAIMER_EL =
  "Η διαχείριση είναι ανοιχτή σε αυτή την πιλοτική έκδοση — υπάρχει μόνο περιορισμός συχνότητας αιτημάτων.";
const DISCLAIMER_EN =
  "Administration is open in this pilot version — the only restriction is request rate limiting.";

const STR = {
  title: { el: "Διαχείριση", en: "Administration" },
  desc: {
    el: "Κατάσταση συστήματος, συνδέτες, σημαίες λειτουργίας, αρχείο ελέγχου και εισαγωγή δεδομένων.",
    en: "System health, connectors, feature flags, audit log and data ingestion.",
  },
  disclaimerNote: {
    el: "Σημείωση για την πιλοτική έκδοση",
    en: "Pilot version notice",
  },
  health: {
    el: "Κατάσταση συστήματος",
    en: "System health",
  },
  healthDesc: {
    el: "Αυτόματη ανανέωση κάθε 30 δευτερόλεπτα.",
    en: "Automatic refresh every 30 seconds.",
  },
  refresh: { el: "Ανανέωση", en: "Refresh" },
  lastUpdated: { el: "Τελευταία ενημέρωση", en: "Last updated" },
  connectors: { el: "Συνδέτες (connectors)", en: "Connectors" },
  connectorsDesc: {
    el: "Ενεργοποίηση ή απενεργοποίηση συνδετών και έλεγχος υγείας πηγής.",
    en: "Enable or disable connectors and run a source health check.",
  },
  colName: { el: "Όνομα", en: "Name" },
  colType: { el: "Τύπος", en: "Type" },
  colEndpoint: { el: "Endpoint", en: "Endpoint" },
  colReliability: { el: "Αξιοπιστότητα", en: "Reliability" },
  colEnabled: { el: "Ενεργός", en: "Enabled" },
  colStatus: { el: "Κατάσταση", en: "Status" },
  colActions: { el: "Ενέργειες", en: "Actions" },
  healthCheck: { el: "Έλεγχος υγείας", en: "Health check" },
  checking: { el: "Έλεγχος…", en: "Checking…" },
  toggleOn: { el: "Ενεργοποίηση", en: "Enable" },
  toggleOff: { el: "Απενεργοποίηση", en: "Disable" },
  flags: { el: "Σημαίες λειτουργίας", en: "Feature flags" },
  flagsDesc: {
    el: "Άμεση ενεργοποίηση ή απενεργοποίηση πειραματικών λειτουργιών.",
    en: "Instantly enable or disable experimental features.",
  },
  noFlags: { el: "Δεν υπάρχουν καταχωρημένες σημαίες", en: "No feature flags registered" },
  noFlagsDesc: {
    el: "Ο μητρώο σημαίων είναι άδειο ή η υπηρεσία δεν απάντησε.",
    en: "The flag registry is empty or the service did not respond.",
  },
  audit: { el: "Αρχείο ελέγχου", en: "Audit log" },
  auditDesc: {
    el: "Πρόσφατα αιτήματα προς το API, με κωδικό απάντησης και διεύθυνση IP.",
    en: "Recent API requests with response status and IP address.",
  },
  colMethod: { el: "Μέθοδος", en: "Method" },
  colPath: { el: "Διαδρομή", en: "Path" },
  colStatusShort: { el: "Κωδ.", en: "Code" },
  colIp: { el: "IP", en: "IP" },
  colWhen: { el: "Ώρα", en: "Time" },
  prev: { el: "Προηγούμενη", en: "Previous" },
  next: { el: "Επόμενη", en: "Next" },
  page: { el: "Σελίδα", en: "Page" },
  noAudit: { el: "Δεν υπάρχουν καταγραφές", en: "No audit records" },
  noAuditDesc: {
    el: "Δεν βρέθηκαν αιτήματα σε αυτή τη σελίδα.",
    en: "No requests were found on this page.",
  },
  ingest: { el: "Εισαγωγή δεδομένων", en: "Data ingestion" },
  ingestDesc: {
    el: "Εκτελεί μία φορά τον συνδέτη μιας πηγής και συγχρονίζει τα δεδομένα στη βάση.",
    en: "Runs one connector for a source and syncs data into the database.",
  },
  source: { el: "Πηγή", en: "Source" },
  pickSource: { el: "Επιλέξτε πηγή", en: "Select a source" },
  runIngest: { el: "Εκτέλεση εισαγωγής", en: "Run ingestion" },
  running: { el: "Εκτέλεση…", en: "Running…" },
  result: { el: "Αποτέλεσμα εισαγωγής", en: "Ingestion result" },
  ingested: { el: "Εισήχθησαν", en: "Ingested" },
  skipped: { el: "Παραλείφθησαν", en: "Skipped" },
  errors: { el: "Σφάλματα", en: "Errors" },
  ingestDone: {
    el: "Η εισαγωγή ολοκληρώθηκε.",
    en: "Ingestion completed.",
  },
  ingestWithErrors: {
    el: "Η εισαγωγή ολοκληρώθηκε με σφάλματα. Ελέγξτε την κατάσταση της πηγής και δοκιμάστε ξανά.",
    en: "Ingestion finished with errors. Check the source status and try again.",
  },
  selectFirst: {
    el: "Επιλέξτε μια πηγή πριν από την εκτέλεση.",
    en: "Select a source before running.",
  },
  empty: { el: "Δεν βρέθηκαν στοιχεία", en: "Nothing found" },
  emptyDesc: {
    el: "Η υπηρεσία απάντησε χωρίς δεδομένα για αυτή την ενότητα.",
    en: "The service responded without data for this section.",
  },
  retry: { el: "Επανάληψη", en: "Retry" },
  errorTitle: { el: "Κάτι πήγε στραβά", en: "Something went wrong" },
};

type Tone = "neutral" | "success" | "warning" | "error" | "info";

const cardCls =
  "rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-sm sm:p-5";
const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-button)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-button)] border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
const thCls =
  "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const tdCls = "px-3 py-3 align-top text-sm text-foreground";

function errText(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return GENERIC_ERROR;
}

function envelopeError(message: string | null | undefined): string {
  if (message && message.trim()) return message;
  return GENERIC_ERROR;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function str(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function toList(raw: unknown, keys: string[]): unknown[] {
  if (Array.isArray(raw)) return raw;
  const record = asRecord(raw);
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function fmtDateTime(value: string | null | undefined, lang: Lang): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return new Intl.DateTimeFormat(lang === "el" ? "el-GR" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return value;
  }
}

function fmtClock(value: string | null | undefined, lang: Lang): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return new Intl.DateTimeFormat(lang === "el" ? "el-GR" : "en-GB", {
      timeStyle: "medium",
    }).format(date);
  } catch {
    return value;
  }
}

function fmtReliability(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const pct = value <= 1 ? value * 100 : value;
  return `${Math.round(pct)}%`;
}

interface ResourceState<T> {
  data: T | null;
  meta: Meta | null;
  loading: boolean;
  error: string | null;
}

interface Resource<T> extends ResourceState<T> {
  reload: () => void;
  setData: (updater: (prev: T | null) => T | null) => void;
}

function useResource<T>(path: string, select?: (raw: unknown) => T): Resource<T> {
  const [state, setState] = useState<ResourceState<T>>({
    data: null,
    meta: null,
    loading: true,
    error: null,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const ac = new AbortController();
    get<unknown>(path, { signal: ac.signal })
      .then((res) => {
        if (!alive) return;
        const picked =
          res.data === null || res.data === undefined
            ? null
            : select
              ? select(res.data)
              : (res.data as T);
        if (picked === null) {
          setState({
            data: null,
            meta: res.meta ?? null,
            loading: false,
            error: envelopeError(res.error?.message),
          });
        } else {
          setState({
            data: picked,
            meta: res.meta ?? null,
            loading: false,
            error: null,
          });
        }
      })
      .catch((error: unknown) => {
        if (!alive || ac.signal.aborted) return;
        setState({ data: null, meta: null, loading: false, error: errText(error) });
      });
    return () => {
      alive = false;
      ac.abort();
    };
  }, [path, tick, select]);

  const reload = () => {
    setState({ data: null, meta: null, loading: true, error: null });
    setTick((value) => value + 1);
  };

  const setData = (updater: (prev: T | null) => T | null) => {
    setState((prev) => ({ ...prev, data: updater(prev.data) }));
  };

  return { ...state, reload, setData };
}

function Section({
  id,
  title,
  description,
  actions,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className={cardCls}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id={`${id}-heading`}
            className="text-lg font-semibold text-foreground"
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function ErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      role="alert"
      className="rounded-[var(--radius-card)] border border-rose-300 bg-rose-50 p-4 dark:border-rose-700 dark:bg-rose-950/40"
    >
      <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">
        {t(STR.errorTitle)}
      </p>
      <p className="mt-1 text-sm text-rose-700 dark:text-rose-300">{message}</p>
      <button type="button" onClick={onRetry} className={`${btnPrimary} mt-3`}>
        {t(STR.retry)}
      </button>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-zinc-300 dark:bg-zinc-600"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

const HEALTH_KEYS = ["db", "llm", "storage", "rate_limiter"] as const;
type HealthKey = (typeof HEALTH_KEYS)[number];
type HealthStatus = "ok" | "degraded" | "down" | "disabled" | "unknown";

const HEALTH_LABELS: Record<HealthKey, Record<Lang, string>> = {
  db: { el: "Βάση δεδομένων", en: "Database" },
  llm: { el: "Μοντέλο γλώσσας (LLM)", en: "Language model (LLM)" },
        storage: { el: "Αποθηκευτικός χώρος", en: "Storage" },
  rate_limiter: { el: "Όριο αιτημάτων", en: "Rate limiter" },
};

const HEALTH_STATUS_LABELS: Record<HealthStatus, Record<Lang, string>> = {
  ok: { el: "Εντάξει", en: "OK" },
  degraded: { el: "Μειωμένο", en: "Degraded" },
  down: { el: "Εκτός λειτουργίας", en: "Down" },
  disabled: { el: "Απενεργοποιημένο", en: "Disabled" },
  unknown: { el: "Άγνωστο", en: "Unknown" },
};

function healthTone(status: HealthStatus): Tone {
  if (status === "ok") return "success";
  if (status === "degraded") return "warning";
  if (status === "down" || status === "disabled") return "error";
  return "neutral";
}

function normalizeHealth(value: unknown): HealthStatus {
  if (
    value === "ok" ||
    value === "degraded" ||
    value === "down" ||
    value === "disabled"
  ) {
    return value;
  }
  if (value && typeof value === "object" && "status" in value) {
    return normalizeHealth((value as { status: unknown }).status);
  }
  return "unknown";
}

async function fetchHealth(): Promise<Record<string, HealthStatus> | null> {
  const res = await get<Record<string, unknown>>("/health");
  if (!res.ok || !res.data) return null;
  const next: Record<string, HealthStatus> = {};
  for (const key of HEALTH_KEYS) next[key] = normalizeHealth(res.data[key]);
  return next;
}

function HealthSection() {
  const { t, lang } = useI18n();
  const [values, setValues] = useState<Record<string, HealthStatus> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const valuesRef = useRef<Record<string, HealthStatus> | null>(null);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const next = await fetchHealth();
        if (!alive) return;
        if (next) {
          valuesRef.current = next;
          setValues(next);
          setError(null);
          setLoading(false);
          setUpdated(new Date().toISOString());
        } else if (valuesRef.current === null) {
          setError(GENERIC_ERROR);
          setLoading(false);
        }
      } catch (err) {
        if (!alive) return;
        if (valuesRef.current === null) {
          setError(errText(err));
          setLoading(false);
        }
      }
    };
    void run();
    const id = window.setInterval(() => {
      void run();
    }, 30000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [tick]);

  const manualRefresh = () => {
    setLoading(true);
    setError(null);
    setTick((value) => value + 1);
  };

  return (
    <Section
      id="health"
      title={t(STR.health)}
      description={t(STR.healthDesc)}
      actions={
        <button type="button" onClick={manualRefresh} className={btnSecondary}>
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          {t(STR.refresh)}
        </button>
      }
    >
      {loading && !values ? (
        <Skeleton rows={4} />
      ) : error && !values ? (
        <ErrorCard message={error} onRetry={manualRefresh} />
      ) : (
        <div className="space-y-3">
          {error ? (
            <p
              role="alert"
              className="rounded-[var(--radius-card)] border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
            >
              {error}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {HEALTH_KEYS.map((key) => {
              const status = values?.[key] ?? "unknown";
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-background p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {t(HEALTH_LABELS[key])}
                    </p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {key}
                    </p>
                  </div>
                  <Badge tone={healthTone(status)}>
                    {t(HEALTH_STATUS_LABELS[status])}
                  </Badge>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {t(STR.lastUpdated)}: {fmtClock(updated, lang)}
          </p>
        </div>
      )}
    </Section>
  );
}

interface AdminConnector {
  name: string;
  type: string | null;
  endpoint_url: string | null;
  reliability: number | null;
  enabled: boolean;
  status: Source["status"];
}

function toChipStatus(value: unknown): Source["status"] {
  if (
    value === "healthy" ||
    value === "degraded" ||
    value === "down" ||
    value === "unknown"
  ) {
    return value;
  }
  if (value === "ok") return "healthy";
  if (value === "disabled" || value === "down") return "down";
  return "unknown";
}

function normalizeConnector(raw: unknown): AdminConnector {
  const record = asRecord(raw);
  const type = str(record, "type") || str(record, "kind") || null;
  const endpoint =
    str(record, "endpoint_url") ||
    str(record, "endpoint") ||
    str(record, "source_url") ||
    null;
  const reliability =
    typeof record.reliability === "number" ? record.reliability : null;
  const enabled =
    typeof record.enabled === "boolean" ? record.enabled : true;
  return {
    name: str(record, "name"),
    type,
    endpoint_url: endpoint,
    reliability,
    enabled,
    status: toChipStatus(record.status),
  };
}

const selectConnectors = (raw: unknown): AdminConnector[] =>
  toList(raw, ["connectors", "items", "entries", "results"]).map(
    normalizeConnector
  );

function ConnectorsSection() {
  const { t } = useI18n();
  const resource = useResource<AdminConnector[]>(
    "/v1/admin/connectors",
    selectConnectors
  );
  const [pending, setPending] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const rows = resource.data ?? [];

  const toggleEnabled = (row: AdminConnector) => {
    const next = !row.enabled;
    const before = resource.data ?? [];
    setPending(row.name);
    setActionError(null);
    resource.setData(() =>
      before.map((item) =>
        item.name === row.name ? { ...item, enabled: next } : item
      )
    );
    patch<unknown>(`/v1/admin/connectors/${encodeURIComponent(row.name)}`, {
      enabled: next,
    })
      .then((res) => {
        if (!res.ok) {
          resource.setData(() => before);
          setActionError(envelopeError(res.error?.message));
        }
      })
      .catch((err: unknown) => {
        resource.setData(() => before);
        setActionError(errText(err));
      })
      .finally(() => setPending(null));
  };

  const runHealthCheck = (row: AdminConnector) => {
    if (!row.name) return;
    setChecking(row.name);
    setActionError(null);
    post<Source>(`/v1/sources/${encodeURIComponent(row.name)}/health`)
      .then((res) => {
        if (res.ok && res.data && typeof res.data === "object") {
          const status = toChipStatus(
            (res.data as { status?: unknown }).status
          );
          resource.setData((prev) =>
            (prev ?? []).map((item) =>
              item.name === row.name ? { ...item, status } : item
            )
          );
          setNotes((prev) => ({
            ...prev,
            [row.name]: t({
              el: "Ο έλεγχος ολοκληρώθηκε",
              en: "Health check completed",
            }),
          }));
        } else {
          setNotes((prev) => ({
            ...prev,
            [row.name]: t({
              el: "Ο έλεγχος υγείας δεν είναι διαθέσιμος για αυτή την πηγή",
              en: "Health check is not available for this source",
            }),
          }));
        }
      })
      .catch(() => {
        setNotes((prev) => ({
          ...prev,
          [row.name]: t({
            el: "Ο έλεγχος υγείας δεν είναι διαθέσιμος για αυτή την πηγή",
            en: "Health check is not available for this source",
          }),
        }));
      })
      .finally(() => setChecking(null));
  };

  const toggleLabel = (row: AdminConnector) =>
    row.enabled
      ? `${t(STR.toggleOff)}: ${row.name}`
      : `${t(STR.toggleOn)}: ${row.name}`;

  const body = (() => {
    if (resource.loading) return <Skeleton rows={5} />;
    if (resource.error && rows.length === 0) {
      return <ErrorCard message={resource.error} onRetry={resource.reload} />;
    }
    if (rows.length === 0) {
      return (
        <EmptyState title={t(STR.empty)} description={t(STR.emptyDesc)} />
      );
    }
    return (
      <div className="space-y-3">
        {actionError ? (
          <p
            role="alert"
            className="rounded-[var(--radius-card)] border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
          >
            {actionError}
          </p>
        ) : null}

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className={thCls}>{t(STR.colName)}</th>
                <th className={thCls}>{t(STR.colType)}</th>
                <th className={thCls}>{t(STR.colEndpoint)}</th>
                <th className={thCls}>{t(STR.colReliability)}</th>
                <th className={thCls}>{t(STR.colStatus)}</th>
                <th className={thCls}>{t(STR.colEnabled)}</th>
                <th className={thCls}>{t(STR.colActions)}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.name || row.endpoint_url || `row-${index}`}
                  className="border-b border-border last:border-0"
                >
                  <td className={tdCls}>
                    <span className="font-medium">{row.name || "—"}</span>
                    {notes[row.name] ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {notes[row.name]}
                      </p>
                    ) : null}
                  </td>
                  <td className={tdCls}>
                    {row.type ? (
                      <Badge tone="neutral">{row.type}</Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={`${tdCls} max-w-56 truncate font-mono text-xs`}>
                    {row.endpoint_url || "—"}
                  </td>
                  <td className={`${tdCls} tabular-nums`}>
                    {fmtReliability(row.reliability)}
                  </td>
                  <td className={tdCls}>
                    <ConnectorStatusChip status={row.status} />
                  </td>
                  <td className={tdCls}>
                    <Toggle
                      checked={row.enabled}
                      disabled={pending === row.name}
                      label={toggleLabel(row)}
                      onChange={() => toggleEnabled(row)}
                    />
                  </td>
                  <td className={tdCls}>
                    <button
                      type="button"
                      className={btnSecondary}
                      disabled={checking === row.name || !row.name}
                      onClick={() => runHealthCheck(row)}
                    >
                      {checking === row.name
                        ? t(STR.checking)
                        : t(STR.healthCheck)}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="space-y-3 md:hidden">
          {rows.map((row, index) => (
            <li
              key={row.name || row.endpoint_url || `row-${index}`}
              className="rounded-[var(--radius-card)] border border-border bg-background p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {row.name || "—"}
                  </p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {row.endpoint_url || "—"}
                  </p>
                </div>
                <Toggle
                  checked={row.enabled}
                  disabled={pending === row.name}
                  label={toggleLabel(row)}
                  onChange={() => toggleEnabled(row)}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {row.type ? <Badge tone="neutral">{row.type}</Badge> : null}
                <ConnectorStatusChip status={row.status} />
                <span className="text-xs text-muted-foreground">
                  {t(STR.colReliability)}: {fmtReliability(row.reliability)}
                </span>
              </div>
              {notes[row.name] ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {notes[row.name]}
                </p>
              ) : null}
              <button
                type="button"
                className={`${btnSecondary} mt-3`}
                disabled={checking === row.name || !row.name}
                onClick={() => runHealthCheck(row)}
              >
                {checking === row.name ? t(STR.checking) : t(STR.healthCheck)}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  })();

  return (
    <Section
      id="connectors"
      title={t(STR.connectors)}
      description={t(STR.connectorsDesc)}
      actions={
        <button type="button" onClick={resource.reload} className={btnSecondary}>
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          {t(STR.refresh)}
        </button>
      }
    >
      {body}
    </Section>
  );
}

const selectFlags = (raw: unknown): FeatureFlag[] =>
  toList(raw, ["flags", "items", "results"]).map((item) => {
    const record = asRecord(item);
    return {
      name: str(record, "name"),
      enabled: typeof record.enabled === "boolean" ? record.enabled : false,
      description:
        typeof record.description === "string" ? record.description : null,
    };
  });

function FlagsSection() {
  const { t } = useI18n();
  const resource = useResource<FeatureFlag[]>("/v1/admin/flags", selectFlags);
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const flags = resource.data ?? [];

  const toggleFlag = (flag: FeatureFlag) => {
    const next = !flag.enabled;
    const before = resource.data ?? [];
    setPending(flag.name);
    setActionError(null);
    resource.setData(() =>
      before.map((item) =>
        item.name === flag.name ? { ...item, enabled: next } : item
      )
    );
    patch<unknown>(`/v1/admin/flags/${encodeURIComponent(flag.name)}`, {
      enabled: next,
    })
      .then((res) => {
        if (!res.ok) {
          resource.setData(() => before);
          setActionError(envelopeError(res.error?.message));
        }
      })
      .catch((err: unknown) => {
        resource.setData(() => before);
        setActionError(errText(err));
      })
      .finally(() => setPending(null));
  };

  return (
    <Section
      id="flags"
      title={t(STR.flags)}
      description={t(STR.flagsDesc)}
      actions={
        <button type="button" onClick={resource.reload} className={btnSecondary}>
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          {t(STR.refresh)}
        </button>
      }
    >
      {resource.loading ? (
        <Skeleton rows={4} />
      ) : resource.error && flags.length === 0 ? (
        <ErrorCard message={resource.error} onRetry={resource.reload} />
      ) : flags.length === 0 ? (
        <EmptyState title={t(STR.noFlags)} description={t(STR.noFlagsDesc)} />
      ) : (
        <div className="space-y-3">
          {actionError ? (
            <p
              role="alert"
              className="rounded-[var(--radius-card)] border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
            >
              {actionError}
            </p>
          ) : null}
          <ul className="grid gap-3 sm:grid-cols-2">
            {flags.map((flag) => (
              <li
                key={flag.name}
                className="flex items-start justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-background p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-semibold text-foreground">
                    {flag.name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {flag.description || "—"}
                  </p>
                  <Badge tone={flag.enabled ? "success" : "neutral"}>
                    {flag.enabled ? t(STR.colEnabled) : t(STR.toggleOff)}
                  </Badge>
                </div>
                <Toggle
                  checked={flag.enabled}
                  disabled={pending === flag.name}
                  label={`${flag.name}: ${
                    flag.enabled ? t(STR.toggleOff) : t(STR.toggleOn)
                  }`}
                  onChange={() => toggleFlag(flag)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

const selectAudit = (raw: unknown): AuditLog[] =>
  toList(raw, ["logs", "items", "results", "audit"]).map((item) => {
    const record = asRecord(item);
    return {
      id: str(record, "id"),
      method: str(record, "method"),
      path: str(record, "path"),
      status: typeof record.status === "number" ? record.status : 0,
      ip: typeof record.ip === "string" ? record.ip : null,
      created_at: str(record, "created_at"),
    };
  });

function methodTone(method: string): Tone {
  const value = method.toUpperCase();
  if (value === "GET") return "info";
  if (value === "POST") return "success";
  if (value === "PATCH" || value === "PUT") return "warning";
  if (value === "DELETE") return "error";
  return "neutral";
}

function statusTone(status: number): Tone {
  if (status >= 500) return "error";
  if (status >= 400) return "warning";
  if (status >= 300) return "info";
  return "success";
}

function AuditSection() {
  const { t, lang } = useI18n();
  const [page, setPage] = useState(1);
  const resource = useResource<AuditLog[]>(
    `/v1/admin/audit?page=${page}`,
    selectAudit
  );
  const rows = resource.data ?? [];
  const total = resource.meta?.total;
  const pageSize = resource.meta?.page_size ?? rows.length;
  const hasNext =
    rows.length > 0 &&
    (total === undefined || page * Math.max(1, pageSize) < total);

  const goPage = (next: number) => {
    if (next < 1) return;
    resource.reload();
    setPage(next);
  };

  return (
    <Section
      id="audit"
      title={t(STR.audit)}
      description={t(STR.auditDesc)}
      actions={
        <button type="button" onClick={resource.reload} className={btnSecondary}>
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          {t(STR.refresh)}
        </button>
      }
    >
      {resource.loading ? (
        <Skeleton rows={6} />
      ) : resource.error && rows.length === 0 ? (
        <ErrorCard message={resource.error} onRetry={resource.reload} />
      ) : rows.length === 0 ? (
        <EmptyState title={t(STR.noAudit)} description={t(STR.noAuditDesc)} />
      ) : (
        <div className="space-y-4">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className={thCls}>{t(STR.colMethod)}</th>
                  <th className={thCls}>{t(STR.colPath)}</th>
                  <th className={thCls}>{t(STR.colStatusShort)}</th>
                  <th className={thCls}>{t(STR.colIp)}</th>
                  <th className={thCls}>{t(STR.colWhen)}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id || `${row.method}-${row.path}-${row.created_at}`}
                    className="border-b border-border last:border-0"
                  >
                    <td className={tdCls}>
                      <Badge tone={methodTone(row.method)}>
                        {row.method || "—"}
                      </Badge>
                    </td>
                    <td className={`${tdCls} font-mono text-xs`}>
                      {row.path || "—"}
                    </td>
                    <td className={tdCls}>
                      <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                    </td>
                    <td className={`${tdCls} font-mono text-xs`}>
                      {row.ip || "—"}
                    </td>
                    <td className={`${tdCls} whitespace-nowrap text-xs`}>
                      {fmtDateTime(row.created_at, lang)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 md:hidden">
            {rows.map((row) => (
              <li
                key={row.id || `${row.method}-${row.path}-${row.created_at}`}
                className="rounded-[var(--radius-card)] border border-border bg-background p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={methodTone(row.method)}>
                    {row.method || "—"}
                  </Badge>
                  <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                </div>
                <p className="mt-2 break-all font-mono text-xs text-foreground">
                  {row.path || "—"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.ip || "—"} · {fmtDateTime(row.created_at, lang)}
                </p>
              </li>
            ))}
          </ul>

          <nav
            aria-label="audit pagination"
            className="flex items-center justify-between gap-3"
          >
            <button
              type="button"
              className={btnSecondary}
              disabled={page <= 1}
              onClick={() => goPage(page - 1)}
            >
              ← {t(STR.prev)}
            </button>
            <span className="text-sm tabular-nums text-muted-foreground">
              {t(STR.page)} {page}
            </span>
            <button
              type="button"
              className={btnSecondary}
              disabled={!hasNext}
              onClick={() => goPage(page + 1)}
            >
              {t(STR.next)} →
            </button>
          </nav>
        </div>
      )}
    </Section>
  );
}

interface SourceOption {
  id: string;
  name: string;
}

const selectSources = (raw: unknown): SourceOption[] =>
  toList(raw, ["sources", "items", "results"]).map((item) => {
    const record = asRecord(item);
    const name = str(record, "name");
    const id = str(record, "id");
    return { id: id || name, name: name || id };
  });

interface IngestResult {
  ingested: number;
  skipped: number;
  errors: number;
}

function normalizeIngestResult(raw: unknown): IngestResult {
  const record = asRecord(raw);
  const num = (key: string): number => {
    const value = record[key];
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  };
  return { ingested: num("ingested"), skipped: num("skipped"), errors: num("errors") };
}

function IngestSection() {
  const { t } = useI18n();
  const sources = useResource<SourceOption[]>("/v1/sources", selectSources);
  const [selected, setSelected] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const options = sources.data ?? [];

  const runIngest = () => {
    if (!selected) {
      setError(t(STR.selectFirst));
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    post<unknown>("/v1/admin/ingest", { source: selected })
      .then((res) => {
        if (res.ok && res.data) {
          setResult(normalizeIngestResult(res.data));
        } else {
          setError(envelopeError(res.error?.message));
        }
      })
      .catch((err: unknown) => setError(errText(err)))
      .finally(() => setRunning(false));
  };

  return (
    <Section id="ingest" title={t(STR.ingest)} description={t(STR.ingestDesc)}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <label
              htmlFor="ingest-source"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              {t(STR.source)}
            </label>
            {sources.loading ? (
              <Skeleton rows={1} />
            ) : (
              <select
                id="ingest-source"
                value={selected}
                onChange={(event) => {
                  setSelected(event.target.value);
                  setError(null);
                }}
                className="w-full rounded-[var(--radius-button)] border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">{t(STR.pickSource)}</option>
                {options.map((option) => (
                  <option key={option.id} value={option.name}>
                    {option.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <button
            type="button"
            onClick={runIngest}
            disabled={running || sources.loading}
            className={btnPrimary}
          >
            <Play aria-hidden="true" className="h-4 w-4" />
            {running ? t(STR.running) : t(STR.runIngest)}
          </button>
        </div>

        {sources.error && options.length === 0 ? (
          <ErrorCard message={sources.error} onRetry={sources.reload} />
        ) : null}

        {error ? (
          <p
            role="alert"
            className="rounded-[var(--radius-card)] border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
          >
            {error}
          </p>
        ) : null}

        {result ? (
          <div className="rounded-[var(--radius-card)] border border-border bg-background p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {t(STR.result)}
              </h3>
              <Badge tone={result.errors > 0 ? "warning" : "success"}>
                {result.errors > 0 ? t(STR.ingestWithErrors) : t(STR.ingestDone)}
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                label={t(STR.ingested)}
                value={result.ingested}
                hint={selected}
              />
              <StatCard label={t(STR.skipped)} value={result.skipped} />
              <StatCard label={t(STR.errors)} value={result.errors} />
            </div>
          </div>
        ) : null}
      </div>
    </Section>
  );
}

export default function AdminPage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto w-full max-w-[96rem] px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t(STR.title)}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          {t(STR.desc)}
        </p>
      </div>

      <div
        role="note"
        className="mb-6 rounded-[var(--radius-card)] border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
      >
        <p className="font-semibold">{t(STR.disclaimerNote)}</p>
        <p className="mt-1">{DISCLAIMER_EL}</p>
        <p className="mt-1 text-amber-800 dark:text-amber-200">
          {DISCLAIMER_EN}
        </p>
      </div>

      <div className="space-y-6">
        <HealthSection />
        <ConnectorsSection />
        <FlagsSection />
        <AuditSection />
        <IngestSection />
      </div>
    </div>
  );
}
