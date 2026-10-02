import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import * as aiConversationsRepository from './aiConversations.repository';
import {
  toAssistantConversation,
  toAssistantMessages,
} from './aiAssistantMapper';
import {
  AssistantConversation,
  AssistantThread,
} from './types/aiAssistantResponse';

const CONVERSATION_NOT_FOUND_MESSAGE = 'Thread not found.';

// The Threads rail and a thread's saved messages. A technician only sees
// the threads they started.
@Injectable()
export class AiConversationsService {
  constructor(private readonly databaseService: DatabaseService) {}

  listConversations = async (
    actor: AuthenticatedUser,
  ): Promise<AssistantConversation[]> => {
    const rows = await this.databaseService.withTenant(
      actor.tenantId,
      (client) =>
        aiConversationsRepository.listConversations(client, {
          tenantId: actor.tenantId,
          userId: actor.userId,
        }),
    );
    return rows.map(toAssistantConversation);
  };

  getThread = async (
    actor: AuthenticatedUser,
    conversationId: string,
  ): Promise<AssistantThread> => {
    const { conversation, messages } = await this.databaseService.withTenant(
      actor.tenantId,
      async (client) => {
        const found = await aiConversationsRepository.findConversation(client, {
          tenantId: actor.tenantId,
          userId: actor.userId,
          conversationId,
        });
        if (!found) throw new NotFoundException(CONVERSATION_NOT_FOUND_MESSAGE);
        return {
          conversation: found,
          messages: await aiConversationsRepository.listMessages(client, {
            tenantId: actor.tenantId,
            conversationId,
          }),
        };
      },
    );
    const sources = await aiConversationsRepository.listMessageSources(
      this.databaseService,
      { tenantId: actor.tenantId, conversationId },
    );
    return {
      conversation: toAssistantConversation(conversation),
      messages: toAssistantMessages(messages, sources),
    };
  };
}
