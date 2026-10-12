import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { AdminScopeGuard } from '../auth/adminScope/adminScope.guard';
import { CurrentAdminScope } from '../auth/adminScope/currentAdminScope.decorator';
import { AdminScope } from '../auth/adminScope/adminScope';
import { AdminRolesService } from './adminRoles.service';
import { CreateRoleDto } from './dto/createRoleDto';
import { UpdateRoleDto } from './dto/updateRoleDto';

// System roles plus organisation roles; the Owner manages all of them
// (AdminScopeGuard).
@Controller('admin/roles')
@UseGuards(JwtAuthGuard, AdminScopeGuard)
export class AdminRolesController {
  constructor(private readonly adminRolesService: AdminRolesService) {}

  @Get()
  list(@CurrentAdminScope() scope: AdminScope) {
    return this.adminRolesService.listRoles(scope);
  }

  @Get(':roleId')
  get(
    @CurrentAdminScope() scope: AdminScope,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    return this.adminRolesService.getRole(scope, roleId);
  }

  @Post()
  create(
    @CurrentAdminScope() scope: AdminScope,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateRoleDto,
  ) {
    return this.adminRolesService.createRole(actor, scope, dto);
  }

  @Patch(':roleId')
  update(
    @CurrentAdminScope() scope: AdminScope,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.adminRolesService.updateRole(actor, scope, roleId, dto);
  }

  @Delete(':roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentAdminScope() scope: AdminScope,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    return this.adminRolesService.deleteRole(actor, scope, roleId);
  }
}
