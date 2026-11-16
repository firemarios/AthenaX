"use client";

import Image from "next/image";
import { useId } from "react";
import { useI18n } from "@athenax/ui";
import { HERO } from "../home-content";

const SKYLINE: { x: number; width: number; height: number }[] = [
  { x: 4, width: 26, height: 46 },
  { x: 34, width: 18, height: 68 },
  { x: 56, width: 30, height: 38 },
  { x: 90, width: 16, height: 84 },
  { x: 110, width: 24, height: 56 },
  { x: 138, width: 34, height: 30 },
  { x: 176, width: 18, height: 72 },
  { x: 198, width: 26, height: 48 },
  { x: 228, width: 30, height: 62 },
  { x: 262, width: 16, height: 40 },
  { x: 282, width: 22, height: 90 },
  { x: 308, width: 34, height: 52 },
  { x: 346, width: 20, height: 74 },
  { x: 370, width: 26, height: 44 },
];

function healthDot(health: string | null): string {
  if (health === "ok") return "bg-emerald-400";
  if (health === "degraded") return "bg-amber-400";
  if (health === "down") return "bg-rose-400";
  return "bg-slate-400";
}

export function HeroPoster({
  health,
  loading,
}: {
  health: string | null;
  loading: boolean;
}) {
  const { t } = useI18n();
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, "");

  return (
    <div className="pl-home-poster relative h-[340px] overflow-hidden rounded-[2rem] border border-[var(--home-line)] sm:h-[440px]">
      <svg
        viewBox="0 0 400 260"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id={`sky-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              style={{ stopColor: "var(--home-poster-sky-1)" }}
            />
            <stop
              offset="100%"
              style={{ stopColor: "var(--home-poster-sky-2)" }}
            />
          </linearGradient>
          <radialGradient id={`glow-${id}`} cx="50%" cy="45%" r="55%">
            <stop
              offset="0%"
              style={{ stopColor: "var(--home-poster-glow)" }}
              stopOpacity="0.85"
            />
            <stop
              offset="100%"
              style={{ stopColor: "var(--home-poster-glow)" }}
              stopOpacity="0"
            />
          </radialGradient>
        </defs>
        <rect width="400" height="260" fill={`url(#sky-${id})`} />
        <rect width="400" height="260" fill={`url(#glow-${id})`} />
        <g style={{ fill: "var(--home-poster-building)" }}>
          {SKYLINE.map((building, index) => (
            <rect
              key={index}
              x={building.x}
              y={196 - building.height}
              width={building.width}
              height={building.height}
              rx="1.5"
            />
          ))}
        </g>
        <g style={{ fill: "var(--home-poster-marble)" }}>
          <path d="M188 196 L188 150 L252 150 L252 196 Z" opacity="0.9" />
          <rect x="192" y="142" width="56" height="8" rx="1" />
          <rect x="196" y="128" width="48" height="12" rx="1" opacity="0.85" />
          <path d="M194 128 L220 110 L246 128 Z" opacity="0.9" />
        </g>
        <g style={{ fill: "var(--home-poster-building)" }} opacity="0.55">
          <rect x="0" y="196" width="400" height="64" />
        </g>
        <g style={{ fill: "var(--home-poster-glow)" }} opacity="0.5">
          <circle cx="220" cy="128" r="2" />
          <circle cx="120" cy="150" r="1.6" />
          <circle cx="316" cy="140" r="1.6" />
        </g>
      </svg>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,transparent_35%,rgba(5,10,30,0.35)_100%)] dark:bg-[radial-gradient(ellipse_at_50%_20%,transparent_35%,rgba(5,10,30,0.6)_100%)]"
      />

      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
        <span className="pl-home-chip inline-flex items-center gap-2 text-[11px] font-medium">
          <span className={`h-1.5 w-1.5 rounded-full ${healthDot(health)}`} />
          {t(HERO.twin)}
        </span>
        <span className="pl-home-chip font-mono text-[10px] tracking-[0.2em]">
          3D
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--home-muted)]">
            {t(HERO.liveModel)}
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--home-ink)]">
            {t(HERO.liveValue)}
          </p>
        </div>
        <span className="pl-home-chip font-mono text-[10px]">
          {loading ? t(HERO.sync) : t(HERO.drag)}
        </span>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <span className="pl-home-poster-mark">
          <Image
            src="/brand/athenax-mark.png"
            alt=""
            width={640}
            height={640}
            className="h-full w-full"
          />
        </span>
      </div>
    </div>
  );
}
