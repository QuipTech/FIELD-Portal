// A shared knowledge item joined with its latest document version.
export interface KnowledgeDocumentRow {
  id: string;
  // NULL for the shared library.
  tenant_id: string | null;
  // The owning organisation's name; null for the shared library.
  organisation_name: string | null;
  title: string;
  type: string;
  status: string;
  created_at: Date;
  version_id: string;
  version_number: number;
  document_id: string;
  indexing_progress: number;
  error_message: string | null;
  review_note: string | null;
  file_name: string | null;
  content_type: string | null;
  // bigint columns arrive from pg as strings.
  size_bytes: string | null;
  page_count: number | null;
  // Set once page counting has been attempted (migration 0034).
  page_count_checked_at: Date | null;
  ingestion_status: string;
  ingested_at: Date | null;
  storage_bucket: string | null;
  storage_key: string | null;
  total_count: string;
}
