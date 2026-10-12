import { Injectable, Logger } from '@nestjs/common';
import { PoolClient } from 'pg';
import * as Stripe from 'stripe';
import { ServiceDatabaseService } from '../database/serviceDatabase.service';
import * as billingSync from './billingSync.repository';
import {
  CUSTOMER_EVENTS,
  customerIdOf,
  INVOICE_EVENTS,
  SUBSCRIPTION_EVENTS,
  toSubscriptionSnapshot,
} from './stripeEventMapping';

// Thrown for an event we understand but can't apply (e.g. a customer with
// no tenant mapped) — logged as 'ignored', acknowledged to Stripe.
class IgnoredEvent extends Error {}

// Applies verified Stripe events to billing.* and app.* in one
// transaction per event. Each event is applied at most once; a failed one
// is recorded and retried when Stripe redelivers it.
@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(private readonly serviceDatabase: ServiceDatabaseService) {}

  handleEvent = async (event: Stripe.Event): Promise<{ status: string }> => {
    const record = { id: event.id, type: event.type, payload: event };
    try {
      const status = await this.serviceDatabase.transaction(async (client) => {
        if (!(await billingSync.claimWebhookEvent(client, record)))
          return 'duplicate';
        await this.applyEvent(client, event);
        return 'processed';
      });
      return { status };
    } catch (error) {
      const isIgnored = error instanceof IgnoredEvent;
      await this.serviceDatabase.transaction((client) =>
        billingSync.markWebhookEvent(client, {
          ...record,
          status: isIgnored ? 'ignored' : 'failed',
          error: String(error instanceof Error ? error.message : error),
        }),
      );
      if (isIgnored) return { status: 'ignored' };
      this.logger.error(
        `Stripe event ${event.id} (${event.type}) failed: ${String(error)}`,
      );
      throw error;
    }
  };

  private applyEvent = async (
    client: PoolClient,
    event: Stripe.Event,
  ): Promise<void> => {
    if (CUSTOMER_EVENTS.includes(event.type))
      return this.applyCustomer(client, event.data.object as Stripe.Customer);
    if (SUBSCRIPTION_EVENTS.includes(event.type)) {
      const isDeleted = event.type === 'customer.subscription.deleted';
      return this.applySubscription(
        client,
        event.data.object as Stripe.Subscription,
        isDeleted,
      );
    }
    if (INVOICE_EVENTS.includes(event.type))
      return this.applyInvoice(client, event.data.object as Stripe.Invoice);
    throw new IgnoredEvent(`Event type ${event.type} isn't handled.`);
  };

  // Customers are tied to an organisation by metadata.tenant_id, set when
  // the customer is created (Dashboard or checkout).
  private applyCustomer = async (
    client: PoolClient,
    customer: Stripe.Customer,
  ): Promise<void> => {
    const tenantId = customer.metadata?.tenant_id;
    if (!tenantId)
      throw new IgnoredEvent(
        `Customer ${customer.id} has no metadata.tenant_id.`,
      );
    await billingSync.linkStripeCustomer(client, {
      tenantId,
      stripeCustomerId: customer.id,
    });
  };

  private applySubscription = async (
    client: PoolClient,
    subscription: Stripe.Subscription,
    isDeleted: boolean,
  ): Promise<void> => {
    const snapshot = toSubscriptionSnapshot(subscription, isDeleted);
    if (snapshot.tenantIdHint) {
      await billingSync.linkStripeCustomer(client, {
        tenantId: snapshot.tenantIdHint,
        stripeCustomerId: snapshot.customerId,
      });
    }
    const tenantId = await billingSync.findTenantForCustomer(
      client,
      snapshot.customerId,
    );
    if (!tenantId)
      throw new IgnoredEvent(
        `No organisation is linked to Stripe customer ${snapshot.customerId}.`,
      );
    const planCode = snapshot.priceId
      ? await billingSync.findPlanForPrice(client, snapshot.priceId)
      : undefined;
    if (!planCode)
      throw new IgnoredEvent(
        `Price ${snapshot.priceId ?? '(none)'} isn't mapped to a plan (platform.plans.stripe_price_id).`,
      );
    await billingSync.syncStripeSubscription(client, {
      tenantId,
      planCode,
      startsOn: snapshot.startsOn,
      endsOn: snapshot.endsOn,
      stripeStatus: snapshot.stripeStatus,
    });
  };

  private applyInvoice = async (
    client: PoolClient,
    invoice: Stripe.Invoice,
  ): Promise<void> => {
    if (!invoice.id || !invoice.customer)
      throw new IgnoredEvent('Invoice without an id or customer.');
    const customerId = customerIdOf(invoice.customer);
    await billingSync.upsertStripeInvoice(client, {
      id: invoice.id,
      tenantId: await billingSync.findTenantForCustomer(client, customerId),
      customerId,
      status: invoice.status,
      currency: invoice.currency,
      amountDue: invoice.amount_due,
      amountPaid: invoice.amount_paid,
      hostedUrl: invoice.hosted_invoice_url ?? null,
      periodStart: new Date(invoice.period_start * 1000),
      periodEnd: new Date(invoice.period_end * 1000),
    });
  };
}
