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
  KNOWLEDGE_DOCUMENT_TYPES,
  MAX_UPLOAD_BYTES,
  type KnowledgeDocumentType,
} from '../../knowledge/knowledgeFileRules';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Describes the file the browser is about to upload; the backend answers
// with a signed S3 URL to PUT it to.
export class CreateKnowledgeUploadDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title: string;

  @IsIn(KNOWLEDGE_DOCUMENT_TYPES)
  type: KnowledgeDocumentType;

  @Transform(trimString)
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
