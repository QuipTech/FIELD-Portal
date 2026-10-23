import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  trimString,
  trimToUndefined,
} from '../../../common/utils/trimTransforms';

const MAX_REASON_LENGTH = 500;

export class HoldInvoiceDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_REASON_LENGTH)
  reason: string;
}

export class ReleaseInvoiceDto {
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(MAX_REASON_LENGTH)
  reason?: string;
}
