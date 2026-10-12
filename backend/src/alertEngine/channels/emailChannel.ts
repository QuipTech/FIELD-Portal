import { Injectable } from '@nestjs/common';
import { EmailService } from '../../email/email.service';
import { buildAlertEmail } from '../alertEmailTemplate';
import { NotificationChannel } from './notificationChannel';
import {
  AlertMessage,
  DeliveryResult,
  RecipientCandidate,
} from '../types/alertTypes';

@Injectable()
export class EmailChannel implements NotificationChannel {
  readonly channel = 'email' as const;

  constructor(private readonly emailService: EmailService) {}

  deliver = async (
    recipient: RecipientCandidate,
    message: AlertMessage,
  ): Promise<DeliveryResult> => {
    if (!recipient.email)
      return { status: 'skipped', error: 'No email address' };
    if (!this.emailService.isConfigured)
      return {
        status: 'skipped',
        error: 'Email isn’t set up (SES_FROM_EMAIL)',
      };
    const email = buildAlertEmail(message, recipient.firstName);
    const { messageId } = await this.emailService.sendEmail({
      to: recipient.email,
      ...email,
    });
    return { status: 'sent', providerMessageId: messageId };
  };
}
