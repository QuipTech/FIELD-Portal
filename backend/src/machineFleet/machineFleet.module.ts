import { Module } from '@nestjs/common';
import { MachineFleetController } from './machineFleet.controller';
import { MachineFleetService } from './machineFleet.service';

@Module({
  controllers: [MachineFleetController],
  providers: [MachineFleetService],
})
export class MachineFleetModule {}
