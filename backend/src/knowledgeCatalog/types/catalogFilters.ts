import {
  KnowledgeDocumentState,
  KnowledgeDocumentType,
} from '../../knowledge/knowledgeFileRules';

export const CATALOG_SORTS = ['newest', 'oldest', 'title'] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

export const CATALOG_STATES: KnowledgeDocumentState[] = [
  'uploading',
  'queued',
  'indexing',
  'failed',
  'needs_review',
  'live',
  'archived',
];

// Shared by the document list, search and facets. `status` is honoured for
// knowledge admins only; everyone else always gets live documents.
export interface CatalogFilters {
  brandId?: string;
  categoryId?: string;
  type?: KnowledgeDocumentType;
  model?: string;
  status?: KnowledgeDocumentState;
}
