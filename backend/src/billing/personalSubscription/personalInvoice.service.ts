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
import { StripeService } from '../stripe/stripe.service';
import { toStripeGatewayError } from '../stripe/stripeErrors';
import { PriceBooksService } from '../priceBooks/priceBooks.service';
import { findPersonalPeriods } from './personalSubscription.repository';
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

@Injectable()
export class PersonalInvoiceService {
  constructor(
    private readonly database: ServiceDatabaseService,
    private readonly subscriptions: PersonalSubscriptionService,
    private readonly accounts: BillingAccountsService,
    private readonly checkout: PersonalCheckoutService,
    private readonly stripe: StripeService,
    private readonly priceBooks: PriceBooksService,
  ) {}

  createPayment = async (
    actor: AuthenticatedUser,
    address: PersonalPaymentDto,
  ) => {
    const status = await this.subscriptions.getStatus(actor);
    if (status.exempt)
      throw new ForbiddenException(
        'Owners do not require a personal subscription.',
      );
    if (!status.paymentRequired) return { ...status, paymentUrl: null };
    const invoiceId = await this.prepareInvoice(actor, status);
    const invoice = await findInvoice(this.database, invoiceId);
    if (!invoice) throw new NotFoundException('Invoice not found.');
    if (invoice.status === 'void' || invoice.status === 'paid') {
      throw new BadRequestException(
        'This invoice needs a billing administrator to review it. Please contact support.',
      );
    }
    // Invoices sent to Stripe before Checkout keep their hosted invoice page.
    if (invoice.hosted_invoice_url) {
      const fresh = await this.subscriptions.getStatus(actor);
      return {
        ...fresh,
        paymentUrl: fresh.paymentRequired ? invoice.hosted_invoice_url : null,
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
      );
    } catch (error) {
      throw toStripeGatewayError(error);
    }
    const fresh = await this.subscriptions.getStatus(actor);
    return { ...fresh, paymentUrl: fresh.paymentRequired ? paymentUrl : null };
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
