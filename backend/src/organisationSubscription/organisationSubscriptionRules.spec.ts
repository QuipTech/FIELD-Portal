import { toOrganisationSubscription } from './organisationSubscriptionRules';
import { OrganisationSubscriptionRow } from './types/organisationSubscriptionResponse';

const TODAY = '2026-09-29';

const row = (
  overrides: Partial<OrganisationSubscriptionRow>,
): OrganisationSubscriptionRow => ({
  tier: 'standard',
  plan_name: 'Standard',
  billing_basis: 'per_asset',
  licensed_assets: null,
  ends_on: new Date(2027, 3, 14),
  source: 'stripe',
  stripe_status: 'active',
  asset_count: '42',
  ...overrides,
});

describe('toOrganisationSubscription', () => {
  it('reports an active paid plan with its renewal date', () => {
    const result = toOrganisationSubscription(row({}), TODAY);
    expect(result).toMatchObject({
      status: 'active',
      planName: 'Standard',
      endsOn: '2027-04-14',
      renewsAutomatically: true,
      assetCount: 42,
    });
  });

  it('is the free plan when the organisation never subscribed', () => {
    const result = toOrganisationSubscription(
      row({ tier: null, plan_name: null, ends_on: null, source: null }),
      TODAY,
    );
    expect(result).toMatchObject({
      status: 'free',
      planCode: 'free',
      lapsedPlanName: null,
    });
  });

  it('falls back to free once the term has ended', () => {
    const result = toOrganisationSubscription(
      row({ ends_on: new Date(2026, 8, 28), source: 'manual' }),
      TODAY,
    );
    expect(result).toMatchObject({
      status: 'free',
      lapsedPlanName: 'Standard',
    });
  });

  it('keeps the last day of the term active', () => {
    const result = toOrganisationSubscription(
      row({ ends_on: new Date(2026, 8, 29) }),
      TODAY,
    );
    expect(result.status).toBe('expiring_soon');
  });

  it('falls back to free when Stripe cancelled the subscription', () => {
    const result = toOrganisationSubscription(
      row({ stripe_status: 'canceled' }),
      TODAY,
    );
    expect(result.status).toBe('free');
  });
});
