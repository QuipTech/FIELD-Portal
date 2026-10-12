import { Icon } from "@/components/icons/icon";
import { NEW_ENTRY_TYPES, historyEntryTypeMeta, type HistoryEntryType } from "@/lib/types/historyEntry";

interface EntryTypeSegmentedControlProps {
  value: HistoryEntryType | null;
  onChange: (type: HistoryEntryType) => void;
  hasError: boolean;
}

export const EntryTypeSegmentedControl = ({ value, onChange, hasError }: EntryTypeSegmentedControlProps) => (
  <div
    role="radiogroup"
    aria-label="Entry type"
    aria-invalid={hasError || undefined}
    className={`flex w-fit rounded-lg border p-0.5 ${hasError ? "border-dangerBorder" : "border-borderGrayStrong"}`}
  >
    {NEW_ENTRY_TYPES.map((type) => {
      const meta = historyEntryTypeMeta[type];
      const isSelected = value === type;
      return (
        <button
          key={type}
          type="button"
          role="radio"
          aria-checked={isSelected}
          onClick={() => onChange(type)}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
            isSelected ? "bg-primary text-white" : "text-bodyGray hover:bg-fillGray"
          }`}
        >
          <Icon name={meta.icon} className={`h-3.5 w-3.5 ${isSelected ? "stroke-white" : ""}`} />
          {meta.label}
        </button>
      );
    })}
  </div>
);
