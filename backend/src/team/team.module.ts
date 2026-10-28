import { Module } from '@nestjs/common';
import { AdminUsersModule } from '../adminUsers/adminUsers.module';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';

@Module({
  imports: [AdminUsersModule],
  controllers: [TeamController],
  providers: [TeamService],
})
export class TeamModule {}
