import { SESv2Client } from '@aws-sdk/client-sesv2';
import { EmailService } from './email.service';
import { EmailConfig } from './emailConfig';

const sendMock = jest
  .spyOn(SESv2Client.prototype, 'send')
  .mockImplementation(() => Promise.resolve({ MessageId: 'ses-1' }));

const config = (overrides: Partial<EmailConfig>) =>
  ({
    fromAddress: 'alerts@example.com',
    fromName: 'FIELD',
    region: 'ap-southeast-2',
    isSendingEnabled: true,
    isConfigured: true,
    ...overrides,
  }) as EmailConfig;

const EMAIL = { to: 'ops@example.com', subject: 'Machine down', text: 'Down' };

describe('EmailService', () => {
  beforeEach(() => sendMock.mockClear());

  it('sends through SES and returns its message id', async () => {
    const result = await new EmailService(config({})).sendEmail(EMAIL);
    expect(result).toEqual({ messageId: 'ses-1' });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('only logs while NOTIFICATIONS_ENABLED is off', async () => {
    const service = new EmailService(config({ isSendingEnabled: false }));
    expect(await service.sendEmail(EMAIL)).toEqual({ messageId: null });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('refuses to send without a sender address', async () => {
    const service = new EmailService(config({ fromAddress: undefined }));
    await expect(service.sendEmail(EMAIL)).rejects.toThrow('SES_FROM_EMAIL');
  });
});
