import { Transform, Type } from 'class-transformer';
import { trimToUndefined } from '../../common/utils/trimTransforms';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CASE_PRIORITIES,
  CASE_STATUSES,
  CasePriority,
  CaseStatus,
} from '../types/supportCaseResponse';

export const ADMIN_CASE_TABS = [
  'unassigned',
  'mine',
  'open',
  'resolved',
  'all',
] as const;
export type AdminCaseTab = (typeof ADMIN_CASE_TABS)[number];

export class ListAdminSupportCasesQueryDto {
  @IsOptional()
  @IsIn(ADMIN_CASE_TABS)
  tab?: AdminCaseTab;

  // An organisation (tenant) id.
  @IsOptional()
  @IsUUID()
  company?: string;

  @IsOptional()
  @IsIn(CASE_PRIORITIES)
  priority?: CasePriority;

  @IsOptional()
  @IsIn(CASE_STATUSES)
  status?: CaseStatus;

  // Subject, organisation name, or the case number ("1042" / "#1042").
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
