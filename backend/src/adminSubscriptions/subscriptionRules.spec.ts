import { BadRequestException } from '@nestjs/common';
import {
  assertConsistentSubscription,
  daysBetween,
  deriveSubscriptionStatus,
  toTenantSubscription,
} from './subscriptionRules';
import { UpsertSubscriptionDto } from './dto/upsertSubscriptionDto';
import { TenantSubscriptionRow } from './types/subscriptionRows';

describe('deriveSubscriptionStatus', () => {
  it('reads the end date against the 30-day window', () => {
    expect(deriveSubscriptionStatus(false, null)).toBe('not_set_up');
    expect(deriveSubscriptionStatus(true, null)).toBe('active');
    expect(deriveSubscriptionStatus(true, 31)).toBe('active');
    expect(deriveSubscriptionStatus(true, 30)).toBe('expiring_soon');
    expect(deriveSubscriptionStatus(true, 0)).toBe('expiring_soon');
    expect(deriveSubscriptionStatus(true, -1)).toBe('expired');
  });
});

describe('daysBetween', () => {
  it('counts calendar days, including across month ends', () => {
    expect(daysBetween('2027-02-20', '2027-03-22')).toBe(30);
    expect(daysBetween('2027-02-20', '2027-02-08')).toBe(-12);
  });
});

const row = (
  overrides: Partial<TenantSubscriptionRow> = {},
): TenantSubscriptionRow => ({
  tenant_id: 't1',
  tenant_name: 'Baxley Plant Co.',
  subscription_id: 's1',
  tier: 'pilot',
  billing_basis: 'fixed_fee',
  licensed_assets: null,
  starts_on: new Date(2027, 0, 21),
  ends_on: new Date(2027, 2, 22),
  ai_monthly_query_allowance: 1000,
  wearable_seats: 2,
  remote_expert_seats: 0,
  sso_enabled: false,
  notes: null,
  updated_at: new Date('2027-01-21T00:00:00Z'),
  asset_count: '5',
  queries_this_month: '890',
  ...overrides,
});

describe('toTenantSubscription', () => {
  it('maps a subscription and works out its status', () => {
    const result = toTenantSubscription(row(), '2027-02-20');
    expect(result.status).toBe('expiring_soon');
    expect(result.daysUntilEnd).toBe(30);
    expect(result.subscription).toMatchObject({
      tier: 'pilot',
      startsOn: '2027-01-21',
      endsOn: '2027-03-22',
    });
    expect(result.aiQueriesThisMonth).toBe(890);
  });

  it('reports an organisation without a subscription as not set up', () => {
    const result = toTenantSubscription(
      row({ subscription_id: null, tier: null, ends_on: null }),
      '2027-02-20',
    );
    expect(result).toMatchObject({
      status: 'not_set_up',
      subscription: null,
      daysUntilEnd: null,
    });
  });
});

describe('assertConsistentSubscription', () => {
  const dto = (overrides: Partial<UpsertSubscriptionDto>) =>
    Object.assign(new UpsertSubscriptionDto(), {
      tier: 'standard',
      billingBasis: 'per_asset',
      startsOn: '2027-01-01',
      ...overrides,
    });

  it('accepts a complete subscription and a demo without billing', () => {
    expect(() => assertConsistentSubscription(dto({}))).not.toThrow();
    expect(() =>
      assertConsistentSubscription(dto({ tier: 'demo', billingBasis: null })),
    ).not.toThrow();
  });

  it('rejects missing billing, a negotiated deal without assets, and an end before the start', () => {
    expect(() =>
      assertConsistentSubscription(dto({ billingBasis: null })),
    ).toThrow(BadRequestException);
    expect(() =>
      assertConsistentSubscription(dto({ billingBasis: 'negotiated' })),
    ).toThrow(BadRequestException);
    expect(() =>
      assertConsistentSubscription(dto({ endsOn: '2026-12-31' })),
    ).toThrow(BadRequestException);
    expect(() =>
      assertConsistentSubscription(dto({ endsOn: '2027-02-30' })),
    ).toThrow(BadRequestException);
  });
});
