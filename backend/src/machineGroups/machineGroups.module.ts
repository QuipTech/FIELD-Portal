import { Module } from '@nestjs/common';
import { MachineGroupsController } from './machineGroups.controller';
import { MachineGroupAssignmentController } from './machineGroupAssignment.controller';
import { MachineGroupsService } from './machineGroups.service';
import { MachineAccessService } from './machineAccess.service';

@Module({
  controllers: [MachineGroupsController, MachineGroupAssignmentController],
  providers: [MachineGroupsService, MachineAccessService],
  exports: [MachineAccessService],
})
export class MachineGroupsModule {}
