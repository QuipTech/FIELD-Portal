import { Transform } from 'class-transformer';
import { trimString } from '../../common/utils/trimTransforms';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { PROMPT_MAX_LENGTH } from './createPromptVersionDto';

// Runs a draft prompt against one sample technician question.
export class TestPromptDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(PROMPT_MAX_LENGTH)
  body: string;

  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  question: string;
}
