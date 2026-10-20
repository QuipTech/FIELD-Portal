import { Transform, Type } from 'class-transformer';
import {
  IsUUID,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  KNOWLEDGE_DOCUMENT_TYPES,
  type KnowledgeDocumentType,
} from '../knowledgeFileRules';

const trimToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class ListKnowledgeDocumentsQueryDto {
  @IsOptional() @Transform(trimToUndefined) @IsUUID() brandId?: string;
  @IsOptional() @Transform(trimToUndefined) @IsUUID() categoryId?: string;
  @IsOptional() @Transform(trimToUndefined) @IsUUID() machineModelId?: string;
  @IsOptional()
  @Transform(trimToUndefined)
  @IsIn(['draft', 'needs_review', 'published', 'archived'])
  status?: string;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsIn(KNOWLEDGE_DOCUMENT_TYPES)
  type?: KnowledgeDocumentType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 50;
}
