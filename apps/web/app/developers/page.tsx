"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Badge, EmptyState, Skeleton, StatCard, useI18n } from "@policylab/ui";
import { API_BASE, get } from "@policylab/api-client";
import type { Lang } from "@policylab/types";

const GENERIC_ERROR =
  "Δεν ήταν δυνατή η ανάκτηση των δεδομένων από τον διακομιστή. Δοκιμάστε ξανά.";

const STR = {
  title: { el: "Developers", en: "Developers" },
  desc: {
    el: "Ανοιχτό API χωρίς κλειδιά, κατάλογος endpoint, παραδείγματα κώδικα και σημειώσεις χρήσης.",
    en: "Keyless open API, endpoint catalogue, code examples and usage notes.",
  },
  info: { el: "Σχετικά με το API", en: "About the API" },
  infoDesc: {
    el: "Βασικά στοιχεία του API της πλατφόρμας.",
    en: "Core facts about the platform API.",
  },
  version: { el: "Έκδοση", en: "Version" },
  endpoints: { el: "Endpoint", en: "Endpoints" },
  license: { el: "Άδεια", en: "Licence" },
  rateLimit: { el: "Όριο ρυθμού", en: "Rate limit" },
  catalogue: { el: "Κατάλογος endpoint", en: "Endpoint catalogue" },
  catalogueDesc: {
    el: "Όλα τα διαθέσιμα routes του API, ομαδοποιημένα ανά λειτουργία.",
    en: "All available API routes, grouped by area.",
  },
  openDocs: { el: "Άνοιγμα /docs", en: "Open /docs" },
  openSpec: { el: "Άνοιγμα /openapi.json", en: "Open /openapi.json" },
  reload: { el: "Ανανέωση", en: "Refresh" },
  catalogueError: {
    el: "Δεν ήταν δυνατή η ανάκτηση του OpenAPI. Μπορείτε να ανοίξετε την τεκμηρίωση απευθείας.",
    en: "Could not fetch the OpenAPI spec. You can open the documentation directly.",
  },
  emptyCatalogue: {
    el: "Δεν βρέθηκαν endpoint στη προδιαγραφή",
    en: "No endpoints found in the specification",
  },
  emptyCatalogueDesc: {
    el: "Η προδιαγραφή OpenAPI είναι άδεια ή άγνωστης μορφής.",
    en: "The OpenAPI specification is empty or in an unknown shape.",
  },
  examples: { el: "Παραδείγματα κώδικα", en: "Code examples" },
  examplesDesc: {
    el: "Έτοιμα παραδείγματα από την υπηρεσία για συνηθισμένες ερωτήσεις.",
    en: "Service-provided samples for common requests.",
  },
  quickstart: { el: "Γρήγορη εκκίνηση", en: "Quickstart" },
  quickstartDesc: {
    el: "Τρία βασικά παραδείγματα για να ξεκινήσετε αμέσως.",
    en: "Three basic snippets to get started right away.",
  },
  copy: { el: "Αντιγραφή", en: "Copy" },
  copied: { el: "Αντιγράφηκε", en: "Copied" },
  notes: { el: "Σημειώσεις χρήσης", en: "Usage notes" },
  notesDesc: {
    el: "Όρια, άδειες και κανόνες χρήσης του API.",
    en: "Limits, licences and rules for using the API.",
  },
  noteRate: {
    el: "Όριο ρυθμού: 120 αιτήματα/λεπτό ανά IP. Πέρα από το όριο επιστρέφεται 429.",
    en: "Rate limit: 120 requests/minute per IP. Beyond the limit a 429 is returned.",
  },
  noteOpen: {
    el: "Ανοιχτό API χωρίς κλειδιά ή λογαριασμούς — αρκεί το Accept: application/json.",
    en: "Open API without keys or accounts — Accept: application/json is enough.",
  },
  noteEvidence: {
    el: "Κανόνας αποδείξεων: κάθε απάντηση του AI παραθέτει πηγές ή ρητός περιορισμός.",
    en: "Evidence-first rule: every AI answer cites sources or states an explicit limitation.",
  },
  noteLicense: {
    el: "Προσοχή στις άδειες δεδομένων: το γεγονός ότι μια πηγή είναι δημόσια δεν σημαίνει ελεύθερη επανάχρηση.",
    en: "Data licensing caution: public does not mean free to reuse.",
  },
  noteDocs: {
    el: "Δεδομένα υπό την άδεια του κάθε προμηθευτή· το λογισμικό κυκλοφορεί υπό Apache-2.0.",
    en: "Data stays under each provider licence; the software ships under Apache-2.0.",
  },
  errorTitle: { el: "Κάτι πήγε στραβά", en: "Something went wrong" },
  retry: { el: "Επανάληψη", en: "Retry" },
  defaultsUsed: {
    el: "Προεπιλεγμένες τιμές (η υπηρεσία δεν απάντησε).",
    en: "Default values (the service did not respond).",
  },
  quickCurl: {
    el: "Γρήγορη εκκίνηση με curl",
    en: "Quickstart with curl",
  },
  quickJs: {
    el: "Γρήγορη εκκίνηση με JavaScript",
    en: "Quickstart with JavaScript",
  },
  quickPy: {
    el: "Γρήγορη εκκίνηση με Python (httpx)",
    en: "Quickstart with Python (httpx)",
  },
};

