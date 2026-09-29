import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  ALLOWED_UPLOAD_CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
} from '../../knowledge/knowledgeFileRules';

// The new file for an existing shared-library document; title and type
// stay as they are.
export class CreateVersionUploadDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName: string;

  @IsIn(ALLOWED_UPLOAD_CONTENT_TYPES, {
    message: 'Only PDF and Word documents can be uploaded.',
  })
  contentType: string;

  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_BYTES, { message: 'Files can be at most 500 MB.' })
  sizeBytes: number;
}
