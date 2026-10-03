"use client";

import { useCallback } from "react";

/** Keep the last seat row reachable when labels or user text scaling enlarge the fixed bar. */
export function useSelectionBarSpace() {
  return useCallback((bar: HTMLElement | null) => {
    const page = bar?.closest<HTMLElement>(".seat-page");
    if (!bar || !page) return;
    const measure = () => page.style.setProperty("--selection-bar-height", `${bar.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => {
      observer.disconnect();
      page.style.removeProperty("--selection-bar-height");
    };
  }, []);
}
