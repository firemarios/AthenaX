"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Lang } from "@policylab/types";

const LANG_KEY = "policylab_lang";
const LANG_EVENT = "policylab:lang";
const THEME_KEY = "policylab_theme";
const THEME_EVENT = "policylab:theme";

export type Theme = "light" | "dark";

function readLang(): Lang | null {
  try {
    const value = window.localStorage.getItem(LANG_KEY);
    return value === "el" || value === "en" ? value : null;
  } catch {
    return null;
  }
}

function readTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function prefersDark(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

function subscribeKey(key: string, event: string) {
  return (onChange: () => void): (() => void) => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key || e.key === null) onChange();
    };
    const onLocal = () => onChange();
    window.addEventListener("storage", onStorage);
    window.addEventListener(event, onLocal);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(event, onLocal);
    };
  };
}

function broadcast(event: string) {
  try {
    window.dispatchEvent(new Event(event));
  } catch {
    /* ignore */
  }
}

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (dict: Record<Lang, string>) => string;
}

const I18nContext = createContext<I18nValue>({
  lang: "el",
  setLang: () => undefined,
  t: (dict) => dict.el ?? dict.en,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(
    subscribeKey(LANG_KEY, LANG_EVENT),
    () => readLang() ?? "el",
    () => "el",
  ) as Lang;

  const setLang = useCallback((next: Lang) => {
    try {
      window.localStorage.setItem(LANG_KEY, next);
    } catch {
      /* ignore */
    }
    broadcast(LANG_EVENT);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback(
    (dict: Record<Lang, string>) => dict[lang] ?? dict.en,
    [lang],
  );

  const value = useMemo<I18nValue>(
    () => ({ lang, setLang, t }),
    [lang, setLang, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

interface ThemeValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeValue>({
  theme: "light",
  toggle: () => undefined,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeKey(THEME_KEY, THEME_EVENT),
    () => readTheme() ?? (prefersDark() ? "dark" : "light"),
    () => "light",
  ) as Theme;

  const toggle = useCallback(() => {
    const current = readTheme() ?? (prefersDark() ? "dark" : "light");
    const next: Theme = current === "dark" ? "light" : "dark";
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
    broadcast(THEME_EVENT);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const value = useMemo<ThemeValue>(
    () => ({ theme, toggle }),
    [theme, toggle],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
