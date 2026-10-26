import { Injectable, Logger } from '@nestjs/common';
import { escapeHtml } from '../../common/utils/escapeHtml';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { EmailService } from '../../email/email.service';

export interface BillingNotice {
  title: string;
  body: string;
  // A portal path, e.g. /settings/billing.
  link: string;
}

interface Recipient {
  user_id: string;
  email: string;
}

// Billing notices for people: the bell (kind "billing") and an email. Who
// receives them comes from SECURITY DEFINER functions (migration 0109),
// because the service role can't read users. A failed email is logged and
// never undoes the change that caused it.
@Injectable()
export class BillingNotifier {
  private readonly logger = new Logger(BillingNotifier.name);

  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly emailService: EmailService,
  ) {}

  // The account's billing administrators (billing.manage).
  notifyAccountAdmins = async (
    billingAccountId: string,
    notice: BillingNotice,
  ): Promise<void> => {
    const recipients = await this.serviceDatabase.query<Recipient>(
      'SELECT user_id, email FROM billing.account_admins($1)',
      [billingAccountId],
    );
    await this.deliver(recipients.rows, notice);
  };

  // QuipTech's platform administrators.
  notifyPlatformAdmins = async (notice: BillingNotice): Promise<void> => {
    const recipients = await this.serviceDatabase.query<Recipient>(
      'SELECT user_id, email FROM billing.platform_admins()',
    );
    await this.deliver(recipients.rows, notice);
  };

  // The account's billing contact, who may not be a portal user.
  emailBillingContact = async (
    billingEmail: string,
    notice: BillingNotice,
  ): Promise<void> => this.email(billingEmail, notice);

  private deliver = async (recipients: Recipient[], notice: BillingNotice) => {
    if (!recipients.length) return;
    await this.serviceDatabase.query(
      'SELECT billing.notify($1::uuid[], $2, $3, $4)',
      [
        recipients.map((recipient) => recipient.user_id),
        notice.title,
        notice.body,
        notice.link,
      ],
    );
    for (const recipient of recipients)
      await this.email(recipient.email, notice);
  };

  private email = async (to: string, notice: BillingNotice) => {
    if (!this.emailService.isConfigured) {
      this.logger.warn(
        `Email isn't set up; "${notice.title}" not emailed to ${to}.`,
      );
      return;
    }
    const url = `${portalOrigin()}${notice.link}`;
    try {
      await this.emailService.sendEmail({
        to,
        subject: `QuipTech FIELD: ${notice.title}`,
        text: `${notice.body}\n\n${url}\n\nQuipTech FIELD`,
        html: `<p>${escapeHtml(notice.body)}</p><p><a href="${escapeHtml(url)}">Open billing in FIELD</a></p><p>QuipTech FIELD</p>`,
      });
    } catch (error) {
      this.logger.warn(
        `"${notice.title}" email to ${to} failed: ${String(error)}`,
      );
    }
  };
}

const portalOrigin = () =>
  (process.env.PORTAL_ORIGIN ?? 'http://localhost:3001').split(',')[0];
