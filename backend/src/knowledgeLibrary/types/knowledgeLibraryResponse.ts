// "semantic" = ranked by AI embeddings; "keyword" = full-text fallback
// (used when the embedding model isn't reachable); "browse" = no query.
export type LibrarySearchMode = 'semantic' | 'keyword' | 'browse';

export interface KnowledgeResult {
  // The knowledge item (what /documents/:id/download takes).
  id: string;
  title: string;
  type: string;
  // The best-matching passage (or the opening one when browsing).
  snippet: string | null;
  // The matched passage's page and heading; null when browsing (no
  // search, so nothing matched).
  page: number | null;
  heading: string | null;
  // The article section (/knowledge/:id?section=…) that best matches the
  // search; null when browsing or when the document has no sections yet.
  sectionId: string | null;
  // Machine models the document mentions, e.g. "CAT 793F".
  models: string[];
  // Shared QuipTech library, or the organisation's own upload.
  source: 'shared' | 'organisation';
  sourceOem: string | null;
  versionNumber: number;
  updatedAt: string;
}

export interface KnowledgeLibraryResults {
  items: KnowledgeResult[];
  total: number;
  searchMode: LibrarySearchMode;
  // Makes that searchable documents mention, for the side nav.
  makes: { id: string; name: string }[];
  // The model filter's display name ("CAT 793F"), when one is applied.
  activeModel: { id: string; name: string } | null;
}
