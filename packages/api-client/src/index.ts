import type { ApiError, Envelope, Meta } from "@policylab/types";

function readBase(): string {
  try {
    if (
      typeof process !== "undefined" &&
      process.env &&
      process.env.NEXT_PUBLIC_API_BASE_URL
    ) {
      return process.env.NEXT_PUBLIC_API_BASE_URL;
    }
  } catch {
    /* ignore */
  }
  return "http://localhost:8000";
}

/** Base URL of the POLICYLAB API (override with NEXT_PUBLIC_API_BASE_URL). */
export const API_BASE: string = readBase();

const GREEK_ERRORS: Record<number, string> = {
  0: "Αδυναμία σύνδεσης με τον διακομιστή",
  400: "Μη έγκυρο αίτημα",
  401: "Μη εξουσιοδοτημένη πρόσβαση",
  403: "Απαγορεύεται η πρόσβαση",
  404: "Ο πόρος δεν βρέθηκε",
  405: "Μη επιτρεπτή μέθοδος",
  408: "Λήξη χρόνου αιτήματος",
  409: "Σύγκρουση πόρων",
  413: "Το αίτημα είναι πολύ μεγάλο",
  422: "Μη έγκυρη είσοδος",
  429: "Πολλά αιτήματα — δοκιμάστε ξανά σύντομα",
  500: "Εσωτερικό σφάλμα διακομιστή",
  501: "Μη υλοποιημένη λειτουργία",
  502: "Λανθασμένη απάντηση διακομιστή",
  503: "Η υπηρεσία δεν είναι διαθέσιμη",
  504: "Λήξη χρόνου από τον διακομιστή",
};

/** Greek error message for an HTTP status (0 = network failure). */
export function apiError(status: number): string {
  const known = GREEK_ERRORS[status];
  if (known) return known;
  if (status >= 500) return "Σφάλμα διακομιστή";
  if (status >= 400) return "Σφάλμα αιτήματος";
  if (status > 0) return "Μη αναμενόμενη απάντηση";
  return "Άγνωστο σφάλμα";
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isEnvelope(value: unknown): value is Envelope<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    typeof (value as { ok: unknown }).ok === "boolean"
  );
}

async function toEnvelope<T>(res: Response): Promise<Envelope<T>> {
  const status = res.status;
  let parsed: unknown = null;
  try {
    const text = await res.text();
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }
  } catch {
    parsed = null;
  }

  if (isEnvelope(parsed)) {
    return parsed as Envelope<T>;
  }

  if (res.ok) {
    return { ok: true, data: parsed as T | null, meta: null, error: null };
  }

  const message =
    parsed && typeof parsed === "object" && "message" in parsed
      ? String((parsed as { message: unknown }).message)
      : apiError(status);
  const details =
    parsed && typeof parsed === "object" && "details" in parsed
      ? (parsed as { details?: ApiError["details"] }).details
      : undefined;
  return {
    ok: false,
    data: null,
    meta: null,
    error: { code: status, message, ...(details ? { details } : {}) },
  };
}

function networkEnvelope<T>(): Envelope<T> {
  return {
    ok: false,
    data: null,
    meta: null,
    error: { code: 0, message: apiError(0) },
  };
}

/**
 * Perform an HTTP request against the POLICYLAB API.
 *
 * - Always resolves to an `Envelope` (never throws).
 * - Retries once (2 attempts total, small backoff) on network errors and 5xx.
 * - 4xx responses are never retried; the parsed error envelope is returned as-is.
 */
export async function request<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<Envelope<T>> {
  const method = (opts.method ?? "GET").toUpperCase();
  const url = /^https?:\/\//i.test(path)
    ? path
    : `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(opts.headers ?? {}),
  };
  const hasBody = opts.body !== undefined && opts.body !== null;
  if (hasBody) headers["Content-Type"] = "application/json";

  const init: RequestInit = { method, headers, cache: "no-store" };
  if (hasBody) init.body = JSON.stringify(opts.body);
  if (opts.signal) init.signal = opts.signal;

  const maxAttempts = 2;
  let last: Envelope<T> | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) await delay(250 * attempt);
    try {
      const res = await fetch(url, init);
      if (res.status >= 500 && attempt < maxAttempts - 1) {
        last = await toEnvelope<T>(res);
        continue;
      }
      return await toEnvelope<T>(res);
    } catch {
      last = null;
      if (attempt >= maxAttempts - 1) return networkEnvelope<T>();
    }
  }
  return last ?? networkEnvelope<T>();
}

export interface Result<T> {
  data: T | null;
  meta: Meta | null;
  ok: boolean;
  error: ApiError | null;
}

async function run<T>(
  path: string,
  method: string,
  body?: unknown,
  opts?: Omit<RequestOptions, "method" | "body">,
): Promise<Result<T>> {
  const env = await request<T>(path, { ...opts, method, body });
  return { data: env.data, meta: env.meta, ok: env.ok, error: env.error };
}

export function get<T>(
  path: string,
  opts?: Omit<RequestOptions, "method" | "body">,
): Promise<Result<T>> {
  return run<T>(path, "GET", undefined, opts);
}

export function post<T>(
  path: string,
  body?: unknown,
  opts?: Omit<RequestOptions, "method" | "body">,
): Promise<Result<T>> {
  return run<T>(path, "POST", body, opts);
}

export function patch<T>(
  path: string,
  body?: unknown,
  opts?: Omit<RequestOptions, "method" | "body">,
): Promise<Result<T>> {
  return run<T>(path, "PATCH", body, opts);
}

export function del<T>(
  path: string,
  opts?: Omit<RequestOptions, "method" | "body">,
): Promise<Result<T>> {
  return run<T>(path, "DELETE", undefined, opts);
}
