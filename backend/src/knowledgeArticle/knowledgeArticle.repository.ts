import { PoolClient } from 'pg';
import { StoredChunk } from '../knowledgeIndexing/sections/blocksFromChunks';
import {
  ArticleDocumentRow,
  StoredFigureRow,
  StoredSectionRow,
} from './types/knowledgeArticleRows';

// Run inside withTenant(caller): scope is also explicit in the SQL (the
// backend's DB role may bypass RLS) — the caller's organisation's
// documents and the shared library (tenant_id NULL), nobody else's.

export const findArticleDocument = async (
  client: PoolClient,
  itemId: string,
  tenantId: string,
): Promise<ArticleDocumentRow | null> => {
  const result = await client.query<ArticleDocumentRow>(
    `SELECT ki.id, ki.title, ki.type, ki.status, ki.tenant_id, d.live_version_id,
            lv.version_number, lv.page_count, lv.summary, lv.file_name, lv.storage_key,
            latest.ingestion_status AS latest_ingestion_status,
            latest.indexing_progress AS latest_progress,
            m.make_name, m.model_name, m.model_id
     FROM knowledge_items ki
     JOIN documents d ON d.knowledge_item_id = ki.id AND d.deleted_at IS NULL
     LEFT JOIN document_versions lv ON lv.id = d.live_version_id
     JOIN LATERAL (
       SELECT v.ingestion_status, v.indexing_progress FROM document_versions v
       WHERE v.document_id = d.id ORDER BY v.version_number DESC LIMIT 1
     ) latest ON true
     LEFT JOIN LATERAL (
       SELECT mm.id AS model_id, mm.name AS model_name, mf.name AS make_name
       FROM knowledge_item_machine_models km
       JOIN machine_models mm ON mm.id = km.machine_model_id
       JOIN machine_manufacturers mf ON mf.id = mm.manufacturer_id
       WHERE km.knowledge_item_id = ki.id
       ORDER BY km.mention_count DESC, mm.name LIMIT 1
     ) m ON true
     WHERE ki.id = $1 AND ki.deleted_at IS NULL
       AND (ki.tenant_id IS NULL OR ki.tenant_id = $2)`,
    [itemId, tenantId],
  );
  return result.rows[0] ?? null;
};

export const listStoredSections = async (
  client: PoolClient,
  versionId: string,
): Promise<StoredSectionRow[]> => {
  const result = await client.query<StoredSectionRow>(
    `SELECT ordinal, heading, page_number, content FROM document_sections
     WHERE document_version_id = $1 ORDER BY ordinal`,
    [versionId],
  );
  return result.rows;
};

export const listStoredFigures = async (
  client: PoolClient,
  versionId: string,
): Promise<StoredFigureRow[]> => {
  const result = await client.query<StoredFigureRow>(
    `SELECT section_ordinal, page_number, caption, image_storage_key FROM document_figures
     WHERE document_version_id = $1 ORDER BY ordinal`,
    [versionId],
  );
  return result.rows;
};

export const listVersionChunks = async (
  client: PoolClient,
  versionId: string,
): Promise<StoredChunk[]> => {
  const result = await client.query<StoredChunk>(
    `SELECT chunk_text, page_number, section_heading FROM document_chunks
     WHERE document_version_id = $1 ORDER BY chunk_index`,
    [versionId],
  );
  return result.rows;
};

// See backfill_document_sections() (migration 0076).
export const backfillSections = async (
  client: PoolClient,
  params: { versionId: string; sections: string; figures: string },
): Promise<void> => {
  await client.query('SELECT backfill_document_sections($1, $2, $3)', [
    params.versionId,
    params.sections,
    params.figures,
  ]);
};
