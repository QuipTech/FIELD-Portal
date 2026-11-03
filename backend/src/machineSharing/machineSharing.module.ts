import { Module } from '@nestjs/common';
import { AdminMachineGroupsController } from './groups/adminMachineGroups.controller';
import { AdminMachineSearchController } from './groups/adminMachineSearch.controller';
import { MachineSharesController } from './shares/machineShares.controller';
import { MachineGroupsAdminService } from './groups/machineGroupsAdmin.service';
import { GroupMachinesAdminService } from './groups/groupMachinesAdmin.service';
import { GroupAssignmentsAdminService } from './groups/groupAssignmentsAdmin.service';
import { MachineSharesService } from './shares/machineShares.service';
import { UserMachineAccessService } from './userAccess/userMachineAccess.service';

@Module({
  controllers: [
    AdminMachineGroupsController,
    AdminMachineSearchController,
    MachineSharesController,
  ],
  providers: [
    MachineGroupsAdminService,
    GroupMachinesAdminService,
    GroupAssignmentsAdminService,
    MachineSharesService,
    UserMachineAccessService,
  ],
  // People's machine access, for /admin/users and /team.
  exports: [UserMachineAccessService],
})
export class MachineSharingModule {}
