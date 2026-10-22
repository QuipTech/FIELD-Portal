import { Module } from '@nestjs/common';
import { MachineAssignmentsController } from './machineAssignments.controller';
import { MachineAssignmentsService } from './machineAssignments.service';

@Module({
  controllers: [MachineAssignmentsController],
  providers: [MachineAssignmentsService],
})
export class MachineAssignmentsModule {}
