import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { trimString } from '../../common/utils/trimTransforms';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// Stripe's largest single amount for AUD.
const MAX_FIXED_CENTS = 99_999_999;

const emptyToNull = ({ value }: { value: unknown }) =>
  value === '' || value === undefined ? null : value;

export class PromoCodeDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Enter a promo code.' })
  @MaxLength(40)
  code: string;
}

// Everything but the code, which can't change once created.
export class PromoCodeTermsDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;

  @IsIn(['percent', 'fixed_cents'])
  discountType: 'percent' | 'fixed_cents';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  // At most 100 for a percentage (checked by the service).
  @Max(MAX_FIXED_CENTS)
  discountValue: number;

  // null = forever.
  @Transform(emptyToNull)
  @ValidateIf((dto: PromoCodeTermsDto) => dto.durationMonths != null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  durationMonths: number | null;

  @Transform(emptyToNull)
  @ValidateIf((dto: PromoCodeTermsDto) => dto.validFrom != null)
  @Matches(DATE_PATTERN, { message: 'validFrom must be a date (YYYY-MM-DD).' })
  validFrom: string | null;

  @Transform(emptyToNull)
  @ValidateIf((dto: PromoCodeTermsDto) => dto.validUntil != null)
  @Matches(DATE_PATTERN, { message: 'validUntil must be a date (YYYY-MM-DD).' })
  validUntil: string | null;

  @Transform(emptyToNull)
  @ValidateIf((dto: PromoCodeTermsDto) => dto.maxRedemptions != null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  maxRedemptions: number | null;

  @IsOptional()
  @IsBoolean()
  newCustomersOnly?: boolean;
}

export class CreatePromoCodeDto extends PromoCodeTermsDto {
  @Transform(trimString)
  @Matches(/^[A-Za-z0-9_-]{3,40}$/, {
    message: 'A code is 3–40 letters, numbers, dashes or underscores.',
  })
  code: string;
}
