import { PoolClient } from 'pg';
import { StoredFile } from '../storage/types/storedFile';

// An organisation's own document: knowledge item → document → version 1,
// in the caller's tenant. Uploaded through the backend, so the file is
// already in S3 and goes straight to 'pending' (queued for ingestion).
export const insertTenantDocument = async (
  client: PoolClient,
  params: {
    itemId: string;
    documentId: string;
    versionId: string;
    tenantId: string;
    userId: string;
    title: string;
    type: string;
    bucket: string;
    stored: StoredFile;
  },
): Promise<void> => {
  const { stored } = params;
  await client.query(
    `INSERT INTO knowledge_items (id, tenant_id, title, type, status, source_type, created_by)
     VALUES ($1, $2, $3, $4, 'draft', 'internal', $5)`,
    [params.itemId, params.tenantId, params.title, params.type, params.userId],
  );
  await client.query(
    `INSERT INTO documents (id, tenant_id, knowledge_item_id) VALUES ($1, $2, $3)`,
    [params.documentId, params.tenantId, params.itemId],
  );
  await client.query(
    `INSERT INTO document_versions (
       id, tenant_id, document_id, file_url, version_number, uploaded_by,
       ingestion_status, storage_bucket, storage_key, file_name,
       content_type, size_bytes)
     VALUES ($1, $2, $3, $4, 1, $5, 'pending', $6, $7, $8, $9, $10)`,
    [
      params.versionId,
      params.tenantId,
      params.documentId,
      `s3://${params.bucket}/${stored.key}`,
      params.userId,
      params.bucket,
      stored.key,
      stored.fileName,
      stored.contentType,
      stored.sizeBytes,
    ],
  );
};
