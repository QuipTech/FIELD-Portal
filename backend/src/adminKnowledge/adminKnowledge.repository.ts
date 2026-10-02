import { PoolClient } from 'pg';

// tenantId null creates a shared-library document; otherwise that
// organisation's own (admin_create_knowledge_upload, migration 0057).
export const createKnowledgeUpload = async (
  client: PoolClient,
  params: {
    tenantId: string | null;
    itemId: string;
    documentId: string;
    versionId: string;
    title: string;
    type: string;
    userId: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    bucket: string;
    key: string;
  },
): Promise<void> => {
  await client.query(
    `SELECT admin_create_knowledge_upload($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      params.tenantId,
      params.itemId,
      params.documentId,
      params.versionId,
      params.title,
      params.type,
      params.userId,
      params.fileName,
      params.contentType,
      params.sizeBytes,
      params.bucket,
      params.key,
    ],
  );
};

export const finishKnowledgeUpload = async (
  client: PoolClient,
  params: { versionId: string; succeeded: boolean },
): Promise<boolean> => {
  const result = await client.query<{ finished: boolean }>(
    `SELECT admin_finish_knowledge_upload($1, $2) AS finished`,
    [params.versionId, params.succeeded],
  );
  return result.rows[0].finished;
};
