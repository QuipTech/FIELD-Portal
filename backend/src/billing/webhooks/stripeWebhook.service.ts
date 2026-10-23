import { Injectable, Logger } from '@nestjs/common';
import { PoolClient } from 'pg';
import * as Stripe from 'stripe';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { StripeService } from '../stripe/stripe.service';
import * as webhookEventsRepository from './stripeWebhookEvents.repository';
import {
  CHARGE_REFUNDED_EVENT,
  isInvoiceStatusEvent,
  paymentIntentIdOf,
  toInvoiceEventUpdate,
} from './stripeInvoiceEvents';

export type WebhookOutcome = 'processed' | 'duplicate' | 'ignored';

// Applies a verified Stripe event to our invoice — status and totals,
// nothing else (never subscriptions, entitlements or user access). The
// event id is saved first, in the same transaction, so each event is
// applied at most once; a failure rolls everything back and Stripe's retry
// gets a clean attempt.
@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly stripeService: StripeService,
  ) {}

  handleEvent = (event: Stripe.Event): Promise<{ status: WebhookOutcome }> =>
    this.serviceDatabase.transaction(async (client) => {
      const isFirstDelivery = await webhookEventsRepository.claimWebhookEvent(
        client,
        { id: event.id, type: event.type },
      );
      if (!isFirstDelivery) return { status: 'duplicate' };
      const isApplied = await this.applyEvent(client, event);
      if (!isApplied)
        this.logger.log(`Stripe event ${event.id} (${event.type}) ignored.`);
      return { status: isApplied ? 'processed' : 'ignored' };
    });

  // False when the event isn't handled or isn't about one of our invoices.
  private applyEvent = async (
    client: PoolClient,
    event: Stripe.Event,
  ): Promise<boolean> => {
    if (isInvoiceStatusEvent(event.type)) {
      return webhookEventsRepository.applyInvoiceEventUpdate(
        client,
        toInvoiceEventUpdate(event.type, event.data.object as Stripe.Invoice),
      );
    }
    if (event.type === CHARGE_REFUNDED_EVENT)
      return this.applyRefund(client, event.data.object as Stripe.Charge);
    return false;
  };

  private applyRefund = async (
    client: PoolClient,
    charge: Stripe.Charge,
  ): Promise<boolean> => {
    const paymentIntentId = paymentIntentIdOf(charge);
    if (!paymentIntentId) return false;
    const stripeInvoiceId =
      await this.stripeService.findInvoiceIdForPaymentIntent(paymentIntentId);
    if (!stripeInvoiceId) return false;
    return webhookEventsRepository.saveAmountRefunded(
      client,
      stripeInvoiceId,
      charge.amount_refunded,
    );
  };
}
