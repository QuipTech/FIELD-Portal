import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { insertAuditLog } from '../auth/auth.repository';
import { KnowledgeClassificationDto } from '../knowledgeBrands/dto/knowledgeBrandDto';

export interface DocumentClassification extends KnowledgeClassificationDto {
  documentType: string;
}

@Injectable()
export class KnowledgeMetadataService {
  constructor(private readonly database: DatabaseService) {}

  validate = async (
    actor: AuthenticatedUser,
    dto: KnowledgeClassificationDto,
  ) => {
    const result = await this.database.withActor(actor, (client) =>
      client.query(
        `SELECT c.id FROM knowledge_categories c WHERE c.id=$1 AND c.brand_id=$2
       AND knowledge_has_brand_access(c.brand_id,$3,$4)`,
        [dto.categoryId, dto.brandId, actor.tenantId, actor.userId],
      ),
    );
    if (!result.rowCount)
      throw new NotFoundException('Brand or category not found.');
  };

  apply = async (
    client: PoolClient,
    actor: AuthenticatedUser,
    itemId: string,
    dto: DocumentClassification,
  ) => {
    try {
      await client.query(
        'SELECT update_knowledge_classification($1,$2,$3,$4,$5,$6)',
        [
          itemId,
          dto.brandId,
          dto.categoryId,
          dto.documentType,
          dto.machineModelIds ?? null,
          actor.userId,
        ],
      );
    } catch (error) {
      if ((error as { code?: string }).code === '23514')
        throw new BadRequestException(
          'Choose a valid category and machine models for this document.',
        );
      if ((error as { code?: string }).code === 'P0002')
        throw new NotFoundException('Document not found.');
      throw error;
    }
  };

  update = async (
    actor: AuthenticatedUser,
    itemId: string,
    patch: Partial<DocumentClassification>,
  ) => {
    await this.database.withActor(actor, async (client) => {
      const previous = await client.query(
        'SELECT brand_id,category_id,document_type FROM documents WHERE knowledge_item_id=$1 FOR UPDATE',
        [itemId],
      );
      const row = previous.rows[0];
      if (!row) throw new NotFoundException('Document not found.');
      const dto: DocumentClassification = {
        brandId: patch.brandId ?? row.brand_id,
        categoryId: patch.categoryId ?? row.category_id,
        documentType: patch.documentType ?? row.document_type,
        machineModelIds: patch.machineModelIds,
      };
      await this.apply(client, actor, itemId, dto);
      await insertAuditLog(client, {
        tenantId: actor.tenantId,
        userId: actor.userId,
        action: 'update',
        entityType: 'knowledge_item',
        entityId: itemId,
        metadata: {
          event: 'document_moved',
          previous: previous.rows[0],
          ...dto,
        },
      });
    });
    return { id: itemId };
  };
}
