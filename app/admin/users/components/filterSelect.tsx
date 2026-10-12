import { Icon } from "@/components/icons/icon";

interface FilterSelectOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  // Shown as the first option, which clears the filter ("Role", "Organisation").
  label: string;
  value: string;
  options: FilterSelectOption[];
  onChange: (value: string) => void;
}

// A native select styled as the directory's filter button, so keyboard
// and screen-reader behaviour come for free.
export const FilterSelect = ({ label, value, options, onChange }: FilterSelectProps) => {
  const isActive = value !== "";
  return (
    <label
      className={`relative flex h-10 items-center rounded-xl border bg-surface text-sm font-medium hover:bg-slate-50 ${
        isActive ? "border-primaryBorder text-primary" : "border-slate-200 text-slate-700"
      }`}
    >
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-full max-w-[220px] cursor-pointer appearance-none truncate bg-transparent pl-3.5 pr-8 outline-none"
      >
        <option value="">{isActive ? `All — ${label.toLowerCase()}` : label}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Icon name="chevd" className="pointer-events-none absolute right-3 h-3.5 w-3.5" />
    </label>
  );
};
