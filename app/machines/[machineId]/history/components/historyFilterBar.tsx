import { FilterChipSelect } from "@/components/ui/filterChipSelect";
import { NEW_ENTRY_TYPES, historyEntryTypeMeta, type HistoryDateRange, type HistoryFilters } from "@/lib/types/historyEntry";
import { DEFAULT_HISTORY_FILTERS } from "../historyPaging";

interface HistoryFilterBarProps {
  filters: HistoryFilters;
  authors: { id: string; name: string }[];
  onChange: (filters: HistoryFilters) => void;
}

const typeOptions = [
  { value: "", label: "All types" },
  ...NEW_ENTRY_TYPES.map((type) => ({ value: type, label: historyEntryTypeMeta[type].label })),
];

const rangeOptions: { value: HistoryDateRange; label: string }[] = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "365d", label: "Last 12 months" },
  { value: "all", label: "All time" },
];

export const HistoryFilterBar = ({ filters, authors, onChange }: HistoryFilterBarProps) => (
  <div className="flex flex-wrap items-center gap-2">
    <FilterChipSelect
      label="Entry type"
      value={filters.type}
      options={typeOptions}
      isActive={filters.type !== DEFAULT_HISTORY_FILTERS.type}
      onChange={(type) => onChange({ ...filters, type: type as HistoryFilters["type"] })}
    />
    <FilterChipSelect
      label="Date range"
      value={filters.range}
      options={rangeOptions}
      isActive={filters.range !== DEFAULT_HISTORY_FILTERS.range}
      onChange={(range) => onChange({ ...filters, range: range as HistoryDateRange })}
    />
    <FilterChipSelect
      label="Author"
      value={filters.authorId}
      options={[{ value: "", label: "Author" }, ...authors.map((author) => ({ value: author.id, label: author.name }))]}
      isActive={filters.authorId !== DEFAULT_HISTORY_FILTERS.authorId}
      onChange={(authorId) => onChange({ ...filters, authorId })}
    />
  </div>
);
