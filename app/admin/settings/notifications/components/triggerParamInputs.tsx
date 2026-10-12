import { Input } from "@/components/ui/input";
import type { TriggerParamField, TriggerParams } from "@/lib/types/notificationSettings";

interface TriggerParamInputsProps {
  fields: TriggerParamField[];
  values: TriggerParams;
  onChange: (key: string, value: TriggerParams[string]) => void;
}

const labelClasses = "text-xs font-medium uppercase tracking-wide text-mutedGray";
const selectClasses = "h-10 rounded-lg border border-borderGrayStrong bg-surface px-3 text-[15px] text-ink";

// The settings of one trigger type, as described by the backend catalog.
export const TriggerParamInputs = ({ fields, values, onChange }: TriggerParamInputsProps) => {
  return (
    <>
      {fields.map((field) => (
        <div key={field.key} className="flex flex-col gap-1.5">
          <span className={labelClasses}>{field.label}</span>
          {field.kind === "number" && (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={field.min}
                max={field.max}
                value={String(values[field.key] ?? field.default)}
                onChange={(event) => onChange(field.key, Number(event.target.value))}
                className="w-32"
              />
              <span className="text-sm text-mutedGray">{field.unit}</span>
            </div>
          )}
          {field.kind === "select" && (
            <select
              value={String(values[field.key] ?? field.default)}
              onChange={(event) => onChange(field.key, event.target.value)}
              className={selectClasses}
            >
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
          {field.kind === "multiSelect" && (
            <div className="flex flex-wrap gap-3">
              {field.options.map((option) => {
                const selected = (values[field.key] as string[] | undefined) ?? field.default;
                return (
                  <label key={option.value} className="flex items-center gap-1.5 text-sm text-bodyGray">
                    <input
                      type="checkbox"
                      checked={selected.includes(option.value)}
                      onChange={(event) =>
                        onChange(
                          field.key,
                          event.target.checked
                            ? [...selected, option.value]
                            : selected.filter((value) => value !== option.value),
                        )
                      }
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </>
  );
};
