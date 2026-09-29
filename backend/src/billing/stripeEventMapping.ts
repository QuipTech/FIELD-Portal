import * as Stripe from 'stripe';

// Pure translation of Stripe objects into what we store — no I/O, so it's
// unit-testable with plain objects.

const toIsoDay = (unixSeconds: number): string =>
  new Date(unixSeconds * 1000).toISOString().slice(0, 10);

export const customerIdOf = (customer: string | { id: string }): string =>
  typeof customer === 'string' ? customer : customer.id;

export interface SubscriptionSnapshot {
  customerId: string;
  priceId: string | undefined;
  tenantIdHint: string | undefined;
  startsOn: string;
  // null while it renews indefinitely; set once it's cancelled or ending.
  endsOn: string | null;
  stripeStatus: string;
}

export const toSubscriptionSnapshot = (
  subscription: Stripe.Subscription,
  isDeleted: boolean,
): SubscriptionSnapshot => {
  const endsAt = subscription.ended_at ?? subscription.cancel_at;
  return {
    customerId: customerIdOf(subscription.customer),
    priceId: subscription.items?.data?.[0]?.price?.id,
    tenantIdHint: subscription.metadata?.tenant_id || undefined,
    startsOn: toIsoDay(subscription.start_date),
    endsOn: endsAt
      ? toIsoDay(endsAt)
      : isDeleted
        ? new Date().toISOString().slice(0, 10)
        : null,
    stripeStatus: isDeleted ? 'canceled' : subscription.status,
  };
};

export const SUBSCRIPTION_EVENTS = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
];

export const INVOICE_EVENTS = [
  'invoice.created',
  'invoice.updated',
  'invoice.finalized',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.voided',
  'invoice.marked_uncollectible',
];

export const CUSTOMER_EVENTS = ['customer.created', 'customer.updated'];
