import { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { PromptVersionRow } from '../types/adminAiRows';

export const listPromptVersions = async (
  databaseService: DatabaseService,
  versionId: string | null = null,
): Promise<PromptVersionRow[]> => {
  const result = await databaseService.query<PromptVersionRow>(
    `SELECT * FROM admin_list_prompt_versions($1)`,
    [versionId],
  );
  return result.rows;
};

// Two saves racing for the same number hit the UNIQUE constraint (23505).
export const insertPromptVersion = async (
  client: PoolClient,
  params: { body: string; notes?: string; createdBy: string },
): Promise<{ id: string; versionNumber: number }> => {
  const result = await client.query<{ id: string; version_number: number }>(
    `INSERT INTO ai_prompt_versions (version_number, body, notes, created_by)
     VALUES ((SELECT COALESCE(max(version_number), 0) + 1 FROM ai_prompt_versions),
             $1, NULLIF($2, ''), $3)
     RETURNING id, version_number`,
    [params.body, params.notes ?? null, params.createdBy],
  );
  const row = result.rows[0];
  return { id: row.id, versionNumber: row.version_number };
};

// Makes this version the only live one. False when it doesn't exist.
export const publishPromptVersion = async (
  client: PoolClient,
  params: { versionId: string; publishedBy: string },
): Promise<boolean> => {
  await client.query(
    `UPDATE ai_prompt_versions SET is_live = false
     WHERE is_live AND id <> $1`,
    [params.versionId],
  );
  const result = await client.query(
    `UPDATE ai_prompt_versions
     SET is_live = true, published_by = $2, published_at = now()
     WHERE id = $1`,
    [params.versionId, params.publishedBy],
  );
  return (result.rowCount ?? 0) > 0;
};
