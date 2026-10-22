import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { assertCanOpenBrand } from '../access/knowledgeAccess';
import { KnowledgeAccessService } from '../access/knowledgeAccess.service';
import { loadCatalogFacets } from '../facets/loadCatalogFacets';
import { CatalogFacets } from '../types/catalogResponse';
import { BrandDetail, BrandList, CategoryDetail } from '../types/brandResponse';
import * as brandsRepository from './knowledgeBrands.repository';

const BRAND_NOT_FOUND_MESSAGE = 'Brand not found.';
const CATEGORY_NOT_FOUND_MESSAGE = 'Category not found.';

const sumDocuments = (types: CatalogFacets['types']): number =>
  types.reduce((total, type) => total + type.documentCount, 0);

@Injectable()
export class KnowledgeBrandsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly knowledgeAccess: KnowledgeAccessService,
  ) {}

  listBrands = async (actor: AuthenticatedUser): Promise<BrandList> => {
    const access = await this.knowledgeAccess.resolve(actor);
    const rows = await this.databaseService.withTenant(
      actor.tenantId,
      (client) => brandsRepository.listBrandSummaries(client, access),
    );
    return {
      isRestricted: access.brandIds !== null,
      brands: rows.map((row) => ({
        id: row.id,
        name: row.name,
        documentCount: Number(row.document_count),
        categoryCount: Number(row.category_count),
        machineCount: Number(row.machine_count),
        admin: access.isAdmin
          ? {
              inReviewCount: Number(row.in_review_count),
              siteCount: Number(row.site_count),
              activeUserCount: Number(row.active_user_count),
            }
          : null,
      })),
    };
  };

  // 404 for an unknown brand, 403 when the plan doesn't include it.
  getBrand = async (
    actor: AuthenticatedUser,
    brandId: string,
  ): Promise<BrandDetail> => {
    const access = await this.knowledgeAccess.resolve(actor);
    return this.databaseService.withTenant(actor.tenantId, async (client) => {
      const brand = await brandsRepository.findBrand(client, brandId);
      if (!brand) throw new NotFoundException(BRAND_NOT_FOUND_MESSAGE);
      assertCanOpenBrand(access, brand.id);
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
    return this.databaseService.withTenant(actor.tenantId, async (client) => {
      const category = await brandsRepository.findCategory(client, categoryId);
      if (!category) throw new NotFoundException(CATEGORY_NOT_FOUND_MESSAGE);
      assertCanOpenBrand(access, category.brand_id);
      const { models, types } = await loadCatalogFacets(client, access, {
        brandId: category.brand_id,
        categoryId,
      });
      return {
        id: category.id,
        name: category.name,
        brand: { id: category.brand_id, name: category.brand_name },
        documentCount: sumDocuments(types),
        models,
        types,
      };
    });
  };
}
