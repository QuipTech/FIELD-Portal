import { PoolClient } from 'pg';
import { ArticleLinkRow } from './types/knowledgeArticleRows';

const RELATED_LIMIT = 5;
const BULLETIN_LIMIT = 5;

// Other live documents the caller can see that mention any of this
// document's machine models.
const SAME_MODEL_DOCUMENTS = `
  SELECT ki.id, ki.title, ki.type, ki.updated_at, d.live_version_id
  FROM knowledge_items ki
  JOIN documents d ON d.knowledge_item_id = ki.id
                  AND d.deleted_at IS NULL AND d.live_version_id IS NOT NULL
  WHERE ki.id <> $1 AND ki.deleted_at IS NULL AND ki.status NOT IN ('archived', 'review')
    AND (ki.tenant_id IS NULL OR ki.tenant_id = $2)
    AND EXISTS (
      SELECT 1 FROM knowledge_item_machine_models km
      JOIN knowledge_item_machine_models mine
        ON mine.machine_model_id = km.machine_model_id AND mine.knowledge_item_id = $1
      WHERE km.knowledge_item_id = ki.id
    )`;

// Ranked by how close each document's average embedding is to this one's,
// with the page of its passage closest to this document.
export const listRelatedDocuments = async (
  client: PoolClient,
  params: { itemId: string; tenantId: string; versionId: string },
): Promise<ArticleLinkRow[]> => {
  const result = await client.query<ArticleLinkRow>(
    `WITH me AS (
       SELECT avg(embedding) AS centre FROM document_chunks WHERE document_version_id = $3
     ),
     candidates AS (${SAME_MODEL_DOCUMENTS})
     SELECT c.id, c.title, c.type,
            (SELECT ch.page_number FROM document_chunks ch
              WHERE ch.document_version_id = c.live_version_id
              ORDER BY ch.embedding <=> me.centre LIMIT 1) AS page_number
     FROM candidates c CROSS JOIN me
     ORDER BY (SELECT avg(ch.embedding) FROM document_chunks ch
                WHERE ch.document_version_id = c.live_version_id) <=> me.centre NULLS LAST,
              c.updated_at DESC
     LIMIT ${RELATED_LIMIT}`,
    [params.itemId, params.tenantId, params.versionId],
  );
  return result.rows;
};

export const listApplicableBulletins = async (
  client: PoolClient,
  params: { itemId: string; tenantId: string },
): Promise<ArticleLinkRow[]> => {
  const result = await client.query<ArticleLinkRow>(
    `SELECT b.id, b.title, b.type, NULL::integer AS page_number
     FROM (${SAME_MODEL_DOCUMENTS}) b
     WHERE b.type = 'bulletin'
     ORDER BY b.updated_at DESC
     LIMIT ${BULLETIN_LIMIT}`,
    [params.itemId, params.tenantId],
  );
  return result.rows;
};
