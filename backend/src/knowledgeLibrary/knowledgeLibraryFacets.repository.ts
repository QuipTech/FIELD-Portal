import { DatabaseService } from '../database/database.service';

// Makes that the caller's searchable documents mention (same scope as the
// results), for the side nav.
export const listMentionedMakes = async (
  databaseService: DatabaseService,
  tenantId: string,
): Promise<{ id: string; name: string }[]> => {
  const result = await databaseService.query<{ id: string; name: string }>(
    `SELECT DISTINCT mf.id, mf.name
     FROM knowledge_item_machine_models km
     JOIN knowledge_items ki ON ki.id = km.knowledge_item_id
                            AND ki.deleted_at IS NULL AND ki.status <> 'archived'
                            AND (ki.tenant_id IS NULL OR ki.tenant_id = $1)
     JOIN documents d ON d.knowledge_item_id = ki.id
                     AND d.deleted_at IS NULL AND d.live_version_id IS NOT NULL
     JOIN machine_models mm ON mm.id = km.machine_model_id
     JOIN machine_manufacturers mf ON mf.id = mm.manufacturer_id AND mf.deleted_at IS NULL
     ORDER BY mf.name`,
    [tenantId],
  );
  return result.rows;
};

// "CAT 793F" for the model filter chip.
export const findModelDisplayName = async (
  databaseService: DatabaseService,
  modelId: string,
): Promise<string | null> => {
  const result = await databaseService.query<{ name: string }>(
    `SELECT mf.name || ' ' || mm.name AS name
     FROM machine_models mm
     JOIN machine_manufacturers mf ON mf.id = mm.manufacturer_id
     WHERE mm.id = $1`,
    [modelId],
  );
  return result.rows[0]?.name ?? null;
};
