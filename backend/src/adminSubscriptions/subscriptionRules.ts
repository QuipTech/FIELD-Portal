import { BadRequestException } from '@nestjs/common';
import { toIsoDay } from '../common/utils/toIsoDay';
import { UpsertSubscriptionDto } from './dto/upsertSubscriptionDto';
import { TenantSubscriptionRow } from './types/subscriptionRows';
import {
  BillingBasis,
  SubscriptionStatus,
  SubscriptionTier,
  TenantSubscription,
} from './types/subscriptionResponse';

// A subscription ending within this many days is "Expiring soon".
export const EXPIRING_SOON_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// Whole days from `today` to `endsOn`, both YYYY-MM-DD (UTC calendar days).
export const daysBetween = (today: string, endsOn: string): number =>
  Math.round((Date.parse(endsOn) - Date.parse(today)) / DAY_MS);

// The last day of the term still counts as active.
export const deriveSubscriptionStatus = (
  hasSubscription: boolean,
  daysUntilEnd: number | null,
): SubscriptionStatus => {
  if (!hasSubscription) return 'not_set_up';
  if (daysUntilEnd === null) return 'active';
  if (daysUntilEnd < 0) return 'expired';
  return daysUntilEnd <= EXPIRING_SOON_DAYS ? 'expiring_soon' : 'active';
};

export const toTenantSubscription = (
  row: TenantSubscriptionRow,
  today: string,
): TenantSubscription => {
  const hasSubscription = row.subscription_id !== null && row.tier !== null;
  const endsOn = row.ends_on ? toIsoDay(row.ends_on) : null;
  const daysUntilEnd =
    hasSubscription && endsOn ? daysBetween(today, endsOn) : null;
  return {
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    status: deriveSubscriptionStatus(hasSubscription, daysUntilEnd),
    daysUntilEnd,
    subscription: hasSubscription
      ? {
          tier: row.tier as SubscriptionTier,
          billingBasis: row.billing_basis as BillingBasis | null,
          licensedAssets: row.licensed_assets,
          startsOn: row.starts_on ? toIsoDay(row.starts_on) : today,
          endsOn,
          aiMonthlyQueryAllowance: row.ai_monthly_query_allowance,
          wearableSeats: row.wearable_seats ?? 0,
          remoteExpertSeats: row.remote_expert_seats ?? 0,
          ssoEnabled: row.sso_enabled ?? false,
          notes: row.notes,
          updatedAt: (row.updated_at ?? new Date()).toISOString(),
        }
      : null,
    assetCount: Number(row.asset_count),
    aiQueriesThisMonth: Number(row.queries_this_month),
  };
};

// "2027-02-30" matches YYYY-MM-DD but isn't a day; a round trip catches it.
const isRealDate = (isoDay: string): boolean => {
  const parsed = new Date(`${isoDay}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === isoDay
  );
};

// Mirrors the table's CHECK constraints so the admin gets a clear 400
// instead of a database error.
export const assertConsistentSubscription = (
  dto: UpsertSubscriptionDto,
): void => {
  const problems: string[] = [];
  if (dto.tier !== 'demo' && !dto.billingBasis) {
    problems.push(
      'Choose a billing basis (only demo organisations have none).',
    );
  }
  if (dto.billingBasis === 'negotiated' && dto.licensedAssets == null) {
    problems.push('A negotiated deal needs the licensed asset count.');
  }
  if (dto.endsOn && dto.endsOn < dto.startsOn) {
    problems.push('The end date must be on or after the start date.');
  }
  if (!isRealDate(dto.startsOn) || (dto.endsOn && !isRealDate(dto.endsOn))) {
    problems.push('Dates must be real calendar dates.');
  }
  if (problems.length) throw new BadRequestException(problems);
};

export const todayUtc = (now = new Date()): string =>
  now.toISOString().slice(0, 10);
