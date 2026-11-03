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
import { requireVisibleSupportCase } from './requireSupportCase';
import { ACCESSIBLE_MACHINES } from '../machineSharing/access/machineScope';
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

// A case's thread as the customer sees it, never an internal note: their
// organisation's cases, and cases it raised on machines shared with it
// (those live in the machine's owning organisation, supportCase.tenant_id). Messages are saved over REST,
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
    since?: Date,
  ): Promise<CaseMessage[]> =>
    this.databaseService.withActor(actor, async (client) => {
      const supportCase = await requireVisibleSupportCase(
        client,
        actor,
        caseNumber,
      );
      const rows = await listCaseMessages(client, {
        tenantId: supportCase.tenant_id,
        caseId: supportCase.id,
        includeInternal: false,
        since,
      });
      return this.caseAttachmentsService.toMessages(
        client,
        supportCase.id,
        rows,
      );
    });

  listEvents = async (
    actor: AuthenticatedUser,
    caseNumber: number,
    since?: Date,
  ): Promise<CaseEvent[]> =>
    this.databaseService.withActor(actor, async (client) => {
      const supportCase = await requireVisibleSupportCase(
        client,
        actor,
        caseNumber,
      );
      const rows = await listCaseEvents(
        client,
        supportCase.tenant_id,
        supportCase.id,
        since,
      );
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
        const supportCase = await requireVisibleSupportCase(
          client,
          actor,
          caseNumber,
        );
        const result = await postMessageToCase(client, {
          tenantId: supportCase.tenant_id,
          authorTenantId:
            supportCase.tenant_id === actor.tenantId
              ? undefined
              : actor.tenantId,
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
          supportCase.id,
          [result.message],
        );
        return { posted: result, message: withAttachments };
      },
    );
    this.caseAnnouncer.announceMessage(
      posted.supportCase.tenant_id,
      posted,
      message,
    );
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
    this.databaseService.withActor(actor, async (client) => {
      const supportCase = await requireVisibleSupportCase(
        client,
        actor,
        caseNumber,
      );
      await markCaseRead(client, {
        tenantId: actor.tenantId,
        caseId: supportCase.id,
        userId: actor.userId,
      });
    });

  countUnread = async (actor: AuthenticatedUser): Promise<{ count: number }> =>
    this.databaseService.withActor(actor, async (client) => ({
      count: await countUnreadCasesForCustomer(
        client,
        actor.tenantId,
        actor.userId,
        ACCESSIBLE_MACHINES,
      ),
    }));
}
