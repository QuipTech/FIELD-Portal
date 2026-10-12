import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Amazon SES sender settings. SES_FROM_EMAIL must be a verified SES
// identity (address or domain) in SES_REGION (default AWS_REGION).
// NOTIFICATIONS_ENABLED=true sends; anything else logs what would be sent.
@Injectable()
export class EmailConfig {
  readonly fromAddress: string | undefined;
  readonly fromName: string;
  readonly region: string | undefined;
  readonly isSendingEnabled: boolean;

  constructor(configService: ConfigService) {
    this.fromAddress = configService.get<string>('SES_FROM_EMAIL') || undefined;
    this.fromName = configService.get<string>('SES_FROM_NAME') || 'FIELD';
    this.region =
      configService.get<string>('SES_REGION') ||
      configService.get<string>('AWS_REGION') ||
      undefined;
    this.isSendingEnabled =
      configService.get<string>('NOTIFICATIONS_ENABLED') === 'true';
  }

  get isConfigured(): boolean {
    return Boolean(this.fromAddress && this.region);
  }
}
