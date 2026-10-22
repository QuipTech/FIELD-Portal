import { CatalogFacets, NamedRef } from './catalogResponse';

// Present for knowledge admins only.
export interface BrandAdminCounts {
  // Documents of this brand waiting for approval.
  inReviewCount: number;
  // Distinct sites of the organisation's machines of this brand.
  siteCount: number;
  // People in the organisation who opened this brand's documents in the
  // last 30 days.
  activeUserCount: number;
}

export interface BrandSummary {
  id: string;
  name: string;
  documentCount: number;
  categoryCount: number;
  machineCount: number;
  admin: BrandAdminCounts | null;
}

// GET /knowledge/brands
export interface BrandList {
  brands: BrandSummary[];
  // true when the plan limits brands (only those listed can be opened).
  isRestricted: boolean;
}

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
  brand: NamedRef;
  documentCount: number;
}
