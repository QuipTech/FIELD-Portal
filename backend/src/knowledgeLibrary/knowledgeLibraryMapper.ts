import { KnowledgeResult } from './types/knowledgeLibraryResponse';
import { KnowledgeResultRow } from './types/knowledgeLibraryRows';

export const SNIPPET_MAX_LENGTH = 280;

// A passage shortened at a word boundary, whitespace collapsed.
export const toSnippet = (text: string | null): string | null => {
  if (!text) return null;
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= SNIPPET_MAX_LENGTH) return flat;
  const cut = flat.slice(0, SNIPPET_MAX_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:]+$/, '')}…`;
};

export const toKnowledgeResult = (
  row: KnowledgeResultRow,
): KnowledgeResult => ({
  id: row.id,
  title: row.title,
  type: row.type,
  snippet: toSnippet(row.chunk_text),
  page: row.page_number,
  heading: row.section_heading,
  models: row.models ?? [],
  source: row.tenant_id === null ? 'shared' : 'organisation',
  sourceOem: row.source_oem,
  versionNumber: row.version_number,
  updatedAt: row.updated_at.toISOString(),
});

export const toTotal = (rows: KnowledgeResultRow[]): number =>
  rows.length ? Number(rows[0].total_count) : 0;
