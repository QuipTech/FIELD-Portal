export interface NamedRef {
  id: string;
  name: string;
}

export interface CatalogDocument {
  // The knowledge item id, used by every /knowledge/documents/:id route.
  id: string;
  title: string;
  type: string;
  // Always 'live' for non-admins. Admins get the latest version's state
  // (a live document whose new version is indexing shows 'indexing').
  state: string;
  // The live version can be opened, whatever the latest version's state.
  isReadable: boolean;
  brand: NamedRef | null;
  category: NamedRef | null;
  // "CAT 793F", most-mentioned first.
  models: string[];
  versionId: string;
  versionNumber: number;
  pageCount: number | null;
  fileName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  source: 'shared' | 'organisation';
  updatedAt: string;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FacetOption {
  id: string;
  name: string;
  documentCount: number;
}

export interface ModelFacetOption extends FacetOption {
  brandId: string | null;
}

// GET /knowledge/facets — also the body of brand and category detail.
export interface CatalogFacets {
  brands: FacetOption[];
  categories: ModelFacetOption[];
  models: ModelFacetOption[];
  types: { type: string; documentCount: number }[];
}

export interface DocumentSectionRef {
  // "4.3" for a numbered heading, else the article anchor (`s{ordinal}`).
  sectionId: string;
  anchor: string;
  heading: string | null;
  page: number | null;
}
