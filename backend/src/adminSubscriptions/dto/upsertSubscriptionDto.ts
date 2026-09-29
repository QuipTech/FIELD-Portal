import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trimString } from '../../common/utils/trimTransforms';
import {
  BILLING_BASES,
  BillingBasis,
  SUBSCRIPTION_TIERS,
  SubscriptionTier,
} from '../types/subscriptionResponse';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_MESSAGE = 'must be a date in YYYY-MM-DD form';
const MAX_COUNT = 1_000_000;

// The whole subscription — omitted optional fields are cleared, not kept.
// Cross-field rules (billing basis per tier, end after start) are checked
// in subscriptionRules.ts.
export class UpsertSubscriptionDto {
  @IsIn(SUBSCRIPTION_TIERS)
  tier: SubscriptionTier;

  @IsOptional()
  @IsIn(BILLING_BASES)
  billingBasis?: BillingBasis | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_COUNT)
  licensedAssets?: number | null;

  @Matches(ISO_DATE, { message: `startsOn ${ISO_DATE_MESSAGE}` })
  startsOn: string;

  @IsOptional()
  @Matches(ISO_DATE, { message: `endsOn ${ISO_DATE_MESSAGE}` })
  endsOn?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_COUNT)
  aiMonthlyQueryAllowance?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_COUNT)
  wearableSeats: number = 0;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_COUNT)
  remoteExpertSeats: number = 0;

  @IsOptional()
  @IsBoolean()
  ssoEnabled: boolean = false;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
