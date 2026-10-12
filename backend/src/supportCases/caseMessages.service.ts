import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { IncomingFile } from '../storage/types/storedFile';
import { listCaseMessages } from './caseMessages.repository';
import { listCaseEvents } from './caseEvents.repository';
import {
  countUnreadCasesForCustomer,
  markCaseRead,
} from './caseReads.repository';
import { requireSupportCase } from './requireSupportCase';
import { postMessageToCase } from './postMessageToCase';
import { CaseAttachmentsService } from './caseAttachments.service';
import { CaseAnnouncer } from './caseAnnouncer.service';
import { toCaseEvent } from './supportCaseMapper';
import { PostCaseMessageDto } from './dto/postCaseMessageDto';
import {
  CaseAttachment,
  CaseEvent,
  CaseMessage,
} from './types/supportCaseResponse';

// A case's thread as the customer sees it: everything in their own
// organisation, never an internal note. Messages are saved over REST,
// then pushed to everyone who has the case open.
@Injectable()
export class CaseMessagesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly caseAttachmentsService: CaseAttachmentsService,
    private readonly caseAnnouncer: CaseAnnouncer,
  ) {}

  listMessages = async (
    actor: AuthenticatedUser,
    caseNumber: number,
  ): Promise<CaseMessage[]> =>
    this.databaseService.withTenant(actor.tenantId, async (client) => {
      const supportCase = await requireSupportCase(
        client,
        actor.tenantId,
        caseNumber,
      );
      const rows = await listCaseMessages(client, {
        tenantId: actor.tenantId,
        caseId: supportCase.id,
        includeInternal: false,
      });
      return this.caseAttachmentsService.toMessages(
        client,
        actor.tenantId,
        rows,
      );
    });

  listEvents = async (
    actor: AuthenticatedUser,
    caseNumber: number,
  ): Promise<CaseEvent[]> =>
    this.databaseService.withTenant(actor.tenantId, async (client) => {
      const supportCase = await requireSupportCase(
        client,
        actor.tenantId,
        caseNumber,
      );
      const rows = await listCaseEvents(client, actor.tenantId, supportCase.id);
      return rows.map(toCaseEvent);
    });

  postMessage = async (
    actor: AuthenticatedUser,
    caseNumber: number,
    dto: PostCaseMessageDto,
  ): Promise<CaseMessage> => {
    const { posted, message } = await this.databaseService.withActor(
      actor,
      async (client) => {
        const supportCase = await requireSupportCase(
          client,
          actor.tenantId,
          caseNumber,
        );
        const result = await postMessageToCase(client, {
          tenantId: actor.tenantId,
          supportCase,
          authorId: actor.userId,
          authorRole: 'customer',
          body: dto.body,
          isInternal: false,
          attachmentIds: dto.attachmentIds ?? [],
        });
        await markCaseRead(client, {
          tenantId: actor.tenantId,
          caseId: supportCase.id,
          userId: actor.userId,
        });
        const [withAttachments] = await this.caseAttachmentsService.toMessages(
          client,
          actor.tenantId,
          [result.message],
        );
        return { posted: result, message: withAttachments };
      },
    );
    this.caseAnnouncer.announceMessage(actor.tenantId, posted, message);
    return message;
  };

  // Before the message (or the case) that carries it exists.
  uploadAttachment = async (
    actor: AuthenticatedUser,
    file: IncomingFile | undefined,
  ): Promise<CaseAttachment> =>
    this.databaseService.withActor(actor, (client) =>
      this.caseAttachmentsService.upload(client, {
        tenantId: actor.tenantId,
        caseId: null,
        uploaderId: actor.userId,
        file,
      }),
    );

  markRead = async (
    actor: AuthenticatedUser,
    caseNumber: number,
  ): Promise<void> =>
    this.databaseService.withTenant(actor.tenantId, async (client) => {
      const supportCase = await requireSupportCase(
        client,
        actor.tenantId,
        caseNumber,
      );
      await markCaseRead(client, {
        tenantId: actor.tenantId,
        caseId: supportCase.id,
        userId: actor.userId,
      });
    });

  countUnread = async (actor: AuthenticatedUser): Promise<{ count: number }> =>
    this.databaseService.withTenant(actor.tenantId, async (client) => ({
      count: await countUnreadCasesForCustomer(
        client,
        actor.tenantId,
        actor.userId,
      ),
    }));
}
