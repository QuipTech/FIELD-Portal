import { Module } from '@nestjs/common';
import { AdminUsersController } from './adminUsers.controller';
import { AdminUsersService } from './adminUsers.service';

@Module({
  controllers: [AdminUsersController],
  providers: [AdminUsersService],
})
export class AdminUsersModule {}
