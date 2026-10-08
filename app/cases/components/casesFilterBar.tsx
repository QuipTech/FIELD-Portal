import { Input } from "@/components/ui/input";
import { FilterChipSelect } from "@/components/ui/filterChipSelect";
import { CASE_PRIORITIES, CUSTOMER_CASE_STATUS_LABELS } from "@/lib/format/caseLabels";
import type { CasePriority, CaseStatus, CaseStatusFilter, SupportCaseFilters } from "@/lib/types/supportCase";

interface CasesFilterBarProps {
  filters: SupportCaseFilters;
  statusCounts: Record<CaseStatus, number> | null;
  onChange: <K extends keyof SupportCaseFilters>(key: K, value: SupportCaseFilters[K]) => void;
}

const withCount = (label: string, count: number | undefined) => (count === undefined ? label : `${label} · ${count}`);

const LISTED_STATUSES: CaseStatus[] = ["new", "open", "waiting_on_customer", "resolved", "closed"];

export const CasesFilterBar = ({ filters, statusCounts, onChange }: CasesFilterBarProps) => {
  const counts = statusCounts ?? undefined;
  const activeCount = counts && counts.new + counts.open + counts.waiting_on_customer;
  const statusOptions: { value: CaseStatusFilter; label: string }[] = [
    { value: "active", label: withCount("Active", activeCount) },
    ...LISTED_STATUSES.map((status) => ({
      value: status,
      label: withCount(CUSTOMER_CASE_STATUS_LABELS[status], counts?.[status]),
    })),
    { value: "all", label: "All cases" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterChipSelect
        label="Status"
        value={filters.status}
        options={statusOptions}
        onChange={(value) => onChange("status", value as CaseStatusFilter)}
        isActive
      />
      <FilterChipSelect
        label="Priority"
        value={filters.priority}
        options={[{ value: "", label: "Priority" }, ...CASE_PRIORITIES]}
        onChange={(value) => onChange("priority", value as CasePriority | "")}
        isActive={filters.priority !== ""}
      />
      <Input
        icon="search"
        placeholder="Search cases"
        aria-label="Search cases"
        value={filters.search}
        onChange={(event) => onChange("search", event.target.value)}
        className="ml-auto w-52"
      />
    </div>
  );
};
