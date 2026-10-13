"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Pixels of slack, so sub-pixel widths don't leave an arrow showing.
const EDGE_TOLERANCE_PX = 2;
// How far one arrow click moves: most of the visible width.
const SCROLL_STEP_RATIO = 0.8;

// For a sideways-scrolling row: whether there's more to either side, and a
// smooth scroll by roughly one view. Re-checks on scroll and resize.
export const useHorizontalOverflow = <T extends HTMLElement>() => {
  const ref = useRef<T>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const measure = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    setCanScrollLeft(element.scrollLeft > EDGE_TOLERANCE_PX);
    setCanScrollRight(element.scrollLeft + element.clientWidth < element.scrollWidth - EDGE_TOLERANCE_PX);
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", measure);
    };
  }, [measure]);

  const scrollByStep = (direction: -1 | 1) =>
    ref.current?.scrollBy({ left: direction * ref.current.clientWidth * SCROLL_STEP_RATIO, behavior: "smooth" });

  return { ref, canScrollLeft, canScrollRight, scrollByStep, measure };
};
