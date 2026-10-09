import { SearchKnowledgeLibraryQueryDto } from './dto/searchKnowledgeLibraryQueryDto';

export const RESULT_LIMIT = 50;

// The same visibility rule as AI retrieval (knowledgeSearch.repository):
// a document is searchable only with a live version, not archived or
// deleted, and only if it's the caller's organisation's or the shared
// library's. Scope is explicit in SQL (the backend's DB role may bypass
// RLS). Pushes its parameters onto `params` ($1 must be the tenant id).
export const buildVisibleItemsCte = (
  filters: SearchKnowledgeLibraryQueryDto,
  params: unknown[],
): string => {
  const conditions = [
    'ki.deleted_at IS NULL',
    "ki.status <> 'archived'",
    '(ki.tenant_id IS NULL OR ki.tenant_id = $1)',
  ];
  const addParam = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };
  if (filters.type) conditions.push(`ki.type = ${addParam(filters.type)}`);
  if (filters.make) {
    conditions.push(`EXISTS (
      SELECT 1 FROM knowledge_item_machine_models km
      JOIN machine_models mm ON mm.id = km.machine_model_id
      WHERE km.knowledge_item_id = ki.id AND mm.manufacturer_id = ${addParam(filters.make)})`);
  }
  if (filters.model) {
    conditions.push(`EXISTS (
      SELECT 1 FROM knowledge_item_machine_models km
      WHERE km.knowledge_item_id = ki.id AND km.machine_model_id = ${addParam(filters.model)})`);
  }
  return `visible AS (
    SELECT ki.id, ki.title, ki.type, ki.tenant_id, ki.source_oem, ki.updated_at,
           d.id AS document_id, d.live_version_id, v.version_number
    FROM knowledge_items ki
    JOIN documents d ON d.knowledge_item_id = ki.id
                    AND d.deleted_at IS NULL AND d.live_version_id IS NOT NULL
    JOIN document_versions v ON v.id = d.live_version_id
    WHERE ${conditions.join(' AND ')}
  )`;
};

// Columns every result query selects from `visible vi` and a best-chunk
// relation `b` (chunk_text, page_number, section_heading).
export const RESULT_COLUMNS = `
  vi.id, vi.title, vi.type, vi.tenant_id, vi.source_oem, vi.updated_at,
  vi.version_number, vi.live_version_id, b.chunk_text, b.page_number, b.section_heading,
  (SELECT array_agg(mf.name || ' ' || mm.name ORDER BY km.mention_count DESC)
     FROM knowledge_item_machine_models km
     JOIN machine_models mm ON mm.id = km.machine_model_id
     JOIN machine_manufacturers mf ON mf.id = mm.manufacturer_id
     WHERE km.knowledge_item_id = vi.id) AS models,
  count(*) OVER () AS total_count`;

export const orderBy = (sort: SearchKnowledgeLibraryQueryDto['sort']) =>
  sort === 'newest'
    ? 'ORDER BY vi.updated_at DESC, vi.id'
    : 'ORDER BY score DESC, vi.updated_at DESC, vi.id';
