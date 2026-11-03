import { SelectInput } from "@/components/ui/selectInput";
import type { ImportedMachineField } from "@/lib/types/fleetImport";
import { FLEET_IMPORT_FIELDS, type FleetColumnMapping } from "./fleetImportColumns";

interface FleetImportColumnMappingProps {
  headers: string[];
  mapping: FleetColumnMapping;
  onChange: (field: ImportedMachineField, columnIndex: number | null) => void;
}

const NOT_IN_FILE = "";

// Which of the file's columns holds each machine field (guessed from the
// headers, changeable).
export const FleetImportColumnMapping = ({ headers, mapping, onChange }: FleetImportColumnMappingProps) => (
  <div className="flex flex-col divide-y divide-borderGray rounded-xl border border-borderGray">
    {FLEET_IMPORT_FIELDS.map(({ field, label, isRequired }) => (
      <div key={field} className="flex items-center gap-3 px-3.5 py-2">
        <span className="w-32 flex-none text-sm text-ink">
          {label}
          {isRequired && <span className="text-danger"> *</span>}
        </span>
        <div className="min-w-0 flex-1">
          <SelectInput
            aria-label={`Column for ${label}`}
            value={mapping[field] === null ? NOT_IN_FILE : String(mapping[field])}
            onChange={(event) => onChange(field, event.target.value === NOT_IN_FILE ? null : Number(event.target.value))}
          >
            <option value={NOT_IN_FILE}>{isRequired ? "Choose a column" : "Not in the file"}</option>
            {headers.map((header, index) => (
              <option key={index} value={index}>
                {header || `Column ${index + 1}`}
              </option>
            ))}
          </SelectInput>
        </div>
      </div>
    ))}
  </div>
);
