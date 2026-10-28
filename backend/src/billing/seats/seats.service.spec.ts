import { BadRequestException, ConflictException } from '@nestjs/common';
import { BillingAccountsService } from '../billingAccounts/billingAccounts.service';
import { createRecordingDatabase } from '../billingRecordingDatabase';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { SeatsService } from './seats.service';

const ACCOUNT = { id: 'account-1', timezone: 'Australia/Brisbane' };
const actor = { userId: 'admin-1', tenantId: 'tenant-1' };
const now = new Date('2026-04-16T02:00:00Z');

const seatRow = (overrides: Record<string, unknown>) => ({
  id: 'seat-1',
  billing_account_id: ACCOUNT.id,
  subscription_id: 'tech-sub',
  user_id: 'tech-user',
  started_on: new Date('2026-04-01T00:00:00'),
  billing_end: null,
  ...overrides,
});

const setUp = (options: { onAccount: boolean; heldSeat?: boolean }) => {
  const database = createRecordingDatabase((sql, params) => {
    if (sql.includes('user_belongs_to_account'))
      return [{ belongs: options.onAccount }];
    if (sql.includes('FROM billing.subscriptions')) return [{ id: 'tech-sub' }];
    if (sql.includes('FROM billing.seats'))
      return options.heldSeat ? [seatRow({})] : [];
    if (sql.includes('INSERT INTO billing.seats'))
      return [
        seatRow({ started_on: new Date(`${params[3] as string}T00:00:00`) }),
      ];
    return undefined;
  });
  const accounts = {
    requireAccount: async () => ACCOUNT,
  } as unknown as BillingAccountsService;
  const subscriptions = {
    planNewTerm: async () => ({}),
    createSubscription: jest.fn(),
  };
  const service = new SeatsService(
    database.serviceDatabase,
    accounts,
    subscriptions as unknown as SubscriptionsService,
  );
  return { database, service, subscriptions };
};

describe('SeatsService.addSeat', () => {
  it("adds a seat from today in the account's time zone", async () => {
    const { service, subscriptions } = setUp({ onAccount: true });
    const seat = await service.addSeat(actor, ACCOUNT.id, 'tech-user', now);
    expect(seat).toMatchObject({ startedOn: '2026-04-16', billingEnd: null });
    expect(subscriptions.createSubscription).not.toHaveBeenCalled();
  });

  it("refuses a user outside the account's organisations", async () => {
    const { service, database } = setUp({ onAccount: false });
    await expect(
      service.addSeat(actor, ACCOUNT.id, 'stranger', now),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(database.writes()).toEqual([]);
  });

  it('refuses a second seat for the same user', async () => {
    const { service } = setUp({ onAccount: true, heldSeat: true });
    await expect(
      service.addSeat(actor, ACCOUNT.id, 'tech-user', now),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
