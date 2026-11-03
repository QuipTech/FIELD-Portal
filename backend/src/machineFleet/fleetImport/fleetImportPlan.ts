import { PoolClient } from 'pg';
import * as importRepository from './fleetImport.repository';
import { ImportedMachineDto } from './dto/importFleetDto';
import { CheckedRow, checkRows, toSerialKey } from './fleetImportRules';

export interface FleetImportRowResult {
  // 1-based, as the person counts data rows in their file.
  row: number;
  serialNumber: string | null;
  // Empty when the row can be imported.
  errors: string[];
}

export interface PlannedMachine extends CheckedRow {
  modelId: string;
  manufacturerId: string;
}

export interface FleetImportPlan {
  rows: FleetImportRowResult[];
  machines: PlannedMachine[];
}

// Checks every row against the Machine library and the organisation's
// serials. Saves nothing.
export const planFleetImport = async (
  client: PoolClient,
  tenantId: string,
  rows: ImportedMachineDto[],
): Promise<FleetImportPlan> => {
  const { checked, errors } = checkRows(rows);
  const valid = checked.filter((row): row is CheckedRow => row !== null);
  const models = await importRepository.findModelsByKey(
    client,
    tenantId,
    Array.from(new Set(valid.map((row) => row.modelKey))),
  );
  const registered = await importRepository.findRegisteredSerials(
    client,
    tenantId,
    valid.map((row) => row.serialNumber),
  );
  const machines: PlannedMachine[] = [];
  const results = rows.map((source, index): FleetImportRowResult => {
    const row = checked[index];
    const rowErrors = errors[index];
    const result = {
      row: index + 1,
      serialNumber: source.serialNumber ?? null,
      errors: rowErrors,
    };
    if (!row) return result;
    const model = models.get(row.modelKey);
    if (!model) {
      rowErrors.push(
        `${source.make} ${source.model} isn't in the Machine library.`,
      );
    }
    if (registered.has(toSerialKey(row.serialNumber))) {
      rowErrors.push(
        'This serial number is already registered in your organisation.',
      );
    }
    if (!rowErrors.length && model) machines.push({ ...row, ...model });
    return result;
  });
  return { rows: results, machines };
};
