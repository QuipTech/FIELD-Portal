import { ConfigService } from '@nestjs/config';

export type StripeMode = 'test' | 'live' | 'not_configured';

export interface StripeSettings {
  secretKey: string | undefined;
  webhookSecret: string | undefined;
  // pk_ key handed to the mobile app's Payment Sheet. Public by design; it
  // must belong to the same Stripe account and mode as secretKey.
  publishableKey: string | undefined;
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

// A pk_test_ key with a live secret key (or the other way round) makes
// every Payment Sheet fail, so the app refuses to start rather than run
// like that. An unset publishable key is allowed: payments then fall back
// to the hosted invoice page.
export const assertPublishableKeyMatches = (
  secretKey: string | undefined,
  publishableKey: string | undefined,
): void => {
  if (!publishableKey) return;
  if (!publishableKey.startsWith('pk_')) {
    throw new Error(
      'Refusing to start: STRIPE_PUBLISHABLE_KEY must be a publishable key (pk_test_ / pk_live_). Never put a secret key there.',
    );
  }
  const mode = stripeModeOf(secretKey);
  const publishableMode = publishableKey.startsWith('pk_live_')
    ? 'live'
    : 'test';
  if (mode !== 'not_configured' && mode !== publishableMode) {
    throw new Error(
      `Refusing to start: STRIPE_PUBLISHABLE_KEY is a ${publishableMode} key but STRIPE_SECRET_KEY is a ${mode} key. Both must come from the same Stripe account and mode.`,
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
    publishableKey:
      configService.get<string>('STRIPE_PUBLISHABLE_KEY') || undefined,
    isTaxEnabled: configService.get<string>('STRIPE_TAX_ENABLED') === 'true',
    mode: stripeModeOf(secretKey),
  };
};
