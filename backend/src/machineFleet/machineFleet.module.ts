import { Module } from '@nestjs/common';
import { MachineFleetController } from './machineFleet.controller';
import { MachineFleetService } from './machineFleet.service';
import { MachineIdentifiersService } from './machineIdentifiers.service';
import { MachineDetailsService } from './machineDetails.service';
import { MachineRegistrationService } from './machineRegistration.service';
import { FleetImportController } from './fleetImport/fleetImport.controller';
import { FleetImportService } from './fleetImport/fleetImport.service';

@Module({
  controllers: [MachineFleetController, FleetImportController],
  providers: [
    MachineFleetService,
    MachineIdentifiersService,
    MachineDetailsService,
    MachineRegistrationService,
    FleetImportService,
  ],
})
export class MachineFleetModule {}
