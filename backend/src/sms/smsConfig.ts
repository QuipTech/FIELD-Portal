import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type SmsType = 'Transactional' | 'Promotional';

// Amazon SNS text message settings. NOTIFICATIONS_ENABLED=true sends;
// anything else logs what would be sent.
@Injectable()
export class SmsConfig {
  readonly region: string | undefined;
  // Alphanumeric sender shown on the phone, where the country allows it.
  readonly senderId: string | undefined;
  readonly smsType: SmsType;
  readonly isSendingEnabled: boolean;

  constructor(configService: ConfigService) {
    this.region = configService.get<string>('AWS_REGION') || undefined;
    this.senderId = configService.get<string>('SNS_SMS_SENDER_ID') || undefined;
    this.smsType =
      configService.get<string>('SNS_SMS_TYPE') === 'Promotional'
        ? 'Promotional'
        : 'Transactional';
    this.isSendingEnabled =
      configService.get<string>('NOTIFICATIONS_ENABLED') === 'true';
  }
}
