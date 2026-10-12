import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { LIBRARY_NAME_MAX_LENGTH, trimString } from './libraryName';

// Body for adding or renaming a system or a component.
export class TreeNodeNameDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(LIBRARY_NAME_MAX_LENGTH)
  name: string;
}
