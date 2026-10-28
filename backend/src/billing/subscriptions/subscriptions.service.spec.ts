import { BillingConfigService } from '../billingConfig/billingConfig.service';
import { createRecordingDatabase } from '../billingRecordingDatabase';
import { PriceBooksService } from '../priceBooks/priceBooks.service';
import { ASSET_PRO_V1 } from '../pricing/priceBookV1Fixture';
import { SubscriptionsService } from './subscriptions.service';

const ASSET_PRO_V2 = {
  ...ASSET_PRO_V1,
  id: 'asset-pro-v2',
  version: 2,
  effectiveFrom: '2026-04-10',
  bands: ASSET_PRO_V1.bands.map((band) => ({
    ...band,
    unitCents: band.unitCents + 500,
  })),
};

const SUBSCRIPTION_ROW = {
  id: 'sub-1',
  billing_account_id: 'account-1',
  plan_code: 'ASSET_PRO',
  price_book_id: ASSET_PRO_V1.id,
  term: 'annual',
  committed_qty: 15,
  annual_months_charged: 10,
  contract_annual_cents: null,
  status: 'active',
  started_at: new Date('2026-01-05T00:00:00Z'),
  current_period_start: new Date('2026-01-05T00:00:00'),
  current_period_end: new Date('2027-01-05T00:00:00'),
  cancel_at: null,
  export_until: null,
  delete_after: null,
};

const setUp = () => {
  const database = createRecordingDatabase((sql, params) => {
    if (sql.includes('FROM tenants')) return [{ id: 'tenant-1' }];
    if (sql.includes('FROM billing.subscriptions')) return [SUBSCRIPTION_ROW];
    if (sql.includes('UPDATE billing.subscriptions'))
      return [
        {
          ...SUBSCRIPTION_ROW,
          price_book_id: params[1],
          committed_qty: params[2],
          current_period_start: new Date(`${params[4] as string}T00:00:00`),
          current_period_end: new Date(`${params[5] as string}T00:00:00`),
        },
      ];
    return undefined;
  });
  const priceBooks = {
    getPinnedPriceBook: jest.fn(async (id: string) =>
      id === ASSET_PRO_V1.id ? ASSET_PRO_V1 : ASSET_PRO_V2,
    ),
    // A new version took effect mid-term.
    getPriceBookInEffect: jest.fn(async () => ASSET_PRO_V2),
  };
  const config = {
    loadConfig: async () => ({ ANNUAL_MONTHS_CHARGED: 10 }),
  } as unknown as BillingConfigService;
  const service = new SubscriptionsService(
    database.serviceDatabase,
    config,
    priceBooks as unknown as PriceBooksService,
  );
  return { database, priceBooks, service };
};

describe('SubscriptionsService', () => {
  it('T27: a price book change mid-term leaves the subscription on its pinned version', async () => {
    const { service, priceBooks } = setUp();
    const subscription = await service.requireSubscription('sub-1');

    const priceBook = await service.getPinnedPriceBook(subscription);

    expect(priceBook.id).toBe(ASSET_PRO_V1.id);
    expect(priceBooks.getPriceBookInEffect).not.toHaveBeenCalled();
  });

  it('T27: renewal moves to the version in effect and resets Q to the current count', async () => {
    const { service, priceBooks } = setUp();

    const renewed = await service.renewSubscription(null, 'sub-1', {
      currentCount: 22,
      requestedQty: null,
    });

    expect(priceBooks.getPriceBookInEffect).toHaveBeenCalledWith(
      'ASSET_PRO',
      '2027-01-05',
    );
    expect(renewed).toMatchObject({
      priceBookId: ASSET_PRO_V2.id,
      committedQty: 22,
      currentPeriodStart: '2027-01-05',
      currentPeriodEnd: '2028-01-05',
    });
  });

  it('audits a renewal by a scheduled job with from, to and reason', async () => {
    const { service, database } = setUp();
    await service.renewSubscription(null, 'sub-1', {
      currentCount: 22,
      requestedQty: null,
    });
    const audit = database.queries.find((entry) =>
      entry.sql.includes('billing.record_audit_entry'),
    );
    expect(audit?.params[1]).toBeNull();
    expect(audit?.params[6]).toBe('system');
    expect(audit?.params[5]).toMatchObject({
      reason: 'renewal',
      from: { priceBookId: ASSET_PRO_V1.id, committedQty: 15 },
      to: { priceBookId: ASSET_PRO_V2.id, committedQty: 22 },
    });
  });
});
