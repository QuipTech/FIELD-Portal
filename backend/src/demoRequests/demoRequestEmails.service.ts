import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../email/email.service';
import { OutgoingEmail } from '../email/types/outgoingEmail';
import { ServiceDatabaseService } from '../database/serviceDatabase.service';
import { DemoRequestsConfig } from './demoRequestsConfig';
import { EmailKind, markEmailSent } from './demoRequests.repository';
import { DemoRequestRow } from './types/demoRequestRows';
import { buildTeamNotificationEmail } from './emails/teamNotificationEmail';
import { buildRequesterConfirmationEmail } from './emails/requesterConfirmationEmail';

export interface DemoEmailOutcome {
  teamEmailSent: boolean;
  userEmailSent: boolean;
}

// Sends a request's team notification and requester confirmation, each
// only if not sent before. Never throws: a failure is logged and leaves
// that email's *_sent_at NULL, so "Resend emails" can retry it. With
// NOTIFICATIONS_ENABLED off, EmailService only logs, and the email still
// counts as not sent.
@Injectable()
export class DemoRequestEmailsService {
  private readonly logger = new Logger(DemoRequestEmailsService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly config: DemoRequestsConfig,
  ) {}

  sendPending = async (request: DemoRequestRow): Promise<DemoEmailOutcome> => {
    const [teamEmailSent, userEmailSent] = await Promise.all([
      request.team_email_sent_at !== null || this.sendTeamEmail(request),
      request.user_email_sent_at !== null || this.sendUserEmail(request),
    ]);
    return { teamEmailSent, userEmailSent };
  };

  private sendTeamEmail = (request: DemoRequestRow): Promise<boolean> => {
    const { notifyEmails } = this.config;
    if (!notifyEmails.length) {
      this.logger.warn(
        `DEMO_NOTIFY_EMAIL is not set: no team email for demo request ${request.id}.`,
      );
      return Promise.resolve(false);
    }
    const email = buildTeamNotificationEmail(
      request,
      this.config.requestUrl(request.id),
    );
    return this.sendAll(
      request.id,
      'team',
      notifyEmails.map((to) => ({ ...email, to, replyTo: request.email })),
    );
  };

  private sendUserEmail = (request: DemoRequestRow): Promise<boolean> =>
    this.sendAll(request.id, 'user', [
      { ...buildRequesterConfirmationEmail(request), to: request.email },
    ]);

  // One email per recipient. Marked sent only when every one of them
  // actually went out.
  private sendAll = async (
    requestId: string,
    kind: EmailKind,
    emails: OutgoingEmail[],
  ): Promise<boolean> => {
    const results = await Promise.allSettled(
      emails.map((email) => this.emailService.sendEmail(email)),
    );
    const failures = results.flatMap((result) =>
      result.status === 'rejected' ? [result.reason as Error] : [],
    );
    failures.forEach((error) =>
      this.logger.error(
        `Demo request ${requestId}: ${kind} email failed: ${error?.message ?? error}`,
      ),
    );
    const allSent = results.every(
      (result) => result.status === 'fulfilled' && result.value.messageId,
    );
    if (!allSent) return false;
    try {
      await markEmailSent(this.serviceDatabase, requestId, kind);
      return true;
    } catch (error) {
      this.logger.error(
        `Demo request ${requestId}: ${kind} email sent but not recorded: ${(error as Error).message}`,
      );
      return false;
    }
  };
}
