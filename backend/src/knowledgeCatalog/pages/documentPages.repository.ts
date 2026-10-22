import { PoolClient } from 'pg';

export interface DocumentPageRow {
  content: string;
  image_storage_key: string | null;
}

// Saved by the indexer (migration 0102); none for versions indexed before.
export const findDocumentPage = async (
  client: PoolClient,
  versionId: string,
  page: number,
): Promise<DocumentPageRow | null> => {
  const result = await client.query<DocumentPageRow>(
    `SELECT content, image_storage_key FROM document_pages
     WHERE document_version_id = $1 AND page_number = $2`,
    [versionId, page],
  );
  return result.rows[0] ?? null;
};
