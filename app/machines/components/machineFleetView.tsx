"use client";

import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { useMachineFleet } from "../useMachineFleet";
import { FeaturedDownMachineCard } from "./featuredDownMachineCard";
import { MachinesFilterCard } from "./machinesFilterCard";
import { MachinesTable } from "./machinesTable";

interface MachineFleetViewProps {
  search: string;
  reloadToken: number;
}

export const MachineFleetView = ({ search, reloadToken }: MachineFleetViewProps) => {
  const { filters, updateFilter, clearFilters, fleet, debouncedSearch } = useMachineFleet(search, reloadToken);
  const data = fleet.data;

  const emptyMessage = debouncedSearch.trim()
    ? `No machines match “${debouncedSearch.trim()}”`
    : Object.values(filters).some(Boolean)
      ? "No machines match these filters."
      : "No machines registered yet. Add your first with Add machine.";

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center text-mutedGray">
        {fleet.isLoading ? <LoadingSpinner size="md" /> : <p className="text-sm text-danger">{fleet.error}</p>}
      </div>
    );
  }

  return (
    <>
      {data.featuredDown && <FeaturedDownMachineCard featured={data.featuredDown} />}
      {fleet.error && <p className="text-sm text-danger">{fleet.error}</p>}
      <div className="flex min-h-0 flex-1 gap-3.5">
        <MachinesTable machines={data.items} emptyMessage={emptyMessage} />
        <MachinesFilterCard
          filters={filters}
          facets={data.facets}
          total={data.total}
          onChange={updateFilter}
          onClear={clearFilters}
        />
      </div>
    </>
  );
};
