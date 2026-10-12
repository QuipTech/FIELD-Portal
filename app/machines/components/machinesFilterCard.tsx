import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { FilterChipSelect } from "@/components/ui/filterChipSelect";
import { OPERATING_STATUS_OPTIONS } from "@/lib/format/machineStatus";
import type { MachineFleetFilters, MachineFleetList } from "@/lib/types/machineFleet";

interface MachinesFilterCardProps {
  filters: MachineFleetFilters;
  facets: MachineFleetList["facets"] | null;
  total: number | null;
  onChange: (key: keyof MachineFleetFilters, value: string) => void;
  onClear: () => void;
}

interface FilterGroup {
  key: keyof MachineFleetFilters;
  label: string;
  anyLabel: string;
  options: { value: string; label: string }[];
}

// A chosen filter shows as a removable chip; the rest are dropdowns.
export const MachinesFilterCard = ({ filters, facets, total, onChange, onClear }: MachinesFilterCardProps) => {
  const groups: FilterGroup[] = [
    { key: "site", label: "Site", anyLabel: "All sites", options: (facets?.sites ?? []).map((site) => ({ value: site, label: site })) },
    { key: "make", label: "Make", anyLabel: "All makes", options: (facets?.makes ?? []).map((make) => ({ value: make.id, label: make.name })) },
    { key: "status", label: "Status", anyLabel: "Any status", options: OPERATING_STATUS_OPTIONS },
    { key: "machineClass", label: "Class", anyLabel: "Any class", options: (facets?.classes ?? []).map((name) => ({ value: name, label: name })) },
  ];
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="flex w-[200px] flex-none flex-col gap-3">
      <div className="flex flex-col gap-3 rounded-xl border border-borderGray bg-surface p-3.5">
        <div className="flex items-center">
          <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">Filters</span>
          <Icon name="filter" className="ml-auto h-3.5 w-3.5 stroke-mutedGray" />
        </div>
        {groups.map((group) => {
          const value = filters[group.key];
          const selected = group.options.find((option) => option.value === value);
          return (
            <div key={group.key} className="flex flex-col gap-1.5">
              <span className="text-xs uppercase tracking-wide text-mutedGray">{group.label}</span>
              {selected ? (
                <Tag tone="primary" className="w-fit max-w-full">
                  <span className="truncate">{selected.label}</span>
                  <button type="button" aria-label={`Clear ${group.label.toLowerCase()} filter`} onClick={() => onChange(group.key, "")}>
                    <Icon name="x" className="h-3.5 w-3.5" />
                  </button>
                </Tag>
              ) : (
                <FilterChipSelect
                  label={group.label}
                  value=""
                  options={[{ value: "", label: group.anyLabel }, ...group.options]}
                  onChange={(next) => onChange(group.key, next)}
                  className="max-w-full"
                />
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={onClear}
          disabled={!hasFilters}
          className="w-full rounded-lg py-1.5 text-center text-[13px] text-mutedGray hover:bg-fillGray disabled:opacity-50 disabled:hover:bg-transparent"
        >
          Clear filters
        </button>
      </div>
      {total !== null && (
        <span className="text-center text-xs text-mutedGray">
          {total.toLocaleString()} {total === 1 ? "result" : "results"}
        </span>
      )}
    </div>
  );
};
