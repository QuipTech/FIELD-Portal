import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { runAuditedChange } from '../../common/audit/runAuditedChange';
import { DocumentLifecycleService } from '../../documents/documentLifecycle.service';
import {
  assertCanManageDocument,
  loadActorAccess,
} from '../../documents/documentAccess';
import {
  ClassifyDocumentDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from '../dto/knowledgeTaxonomyDtos';
import * as taxonomyRepository from './knowledgeTaxonomy.repository';
import { CategoryRecordRow } from './knowledgeTaxonomy.repository';

const DUPLICATE_CATEGORY_MESSAGE =
  'This brand already has a category with that name.';
const CATEGORY_NOT_FOUND_MESSAGE = 'Category not found.';
const BRAND_NOT_FOUND_MESSAGE = 'Brand not found.';
const CATEGORY_BRAND_MISMATCH_MESSAGE =
  'That category belongs to a different brand.';

export interface CategoryRecord {
  id: string;
  brandId: string;
  name: string;
  sortOrder: number;
}

export interface DocumentClassification {
  id: string;
  brandId: string | null;
  categoryId: string | null;
}

const toCategoryRecord = (row: CategoryRecordRow): CategoryRecord => ({
  id: row.id,
  brandId: row.brand_id,
  name: row.name,
  sortOrder: row.sort_order,
});

// Brands' categories (platform admins; the controller guards it) and each
// document's brand/category (whoever may manage that document).
@Injectable()
export class KnowledgeTaxonomyService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly documentLifecycle: DocumentLifecycleService,
  ) {}

  createCategory = (actor: AuthenticatedUser, dto: CreateCategoryDto) =>
    runAuditedChange(
      this.databaseService,
      actor,
      DUPLICATE_CATEGORY_MESSAGE,
      async (client) => {
        if (
          !(await taxonomyRepository.countLiveBrands(client, [dto.brandId]))
        ) {
          throw new BadRequestException(BRAND_NOT_FOUND_MESSAGE);
        }
        const row = await taxonomyRepository.insertCategory(client, {
          brandId: dto.brandId,
          name: dto.name,
          sortOrder: dto.sortOrder ?? 0,
        });
        return {
          result: toCategoryRecord(row),
          audit: {
            action: 'create',
            entityType: 'knowledge_category',
            entityId: row.id,
            metadata: { ...dto },
          },
        };
      },
    );

  updateCategory = (
    actor: AuthenticatedUser,
    categoryId: string,
    dto: UpdateCategoryDto,
  ) =>
    runAuditedChange(
      this.databaseService,
      actor,
      DUPLICATE_CATEGORY_MESSAGE,
      async (client) => {
        const row = await taxonomyRepository.updateCategory(
          client,
          categoryId,
          dto,
        );
        if (!row) throw new NotFoundException(CATEGORY_NOT_FOUND_MESSAGE);
        return {
          result: toCategoryRecord(row),
          audit: {
            action: 'update',
            entityType: 'knowledge_category',
            entityId: row.id,
            metadata: { ...dto },
          },
        };
      },
    );

  deleteCategory = (actor: AuthenticatedUser, categoryId: string) =>
    runAuditedChange(this.databaseService, actor, '', async (client) => {
      if (!(await taxonomyRepository.softDeleteCategory(client, categoryId))) {
        throw new NotFoundException(CATEGORY_NOT_FOUND_MESSAGE);
      }
      return {
        result: undefined,
        audit: {
          action: 'delete',
          entityType: 'knowledge_category',
          entityId: categoryId,
          metadata: {},
        },
      };
    });

  classifyDocument = async (
    actor: AuthenticatedUser,
    itemId: string,
    dto: ClassifyDocumentDto,
  ): Promise<DocumentClassification> => {
    const row = await this.documentLifecycle.findVisibleRow(actor, itemId);
    assertCanManageDocument(
      row,
      await loadActorAccess(this.databaseService, actor),
    );
    return runAuditedChange(this.databaseService, actor, '', async (client) => {
      const brandId = await this.resolveBrand(client, dto);
      await taxonomyRepository.setItemClassification(client, {
        itemId,
        brandId,
        categoryId: dto.categoryId,
      });
      const result = { id: itemId, brandId, categoryId: dto.categoryId };
      return {
        result,
        audit: {
          action: 'update',
          entityType: 'knowledge_item',
          entityId: itemId,
          metadata: { classification: result },
        },
      };
    });
  };

  // A category decides the brand; a brand sent with it must match.
  private resolveBrand = async (
    client: PoolClient,
    dto: ClassifyDocumentDto,
  ): Promise<string | null> => {
    if (dto.categoryId) {
      const categoryBrandId = await taxonomyRepository.findCategoryBrandId(
        client,
        dto.categoryId,
      );
      if (!categoryBrandId)
        throw new BadRequestException(CATEGORY_NOT_FOUND_MESSAGE);
      if (dto.brandId && dto.brandId !== categoryBrandId) {
        throw new BadRequestException(CATEGORY_BRAND_MISMATCH_MESSAGE);
      }
      return categoryBrandId;
    }
    if (
      dto.brandId &&
      !(await taxonomyRepository.countLiveBrands(client, [dto.brandId]))
    ) {
      throw new BadRequestException(BRAND_NOT_FOUND_MESSAGE);
    }
    return dto.brandId;
  };
}
