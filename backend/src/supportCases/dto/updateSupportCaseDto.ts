import { IsIn, IsOptional, IsUUID, ValidateIf } from 'class-validator';
import {
  CASE_PRIORITIES,
  CASE_STATUSES,
  CasePriority,
  CaseStatus,
} from '../types/supportCaseResponse';

// Only the fields sent change. assigneeId: null unassigns.
export class UpdateSupportCaseDto {
  @IsOptional()
  @IsIn(CASE_STATUSES)
  status?: CaseStatus;

  @IsOptional()
  @IsIn(CASE_PRIORITIES)
  priority?: CasePriority;

  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsUUID()
  assigneeId?: string | null;
}
