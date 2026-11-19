import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trimString } from '../../../common/utils/trimTransforms';
import { EXPORT_FORMATS, ExportFormat } from '../statementExport';
import { STATEMENT_STATUSES, StatementStatus } from '../statementRules';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}(-01)?$/;

// "2026-11" or "2026-11-01" → "2026-11-01".
const toMonthStart = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^\d{4}-\d{2}$/.test(value)
    ? `${value}-01`
    : value;

// "all" (or nothing) means no filter.
const allToUndefined = ({ value }: { value: unknown }) =>
  value === 'all' || value === '' ? undefined : value;

export class MonthEndReportQueryDto {
  @Transform(toMonthStart)
  @Matches(MONTH_PATTERN, { message: 'month must be YYYY-MM.' })
  month: string;

  // Default: account. "all": every payment type.
  @IsOptional()
  @IsIn(['account', 'card', 'all'])
  paymentType?: 'account' | 'card' | 'all';

  @IsOptional()
  @Transform(allToUndefined)
  @IsIn(STATEMENT_STATUSES)
  status?: StatementStatus;
}

export class StatementExportQueryDto extends MonthEndReportQueryDto {
  @IsIn(EXPORT_FORMATS)
  format: ExportFormat;

  // The Invoice Date in the Zoho import; default the 1st of next month.
  @IsOptional()
  @Matches(DATE_PATTERN, {
    message: 'invoiceDate must be a date (YYYY-MM-DD).',
  })
  invoiceDate?: string;
}

export class MonthReadyDto {
  @Transform(toMonthStart)
  @Matches(MONTH_PATTERN, { message: 'month must be YYYY-MM.' })
  month: string;
}

export class ZohoInvoiceDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Enter the Zoho invoice number.' })
  @MaxLength(60)
  invoiceNumber: string;

  @Matches(DATE_PATTERN, {
    message: 'invoiceDate must be a date (YYYY-MM-DD).',
  })
  invoiceDate: string;

  // Default: the account's terms.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  termsDays?: number;
}

export class StatementPaidDto {
  @Matches(DATE_PATTERN, { message: 'paidOn must be a date (YYYY-MM-DD).' })
  paidOn: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(140)
  reference?: string;
}
