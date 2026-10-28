import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { trimString } from '../../../common/utils/trimTransforms';
import { MAX_STRIPE_AMOUNT_CENTS } from '../invoiceAmounts';

const MAX_LINES = 50;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_QUANTITY = 100_000;

export class TestInvoiceLineDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_DESCRIPTION_LENGTH)
  description: string;

  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY)
  quantity: number;

  // Ex-GST, in cents.
  @IsInt()
  @Min(0)
  @Max(MAX_STRIPE_AMOUNT_CENTS)
  unitCents: number;
}

export class CreateTestInvoiceDto {
  @IsUUID()
  billingAccountId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_LINES)
  @ValidateNested({ each: true })
  @Type(() => TestInvoiceLineDto)
  lines: TestInvoiceLineDto[];
}
