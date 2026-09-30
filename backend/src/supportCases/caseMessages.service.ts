import { ConflictException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { touchCase } from './supportCases.repository';
import { insertCaseMessage, listCaseMessages } from './caseMessages.repository';
import { requireSupportCase } from './requireSupportCase';
import { CaseEventsPublisher } from './caseEventsPublisher';
import { toCaseMessage, toSupportCase } from './supportCaseMapper';
import { PostCaseMessageDto } from './dto/postCaseMessageDto';
import { CaseMessage } from './types/supportCaseResponse';

const CASE_RESOLVED_MESSAGE =
  'This case is resolved. Reopen it before replying.';

// A case's chat. Messages are saved over REST, then pushed to everyone who
// has the case open through the Socket.IO gateway.
@Injectable()
export class CaseMessagesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly caseEventsPublisher: CaseEventsPublisher,
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
      const rows = await listCaseMessages(
        client,
        actor.tenantId,
        supportCase.id,
      );
      return rows.map(toCaseMessage);
    });

  postMessage = async (
    actor: AuthenticatedUser,
    caseNumber: number,
    dto: PostCaseMessageDto,
  ): Promise<CaseMessage> => {
    const { message, supportCase } = await this.databaseService.withTenant(
      actor.tenantId,
      async (client) => {
        const existing = await requireSupportCase(
          client,
          actor.tenantId,
          caseNumber,
        );
        if (existing.status === 'resolved') {
          throw new ConflictException(CASE_RESOLVED_MESSAGE);
        }
        const row = await insertCaseMessage(client, {
          tenantId: actor.tenantId,
          caseId: existing.id,
          authorId: actor.userId,
          body: dto.body,
        });
        await touchCase(client, actor.tenantId, existing.id);
        const touched = await requireSupportCase(
          client,
          actor.tenantId,
          caseNumber,
        );
        return { message: toCaseMessage(row), supportCase: touched };
      },
    );
    this.caseEventsPublisher.publishMessage(
      actor.tenantId,
      caseNumber,
      message,
    );
    this.caseEventsPublisher.publishCaseUpdated(
      actor.tenantId,
      toSupportCase(supportCase),
    );
    return message;
  };
}
