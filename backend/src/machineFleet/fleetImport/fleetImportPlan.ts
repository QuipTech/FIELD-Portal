import { HttpException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { resolveNewMachineGroup } from '../../machineGroups/access/newMachineGroupRule';
import { Registrar } from '../registerMachine';
import * as importRepository from './fleetImport.repository';
import { ImportedMachineDto } from './dto/importFleetDto';
import {
  CheckedRow,
  checkRows,
  toGroupKey,
  toSerialKey,
} from './fleetImportRules';

export interface FleetImportRowResult {
  // 1-based, as the person counts data rows in their file.
  row: number;
  serialNumber: string | null;
  // Empty when the row can be imported.
  errors: string[];
  // The group it goes in; isNew when the import creates it.
  group: { name: string; isNew: boolean } | null;
}

export interface PlannedMachine extends CheckedRow {
  modelId: string;
  manufacturerId: string;
  // An existing group's id, or the key of one the import creates.
  groupId: string | null;
  newGroupKey: string | null;
}

export interface FleetImportPlan {
  rows: FleetImportRowResult[];
  machines: PlannedMachine[];
  // Groups to create, by lowercase key, with the name as first written.
  newGroups: Map<string, string>;
}

const NEW_GROUP_PREFIX = 'new:';

// Checks every row against the Machine library, the organisation's
// serials and groups, and who is importing. Saves nothing.
export const planFleetImport = async (
  client: PoolClient,
  registrar: Registrar,
  rows: ImportedMachineDto[],
): Promise<FleetImportPlan> => {
  const { checked, errors } = checkRows(rows);
  const valid = checked.filter((row): row is CheckedRow => row !== null);
  const models = await importRepository.findModelsByKey(
    client,
    registrar.tenantId,
    Array.from(new Set(valid.map((row) => row.modelKey))),
  );
  const registered = await importRepository.findRegisteredSerials(
    client,
    registrar.tenantId,
    valid.map((row) => row.serialNumber),
  );
  const groupNames = valid.flatMap((row) => (row.group ? [row.group] : []));
  const groups = await importRepository.findGroupIdsByName(
    client,
    registrar.tenantId,
    groupNames,
  );
  const newGroups = new Map<string, string>();
  const machines: PlannedMachine[] = [];
  const results = rows.map((source, index): FleetImportRowResult => {
    const row = checked[index];
    const rowErrors = errors[index];
    const result = {
      row: index + 1,
      serialNumber: source.serialNumber ?? null,
      errors: rowErrors,
      group: null as FleetImportRowResult['group'],
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
    const groupKey = row.group ? toGroupKey(row.group) : null;
    const existingGroupId = groupKey ? groups.get(groupKey) : undefined;
    const unknownGroup = !!row.group && !existingGroupId && !registrar.isAdmin;
    if (unknownGroup) {
      rowErrors.push(`There's no machine group called "${row.group}".`);
    }
    let groupId: string | null = null;
    try {
      groupId = resolveNewMachineGroup({
        ...registrar,
        groupId:
          existingGroupId ?? (groupKey ? NEW_GROUP_PREFIX + groupKey : null),
      });
    } catch (error) {
      if (!(error instanceof HttpException)) throw error;
      if (!unknownGroup) rowErrors.push(error.message);
    }
    if (rowErrors.length || !model) return result;
    const isNew = !!groupId?.startsWith(NEW_GROUP_PREFIX);
    if (isNew && groupKey && !newGroups.has(groupKey)) {
      newGroups.set(groupKey, row.group!);
    }
    machines.push({
      ...row,
      ...model,
      groupId: isNew ? null : groupId,
      newGroupKey: isNew ? groupKey : null,
    });
    return {
      ...result,
      group: row.group
        ? { name: newGroups.get(groupKey!) ?? row.group, isNew }
        : null,
    };
  });
  return { rows: results, machines, newGroups };
};
