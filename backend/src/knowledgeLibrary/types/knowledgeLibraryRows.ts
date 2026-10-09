// One knowledge item with its best-matching chunk. bigint arrives from pg
// as a string; score is a float.
export interface KnowledgeResultRow {
  id: string;
  title: string;
  type: string;
  tenant_id: string | null;
  source_oem: string | null;
  updated_at: Date;
  version_number: number;
  live_version_id: string;
  chunk_text: string | null;
  page_number: number | null;
  section_heading: string | null;
  models: string[] | null;
  score: number | null;
  total_count: string;
}
