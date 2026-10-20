import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { trimString } from '../../common/utils/trimTransforms';

export class UpdateCaseNoteDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body: string;
}
