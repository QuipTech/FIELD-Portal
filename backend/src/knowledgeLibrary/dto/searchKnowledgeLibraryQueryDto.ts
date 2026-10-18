import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { trimToUndefined } from '../../common/utils/trimTransforms';
import {
  KNOWLEDGE_DOCUMENT_TYPES,
  type KnowledgeDocumentType,
} from '../../knowledge/knowledgeFileRules';

export const LIBRARY_SORTS = ['relevance', 'newest'] as const;
export type LibrarySort = (typeof LIBRARY_SORTS)[number];

// Every filter is optional; blank values count as "any".
export class SearchKnowledgeLibraryQueryDto {
  @IsOptional() @Transform(trimToUndefined) @IsUUID() brandId?: string;
  @IsOptional() @Transform(trimToUndefined) @IsUUID() categoryId?: string;
  @IsOptional() @Transform(trimToUndefined) @IsUUID() machineModelId?: string;
  @IsOptional()
  @Transform(trimToUndefined)
  @IsIn(KNOWLEDGE_DOCUMENT_TYPES)
  documentType?: KnowledgeDocumentType;
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(500)
  q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 50;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(500)
  search?: string;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsIn(KNOWLEDGE_DOCUMENT_TYPES)
  type?: KnowledgeDocumentType;

  // A manufacturer id: documents mentioning any of its models.
  @IsOptional()
  @Transform(trimToUndefined)
  @IsUUID()
  make?: string;

  // A machine model id, e.g. from a machine's Manuals tab.
  @IsOptional()
  @Transform(trimToUndefined)
  @IsUUID()
  model?: string;

  // Without a search, results are always newest first.
  @IsOptional()
  @Transform(trimToUndefined)
  @IsIn(LIBRARY_SORTS)
  sort: LibrarySort = 'relevance';
}
