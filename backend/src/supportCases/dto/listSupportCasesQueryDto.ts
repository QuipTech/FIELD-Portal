import { Transform } from 'class-transformer';
import { trimToUndefined } from '../../common/utils/trimTransforms';
import { PaginationQueryDto } from '../../common/dto/paginationQueryDto';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  CASE_PRIORITIES,
  CASE_STATUSES,
  CasePriority,
} from '../types/supportCaseResponse';

// "active" = new, open or waiting on the customer (the list's default).
export const CASE_STATUS_FILTERS = ['active', ...CASE_STATUSES, 'all'] as const;
export type CaseStatusFilter = (typeof CASE_STATUS_FILTERS)[number];

export class ListSupportCasesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(CASE_STATUS_FILTERS)
  status?: CaseStatusFilter;

  @IsOptional()
  @IsIn(CASE_PRIORITIES)
  priority?: CasePriority;

  // Matches the subject, or the case number exactly ("1042" / "#1042").
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(200)
  search?: string;
}
