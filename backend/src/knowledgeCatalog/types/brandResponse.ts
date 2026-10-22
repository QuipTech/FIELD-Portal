import { CatalogFacets, NamedRef } from './catalogResponse';

// GET /knowledge/brands/:id — `brands` in facets is omitted.
export interface BrandDetail extends Omit<CatalogFacets, 'brands'> {
  id: string;
  name: string;
  documentCount: number;
}

// GET /knowledge/categories/:id
export interface CategoryDetail extends Omit<
  CatalogFacets,
  'brands' | 'categories'
> {
  id: string;
  name: string;
  // Categories nest within their brand; null at the top level.
  parentId: string | null;
  brand: NamedRef;
  documentCount: number;
}
