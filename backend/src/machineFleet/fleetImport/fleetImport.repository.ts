import { PoolClient } from 'pg';
import { toModelKey } from './fleetImportRules';

// Lookups for the fleet CSV import. Every query filters on tenant_id
// itself as well as relying on RLS.

export interface ImportModel {
  modelId: string;
  manufacturerId: string;
}

// Models by "make|model" key (lowercase), from the shared Machine library
// and the organisation's own models; its own wins on a name clash.
export const findModelsByKey = async (
  client: PoolClient,
  tenantId: string,
  keys: string[],
): Promise<Map<string, ImportModel>> => {
  const result = await client.query<{
    make: string;
    model: string;
    id: string;
    manufacturer_id: string;
  }>(
    `SELECT DISTINCT ON (lower(mf.name), lower(mm.name))
            mf.name AS make, mm.name AS model, mm.id, mm.manufacturer_id
     FROM machine_models mm
     JOIN machine_manufacturers mf ON mf.id = mm.manufacturer_id
     WHERE mm.deleted_at IS NULL AND mf.deleted_at IS NULL
       AND (mm.tenant_id IS NULL OR mm.tenant_id = $1)
       AND lower(mf.name) || '|' || lower(mm.name) = ANY($2::text[])
     ORDER BY lower(mf.name), lower(mm.name), mm.tenant_id NULLS LAST`,
    [tenantId, keys],
  );
  return new Map(
    result.rows.map((row) => [
      toModelKey(row.make, row.model),
      { modelId: row.id, manufacturerId: row.manufacturer_id },
    ]),
  );
};

// Serials (lowercase) among `serials` already registered in the
// organisation, including on machines the importer can't see.
export const findRegisteredSerials = async (
  client: PoolClient,
  tenantId: string,
  serials: string[],
): Promise<Set<string>> => {
  const result = await client.query<{ serial: string }>(
    `SELECT lower(serial_number) AS serial FROM machines
     WHERE tenant_id = $1 AND lower(serial_number) = ANY($2::text[])`,
    [tenantId, serials.map((serial) => serial.toLowerCase())],
  );
  return new Set(result.rows.map((row) => row.serial));
};
