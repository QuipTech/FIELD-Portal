// admin_overview_summary() (migration 0058). bigint arrives as a string.
export interface OverviewSummaryRow {
  active_users: string;
  invited_users: string;
  documents_indexed: string;
  pages_total: string;
  pages_searchable: string;
  assets: string;
  models_in_use: string;
  sites: string;
  organisations: string;
}

// admin_overview_ingestion_queue() (migration 0058).
export interface IngestionQueueRow {
  item_id: string;
  title: string;
  organisation_name: string | null;
  item_status: string;
  ingestion_status: string;
  progress: number;
  page_count: number | null;
  error_message: string | null;
  queue_position: string | null;
  uploaded_by_name: string | null;
  uploaded_at: Date;
}
