import { Module } from '@nestjs/common';
import { DevicePairingController } from './pairing/devicePairing.controller';
import { MachineAppConnectionController } from './pairing/machineAppConnection.controller';
import { MachineAppPairingService } from './pairing/machineAppPairing.service';

@Module({
  controllers: [MachineAppConnectionController, DevicePairingController],
  providers: [MachineAppPairingService],
})
export class MachineControlModule {}
