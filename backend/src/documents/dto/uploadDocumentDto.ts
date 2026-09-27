import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  KNOWLEDGE_DOCUMENT_TYPES,
  type KnowledgeDocumentType,
} from '../../knowledge/knowledgeFileRules';

const trimToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

// Multipart form fields sent alongside the `file` part.
export class UploadDocumentDto {
  // Defaults to the file name when left out.
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title?: string;

  @IsIn(KNOWLEDGE_DOCUMENT_TYPES)
  type: KnowledgeDocumentType;
}
