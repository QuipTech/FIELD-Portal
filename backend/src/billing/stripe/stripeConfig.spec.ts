import { ConfigService } from '@nestjs/config';
import {
  assertPublishableKeyMatches,
  assertStripeKeyAllowed,
  stripeModeOf,
} from './stripeConfig';
import { StripeService } from './stripe.service';

const LIVE_KEY = 'sk_live_example';
const RESTRICTED_LIVE_KEY = 'rk_live_example';
const TEST_KEY = 'sk_test_example';

const configWith = (values: Record<string, string>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

describe('Stripe live-key guard', () => {
  it.each(['development', 'staging', 'test', undefined])(
    'refuses a live key when NODE_ENV is %s',
    (nodeEnv) => {
      expect(() => assertStripeKeyAllowed(LIVE_KEY, nodeEnv)).toThrow(
        /Refusing to start/,
      );
    },
  );

  it('refuses a restricted live key outside production', () => {
    expect(() =>
      assertStripeKeyAllowed(RESTRICTED_LIVE_KEY, 'staging'),
    ).toThrow(/Refusing to start/);
  });

  it('allows a live key in production', () => {
    expect(() => assertStripeKeyAllowed(LIVE_KEY, 'production')).not.toThrow();
  });

  it('allows a test key anywhere, and no key at all', () => {
    expect(() => assertStripeKeyAllowed(TEST_KEY, 'staging')).not.toThrow();
    expect(() => assertStripeKeyAllowed(undefined, 'staging')).not.toThrow();
  });

  it('stops the app booting: StripeService refuses to construct', () => {
    const config = configWith({
      STRIPE_SECRET_KEY: LIVE_KEY,
      NODE_ENV: 'development',
    });
    expect(() => new StripeService(config)).toThrow(/Refusing to start/);
  });

  it('constructs with a test key outside production', () => {
    const config = configWith({
      STRIPE_SECRET_KEY: TEST_KEY,
      NODE_ENV: 'staging',
    });
    expect(() => new StripeService(config)).not.toThrow();
  });

  it('reports the mode from the key', () => {
    expect(stripeModeOf(TEST_KEY)).toBe('test');
    expect(stripeModeOf(LIVE_KEY)).toBe('live');
    expect(stripeModeOf(RESTRICTED_LIVE_KEY)).toBe('live');
    expect(stripeModeOf('rk_test_example')).toBe('test');
    expect(stripeModeOf(undefined)).toBe('not_configured');
  });
});

describe('Stripe publishable key guard', () => {
  it('accepts a publishable key from the same mode, or none at all', () => {
    expect(() =>
      assertPublishableKeyMatches(TEST_KEY, 'pk_test_example'),
    ).not.toThrow();
    expect(() =>
      assertPublishableKeyMatches(LIVE_KEY, 'pk_live_example'),
    ).not.toThrow();
    expect(() =>
      assertPublishableKeyMatches(TEST_KEY, undefined),
    ).not.toThrow();
  });

  it.each([
    [TEST_KEY, 'pk_live_example'],
    [LIVE_KEY, 'pk_test_example'],
    [RESTRICTED_LIVE_KEY, 'pk_test_example'],
  ])('refuses %s with %s (different modes)', (secret, publishable) => {
    expect(() => assertPublishableKeyMatches(secret, publishable)).toThrow(
      /same Stripe account and mode/,
    );
  });

  it('refuses a secret key put in the publishable key setting', () => {
    expect(() => assertPublishableKeyMatches(TEST_KEY, TEST_KEY)).toThrow(
      /Never put a secret key there/,
    );
  });

  it('stops the app booting on a mismatch, and exposes a matching key', () => {
    expect(
      () =>
        new StripeService(
          configWith({
            STRIPE_SECRET_KEY: TEST_KEY,
            STRIPE_PUBLISHABLE_KEY: 'pk_live_example',
            NODE_ENV: 'staging',
          }),
        ),
    ).toThrow(/Refusing to start/);
    const service = new StripeService(
      configWith({
        STRIPE_SECRET_KEY: TEST_KEY,
        STRIPE_PUBLISHABLE_KEY: 'pk_test_example',
        NODE_ENV: 'staging',
      }),
    );
    expect(service.publishableKey).toBe('pk_test_example');
  });
});
