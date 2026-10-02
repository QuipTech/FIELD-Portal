import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { BedrockService } from '../bedrock/bedrock.service';
import { estimateBedrockCost } from '../bedrock/estimateBedrockCost';
import { toAssistantHttpError } from '../bedrock/toAssistantHttpError';
import { TechnicalResponse } from '../bedrock/types/technicalResponse';
import * as aiAnswerRepository from './aiAnswer.repository';
import { chunksToSources } from './aiAssistantMapper';
import { PreparedQuestion } from './aiAskContext.service';
import { findCitedIndexes } from './findCitedIndexes';
import { EventStream } from './openEventStream';
import { AlertEngineService } from '../alertEngine/alertEngine.service';

// Stored when Claude ends without any text (e.g. a refusal).
const EMPTY_ANSWER_TEXT =
  "I can't answer that from the approved sources. Please escalate to a remote expert.";
const NO_SOURCE_REASON =
  'Answered without citing an approved source (none retrieved or none cited).';

interface SavedAnswer {
  userMessageId: string;
  assistantMessageId: string;
  citedIndexes: number[];
}

// For "AI answer flagged" alerts; not sent to the portal.
interface SaveOutcome {
  saved: SavedAnswer;
  flaggedReviewItemId: string | null;
}

// Streams one answer to the portal, then saves the question and answer.
// Nothing is saved when the answer fails part-way, so the technician can
// simply ask again.
@Injectable()
export class AiAskService {
  private readonly logger = new Logger(AiAskService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly bedrockService: BedrockService,
    private readonly alertEngine: AlertEngineService,
  ) {}

  streamAnswer = async (
    actor: AuthenticatedUser,
    prepared: PreparedQuestion,
    stream: EventStream,
  ): Promise<void> => {
    stream.send({
      event: 'start',
      data: {
        conversationId: prepared.conversationId,
        sources: chunksToSources(prepared.chunks),
      },
    });
    try {
      const response = await this.bedrockService.generateTechnicalResponse(
        prepared.question,
        {
          onText: (text) => stream.send({ event: 'delta', data: { text } }),
          signal: stream.signal,
        },
      );
      const { saved, flaggedReviewItemId } = await this.saveAnswer(
        actor,
        prepared,
        response,
      );
      stream.send({
        event: 'done',
        data: { ...saved, stopReason: response.stopReason },
      });
      if (flaggedReviewItemId) {
        void this.alertEngine.handleAnswerFlagged({
          tenantId: actor.tenantId,
          reviewItemId: flaggedReviewItemId,
          reasonCode: 'no_source',
          reason: 'No source found',
          question: prepared.question.question,
        });
      }
    } catch (error) {
      if (stream.signal.aborted) return;
      this.logger.warn(
        `Answer for conversation ${prepared.conversationId} failed: ${String(error)}`,
      );
      stream.send({
        event: 'error',
        data: { message: toAssistantHttpError(error).message },
      });
    } finally {
      stream.close();
    }
  };

  private saveAnswer = (
    actor: AuthenticatedUser,
    prepared: PreparedQuestion,
    response: TechnicalResponse,
  ): Promise<SaveOutcome> =>
    this.databaseService.withTenant(actor.tenantId, async (client) => {
      const tenantId = actor.tenantId;
      const conversationId = prepared.conversationId;
      if (prepared.isNewConversation) {
        await aiAnswerRepository.insertConversation(client, {
          id: conversationId,
          tenantId,
          userId: actor.userId,
          machineId: prepared.machineId,
          title: prepared.title,
        });
      } else {
        await aiAnswerRepository.touchConversation(client, {
          tenantId,
          conversationId,
        });
      }
      const userMessageId = await aiAnswerRepository.insertMessage(client, {
        tenantId,
        conversationId,
        role: 'user',
        content: prepared.question.question,
      });
      const answerText = response.text.trim() || EMPTY_ANSWER_TEXT;
      const assistantMessageId = await aiAnswerRepository.insertMessage(
        client,
        {
          tenantId,
          conversationId,
          role: 'assistant',
          content: answerText,
          modelUsed: response.modelId,
          promptVersion: prepared.promptVersion,
        },
      );
      await aiAnswerRepository.insertSourceReferences(client, {
        tenantId,
        messageId: assistantMessageId,
        chunks: prepared.chunks,
      });
      await aiAnswerRepository.insertUsageLog(client, {
        tenantId,
        userId: actor.userId,
        messageId: assistantMessageId,
        tokensUsed: response.inputTokens + response.outputTokens,
        costEstimate: estimateBedrockCost(
          response.modelId,
          response.inputTokens,
          response.outputTokens,
        ),
      });
      const citedIndexes = findCitedIndexes(answerText, prepared.chunks.length);
      const flaggedReviewItemId = citedIndexes.length
        ? null
        : await aiAnswerRepository.insertReviewItem(client, {
            tenantId,
            messageId: assistantMessageId,
            reasonCode: 'no_source',
            reason: NO_SOURCE_REASON,
          });
      return {
        saved: { userMessageId, assistantMessageId, citedIndexes },
        flaggedReviewItemId,
      };
    });
}
