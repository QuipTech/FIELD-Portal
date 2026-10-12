import { AlertDispatcherService } from './alertDispatcher.service';
import * as alertDeliveryRepository from './alertDelivery.repository';
import { DatabaseService } from '../database/database.service';
import { EmailChannel } from './channels/emailChannel';
import { SmsChannel } from './channels/smsChannel';
import { PushChannel } from './channels/pushChannel';
import { buildRule, ORG_A, ORG_B } from './alertTestFixtures';
import { RecipientCandidateRow } from './types/alertRows';

jest.mock('./alertDelivery.repository');
const repository = jest.mocked(alertDeliveryRepository);

const candidateRow = (
  overrides: Partial<RecipientCandidateRow> = {},
): RecipientCandidateRow => ({
  user_id: 'user-1',
  tenant_id: ORG_A,
  first_name: 'Ada',
  email: 'ada@example.com',
  phone_number: '+61412345678',
  role_names: ['Technical Manager'],
  is_case_assignee: false,
  has_worked_on_machine: false,
  has_reviewed_answers: false,
  ...overrides,
});

const MATCH = {
  entityKey: 'case:1',
  title: 'P1 case #1042 has no reply after 30 min',
  body: 'Hydraulic leak',
  link: '/cases/1042',
  machineId: null,
  caseId: 'case-1',
};

const emailDeliver = jest
  .fn()
  .mockResolvedValue({ status: 'sent', providerMessageId: 'ses-1' });
const smsDeliver = jest
  .fn()
  .mockResolvedValue({ status: 'sent', providerMessageId: 'sns-1' });

const buildDispatcher = () =>
  new AlertDispatcherService(
    {} as DatabaseService,
    { channel: 'email', deliver: emailDeliver } as unknown as EmailChannel,
    { channel: 'sms', deliver: smsDeliver } as unknown as SmsChannel,
    new PushChannel(),
  );

describe('AlertDispatcherService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repository.findTenantBranding.mockResolvedValue({
      name: 'TRT',
      branding_color_accent: '#123456',
      branding_color_primary: null,
    });
    repository.listRecipientCandidates.mockResolvedValue([candidateRow()]);
    repository.recordNotification.mockResolvedValue('notification-1');
  });

  it('notifies in-app and on each allowed channel, recording every outcome', async () => {
    const [result] = await buildDispatcher().dispatch(buildRule(), MATCH);
    expect(result.deliveries.map((d) => [d.channel, d.result.status])).toEqual([
      ['in_app', 'sent'],
      ['push', 'skipped'],
      ['email', 'sent'],
      ['sms', 'sent'],
    ]);
    expect(repository.recordDelivery).toHaveBeenCalledTimes(4);
  });

  it('sends nothing to someone still in the cooldown', async () => {
    repository.recordNotification.mockResolvedValue(null);
    const [result] = await buildDispatcher().dispatch(buildRule(), MATCH);
    expect(result.isNotified).toBe(false);
    expect(emailDeliver).not.toHaveBeenCalled();
    expect(smsDeliver).not.toHaveBeenCalled();
    expect(repository.recordDelivery).not.toHaveBeenCalled();
  });

  it('passes the rule cooldown and entity to the notification record', async () => {
    await buildDispatcher().dispatch(buildRule({ cooldownMinutes: 60 }), MATCH);
    expect(repository.recordNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        cooldownMinutes: 60,
        entityKey: 'case:1',
        tenantId: ORG_A,
      }),
    );
  });

  it('only looks up and notifies people in the rule organisation', async () => {
    repository.listRecipientCandidates.mockResolvedValue([
      candidateRow({ user_id: 'outsider', tenant_id: ORG_B }),
      candidateRow(),
    ]);
    const results = await buildDispatcher().dispatch(buildRule(), MATCH);
    expect(repository.listRecipientCandidates).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tenantId: ORG_A }),
    );
    expect(results.map((r) => r.userId)).toEqual(['user-1']);
  });

  it('records a failed channel and carries on with the others', async () => {
    emailDeliver.mockRejectedValueOnce(new Error('SES down'));
    const [result] = await buildDispatcher().dispatch(buildRule(), MATCH);
    const email = result.deliveries.find((d) => d.channel === 'email');
    expect(email?.result.status).toBe('failed');
    expect(smsDeliver).toHaveBeenCalled();
  });

  it('sends a test only to the asking user', async () => {
    repository.listRecipientCandidates.mockResolvedValue([
      candidateRow({ user_id: 'someone-else' }),
      candidateRow({ user_id: 'admin', role_names: ['Owner'] }),
    ]);
    const results = await buildDispatcher().dispatch(buildRule(), MATCH, {
      onlyUserId: 'admin',
    });
    expect(results.map((r) => r.userId)).toEqual(['admin']);
  });
});
