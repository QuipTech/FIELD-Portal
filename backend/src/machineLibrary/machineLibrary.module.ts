import { Module } from '@nestjs/common';
import { MachineModelsController } from './machineModels.controller';
import { ModelTreeNodesController } from './modelTreeNodes.controller';
import { MachineModelsService } from './machineModels.service';
import { ModelTreeService } from './modelTree.service';
import { ModelTreeImportService } from './modelTreeImport.service';

@Module({
  controllers: [MachineModelsController, ModelTreeNodesController],
  providers: [MachineModelsService, ModelTreeService, ModelTreeImportService],
})
export class MachineLibraryModule {}
