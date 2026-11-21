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
      el: "Ρώτησε την πόλη… (Ctrl K)",
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
          "h-11 w-full rounded-full border border-zinc-200/80 bg-white pl-9 pr-16 text-sm text-zinc-900 shadow-sm",
          "placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500",
        )}
      />
      <kbd
        aria-hidden="true"
        className="pointer-events-none absolute right-2 hidden rounded-md border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 sm:inline-block"
      >
        Ctrl K
      </kbd>
    </form>
  );
}
