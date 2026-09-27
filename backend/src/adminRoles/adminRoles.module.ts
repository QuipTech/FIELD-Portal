import { Module } from '@nestjs/common';
import { AdminRolesController } from './adminRoles.controller';
import { AdminPermissionsController } from './adminPermissions.controller';
import { AdminRolesService } from './adminRoles.service';

@Module({
  controllers: [AdminRolesController, AdminPermissionsController],
  providers: [AdminRolesService],
})
export class AdminRolesModule {}
