import { Icon } from "@/components/icons/icon";
import { toneTagClasses } from "@/components/ui/tone";

interface FilterChipOption {
  value: string;
  label: string;
}

interface FilterChipSelectProps {
  label: string;
  value: string;
  options: FilterChipOption[];
  onChange: (value: string) => void;
  // Highlighted when it narrows the list.
  isActive?: boolean;
  className?: string;
}

// A native select styled as a filter chip, so keyboard and screen-reader
// behaviour come for free.
export const FilterChipSelect = ({
  label,
  value,
  options,
  onChange,
  isActive = false,
  className = "",
}: FilterChipSelectProps) => {
  const toneClasses = toneTagClasses[isActive ? "amber" : "default"];

  return (
    <label className={`relative inline-flex w-fit items-center rounded-md border text-xs ${toneClasses} ${className}`}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="max-w-full cursor-pointer appearance-none truncate bg-transparent py-1 pl-2.5 pr-7 outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Icon name="chevd" className="pointer-events-none absolute right-2 h-3.5 w-3.5" />
    </label>
  );
};
