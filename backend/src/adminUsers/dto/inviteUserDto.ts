import { Transform } from 'class-transformer';
import {
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
} from '../../machineSharing/access/machineScope';

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

  // Which machines they'll see (default 'all'): 'groups_only' shows only
  // machines in shared groups assigned to them or their organisation (on
  // Machine groups), and isn't allowed for an organisation admin role.
  @IsOptional()
  @IsIn(MACHINE_ACCESS_MODES)
  machineAccessMode?: MachineAccessMode;
}
