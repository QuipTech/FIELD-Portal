import { ConfigService } from '@nestjs/config';

export type StripeMode = 'test' | 'live' | 'not_configured';

export interface StripeSettings {
  secretKey: string | undefined;
  webhookSecret: string | undefined;
  isTaxEnabled: boolean;
  mode: StripeMode;
}

// Secret (sk_) and restricted (rk_) keys both charge real cards in live mode.
const LIVE_KEY_PREFIXES = ['sk_live_', 'rk_live_'];
const PRODUCTION_ENVIRONMENT = 'production';

export const stripeModeOf = (secretKey: string | undefined): StripeMode => {
  if (!secretKey) return 'not_configured';
  return LIVE_KEY_PREFIXES.some((prefix) => secretKey.startsWith(prefix))
    ? 'live'
    : 'test';
};

// A live key outside production would charge real cards from a dev or
// staging box, so the app refuses to start rather than run like that.
export const assertStripeKeyAllowed = (
  secretKey: string | undefined,
  nodeEnv: string | undefined,
): void => {
  if (
    stripeModeOf(secretKey) === 'live' &&
    nodeEnv !== PRODUCTION_ENVIRONMENT
  ) {
    throw new Error(
      `Refusing to start: a live Stripe key (sk_live_ / rk_live_) is set but NODE_ENV is "${nodeEnv ?? 'unset'}". Live keys are allowed only in production.`,
    );
  }
};

export const readStripeSettings = (
  configService: ConfigService,
): StripeSettings => {
  const secretKey = configService.get<string>('STRIPE_SECRET_KEY') || undefined;
  return {
    secretKey,
    webhookSecret:
      configService.get<string>('STRIPE_WEBHOOK_SECRET') || undefined,
    isTaxEnabled: configService.get<string>('STRIPE_TAX_ENABLED') === 'true',
    mode: stripeModeOf(secretKey),
  };
};
