import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { EmailConfig } from './emailConfig';
import { buildRawEmail } from './buildRawEmail';
import { OutgoingEmail, SentEmail } from './types/outgoingEmail';

const NOT_CONFIGURED_MESSAGE = 'Email isn’t set up (SES_FROM_EMAIL).';

// Sends one email with Amazon SES (raw MIME, so attachments work).
// Credentials come from the default AWS provider chain, like the S3 and
// Bedrock clients. With sending switched off it logs instead.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private client: SESv2Client | null = null;

  constructor(private readonly emailConfig: EmailConfig) {}

  get isConfigured(): boolean {
    return this.emailConfig.isConfigured;
  }

  sendEmail = async (email: OutgoingEmail): Promise<SentEmail> => {
    const { fromAddress, fromName } = this.emailConfig;
    if (!fromAddress) throw new Error(NOT_CONFIGURED_MESSAGE);
    if (!this.emailConfig.isSendingEnabled) {
      this.logger.log(
        `[NOTIFICATIONS_ENABLED is off] Would email ${email.to}: "${email.subject}"`,
      );
      return { messageId: null };
    }
    const raw = buildRawEmail(
      email,
      { address: fromAddress, name: fromName },
      randomUUID(),
    );
    const result = await this.getClient().send(
      new SendEmailCommand({
        FromEmailAddress: fromAddress,
        Destination: { ToAddresses: [email.to] },
        Content: { Raw: { Data: Buffer.from(raw, 'utf8') } },
      }),
    );
    return { messageId: result.MessageId ?? null };
  };

  private getClient = (): SESv2Client => {
    this.client ??= new SESv2Client({ region: this.emailConfig.region });
    return this.client;
  };
}
