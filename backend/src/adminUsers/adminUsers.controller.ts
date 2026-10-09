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
import { AdminScopeGuard } from '../auth/adminScope/adminScope.guard';
import { CurrentAdminScope } from '../auth/adminScope/currentAdminScope.decorator';
import { AdminScope } from '../auth/adminScope/adminScope';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { AdminUsersService } from './adminUsers.service';
import { AdminUserInvitationsService } from './adminUserInvitations.service';
import { InviteUserDto } from './dto/inviteUserDto';
import { AdminUserRolesService } from './adminUserRoles.service';
import { AdminUserRemovalService } from './adminUserRemoval.service';
import { ChangeUserRoleDto } from './dto/changeUserRoleDto';
import { ListAdminUsersQueryDto } from './dto/listAdminUsersQueryDto';

// Users for the caller's AdminScope: every organisation's for the Owner
// (AdminScopeGuard).
@Controller('admin/users')
@UseGuards(JwtAuthGuard, AdminScopeGuard)
export class AdminUsersController {
  constructor(
    private readonly adminUsersService: AdminUsersService,
    private readonly invitations: AdminUserInvitationsService,
    private readonly userRoles: AdminUserRolesService,
    private readonly removal: AdminUserRemovalService,
  ) {}

  @Get()
  list(
    @CurrentAdminScope() scope: AdminScope,
    @Query() query: ListAdminUsersQueryDto,
  ) {
    return this.adminUsersService.listUsers(scope, query);
  }

  // Creates the sign-in (Cognito emails a temporary password) and the
  // 'invited' FIELD account with its role.
  @Post('invitations')
  invite(
    @CurrentUser() actor: AuthenticatedUser,
    @CurrentAdminScope() scope: AdminScope,
    @Body() dto: InviteUserDto,
  ) {
    return this.invitations.inviteUser(actor, scope, dto);
  }

  // Replaces the user's role. Not your own, and never the last Owner.
  @Patch(':userId/role')
  @HttpCode(HttpStatus.NO_CONTENT)
  changeRole(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: ChangeUserRoleDto,
  ) {
    return this.userRoles.changeRole(actor, userId, dto);
  }

  // Deletes the user's account completely and disables their sign-in; they
  // are told an administrator removed them. Not yourself, never the last
  // Owner.
  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.removal.removeUser(actor, userId);
  }
}
