import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import {
  MACHINE_ACCESS_MODES,
  MachineAccessMode,
} from '../access/machineScope';

export const MAX_GROUPS_PER_USER = 200;
export const MAX_MACHINES_PER_MOVE = 500;

// PATCH /team/:userId/machine-access. 'selected' needs at least one
// group; groupIds are ignored for 'all'.
export class MachineAccessDto {
  @IsIn(MACHINE_ACCESS_MODES)
  machineAccessMode: MachineAccessMode;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(MAX_GROUPS_PER_USER)
  @IsUUID('all', { each: true })
  groupIds?: string[];
}

// POST /machines/bulk-assign-group. groupId is required: a group's id, or
// null to take the machines out of their group (Ungrouped).
export class BulkAssignGroupDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @ArrayMaxSize(MAX_MACHINES_PER_MOVE)
  @IsUUID('all', { each: true })
  machineIds: string[];

  @ValidateIf((_dto, value) => value !== null)
  @IsUUID()
  groupId: string | null;
}
