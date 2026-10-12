import { Module } from '@nestjs/common';
import { MachineHistoryController } from './machineHistory.controller';
import { MachineHistoryService } from './machineHistory.service';
import { MachinePhotosService } from './machinePhotos.service';
import { MachineGalleryController } from './machineGallery.controller';
import { MachineGalleryService } from './machineGallery.service';

@Module({
  controllers: [MachineHistoryController, MachineGalleryController],
  providers: [MachineHistoryService, MachinePhotosService, MachineGalleryService],
})
export class MachineHistoryModule {}
