"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "./cn";
import { useI18n } from "./providers";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({
  items,
  className,
  label,
}: {
  items: BreadcrumbItem[];
  className?: string;
  label?: string;
}) {
  const { t } = useI18n();
  if (items.length === 0) return null;

  return (
    <nav
      aria-label={label ?? t({ el: "Διαδρομή", en: "Breadcrumb" })}
      className={cn("mb-3", className)}
    >
      <ol className="flex flex-wrap items-center gap-1 text-xs">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li
              key={`${item.href ?? "current"}-${item.label}-${index}`}
              className="flex min-w-0 items-center gap-1"
            >
              {index > 0 ? (
                <ChevronRight
                  aria-hidden="true"
                  className="size-3 shrink-0 text-muted-foreground/70"
                />
              ) : null}
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="truncate rounded font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className="truncate font-medium text-foreground"
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
