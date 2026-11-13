"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  ChevronDown,
  Database,
  FlaskConical,
  Landmark,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Terminal,
  Users,
} from "lucide-react";
import type { Lang } from "@policylab/types";
import { request } from "@policylab/api-client";
import {
  Badge,
  CountUp,
  ExampleChips,
  SearchBar,
  StatCard,
  useI18n,
} from "@policylab/ui";
import { TiltCard } from "@/_shared/tilt-card";

const HeroScene = dynamic(
  () => import("@/_shared/hero-scene").then((module) => module.HeroScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <div className="pl-float flex h-44 w-44 items-center justify-center rounded-full border border-white/20 bg-white/90 shadow-[0_30px_80px_-20px_rgba(0,82,255,0.7)]">
          <Image
            src="/brand/athenax-mark.png"
            alt=""
            width={640}
            height={640}
            className="h-28 w-28"
          />
        </div>
      </div>
    ),
  },
);

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

const HERO = {
  lead: {
    el: "Συνδέεις δημόσια δεδομένα. Κατανοείς την πόλη.",
    en: "Connect public data. Understand the city.",
  },
  accent: {
    el: "Δοκιμάζεις καλύτερες πολιτικές.",
    en: "Test better policies.",
  },
};

const WHO = {
  eyebrow: { el: "Ποιοι είμαστε", en: "Who we are" },
  title: {
    el: "Μια ανοιχτή υποδομή για αποφάσεις με στοιχεία.",
    en: "An open infrastructure for evidence-based decisions.",
  },
  body: {
    el: "Το ATHENAX ενώνει δημόσια δεδομένα, μοντέλα προσομοίωσης και τη φωνή των πολιτών σε ένα ενιαίο περιβάλλον. Σχεδιάζουμε για δήμους που θέλουν να δοκιμάζουν ιδέες πριν δεσμεύσουν πόρους — με διαφάνεια, προέλευση και μετρήσιμο αντίκτυπο.",
    en: "ATHENAX brings public data, simulation models and citizen voices into one environment. We build for cities that want to test ideas before committing resources — with transparency, provenance and measurable impact.",
  },
  pillars: [
    {
      icon: Database,
      title: { el: "Ανοιχτά δεδομένα", en: "Open data" },
      body: {
        el: "Πηγές με προέλευση, ποιότητα και ιστορικό.",
        en: "Sources with provenance, quality and history.",
      },
    },
    {
      icon: ShieldCheck,
      title: { el: "Αποδείξεις πρώτα", en: "Evidence first" },
      body: {
        el: "Κάθε απάντηση συνοδεύεται από πηγές.",
        en: "Every answer comes with citations.",
      },
    },
    {
      icon: Building2,
      title: { el: "Για τις πόλεις", en: "Built for cities" },
      body: {
        el: "Από το ερώτημα στην απόφαση, χωρίς τριβές.",
        en: "From question to decision, without friction.",
      },
    },
  ],
};

