"use client";

import { useEffect, RefObject } from "react";

export function useReveal(ref: RefObject<HTMLElement | null>, delay = 0) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-visible");
      return;
    }

    el.setAttribute("data-reveal", "");
    if (delay) el.setAttribute("data-delay", String(delay));

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setTimeout(() => el.classList.add("is-visible"), delay);
        observer.unobserve(el);
      },
      { threshold: 0.07, rootMargin: "0px 0px -24px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, delay]);
}
