import { DatabaseService } from '../database/database.service';

export type DocumentTransition = 'approve' | 'reject' | 'archive' | 'retry';

// SECURITY DEFINER functions (migrations 0037/0038): they also act on
// shared-library rows. The service checks who may call them first.

export const transitionDocument = async (
  databaseService: DatabaseService,
  params: {
    itemId: string;
    action: DocumentTransition;
    userId: string;
    note?: string;
  },
): Promise<'ok' | 'not_found' | 'invalid_state'> => {
  const result = await databaseService.query<{
    outcome: 'ok' | 'not_found' | 'invalid_state';
  }>(`SELECT transition_knowledge_item($1, $2, $3, $4) AS outcome`, [
    params.itemId,
    params.action,
    params.userId,
    params.note ?? null,
  ]);
  return result.rows[0].outcome;
};

export const createDocumentVersion = async (
  databaseService: DatabaseService,
  params: {
    itemId: string;
    versionId: string;
    userId: string;
    bucket: string;
    key: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    isUploaded: boolean;
  },
): Promise<number | null> => {
  const result = await databaseService.query<{ version_number: number | null }>(
    `SELECT create_document_version($1, $2, $3, $4, $5, $6, $7, $8, $9) AS version_number`,
    [
      params.itemId,
      params.versionId,
      params.userId,
      params.bucket,
      params.key,
      params.fileName,
      params.contentType,
      params.sizeBytes,
      params.isUploaded,
    ],
  );
  return result.rows[0].version_number;
};

// Returns every version's S3 key so the caller can delete the files.
export const deleteDocumentPermanently = async (
  databaseService: DatabaseService,
  itemId: string,
): Promise<string[]> => {
  const result = await databaseService.query<{ storage_key: string }>(
    `SELECT storage_key FROM delete_knowledge_item_permanently($1)`,
    [itemId],
  );
  return result.rows.map((row) => row.storage_key);
};
