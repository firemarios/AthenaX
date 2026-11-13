"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

export const JOURNEY_STOPS = 6;

interface DragState {
  pointerId: number;
  x: number;
  moved: boolean;
}

export interface JourneyRefs {
  wrapperRef: RefObject<HTMLDivElement | null>;
  pageRef: RefObject<HTMLDivElement | null>;
  stageRef: RefObject<HTMLDivElement | null>;
  progressRef: RefObject<number>;
  cameraProgressRef: RefObject<number>;
  orbitRef: RefObject<number>;
}

export interface CityJourney {
  active: number;
  inView: boolean;
  paused: boolean;
  pinned: boolean;
  compact: boolean;
  togglePause: () => void;
  dragHandlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  };
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const list = window.matchMedia(query);
    const sync = () => setMatches(list.matches);
    sync();
    list.addEventListener("change", sync);
    return () => list.removeEventListener("change", sync);
  }, [query]);

  return matches;
}

export function useCityJourney({
  wrapperRef,
  pageRef,
  stageRef,
  progressRef,
  cameraProgressRef,
  orbitRef,
}: JourneyRefs): CityJourney {
  const dragRef = useRef<DragState | null>(null);
  const resetTimer = useRef<number | null>(null);
  const [active, setActive] = useState(0);
  const [inView, setInView] = useState(false);
  const [paused, setPaused] = useState(false);

  const pinned = useMediaQuery("(prefers-reduced-motion: no-preference)");
  const compact = useMediaQuery("(max-width: 767px)");

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    let frame = 0;
    const geometry = { top: 0, total: 0, pageEnd: 0 };

    // Layout is measured only on mount/resize, never inside the scroll frame.
    const measureGeometry = () => {
      const stage = stageRef.current;
      const viewport = stage ? stage.offsetHeight : window.innerHeight;
      const rect = wrapper.getBoundingClientRect();
      geometry.top = rect.top + window.scrollY;
      geometry.total = rect.height - viewport;

      const page = pageRef.current;
      const pageRect = page?.getBoundingClientRect();
      const pageTop = pageRect ? pageRect.top + window.scrollY : geometry.top;
      geometry.pageEnd = pageRect
        ? pageTop + pageRect.height - viewport
        : geometry.top + geometry.total;
    };

    const measure = () => {
      frame = 0;
      const raw =
        geometry.total > 0
          ? (window.scrollY - geometry.top) / geometry.total
          : 0;
      const next = Math.min(1, Math.max(0, raw));
      progressRef.current = next;

      // The journey drives the first six camera keys; the rest of the page
      // (modules, metrics, pricing, finale) drives the remaining keys so the
      // 3D camera keeps travelling behind every section.
      const journeyEnd = geometry.top + geometry.total;
      const afterSpan = geometry.pageEnd - journeyEnd;
      const after =
        afterSpan > 0
          ? Math.min(
              1,
              Math.max(0, (window.scrollY - journeyEnd) / afterSpan),
            )
          : 0;
      cameraProgressRef.current =
        next >= 1 ? 5 / 9 + after * (4 / 9) : next * (5 / 9);

      setActive((previous) => {
        const rawIndex = Math.min(
          JOURNEY_STOPS - 1,
          Math.floor(next * JOURNEY_STOPS),
        );
        if (rawIndex === previous) return previous;

        // Hysteresis: a boundary must be crossed by a small margin so the
        // panel does not flicker while the page rests near a stop edge.
        const margin = 0.008;
        const lower = previous / JOURNEY_STOPS;
        const upper = (previous + 1) / JOURNEY_STOPS;
        if (rawIndex > previous) {
          if (rawIndex > previous + 1 || next > upper - margin) return rawIndex;
          return previous;
        }
        if (rawIndex < previous - 1 || next < lower + margin) return rawIndex;
        return previous;
      });
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    const onResize = () => {
      measureGeometry();
      onScroll();
    };

    measureGeometry();
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(onResize)
        : null;
    observer?.observe(wrapper);
    if (stageRef.current) observer?.observe(stageRef.current);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [cameraProgressRef, pageRef, progressRef, stageRef, wrapperRef]);

  useEffect(() => {
    const target = pageRef.current ?? stageRef.current;
    if (!target) return;
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setInView(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        setInView(entries.some((entry) => entry.isIntersecting));
      },
      { threshold: 0.02 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [pageRef, stageRef, pinned]);

  useEffect(
    () => () => {
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
    },
    [],
  );

  const togglePause = useCallback(() => {
    setPaused((value) => !value);
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      dragRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        moved: false,
      };
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    },
    [],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const delta = event.clientX - drag.x;
      drag.x = event.clientX;
      if (Math.abs(delta) > 0.5) drag.moved = true;
      orbitRef.current = Math.max(
        -0.55,
        Math.min(0.55, orbitRef.current + delta * 0.0042),
      );
    },
    [orbitRef],
  );

  const endDrag = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => {
      orbitRef.current = 0;
    }, 3200);
  }, [orbitRef]);

  const onPointerUp = useCallback(() => endDrag(), [endDrag]);
  const onPointerCancel = useCallback(() => endDrag(), [endDrag]);

  return {
    active,
    inView,
    paused,
    pinned,
    compact,
    togglePause,
    dragHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
  };
}
