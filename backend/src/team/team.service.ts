import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { AdminScope } from '../auth/adminScope/adminScope';
import { listRoles } from '../adminRoles/adminRoles.repository';
import { AdminUsersService } from '../adminUsers/adminUsers.service';
import { AdminUserInvitationsService } from '../adminUsers/adminUserInvitations.service';
import { AdminUserRolesService } from '../adminUsers/adminUserRoles.service';
import { AdminUserRemovalService } from '../adminUsers/adminUserRemoval.service';
import { ChangeUserRoleDto } from '../adminUsers/dto/changeUserRoleDto';
import { InviteUserDto } from '../adminUsers/dto/inviteUserDto';
import { ListAdminUsersQueryDto } from '../adminUsers/dto/listAdminUsersQueryDto';
import { isTeamMember } from './teamAccess.repository';
import { isTeamAssignableRole } from './teamRoleRules';

const MEMBER_NOT_FOUND_MESSAGE = 'User not found.';
const ROLE_NOT_ASSIGNABLE_MESSAGE = "That role can't be given on your team.";

export interface TeamRole {
  id: string;
  name: string;
  // A platform default (can't be renamed or deleted) or the organisation's own.
  isDefault: boolean;
  permissionCodes: string[];
}

// An organisation admin's Team screen: the same list, invitation, role
// change and removal as the Owner's Users page, always narrowed to the
// caller's own organisation and never handing out QuipTech-only roles.
@Injectable()
export class TeamService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly adminUsers: AdminUsersService,
    private readonly invitations: AdminUserInvitationsService,
    private readonly userRoles: AdminUserRolesService,
    private readonly removal: AdminUserRemovalService,
  ) {}

  listMembers = (actor: AuthenticatedUser, query: ListAdminUsersQueryDto) =>
    this.adminUsers.listUsers(this.toScope(actor), {
      ...query,
      organisationId: undefined,
    });

  listRoles = async (actor: AuthenticatedUser): Promise<TeamRole[]> => {
    const rows = await listRoles(this.databaseService, this.toScope(actor));
    return rows
      .filter((row) => isTeamAssignableRole(row.permission_codes))
      .map((row) => ({
        id: row.id,
        name: row.name,
        isDefault: row.is_default,
        permissionCodes: row.permission_codes,
      }));
  };

  invite = async (actor: AuthenticatedUser, dto: InviteUserDto) => {
    await this.assertAssignableRole(actor, dto.roleId);
    return this.invitations.inviteUser(actor, this.toScope(actor), {
      ...dto,
      organisationId: undefined,
    });
  };

  changeRole = async (
    actor: AuthenticatedUser,
    userId: string,
    dto: ChangeUserRoleDto,
  ): Promise<void> => {
    await this.assertMember(actor, userId);
    await this.assertAssignableRole(actor, dto.roleId);
    await this.userRoles.changeRole(actor, userId, dto);
  };

  removeMember = async (
    actor: AuthenticatedUser,
    userId: string,
  ): Promise<void> => {
    await this.assertMember(actor, userId);
    await this.removal.removeUser(actor, userId);
  };

  private toScope = (actor: AuthenticatedUser): AdminScope => ({
    tenantId: actor.tenantId,
    isPlatform: false,
  });

  private assertMember = async (actor: AuthenticatedUser, userId: string) => {
    if (!(await isTeamMember(this.databaseService, actor.tenantId, userId))) {
      throw new NotFoundException(MEMBER_NOT_FOUND_MESSAGE);
    }
  };

  private assertAssignableRole = async (
    actor: AuthenticatedUser,
    roleId: string,
  ) => {
    const [role] = await listRoles(
      this.databaseService,
      this.toScope(actor),
      roleId,
    );
    if (!role || !isTeamAssignableRole(role.permission_codes)) {
      throw new BadRequestException(ROLE_NOT_ASSIGNABLE_MESSAGE);
    }
  };
}
