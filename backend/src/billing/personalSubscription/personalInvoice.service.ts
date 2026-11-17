import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { BillingAccountsService } from '../billingAccounts/billingAccounts.service';
import { findInvoice } from '../invoices/invoices.repository';
import { InvoiceRow } from '../invoices/types/invoiceRows';
import {
  InvoicePaymentSheetService,
  PaymentSheet,
} from '../invoices/invoicePaymentSheet.service';
import { StripeService } from '../stripe/stripe.service';
import { toStripeGatewayError } from '../stripe/stripeErrors';
import { PriceBooksService } from '../priceBooks/priceBooks.service';
import {
  findPersonalInvoiceHistory,
  findPersonalPeriods,
} from './personalSubscription.repository';
import { PersonalSubscriptionService } from './personalSubscription.service';
import {
  PersonalCheckoutService,
  toReturnOrigin,
} from './personalCheckout.service';
import { PersonalPaymentDto } from './personalPaymentDto';
import {
  needsReplacementInvoice,
  PersonalBillingStatus,
} from './personalSubscriptionTypes';
import {
  createPersonalInvoiceDraft,
  ensurePersonalAccount,
  replacePersonalPeriod,
} from './personalInvoiceDraft';

export type PersonalPaymentResponse = PersonalBillingStatus & {
  paymentUrl: string | null;
  paymentSheet: PaymentSheet | null;
};

@Injectable()
export class PersonalInvoiceService {
  constructor(
    private readonly database: ServiceDatabaseService,
    private readonly subscriptions: PersonalSubscriptionService,
    private readonly accounts: BillingAccountsService,
    private readonly checkout: PersonalCheckoutService,
    private readonly stripe: StripeService,
    private readonly priceBooks: PriceBooksService,
    private readonly paymentSheets: InvoicePaymentSheetService,
  ) {}

  // paymentSheet is only for the mobile app (returnTo 'app'); the portal
  // keeps Stripe Checkout, which brings the payer back to the portal.
  createPayment = async (
    actor: AuthenticatedUser,
    address: PersonalPaymentDto,
  ): Promise<PersonalPaymentResponse> => {
    const status = await this.subscriptions.getStatus(actor);
    if (status.exempt)
      throw new ForbiddenException(
        'Owners do not require a personal subscription.',
      );
    if (!status.paymentRequired)
      return { ...status, paymentUrl: null, paymentSheet: null };
    const invoiceId = await this.prepareInvoice(actor, status);
    const invoice = await findInvoice(this.database, invoiceId);
    if (!invoice) throw new NotFoundException('Invoice not found.');
    if (invoice.status === 'void' || invoice.status === 'paid') {
      throw new BadRequestException(
        'This invoice needs a billing administrator to review it. Please contact support.',
      );
    }
    if (address.returnTo === 'app' && this.paymentSheets.isAvailable)
      return this.payInApp(actor, invoice, address);
    // Invoices sent to Stripe before Checkout keep their hosted invoice page.
    if (invoice.hosted_invoice_url) {
      const fresh = await this.subscriptions.getStatus(actor);
      return {
        ...fresh,
        paymentUrl: fresh.paymentRequired ? invoice.hosted_invoice_url : null,
        paymentSheet: null,
      };
    }
    let paymentUrl: string | null;
    try {
      const account = await this.accounts.ensureStripeCustomer(
        await this.accounts.requireAccount(invoice.billing_account_id),
      );
      await this.stripe.updateBillingAddress(
        account.stripe_customer_id!,
        address,
      );
      paymentUrl = await this.checkout.openCheckout(
        invoice,
        account.stripe_customer_id!,
        toReturnOrigin(address.returnOrigin),
        address.returnTo ?? 'portal',
      );
    } catch (error) {
      throw toStripeGatewayError(error);
    }
    const fresh = await this.subscriptions.getStatus(actor);
    return {
      ...fresh,
      paymentUrl: fresh.paymentRequired ? paymentUrl : null,
      paymentSheet: null,
    };
  };

  // The month's invoice becomes a Stripe Invoice the app pays in the
  // Payment Sheet, through the invoice's own PaymentIntent. paymentUrl is
  // that same invoice's hosted page (older app builds), so both pay one
  // invoice and it can't be paid twice.
  private payInApp = async (
    actor: AuthenticatedUser,
    invoice: InvoiceRow,
    address: PersonalPaymentDto,
  ): Promise<PersonalPaymentResponse> => {
    let paymentSheet: PaymentSheet | null;
    try {
      // GST is worked out when the Stripe invoice is finalised, so the
      // address goes first. A finalised invoice keeps the tax it has.
      if (!invoice.stripe_invoice_id) {
        const account = await this.accounts.ensureStripeCustomer(
          await this.accounts.requireAccount(invoice.billing_account_id),
        );
        await this.stripe.updateBillingAddress(
          account.stripe_customer_id!,
          address,
        );
      }
      paymentSheet = await this.paymentSheets.forInvoice(invoice);
    } catch (error) {
      throw toStripeGatewayError(error);
    }
    const fresh = await this.subscriptions.getStatus(actor);
    if (!fresh.paymentRequired)
      return { ...fresh, paymentUrl: null, paymentSheet: null };
    return { ...fresh, paymentUrl: fresh.hostedInvoiceUrl, paymentSheet };
  };

  // POST /me/billing/invoices/:invoiceId/payment-sheet: pays an earlier
  // invoice that is still unpaid. Only the caller's own invoices.
  paymentSheetForInvoice = async (
    actor: AuthenticatedUser,
    invoiceId: string,
  ): Promise<{ paymentSheet: PaymentSheet | null }> => {
    const period = (
      await findPersonalInvoiceHistory(this.database, actor)
    ).find((item) => item.invoice_id === invoiceId);
    if (!period) throw new NotFoundException('Invoice not found.');
    if (
      period.status === 'paid' ||
      period.status === 'void' ||
      Number(period.amount_refunded_cents) > 0
    )
      return { paymentSheet: null };
    const invoice = await findInvoice(this.database, invoiceId);
    if (!invoice) throw new NotFoundException('Invoice not found.');
    return { paymentSheet: await this.paymentSheets.forInvoice(invoice) };
  };

  private prepareInvoice = (
    actor: AuthenticatedUser,
    status: PersonalBillingStatus,
  ): Promise<string> =>
    this.database.transaction(async (client) => {
      // One lock per user: different browser tabs and retries reuse one invoice.
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [`personal-billing:${actor.userId}`],
      );
      const periods = await findPersonalPeriods(client, actor);
      const existing = periods.find(
        (period) => period.period_start === status.periodStart,
      );
      if (existing && !needsReplacementInvoice(existing))
        return existing.invoice_id;
      if (existing) await replacePersonalPeriod(client, actor, existing);
      const accountId = await ensurePersonalAccount(
        client,
        actor,
        status.timezone,
      );
      if (!status.priceBookId)
        throw new BadRequestException('The TECH price book is not configured.');
      const book = await this.priceBooks.getPinnedPriceBook(status.priceBookId);
      if (
        book.unitCents === null ||
        !Number.isSafeInteger(book.unitCents) ||
        book.unitCents < 0
      )
        throw new BadRequestException('The TECH price book is not configured.');
      return createPersonalInvoiceDraft(client, actor, {
        accountId,
        priceBookId: book.id,
        unitCents: book.unitCents,
        status,
      });
    });
}
