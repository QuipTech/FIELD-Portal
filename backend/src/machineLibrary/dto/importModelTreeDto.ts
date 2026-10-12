import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { LIBRARY_NAME_MAX_LENGTH, trimString } from './libraryName';

export const IMPORT_MODES = ['merge', 'replace'] as const;
export type ImportMode = (typeof IMPORT_MODES)[number];

const trimEach = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? value.map((item) => (typeof item === 'string' ? item.trim() : item))
    : value;

export class ImportedSystemDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(LIBRARY_NAME_MAX_LENGTH)
  name: string;

  @IsOptional()
  @Transform(trimEach)
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(LIBRARY_NAME_MAX_LENGTH, { each: true })
  components: string[] = [];
}

// merge (default) adds systems/components not already in the tree,
// matching names case-insensitively; replace swaps out the whole tree.
export class ImportModelTreeDto {
  @IsOptional()
  @IsIn(IMPORT_MODES)
  mode: ImportMode = 'merge';

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ImportedSystemDto)
  systems: ImportedSystemDto[];
}
