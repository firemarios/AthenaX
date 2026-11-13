"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useI18n } from "@policylab/ui";

const LOADER_CSS = `
@keyframes pl-loader-in {
  from { opacity: 0; transform: translateY(14px) scale(0.97); }
  to { opacity: 1; transform: none; }
}
@keyframes pl-loader-bar {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
@keyframes pl-loader-glow {
  0%, 100% { opacity: 0.3; transform: scale(0.94); }
  50% { opacity: 0.62; transform: scale(1.06); }
}
@keyframes pl-loader-shimmer {
  from { background-position: 180% 0; }
  to { background-position: -80% 0; }
}
@media (prefers-reduced-motion: reduce) {
  [data-site-loader] *,
  [data-site-loader] {
    animation: none !important;
    transition: none !important;
  }
}
`;

export function SiteLoader() {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<"loading" | "leaving" | "done">("loading");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const hold = reduce ? 260 : 950;
    const fade = reduce ? 180 : 520;
    const leave = window.setTimeout(() => setPhase("leaving"), hold);
    const done = window.setTimeout(() => setPhase("done"), hold + fade);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(leave);
      window.clearTimeout(done);
    };
  }, []);

  if (phase === "done") return null;

  const leaving = phase === "leaving";

  return (
    <div
      data-site-loader=""
      role="status"
      aria-live="polite"
      aria-label="ATHENAX — loading"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 120,
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        background:
          "radial-gradient(circle at 50% 36%, #141b2c 0%, #080808 52%, #000 100%)",
        color: "#fff",
        opacity: leaving ? 0 : 1,
        transition: "opacity 520ms cubic-bezier(0.16, 1, 0.3, 1)",
        pointerEvents: leaving ? "none" : "auto",
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: LOADER_CSS }} />

      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          width: 340,
          height: 340,
          borderRadius: 9999,
          background:
            "radial-gradient(circle, rgba(0,82,255,0.34) 0%, rgba(34,211,238,0.12) 42%, transparent 70%)",
          filter: "blur(12px)",
          animation: "pl-loader-glow 2200ms ease-in-out infinite",
        }}
      />

      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          padding: "0 24px",
        }}
      >
        <div
          style={{
            display: "grid",
            placeItems: "center",
            width: 76,
            height: 76,
            borderRadius: 24,
            background: "#ffffff",
            boxShadow:
              "0 24px 70px -24px rgba(0,82,255,0.75), inset 0 0 0 1px rgba(255,255,255,0.7)",
            animation: "pl-loader-in 720ms cubic-bezier(0.16, 1, 0.3, 1) both",
          }}
        >
          <Image
            src="/brand/athenax-mark.png"
            alt=""
            width={52}
            height={52}
            priority
            style={{ width: 52, height: 52, objectFit: "contain" }}
          />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            animation:
              "pl-loader-in 720ms cubic-bezier(0.16, 1, 0.3, 1) 90ms both",
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.42em",
              paddingLeft: "0.42em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.94)",
              background:
                "linear-gradient(100deg, rgba(255,255,255,0.55) 0%, #ffffff 42%, rgba(125,177,255,0.9) 58%, rgba(255,255,255,0.55) 100%)",
              backgroundSize: "220% 100%",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: "pl-loader-shimmer 2400ms linear infinite",
            }}
          >
            ATHENAX
          </span>

          <span
            aria-hidden="true"
            style={{
              position: "relative",
              display: "block",
              width: 184,
              height: 2,
              overflow: "hidden",
              borderRadius: 9999,
              background: "rgba(255,255,255,0.13)",
            }}
          >
            <span
              style={{
                display: "block",
                width: "100%",
                height: "100%",
                transformOrigin: "left center",
                background:
                  "linear-gradient(90deg, #0052ff 0%, #22d3ee 55%, #7db1ff 100%)",
                boxShadow: "0 0 14px rgba(34,211,238,0.55)",
                animation:
                  "pl-loader-bar 950ms cubic-bezier(0.16, 1, 0.3, 1) both",
              }}
            />
          </span>

          <span
            style={{
              minHeight: 12,
              fontFamily: "var(--font-geist-mono), monospace",
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.52)",
              opacity: mounted ? 1 : 0,
              transition: "opacity 300ms ease",
            }}
          >
            {mounted
              ? t({
                  el: "Φόρτωση δεδομένων πόλης",
                  en: "Loading city data",
                })
              : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
