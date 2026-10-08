import { Injectable } from '@nestjs/common';
import { CaseEventsPublisher } from './caseEventsPublisher';
import { CaseEmailNotifier } from './caseEmailNotifier.service';
import { toCaseEvent, toSupportCase } from './supportCaseMapper';
import { PostedThreadMessage } from './postMessageToCase';
import { CaseMessage, SupportCase } from './types/supportCaseResponse';
import { CaseEventRow, SupportCaseRow } from './types/supportCaseRows';

// After a case change commits: live updates to everyone viewing it, and
// the emails. In-app notifications come from database triggers (0072).
@Injectable()
export class CaseAnnouncer {
  constructor(
    private readonly publisher: CaseEventsPublisher,
    private readonly emailNotifier: CaseEmailNotifier,
  ) {}

  announceMessage = (
    tenantId: string,
    posted: PostedThreadMessage,
    message: CaseMessage,
  ): SupportCase => {
    const supportCase = toSupportCase(posted.supportCase);
    this.publisher.publishMessage(supportCase.caseNumber, message);
    this.publisher.publishEvents(
      supportCase.caseNumber,
      posted.events.map(toCaseEvent),
    );
    this.publisher.publishCaseUpdated(tenantId, supportCase);
    this.emailNotifier.emailAboutReply(posted.supportCase, message);
    return supportCase;
  };

  announceChange = (
    tenantId: string,
    change: {
      row: SupportCaseRow;
      events: CaseEventRow[];
      actorId: string;
      previousAssigneeId: string | null;
    },
  ): SupportCase => {
    const supportCase = toSupportCase(change.row);
    this.publisher.publishEvents(
      supportCase.caseNumber,
      change.events.map(toCaseEvent),
    );
    this.publisher.publishCaseUpdated(
      tenantId,
      supportCase,
      change.previousAssigneeId,
    );
    if (change.events.some((event) => event.type === 'assigned')) {
      this.emailNotifier.emailAssignee(change.row, change.actorId);
    }
    return supportCase;
  };
}
