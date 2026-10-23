import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';

// Isolated so the full billing module (plans, metering, entitlements) can
// sit on top of it later without touching how Stripe is reached.
@Module({
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}
