import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { KnowledgeAccessService } from '../access/knowledgeAccess.service';
import { loadCatalogFacets } from '../facets/loadCatalogFacets';
import { CatalogFacets } from '../types/catalogResponse';
import { BrandDetail, CategoryDetail } from '../types/brandResponse';
import * as brandsRepository from './catalogBrands.repository';

const BRAND_NOT_FOUND_MESSAGE = 'Brand not found.';
const CATEGORY_NOT_FOUND_MESSAGE = 'Category not found.';

const sumDocuments = (types: CatalogFacets['types']): number =>
  types.reduce((total, type) => total + type.documentCount, 0);

// The brand list itself is GET /knowledge/brands (knowledgeBrands module).
@Injectable()
export class CatalogBrandsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly knowledgeAccess: KnowledgeAccessService,
  ) {}

  getBrand = async (
    actor: AuthenticatedUser,
    brandId: string,
  ): Promise<BrandDetail> => {
    const access = await this.knowledgeAccess.resolve(actor);
    return this.databaseService.withActor(actor, async (client) => {
      const brand = await brandsRepository.findBrand(
        client,
        actor.tenantId,
        brandId,
      );
      if (!brand) throw new NotFoundException(BRAND_NOT_FOUND_MESSAGE);
      const { categories, models, types } = await loadCatalogFacets(
        client,
        access,
        { brandId },
      );
      return {
        ...brand,
        documentCount: sumDocuments(types),
        categories,
        models,
        types,
      };
    });
  };

  getCategory = async (
    actor: AuthenticatedUser,
    categoryId: string,
  ): Promise<CategoryDetail> => {
    const access = await this.knowledgeAccess.resolve(actor);
    return this.databaseService.withActor(actor, async (client) => {
      const category = await brandsRepository.findCategory(
        client,
        actor.tenantId,
        categoryId,
      );
      if (!category) throw new NotFoundException(CATEGORY_NOT_FOUND_MESSAGE);
      const { models, types } = await loadCatalogFacets(client, access, {
        brandId: category.brand_id,
        categoryId,
      });
      return {
        id: category.id,
        name: category.name,
        parentId: category.parent_id,
        brand: { id: category.brand_id, name: category.brand_name },
        documentCount: sumDocuments(types),
        models,
        types,
      };
    });
  };
}
