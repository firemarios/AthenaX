"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Database,
  FlaskConical,
  Landmark,
  Map,
  RefreshCw,
  ScrollText,
  Sparkles,
  Terminal,
  Users,
} from "lucide-react";
import type { Lang } from "@policylab/types";
import { request } from "@policylab/api-client";
import {
  Badge,
  ExampleChips,
  SearchBar,
  StatCard,
  useI18n,
} from "@policylab/ui";

interface ModuleCard {
  href: string;
  icon: typeof Database;
  title: Record<Lang, string>;
  description: Record<Lang, string>;
  badge?: string;
}

const MODULES: ModuleCard[] = [
  {
    href: "/data",
    icon: Database,
    title: { el: "Δεδομένα", en: "Data" },
    description: {
      el: "Αναζήτηση συνόλων, ποιότητα και προέλευση",
      en: "Dataset search, quality and provenance",
    },
  },
  {
    href: "/govtech",
    icon: Landmark,
    title: { el: "GovTech", en: "GovTech" },
    description: {
      el: "Αποφάσεις και δημόσια έργα",
      en: "Decisions and public projects",
    },
  },
  {
    href: "/ask",
    icon: Sparkles,
    title: { el: "Ρώτα την Πόλη", en: "Ask the City" },
    description: {
      el: "Ερωτήσεις με πηγές και αποδείξεις",
      en: "Questions backed by cited sources",
    },
  },
  {
    href: "/city",
    icon: Map,
    title: { el: "Ψηφιακή Πόλη", en: "Digital City" },
    description: {
      el: "Διαδραστικός χάρτης και ψηφιακός δίδυμος",
      en: "Interactive map and digital twin",
    },
    badge: "3D Twin · Phase 2",
  },
  {
    href: "/policies",
    icon: ScrollText,
    title: { el: "Πολιτικές", en: "Policies" },
    description: {
      el: "Σχεδιασμός πολιτικών και παραλλαγές",
      en: "Policy design and variants",
    },
  },
  {
    href: "/simulations",
    icon: Activity,
    title: { el: "Προσομοιώσεις", en: "Simulations" },
    description: {
      el: "Μοντέλα με διασφάλιση προέλευσης",
      en: "Models with provenance passports",
    },
  },
  {
    href: "/citizen",
    icon: Users,
    title: { el: "Εργαστήρι Πολιτών", en: "Citizen Lab" },
    description: {
      el: "Διαβούλευση και προτάσεις πολιτών",
      en: "Consultations and citizen proposals",
    },
  },
  {
    href: "/impact",
    icon: BarChart3,
    title: { el: "Αντίκτυπος", en: "Impact" },
    description: {
      el: "Αξιολόγηση σε έξι διαστάσεις",
      en: "Assessment across six dimensions",
    },
  },
  {
    href: "/research",
    icon: FlaskConical,
    title: { el: "Έρευνα", en: "Research" },
    description: {
      el: "Πειράματα και εξαγωγή αναφορών",
      en: "Experiments and report exports",
    },
  },
  {
    href: "/developers",
    icon: Terminal,
    title: { el: "Developers", en: "Developers" },
    description: {
      el: "API, παραδείγματα και τεκμηρίωση",
      en: "API, examples and documentation",
    },
  },
];

const EXAMPLE_QUESTIONS = [
  "Πόσες πράσινες υποδομές υπάρχουν στο κέντρο της Αθήνας;",
  "Ποια έργα υλοποιούνται στη Γλυφάδα;",
  "Πώς επηρεάζει η κίνηση τον αέρα στο κέντρο;",
  "Τι θα συνέβαινε αν αυξηθούν τα πράσινα κατά 20%;",
];

interface Metrics {
  sources: number | null;
  datasets: number | null;
  connectors: number | null;
  health: string | null;
}

function countFrom(data: unknown, total: number | undefined): number | null {
  if (typeof total === "number") return total;
  if (Array.isArray(data)) return data.length;
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const list =
      record.connectors ?? record.items ?? record.entries ?? record.results;
    if (Array.isArray(list)) return list.length;
  }
  return null;
}

function healthLabel(status: string | null, t: (d: Record<Lang, string>) => string): string {
  if (!status) return "—";
  if (status === "ok") return t({ el: "Εντάξει", en: "Operational" });
  if (status === "degraded") return t({ el: "Μειωμένο", en: "Degraded" });
  if (status === "down") return t({ el: "Εκτός", en: "Down" });
  return status;
}

