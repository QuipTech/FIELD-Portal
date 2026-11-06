import { AuthenticatedUser } from '../../src/auth/types/authenticatedUser';
import { PushConfig } from '../../src/notifications/push/pushConfig';
import { PushDevicesService } from '../../src/notifications/push/pushDevices.service';
import { PushSenderService } from '../../src/notifications/push/pushSender.service';
import { SnsPushService } from '../../src/notifications/push/snsPush.service';
import {
  BillingTestDatabase,
  createBillingTestDatabase,
} from '../billing/billingTestDatabase';

const DEV_APP = 'arn:aws:sns:ap-southeast-2:1:app/APNS_SANDBOX/field-ios-dev';
const PROD_APP = 'arn:aws:sns:ap-southeast-2:1:app/APNS/field-ios-prod';

// Registration and sending against the real schema (migration 0111) with
// SNS faked: the token moves between people on a shared phone, each
// notification is pushed once, preferences are honoured and dead
// endpoints are dropped.
describe('push notifications', () => {
  let fixture: BillingTestDatabase;
  let admin: AuthenticatedUser;
  let tech: AuthenticatedUser;
  const sns = {
    ensureEndpoint: jest.fn(),
    deleteEndpoint: jest.fn(),
    publish: jest.fn(),
  };
  const config = {
    defaultBundleId: 'au.com.quiptechfield.field',
    isSendingEnabled: true,
    platformApplicationArn: (key: string) =>
      ({
        'au.com.quiptechfield.field.dev|sandbox': DEV_APP,
        'au.com.quiptechfield.field|production': PROD_APP,
      })[key] ?? null,
  } as unknown as PushConfig;
  let devices: PushDevicesService;
  let sender: PushSenderService;

  beforeAll(async () => {
    fixture = await createBillingTestDatabase();
    admin = {
      tenantId: fixture.ids.customerTenant,
      userId: fixture.ids.customerAdmin,
      email: 'admin@pit.test',
    };
    tech = {
      tenantId: fixture.ids.customerTenant,
      userId: fixture.ids.customerTech,
      email: 'tech@pit.test',
    };
    devices = new PushDevicesService(
      fixture.database,
      config,
      sns as unknown as SnsPushService,
    );
    sender = new PushSenderService(
      fixture.database,
      config,
      sns as unknown as SnsPushService,
    );
  });
  afterAll(() => fixture.db.close());
  beforeEach(async () => {
    jest.resetAllMocks();
    sns.ensureEndpoint.mockImplementation(
      async ({ platformApplicationArn, token }) =>
        `${platformApplicationArn}/endpoint/${token}`,
    );
    sns.publish.mockResolvedValue({ status: 'sent', messageId: 'm1' });
    await fixture.db.exec('BEGIN');
  });
  afterEach(() => fixture.db.exec('ROLLBACK'));

  const registerDev = (actor: AuthenticatedUser, token = 'aa11') =>
    devices.register(actor, {
      deviceType: 'ios',
      pushToken: token,
      appVersion: '1.0.0',
      bundleId: 'au.com.quiptechfield.field.dev',
      apnsEnvironment: 'sandbox',
    });
  const rowsFor = async (token: string) =>
    (
      await fixture.query(
        'SELECT user_id, apns_environment, endpoint_arn, disabled_at FROM device_registrations WHERE push_token = $1',
        [token],
      )
    ).rows;
  const notify = async (userId: string, kind = 'case_message') =>
    (
      await fixture.query(
        `INSERT INTO notifications (tenant_id, user_id, kind, title, body, link)
         VALUES ($1, $2, $3, 'New reply on case 1042', 'Fixed', '/cases/1042') RETURNING id`,
        [fixture.ids.customerTenant, userId, kind],
      )
    ).rows[0].id as string;

  it('registers a dev build under the APNS_SANDBOX application, idempotently', async () => {
    const first = await registerDev(admin);
    const again = await registerDev(admin);
    expect(again.id).toBe(first.id);
    expect(await rowsFor('aa11')).toEqual([
      expect.objectContaining({
        user_id: fixture.ids.customerAdmin,
        apns_environment: 'sandbox',
        endpoint_arn: `${DEV_APP}/endpoint/aa11`,
        disabled_at: null,
      }),
    ]);
    expect(sns.ensureEndpoint).toHaveBeenLastCalledWith({
      platformApplicationArn: DEV_APP,
      token: 'aa11',
      userId: fixture.ids.customerAdmin,
    });
  });

  it('falls back to the production app when the build sends no bundle ID', async () => {
    await devices.register(admin, {
      deviceType: 'ios',
      pushToken: 'bb22',
      appVersion: null,
      bundleId: null,
      apnsEnvironment: null,
    });
    expect((await rowsFor('bb22'))[0]).toMatchObject({
      apns_environment: 'production',
      endpoint_arn: `${PROD_APP}/endpoint/bb22`,
    });
  });

  it('moves a token to whoever signs in last on a shared phone', async () => {
    await registerDev(admin);
    await registerDev(tech);
    expect(await rowsFor('aa11')).toEqual([
      expect.objectContaining({ user_id: fixture.ids.customerTech }),
    ]);
    expect(sns.ensureEndpoint).toHaveBeenLastCalledWith(
      expect.objectContaining({ userId: fixture.ids.customerTech }),
    );
  });

  it('still saves the device when SNS fails, so the next launch retries', async () => {
    sns.ensureEndpoint.mockRejectedValue(new Error('SNS down'));
    const device = await registerDev(admin);
    expect(device.id).toBeTruthy();
    expect((await rowsFor('aa11'))[0].endpoint_arn).toBeNull();
  });

  it('deletes the endpoint and the row on sign-out', async () => {
    const device = await registerDev(admin);
    await devices.remove(admin, device.id);
    expect(sns.deleteEndpoint).toHaveBeenCalledWith(`${DEV_APP}/endpoint/aa11`);
    expect(await rowsFor('aa11')).toEqual([]);
    await expect(devices.remove(admin, device.id)).rejects.toThrow(
      'Device not found',
    );
  });

  it("pushes a notification once, with the unread badge, to the person's devices", async () => {
    await registerDev(admin);
    const id = await notify(fixture.ids.customerAdmin);
    await sender.sendForNotification(id);
    await sender.sendForNotification(id);
    expect(sns.publish).toHaveBeenCalledTimes(1);
    const [endpoint, message] = sns.publish.mock.calls[0];
    expect(endpoint).toBe(`${DEV_APP}/endpoint/aa11`);
    expect(JSON.parse(JSON.parse(message).APNS_SANDBOX)).toMatchObject({
      aps: { badge: 1 },
      notificationId: id,
      kind: 'case_message',
      link: '/cases/1042',
    });
    const deliveries = await fixture.query(
      `SELECT channel, status, provider_message_id FROM notification_deliveries WHERE notification_id = $1`,
      [id],
    );
    expect(deliveries.rows).toEqual([
      { channel: 'push', status: 'sent', provider_message_id: 'm1' },
    ]);
  });

  it('skips kinds the person muted', async () => {
    await registerDev(admin);
    await fixture.query(
      `INSERT INTO user_notification_preferences (user_id, tenant_id, muted_kinds) VALUES ($1, $2, '{case_message}')`,
      [fixture.ids.customerAdmin, fixture.ids.customerTenant],
    );
    await sender.sendForNotification(await notify(fixture.ids.customerAdmin));
    expect(sns.publish).not.toHaveBeenCalled();
  });

  it('marks a disabled endpoint and keeps sending to the other devices', async () => {
    await registerDev(admin, 'aa11');
    await registerDev(admin, 'cc33');
    sns.publish.mockImplementation(async (endpoint: string) =>
      endpoint.endsWith('aa11')
        ? { status: 'disabled', error: 'Endpoint is disabled' }
        : { status: 'sent', messageId: 'm2' },
    );
    await sender.sendForNotification(await notify(fixture.ids.customerAdmin));
    expect(sns.publish).toHaveBeenCalledTimes(2);
    expect((await rowsFor('aa11'))[0].disabled_at).not.toBeNull();
    // Registering the token again brings it back.
    await registerDev(admin, 'aa11');
    expect((await rowsFor('aa11'))[0].disabled_at).toBeNull();
  });
});