const STEPS = [
  {
    number: "01",
    title: { el: "Συνδέουμε", en: "Connect" },
    body: {
      el: "Δημόσια δεδομένα και αστικά σήματα σε έναν κατάλογο.",
      en: "Public data and city signals in one catalogue.",
    },
  },
  {
    number: "02",
    title: { el: "Κατανοούμε", en: "Understand" },
    body: {
      el: "Ερωτήσεις σε φυσική γλώσσα με τεκμηριωμένες απαντήσεις.",
      en: "Natural-language questions with grounded answers.",
    },
  },
  {
    number: "03",
    title: { el: "Προσομοιώνουμε", en: "Simulate" },
    body: {
      el: "Σενάρια πολιτικής με παραμέτρους και αβεβαιότητα.",
      en: "Policy scenarios with parameters and uncertainty.",
    },
  },
  {
    number: "04",
    title: { el: "Αποφασίζουμε", en: "Decide" },
    body: {
      el: "Συγκρίνετε αντίκτυπο, κόστος και ρίσκο πριν την απόφαση.",
      en: "Compare impact, cost and risk before deciding.",
    },
  },
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

  return (
    <>
      <section className="relative overflow-hidden border-b border-border bg-background">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="pl-grid-bg absolute inset-0 opacity-70" />
          <div className="pl-aurora left-[-10%] top-[-38%] h-[480px] w-[480px] bg-[#0066ff]/30 dark:bg-[#0066ff]/25" />
          <div className="pl-aurora right-[-6%] top-[2%] h-[420px] w-[420px] bg-[#22d3ee]/25 [animation-delay:-7s]" />
          <div className="pl-aurora bottom-[-46%] left-[30%] h-[460px] w-[460px] bg-[#7c3aed]/15 [animation-delay:-12s]" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
        </div>

        <div className="relative mx-auto grid w-full max-w-[96rem] gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(380px,520px)] lg:items-center">
          <div className="min-w-0">
            <div className="pl-enter">
              <Badge tone="info">Open GovTech · Policy Experimentation</Badge>
            </div>
            <h1
              className="pl-enter mt-5 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-5xl xl:text-6xl"
              style={{ animationDelay: "90ms" }}
            >
              {t(HERO.lead)}{" "}
              <span className="pl-gradient-text">{t(HERO.accent)}</span>
            </h1>
            <p
              className="pl-enter mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
              style={{ animationDelay: "180ms" }}
            >
              {t({
                el: "Μία πλατφόρμα ανοιχτών δεδομένων, GovTech πληροφοριών και πειραματισμού πολιτικών — με προέλευση, ποιότητα και αποδείξεις σε κάθε απάντηση.",
                en: "One platform for open data, GovTech intelligence and policy experimentation — with provenance, quality and evidence in every answer.",
              })}
            </p>

            <div
              className="pl-enter mt-8 max-w-xl"
              style={{ animationDelay: "260ms" }}
            >
              <SearchBar onSearch={goSearch} />
            </div>

            <div
              className="pl-enter mt-4"
              style={{ animationDelay: "340ms" }}
            >
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {t({ el: "Δοκίμασε μια ερώτηση", en: "Try a question" })}
              </p>
              <ExampleChips items={EXAMPLE_QUESTIONS} onPick={goSearch} />
            </div>

            <div
              className="pl-enter mt-8 flex flex-wrap items-center gap-3"
              style={{ animationDelay: "420ms" }}
            >
              <Link
                href="/policies/new"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_12px_30px_-10px_rgba(0,82,255,0.7)] transition-all duration-200 hover:-translate-y-px hover:bg-primary/90 hover:shadow-[0_18px_40px_-12px_rgba(0,82,255,0.8)]"
              >
                {t({ el: "Δημιούργησε πολιτική", en: "Create a policy" })}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
              <Link
                href="/data"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-primary/40 hover:shadow-md"
              >
                {t({ el: "Εξερεύνησε δεδομένα", en: "Explore data" })}
              </Link>
            </div>

            <div
              className="pl-enter mt-10 hidden items-center gap-2 text-xs text-muted-foreground lg:flex"
              style={{ animationDelay: "500ms" }}
            >
              <span className="inline-flex h-7 w-4 items-start justify-center rounded-full border border-border p-1">
                <span className="pl-float h-1.5 w-1 rounded-full bg-primary" />
              </span>
              {t({ el: "Κύλισε για να δεις πώς δουλεύει", en: "Scroll to see how it works" })}
              <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 animate-bounce" />
            </div>
          </div>

          <div
            className="pl-enter-scale relative"
            style={{ animationDelay: "220ms" }}
          >
            <div className="relative h-[340px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#050a1e] shadow-[0_50px_140px_-40px_rgba(0,82,255,0.65)] sm:h-[440px] lg:h-[500px]">
              <HeroScene />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,82,255,0.28),transparent_62%)]" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#050a1e] via-[#050a1e]/70 to-transparent" />
              <div className="pointer-events-none absolute inset-0 flex items-start justify-between p-4">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium text-white/80 backdrop-blur">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  Digital twin · Αθήνα
                </span>
                <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 font-mono text-[10px] text-white/60">
                  3D
                </span>
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                    Live model
                  </p>
                  <p className="text-sm font-medium text-white/85">
                    City signals → policy impact
                  </p>
                </div>
                <span className="hidden rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-mono text-white/60 sm:inline">
                  60 fps
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="who-heading"
        className="relative mx-auto w-full max-w-[96rem] px-4 py-16 sm:px-6 sm:py-20"
      >
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
          <div data-reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {t(WHO.eyebrow)}
            </p>
            <h2
              id="who-heading"
              className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
            >
              {t(WHO.title)}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
              {t(WHO.body)}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3" data-reveal-group>
            {WHO.pillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.title.en}
                  className="pl-lift group rounded-3xl border border-border bg-card p-5 shadow-sm hover:border-primary/40 hover:shadow-[0_22px_50px_-24px_rgba(0,82,255,0.4)]"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-all duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <p className="mt-4 text-sm font-semibold text-foreground">
                    {t(pillar.title)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t(pillar.body)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="modules-heading"
        className="relative border-y border-border bg-muted/30"
      >
        <div className="mx-auto w-full max-w-[96rem] px-4 py-16 sm:px-6 sm:py-20">
          <div
            className="mb-8 flex flex-wrap items-end justify-between gap-4"
            data-reveal
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                {t({ el: "Τι κάνουμε", en: "What we do" })}
              </p>
              <h2
                id="modules-heading"
                className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
              >
                {t({
                  el: "Από τα δεδομένα στην απόφαση.",
                  en: "From data to decision.",
                })}
              </h2>
            </div>
            <p className="max-w-md text-sm text-muted-foreground">
              {t({
                el: "Δέκα συνδεδεμένες ενότητες που καλύπτουν όλο τον κύκλο: εύρεση, κατανόηση, σχεδιασμός, προσομοίωση και αξιολόγηση.",
                en: "Ten connected modules covering the full loop: discovery, understanding, design, simulation and evaluation.",
              })}
            </p>
          </div>

          <div
            className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
            data-reveal-group
          >
            {MODULES.map((module) => {
              const Icon = module.icon;
              return (
                <TiltCard key={module.href} className="h-full">
                  <Link
                    href={module.href}
                    className="pl-card-sheen group flex h-full flex-col gap-4 rounded-3xl border border-border bg-card p-5 shadow-sm transition-colors duration-300 hover:border-primary/50"
                  >
                    <div className="pl-depth-1 flex items-start justify-between gap-2">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-all duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-[0_10px_24px_-8px_rgba(0,82,255,0.65)]">
                        <Icon aria-hidden="true" className="h-5 w-5" />
                      </span>
                      <ArrowUpRight
                        aria-hidden="true"
                        className="h-4 w-4 text-muted-foreground transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
                      />
                    </div>
                    <div className="pl-depth-1">
                      <p className="text-sm font-semibold text-foreground">
                        {t(module.title)}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {t(module.description)}
                      </p>
                      {module.badge ? (
                        <span className="mt-3 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                          {module.badge}
                        </span>
                      ) : null}
                    </div>
                    <span className="pl-depth-1 mt-auto inline-flex items-center gap-1 text-xs font-semibold text-primary">
                      {t({ el: "Άνοιγμα", en: "Open" })}
                      <ArrowRight
                        aria-hidden="true"
                        className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1"
                      />
                    </span>
                  </Link>
                </TiltCard>
              );
            })}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="how-heading"
        className="mx-auto w-full max-w-[96rem] px-4 py-16 sm:px-6 sm:py-20"
      >
        <div className="mb-10 max-w-2xl" data-reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            {t({ el: "Πώς δουλεύει", en: "How it works" })}
          </p>
          <h2
            id="how-heading"
            className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            {t({
              el: "Τέσσερα βήματα, μία καθαρή διαδρομή.",
              en: "Four steps, one clear path.",
            })}
          </h2>
        </div>

        <ol className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-reveal-group>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent lg:block"
          />
          {STEPS.map((step) => (
            <li
              key={step.number}
              className="relative rounded-3xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-primary/10 font-mono text-xs font-semibold text-primary">
                  {step.number}
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="h-4 w-4 text-muted-foreground/50"
                />
              </div>
              <p className="mt-4 text-base font-semibold text-foreground">
                {t(step.title)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{t(step.body)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="metrics-heading"
        className="mx-auto w-full max-w-[96rem] px-4 pb-16 sm:px-6"
      >
        <div
          className="mb-4 flex items-center justify-between gap-3"
          data-reveal
        >
          <h2
            id="metrics-heading"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
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

        <div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          data-reveal-group
        >
          <StatCard
            label={t({ el: "Πηγές δεδομένων", en: "Data sources" })}
            value={loading ? "…" : <CountUp value={metrics?.sources ?? null} />}
            hint={t({
              el: "Ενεργοί συνδέτες & κατάλογοι",
              en: "Active connectors and catalogues",
            })}
          />
          <StatCard
            label={t({ el: "Σύνολα δεδομένων", en: "Datasets" })}
            value={loading ? "…" : <CountUp value={metrics?.datasets ?? null} />}
            hint={t({
              el: "Καταχωρημένα στο αποθετήριο",
              en: "Registered in the catalogue",
            })}
          />
          <StatCard
            label={t({ el: "Συνδέτες", en: "Connectors" })}
            value={loading ? "…" : <CountUp value={metrics?.connectors ?? null} />}
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

      <section className="mx-auto w-full max-w-[96rem] px-4 pb-20 sm:px-6">
        <div
          className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#050a1e] px-6 py-12 text-white shadow-[0_40px_120px_-40px_rgba(0,82,255,0.6)] sm:px-10"
          data-reveal="scale"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
          >
            <div className="pl-aurora left-[-10%] top-[-40%] h-[360px] w-[360px] bg-[#0052ff]/40" />
            <div className="pl-aurora bottom-[-60%] right-[-5%] h-[360px] w-[360px] bg-[#22d3ee]/30 [animation-delay:-8s]" />
          </div>
          <div className="relative flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
                {t({ el: "Ξεκινήστε τώρα", en: "Start now" })}
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                {t({
                  el: "Ρωτήστε την πόλη. Δοκιμάστε μια πολιτική.",
                  en: "Ask the city. Test a policy.",
                })}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-white/70">
                {t({
                  el: "Ένα ερώτημα αρκεί για να δείτε πώς τα δεδομένα γίνονται απόφαση — με πηγές, σενάρια και μετρήσιμο αντίκτυπο.",
                  en: "One question is enough to see how data becomes a decision — with sources, scenarios and measurable impact.",
                })}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/ask"
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#06164f] transition-all duration-200 hover:-translate-y-px hover:bg-white/90"
              >
                {t({ el: "Ρώτα την πόλη", en: "Ask the city" })}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
              <Link
                href="/simulations"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition-all duration-200 hover:-translate-y-px hover:bg-white/15"
              >
                {t({ el: "Δες προσομοιώσεις", en: "View simulations" })}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="flex items-center gap-2 font-semibold tracking-[0.16em] text-foreground">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-full bg-gradient-to-br from-[#0052ff] to-[#22d3ee]"
            />
            ATHENAX
          </p>
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
