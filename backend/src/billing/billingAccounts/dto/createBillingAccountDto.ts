import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsTimeZone,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { trimString } from '../../../common/utils/trimTransforms';

const MAX_NAME_LENGTH = 200;
const MAX_EMAIL_LENGTH = 320;

// "51 824 753 556" and "51824753556" are the same ABN; blank means none.
const normaliseAbn = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\s+/g, '') || undefined : value;

export class CreateBillingAccountDto {
  @IsUUID()
  organisationId: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_NAME_LENGTH)
  name: string;

  @IsOptional()
  @Transform(normaliseAbn)
  @Matches(/^\d{11}$/, { message: 'abn must be 11 digits' })
  abn?: string;

  @Transform(trimString)
  @IsEmail()
  @MaxLength(MAX_EMAIL_LENGTH)
  billingEmail: string;

  @IsOptional()
  @IsTimeZone()
  timezone?: string;
}
