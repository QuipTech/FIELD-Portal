import { Transform, Type } from 'class-transformer';
import {
  IsBase64,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { trimString } from '../../common/utils/trimTransforms';
import {
  IMAGE_MEDIA_TYPES,
  ImageMediaType,
} from '../../bedrock/types/technicalResponse';

// ~3.75 MB decoded: Bedrock's per-image limit for Claude. The portal
// downsizes photos well below this before sending.
export const MAX_IMAGE_BASE64_CHARS = 5_000_000;

export class AttachedImageDto {
  @IsIn(IMAGE_MEDIA_TYPES)
  mediaType: ImageMediaType;

  @IsBase64()
  @MaxLength(MAX_IMAGE_BASE64_CHARS, {
    message: 'The photo is too large. Try a smaller one.',
  })
  data: string;
}

export class AskAssistantDto {
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  question: string;

  // Omitted to start a new thread.
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  // The machine a new thread is about. An existing thread keeps its own.
  @IsOptional()
  @IsUUID()
  machineId?: string;

  // Answer from this document only (a knowledge item id): the Knowledge
  // article's "Ask AI". Applies to this question, not the whole thread.
  @IsOptional()
  @IsUUID()
  documentId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AttachedImageDto)
  image?: AttachedImageDto;
}
