import type { ImportedMachine, ImportedMachineField } from "@/lib/types/fleetImport";

export interface FleetImportField {
  field: ImportedMachineField;
  label: string;
  isRequired: boolean;
  // Header names it is matched to, after lower-casing and dropping spaces,
  // underscores and dashes.
  aliases: string[];
}

// In the order of the template's columns.
export const FLEET_IMPORT_FIELDS: FleetImportField[] = [
  { field: "serialNumber", label: "Serial number", isRequired: true, aliases: ["serialnumber", "serial", "serialno", "sn"] },
  { field: "make", label: "Make", isRequired: true, aliases: ["make", "manufacturer", "brand"] },
  { field: "model", label: "Model", isRequired: true, aliases: ["model"] },
  { field: "plantId", label: "Plant ID", isRequired: false, aliases: ["plantid", "assetnumber", "assetno", "asset", "assetid"] },
  { field: "site", label: "Site", isRequired: false, aliases: ["site", "location"] },
  { field: "operatingHours", label: "Hours", isRequired: false, aliases: ["operatinghours", "hours", "hourmeter", "smu"] },
  { field: "status", label: "Status", isRequired: false, aliases: ["status"] },
];

// Each field's column index in the file; null leaves it out.
export type FleetColumnMapping = Record<ImportedMachineField, number | null>;

const normaliseHeader = (header: string) => header.toLowerCase().replace(/[\s_-]+/g, "");

export const guessColumnMapping = (headers: string[]): FleetColumnMapping => {
  const normalised = headers.map(normaliseHeader);
  const mapping = {} as FleetColumnMapping;
  FLEET_IMPORT_FIELDS.forEach(({ field, aliases }) => {
    const index = normalised.findIndex((header) => aliases.includes(header));
    mapping[field] = index === -1 ? null : index;
  });
  return mapping;
};

export const hasRequiredColumns = (mapping: FleetColumnMapping) =>
  FLEET_IMPORT_FIELDS.every(({ field, isRequired }) => !isRequired || mapping[field] !== null);

// The rows as the API takes them; blank cells are left out.
export const toImportedMachines = (dataRows: string[][], mapping: FleetColumnMapping): ImportedMachine[] =>
  dataRows.map((cells) => {
    const machine: ImportedMachine = {};
    FLEET_IMPORT_FIELDS.forEach(({ field }) => {
      const index = mapping[field];
      const value = index === null ? "" : (cells[index] ?? "").trim();
      if (value) machine[field] = value;
    });
    return machine;
  });
