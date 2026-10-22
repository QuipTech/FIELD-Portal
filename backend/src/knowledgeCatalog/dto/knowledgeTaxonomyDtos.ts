import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { trimString } from '../../common/utils/trimTransforms';

const MAX_CATEGORY_NAME = 80;
const MAX_PLAN_BRANDS = 500;

// POST /admin/knowledge/categories
export class CreateCategoryDto {
  @IsUUID()
  brandId!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_CATEGORY_NAME)
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

// PATCH /admin/knowledge/categories/:id — only the fields sent change.
export class UpdateCategoryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_CATEGORY_NAME)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

// PATCH /admin/knowledge/documents/:id/classification — null clears a
// field (a cleared brand falls back to the most-mentioned model's maker).
// A category alone also sets its brand.
export class ClassifyDocumentDto {
  @ValidateIf((_dto, value) => value !== null)
  @IsUUID()
  brandId!: string | null;

  @ValidateIf((_dto, value) => value !== null)
  @IsUUID()
  categoryId!: string | null;
}

// PUT /admin/knowledge/brand-access/:tenantId
export class SetBrandAccessDto {
  // false = every brand (brandIds is kept for when it's restricted again).
  @IsBoolean()
  isRestricted!: boolean;

  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(MAX_PLAN_BRANDS)
  @IsUUID('all', { each: true })
  brandIds!: string[];
}
