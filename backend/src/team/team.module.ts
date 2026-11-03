import { Module } from '@nestjs/common';
import { AdminUsersModule } from '../adminUsers/adminUsers.module';
import { MachineSharingModule } from '../machineSharing/machineSharing.module';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';

@Module({
  imports: [AdminUsersModule, MachineSharingModule],
  controllers: [TeamController],
  providers: [TeamService],
})
export class TeamModule {}
