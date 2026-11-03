import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { trimString, trimToUndefined } from '../../common/utils/trimTransforms';
import {
  ASSIGNMENT_TARGET_TYPES,
  AssignmentTargetType,
  SHARE_ACCESS_LEVELS,
  ShareAccessLevel,
} from '../types/machineGroupTypes';

const HEX_COLOUR = /^#[0-9A-Fa-f]{6}$/;
const HEX_COLOUR_MESSAGE = 'colour must be a hex colour like #4A34C7';
export const MAX_MACHINES_PER_ADD = 500;

// Blank or null clears an optional field.
const trimToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

const isSet = (_dto: unknown, value: unknown) =>
  value !== null && value !== undefined;

// POST /admin/machine-groups. The name is unique across the platform,
// ignoring case.
export class CreateMachineGroupDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf(isSet)
  @Matches(HEX_COLOUR, { message: HEX_COLOUR_MESSAGE })
  colour?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf(isSet)
  @IsString()
  @MaxLength(1000)
  description?: string | null;
}

// PATCH /admin/machine-groups/:groupId: only the fields sent change.
export class UpdateMachineGroupDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf(isSet)
  @Matches(HEX_COLOUR, { message: HEX_COLOUR_MESSAGE })
  colour?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf(isSet)
  @IsString()
  @MaxLength(1000)
  description?: string | null;
}

// POST /admin/machine-groups/:groupId/machines: machines of any
// organisation; ones already in the group are left as they are.
export class AddGroupMachinesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_MACHINES_PER_ADD)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  machineIds: string[];
}

// POST /admin/machine-groups/:groupId/assignments. Assigning a target that
// already has the group changes its level.
export class GrantAssignmentDto {
  @IsIn(ASSIGNMENT_TARGET_TYPES)
  targetType: AssignmentTargetType;

  @IsUUID()
  targetId: string;

  @IsIn(SHARE_ACCESS_LEVELS)
  accessLevel: ShareAccessLevel;
}

// DELETE …/assignments/:assignmentId and DELETE /machines/:id/shares/:id.
export class RevokeShareDto {
  @Transform(trimString)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}

// GET /admin/machines/search: plant ID, serial, VIN or organisation name.
export class SearchMachinesQueryDto {
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
