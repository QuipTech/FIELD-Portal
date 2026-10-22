import { Transform } from 'class-transformer';
import { IsOptional, IsUUID } from 'class-validator';
import { trimToUndefined } from '../../common/utils/trimTransforms';

// GET /knowledge/facets — narrows categories and models to a brand or
// category so the filter sheet only offers options that return results.
export class CatalogFacetsQueryDto {
  @IsOptional()
  @Transform(trimToUndefined)
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsUUID()
  categoryId?: string;
}
