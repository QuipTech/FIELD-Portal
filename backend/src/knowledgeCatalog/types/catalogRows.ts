// A `catalog` row (catalogScope.ts) with its brand, category and models.
// bigint columns arrive from pg as strings.
export interface CatalogDocumentRow {
  id: string;
  title: string;
  type: string;
  status: string;
  state: string;
  // NULL for the shared library.
  tenant_id: string | null;
  updated_at: Date;
  live_version_id: string | null;
  version_id: string;
  version_number: number;
  page_count: number | null;
  file_name: string | null;
  content_type: string | null;
  size_bytes: string | null;
  storage_key: string | null;
  summary: string | null;
  review_note: string | null;
  error_message: string | null;
  licence_expires_at: Date | null;
  brand_id: string | null;
  brand_name: string | null;
  category_id: string | null;
  category_name: string | null;
  models: string[] | null;
}

export interface CountedCatalogDocumentRow extends CatalogDocumentRow {
  total_count: string;
}

export interface FacetRow {
  id: string;
  name: string;
  document_count: string;
}

export interface CategoryFacetRow extends FacetRow {
  brand_id: string;
  parent_id: string | null;
}

export interface TypeFacetRow {
  type: string;
  document_count: string;
}

export interface SearchHitRow extends CountedCatalogDocumentRow {
  hit_page: number | null;
  snippet: string;
  rank: number;
  section_ordinal: number | null;
  section_heading: string | null;
}

export interface SectionRow {
  ordinal: number;
  heading: string | null;
  page_number: number | null;
  content: string;
}
