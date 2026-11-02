import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trimString } from '../../common/utils/trimTransforms';
import {
  MACHINE_ACCESS_MODES,
  MachineAccessMode,
} from '../../machineGroups/access/machineScope';
import { MAX_GROUPS_PER_USER } from '../../machineGroups/dto/machineAccessDtos';

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

  // Which machines they'll see (default 'all'). 'selected' needs at least
  // one of the organisation's machine groups, and isn't allowed for an
  // organisation admin role.
  @IsOptional()
  @IsIn(MACHINE_ACCESS_MODES)
  machineAccessMode?: MachineAccessMode;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(MAX_GROUPS_PER_USER)
  @IsUUID('all', { each: true })
  groupIds?: string[];
}
