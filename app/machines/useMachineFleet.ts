"use client";

import { useEffect, useState } from "react";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { listMachinesRequest } from "@/lib/api/machineFleetApi";
import type { MachineFleetFilters } from "@/lib/types/machineFleet";

const SEARCH_DEBOUNCE_MS = 300;

export const EMPTY_MACHINE_FILTERS: MachineFleetFilters = { site: "", make: "", status: "", machineClass: "" };

// The Machines list for the filter panel's choices and the top bar search.
// Bumping `reloadToken` (e.g. after adding a machine) loads it again.
export const useMachineFleet = (search: string, reloadToken: number) => {
  const [filters, setFilters] = useState<MachineFleetFilters>(EMPTY_MACHINE_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const fleet = useApiResource(
    (accessToken) => listMachinesRequest(accessToken, filters, debouncedSearch),
    [filters.site, filters.make, filters.status, filters.machineClass, debouncedSearch, reloadToken],
    "Couldn't load machines. Please try again.",
  );

  // Values come from the filter panel's own options, so they're valid.
  const updateFilter = (key: keyof MachineFleetFilters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }) as MachineFleetFilters);

  const clearFilters = () => setFilters(EMPTY_MACHINE_FILTERS);

  return { filters, updateFilter, clearFilters, fleet, debouncedSearch };
};
