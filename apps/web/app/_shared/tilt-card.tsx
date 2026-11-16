"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@athenax/ui";

export function TiltCard({
  children,
  className,
  strength = 1,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  const reset = () => {
    const element = ref.current;
    if (!element) return;
    element.style.setProperty("--tilt-x", "0deg");
    element.style.setProperty("--tilt-y", "0deg");
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const element = ref.current;
    if (!element) return;
    if (event.pointerType !== "mouse") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = element.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    element.style.setProperty("--tilt-x", `${(0.5 - py) * 4 * strength}deg`);
    element.style.setProperty("--tilt-y", `${(px - 0.5) * 5 * strength}deg`);
  };

  return (
    <div className="pl-tilt-wrap h-full">
      <div
        ref={ref}
        onPointerMove={onPointerMove}
        onPointerLeave={reset}
        className={cn("pl-tilt group/tilt relative h-full", className)}
      >
        {children}
      </div>
    </div>
  );
}
