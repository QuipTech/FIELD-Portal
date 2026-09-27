import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Both fields are only needed the first time a Google/Apple user signs in
// (to create their account); returning users send an empty body.
export class SyncCognitoDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  companyName?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Matches(/^\+?[0-9\s().-]{7,20}$/, {
    message: 'Enter a valid phone number.',
  })
  phoneNumber?: string;
}
