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
import { RequireRolesGuard } from '../auth/guards/requireRoles.guard';
import { RequireRoles } from '../auth/decorators/requireRoles.decorator';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { OWNER_ROLE_NAME } from '../auth/systemRoleNames';
import { AdminRolesService } from './adminRoles.service';
import { CreateRoleDto } from './dto/createRoleDto';
import { UpdateRoleDto } from './dto/updateRoleDto';

// Platform-wide system roles, shared by every organisation — Owner only.
@Controller('admin/roles')
@UseGuards(JwtAuthGuard, RequireRolesGuard)
@RequireRoles(OWNER_ROLE_NAME)
export class AdminRolesController {
  constructor(private readonly adminRolesService: AdminRolesService) {}

  @Get()
  list() {
    return this.adminRolesService.listRoles();
  }

  @Get(':roleId')
  get(@Param('roleId', ParseUUIDPipe) roleId: string) {
    return this.adminRolesService.getRole(roleId);
  }

  @Post()
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateRoleDto) {
    return this.adminRolesService.createRole(actor, dto);
  }

  @Patch(':roleId')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.adminRolesService.updateRole(actor, roleId, dto);
  }

  @Delete(':roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    return this.adminRolesService.deleteRole(actor, roleId);
  }
}
