import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Email is the sign-in identity, so it isn't editable here. Every field is
// optional; only those sent change.
export class UpdateProfileDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  lastName?: string;

  // Where the person usually works; null or blank clears it.
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @ValidateIf((_dto, value) => value !== null)
  @IsString()
  @MaxLength(100)
  site?: string | null;

  // A BCP 47 tag, e.g. "en" or "en-AU".
  @IsOptional()
  @Matches(/^[a-z]{2,3}(-[A-Z]{2})?$/, {
    message: 'Language must be a code such as "en" or "en-AU".',
  })
  language?: string;

  // E.164 (+61412345678), the format SMS alerts are sent to. Omit to
  // leave it unchanged; null removes it.
  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: 'Phone number must be in international format, e.g. +61412345678.',
  })
  phoneNumber?: string | null;
}
