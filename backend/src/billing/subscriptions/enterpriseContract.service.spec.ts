import { BadRequestException } from '@nestjs/common';
import { BillingAccountsService } from '../billingAccounts/billingAccounts.service';
import { BillingConfigService } from '../billingConfig/billingConfig.service';
import { createRecordingDatabase } from '../billingRecordingDatabase';
import { PriceBooksService } from '../priceBooks/priceBooks.service';
import { ENTERPRISE_MINIMUM_ANNUAL_CENTS_V1 } from '../pricing/priceBookV1Fixture';
import { EnterpriseContractService } from './enterpriseContract.service';
import { SubscriptionsService } from './subscriptions.service';

const ENTERPRISE_V1 = {
  id: 'enterprise-v1',
  planCode: 'ENTERPRISE',
  version: 1,
  effectiveFrom: '2026-01-01',
  unitCents: null,
  minimumAnnualCents: ENTERPRISE_MINIMUM_ANNUAL_CENTS_V1,
  bands: [],
};

const setUp = () => {
  const database = createRecordingDatabase();
  const priceBooks = {
    getPriceBookInEffect: async () => ENTERPRISE_V1,
    getPinnedPriceBook: async () => ENTERPRISE_V1,
  } as unknown as PriceBooksService;
  const config = {
    loadConfig: async () => ({ ANNUAL_MONTHS_CHARGED: 10 }),
  } as unknown as BillingConfigService;
  const accounts = {
    requireAccount: async () => ({
      id: 'account-1',
      timezone: 'Australia/Brisbane',
    }),
  } as unknown as BillingAccountsService;
  const service = new EnterpriseContractService(
    database.serviceDatabase,
    accounts,
    priceBooks,
    new SubscriptionsService(database.serviceDatabase, config, priceBooks),
  );
  return { database, service };
};

const actor = { userId: 'admin-1', tenantId: 'quiptech' };

describe('EnterpriseContractService', () => {
  it('T8a: rejects a quote below A$5,000 a year at contract set-up, before any write', async () => {
    const { database, service } = setUp();
    await expect(
      service.setUpContract(actor, 'account-1', {
        annualQuoteCents: 499999,
        committedMachines: 600,
        reason: 'quoted',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(database.writes()).toEqual([]);
  });
});
