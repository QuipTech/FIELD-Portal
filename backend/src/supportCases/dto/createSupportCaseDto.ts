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
import {
  CASE_CATEGORIES,
  CASE_PRIORITIES,
  CaseCategory,
  CasePriority,
} from '../types/supportCaseResponse';

export class CreateSupportCaseDto {
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

  // Becomes the case's first message.
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  description: string;
}
