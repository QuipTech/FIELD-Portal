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
// string is trimmed; optional ones left blank count as not given.
export class CreateDemoRequestDto {
  @Transform(trimString)
  @IsEmail()
  @MaxLength(320)
  email: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  company: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  country: string;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(2000)
  message?: string;

  // The Cloudflare Turnstile widget's token, checked server-side.
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  turnstileToken: string;

  // Honeypot: hidden from people, so any value means a bot. Accepted here
  // (not rejected by validation) so the bot still sees a normal success.
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  website?: string;
}
