"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRef, type RefObject } from "react";
import { ArrowUpRight, Pause, Play } from "lucide-react";
import { cn, useI18n, useTheme } from "@athenax/ui";
import { CHAPTERS, HERO, HOME_ARIA, STOPS, WHO } from "../home-content";
import { useCityJourney } from "../use-city-journey";
import { HeroContent } from "./hero-content";

const CityScene = dynamic(
  () => import("../city-scene").then((module) => module.CityScene),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="pl-home-poster-mark" />
      </div>
    ),
  },
);

function Pillars() {
  const { t } = useI18n();
  return (
    <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
      {WHO.pillars.map((pillar) => {
        const Icon = pillar.icon;
        return (
          <div
            key={pillar.title.en}
            className="pl-home-glass flex items-center gap-3 rounded-2xl p-2.5 sm:block sm:p-4"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--home-accent)]/12 text-[var(--home-accent)] sm:h-9 sm:w-9">
              <Icon aria-hidden="true" className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[var(--home-ink)] sm:mt-3 sm:text-sm">
                {t(pillar.title)}
              </p>
              <p className="mt-1 hidden text-[11px] leading-relaxed text-[var(--home-muted)] sm:block sm:text-xs">
                {t(pillar.body)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChapterCard({ index, active }: { index: number; active: boolean }) {
  const { t } = useI18n();
  const chapter = CHAPTERS[index];
  if (!chapter) return null;
  const alignEnd = Number(chapter.number) % 2 === 0;

  return (
    <div
      className={cn(
        "pointer-events-none flex h-full items-end px-4 pb-24 pt-20 sm:px-6 md:items-center md:pb-16 md:pt-16 xl:pl-64",
        alignEnd ? "md:justify-end" : "md:justify-start",
      )}
    >
      <div className="pl-home-glass-strong pointer-events-auto w-full max-w-md rounded-[1.5rem] p-5 sm:rounded-[1.75rem] sm:p-7 md:p-8">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--home-muted)]">
            {chapter.id} · {t(chapter.tag)}
          </span>
          <span className="font-mono text-2xl font-semibold leading-none text-[var(--home-accent)]/30 sm:text-3xl">
            {chapter.number}
          </span>
        </div>
        <h2 className="mt-3 text-[clamp(1.55rem,6vw,2.25rem)] font-semibold leading-[1.12] tracking-[-0.02em] text-[var(--home-ink)] sm:mt-4 sm:text-4xl">
          {t(chapter.title)}
        </h2>
        <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--home-muted)] sm:mt-3 sm:text-base">
          {t(chapter.body)}
        </p>
        <Link
          href={chapter.href}
          tabIndex={active ? undefined : -1}
          className="pl-home-link mt-4 sm:mt-6"
        >
          {t(chapter.linkLabel)}
          <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function StageChrome({
  active,
  paused,
  onTogglePause,
}: {
  active: number;
  paused: boolean;
  onTogglePause: () => void;
}) {
  const { t } = useI18n();
  const stop = STOPS[active] ?? STOPS[0];

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-6 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-3 xl:flex"
      >
        {STOPS.map((item, index) => {
          const isActive = index === active;
          return (
            <span
              key={item.id}
              className={cn(
                "flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors duration-700",
                isActive
                  ? "text-[var(--home-ink)]"
                  : "text-[var(--home-muted)]/55",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-px transition-all duration-700",
                  isActive
                    ? "w-7 bg-[var(--home-accent)]"
                    : "w-4 bg-[var(--home-line)]",
                )}
              />
              <span className="w-14">{item.id}</span>
              <span>{t(item.label)}</span>
            </span>
          );
        })}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 px-4 pb-24 sm:gap-4 sm:px-6 md:pb-5">
        <span className="pl-home-chip hidden whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.2em] sm:inline-flex">
          {stop.id} · {t(stop.label)}
        </span>
        <div
          aria-hidden="true"
          className="flex flex-1 items-center gap-1 sm:gap-1.5 md:max-w-xs"
        >
          {STOPS.map((item, index) => (
            <span
              key={item.id}
              className={cn(
                "h-px flex-1 transition-colors duration-700",
                index <= active
                  ? "bg-[var(--home-accent)]"
                  : "bg-[var(--home-line)]",
              )}
            />
          ))}
        </div>
        <span className="pl-home-chip whitespace-nowrap font-mono text-[9px] tracking-[0.16em] sm:text-[10px] sm:tracking-[0.2em]">
          {String(active + 1).padStart(2, "0")} / 06
        </span>
        <button
          type="button"
          onClick={onTogglePause}
          aria-pressed={paused}
          aria-label={paused ? t(HERO.play) : t(HERO.pause)}
          className="pl-home-chip pointer-events-auto inline-flex h-9 w-9 items-center justify-center transition-colors hover:text-[var(--home-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-accent)]"
        >
          {paused ? (
            <Play aria-hidden="true" className="h-3.5 w-3.5" />
          ) : (
            <Pause aria-hidden="true" className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      <p className="sr-only" aria-live="polite">
        {stop.id} · {t(stop.label)}
      </p>
    </>
  );
}

export function PinnedJourney({
  pageRef,
  onSearch,
}: {
  pageRef: RefObject<HTMLDivElement | null>;
  onSearch: (query: string) => void;
}) {
  const { t } = useI18n();
  const { theme } = useTheme();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef(0);
  const cameraProgressRef = useRef(0);
  const orbitRef = useRef(0);
  const journey = useCityJourney({
    wrapperRef,
    pageRef,
    stageRef,
    progressRef,
    cameraProgressRef,
    orbitRef,
  });
  const { active, paused, pinned, inView, compact } = journey;

  const panels = [
    <div
      key="hero"
      className="pl-home-hero flex h-full items-start px-4 pb-24 pt-24 sm:px-6 sm:pt-28 md:pb-16 md:pt-32 xl:pl-64"
    >
      <div className="w-full max-w-[96rem]">
        <div className="pointer-events-auto max-w-2xl">
          <HeroContent onSearch={onSearch} variant="pinned" />
        </div>
      </div>
    </div>,
    <div
      key="pillars"
      className="flex h-full items-end px-4 pb-24 pt-20 sm:px-6 md:pb-20 md:pt-16 xl:pl-64"
    >
      <div className="w-full max-w-[96rem]">
        <div className="pl-home-glass-strong pointer-events-auto rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-7 md:p-8">
          <div className="grid gap-3 sm:gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--home-accent)]">
                {t(WHO.eyebrow)}
              </p>
              <h2 className="mt-1.5 text-[clamp(1.35rem,5.4vw,2.25rem)] font-semibold leading-[1.12] tracking-[-0.02em] text-[var(--home-ink)] sm:mt-3 sm:text-4xl">
                {t(WHO.title)}
              </h2>
              <p className="mt-2 hidden text-[13px] leading-relaxed text-[var(--home-muted)] sm:block sm:mt-3 sm:text-sm">
                {t(WHO.body)}
              </p>
            </div>
            <Pillars />
          </div>
        </div>
      </div>
    </div>,
    ...CHAPTERS.map((chapter, index) => (
      <ChapterCard key={chapter.id} index={index} active={active === index + 2} />
    )),
  ];

  return (
    <section
      ref={wrapperRef}
      aria-label={t(HOME_ARIA.journey)}
      className="pl-home-pinned pl-home-journey relative"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        <div className="absolute inset-0">
          {pinned ? (
            <CityScene
              progressRef={progressRef}
              cameraProgressRef={cameraProgressRef}
              orbitRef={orbitRef}
              theme={theme}
              paused={paused}
              active={inView}
              compact={compact}
            />
          ) : null}
        </div>
        <div className="pl-home-vignette absolute inset-0" />
        <div className="pl-home-grain absolute inset-0" />
      </div>

      <div
        ref={stageRef}
        className="pl-home-stage sticky top-0 z-10 overflow-hidden"
      >
        <div
          aria-hidden="true"
          className={cn(
            "pl-home-scrim-left absolute inset-0 transition-opacity duration-1000",
            active === 0 ? "opacity-100" : "opacity-40",
          )}
        />
        <div
          aria-hidden="true"
          className="pl-home-scrim-bottom absolute inset-0 md:hidden"
        />

        <div
          aria-hidden="true"
          className="absolute inset-0 z-10 cursor-grab touch-pan-y active:cursor-grabbing"
          {...journey.dragHandlers}
        />

        <div className="pointer-events-none absolute inset-0 z-20">
          {panels.map((panel, index) => {
            const isActive = index === active;
            return (
              <div
                key={index}
                inert={!isActive}
                data-active={isActive ? "true" : "false"}
                className={cn(
                  "pl-home-panel pointer-events-none absolute inset-0",
                  isActive ? "is-active" : "",
                )}
              >
                {panel}
              </div>
            );
          })}
        </div>

        <StageChrome
          active={active}
          paused={paused}
          onTogglePause={journey.togglePause}
        />
      </div>
    </section>
  );
}
