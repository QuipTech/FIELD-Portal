import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
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
import { ReasonDto } from '../billingOperations/billingOperationsDtos';

// A year of a 499-machine fleet is well under this; anything larger is a typo.
const MAX_CREDIT_LIMIT_CENTS = 100_000_000_00;
const MAX_TERMS_DAYS = 120;
const MAX_NOTES_LENGTH = 1000;
// Stripe's custom field value limit.
const MAX_PO_LENGTH = 140;

// "12 345 678 901" and "12345678901" are both accepted and stored as digits.
const toAbnDigits = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\s+/g, '') : value;

// Blank → null, so clearing a field is sending "".
const trimToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  return value.trim() || null;
};

export class AccountApplicationDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Enter the legal company name.' })
  @MaxLength(200)
  legalName: string;

  @Transform(toAbnDigits)
  @Matches(/^[0-9]{11}$/, { message: 'Enter an 11-digit ABN.' })
  abn: string;

  @Transform(trimString)
  @IsEmail({}, { message: 'Enter a valid accounts email address.' })
  @MaxLength(254)
  accountsEmail: string;

  @Transform(trimString)
  @Matches(/^[0-9 +()-]{8,20}$/, {
    message: 'Enter a valid accounts phone number.',
  })
  accountsPhone: string;

  @IsBoolean()
  poRequired: boolean;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(MAX_NOTES_LENGTH)
  notes?: string | null;
}

export class PaymentTypeChoiceDto {
  // An organisation can always move to card; account terms need an
  // application (POST …/account-application).
  @IsIn(['card'])
  paymentType: 'card';
}

export class PoNumberDto {
  @Transform(trimToNull)
  @ValidateIf((dto: PoNumberDto) => dto.poNumber !== null)
  @IsString()
  @MaxLength(MAX_PO_LENGTH)
  poNumber: string | null;
}

export class ApplicationsQueryDto {
  @IsOptional()
  @IsIn(['pending', 'on_hold', 'approved', 'rejected'])
  status?: 'pending' | 'on_hold' | 'approved' | 'rejected';
}

export class ApproveApplicationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_TERMS_DAYS)
  termsDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_CREDIT_LIMIT_CENTS)
  creditLimitCents?: number | null;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(MAX_NOTES_LENGTH)
  notes?: string | null;
}

export class PaymentTermsDto extends ReasonDto {
  @IsIn(['card', 'account'])
  paymentType: 'card' | 'account';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_TERMS_DAYS)
  termsDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_CREDIT_LIMIT_CENTS)
  creditLimitCents?: number;

  @IsOptional()
  @IsBoolean()
  poRequired?: boolean;
}

export class CreditLimitDto extends ReasonDto {
  @ValidateIf((dto: CreditLimitDto) => dto.creditLimitCents !== null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_CREDIT_LIMIT_CENTS)
  creditLimitCents: number | null;
}

export class FreePeriodDto extends ReasonDto {
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'freeUntil must be a date (YYYY-MM-DD).',
  })
  freeUntil: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  freePercent?: number;
}
