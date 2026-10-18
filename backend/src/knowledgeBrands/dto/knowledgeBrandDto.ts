import { Transform } from 'class-transformer';
import { KNOWLEDGE_DOCUMENT_TYPES } from '../../knowledge/knowledgeFileRules';
import {
  IsIn,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ArrayMaxSize,
  ArrayUnique,
} from 'class-validator';

export class KnowledgeBrandDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name: string;
  @IsString()
  @MaxLength(150)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}
export class KnowledgeCategoryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name: string;
  @IsString()
  @MaxLength(150)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug: string;
  @IsOptional() @IsUUID() parentId?: string | null;
  @IsOptional() @IsInt() sortOrder?: number;
}
export class KnowledgeClassificationDto {
  @IsOptional() @IsIn(KNOWLEDGE_DOCUMENT_TYPES) documentType?: string;
  @IsUUID() brandId: string;
  @IsUUID() categoryId: string;
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  machineModelIds?: string[];
}
