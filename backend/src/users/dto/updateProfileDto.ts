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

// Email is the sign-in identity, so it isn't editable here.
export class UpdateProfileDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName: string;

  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  lastName: string;

  // E.164 (+61412345678), the format SMS alerts are sent to. Omit to
  // leave it unchanged; null removes it.
  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: 'Phone number must be in international format, e.g. +61412345678.',
  })
  phoneNumber?: string | null;
}
