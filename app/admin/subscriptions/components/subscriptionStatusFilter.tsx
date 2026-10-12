import { Tag } from "@/components/ui/tag";
import type { SubscriptionStatus } from "@/lib/types/tenantSubscription";
import { STATUS_OPTIONS } from "../subscriptionLabels";

interface SubscriptionStatusFilterProps {
  value: SubscriptionStatus | "";
  counts: Record<SubscriptionStatus, number> | null;
  onChange: (status: SubscriptionStatus | "") => void;
}

export const SubscriptionStatusFilter = ({ value, counts, onChange }: SubscriptionStatusFilterProps) => {
  const chips = [{ value: "" as const, label: "All", tone: "default" as const }, ...STATUS_OPTIONS];
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by status">
      {chips.map((chip) => {
        const isSelected = chip.value === value;
        const count = chip.value && counts ? counts[chip.value] : null;
        if (chip.value === "not_set_up" && !count && !isSelected) return null;
        return (
          <button
            key={chip.value || "all"}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange(chip.value)}
          >
            <Tag tone={isSelected ? "primary" : chip.tone} className={isSelected ? "ring-1 ring-primary" : ""}>
              {chip.label}
              {count !== null ? ` · ${count}` : ""}
            </Tag>
          </button>
        );
      })}
    </div>
  );
};
