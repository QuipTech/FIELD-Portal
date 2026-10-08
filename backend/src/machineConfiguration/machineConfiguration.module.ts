import { Module } from '@nestjs/common';
import { MachineConfigurationController } from './machineConfiguration.controller';
import { MachineConfigurationService } from './machineConfiguration.service';
import { SnapshotDiffService } from './snapshotDiff.service';

@Module({
  controllers: [MachineConfigurationController],
  providers: [MachineConfigurationService, SnapshotDiffService],
})
export class MachineConfigurationModule {}
