import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { LIBRARY_NAME_MAX_LENGTH, trimString } from './libraryName';

// Send any subset of the fields; omitted ones are left unchanged. An
// empty category clears it.
export class UpdateMachineModelDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(LIBRARY_NAME_MAX_LENGTH)
  manufacturerName?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(LIBRARY_NAME_MAX_LENGTH)
  name?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(LIBRARY_NAME_MAX_LENGTH)
  category?: string;
}
