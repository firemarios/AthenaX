"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ChevronDown,
  MoreHorizontal,
  Moon,
  Plus,
  Search,
  Sun,
  X,
} from "lucide-react";
import { request } from "@policylab/api-client";
import type { Lang } from "@policylab/types";
import { useI18n, useTheme } from "./providers";
import { CommandPalette } from "./command-palette";
import {
  MORE_LINKS,
  MOBILE_LINKS,
  NAV_GROUPS,
  NEW_POLICY_LINK,
  PRIMARY_LINKS,
  isActive,
  isAnyActive,
  type NavLink,
} from "./nav-config";
import { cn } from "./cn";

const GLASS_PILL =
  "border border-white/60 bg-white/40 shadow-[0_10px_40px_rgba(15,23,42,0.12),inset_0_1px_1px_rgba(255,255,255,0.5)] backdrop-blur-lg dark:border-white/10 dark:bg-black/30 dark:shadow-[0_10px_40px_rgba(0,0,0,0.35),inset_0_1px_1px_rgba(255,255,255,0.1)]";

const GLASS_CONTROL =
  "inline-flex items-center justify-center rounded-full border border-white/60 bg-white/40 backdrop-blur-lg shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)] dark:border-white/10 dark:bg-black/30 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]";

const PILL_IDLE =
  "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white";
const PILL_ACTIVE =
  "bg-white text-zinc-900 shadow-sm dark:bg-white/15 dark:text-white";

type HealthStatus = "ok" | "degraded" | "down";

function resolveHealth(data: unknown): HealthStatus {
  if (!data || typeof data !== "object") return "down";
  const top = (data as { status?: unknown }).status;
  if (top === "ok" || top === "degraded" || top === "down") return top;
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
        GLASS_CONTROL,
        "gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300",
        compact && "px-3 py-2 text-sm",
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
        GLASS_CONTROL,
        "gap-1 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
        GLASS_CONTROL,
        "h-9 w-9 text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-zinc-300",
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

function NavPill({ link, active }: { link: NavLink; active: boolean }) {
  const { t } = useI18n();
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      title={t(link.label)}
      className={cn(
        "flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-all duration-300 hover:-translate-y-px active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? PILL_ACTIVE : PILL_IDLE,
      )}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="sr-only xl:not-sr-only">
        {t(link.shortLabel ?? link.label)}
      </span>
    </Link>
  );
}

