import { Module } from '@nestjs/common';
import { MachineHistoryController } from './machineHistory.controller';
import { MachineHistoryService } from './machineHistory.service';
import { MachinePhotosService } from './machinePhotos.service';

@Module({
  controllers: [MachineHistoryController],
  providers: [MachineHistoryService, MachinePhotosService],
})
export class MachineHistoryModule {}
