import { deriveDocumentState } from './knowledgeFileRules';
import { KnowledgeDocumentRow } from './types/knowledgeDocumentRows';
import { KnowledgeDocument } from './types/knowledgeDocumentResponse';

// Mirrors list_document_versions_missing_page_count() (migration 0034).
const COUNTABLE_CONTENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const isPageCountPending = (row: KnowledgeDocumentRow): boolean =>
  row.page_count_checked_at === null &&
  !['uploading', 'failed'].includes(row.ingestion_status) &&
  COUNTABLE_CONTENT_TYPES.includes(row.content_type ?? '');

// Storage bucket/key stay server-side; clients only get signed URLs.
export const toKnowledgeDocument = (
  row: KnowledgeDocumentRow,
): KnowledgeDocument => ({
  id: row.id,
  isShared: row.tenant_id === null,
  title: row.title,
  type: row.type,
  status: row.status,
  state: deriveDocumentState(row.status, row.ingestion_status),
  ingestionStatus: row.ingestion_status,
  progress: row.indexing_progress,
  errorMessage: row.error_message,
  versionNumber: row.version_number,
  reviewNote: row.review_note,
  fileName: row.file_name,
  contentType: row.content_type,
  sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
  pageCount: row.page_count,
  isPageCountPending: isPageCountPending(row),
  indexedAt: row.ingested_at?.toISOString() ?? null,
  createdAt: row.created_at.toISOString(),
});
