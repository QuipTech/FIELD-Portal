import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DevicePairingController } from './pairing/devicePairing.controller';
import { MachineAppConnectionController } from './pairing/machineAppConnection.controller';
import { MachineAppPairingService } from './pairing/machineAppPairing.service';
import { DeviceSessionController } from './session/deviceSession.controller';
import { DeviceSessionService } from './session/deviceSession.service';
import { DeviceTokenGuard } from './session/deviceToken.guard';
import { MachineAppGateway } from './session/machineApp.gateway';
import { MachineAppEventListenerService } from './session/machineAppEventListener.service';
import { MachineAppHeartbeatService } from './session/machineAppHeartbeat.service';
import { RequireMachineControlGuard } from './access/requireMachineControl.guard';
import { McDevicesController } from './devices/mcDevices.controller';
import { McDevicesService } from './devices/mcDevices.service';
import { AdminMachineControlController } from './admin/adminMachineControl.controller';
import { AdminMachineControlService } from './admin/adminMachineControl.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [
    MachineAppConnectionController,
    DevicePairingController,
    DeviceSessionController,
    McDevicesController,
    AdminMachineControlController,
  ],
  providers: [
    MachineAppPairingService,
    DeviceSessionService,
    DeviceTokenGuard,
    MachineAppGateway,
    MachineAppEventListenerService,
    MachineAppHeartbeatService,
    RequireMachineControlGuard,
    McDevicesService,
    AdminMachineControlService,
  ],
})
export class MachineControlModule {}
