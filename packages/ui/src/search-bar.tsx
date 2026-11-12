"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { useI18n } from "./providers";
import { cn } from "./cn";

export interface SearchBarProps {
  placeholder?: string;
  onSearch?: (q: string) => void;
  initial?: string;
}

export function SearchBar({ placeholder, onSearch, initial }: SearchBarProps) {
  const router = useRouter();
  const { t, lang } = useI18n();
  const inputId = useId();
  const [value, setValue] = useState(initial ?? "");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = value.trim();
    if (!q) return;
    if (onSearch) {
      onSearch(q);
      return;
    }
    router.push(`/ask?q=${encodeURIComponent(q)}`);
  };

  const resolvedPlaceholder =
    placeholder ??
    t({
      el: "Ρώτα την πόλη… (Ctrl K)",
      en: "Ask the city… (Ctrl K)",
    });

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className="relative flex w-full items-center"
    >
      <label htmlFor={inputId} className="sr-only">
        {lang === "el"
          ? "Ολική αναζήτηση"
          : "Universal search"}
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground"
      />
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={resolvedPlaceholder}
        autoComplete="off"
        className={cn(
          "h-10 w-full rounded-[var(--radius-button)] border border-input bg-background pl-9 pr-16 text-sm text-foreground",
          "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      />
      <kbd
        aria-hidden="true"
        className="pointer-events-none absolute right-2 hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-block"
      >
        Ctrl K
      </kbd>
    </form>
  );
}
