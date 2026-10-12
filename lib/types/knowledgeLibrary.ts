import type { KnowledgeDocumentType } from "./adminDocument";

// "semantic" = AI-ranked; "keyword" = full-text fallback while AI search
// is unavailable; "browse" = no search text.
export type LibrarySearchMode = "semantic" | "keyword" | "browse";
export type LibrarySort = "relevance" | "newest";

export interface KnowledgeResult {
  // The knowledge item; opened with the documents download endpoint.
  id: string;
  title: string;
  type: KnowledgeDocumentType | string;
  snippet: string | null;
  // The matched passage's page and heading; null when browsing.
  page: number | null;
  heading: string | null;
  // The article section that best matches the search (opens there).
  sectionId: string | null;
  // Machine models the document mentions, e.g. "CAT 793F".
  models: string[];
  source: "shared" | "organisation";
  sourceOem: string | null;
  versionNumber: number;
  updatedAt: string;
}

export interface KnowledgeLibraryResults {
  items: KnowledgeResult[];
  total: number;
  searchMode: LibrarySearchMode;
  makes: { id: string; name: string }[];
  activeModel: { id: string; name: string } | null;
}

// "" means any.
export interface KnowledgeLibraryFilters {
  search: string;
  type: KnowledgeDocumentType | "";
  make: string;
  model: string;
  sort: LibrarySort;
}
