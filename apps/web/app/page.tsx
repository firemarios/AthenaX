"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useHomeMetrics } from "@/_shared/home/use-home-metrics";
import { PinnedJourney } from "@/_shared/home/pinned-journey";
import { StackedHome } from "@/_shared/home/stacked-home";
import { ModuleGrid } from "@/_shared/home/module-grid";
import { MetricsHud } from "@/_shared/home/metrics-hud";
import { Pricing } from "@/_shared/home/pricing";
import { Finale } from "@/_shared/home/finale";

export default function HomePage() {
  const router = useRouter();
  const pageRef = useRef<HTMLDivElement | null>(null);
  const { metrics, loading, failed, retry } = useHomeMetrics();
  const health = metrics?.health ?? null;

  const goSearch = (query: string) => {
    router.push(`/ask?q=${encodeURIComponent(query)}`);
  };

  return (
    <div ref={pageRef} className="pl-home">
      <PinnedJourney pageRef={pageRef} onSearch={goSearch} />
      <div className="pl-home-after">
        <StackedHome onSearch={goSearch} health={health} loading={loading} />
        <ModuleGrid />
        <MetricsHud
          metrics={metrics}
          loading={loading}
          failed={failed}
          retry={retry}
        />
        <Pricing />
        <Finale />
      </div>
    </div>
  );
}
