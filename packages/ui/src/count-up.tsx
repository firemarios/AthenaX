"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "./providers";
import { cn } from "./cn";

export function CountUp({
  value,
  duration = 1000,
  className,
}: {
  value: number | null | undefined;
  duration?: number;
  className?: string;
}) {
  const { lang } = useI18n();
  const ref = useRef<HTMLSpanElement | null>(null);
  const [inView, setInView] = useState(false);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || value === null || value === undefined) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value, duration]);

  const known = value !== null && value !== undefined;
  const formatted = new Intl.NumberFormat(lang === "el" ? "el-GR" : "en-US").format(
    Math.round(display),
  );

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {known ? formatted : "—"}
    </span>
  );
}
