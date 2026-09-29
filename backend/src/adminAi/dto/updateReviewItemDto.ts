import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { REVIEW_STATUSES, ReviewStatus } from './listReviewQueueQueryDto';

// Moving an item to in_review, resolved or escalated makes the caller its
// reviewer unless it already has one; back to unreviewed releases it.
export class UpdateReviewItemDto {
  @IsOptional()
  @IsIn(REVIEW_STATUSES)
  status?: ReviewStatus;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}
