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
import { DeviceFileTransferController } from './transfers/deviceFileTransfer.controller';
import { DeviceFileTransferService } from './transfers/deviceFileTransfer.service';

import {
  DesignLibraryController,
  DeviceDesignDeliveryController,
} from './designs/designDelivery.controller';
import { DesignLibraryService } from './designs/designLibrary.service';
import { TabletFilesController } from './designs/tabletFiles.controller';
import { TabletFilesService } from './designs/tabletFiles.service';
import {
  DeviceRemoteSessionController,
  RemoteAccessController,
  RemoteSessionController,
} from './remote/remoteSession.controller';
import {
  DeviceTabletController,
  DeviceTabletRegisterController,
} from './tablets/deviceTablet.controller';
import { TabletAccessService } from './tablets/tabletAccess.service';
import { TabletCredentialsService } from './tablets/tabletCredentials.service';
import { KvsSignalingService } from './remote/kvsSignaling.service';
import { RemoteRecordingService } from './remote/remoteRecording.service';
import { RemoteSessionService } from './remote/remoteSession.service';
import { RemoteSessionWorkerService } from './remote/remoteSessionWorker.service';
import { DeviceDesignDeliveryService } from './designs/deviceDesignDelivery.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [
    MachineAppConnectionController,
    DevicePairingController,
    DeviceSessionController,
    DeviceFileTransferController,
    DesignLibraryController,
    DeviceDesignDeliveryController,
    TabletFilesController,
    McDevicesController,
    AdminMachineControlController,
    RemoteSessionController,
    DeviceRemoteSessionController,
    RemoteAccessController,
    DeviceTabletRegisterController,
    DeviceTabletController,
  ],
  providers: [
    MachineAppPairingService,
    DeviceSessionService,
    DeviceFileTransferService,
    DesignLibraryService,
    DeviceDesignDeliveryService,
    TabletFilesService,
    DeviceTokenGuard,
    MachineAppGateway,
    MachineAppEventListenerService,
    MachineAppHeartbeatService,
    RequireMachineControlGuard,
    McDevicesService,
    AdminMachineControlService,
    KvsSignalingService,
    RemoteRecordingService,
    RemoteSessionService,
    RemoteSessionWorkerService,
    TabletAccessService,
    TabletCredentialsService,
  ],
})
export class MachineControlModule {}
