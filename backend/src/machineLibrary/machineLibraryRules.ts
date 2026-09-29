import { NotFoundException } from '@nestjs/common';
import { MachineModelRow, ModelTreeRow } from './types/machineLibraryRows';
import {
  MachineModelSummary,
  ModelSystem,
  ModelSystemTree,
} from './types/machineLibraryResponse';
import { ImportedSystemDto } from './dto/importModelTreeDto';

export const MODEL_NOT_FOUND_MESSAGE = 'Machine model not found.';
export const SYSTEM_NOT_FOUND_MESSAGE = 'System not found.';
export const COMPONENT_NOT_FOUND_MESSAGE = 'Component not found.';

export const toMachineModelSummary = (
  row: MachineModelRow,
): MachineModelSummary => ({
  id: row.id,
  manufacturerName: row.manufacturer_name,
  name: row.name,
  displayName: `${row.manufacturer_name} ${row.name}`,
  category: row.product_family,
  systemsCount: Number(row.systems_count),
  assetsCount: Number(row.assets_count),
});

// Folds the flat system × component join back into a tree, keeping the
// order the rows arrive in.
export const buildSystemTree = (
  modelId: string,
  rows: ModelTreeRow[],
): ModelSystemTree => {
  const systemsById = new Map<string, ModelSystem>();
  for (const row of rows) {
    const system = systemsById.get(row.system_id) ?? {
      id: row.system_id,
      name: row.system_name,
      componentCount: 0,
      components: [],
    };
    if (row.component_id && row.component_name) {
      system.components.push({
        id: row.component_id,
        name: row.component_name,
      });
      system.componentCount = system.components.length;
    }
    systemsById.set(row.system_id, system);
  }
  return { modelId, systems: [...systemsById.values()] };
};

const dedupeNames = (names: string[]): string[] => {
  const seen = new Set<string>();
  return names.filter((name) => {
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// Systems named twice in one import (any case) are combined, and repeated
// component names dropped, so the import can't collide with itself.
export const normalizeImportedSystems = (
  systems: Pick<ImportedSystemDto, 'name' | 'components'>[],
): { name: string; components: string[] }[] => {
  const systemsByKey = new Map<
    string,
    { name: string; components: string[] }
  >();
  for (const system of systems) {
    const key = system.name.toLowerCase();
    const existing = systemsByKey.get(key);
    const components = [
      ...(existing?.components ?? []),
      ...(system.components ?? []),
    ];
    systemsByKey.set(key, { name: existing?.name ?? system.name, components });
  }
  return [...systemsByKey.values()].map((system) => ({
    ...system,
    components: dedupeNames(system.components),
  }));
};

export const assertFound = <T>(value: T | undefined, message: string): T => {
  if (value === undefined) throw new NotFoundException(message);
  return value;
};
