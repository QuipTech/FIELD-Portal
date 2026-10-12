import { Transform } from 'class-transformer';
import { trimString } from '../../common/utils/trimTransforms';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AttachmentIdsField } from './attachmentIdsField';
import {
  CASE_CATEGORIES,
  CASE_PRIORITIES,
  CaseCategory,
  CasePriority,
} from '../types/supportCaseResponse';

export class CreateSupportCaseDto extends AttachmentIdsField {
  @Transform(trimString)
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  subject: string;

  @IsIn(CASE_CATEGORIES)
  category: CaseCategory;

  @IsIn(CASE_PRIORITIES)
  priority: CasePriority;

  @IsOptional()
  @IsUUID()
  machineId?: string;

  // Kept on the case, and its first message (with the attachments).
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  description: string;
}
