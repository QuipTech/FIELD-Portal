import { Injectable, Logger } from '@nestjs/common';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { SmsConfig } from './smsConfig';
import { isE164PhoneNumber } from './isE164PhoneNumber';

// Sends one text message with Amazon SNS. Credentials come from the
// default AWS provider chain. With sending switched off it logs instead;
// messageId is then null.
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private client: SNSClient | null = null;

  constructor(private readonly smsConfig: SmsConfig) {}

  sendSms = async (
    phoneNumber: string,
    message: string,
  ): Promise<{ messageId: string | null }> => {
    if (!isE164PhoneNumber(phoneNumber))
      throw new Error(`Not an E.164 phone number: ${phoneNumber}`);
    if (!this.smsConfig.isSendingEnabled) {
      this.logger.log(
        `[NOTIFICATIONS_ENABLED is off] Would text ${phoneNumber}: "${message}"`,
      );
      return { messageId: null };
    }
    const result = await this.getClient().send(
      new PublishCommand({
        PhoneNumber: phoneNumber,
        Message: message,
        MessageAttributes: this.messageAttributes(),
      }),
    );
    return { messageId: result.MessageId ?? null };
  };

  private messageAttributes = () => {
    const { smsType, senderId } = this.smsConfig;
    return {
      'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: smsType },
      ...(senderId && {
        'AWS.SNS.SMS.SenderID': { DataType: 'String', StringValue: senderId },
      }),
    };
  };

  private getClient = (): SNSClient => {
    this.client ??= new SNSClient({ region: this.smsConfig.region });
    return this.client;
  };
}
