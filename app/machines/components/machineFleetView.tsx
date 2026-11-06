"use client";

import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { Pagination } from "@/components/ui/pagination";
import { useMyMachineAccess } from "@/lib/hooks/useMyMachineAccess";
import type { AccessibleGroup, MachineAccessMode } from "@/lib/types/machineGroup";
import type { MachineFleetFilters } from "@/lib/types/machineFleet";
import { useMachineFleet } from "../useMachineFleet";
import { FeaturedDownMachineCard } from "./featuredDownMachineCard";
import { MachinesFilterCard, type FilterOption } from "./machinesFilterCard";
import { MachinesTable } from "./machinesTable";

interface MachineFleetViewProps {
  search: string;
  reloadToken: number;
}

const SOURCE_OPTIONS: FilterOption[] = [
  { value: "own", label: "My organisation" },
  { value: "shared", label: "Shared with me" },
];

// Source only means something to someone who also sees their own
// organisation's machines; Group only lists their shared groups.
const toSourceOptions = (mode: MachineAccessMode) => (mode === "all" ? SOURCE_OPTIONS : null);
const toGroupOptions = (groups: AccessibleGroup[]) =>
  groups.length ? groups.map((group) => ({ value: group.id, label: group.name })) : null;

const toEmptyMessage = (search: string, filters: MachineFleetFilters, mode: MachineAccessMode) => {
  if (search.trim()) return `No machines match “${search.trim()}”`;
  if (Object.values(filters).some(Boolean)) return "No machines match these filters.";
  if (mode === "groups_only") return "No machines have been shared with you yet. Contact your admin.";
  return "No machines registered yet. Add your first with Add machine.";
};

export const MachineFleetView = ({ search, reloadToken }: MachineFleetViewProps) => {
  const { filters, updateFilter, clearFilters, fleet, debouncedSearch, page, setPage } = useMachineFleet(search, reloadToken);
  const { machineAccessMode, accessibleGroups } = useMyMachineAccess(reloadToken);
  const data = fleet.data;

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
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <MachinesTable
            machines={data.items}
            emptyMessage={toEmptyMessage(debouncedSearch, filters, machineAccessMode)}
            onChanged={fleet.reload}
          />
          <Pagination page={page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </div>
        <MachinesFilterCard
          filters={filters}
          facets={data.facets}
          total={data.total}
          sourceOptions={toSourceOptions(machineAccessMode)}
          groupOptions={toGroupOptions(accessibleGroups)}
          onChange={updateFilter}
          onClear={clearFilters}
        />
      </div>
    </>
  );
};
