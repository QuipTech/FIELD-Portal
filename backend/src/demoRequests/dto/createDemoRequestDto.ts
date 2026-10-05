import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { trimString, trimToUndefined } from '../../common/utils/trimTransforms';

// The marketing site's demo form (POST /public/demo-requests). Every
// string is trimmed; optional ones left blank count as not given. The
// site shows the first message as-is, so each one is written for people.
export class CreateDemoRequestDto {
  @Transform(trimString)
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254, { message: 'Email address is too long.' })
  email: string;

  @Transform(trimString)
  @IsString({ message: 'Enter your first name.' })
  @IsNotEmpty({ message: 'Enter your first name.' })
  @MaxLength(100, { message: 'First name must be 100 characters or fewer.' })
  firstName: string;

  @Transform(trimString)
  @IsString({ message: 'Enter your last name.' })
  @IsNotEmpty({ message: 'Enter your last name.' })
  @MaxLength(100, { message: 'Last name must be 100 characters or fewer.' })
  lastName: string;

  @Transform(trimString)
  @IsString({ message: 'Enter your company name.' })
  @IsNotEmpty({ message: 'Enter your company name.' })
  @MaxLength(200, { message: 'Company name must be 200 characters or fewer.' })
  company: string;

  @Transform(trimString)
  @IsString({ message: 'Select your country.' })
  @IsNotEmpty({ message: 'Select your country.' })
  @MaxLength(100, { message: 'Country must be 100 characters or fewer.' })
  country: string;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString({ message: 'Enter a valid phone number.' })
  @MaxLength(30, { message: 'Phone number must be 30 characters or fewer.' })
  phone?: string;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString({ message: 'Enter a valid message.' })
  @MaxLength(2000, { message: 'Message must be 2000 characters or fewer.' })
  message?: string;

  // Honeypot: hidden from people, so any value means a bot. Accepted here
  // (not rejected by validation) so the bot still sees a normal success.
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  website?: string;
}
