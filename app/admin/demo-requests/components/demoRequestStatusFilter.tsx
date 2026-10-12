import { Tag } from "@/components/ui/tag";
import type { DemoRequestStatus } from "@/lib/types/demoRequest";
import { STATUS_OPTIONS } from "../demoRequestLabels";

interface DemoRequestStatusFilterProps {
  value: DemoRequestStatus | "";
  onChange: (status: DemoRequestStatus | "") => void;
}

export const DemoRequestStatusFilter = ({ value, onChange }: DemoRequestStatusFilterProps) => {
  const chips = [{ value: "" as const, label: "All", tone: "default" as const }, ...STATUS_OPTIONS];
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by status">
      {chips.map((chip) => {
        const isSelected = chip.value === value;
        return (
          <button key={chip.value || "all"} type="button" aria-pressed={isSelected} onClick={() => onChange(chip.value)}>
            <Tag tone={isSelected ? "primary" : chip.tone} className={isSelected ? "ring-1 ring-primary" : ""}>
              {chip.label}
            </Tag>
          </button>
        );
      })}
    </div>
  );
};
