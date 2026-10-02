import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { escapeLikePattern } from '../common/utils/escapeLikePattern';
import { AdminScope } from '../auth/adminScope/adminScope';
import { MachineModelRow } from './types/machineLibraryRows';

// The shared catalog plus the scoped organisation's own models; every model
// for the Owner (admin_list_machine_models, migration 0057).
export const listModels = async (
  databaseService: DatabaseService,
  scope: AdminScope,
  params: { search?: string; modelId?: string } = {},
): Promise<MachineModelRow[]> => {
  const result = await databaseService.query<MachineModelRow>(
    `SELECT * FROM admin_list_machine_models($1, $2, $3)`,
    [
      scope.tenantId,
      params.search ? escapeLikePattern(params.search) : null,
      params.modelId ?? null,
    ],
  );
  return result.rows;
};

// Reuses a live manufacturer with the same name (any case); revives a
// soft-deleted exact match rather than tripping its unique constraint.
export const findOrCreateManufacturer = async (
  client: PoolClient,
  name: string,
): Promise<string> => {
  const result = await client.query<{ id: string }>(
    `WITH existing AS (
       SELECT id FROM machine_manufacturers
       WHERE lower(name) = lower($1) AND deleted_at IS NULL
       LIMIT 1
     ), inserted AS (
       INSERT INTO machine_manufacturers (name)
       SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM existing)
       ON CONFLICT (name) DO UPDATE SET deleted_at = NULL
       RETURNING id
     )
     SELECT id FROM existing UNION ALL SELECT id FROM inserted`,
    [name],
  );
  return result.rows[0].id;
};

export const createModel = async (
  client: PoolClient,
  params: {
    // null adds it to the shared catalog.
    tenantId: string | null;
    manufacturerId: string;
    name: string;
    category?: string;
  },
): Promise<string> => {
  const result = await client.query<{ id: string }>(
    `INSERT INTO machine_models (tenant_id, manufacturer_id, name, product_family)
     VALUES ($1, $2, $3, NULLIF($4, ''))
     RETURNING id`,
    [
      params.tenantId,
      params.manufacturerId,
      params.name,
      params.category ?? null,
    ],
  );
  return result.rows[0].id;
};

// NULL leaves a field unchanged; category '' clears it. False when
// there's no such live model.
export const updateModel = async (
  client: PoolClient,
  params: {
    modelId: string;
    manufacturerId?: string;
    name?: string;
    category?: string;
  },
): Promise<boolean> => {
  const result = await client.query(
    `UPDATE machine_models
     SET manufacturer_id = COALESCE($2, manufacturer_id),
         name = COALESCE($3, name),
         product_family = CASE WHEN $4::varchar IS NULL THEN product_family
                               ELSE NULLIF($4, '') END
     WHERE id = $1 AND deleted_at IS NULL`,
    [
      params.modelId,
      params.manufacturerId ?? null,
      params.name ?? null,
      params.category ?? null,
    ],
  );
  return (result.rowCount ?? 0) > 0;
};

export const softDeleteModel = async (
  client: PoolClient,
  modelId: string,
): Promise<boolean> => {
  const result = await client.query(
    `UPDATE machine_models SET deleted_at = now()
     WHERE id = $1 AND deleted_at IS NULL`,
    [modelId],
  );
  return (result.rowCount ?? 0) > 0;
};

// Which organisation a live model belongs to: null for the shared catalog,
// undefined when there's no such model.
export const findModelTenantId = async (
  client: PoolClient,
  modelId: string,
): Promise<string | null | undefined> => {
  const result = await client.query<{ tenant_id: string | null }>(
    `SELECT tenant_id FROM machine_models WHERE id = $1 AND deleted_at IS NULL`,
    [modelId],
  );
  return result.rows.length ? result.rows[0].tenant_id : undefined;
};
