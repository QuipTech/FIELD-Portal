import { ITEM_BRAND_SQL } from '../knowledge/knowledgeSql';
import { KnowledgeAccess } from './access/knowledgeAccess';
import { CatalogFilters, CatalogSort } from './types/catalogFilters';

// Every catalogue query starts from `catalog` ($1 = the caller's tenant):
// the organisation's own knowledge items and the shared library, each with
// its brand, its state and the version to show (live, else the latest).
// Scope is explicit in SQL (the backend's DB role may bypass RLS); run the
// queries inside withTenant(caller) too.
//
// brand_id: see ITEM_BRAND_SQL.
// state mirrors deriveDocumentState() (knowledge/knowledgeFileRules.ts).
export const CATALOG_CTE = `catalog AS (
  SELECT ki.id, ki.title, ki.type, ki.status, ki.tenant_id, ki.updated_at,
         ki.category_id, ki.review_note, ki.licence_expires_at,
         ${ITEM_BRAND_SQL} AS brand_id,
         d.live_version_id,
         COALESCE(lv.id, latest.id) AS version_id,
         COALESCE(lv.version_number, latest.version_number) AS version_number,
         COALESCE(lv.page_count, latest.page_count) AS page_count,
         COALESCE(lv.file_name, latest.file_name) AS file_name,
         COALESCE(lv.content_type, latest.content_type) AS content_type,
         COALESCE(lv.size_bytes, latest.size_bytes) AS size_bytes,
         COALESCE(lv.storage_key, latest.storage_key) AS storage_key,
         lv.summary, latest.error_message,
         CASE
           WHEN ki.status = 'archived' THEN 'archived'
           WHEN latest.ingestion_status = 'uploading' THEN 'uploading'
           WHEN latest.ingestion_status = 'failed' THEN 'failed'
           WHEN latest.ingestion_status IN ('parsing', 'chunking', 'embedding') THEN 'indexing'
           WHEN latest.ingestion_status <> 'ready' THEN 'queued'
           WHEN ki.status = 'review' THEN 'needs_review'
           ELSE 'live'
         END AS state
  FROM knowledge_items ki
  JOIN documents d ON d.knowledge_item_id = ki.id AND d.deleted_at IS NULL
  LEFT JOIN document_versions lv ON lv.id = d.live_version_id
  JOIN LATERAL (
    SELECT v.* FROM document_versions v WHERE v.document_id = d.id
    ORDER BY v.version_number DESC LIMIT 1
  ) latest ON true
  WHERE ki.deleted_at IS NULL AND (ki.tenant_id IS NULL OR ki.tenant_id = $1)
)`;

// What technicians (and AI retrieval, knowledgeLibraryScope) may read.
export const READABLE_SQL =
  "c.live_version_id IS NOT NULL AND c.status NOT IN ('archived', 'withdrawn')";

export const CATALOG_COLUMNS = `
  c.id, c.title, c.type, c.status, c.state, c.tenant_id, c.updated_at, c.live_version_id,
  c.version_id, c.version_number, c.page_count, c.file_name, c.content_type,
  c.size_bytes, c.storage_key, c.summary, c.review_note, c.error_message,
  c.licence_expires_at, c.brand_id, mf.name AS brand_name, c.category_id,
  kc.name AS category_name,
  (SELECT array_agg(kmf.name || ' ' || mm.name ORDER BY km.mention_count DESC)
     FROM knowledge_item_machine_models km
     JOIN machine_models mm ON mm.id = km.machine_model_id
     JOIN machine_manufacturers kmf ON kmf.id = mm.manufacturer_id
     WHERE km.knowledge_item_id = c.id) AS models`;

export const CATALOG_JOINS = `
  LEFT JOIN machine_manufacturers mf ON mf.id = c.brand_id
  LEFT JOIN knowledge_categories kc ON kc.id = c.category_id AND kc.deleted_at IS NULL`;

// The caller's visibility (live only for non-admins, the plan's brands)
// plus the request's filters. Pushes values onto `params` after $1.
export const buildCatalogConditions = (
  access: KnowledgeAccess,
  filters: CatalogFilters,
  params: unknown[],
  options: { readableOnly?: boolean } = {},
): string[] => {
  const addParam = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };
  const conditions: string[] = [];
  if (!access.isAdmin || options.readableOnly) conditions.push(READABLE_SQL);
  if (access.isAdmin && filters.status) {
    conditions.push(`c.state = ${addParam(filters.status)}`);
  }
  if (access.brandIds) {
    conditions.push(
      `(c.brand_id IS NULL OR c.brand_id = ANY(${addParam(access.brandIds)}::uuid[]))`,
    );
  }
  if (filters.brandId)
    conditions.push(`c.brand_id = ${addParam(filters.brandId)}`);
  if (filters.categoryId) {
    conditions.push(`c.category_id = ${addParam(filters.categoryId)}`);
  }
  if (filters.type) conditions.push(`c.type = ${addParam(filters.type)}`);
  if (filters.model) {
    conditions.push(`EXISTS (
      SELECT 1 FROM knowledge_item_machine_models km
      WHERE km.knowledge_item_id = c.id AND km.machine_model_id = ${addParam(filters.model)})`);
  }
  return conditions;
};

export const toWhereClause = (conditions: string[]): string =>
  conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

const SORT_SQL: Record<CatalogSort, string> = {
  newest: 'ORDER BY c.updated_at DESC, c.id',
  oldest: 'ORDER BY c.updated_at, c.id',
  title: 'ORDER BY lower(c.title), c.id',
};

export const toOrderByClause = (sort: CatalogSort): string => SORT_SQL[sort];
