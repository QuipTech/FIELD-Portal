import 'reflect-metadata';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import * as termsRepository from '../billing/accountTerms/accountTerms.repository';
import { BillingConfigService } from '../billing/billingConfig/billingConfig.service';
import { DiscountService } from '../billing/discounts/discount.service';
import { UpFrontInvoiceService } from '../billing/invoices/upFrontInvoice.service';
import { PriceBooksService } from '../billing/priceBooks/priceBooks.service';
import { DatabaseService } from '../database/database.service';
import { ServiceDatabaseService } from '../database/serviceDatabase.service';
import * as deletionRepository from './machineDeletion.repository';
import { MachineDeletionService } from './machineDeletion.service';
import { findVisibleLifecycleMachine } from './visibleMachine';

jest.mock('./machineDeletion.repository');
jest.mock('./visibleMachine');
jest.mock('../billing/accountTerms/accountTerms.repository');

const deletion = jest.mocked(deletionRepository);
const terms = jest.mocked(termsRepository);

const actor = {
  userId: 'user-a',
  tenantId: 'tenant-a',
} as AuthenticatedUser;
const MACHINE_ID = 'machine-1';
// Deactivated on 7 Nov, still counted until 1 Dec: a card client owes
// October and November.
const NOW = new Date('2026-11-20T00:00:00Z');

const setup = (paymentType: 'card' | 'account') => {
  jest.mocked(findVisibleLifecycleMachine).mockResolvedValue({
    id: MACHINE_ID,
    lifecycle_state: 'archived',
    billing_account_id: 'acct-1',
    timezone: 'Australia/Brisbane',
  } as never);
  deletion.findMachineLabel.mockResolvedValue('Plant 7');
  deletion.listBillingIntervals.mockResolvedValue([
    {
      activatedOn: '2026-10-25',
      billingEnd: '2026-12-01',
      lastUsedOn: '2026-11-07',
    },
  ]);
  deletion.countOpenCases.mockResolvedValue(0);
  deletion.hasPendingTransfer.mockResolvedValue(false);
  deletion.findMachinePlanBilling.mockResolvedValue('monthly');
  deletion.listSettlementInvoices.mockResolvedValue([]);
  deletion.listFinalChargedMonths.mockResolvedValue([]);
  deletion.hasDailySnapshot.mockResolvedValue(false);
  terms.findAccountTerms.mockResolvedValue({
    id: 'acct-1',
    payment_type: paymentType,
    account_status: paymentType === 'account' ? 'approved' : 'none',
  } as termsRepository.AccountTermsRow);
  const upFrontInvoices = {
    draft: jest.fn(),
    openCheckout: jest.fn(),
    openPaymentSheet: jest.fn(),
    sendForBankTransfer: jest.fn(),
    refreshPaid: jest.fn().mockResolvedValue(false),
    confirmCheckouts: jest.fn().mockResolvedValue(false),
  };
  const serviceDatabase = {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    transaction: jest.fn(),
  };
  const service = new MachineDeletionService(
    {
      withActor: async (_actor: unknown, work: (client: unknown) => unknown) =>
        work({}),
    } as unknown as DatabaseService,
    serviceDatabase as unknown as ServiceDatabaseService,
    {} as PriceBooksService,
    upFrontInvoices as unknown as UpFrontInvoiceService,
    {
      loadConfig: async () => ({
        BANK_ACCOUNT_NAME: 'QuipTech',
        BANK_BSB: '064-000',
        BANK_ACCOUNT_NUMBER: '12345678',
        PAYMENT_REFERENCE_FORMAT: 'FIELD-{invoiceRef}',
      }),
    } as unknown as BillingConfigService,
    {} as DiscountService,
  );
  return { service, upFrontInvoices, serviceDatabase };
};

beforeEach(() => jest.clearAllMocks());

describe('deleting a machine on a 30-day account (invoiced in Zoho)', () => {
  it('has nothing to pay: the days go on the monthly statement', async () => {
    const { service } = setup('account');
    const check = await service.checkDeletion(actor, MACHINE_ID, NOW);
    expect(check).toMatchObject({
      canDelete: true,
      blocker: null,
      billing: 'account',
      finalCharge: null,
      bankTransferAvailable: false,
    });
    expect(check.message).toMatch(/next monthly statement/);
  });

  it('never raises a final charge or reaches Stripe when asked to pay', async () => {
    const { service, upFrontInvoices, serviceDatabase } = setup('account');
    for (const method of ['online', 'bank_transfer'] as const) {
      const result = await service.payFinalCharge(
        actor,
        MACHINE_ID,
        '/machines/machine-1',
        NOW,
        { method, inApp: true },
      );
      expect(result).toMatchObject({
        canDelete: true,
        paymentUrl: null,
        paymentSheet: null,
      });
    }
    expect(serviceDatabase.transaction).not.toHaveBeenCalled();
    expect(upFrontInvoices.draft).not.toHaveBeenCalled();
    expect(upFrontInvoices.openCheckout).not.toHaveBeenCalled();
    expect(upFrontInvoices.openPaymentSheet).not.toHaveBeenCalled();
    expect(upFrontInvoices.sendForBankTransfer).not.toHaveBeenCalled();
  });
});

describe('deleting a machine on card', () => {
  it('still asks for the final charge', async () => {
    const { service } = setup('card');
    jest
      .spyOn(service as unknown as { quote: () => Promise<unknown> }, 'quote')
      .mockResolvedValue({
        amountCents: 1000,
        months: [],
        discounts: [],
        amountDueCents: 1000,
      });
    const check = await service.checkDeletion(actor, MACHINE_ID, NOW);
    expect(check).toMatchObject({
      canDelete: false,
      blocker: 'final_charge_due',
      billing: 'card',
      bankTransferAvailable: true,
    });
  });
});
