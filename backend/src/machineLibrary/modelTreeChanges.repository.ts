import { PoolClient } from 'pg';

// Renames and soft deletes. Each resolves to the owning model's id, or
// undefined when the system/component isn't live.

const firstModelId = (rows: { model_id: string }[]): string | undefined =>
  rows[0]?.model_id;

export const renameSystem = async (
  client: PoolClient,
  params: { systemId: string; name: string },
): Promise<string | undefined> => {
  const result = await client.query<{ model_id: string }>(
    `UPDATE model_systems SET name = $2
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING machine_model_id AS model_id`,
    [params.systemId, params.name],
  );
  return firstModelId(result.rows);
};

// Soft-deletes the system together with its components.
export const softDeleteSystem = async (
  client: PoolClient,
  systemId: string,
): Promise<string | undefined> => {
  const result = await client.query<{ model_id: string }>(
    `WITH deleted_components AS (
       UPDATE model_components SET deleted_at = now()
       WHERE model_system_id = $1 AND deleted_at IS NULL
     )
     UPDATE model_systems SET deleted_at = now()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING machine_model_id AS model_id`,
    [systemId],
  );
  return firstModelId(result.rows);
};

export const renameComponent = async (
  client: PoolClient,
  params: { componentId: string; name: string },
): Promise<string | undefined> => {
  const result = await client.query<{ model_id: string }>(
    `UPDATE model_components c SET name = $2
     FROM model_systems s
     WHERE c.id = $1 AND c.deleted_at IS NULL
       AND s.id = c.model_system_id AND s.deleted_at IS NULL
     RETURNING s.machine_model_id AS model_id`,
    [params.componentId, params.name],
  );
  return firstModelId(result.rows);
};

export const softDeleteComponent = async (
  client: PoolClient,
  componentId: string,
): Promise<string | undefined> => {
  const result = await client.query<{ model_id: string }>(
    `UPDATE model_components c SET deleted_at = now()
     FROM model_systems s
     WHERE c.id = $1 AND c.deleted_at IS NULL
       AND s.id = c.model_system_id AND s.deleted_at IS NULL
     RETURNING s.machine_model_id AS model_id`,
    [componentId],
  );
  return firstModelId(result.rows);
};

// Clears a model's whole tree, ahead of a replace-mode import.
export const softDeleteModelTree = async (
  client: PoolClient,
  modelId: string,
): Promise<void> => {
  await client.query(
    `WITH deleted_components AS (
       UPDATE model_components SET deleted_at = now()
       WHERE deleted_at IS NULL AND model_system_id IN (
         SELECT id FROM model_systems
         WHERE machine_model_id = $1 AND deleted_at IS NULL)
     )
     UPDATE model_systems SET deleted_at = now()
     WHERE machine_model_id = $1 AND deleted_at IS NULL`,
    [modelId],
  );
};
