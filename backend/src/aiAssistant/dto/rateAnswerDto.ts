import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { trimToUndefined } from '../../common/utils/trimTransforms';

export const ANSWER_RATINGS = ['helpful', 'wrong'] as const;
export type AnswerRating = (typeof ANSWER_RATINGS)[number];

// POST /ai/messages/:messageId/feedback — "wrong" sends the answer to the
// admin review queue.
export class RateAnswerDto {
  @IsIn(ANSWER_RATINGS)
  rating!: AnswerRating;

  // What was wrong, shown to the reviewer.
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
