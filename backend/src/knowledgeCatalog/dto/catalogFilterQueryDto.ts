import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { trimToUndefined } from '../../common/utils/trimTransforms';
import { PaginationQueryDto } from '../../common/dto/paginationQueryDto';
import {
  KNOWLEDGE_DOCUMENT_TYPES,
  type KnowledgeDocumentType,
} from '../../knowledge/knowledgeFileRules';

// ?brandId&categoryId&type&model plus paging; blank values mean "any".
export class CatalogFilterQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(trimToUndefined)
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsIn(KNOWLEDGE_DOCUMENT_TYPES)
  type?: KnowledgeDocumentType;

  // A machine model id.
  @IsOptional()
  @Transform(trimToUndefined)
  @IsUUID()
  model?: string;
}
