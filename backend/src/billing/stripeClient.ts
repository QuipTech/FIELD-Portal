import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Stripe from 'stripe';

const NOT_CONFIGURED_MESSAGE = 'Billing is not configured (STRIPE_SECRET_KEY).';

// The one Stripe SDK client in the codebase. Only files in src/billing may
// import 'stripe' — enforced by ESLint (no-restricted-imports) and by
// stripeImportBoundary.spec.ts. Everything else reads app.entitlements.
@Injectable()
export class StripeClient {
  private client: Stripe | null = null;

  constructor(private readonly configService: ConfigService) {}

  isConfigured = (): boolean =>
    Boolean(this.configService.get<string>('STRIPE_SECRET_KEY'));

  require = (): Stripe => {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey)
      throw new ServiceUnavailableException(NOT_CONFIGURED_MESSAGE);
    this.client ??= new Stripe(secretKey);
    return this.client;
  };

  // Verifies the Stripe-Signature header against the raw request body;
  // throws on a bad or stale signature. Makes no API call.
  constructWebhookEvent = (
    rawBody: Buffer,
    signature: string,
  ): Stripe.Event => {
    const secret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret)
      throw new ServiceUnavailableException(
        'Billing webhooks are not configured (STRIPE_WEBHOOK_SECRET).',
      );
    return this.require().webhooks.constructEvent(rawBody, signature, secret);
  };
}
