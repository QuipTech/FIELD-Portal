import { randomUUID } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { KnowledgeSearchService } from '../knowledgeSearch/knowledgeSearch.service';
import * as machineHistoryRepository from '../machineHistory/machineHistory.repository';
import { MachineRow } from '../machineHistory/types/machineHistoryRows';
import { BUILT_IN_PROMPT_VERSION } from '../bedrock/technicalAssistantPrompt';
import {
  ConversationTurn,
  RetrievedChunk,
  TechnicalQuestion,
} from '../bedrock/types/technicalResponse';
import * as aiConversationsRepository from './aiConversations.repository';
import { toThreadTitle } from './aiAssistantMapper';
import { formatMachineContext } from './formatMachineContext';
import { AskAssistantDto } from './dto/askAssistantDto';

// Earlier messages resent with each question (5 exchanges).
const HISTORY_MESSAGE_LIMIT = 10;
const RECENT_HISTORY_ENTRIES = 5;
const RETRIEVAL_LIMIT = 6;
// Cosine similarity below which an excerpt is noise, not a source.
const MIN_SOURCE_SCORE = 0.2;

const CONVERSATION_NOT_FOUND_MESSAGE = 'Thread not found.';
const MACHINE_NOT_FOUND_MESSAGE = 'Machine not found.';

// Everything needed to answer and then save one question.
export interface PreparedQuestion {
  conversationId: string;
  isNewConversation: boolean;
  machineId: string | null;
  title: string;
  promptVersion: string;
  question: TechnicalQuestion;
  chunks: RetrievedChunk[];
}

interface ThreadState {
  conversationId: string;
  isNewConversation: boolean;
  machine: MachineRow | null;
  machineContext?: string;
  history: ConversationTurn[];
  systemPrompt?: string;
  promptVersion: string;
}

// Gathers the question's context before any answer streams, so a bad
// thread or machine id fails as an ordinary 404.
@Injectable()
export class AiAskContextService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly knowledgeSearch: KnowledgeSearchService,
  ) {}

  prepare = async (
    actor: AuthenticatedUser,
    dto: AskAssistantDto,
  ): Promise<PreparedQuestion> => {
    const thread = await this.databaseService.withTenant(
      actor.tenantId,
      (client) => this.loadThread(client, actor, dto),
    );
    const chunks = await this.retrieveChunks(
      actor,
      dto.question,
      thread.machine,
    );
    return {
      conversationId: thread.conversationId,
      isNewConversation: thread.isNewConversation,
      machineId: thread.machine?.id ?? null,
      title: toThreadTitle(dto.question),
      promptVersion: thread.promptVersion,
      chunks,
      question: {
        tenantId: actor.tenantId,
        question: dto.question,
        chunks,
        image: dto.image,
        history: thread.history,
        systemPrompt: thread.systemPrompt,
        machineContext: thread.machineContext,
      },
    };
  };

  private loadThread = async (
    client: PoolClient,
    actor: AuthenticatedUser,
    dto: AskAssistantDto,
  ): Promise<ThreadState> => {
    const conversation = dto.conversationId
      ? await aiConversationsRepository.findConversation(client, {
          tenantId: actor.tenantId,
          userId: actor.userId,
          conversationId: dto.conversationId,
        })
      : null;
    if (dto.conversationId && !conversation) {
      throw new NotFoundException(CONVERSATION_NOT_FOUND_MESSAGE);
    }
    const messages = conversation
      ? await aiConversationsRepository.listMessages(client, {
          tenantId: actor.tenantId,
          conversationId: conversation.id,
        })
      : [];
    const machineId = conversation ? conversation.machine_id : dto.machineId;
    const machine = machineId
      ? await this.loadMachine(client, actor.tenantId, machineId)
      : null;
    const livePrompt = await aiConversationsRepository.findLivePrompt(client);
    return {
      conversationId: conversation?.id ?? randomUUID(),
      isNewConversation: !conversation,
      machine: machine?.row ?? null,
      machineContext: machine?.context,
      history: messages
        .slice(-HISTORY_MESSAGE_LIMIT)
        .map((message) => ({ role: message.role, content: message.content })),
      systemPrompt: livePrompt?.body,
      promptVersion: livePrompt
        ? `v${livePrompt.version_number}`
        : BUILT_IN_PROMPT_VERSION,
    };
  };

  private loadMachine = async (
    client: PoolClient,
    tenantId: string,
    machineId: string,
  ): Promise<{ row: MachineRow; context: string }> => {
    const row = await machineHistoryRepository.findMachine(
      client,
      tenantId,
      machineId,
    );
    if (!row) throw new NotFoundException(MACHINE_NOT_FOUND_MESSAGE);
    const entries = await machineHistoryRepository.listHistoryEntries(
      client,
      tenantId,
      machineId,
    );
    return {
      row,
      context: formatMachineContext(
        row,
        entries.slice(0, RECENT_HISTORY_ENTRIES),
      ),
    };
  };

  // The machine's make and model steer retrieval toward its manuals.
  private retrieveChunks = async (
    actor: AuthenticatedUser,
    question: string,
    machine: MachineRow | null,
  ): Promise<RetrievedChunk[]> => {
    const query = machine
      ? `${machine.manufacturer_name} ${machine.model_name}: ${question}`
      : question;
    const matches = await this.knowledgeSearch.search(
      actor,
      query,
      RETRIEVAL_LIMIT,
    );
    return matches
      .filter((match) => match.score >= MIN_SOURCE_SCORE)
      .map((match) => ({
        chunkId: match.chunkId,
        documentId: match.documentId,
        title: match.title,
        page: match.page,
        heading: match.heading,
        text: match.text,
      }));
  };
}
