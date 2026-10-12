import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { LIBRARY_NAME_MAX_LENGTH, trimString } from './libraryName';

// The manufacturer is matched by name (case-insensitive) and created if
// it doesn't exist yet, so "CAT" + "793F" is all a new model needs.
export class CreateMachineModelDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(LIBRARY_NAME_MAX_LENGTH)
  manufacturerName: string;

  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(LIBRARY_NAME_MAX_LENGTH)
  name: string;

  // e.g. "haul truck", "wheel loader".
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(LIBRARY_NAME_MAX_LENGTH)
  category?: string;
}
