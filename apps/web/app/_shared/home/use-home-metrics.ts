"use client";

import { useCallback, useEffect, useState } from "react";
import type { Lang } from "@policylab/types";
import { request } from "@policylab/api-client";

export interface HomeMetrics {
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

export function healthLabel(
  status: string | null,
  t: (dict: Record<Lang, string>) => string,
): string {
  if (!status) return "—";
  if (status === "ok") return t({ el: "Εντάξει", en: "Operational" });
  if (status === "degraded") return t({ el: "Μειωμένο", en: "Degraded" });
  if (status === "down") return t({ el: "Εκτός", en: "Down" });
  return status;
}

export function useHomeMetrics() {
  const [metrics, setMetrics] = useState<HomeMetrics | null>(null);
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

  return { metrics, loading, failed, retry };
}
