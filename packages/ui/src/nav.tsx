"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Activity, Menu, Moon, Sun, X } from "lucide-react";
import { request } from "@policylab/api-client";
import type { Lang } from "@policylab/types";
import { useI18n, useTheme } from "./providers";
import { SearchBar } from "./search-bar";
import { cn } from "./cn";

interface NavLink {
  href: string;
  label: Record<Lang, string>;
}

const LINKS: NavLink[] = [
  { href: "/data", label: { el: "Δεδομένα", en: "Data" } },
  { href: "/govtech", label: { el: "GovTech", en: "GovTech" } },
  { href: "/ask", label: { el: "Ρώτα την Πόλη", en: "Ask the City" } },
  { href: "/city", label: { el: "Ψηφιακή Πόλη", en: "Digital City" } },
  { href: "/policies", label: { el: "Πολιτικές", en: "Policies" } },
  { href: "/citizen", label: { el: "Πολίτες", en: "Citizens" } },
  { href: "/research", label: { el: "Έρευνα", en: "Research" } },
  { href: "/developers", label: { el: "Developers", en: "Developers" } },
  { href: "/admin", label: { el: "Διαχείριση", en: "Admin" } },
];

type HealthStatus = "ok" | "degraded" | "down";

function resolveHealth(data: unknown): HealthStatus {
  if (!data || typeof data !== "object") return "down";
  const values = Object.values(data as Record<string, unknown>);
  let result: HealthStatus = "ok";
  for (const value of values) {
    const status =
      typeof value === "string"
        ? value
        : value && typeof value === "object" && "status" in value
          ? String((value as { status: unknown }).status)
          : "ok";
    if (status === "down") result = "down";
    else if (status === "degraded" && result !== "down") result = "degraded";
  }
  return result;
}

function HealthChip({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const [status, setStatus] = useState<HealthStatus | null>(null);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const env = await request<Record<string, unknown>>("/health");
        if (!alive) return;
        if (!env.ok) {
          setStatus("down");
          return;
        }
        setStatus(resolveHealth(env.data));
      } catch {
        if (alive) setStatus("down");
      }
    };
    void check();
    const timer = setInterval(() => void check(), 60000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const label = status
    ? t({
        el:
          status === "ok"
            ? "Εντάξει"
            : status === "degraded"
              ? "Μειωμένο"
              : "Εκτός",
        en:
          status === "ok"
            ? "Operational"
            : status === "degraded"
              ? "Degraded"
              : "Down",
      })
    : "…";

  const dot =
    status === "ok"
      ? "bg-emerald-500"
      : status === "degraded"
        ? "bg-amber-500"
        : status === "down"
          ? "bg-rose-500"
          : "bg-zinc-400 animate-pulse";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground",
        compact && "px-3 py-1.5 text-sm",
      )}
      title={t({ el: "Κατάσταση συστήματος", en: "System health" })}
    >
      <Activity aria-hidden="true" className="h-3 w-3 text-muted-foreground" />
      <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", dot)} />
      <span>{label}</span>
      <span className="sr-only">
        {t({ el: "Κατάσταση συστήματος:", en: "System health:" })} {label}
      </span>
    </span>
  );
}

function LangToggle({ className }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === "el" ? "en" : "el")}
      aria-label={
        lang === "el"
          ? "Switch to English"
          : t({ el: "Μετάβαση στα ελληνικά", en: "Switch to Greek" })
      }
      className={cn(
        "inline-flex items-center gap-1 rounded-[var(--radius-button)] border border-border bg-background px-2 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(lang === "el" ? "text-primary" : "text-muted-foreground")}
      >
        EL
      </span>
      <span aria-hidden="true" className="text-muted-foreground">
        /
      </span>
      <span
        aria-hidden="true"
        className={cn(lang === "en" ? "text-primary" : "text-muted-foreground")}
      >
        EN
      </span>
    </button>
  );
}

function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        theme === "dark"
          ? t({ el: "Ενεργοποίηση φωτεινού θέματος", en: "Switch to light theme" })
          : t({ el: "Ενεργοποίηση σκοτεινού θέματος", en: "Switch to dark theme" })
      }
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-button)] border border-border bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {theme === "dark" ? (
        <Sun aria-hidden="true" className="h-4 w-4" />
      ) : (
        <Moon aria-hidden="true" className="h-4 w-4" />
      )}
    </button>
  );
}

function NavLinks({
  pathname,
  onNavigate,
  className,
}: {
  pathname: string;
  onNavigate?: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <nav aria-label="Κύρια πλοήγηση" className={className}>
      <ul className="flex flex-wrap items-center gap-1">
        {LINKS.map((link) => {
          const active =
            pathname === link.href ||
            (link.href !== "/" && pathname.startsWith(`${link.href}/`));
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex rounded-[var(--radius-button)] px-2.5 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/80 hover:bg-muted hover:text-foreground",
                )}
              >
                {t(link.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && (event.key === "k" || event.key === "K")) {
        event.preventDefault();
        const input = searchWrapRef.current?.querySelector("input");
        input?.focus();
        input?.select();
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, []);

  const goSearch = (q: string) => {
    setOpen(false);
    router.push(`/ask?q=${encodeURIComponent(q)}`);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto w-full max-w-7xl px-4">
        <div className="flex h-14 items-center gap-3">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="POLICYLAB — αρχική σελίδα"
          >
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-extrabold text-primary-foreground"
            >
              P
            </span>
            <span className="text-sm font-extrabold tracking-[0.2em] text-foreground">
              POLICYLAB
            </span>
          </Link>

          <div
            ref={searchWrapRef}
            className="mx-auto hidden w-full max-w-md md:block"
          >
            <SearchBar onSearch={goSearch} />
          </div>
          <div className="flex-1 md:hidden" />

          <div className="hidden items-center gap-2 md:flex">
            <HealthChip />
            <LangToggle />
            <ThemeToggle />
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-button)] border border-border bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
            aria-expanded={open}
            aria-controls="policylab-mobile-menu"
            aria-label={
              open
                ? t({ el: "Κλείσιμο μενού", en: "Close menu" })
                : t({ el: "Άνοιγμα μενού", en: "Open menu" })
            }
            onClick={() => setOpen((value) => !value)}
          >
            {open ? (
              <X aria-hidden="true" className="h-5 w-5" />
            ) : (
              <Menu aria-hidden="true" className="h-5 w-5" />
            )}
          </button>
        </div>

        <NavLinks
          pathname={pathname}
          className="hidden py-2 md:block"
          onNavigate={() => setOpen(false)}
        />
      </div>

      {open ? (
        <div
          id="policylab-mobile-menu"
          className="border-t border-border bg-background md:hidden"
        >
          <div className="mx-auto w-full max-w-7xl px-4 py-4">
            <div className="mb-4 md:hidden">
              <SearchBar onSearch={goSearch} />
            </div>
            <NavLinks
              pathname={pathname}
              className="mb-4"
              onNavigate={() => setOpen(false)}
            />
            <div className="flex items-center gap-2">
              <HealthChip compact />
              <LangToggle />
              <ThemeToggle />
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
