import { Transform } from 'class-transformer';
import { trimToUndefined } from '../../common/utils/trimTransforms';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CASE_PRIORITIES, CasePriority } from '../types/supportCaseResponse';

// "active" = open or in progress (the list's default).
export const CASE_STATUS_FILTERS = [
  'active',
  'open',
  'in_progress',
  'resolved',
  'all',
] as const;
export type CaseStatusFilter = (typeof CASE_STATUS_FILTERS)[number];

export class ListSupportCasesQueryDto {
  @IsOptional()
  @IsIn(CASE_STATUS_FILTERS)
  status?: CaseStatusFilter;

  @IsOptional()
  @IsIn(CASE_PRIORITIES)
  priority?: CasePriority;

  // A user id, or "unassigned".
  @IsOptional()
  @IsString()
  @MaxLength(64)
  assignee?: string;

  // Matches the subject, or the case number exactly ("1042" / "#1042").
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(200)
  search?: string;
}
