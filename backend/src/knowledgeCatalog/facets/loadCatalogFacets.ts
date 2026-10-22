import { PoolClient } from 'pg';
import { KnowledgeAccess } from '../access/knowledgeAccess';
import { toFacetOption } from '../catalogDocumentMapper';
import { CatalogFacets } from '../types/catalogResponse';
import * as facetsRepository from './catalogFacets.repository';

// Brands are never narrowed (the brand picker shows them all); categories
// follow the brand; models and types follow both.
export const loadCatalogFacets = async (
  client: PoolClient,
  access: KnowledgeAccess,
  filters: { brandId?: string; categoryId?: string },
): Promise<CatalogFacets> => {
  const brands = await facetsRepository.listBrandFacets(client, access);
  const categories = await facetsRepository.listCategoryFacets(
    client,
    access,
    filters.brandId,
  );
  const models = await facetsRepository.listModelFacets(
    client,
    access,
    filters,
  );
  const types = await facetsRepository.listTypeFacets(client, access, filters);
  return {
    brands: brands.map(({ id, name, document_count }) => ({
      id,
      name,
      documentCount: Number(document_count),
    })),
    categories: categories.map(toFacetOption),
    models: models.map(toFacetOption),
    types: types.map((row) => ({
      type: row.type,
      documentCount: Number(row.document_count),
    })),
  };
};
