"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { buildKnowledgeListHref, toListContext } from "@/lib/knowledge/knowledgeLinks";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { searchKnowledgeLibraryRequest } from "@/lib/api/knowledgeLibraryApi";
import type { KnowledgeLibraryFilters } from "@/lib/types/knowledgeLibrary";

const SEARCH_DEBOUNCE_MS = 350;

// The Knowledge screen's results for the search box, side nav and pills.
// `initialFilters` come from the URL (e.g. ?model=… from a machine page),
// and changes are written back to it.
export const useKnowledgeLibrary = (initialFilters: KnowledgeLibraryFilters) => {
  const [filters, setFilters] = useState<KnowledgeLibraryFilters>(initialFilters);
  const [debouncedSearch, setDebouncedSearch] = useState(initialFilters.search);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters.search]);

  // The filters live in the URL too, so Back from an article (or a reload)
  // shows the same results. replace(), so typing doesn't add history.
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const href = buildKnowledgeListHref(toListContext({ ...filters, search: debouncedSearch }));
    if (`${pathname}${window.location.search}` !== href) router.replace(href, { scroll: false });
    // router is stable; only the filters decide the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, filters.type, filters.make, filters.model]);

  const results = useApiResource(
    (accessToken) => searchKnowledgeLibraryRequest(accessToken, { ...filters, search: debouncedSearch }),
    [debouncedSearch, filters.type, filters.make, filters.model, filters.sort],
    "Couldn't search the knowledge library. Please try again.",
  );

  // Values come from the screen's own controls, so they're valid.
  const updateFilter = (key: keyof KnowledgeLibraryFilters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }) as KnowledgeLibraryFilters);

  return { filters, updateFilter, results, hasSearch: debouncedSearch.trim() !== "" };
};
