import { Module } from '@nestjs/common';
import { MachineFleetController } from './machineFleet.controller';
import { MachineFleetService } from './machineFleet.service';
import { MachineIdentifiersService } from './machineIdentifiers.service';
import { MachineDetailsService } from './machineDetails.service';

@Module({
  controllers: [MachineFleetController],
  providers: [
    MachineFleetService,
    MachineIdentifiersService,
    MachineDetailsService,
  ],
})
export class MachineFleetModule {}
