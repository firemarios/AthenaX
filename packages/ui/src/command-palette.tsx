"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  CornerDownLeft,
  Database,
  FileText,
  MessagesSquare,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Lang } from "@policylab/types";
import { cn } from "./cn";
import {
  ALL_LINKS,
  NEW_POLICY_LINK,
  type NavLink,
} from "./nav-config";
import { useI18n } from "./providers";

const RECENT_KEY = "policylab_recent_links";
const MAX_RECENT = 4;
const PALETTE_LINKS: NavLink[] = [...ALL_LINKS, NEW_POLICY_LINK];

interface PaletteItem {
  id: string;
  group: string;
  label: string;
  description?: string;
  href: string;
  icon: LucideIcon;
}

interface PaletteGroup {
  label: string;
  items: PaletteItem[];
}

function fold(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function readRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string").slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function remember(href: string): string[] {
  if (typeof window === "undefined") return [];
  const next = [href, ...readRecents().filter((item) => item !== href)].slice(0, MAX_RECENT);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

function matches(link: NavLink, query: string, t: (dict: Record<Lang, string>) => string): boolean {
  const haystack = fold(
    [
      t(link.label),
      link.description ? t(link.description) : "",
      ...(link.keywords ?? []),
    ].join(" "),
  );
  return haystack.includes(query);
}

function toItem(
  link: NavLink,
  group: string,
  t: (dict: Record<Lang, string>) => string,
): PaletteItem {
  return {
    id: `page-${link.href}`,
    group,
    label: t(link.label),
    description: link.description ? t(link.description) : undefined,
    href: link.href,
    icon: link.icon,
  };
}

function ResultRow({
  item,
  index,
  active,
  id,
  onHover,
  onSelect,
}: {
  item: PaletteItem;
  index: number;
  active: boolean;
  id: string;
  onHover: (index: number) => void;
  onSelect: (item: PaletteItem) => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      role="option"
      id={id}
      aria-selected={active}
      onMouseEnter={() => onHover(index)}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onSelect(item)}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg border",
          active
            ? "border-blue-200 bg-white text-blue-600 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
            : "border-zinc-200 bg-white text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
        )}
      >
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{item.label}</span>
        {item.description ? (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {item.description}
          </span>
        ) : null}
      </span>
      {active ? (
        <CornerDownLeft aria-hidden="true" className="size-4 shrink-0 opacity-60" />
      ) : null}
    </button>
  );
}

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const baseId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(timer);
    }
    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setRecents(remember(pathname));
    setQuery("");
    setActiveIndex(0);
  }, [open, pathname]);

  const { groups, items } = useMemo(() => {
    const term = fold(query.trim());
    const nextGroups: PaletteGroup[] = [];

    if (!term) {
      const recentLinks = recents
        .map((href) => PALETTE_LINKS.find((link) => link.href === href))
        .filter((link): link is NavLink => Boolean(link));
      if (recentLinks.length > 0) {
        nextGroups.push({
          label: t({ el: "Πρόσφατα", en: "Recent" }),
          items: recentLinks.map((link) =>
            toItem(link, t({ el: "Πρόσφατα", en: "Recent" }), t),
          ),
        });
      }
      const otherLinks = PALETTE_LINKS.filter(
        (link) => !recents.includes(link.href),
      );
      if (otherLinks.length > 0) {
        nextGroups.push({
          label: t({ el: "Σελίδες", en: "Pages" }),
          items: otherLinks.map((link) =>
            toItem(link, t({ el: "Σελίδες", en: "Pages" }), t),
          ),
        });
      }
    } else {
      const actions: PaletteItem[] = [
        {
          id: "action-ask",
          group: t({ el: "Ενέργειες", en: "Actions" }),
          label: t({
            el: `Ρώτα την πόλη: «${query.trim()}»`,
            en: `Ask the city: “${query.trim()}”`,
          }),
          description: t({
            el: "Απάντηση με πηγές από τα δεδομένα",
            en: "Answer with sources from the data",
          }),
          href: `/ask?q=${encodeURIComponent(query.trim())}`,
          icon: MessagesSquare,
        },
        {
          id: "action-data",
          group: t({ el: "Ενέργειες", en: "Actions" }),
          label: t({
            el: `Αναζήτηση δεδομένων για «${query.trim()}»`,
            en: `Search datasets for “${query.trim()}”`,
          }),
          description: t({ el: "Σύνολα δεδομένων", en: "Datasets" }),
          href: `/data?q=${encodeURIComponent(query.trim())}`,
          icon: Database,
        },
        {
          id: "action-policies",
          group: t({ el: "Ενέργειες", en: "Actions" }),
          label: t({
            el: `Αναζήτηση πολιτικών για «${query.trim()}»`,
            en: `Search policies for “${query.trim()}”`,
          }),
          description: t({ el: "Πολιτικές", en: "Policies" }),
          href: `/policies?q=${encodeURIComponent(query.trim())}`,
          icon: FileText,
        },
      ];
      nextGroups.push({ label: t({ el: "Ενέργειες", en: "Actions" }), items: actions });

      const pageMatches = PALETTE_LINKS.filter((link) => matches(link, term, t));
      if (pageMatches.length > 0) {
        nextGroups.push({
          label: t({ el: "Σελίδες", en: "Pages" }),
          items: pageMatches.map((link) =>
            toItem(link, t({ el: "Σελίδες", en: "Pages" }), t),
          ),
        });
      }
    }

    return { groups: nextGroups, items: nextGroups.flatMap((group) => group.items) };
  }, [query, recents, t]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const close = () => {
    onClose();
  };

  const go = (item: PaletteItem) => {
    setRecents(remember(item.href));
    close();
    router.push(item.href);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (items.length === 0) {
      if (event.key === "Escape") close();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + items.length) % items.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(items.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = items[activeIndex] ?? items[0];
      if (item) go(item);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  const listId = `${baseId}-list`;
  const activeId =
    items.length > 0
      ? `${baseId}-opt-${Math.min(activeIndex, items.length - 1)}`
      : undefined;

  return (
    <dialog
      ref={dialogRef}
      aria-label={t({ el: "Αναζήτηση και γρήγορη πλοήγηση", en: "Search and quick navigation" })}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClose={close}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      className="fixed inset-0 z-[80] m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-black/25 backdrop:backdrop-blur-sm dark:backdrop:bg-black/60"
    >
      <div className="flex min-h-full items-start justify-center px-4 pb-8 pt-[10vh]">
        <div
          className={cn(
            "w-full max-w-xl overflow-hidden rounded-2xl border border-white/60 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.22),inset_0_1px_1px_rgba(255,255,255,0.7)] backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-900/95 dark:shadow-[0_24px_80px_rgba(0,0,0,0.55),inset_0_1px_1px_rgba(255,255,255,0.08)]",
            open && "pl-dialog-in",
          )}
        >
          <div className="flex items-center gap-3 border-b border-zinc-200/70 px-4 dark:border-zinc-800">
            <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeId}
              aria-label={t({ el: "Αναζήτηση", en: "Search" })}
              placeholder={t({
                el: "Αναζήτηση σελίδων ή ενεργειών…",
                en: "Search pages or actions…",
              })}
              autoComplete="off"
              className="h-14 min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
            />
            <button
              type="button"
              onClick={close}
              aria-label={t({ el: "Κλείσιμο", en: "Close" })}
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>

          <div
            id={listId}
            role="listbox"
            aria-label={t({ el: "Αποτελέσματα", en: "Results" })}
            className="max-h-[min(60vh,28rem)] overflow-y-auto p-2"
          >
            {items.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                {t({ el: "Δεν βρέθηκαν αποτελέσματα.", en: "No results found." })}
              </p>
            ) : (
              groups.map((group) => (
                <div key={group.label} role="presentation">
                  <p
                    role="presentation"
                    className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {group.label}
                  </p>
                  {group.items.map((item) => {
                    const index = items.indexOf(item);
                    return (
                      <ResultRow
                        key={item.id}
                        item={item}
                        index={index}
                        active={index === activeIndex}
                        id={`${baseId}-opt-${index}`}
                        onHover={setActiveIndex}
                        onSelect={go}
                      />
                    );
                  })}
                </div>
              ))
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200/70 px-4 py-2.5 text-[11px] text-muted-foreground dark:border-zinc-800">
            <span>
              <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 font-mono dark:border-zinc-700 dark:bg-zinc-800">
                ↑↓
              </kbd>{" "}
              {t({ el: "πλοήγηση", en: "navigate" })}
              <span aria-hidden="true"> · </span>
              <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 font-mono dark:border-zinc-700 dark:bg-zinc-800">
                Enter
              </kbd>{" "}
              {t({ el: "άνοιγμα", en: "open" })}
              <span aria-hidden="true"> · </span>
              <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 font-mono dark:border-zinc-700 dark:bg-zinc-800">
                Esc
              </kbd>{" "}
              {t({ el: "κλείσιμο", en: "close" })}
            </span>
            <span>
              <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 font-mono dark:border-zinc-700 dark:bg-zinc-800">
                Ctrl K
              </kbd>
            </span>
          </div>
        </div>
      </div>
    </dialog>
  );
}
