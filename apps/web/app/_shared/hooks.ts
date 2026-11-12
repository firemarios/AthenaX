"use client";

import { useCallback, useEffect, useState } from "react";
import { get, post } from "@policylab/api-client";
import type { Meta } from "@policylab/types";

export const GENERIC_ERROR =
  "Δεν ήταν δυνατή η ανάκτηση των δεδομένων από τον διακομιστή. Δοκιμάστε ξανά.";

export function errMessage(error: unknown): string {
  if (error && typeof error === "object" && "name" in error) {
    const name = (error as { name: unknown }).name;
    if (name === "AbortError") return "";
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return GENERIC_ERROR;
}

export interface ApiState<T> {
  data: T | null;
  meta: Meta | null;
  loading: boolean;
  error: string | null;
}

export function useApi<T>(path: string | null): ApiState<T> & { reload: () => void } {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    meta: null,
    loading: path !== null,
    error: null,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (path === null) {
      const id = window.setTimeout(() => {
        setState({ data: null, meta: null, loading: false, error: null });
      }, 0);
      return () => window.clearTimeout(id);
    }
    const ac = new AbortController();
    let cancelled = false;
    const loadId = window.setTimeout(() => {
      if (!cancelled) setState((prev) => ({ ...prev, loading: true, error: null }));
    }, 0);
    get<T>(path, { signal: ac.signal })
      .then((res) => {
        if (cancelled) return;
        if (res.data === null || res.data === undefined) {
          setState({
            data: null,
            meta: res.meta ?? null,
            loading: false,
            error: res.error?.message || GENERIC_ERROR,
          });
        } else {
          setState({ data: res.data, meta: res.meta ?? null, loading: false, error: null });
        }
      })
      .catch((error: unknown) => {
        if (cancelled || ac.signal.aborted) return;
        setState({
          data: null,
          meta: null,
          loading: false,
          error: errMessage(error) || GENERIC_ERROR,
        });
      });
    return () => {
      cancelled = true;
      window.clearTimeout(loadId);
      ac.abort();
    };
  }, [path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return { ...state, reload };
}

export async function doGet<T>(
  path: string,
  signal?: AbortSignal
): Promise<{ data: T | null; meta: Meta | null; error: string | null }> {
  try {
    const res = await get<T>(path, signal ? { signal } : undefined);
    if (res.data === null || res.data === undefined) {
      return { data: null, meta: res.meta ?? null, error: res.error?.message || GENERIC_ERROR };
    }
    return { data: res.data, meta: res.meta ?? null, error: null };
  } catch (error: unknown) {
    const message = errMessage(error);
    return { data: null, meta: null, error: message || GENERIC_ERROR };
  }
}

export async function doPost<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal
): Promise<{ data: T | null; meta: Meta | null; error: string | null }> {
  try {
    const res = await post<T>(path, body, signal ? { signal } : undefined);
    if (res.data === null || res.data === undefined) {
      return { data: null, meta: res.meta ?? null, error: res.error?.message || GENERIC_ERROR };
    }
    return { data: res.data, meta: res.meta ?? null, error: null };
  } catch (error: unknown) {
    const message = errMessage(error);
    return { data: null, meta: null, error: message || GENERIC_ERROR };
  }
}
