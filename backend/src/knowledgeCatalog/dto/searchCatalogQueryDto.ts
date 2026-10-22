import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trimString } from '../../common/utils/trimTransforms';
import { CatalogFilterQueryDto } from './catalogFilterQueryDto';

// GET /knowledge/search
export class SearchCatalogQueryDto extends CatalogFilterQueryDto {
  // Web-search syntax: words, "exact phrase", -excluded.
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  q!: string;
}