const cardCls =
  "rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-sm sm:p-5";
const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-button)] border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function errText(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
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
  children,
}: {
  message: string;
  onRetry?: () => void;
  children?: React.ReactNode;
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
      {children ? <div className="mt-3">{children}</div> : null}
      {onRetry ? (
        <button type="button" onClick={onRetry} className={`${btnSecondary} mt-3`}>
          {t(STR.retry)}
        </button>
      ) : null}
    </div>
  );
}

function CopyButton({ code }: { code: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const copy = () => {
    const done = () => {
      setCopied(true);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), 2000);
    };
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code).then(done).catch(() => undefined);
    }
  };

  return (
    <button type="button" onClick={copy} className={btnSecondary}>
      {copied ? t(STR.copied) : t(STR.copy)}
    </button>
  );
}

function CodeBlock({
  language,
  title,
  code,
}: {
  language: string;
  title: string;
  code: string;
}) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Badge tone="info">{language}</Badge>
          <span className="truncate text-sm font-medium text-foreground">
            {title}
          </span>
        </div>
        <CopyButton code={code} />
      </div>
      <pre className="overflow-x-auto px-3 py-3 text-xs leading-relaxed text-foreground">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}

interface DevInfo {
  version: string;
  rate_limit: string;
  license: string;
  openapi_url: string;
  endpoints_count: number | null;
  contact: string | null;
}

const DEFAULT_INFO: DevInfo = {
  version: "1.0.0",
  rate_limit: "120 αιτήματα/λεπτό ανά IP",
  license: "Apache-2.0",
  openapi_url: `${API_BASE}/openapi.json`,
  endpoints_count: null,
  contact: null,
};

function selectInfo(raw: unknown): DevInfo {
  const record = asRecord(raw);
  const count =
    typeof record.endpoints_count === "number" &&
    Number.isFinite(record.endpoints_count)
      ? record.endpoints_count
      : null;
  return {
    version: str(record, "version") || DEFAULT_INFO.version,
    rate_limit: str(record, "rate_limit") || DEFAULT_INFO.rate_limit,
    license: str(record, "license") || DEFAULT_INFO.license,
    openapi_url: str(record, "openapi_url") || DEFAULT_INFO.openapi_url,
    endpoints_count: count,
    contact:
      typeof record.contact === "string" && record.contact
        ? record.contact
        : null,
  };
}

interface EndpointItem {
  method: string;
  path: string;
  summary: string;
}

interface EndpointGroup {
  key: string;
  items: EndpointItem[];
}

