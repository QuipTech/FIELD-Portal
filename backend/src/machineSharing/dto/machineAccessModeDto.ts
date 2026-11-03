import { IsIn, IsOptional, IsUUID } from 'class-validator';
import {
  MACHINE_ACCESS_MODES,
  MachineAccessMode,
} from '../access/machineScope';

// PATCH /admin/users/:userId/machine-access. organisationId is the
// person's organisation (the caller's own by default).
export class MachineAccessModeDto {
  @IsIn(MACHINE_ACCESS_MODES)
  machineAccessMode: MachineAccessMode;

  @IsOptional()
  @IsUUID()
  organisationId?: string;
}
