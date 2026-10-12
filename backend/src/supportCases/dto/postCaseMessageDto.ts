import { Transform } from 'class-transformer';
import { trimString } from '../../common/utils/trimTransforms';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { AttachmentIdsField } from './attachmentIdsField';

export class PostCaseMessageDto extends AttachmentIdsField {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body: string;
}
