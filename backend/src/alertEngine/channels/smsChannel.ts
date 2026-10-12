import { Injectable } from '@nestjs/common';
import { SmsService } from '../../sms/sms.service';
import { isE164PhoneNumber } from '../../sms/isE164PhoneNumber';
import { NotificationChannel } from './notificationChannel';
import {
  AlertMessage,
  DeliveryResult,
  RecipientCandidate,
} from '../types/alertTypes';

// Texts are short: the title and the link.
@Injectable()
export class SmsChannel implements NotificationChannel {
  readonly channel = 'sms' as const;

  constructor(private readonly smsService: SmsService) {}

  deliver = async (
    recipient: RecipientCandidate,
    message: AlertMessage,
  ): Promise<DeliveryResult> => {
    if (!recipient.phoneNumber)
      return { status: 'skipped', error: 'No phone number' };
    if (!isE164PhoneNumber(recipient.phoneNumber))
      return {
        status: 'skipped',
        error: 'Phone number is not in E.164 format',
      };
    const { messageId } = await this.smsService.sendSms(
      recipient.phoneNumber,
      `FIELD: ${message.title}. ${message.url}`,
    );
    return { status: 'sent', providerMessageId: messageId };
  };
}
