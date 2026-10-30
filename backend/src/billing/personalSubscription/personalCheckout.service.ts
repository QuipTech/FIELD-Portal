import { Injectable } from '@nestjs/common';
import * as Stripe from 'stripe';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { getPortalOrigins } from '../../common/security/portalOrigins';
import { listInvoiceLines } from '../invoices/invoices.repository';
import { InvoiceRow } from '../invoices/types/invoiceRows';
import { StripeService } from '../stripe/stripe.service';
import { checkoutCreateKey } from '../stripe/stripeIdempotencyKeys';
import { toInvoiceEventUpdate } from '../webhooks/stripeInvoiceEvents';
import { applyInvoiceEventUpdate } from '../webhooks/stripeWebhookEvents.repository';
import { ReturnTo, returnPagePath } from '../appReturn';

// The page Stripe returns the payer to. Only a configured portal origin is
// used, so the payment can't be pointed at someone else's site.
export const toReturnOrigin = (requested: string | undefined): string => {
  const origins = getPortalOrigins();
  return requested && origins.includes(requested) ? requested : origins[0];
};

const isPaid = (session: Stripe.Checkout.Session) =>
  session.status === 'complete' && session.payment_status === 'paid';

// Stripe Checkout for a personal invoice: unlike the hosted invoice page it
// sends the payer straight back to the portal once they have paid.
@Injectable()
export class PersonalCheckoutService {
  constructor(
    private readonly database: ServiceDatabaseService,
    private readonly stripe: StripeService,
  ) {}

  // The Checkout URL to pay with, or null when Stripe already has the
  // payment (then recorded here, in case its webhook hasn't arrived).
  openCheckout = async (
    invoice: InvoiceRow,
    customerId: string,
    returnOrigin: string,
    returnTo: ReturnTo = 'portal',
  ): Promise<string | null> => {
    const returnPage = `${returnOrigin}${returnPagePath(returnTo)}`;
    const successUrl = `${returnPage}?payment=complete`;
    const sessions = await this.stripe.listCheckoutSessions(
      customerId,
      invoice.id,
    );
    const paid = sessions.find(isPaid);
    if (paid) {
      await this.recordPayment(paid);
      return null;
    }
    // Only a session that returns to the same place: a portal session would
    // strand an app payer on the website, and the other way round.
    const open = sessions.find(
      (session) =>
        session.status === 'open' && session.success_url === successUrl,
    );
    if (open?.url) return open.url;
    const lines = await listInvoiceLines(this.database, invoice.id);
    const created = await this.stripe.createCheckoutSession(
      {
        customerId,
        currency: invoice.currency,
        amountCents: lines.reduce(
          (sum, line) => sum + Number(line.amount_cents),
          0,
        ),
        description: lines[0]?.description ?? 'FIELD Technician subscription',
        fieldInvoiceId: invoice.id,
        successUrl,
        cancelUrl: `${returnPage}?payment=cancelled`,
      },
      checkoutCreateKey(
        invoice.id,
        sessions.length,
        returnTo === 'app' ? `${returnOrigin}:app` : returnOrigin,
      ),
    );
    return created.url;
  };

  // True when a completed Checkout payment for the invoice was found and
  // recorded, exactly as the invoice.paid webhook would record it.
  confirmPayment = async (
    invoice: InvoiceRow,
    customerId: string,
  ): Promise<boolean> => {
    const sessions = await this.stripe.listCheckoutSessions(
      customerId,
      invoice.id,
    );
    const paid = sessions.find(isPaid);
    return paid ? this.recordPayment(paid) : false;
  };

  private recordPayment = async (
    session: Stripe.Checkout.Session,
  ): Promise<boolean> => {
    const invoiceId =
      typeof session.invoice === 'string'
        ? session.invoice
        : session.invoice?.id;
    if (!invoiceId) return false;
    const stripeInvoice = await this.stripe.retrieveInvoice(invoiceId);
    if (stripeInvoice.status !== 'paid') return false;
    return this.database.transaction((client) =>
      applyInvoiceEventUpdate(
        client,
        toInvoiceEventUpdate('invoice.paid', stripeInvoice),
      ),
    );
  };
}
