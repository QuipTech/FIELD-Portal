import { Module } from '@nestjs/common';
import { MachineHistoryController } from './machineHistory.controller';
import { MachineHistoryService } from './machineHistory.service';
import { MachinePhotosService } from './machinePhotos.service';
import { HistoryExportService } from './historyExport.service';
import { MachineGalleryController } from './machineGallery.controller';
import { MachineGalleryService } from './machineGallery.service';
import { MachineDocumentsController } from './machineDocuments.controller';
import { MachineDocumentsService } from './machineDocuments.service';

@Module({
  controllers: [
    MachineHistoryController,
    MachineGalleryController,
    MachineDocumentsController,
  ],
  providers: [
    MachineHistoryService,
    MachinePhotosService,
    MachineGalleryService,
    MachineDocumentsService,
    HistoryExportService,
  ],
})
export class MachineHistoryModule {}
