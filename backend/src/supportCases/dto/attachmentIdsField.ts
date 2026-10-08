import { ArrayMaxSize, IsArray, IsOptional, IsUUID } from 'class-validator';

export const MAX_ATTACHMENTS_PER_MESSAGE = 10;

// Ids from POST …/attachments, sent with the message that carries them.
export class AttachmentIdsField {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ATTACHMENTS_PER_MESSAGE)
  @IsUUID('all', { each: true })
  attachmentIds?: string[];
}
