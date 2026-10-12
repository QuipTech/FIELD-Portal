import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { AdminScopeGuard } from '../auth/adminScope/adminScope.guard';
import { AdminRolesService } from './adminRoles.service';

// The permission catalog the Roles page renders toggles for.
@Controller('admin/permissions')
@UseGuards(JwtAuthGuard, AdminScopeGuard)
export class AdminPermissionsController {
  constructor(private readonly adminRolesService: AdminRolesService) {}

  @Get()
  list() {
    return this.adminRolesService.listPermissions();
  }
}
