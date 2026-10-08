import { FilterChipSelect } from "@/components/ui/filterChipSelect";
import { CASE_PRIORITIES, CASE_STATUS_LABELS } from "@/lib/format/caseLabels";
import type { AdminCaseFilters } from "@/lib/types/adminSupportCase";
import type { AdminOrganisation } from "@/lib/types/adminUser";
import type { CasePriority, CaseStatus } from "@/lib/types/supportCase";

interface CaseQueueFiltersProps {
  filters: AdminCaseFilters;
  organisations: AdminOrganisation[];
  onChange: <K extends keyof AdminCaseFilters>(key: K, value: AdminCaseFilters[K]) => void;
}

const STATUS_OPTIONS = [
  { value: "", label: "Status" },
  ...Object.entries(CASE_STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

const PRIORITY_OPTIONS = [
  { value: "", label: "Priority" },
  ...CASE_PRIORITIES.map((option) => ({ value: option.value, label: option.value })),
];

// Company (the admin only — an agent's cases are their own), priority, status.
export const CaseQueueFilters = ({ filters, organisations, onChange }: CaseQueueFiltersProps) => (
  <div className="flex flex-none items-center gap-2 pb-2">
    {organisations.length > 0 && (
      <FilterChipSelect
        label="Company"
        value={filters.company}
        options={[{ value: "", label: "Company" }, ...organisations.map((org) => ({ value: org.id, label: org.name }))]}
        onChange={(value) => onChange("company", value)}
        isActive={filters.company !== ""}
      />
    )}
    <FilterChipSelect
      label="Priority"
      value={filters.priority}
      options={PRIORITY_OPTIONS}
      onChange={(value) => onChange("priority", value as CasePriority | "")}
      isActive={filters.priority !== ""}
    />
    <FilterChipSelect
      label="Status"
      value={filters.status}
      options={STATUS_OPTIONS}
      onChange={(value) => onChange("status", value as CaseStatus | "")}
      isActive={filters.status !== ""}
    />
  </div>
);
