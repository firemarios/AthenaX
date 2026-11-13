"use client";

import { useEffect } from "react";

const SELECTOR = "[data-reveal], [data-reveal-group]";

export function ScrollReveal() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targets = new Set<Element>();

    const reveal = (element: Element) => {
      element.classList.add("is-visible");
    };

    const collect = (root: ParentNode) => {
      root.querySelectorAll(SELECTOR).forEach((element) => targets.add(element));
    };

    collect(document);

    if (reduced) {
      targets.forEach(reveal);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          reveal(entry.target);
          observer.unobserve(entry.target);
          targets.delete(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );

    targets.forEach((element) => observer.observe(element));

    const mutation = new MutationObserver((mutations) => {
      for (const record of mutations) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches(SELECTOR)) {
            observer.observe(node);
            targets.add(node);
          }
          node.querySelectorAll(SELECTOR).forEach((element) => {
            observer.observe(element);
            targets.add(element);
          });
        }
      }
    });

    mutation.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutation.disconnect();
    };
  }, []);

  return null;
}
