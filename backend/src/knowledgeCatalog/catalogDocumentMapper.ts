import { toDocumentDisplayTitle } from '../knowledge/documentDisplayTitle';
import { toSectionAnchor, toSectionId } from '../knowledge/sectionId';
import { KnowledgeAccess } from './access/knowledgeAccess';
import {
  CatalogDocumentRow,
  CountedCatalogDocumentRow,
  FacetRow,
} from './types/catalogRows';
import {
  CatalogDocument,
  DocumentSectionRef,
  ModelFacetOption,
  NamedRef,
} from './types/catalogResponse';

const toNamedRef = (id: string | null, name: string | null): NamedRef | null =>
  id && name ? { id, name } : null;

// Storage keys stay server-side; clients get signed URLs from /file.
export const toCatalogDocument = (
  row: CatalogDocumentRow,
  access: KnowledgeAccess,
): CatalogDocument => ({
  id: row.id,
  title: toDocumentDisplayTitle(row.title),
  type: row.type,
  state: access.isAdmin ? row.state : 'live',
  isReadable: row.live_version_id !== null,
  brand: toNamedRef(row.brand_id, row.brand_name),
  category: toNamedRef(row.category_id, row.category_name),
  models: row.models ?? [],
  versionId: row.version_id,
  versionNumber: row.version_number,
  pageCount: row.page_count,
  fileName: row.file_name,
  contentType: row.content_type,
  sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
  source: row.tenant_id === null ? 'shared' : 'organisation',
  updatedAt: row.updated_at.toISOString(),
});

export const toTotal = (rows: CountedCatalogDocumentRow[]): number =>
  rows.length ? Number(rows[0].total_count) : 0;

export const toFacetOption = (row: FacetRow): ModelFacetOption => ({
  id: row.id,
  name: row.name,
  brandId: row.brand_id,
  documentCount: Number(row.document_count),
});

export const toSectionRef = (section: {
  ordinal: number;
  heading: string | null;
  page: number | null;
}): DocumentSectionRef => ({
  sectionId: toSectionId(section.ordinal, section.heading),
  anchor: toSectionAnchor(section.ordinal),
  heading: section.heading,
  page: section.page,
});
