import { Input } from "@/components/ui/input";
import { CASE_PRIORITIES } from "@/lib/format/caseLabels";
import type { CasePriority, CaseStatus, CaseStatusFilter, SupportCaseFilters, SupportCaseOptions } from "@/lib/types/supportCase";
import { FilterChipSelect } from "@/components/ui/filterChipSelect";

interface CasesFilterBarProps {
  filters: SupportCaseFilters;
  statusCounts: Record<CaseStatus, number> | null;
  options: SupportCaseOptions | null;
  onChange: <K extends keyof SupportCaseFilters>(key: K, value: SupportCaseFilters[K]) => void;
}

const withCount = (label: string, count: number | undefined) => (count === undefined ? label : `${label} · ${count}`);

export const CasesFilterBar = ({ filters, statusCounts, options, onChange }: CasesFilterBarProps) => {
  const counts = statusCounts ?? undefined;
  const statusOptions: { value: CaseStatusFilter; label: string }[] = [
    { value: "active", label: withCount("Open", counts && counts.open + counts.in_progress) },
    { value: "in_progress", label: withCount("In progress", counts?.in_progress) },
    { value: "resolved", label: withCount("Resolved", counts?.resolved) },
    { value: "all", label: "All cases" },
  ];
  const assigneeOptions = [
    { value: "", label: "Assignee" },
    { value: "unassigned", label: "Unassigned" },
    ...(options?.assignees.map((person) => ({ value: person.id, label: person.name })) ?? []),
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
      <FilterChipSelect
        label="Assignee"
        value={filters.assignee}
        options={assigneeOptions}
        onChange={(value) => onChange("assignee", value)}
        isActive={filters.assignee !== ""}
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
