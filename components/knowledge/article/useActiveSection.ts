"use client";

import { useEffect, useState } from "react";

// The id of the section being read: the topmost one in the upper part of
// the scrolling article, as the reader scrolls.
export const useActiveSection = (sectionIds: string[], root: HTMLElement | null): string | null => {
  const [activeId, setActiveId] = useState<string | null>(sectionIds[0] ?? null);
  const idsKey = sectionIds.join(",");

  useEffect(() => {
    if (!root || sectionIds.length === 0 || typeof IntersectionObserver === "undefined") return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => (entry.isIntersecting ? visible.add(entry.target.id) : visible.delete(entry.target.id)));
        const first = sectionIds.find((id) => visible.has(id));
        if (first) setActiveId(first);
      },
      { root, rootMargin: "0px 0px -60% 0px" },
    );
    sectionIds.forEach((id) => {
      const element = root.querySelector(`#${CSS.escape(id)}`);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
    // idsKey stands for sectionIds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, root]);

  return activeId;
};
