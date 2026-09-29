import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { ModelTreeRow } from './types/machineLibraryRows';

// Rows come back in display order: systems by sort_order, each system's
// components by sort_order.
export const listTreeRows = async (
  databaseService: DatabaseService,
  modelId: string,
): Promise<ModelTreeRow[]> => {
  const result = await databaseService.query<ModelTreeRow>(
    `SELECT s.id AS system_id, s.name AS system_name,
            c.id AS component_id, c.name AS component_name
     FROM model_systems s
     LEFT JOIN model_components c
       ON c.model_system_id = s.id AND c.deleted_at IS NULL
     WHERE s.machine_model_id = $1 AND s.deleted_at IS NULL
     ORDER BY s.sort_order, s.created_at, c.sort_order, c.created_at`,
    [modelId],
  );
  return result.rows;
};

// A duplicate live name raises a unique violation (23505).
export const insertSystem = async (
  client: PoolClient,
  params: { modelId: string; name: string },
): Promise<string> => {
  const result = await client.query<{ id: string }>(
    `INSERT INTO model_systems (machine_model_id, name, sort_order)
     VALUES ($1, $2, (SELECT COALESCE(max(sort_order), 0) + 1
                      FROM model_systems WHERE machine_model_id = $1))
     RETURNING id`,
    [params.modelId, params.name],
  );
  return result.rows[0].id;
};

// Like insertSystem, but a live system with the same name is reused.
export const findOrInsertSystem = async (
  client: PoolClient,
  params: { modelId: string; name: string },
): Promise<string> => {
  const result = await client.query<{ id: string }>(
    `WITH inserted AS (
       INSERT INTO model_systems (machine_model_id, name, sort_order)
       VALUES ($1, $2, (SELECT COALESCE(max(sort_order), 0) + 1
                        FROM model_systems WHERE machine_model_id = $1))
       ON CONFLICT (machine_model_id, lower(name)) WHERE deleted_at IS NULL
       DO NOTHING
       RETURNING id
     )
     SELECT id FROM inserted
     UNION ALL
     SELECT id FROM model_systems
     WHERE machine_model_id = $1 AND lower(name) = lower($2)
       AND deleted_at IS NULL
     LIMIT 1`,
    [params.modelId, params.name],
  );
  return result.rows[0].id;
};

// Resolves to the new component's id and its model's id, or undefined
// when the system isn't live. A duplicate live name raises a unique
// violation (23505).
export const insertComponent = async (
  client: PoolClient,
  params: { systemId: string; name: string },
): Promise<{ id: string; modelId: string } | undefined> => {
  const result = await client.query<{ id: string; model_id: string }>(
    `INSERT INTO model_components (model_system_id, name, sort_order)
     SELECT s.id, $2, (SELECT COALESCE(max(sort_order), 0) + 1
                       FROM model_components WHERE model_system_id = s.id)
     FROM model_systems s
     WHERE s.id = $1 AND s.deleted_at IS NULL
     RETURNING id, (SELECT machine_model_id FROM model_systems
                    WHERE id = model_system_id) AS model_id`,
    [params.systemId, params.name],
  );
  const row = result.rows[0];
  return row && { id: row.id, modelId: row.model_id };
};

// Adds the component unless the system already has one with that name.
export const insertComponentIfMissing = async (
  client: PoolClient,
  params: { systemId: string; name: string },
): Promise<void> => {
  await client.query(
    `INSERT INTO model_components (model_system_id, name, sort_order)
     VALUES ($1, $2, (SELECT COALESCE(max(sort_order), 0) + 1
                      FROM model_components WHERE model_system_id = $1))
     ON CONFLICT (model_system_id, lower(name)) WHERE deleted_at IS NULL
     DO NOTHING`,
    [params.systemId, params.name],
  );
};
