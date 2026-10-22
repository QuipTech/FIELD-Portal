import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import { trimToUndefined } from '../../common/utils/trimTransforms';
import { KnowledgeDocumentState } from '../../knowledge/knowledgeFileRules';
import {
  CATALOG_SORTS,
  CATALOG_STATES,
  type CatalogSort,
} from '../types/catalogFilters';
import { CatalogFilterQueryDto } from './catalogFilterQueryDto';

// The admin dashboard's document list (listCatalogDocuments).
export class ListCatalogDocumentsQueryDto extends CatalogFilterQueryDto {
  // Ignored for non-admins, who only ever get live documents.
  @IsOptional()
  @Transform(trimToUndefined)
  @IsIn(CATALOG_STATES)
  status?: KnowledgeDocumentState;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsIn(CATALOG_SORTS)
  sort: CatalogSort = 'newest';
}
