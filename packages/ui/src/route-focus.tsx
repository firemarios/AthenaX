"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "./providers";

export function RouteFocus() {
  const pathname = usePathname();
  const { t } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;
  const first = useRef(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const main = document.getElementById("main-content");
    if (!main) return;

    const timer = window.setTimeout(() => {
      const heading = main.querySelector<HTMLElement>("h1");
      const target = heading ?? main;
      if (!target.hasAttribute("tabindex")) {
        target.setAttribute("tabindex", "-1");
      }
      target.style.outline = "none";
      target.focus({ preventScroll: false });
      setMessage(
        heading?.textContent?.trim() ||
          tRef.current({ el: "Η σελίδα φορτώθηκε", en: "Page loaded" }),
      );
    }, 80);

    return () => window.clearTimeout(timer);
  }, [pathname]);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}