export default function HomePage() {
  const router = useRouter();
  const { t } = useI18n();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [health, sources, datasets, connectors] = await Promise.all([
          request<Record<string, unknown>>("/health"),
          request<unknown>("/v1/sources"),
          request<unknown>("/v1/datasets?page=1&page_size=1"),
          request<unknown>("/v1/admin/connectors"),
        ]);
        if (!alive) return;
        const anyOk = health.ok || sources.ok || datasets.ok || connectors.ok;
        let healthStatus: string | null = null;
        if (health.ok && health.data && typeof health.data === "object") {
          const values = Object.values(health.data).map((value) =>
            typeof value === "string"
              ? value
              : value && typeof value === "object" && "status" in value
                ? String((value as { status: unknown }).status)
                : "ok",
          );
          healthStatus = values.includes("down")
            ? "down"
            : values.includes("degraded")
              ? "degraded"
              : "ok";
        }
        setMetrics({
          sources: sources.ok
            ? countFrom(sources.data, sources.meta?.total)
            : null,
          datasets: datasets.ok
            ? countFrom(datasets.data, datasets.meta?.total)
            : null,
          connectors: connectors.ok
            ? countFrom(connectors.data, connectors.meta?.total)
            : null,
          health: healthStatus,
        });
        setFailed(!anyOk);
      } catch {
        if (!alive) return;
        setMetrics(null);
        setFailed(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tick]);

  const retry = useCallback(() => {
    setLoading(true);
    setFailed(false);
    setTick((value) => value + 1);
  }, []);

  const goSearch = (q: string) => {
    router.push(`/ask?q=${encodeURIComponent(q)}`);
  };

  const metricValue = (value: number | null): string => {
    if (loading) return "…";
    if (value === null) return "—";
    return String(value);
  };

  return (
    <>
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:py-20">
          <Badge tone="info">Open GovTech · Policy Experimentation</Badge>
          <h1 className="mt-5 max-w-4xl text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl">
            {t({
              el: "Συνδέεις δημόσια δεδομένα. Κατανοείς την πόλη. Δοκιμάζεις καλύτερες πολιτικές.",
              en: "Connect public data. Understand the city. Test better policies.",
            })}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t({
              el: "Μία πλατφόρμα ανοιχτών δεδομένων, GovTech πληροφοριών και πειραματισμού πολιτικών — με προέλευση, ποιότητα και αποδείξεις σε κάθε απάντηση.",
              en: "One platform for open data, GovTech intelligence and policy experimentation — with provenance, quality and evidence in every answer.",
            })}
          </p>

          <div className="mt-8 max-w-xl">
            <SearchBar onSearch={goSearch} />
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t({ el: "Δοκίμασε μια ερώτηση", en: "Try a question" })}
            </p>
            <ExampleChips items={EXAMPLE_QUESTIONS} onPick={goSearch} />
          </div>
        </div>
      </section>

      <section aria-labelledby="metrics-heading" className="mx-auto w-full max-w-7xl px-4 py-10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="metrics-heading" className="text-lg font-bold text-foreground">
            {t({ el: "Το σύστημα σε αριθμούς", en: "The system in numbers" })}
          </h2>
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-button)] border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
            {t({ el: "Ανανέωση", en: "Refresh" })}
          </button>
        </div>

        {failed && !loading ? (
          <p
            role="alert"
            className="mb-4 rounded-[var(--radius-card)] border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200"
          >
            {t({
              el: "Δεν ήταν δυνατή η σύνδεση με τον διακομιστή. Δοκιμάστε ξανά.",
              en: "Could not reach the API server. Please retry.",
            })}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={t({ el: "Πηγές δεδομένων", en: "Data sources" })}
            value={metricValue(metrics?.sources ?? null)}
            hint={t({
              el: "Ενεργοί συνδέτες & κατάλογοι",
              en: "Active connectors and catalogues",
            })}
          />
          <StatCard
            label={t({ el: "Σύνολα δεδομένων", en: "Datasets" })}
            value={metricValue(metrics?.datasets ?? null)}
            hint={t({
              el: "Καταχωρημένα στο αποθετήριο",
              en: "Registered in the catalogue",
            })}
          />
          <StatCard
            label={t({ el: "Συνδέτες", en: "Connectors" })}
            value={metricValue(metrics?.connectors ?? null)}
            hint={t({
              el: "Μετρητές σύνδεσης πηγών",
              en: "Source connector registry",
            })}
          />
          <StatCard
            label={t({ el: "Κατάσταση συστήματος", en: "System status" })}
            value={
              loading ? (
                "…"
              ) : (
                <span
                  className={
                    metrics?.health === "ok"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : metrics?.health === "degraded"
                        ? "text-amber-600 dark:text-amber-400"
                        : metrics?.health === "down"
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-muted-foreground"
                  }
                >
                  {healthLabel(metrics?.health ?? null, t)}
                </span>
              )
            }
            hint={t({
              el: "Βάση δεδομένων, LLM, αποθήκευση",
              en: "Database, LLM, storage",
            })}
          />
        </div>
      </section>

      <section aria-labelledby="modules-heading" className="mx-auto w-full max-w-7xl px-4 pb-14">
        <div className="mb-5 flex items-baseline justify-between gap-3">
          <h2 id="modules-heading" className="text-lg font-bold text-foreground">
            {t({ el: "Ξεκίνα από έναν μονάδα", en: "Start from a module" })}
          </h2>
          <span className="text-xs text-muted-foreground">
            {t({ el: "10 μονάδες", en: "10 modules" })}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {MODULES.map((module) => {
            const Icon = module.icon;
            return (
              <Link
                key={module.href}
                href={module.href}
                className="group flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-button)] bg-primary/10 text-primary">
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  {module.badge ? (
                    <Badge tone="warning">{module.badge}</Badge>
                  ) : null}
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {t(module.title)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {module.description.en}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(module.description)}
                  </p>
                </div>
                <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-primary">
                  {t({ el: "Άνοιγμα", en: "Open" })}
                  <ArrowRight
                    aria-hidden="true"
                    className="h-3.5 w-3.5 transition group-hover:translate-x-0.5"
                  />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium text-foreground">POLICYLAB</p>
          <p>
            {t({
              el: "Ανοιχτού κώδικα λογισμικό · Άδεια Apache-2.0",
              en: "Open-source software · Apache-2.0 license",
            })}
          </p>
          <p>
            {t({
              el: "Δεδομένα με προέλευση · Απαντήσεις με αποδείξεις",
              en: "Data with provenance · Answers with evidence",
            })}
          </p>
        </div>
      </footer>
    </>
  );
}
