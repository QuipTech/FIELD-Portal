import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trimString } from '../../common/utils/trimTransforms';

const toLowerTrimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class InviteUserDto {
  @Transform(toLowerTrimmed)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName: string;

  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName: string;

  // A system role or one of the organisation's own.
  @IsUUID()
  roleId: string;

  // The organisation to invite into (default: the inviter's own).
  @IsOptional()
  @IsUUID()
  organisationId?: string;
}
