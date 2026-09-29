import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export const REVIEW_STATUSES = [
  'unreviewed',
  'in_review',
  'resolved',
  'escalated',
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export class ListReviewQueueQueryDto {
  @IsOptional()
  @IsIn(REVIEW_STATUSES)
  status?: ReviewStatus;

  @IsOptional()
  @IsUUID()
  reviewerId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 25;
}
