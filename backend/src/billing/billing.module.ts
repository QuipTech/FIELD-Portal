import { Module } from '@nestjs/common';
import { StripeClient } from './stripeClient';
import { StripeWebhookController } from './stripeWebhook.controller';
import { StripeWebhookService } from './stripeWebhook.service';

// The only module that talks to Stripe. It keeps app.subscriptions and
// app.entitlements in step with Stripe; nothing else reads Stripe.
@Module({
  controllers: [StripeWebhookController],
  providers: [StripeClient, StripeWebhookService],
})
export class BillingModule {}
