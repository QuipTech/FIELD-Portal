"use client";

import { useEffect, useState } from "react";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { useCaseEvents } from "@/lib/hooks/useCaseEvents";
import { usePermissions } from "@/lib/auth/usePermissions";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { getAdminCaseStatsRequest, listAdminCasesRequest } from "@/lib/api/adminSupportCasesApi";
import { listAdminOrganisationsRequest } from "@/lib/api/adminUsersApi";
import type { AdminCaseFilters } from "@/lib/types/adminSupportCase";

export const QUEUE_PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

const INITIAL_FILTERS: AdminCaseFilters = { tab: "unassigned", company: "", priority: "", status: "", search: "" };

// The support queue (A13). Any case change the API pushes to this user's
// queue rooms reloads the page and the stat cards, so they stay live.
export const useAdminCaseQueue = () => {
  const { isLoaded, can } = usePermissions();
  const isAdmin = can(PERMISSIONS.managePlatform);
  const [filters, setFilters] = useState<AdminCaseFilters>(INITIAL_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const cases = useApiResource(
    (token) => listAdminCasesRequest(token, { ...filters, search: debouncedSearch }, page, QUEUE_PAGE_SIZE),
    [filters.tab, filters.company, filters.priority, filters.status, debouncedSearch, page],
    "Couldn't load the support queue. Please try again.",
  );
  const stats = useApiResource(getAdminCaseStatsRequest, [], "Couldn't load the queue totals.");
  // The organisation filter is the admin's; a Support Agent only has their own cases.
  const organisations = useApiResource(
    (token) => (isAdmin ? listAdminOrganisationsRequest(token) : Promise.resolve([])),
    [isAdmin],
    "Couldn't load organisations.",
  );

  // Unassigned cases are the admin's to hand out; an agent starts on theirs.
  useEffect(() => {
    if (isLoaded && !isAdmin) setFilters((current) => (current.tab === "unassigned" ? { ...current, tab: "mine" } : current));
  }, [isLoaded, isAdmin]);

  useCaseEvents({
    onCaseUpdated: () => {
      cases.reload();
      stats.reload();
    },
  });

  const updateFilter = <K extends keyof AdminCaseFilters>(key: K, value: AdminCaseFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  return { isAdmin, filters, updateFilter, page, setPage, cases, stats, organisations: organisations.data ?? [] };
};
