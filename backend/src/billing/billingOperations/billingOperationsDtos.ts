import { Transform, Type } from 'class-transformer';
import {
  Allow,
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { trimString, trimToUndefined } from '../../common/utils/trimTransforms';

const MAX_REASON_LENGTH = 500;
// A year's ASSET_PRO for 499 machines is well under this; anything larger
// is a typo.
const MAX_CENTS = 100_000_000_00;

export class ReasonDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_REASON_LENGTH)
  reason: string;
}

export class NextTermDto {
  @IsIn(['monthly', 'annual'])
  term: 'monthly' | 'annual';

  @ValidateIf((dto: NextTermDto) => dto.term === 'annual')
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  committedQty?: number;
}

export class AnnualQuoteQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  committedQty: number;
}

export class EnterpriseContractDto extends ReasonDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_CENTS)
  annualQuoteCents: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  committedMachines: number;
}

export class CreditNoteDto extends ReasonDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_CENTS)
  amountCents: number;
}

export class ScheduleOnboardingDto {
  @IsUUID()
  billingAccountId: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  siteName: string;
}

export class OnboardingQueryDto {
  @IsOptional()
  @IsUUID()
  billingAccountId?: string;
}

class PriceBandDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lowerQty: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  upperQty: number | null;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_CENTS)
  unitCents: number;
}

export class NewPriceBookDto {
  @IsIn([
    'ASSET_PRO',
    'TECH',
    'REMOTE_SESSION',
    'ENTERPRISE',
    'ONBOARD_ASSISTED',
  ])
  planCode: string;

  @IsDateString({ strict: true })
  effectiveFrom: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_CENTS)
  unitCents: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_CENTS)
  minimumAnnualCents: number | null;

  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PriceBandDto)
  bands: PriceBandDto[];
}

export class ConfigValueDto {
  // A number, a time zone, or null (an "off" value); checked against the
  // key's kind by the service.
  @Allow()
  value: unknown;
}

export class ReviewTaskUpdateDto {
  @IsIn(['open', 'in_progress', 'resolved', 'dismissed'])
  status: string;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class ReviewTaskQueryDto {
  @IsOptional()
  @IsIn(['open', 'closed'])
  status?: 'open' | 'closed';
}
