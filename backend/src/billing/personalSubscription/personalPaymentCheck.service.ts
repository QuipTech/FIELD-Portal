import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { BillingAccountsService } from '../billingAccounts/billingAccounts.service';
import { findInvoice } from '../invoices/invoices.repository';
import { InvoiceRow } from '../invoices/types/invoiceRows';
import { StripeService } from '../stripe/stripe.service';
import { toStripeGatewayError } from '../stripe/stripeErrors';
import { toInvoiceEventUpdate } from '../webhooks/stripeInvoiceEvents';
import { applyInvoiceEventUpdate } from '../webhooks/stripeWebhookEvents.repository';
import { PersonalSubscriptionService } from './personalSubscription.service';
import { PersonalCheckoutService } from './personalCheckout.service';

// "I've paid — check status" and the return from Checkout: asks Stripe
// about this month's payment, so one whose webhook was missed still unlocks
// the portal. Stripe's own invoice is applied exactly as the invoice.paid
// webhook would apply it.
@Injectable()
export class PersonalPaymentCheckService {
  constructor(
    private readonly database: ServiceDatabaseService,
    private readonly subscriptions: PersonalSubscriptionService,
    private readonly stripe: StripeService,
    private readonly accounts: BillingAccountsService,
    private readonly checkout: PersonalCheckoutService,
  ) {}

  checkPayment = async (actor: AuthenticatedUser) => {
    const status = await this.subscriptions.getStatus(actor);
    if (!status.paymentRequired || !status.invoiceId) return status;
    const invoice = await findInvoice(this.database, status.invoiceId);
    if (!invoice) return status;
    let recorded: boolean;
    try {
      recorded = invoice.stripe_invoice_id
        ? await this.recordHostedInvoice(invoice.stripe_invoice_id)
        : await this.recordCheckout(invoice);
    } catch (error) {
      throw toStripeGatewayError(error);
    }
    return recorded ? this.subscriptions.getStatus(actor) : status;
  };

  // An invoice sent to Stripe and paid on its hosted invoice page.
  private recordHostedInvoice = async (stripeInvoiceId: string) => {
    const stripeInvoice = await this.stripe.retrieveInvoice(stripeInvoiceId);
    if (stripeInvoice.status !== 'paid') return false;
    return this.database.transaction((client) =>
      applyInvoiceEventUpdate(
        client,
        toInvoiceEventUpdate('invoice.paid', stripeInvoice),
      ),
    );
  };

  private recordCheckout = async (invoice: InvoiceRow) => {
    const account = await this.accounts.requireAccount(
      invoice.billing_account_id,
    );
    if (!account.stripe_customer_id) return false;
    return this.checkout.confirmPayment(invoice, account.stripe_customer_id);
  };
}
