import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../email/email.service';
import { OutgoingEmail } from '../email/types/outgoingEmail';
import { ServiceDatabaseService } from '../database/serviceDatabase.service';
import { DemoRequestsConfig } from './demoRequestsConfig';
import { EmailKind, markEmailSent } from './demoRequests.repository';
import { DemoRequestRow } from './types/demoRequestRows';
import {
  DemoRequestDetails,
  buildTeamNotificationEmail,
} from './emails/teamNotificationEmail';
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

  // Last resort when the request couldn't be saved: the team email then
  // carries the only copy, so the caller fails the request if it's false.
  sendUnsavedTeamEmail = async (
    details: DemoRequestDetails,
  ): Promise<boolean> => {
    const emails = this.teamEmails(details, null, 'unsaved request');
    if (!emails.length) return false;
    const results = await this.sendEach('Unsaved demo request', 'team', emails);
    return results.every(Boolean);
  };

  private sendTeamEmail = (request: DemoRequestRow): Promise<boolean> => {
    const emails = this.teamEmails(
      request,
      this.config.requestUrl(request.id),
      `demo request ${request.id}`,
    );
    if (!emails.length) return Promise.resolve(false);
    return this.sendAll(request.id, 'team', emails);
  };

  private teamEmails = (
    details: DemoRequestDetails,
    requestUrl: string | null,
    label: string,
  ): OutgoingEmail[] => {
    const { notifyEmails } = this.config;
    if (!notifyEmails.length) {
      this.logger.warn(
        `DEMO_REQUEST_NOTIFY_TO is not set: no team email for ${label}.`,
      );
      return [];
    }
    const email = buildTeamNotificationEmail(details, requestUrl);
    return notifyEmails.map((to) => ({ ...email, to, replyTo: details.email }));
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
    const results = await this.sendEach(
      `Demo request ${requestId}`,
      kind,
      emails,
    );
    if (!results.every(Boolean)) return false;
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

  // true per email SES accepted; a logged-only send (NOTIFICATIONS_ENABLED
  // off) has no message id, so it counts as not sent.
  private sendEach = async (
    label: string,
    kind: EmailKind,
    emails: OutgoingEmail[],
  ): Promise<boolean[]> => {
    const results = await Promise.allSettled(
      emails.map((email) => this.emailService.sendEmail(email)),
    );
    return results.map((result) => {
      if (result.status === 'fulfilled') return Boolean(result.value.messageId);
      const error = result.reason as Error;
      this.logger.error(
        `${label}: ${kind} email failed: ${error?.message ?? error}`,
      );
      return false;
    });
  };
}
