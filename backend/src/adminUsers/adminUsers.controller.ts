import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { RequireRolesGuard } from '../auth/guards/requireRoles.guard';
import { RequireRoles } from '../auth/decorators/requireRoles.decorator';
import { OWNER_ROLE_NAME } from '../auth/systemRoleNames';
import { AdminUsersService } from './adminUsers.service';
import { ListAdminUsersQueryDto } from './dto/listAdminUsersQueryDto';

// Platform-wide: lists users from every organisation, so Owner only.
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RequireRolesGuard)
@RequireRoles(OWNER_ROLE_NAME)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  list(@Query() query: ListAdminUsersQueryDto) {
    return this.adminUsersService.listUsers(query);
  }
}
