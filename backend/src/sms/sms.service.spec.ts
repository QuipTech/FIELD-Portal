import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { SmsService } from './sms.service';
import { SmsConfig } from './smsConfig';

const sendMock = jest
  .spyOn(SNSClient.prototype, 'send')
  .mockImplementation(() => Promise.resolve({ MessageId: 'sns-1' }));

const config = (overrides: Partial<SmsConfig>) =>
  ({
    region: 'ap-southeast-2',
    senderId: 'FIELD',
    smsType: 'Transactional',
    isSendingEnabled: true,
    ...overrides,
  }) as SmsConfig;

describe('SmsService', () => {
  beforeEach(() => sendMock.mockClear());

  it('publishes a transactional SMS with the sender id', async () => {
    const result = await new SmsService(config({})).sendSms(
      '+61412345678',
      'P1 case #1042 unactioned',
    );
    expect(result).toEqual({ messageId: 'sns-1' });
    const command = sendMock.mock.calls[0][0] as PublishCommand;
    expect(command.input.PhoneNumber).toBe('+61412345678');
    expect(command.input.MessageAttributes).toMatchObject({
      'AWS.SNS.SMS.SMSType': { StringValue: 'Transactional' },
      'AWS.SNS.SMS.SenderID': { StringValue: 'FIELD' },
    });
  });

  it('rejects numbers that are not E.164', async () => {
    await expect(
      new SmsService(config({})).sendSms('0412 345 678', 'Hi'),
    ).rejects.toThrow('E.164');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('only logs while NOTIFICATIONS_ENABLED is off', async () => {
    const service = new SmsService(config({ isSendingEnabled: false }));
    expect(await service.sendSms('+61412345678', 'Hi')).toEqual({
      messageId: null,
    });
    expect(sendMock).not.toHaveBeenCalled();
  });
});
