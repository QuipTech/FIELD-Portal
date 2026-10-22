import { Module } from '@nestjs/common';
import { MachineConfigurationController } from './machineConfiguration.controller';
import { MachineConfigurationService } from './machineConfiguration.service';
import { SnapshotDiffService } from './snapshotDiff.service';
import { SnapshotRestoreService } from './snapshotRestore.service';

@Module({
  controllers: [MachineConfigurationController],
  providers: [MachineConfigurationService, SnapshotDiffService, SnapshotRestoreService],
})
export class MachineConfigurationModule {}
