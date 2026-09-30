import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { trimToUndefined } from '../../common/utils/trimTransforms';
import {
  KNOWLEDGE_DOCUMENT_TYPES,
  type KnowledgeDocumentType,
} from '../../knowledge/knowledgeFileRules';

export const LIBRARY_SORTS = ['relevance', 'newest'] as const;
export type LibrarySort = (typeof LIBRARY_SORTS)[number];

// Every filter is optional; blank values count as "any".
export class SearchKnowledgeLibraryQueryDto {
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