interface OpenApiOperation {
  summary?: string;
  description?: string;
}

interface OpenApiDoc {
  paths?: Record<string, Record<string, OpenApiOperation>>;
}

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;

const GROUP_ORDER = [
  "datasets",
  "sources",
  "decisions",
  "projects",
  "city",
  "ai",
  "models",
  "policies",
  "simulations",
  "impact",
  "consultations",
  "proposals",
  "research",
  "developers",
  "admin",
];

function buildGroups(paths: Record<string, Record<string, OpenApiOperation>>): EndpointGroup[] {
  const buckets = new Map<string, EndpointItem[]>();
  for (const [path, operations] of Object.entries(paths)) {
    const segments = path.split("/").filter(Boolean);
    const group = segments[0] ?? "root";
    if (!operations || typeof operations !== "object") continue;
    for (const method of HTTP_METHODS) {
      const operation = operations[method];
      if (!operation || typeof operation !== "object") continue;
      const summary =
        (typeof operation.summary === "string" && operation.summary) ||
        (typeof operation.description === "string" && operation.description) ||
        "";
      const list = buckets.get(group) ?? [];
      list.push({ method: method.toUpperCase(), path, summary });
      buckets.set(group, list);
    }
  }
  const groups: EndpointGroup[] = Array.from(buckets, ([key, items]) => ({
    key,
    items,
  }));
  groups.sort((a, b) => {
    const indexA = GROUP_ORDER.indexOf(a.key);
    const indexB = GROUP_ORDER.indexOf(b.key);
    if (indexA !== -1 || indexB !== -1) {
      return (
        (indexA === -1 ? GROUP_ORDER.length : indexA) -
        (indexB === -1 ? GROUP_ORDER.length : indexB)
      );
    }
    return a.key.localeCompare(b.key);
  });
  return groups;
}

function methodTone(method: string): "success" | "info" | "neutral" {
  if (method === "GET") return "success";
  if (method === "POST") return "info";
  return "neutral";
}

interface DevExample {
  language: string;
  title: string;
  code: string;
  endpoint: string | null;
}

function selectExamples(raw: unknown): DevExample[] {
  return toList(raw, ["examples", "items", "results"]).map((item) => {
    const record = asRecord(item);
    const code = str(record, "code");
    return {
      language: str(record, "language") || "text",
      title: str(record, "title") || str(record, "endpoint") || "example",
      code,
      endpoint: str(record, "endpoint") || null,
    };
  });
}

interface Quickstart {
  id: string;
  language: string;
  title: Record<Lang, string>;
  code: string;
}

function buildQuickstarts(): Quickstart[] {
  return [
    {
      id: "curl",
      language: "curl",
      title: STR.quickCurl,
      code: `curl -s "${API_BASE}/v1/datasets?page=1&page_size=5" \\\n  -H "Accept: application/json"`,
    },
    {
      id: "js",
      language: "javascript",
      title: STR.quickJs,
      code: `const res = await fetch("${API_BASE}/v1/sources");\nconst { data, meta } = await res.json();\nconsole.log(data, meta);`,
    },
    {
      id: "py",
      language: "python",
      title: STR.quickPy,
      code: `import httpx\n\nr = httpx.get("${API_BASE}/v1/datasets", params={"page": 1, "page_size": 5})\nprint(r.json()["data"])`,
    },
  ];
}

