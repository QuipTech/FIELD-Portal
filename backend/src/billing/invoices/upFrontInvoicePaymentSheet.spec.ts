import { BadGatewayException } from '@nestjs/common';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { BillingAccountsService } from '../billingAccounts/billingAccounts.service';
import { PersonalCheckoutService } from '../personalSubscription/personalCheckout.service';
import { PriceBooksService } from '../priceBooks/priceBooks.service';
import { StripeService } from '../stripe/stripe.service';
import { findInvoice } from './invoices.repository';
import { InvoicePaymentSheetService } from './invoicePaymentSheet.service';
import { InvoicesService } from './invoices.service';
import {
  PAYMENT_SHEET_UNAVAILABLE,
  UpFrontInvoiceService,
} from './upFrontInvoice.service';

jest.mock('./invoices.repository', () => ({ findInvoice: jest.fn() }));

const SHEET = {
  publishableKey: 'pk_test_field',
  paymentIntentClientSecret: 'pi_final_secret_abc',
  customerId: 'cus_a',
  customerEphemeralKeySecret: 'ek_test_1',
  merchantDisplayName: 'FIELD',
};
const draftCharge = {
  id: 'invoice-final',
  billing_account_id: 'account-a',
  status: 'draft',
  stripe_invoice_id: null,
  hosted_invoice_url: null,
};

const setup = () => {
  const accounts = {
    requireAccount: jest.fn().mockResolvedValue({ id: 'account-a' }),
    ensureStripeCustomer: jest
      .fn()
      .mockResolvedValue({ stripe_customer_id: 'cus_a' }),
  };
  const paymentSheets = {
    isAvailable: true,
    forInvoice: jest.fn().mockResolvedValue(SHEET),
  };
  const stripe = { canTaxCustomer: jest.fn().mockResolvedValue(true) };
  jest
    .mocked(findInvoice)
    .mockResolvedValue(draftCharge as Awaited<ReturnType<typeof findInvoice>>);
  const service = new UpFrontInvoiceService(
    {} as ServiceDatabaseService,
    accounts as unknown as BillingAccountsService,
    {} as PriceBooksService,
    {} as InvoicesService,
    {} as PersonalCheckoutService,
    paymentSheets as unknown as InvoicePaymentSheetService,
    stripe as unknown as StripeService,
  );
  return { service, paymentSheets, stripe };
};

beforeEach(() => jest.clearAllMocks());

describe('paying an up-front invoice in the Payment Sheet', () => {
  it("returns the sheet for the final charge's own invoice", async () => {
    const { service, paymentSheets, stripe } = setup();
    expect(await service.openPaymentSheet('invoice-final')).toEqual(SHEET);
    expect(stripe.canTaxCustomer).toHaveBeenCalledWith('cus_a');
    expect(paymentSheets.forInvoice).toHaveBeenCalledWith(draftCharge);
  });

  it('passes on null when nothing is left to pay', async () => {
    const { service, paymentSheets } = setup();
    paymentSheets.forInvoice.mockResolvedValue(null);
    expect(await service.openPaymentSheet('invoice-final')).toBeNull();
  });

  it('is unavailable without a publishable key, before any Stripe call', async () => {
    const { service, paymentSheets, stripe } = setup();
    paymentSheets.isAvailable = false;
    expect(await service.openPaymentSheet('invoice-final')).toBe(
      PAYMENT_SHEET_UNAVAILABLE,
    );
    expect(stripe.canTaxCustomer).not.toHaveBeenCalled();
    expect(paymentSheets.forInvoice).not.toHaveBeenCalled();
  });

  it('is unavailable while Stripe Tax has no address for the customer (Checkout asks for one)', async () => {
    const { service, paymentSheets, stripe } = setup();
    stripe.canTaxCustomer.mockResolvedValue(false);
    expect(await service.openPaymentSheet('invoice-final')).toBe(
      PAYMENT_SHEET_UNAVAILABLE,
    );
    expect(paymentSheets.forInvoice).not.toHaveBeenCalled();
  });

  it('skips the tax check once the invoice is finalised on Stripe (its GST is fixed)', async () => {
    const { service, stripe } = setup();
    jest.mocked(findInvoice).mockResolvedValue({
      ...draftCharge,
      status: 'synced',
      stripe_invoice_id: 'in_a',
      hosted_invoice_url: 'https://invoice.stripe.com/i/a',
    } as Awaited<ReturnType<typeof findInvoice>>);
    expect(await service.openPaymentSheet('invoice-final')).toEqual(SHEET);
    expect(stripe.canTaxCustomer).not.toHaveBeenCalled();
  });

  it('turns a Stripe failure into a 502', async () => {
    const { service, stripe } = setup();
    stripe.canTaxCustomer.mockRejectedValue({
      type: 'StripeAPIError',
      message: 'down',
    });
    await expect(
      service.openPaymentSheet('invoice-final'),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
