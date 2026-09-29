import { Input } from "@/components/ui/input";
import { isHexColor } from "../brandingForm";

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

// A swatch (opens the system colour picker) beside the hex value.
export const ColorField = ({ label, value, onChange }: ColorFieldProps) => {
  return (
    <label className="flex flex-1 flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={isHexColor(value) ? value : "#000000"}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="h-7 w-7 flex-none cursor-pointer rounded-md border border-borderGrayStrong bg-transparent p-0"
        />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value.trim())}
          maxLength={7}
          className={`font-mono ${isHexColor(value) ? "" : "border-danger"}`}
        />
      </div>
    </label>
  );
};
