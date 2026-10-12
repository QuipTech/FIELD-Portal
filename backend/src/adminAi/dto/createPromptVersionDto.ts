import { Transform } from 'class-transformer';
import { trimString } from '../../common/utils/trimTransforms';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const PROMPT_MAX_LENGTH = 50_000;

// Saving always adds a new version; publish (default true) also makes it
// the live prompt.
export class CreatePromptVersionDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(PROMPT_MAX_LENGTH)
  body: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  publish: boolean = true;
}
