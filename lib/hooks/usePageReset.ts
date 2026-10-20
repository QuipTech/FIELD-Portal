"use client";

import { useEffect, useState, type DependencyList } from "react";

// The current page of a paged list, back to 1 whenever `resetDeps` (its
// filters or search) change, so a narrower result never opens on an empty page.
export const usePageReset = (resetDeps: DependencyList) => {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), resetDeps);
  return [page, setPage] as const;
};