function MoreMenu({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const firstLinkRef = useRef<HTMLAnchorElement | null>(null);
  const active = isAnyActive(pathname, MORE_LINKS);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    const timer = window.setTimeout(() => firstLinkRef.current?.focus(), 20);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const close = () => {
    setOpen(false);
    onNavigate?.();
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="policylab-more-menu"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex items-center gap-1 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-all duration-300 hover:-translate-y-px active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active ? PILL_ACTIVE : PILL_IDLE,
        )}
      >
        <span className="sr-only xl:not-sr-only">
          {t({ el: "Περισσότερα", en: "More" })}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div
          id="policylab-more-menu"
          className="pl-pop absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-white/60 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.18),inset_0_1px_1px_rgba(255,255,255,0.6)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900 dark:shadow-[0_18px_60px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.08)]"
        >
          <div className="max-h-[70vh] overflow-y-auto p-1.5">
            {NAV_GROUPS.map((group, groupIndex) => (
              <div key={group.label.en}>
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t(group.label)}
                </p>
                {group.links.map((link, linkIndex) => {
                  const Icon = link.icon;
                  const current = isActive(pathname, link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      ref={
                        groupIndex === 0 && linkIndex === 0 ? firstLinkRef : undefined
                      }
                      aria-current={current ? "page" : undefined}
                      onClick={close}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        current
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
                      )}
                    >
                      <Icon aria-hidden="true" className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{t(link.label)}</span>
                      {current ? (
                        <span
                          aria-hidden="true"
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
                        />
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="border-t border-zinc-200/70 p-1.5 dark:border-zinc-800">
            <Link
              href={NEW_POLICY_LINK.href}
              onClick={close}
              className="flex items-center gap-2.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus aria-hidden="true" className="size-4" />
              {t(NEW_POLICY_LINK.label)}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MobileMoreSheet({
  id,
  open,
  pathname,
  onClose,
  onSearch,
}: {
  id: string;
  open: boolean;
  pathname: string;
  onClose: () => void;
  onSearch: () => void;
}) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      id={id}
      aria-label={t({ el: "Όλες οι ενότητες", en: "All sections" })}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        "fixed inset-x-0 bottom-0 top-auto z-[80] m-0 max-h-[85vh] w-full max-w-none overflow-y-auto rounded-t-3xl border-0 bg-white p-0 text-foreground shadow-[0_-20px_60px_rgba(15,23,42,0.25)] backdrop:bg-black/40 dark:bg-zinc-950",
        open && "pl-sheet-up",
      )}
    >
      <div
        className="px-4 pt-3"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        <div
          aria-hidden="true"
          className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700"
        />
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">
            {t({ el: "Όλες οι ενότητες", en: "All sections" })}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label={t({ el: "Κλείσιμο", en: "Close" })}
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={onSearch}
          className="mb-4 flex w-full items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <Search aria-hidden="true" className="size-4" />
          <span>{t({ el: "Αναζήτηση…", en: "Search…" })}</span>
          <kbd className="ml-auto rounded border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
            Ctrl K
          </kbd>
        </button>

        <nav aria-label={t({ el: "Όλες οι ενότητες", en: "All sections" })}>
          {NAV_GROUPS.map((group) => (
            <div key={group.label.en} className="mb-4">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t(group.label)}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {group.links.map((link) => {
                  const Icon = link.icon;
                  const current = isActive(pathname, link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={onClose}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        current
                          ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300"
                          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
                      )}
                    >
                      <Icon aria-hidden="true" className="size-4 shrink-0" />
                      <span className="truncate">{t(link.label)}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <Link
          href={NEW_POLICY_LINK.href}
          onClick={onClose}
          className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus aria-hidden="true" className="size-4" />
          {t(NEW_POLICY_LINK.label)}
        </Link>

        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <HealthChip compact />
          <LangToggle />
          <ThemeToggle />
        </div>
      </div>
    </dialog>
  );
}

export function Nav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editable =
        !!target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if ((event.metaKey || event.ctrlKey) && (event.key === "k" || event.key === "K")) {
        event.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (
        event.key === "/" &&
        !editable &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setSearchOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  const moreActive = isAnyActive(pathname, MORE_LINKS);

  return (
    <>
      <header className="pl-enter sticky top-0 z-40 border-b border-white/40 bg-white/60 backdrop-blur-xl dark:border-white/10 dark:bg-black/40">
        <div className="mx-auto flex h-16 w-full max-w-[96rem] items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/"
            className="group flex shrink-0 items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t({ el: "ATHENAX — αρχική σελίδα", en: "ATHENAX — home" })}
          >
            <span className="flex h-11 items-center rounded-xl bg-white px-2.5 shadow-[0_2px_12px_rgba(15,23,42,0.14)] ring-1 ring-black/5 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[0_10px_26px_-6px_rgba(0,82,255,0.45)] dark:ring-white/15">
              <Image
                src="/brand/athenax-logo.png"
                alt="ATHENAX"
                width={1000}
                height={312}
                priority
                className="h-8 w-auto"
              />
            </span>
          </Link>

          <nav
            aria-label={t({ el: "Κύρια πλοήγηση", en: "Primary navigation" })}
            className={cn(
              "hidden items-center gap-1 rounded-full p-1 md:flex",
              GLASS_PILL,
            )}
          >
            {PRIMARY_LINKS.map((link) => (
              <NavPill
                key={link.href}
                link={link}
                active={isActive(pathname, link.href)}
              />
            ))}
            <MoreMenu pathname={pathname} />
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label={t({ el: "Αναζήτηση", en: "Search" })}
              aria-keyshortcuts="Control+K"
              className={cn(
                GLASS_CONTROL,
                "h-9 w-9 text-zinc-700 transition-colors hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-zinc-300 dark:hover:text-white",
              )}
            >
              <Search aria-hidden="true" className="h-4 w-4" />
            </button>
            <div className="hidden items-center gap-2 lg:flex">
              <HealthChip />
              <LangToggle />
              <ThemeToggle />
            </div>
            <div className="flex items-center gap-2 lg:hidden">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <nav
        aria-label={t({ el: "Γρήγορη πλοήγηση", en: "Quick navigation" })}
        className="pl-enter fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 md:hidden"
        style={{
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
          animationDelay: "220ms",
        }}
      >
        <div
          className={cn(
            "relative w-full max-w-md overflow-hidden rounded-full border border-white/60 bg-white/70 shadow-[0_10px_40px_rgba(15,23,42,0.18),inset_0_1px_1px_rgba(255,255,255,0.6)] backdrop-blur-xl dark:border-white/10 dark:bg-black/50 dark:shadow-[0_10px_40px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.12)]",
          )}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[55%] bg-gradient-to-b from-white/40 via-white/10 to-transparent dark:from-white/10 dark:via-white/5"
          />
          <div className="relative flex items-stretch gap-1 p-1.5">
            {MOBILE_LINKS.map((link) => {
              const active = isActive(pathname, link.href);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative z-10 flex min-w-0 flex-1 flex-col items-center gap-1 rounded-full px-2 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "text-[#007AFF] dark:text-[#0A84FF]"
                      : "text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-0 -z-10 rounded-full transition-all duration-300",
                      active
                        ? "bg-[#007AFF]/10 dark:bg-[#0A84FF]/15"
                        : "bg-transparent",
                    )}
                  />
                  <Icon
                    aria-hidden="true"
                    className={cn(
                      "relative size-[22px] transition-transform duration-200",
                      active && "scale-110",
                    )}
                  />
                  <span className="truncate text-[11px] font-medium leading-none">
                    {t(link.label)}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-1 w-1 rounded-full transition-colors",
                      active ? "bg-current" : "bg-transparent",
                    )}
                  />
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              aria-controls="policylab-mobile-more"
              aria-label={t({ el: "Περισσότερες ενότητες", en: "More sections" })}
              className={cn(
                "relative z-10 flex min-w-0 flex-1 flex-col items-center gap-1 rounded-full px-2 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                moreActive
                  ? "text-[#007AFF] dark:text-[#0A84FF]"
                  : "text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-0 -z-10 rounded-full transition-all duration-300",
                  moreActive
                    ? "bg-[#007AFF]/10 dark:bg-[#0A84FF]/15"
                    : "bg-transparent",
                )}
              />
              <MoreHorizontal
                aria-hidden="true"
                className={cn(
                  "relative size-[22px] transition-transform duration-200",
                  moreActive && "scale-110",
                )}
              />
              <span className="truncate text-[11px] font-medium leading-none">
                {t({ el: "Περισσότερα", en: "More" })}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "h-1 w-1 rounded-full transition-colors",
                  moreActive ? "bg-current" : "bg-transparent",
                )}
              />
            </button>
          </div>
        </div>
      </nav>

      <MobileMoreSheet
        id="policylab-mobile-more"
        open={moreOpen}
        pathname={pathname}
        onClose={() => setMoreOpen(false)}
        onSearch={() => {
          setMoreOpen(false);
          setSearchOpen(true);
        }}
      />

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
