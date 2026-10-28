import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { trimString } from '../../common/utils/trimTransforms';

const MAX_IDENTIFIER_LENGTH = 100;
const MAX_REASON_LENGTH = 500;

// Only the identifiers sent are changed. Fleet, asset (Plant ID) and
// registration numbers may be cleared with null; the serial can't be.
export class CorrectIdentifiersDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_IDENTIFIER_LENGTH)
  serialNumber?: string;

  @ValidateIf((_dto, value) => value !== null && value !== undefined)
  @Transform(trimString)
  @IsString()
  @MaxLength(MAX_IDENTIFIER_LENGTH)
  fleetNumber?: string | null;

  @ValidateIf((_dto, value) => value !== null && value !== undefined)
  @Transform(trimString)
  @IsString()
  @MaxLength(MAX_IDENTIFIER_LENGTH)
  assetNumber?: string | null;

  @ValidateIf((_dto, value) => value !== null && value !== undefined)
  @Transform(trimString)
  @IsString()
  @MaxLength(MAX_IDENTIFIER_LENGTH)
  registrationNumber?: string | null;

  // Every identifier correction says why.
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_REASON_LENGTH)
  reason: string;
}
