// One CSV row as POST /machines/import takes it; blank cells are left out.
export interface ImportedMachine {
  serialNumber?: string;
  make?: string;
  model?: string;
  plantId?: string;
  site?: string;
  operatingHours?: string;
  status?: string;
}

export type ImportedMachineField = keyof ImportedMachine;

export interface FleetImportRowResult {
  // 1-based data row.
  row: number;
  serialNumber: string | null;
  // Empty when the row can be imported.
  errors: string[];
}

export interface FleetImportResult {
  dryRun: boolean;
  // 0 for a dry run.
  imported: number;
  rows: FleetImportRowResult[];
}
