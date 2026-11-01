import { Module } from '@nestjs/common';
import { AdminUsersModule } from '../adminUsers/adminUsers.module';
import { MachineGroupsModule } from '../machineGroups/machineGroups.module';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';

@Module({
  imports: [AdminUsersModule, MachineGroupsModule],
  controllers: [TeamController],
  providers: [TeamService],
})
export class TeamModule {}