export default function DevelopersPage() {
  const { t } = useI18n();

  const [info, setInfo] = useState<DevInfo>(DEFAULT_INFO);
  const [infoLoading, setInfoLoading] = useState(true);
  const [infoFallback, setInfoFallback] = useState(false);
  const [infoTick, setInfoTick] = useState(0);

  const [groups, setGroups] = useState<EndpointGroup[] | null>(null);
  const [catLoading, setCatLoading] = useState(true);
  const [catError, setCatError] = useState(false);
  const [catTick, setCatTick] = useState(0);

  const [examples, setExamples] = useState<DevExample[] | null>(null);
  const [exLoading, setExLoading] = useState(true);
  const [exError, setExError] = useState<string | null>(null);
  const [exTick, setExTick] = useState(0);

  useEffect(() => {
    let alive = true;
    get<unknown>("/v1/developers/info")
      .then((res) => {
        if (!alive) return;
        if (res.ok && res.data) {
          setInfo(selectInfo(res.data));
          setInfoFallback(false);
        } else {
          setInfo(DEFAULT_INFO);
          setInfoFallback(true);
        }
        setInfoLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setInfo(DEFAULT_INFO);
        setInfoFallback(true);
        setInfoLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [infoTick]);

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/openapi.json`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<OpenApiDoc>;
      })
      .then((doc) => {
        if (!alive) return;
        const paths = doc && typeof doc === "object" ? doc.paths : undefined;
        if (!paths || typeof paths !== "object") {
          setGroups(null);
          setCatError(true);
          setCatLoading(false);
          return;
        }
        setGroups(buildGroups(paths));
        setCatError(false);
        setCatLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setGroups(null);
        setCatError(true);
        setCatLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [catTick]);

  useEffect(() => {
    let alive = true;
    get<unknown>("/v1/developers/examples")
      .then((res) => {
        if (!alive) return;
        if (res.ok && res.data) {
          setExamples(selectExamples(res.data));
          setExError(null);
        } else {
          setExamples(null);
          setExError(res.error?.message || GENERIC_ERROR);
        }
        setExLoading(false);
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setExamples(null);
        setExError(errText(error));
        setExLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [exTick]);

  const reloadInfo = () => {
    setInfoLoading(true);
    setInfoTick((value) => value + 1);
  };
  const reloadCatalogue = () => {
    setCatLoading(true);
    setCatError(false);
    setCatTick((value) => value + 1);
  };
  const reloadExamples = () => {
    setExLoading(true);
    setExError(null);
    setExTick((value) => value + 1);
  };

  const catalogueCount =
    groups?.reduce((total, group) => total + group.items.length, 0) ?? 0;
  const endpointsShown = info.endpoints_count ?? catalogueCount;
  const quickstarts = buildQuickstarts();
  const serviceExamples = examples ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t(STR.title)}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          {t(STR.desc)}
        </p>
      </div>

      <div className="space-y-6">
        <Section
          id="info"
          title={t(STR.info)}
          description={t(STR.infoDesc)}
          actions={
            <button
              type="button"
              onClick={reloadInfo}
              className={btnSecondary}
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              {t(STR.reload)}
            </button>
          }
        >
          {infoLoading ? (
            <Skeleton rows={4} />
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label={t(STR.version)} value={info.version} />
                <StatCard
                  label={t(STR.endpoints)}
                  value={endpointsShown > 0 ? endpointsShown : "—"}
                />
                <StatCard label={t(STR.license)} value={info.license} />
                <StatCard label={t(STR.rateLimit)} value={info.rate_limit} />
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <a
                  href={info.openapi_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ExternalLink aria-hidden="true" className="h-4 w-4" />
                  {t(STR.openSpec)}
                </a>
                <a
                  href={`${API_BASE}/docs`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ExternalLink aria-hidden="true" className="h-4 w-4" />
                  {t(STR.openDocs)}
                </a>
              </div>
              {infoFallback ? (
                <p className="text-xs text-muted-foreground">
                  {t(STR.defaultsUsed)}
                </p>
              ) : null}
            </div>
          )}
        </Section>

        <Section
          id="catalogue"
          title={t(STR.catalogue)}
          description={t(STR.catalogueDesc)}
          actions={
            <button
              type="button"
              onClick={reloadCatalogue}
              className={btnSecondary}
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              {t(STR.reload)}
            </button>
          }
        >
          {catLoading ? (
            <Skeleton rows={8} />
          ) : catError ? (
            <ErrorCard
              message={t(STR.catalogueError)}
              onRetry={reloadCatalogue}
            >
              <a
                href={`${API_BASE}/docs`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-[var(--radius-button)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ExternalLink aria-hidden="true" className="h-4 w-4" />
                {t(STR.openDocs)}
              </a>
            </ErrorCard>
          ) : !groups || groups.length === 0 ? (
            <EmptyState
              title={t(STR.emptyCatalogue)}
              description={t(STR.emptyCatalogueDesc)}
              action={
                <button
                  type="button"
                  onClick={reloadCatalogue}
                  className={btnSecondary}
                >
                  {t(STR.reload)}
                </button>
              }
            />
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {catalogueCount} {t(STR.endpoints)}
              </p>
              {groups.map((group) => (
                <details
                  key={group.key}
                  open
                  className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-background"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                    <span className="truncate font-mono">{group.key}</span>
                    <Badge tone="neutral">{group.items.length}</Badge>
                  </summary>
                  <ul className="divide-y divide-border border-t border-border">
                    {group.items.map((item) => (
                      <li
                        key={`${item.method} ${item.path}`}
                        className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5"
                      >
                        <Badge tone={methodTone(item.method)}>
                          {item.method}
                        </Badge>
                        <code className="break-all font-mono text-xs text-foreground">
                          {item.path}
                        </code>
                        {item.summary ? (
                          <span className="w-full text-xs text-muted-foreground sm:w-auto sm:flex-1 sm:text-right">
                            {item.summary}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          )}
        </Section>

        <Section
          id="quickstart"
          title={t(STR.quickstart)}
          description={t(STR.quickstartDesc)}
        >
          <div className="space-y-4">
            {quickstarts.map((snippet) => (
              <CodeBlock
                key={snippet.id}
                language={snippet.language}
                title={t(snippet.title)}
                code={snippet.code}
              />
            ))}
          </div>
        </Section>

        <Section
          id="examples"
          title={t(STR.examples)}
          description={t(STR.examplesDesc)}
          actions={
            <button
              type="button"
              onClick={reloadExamples}
              className={btnSecondary}
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              {t(STR.reload)}
            </button>
          }
        >
          {exLoading ? (
            <Skeleton rows={5} />
          ) : exError ? (
            <ErrorCard message={exError} onRetry={reloadExamples} />
          ) : serviceExamples.length === 0 ? (
            <EmptyState
              title={t(STR.emptyCatalogue)}
              description={t(STR.emptyCatalogueDesc)}
            />
          ) : (
            <div className="space-y-4">
              {serviceExamples.map((example, index) => (
                <CodeBlock
                  key={`${example.title}-${index}`}
                  language={example.language}
                  title={example.title}
                  code={example.code}
                />
              ))}
            </div>
          )}
        </Section>

        <Section id="notes" title={t(STR.notes)} description={t(STR.notesDesc)}>
          <ul className="space-y-3 text-sm text-foreground">
            <li className="flex gap-2">
              <Badge tone="warning">120</Badge>
              <span>{t(STR.noteRate)}</span>
            </li>
            <li className="flex gap-2">
              <Badge tone="info">API</Badge>
              <span>{t(STR.noteOpen)}</span>
            </li>
            <li className="flex gap-2">
              <Badge tone="success">AI</Badge>
              <span>{t(STR.noteEvidence)}</span>
            </li>
            <li className="flex gap-2">
              <Badge tone="neutral">©</Badge>
              <span>{t(STR.noteLicense)}</span>
            </li>
            <li className="flex gap-2">
              <Badge tone="info">Apache-2.0</Badge>
              <span>{t(STR.noteDocs)}</span>
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-3 border-t border-border pt-4 text-sm">
            <a
              href={`${API_BASE}/docs`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
              {t(STR.openDocs)}
            </a>
            <a
              href={`${API_BASE}/openapi.json`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
              {t(STR.openSpec)}
            </a>
          </div>
        </Section>
      </div>
    </div>
  );
}
