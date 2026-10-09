// Rows read by the knowledge article repositories.
export interface ArticleDocumentRow {
  id: string;
  title: string;
  type: string;
  status: string;
  tenant_id: string | null;
  live_version_id: string | null;
  version_number: number | null;
  page_count: number | null;
  summary: string | null;
  file_name: string | null;
  storage_key: string | null;
  // The latest version, which may still be indexing.
  latest_ingestion_status: string;
  latest_progress: number;
  make_name: string | null;
  model_name: string | null;
  model_id: string | null;
}

export interface StoredSectionRow {
  ordinal: number;
  heading: string | null;
  page_number: number | null;
  content: string;
}

export interface StoredFigureRow {
  section_ordinal: number;
  page_number: number | null;
  caption: string;
  image_storage_key: string | null;
}

export interface ArticleLinkRow {
  id: string;
  title: string;
  type: string;
  page_number: number | null;
}
