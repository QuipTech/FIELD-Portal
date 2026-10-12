import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../email/email.service';
import { getPortalOrigins } from '../common/security/portalOrigins';
import { buildCaseEmail } from './caseEmailTemplate';
import { CaseMessage } from './types/supportCaseResponse';
import { SupportCaseRow } from './types/supportCaseRows';

interface EmailRecipient {
  id: string;
  email: string;
  firstName: string;
  // Portal path the email links to.
  path: string;
}

const customerOf = (row: SupportCaseRow): EmailRecipient | null =>
  row.reporter_id && row.reporter_email
    ? {
        id: row.reporter_id,
        email: row.reporter_email,
        firstName: row.reporter_first_name ?? '',
        path: `/cases/${row.case_number}`,
      }
    : null;

const assigneeOf = (row: SupportCaseRow): EmailRecipient | null =>
  row.assignee_id && row.assignee_email
    ? {
        id: row.assignee_id,
        email: row.assignee_email,
        firstName: row.assignee_first_name ?? '',
        path: `/admin/cases/${row.case_number}`,
      }
    : null;

// Staff replies go to the customer who raised the case; customer replies
// to the assignee. Internal notes and system lines email nobody, and
// nobody is emailed about their own message.
export const chooseReplyRecipient = (
  row: SupportCaseRow,
  message: CaseMessage,
): EmailRecipient | null => {
  if (message.isInternal || message.authorRole === 'system') return null;
  const recipient =
    message.authorRole === 'customer' ? assigneeOf(row) : customerOf(row);
  return recipient && recipient.id !== message.author?.id ? recipient : null;
};

// Emails sent after a case change is committed. Failures are logged,
// never surfaced: the change itself already succeeded.
@Injectable()
export class CaseEmailNotifier {
  private readonly logger = new Logger(CaseEmailNotifier.name);

  constructor(private readonly emailService: EmailService) {}

  emailAboutReply = (row: SupportCaseRow, message: CaseMessage): void => {
    const recipient = chooseReplyRecipient(row, message);
    if (!recipient) return;
    const author = message.author?.name ?? 'Someone';
    this.send(recipient, {
      title: `${author} replied on case #${row.case_number}: ${row.subject}`,
      body: message.body,
    });
  };

  emailAssignee = (row: SupportCaseRow, actorId: string): void => {
    const recipient = assigneeOf(row);
    if (!recipient || recipient.id === actorId) return;
    this.send(recipient, {
      title: `Case #${row.case_number} was assigned to you`,
      body: `${row.subject}\n\n${row.description ?? ''}`.trim(),
    });
  };

  private send = (
    recipient: EmailRecipient,
    content: { title: string; body: string },
  ): void => {
    if (!this.emailService.isConfigured) return;
    const email = buildCaseEmail({
      ...content,
      recipientFirstName: recipient.firstName,
      url: `${getPortalOrigins()[0]}${recipient.path}`,
    });
    this.emailService
      .sendEmail({ to: recipient.email, ...email })
      .catch((error: unknown) =>
        this.logger.warn(
          `Case email to ${recipient.id} failed: ${String(error)}`,
        ),
      );
  };
}
