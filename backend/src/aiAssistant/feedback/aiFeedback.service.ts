import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { AlertEngineService } from '../../alertEngine/alertEngine.service';
import { insertReviewItem } from '../aiAnswer.repository';
import { AnswerRating, RateAnswerDto } from '../dto/rateAnswerDto';
import * as aiFeedbackRepository from './aiFeedback.repository';

const ANSWER_NOT_FOUND_MESSAGE = 'Answer not found.';
const MARKED_WRONG_REASON = 'Marked wrong by the technician.';
const MARKED_WRONG_LABEL = 'Marked wrong';

export interface AnswerFeedback {
  id: string;
  rating: AnswerRating;
  // The review queue item a "wrong" rating opened or joined; else null.
  reviewItemId: string | null;
}

@Injectable()
export class AiFeedbackService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly alertEngine: AlertEngineService,
  ) {}

  rateAnswer = async (
    actor: AuthenticatedUser,
    messageId: string,
    dto: RateAnswerDto,
  ): Promise<AnswerFeedback> => {
    const outcome = await this.databaseService.withTenant(
      actor.tenantId,
      async (client) => {
        const answer = await aiFeedbackRepository.findOwnAnswer(client, {
          tenantId: actor.tenantId,
          userId: actor.userId,
          messageId,
        });
        if (!answer) throw new NotFoundException(ANSWER_NOT_FOUND_MESSAGE);
        const id = await aiFeedbackRepository.insertFeedback(client, {
          tenantId: actor.tenantId,
          messageId,
          rating: dto.rating,
          comment: dto.comment ?? null,
        });
        if (dto.rating !== 'wrong') {
          return { id, reviewItemId: null, newReview: false, answer };
        }
        const openItemId = await aiFeedbackRepository.findOpenReviewItem(
          client,
          messageId,
        );
        const reviewItemId =
          openItemId ??
          (await insertReviewItem(client, {
            tenantId: actor.tenantId,
            messageId,
            reasonCode: 'marked_wrong',
            reason: dto.comment ?? MARKED_WRONG_REASON,
          }));
        return { id, reviewItemId, newReview: !openItemId, answer };
      },
    );
    if (outcome.newReview && outcome.reviewItemId) {
      void this.alertEngine.handleAnswerFlagged({
        tenantId: actor.tenantId,
        reviewItemId: outcome.reviewItemId,
        reasonCode: 'marked_wrong',
        reason: MARKED_WRONG_LABEL,
        question: outcome.answer.question ?? '',
      });
    }
    return {
      id: outcome.id,
      rating: dto.rating,
      reviewItemId: outcome.reviewItemId,
    };
  };
}
