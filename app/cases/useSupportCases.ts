"use client";

import { useEffect, useState } from "react";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { useCaseEvents } from "@/lib/hooks/useCaseEvents";
import { listSupportCasesRequest } from "@/lib/api/supportCasesApi";
import type { SupportCaseFilters } from "@/lib/types/supportCase";

const SEARCH_DEBOUNCE_MS = 300;

const INITIAL_FILTERS: SupportCaseFilters = { status: "active", priority: "", search: "" };

// The organisation's cases for the current filters. Any case change in the
// organisation (pushed over the socket) reloads it, so it stays live.
export const useSupportCases = () => {
  const [filters, setFilters] = useState<SupportCaseFilters>(INITIAL_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const cases = useApiResource(
    (accessToken) => listSupportCasesRequest(accessToken, { ...filters, search: debouncedSearch }),
    [filters.status, filters.priority, debouncedSearch],
    "Couldn't load support cases. Please try again.",
  );

  useCaseEvents({ onCaseUpdated: cases.reload });

  const updateFilter = <K extends keyof SupportCaseFilters>(key: K, value: SupportCaseFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const isFiltered = filters.status !== "active" || filters.priority !== "" || debouncedSearch.trim() !== "";

  return { filters, updateFilter, isFiltered, cases };
};
