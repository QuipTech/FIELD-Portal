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
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../auth/guards/requirePermissions.guard';
import { RequirePermissions } from '../auth/decorators/requirePermissions.decorator';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { ChangeUserRoleDto } from '../adminUsers/dto/changeUserRoleDto';
import { InviteUserDto } from '../adminUsers/dto/inviteUserDto';
import { ListAdminUsersQueryDto } from '../adminUsers/dto/listAdminUsersQueryDto';
import { TeamService } from './team.service';

// The caller's own organisation's people and roles (admin.manage_users).
// A user outside the organisation is 404.
@Controller('team')
@UseGuards(JwtAuthGuard, RequirePermissionsGuard)
@RequirePermissions('admin.manage_users')
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListAdminUsersQueryDto,
  ) {
    return this.team.listMembers(actor, query);
  }

  // Roles an organisation admin can give (no QuipTech-only roles).
  @Get('roles')
  listRoles(@CurrentUser() actor: AuthenticatedUser) {
    return this.team.listRoles(actor);
  }

  // Emails a temporary password; the account starts 'invited'.
  @Post('invitations')
  invite(@CurrentUser() actor: AuthenticatedUser, @Body() dto: InviteUserDto) {
    return this.team.invite(actor, dto);
  }

  // Not your own role, and never the last Owner.
  @Patch(':userId/role')
  @HttpCode(HttpStatus.NO_CONTENT)
  changeRole(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: ChangeUserRoleDto,
  ) {
    return this.team.changeRole(actor, userId, dto);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.team.removeMember(actor, userId);
  }
}
