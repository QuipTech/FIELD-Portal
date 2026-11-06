import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AdminScope } from '../auth/adminScope/adminScope';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { UserMachineAccessService } from '../machineSharing/userAccess/userMachineAccess.service';
import { StorageService } from '../storage/storage.service';
import { resolveAvatarUrl } from '../users/resolveAvatarUrl';
import * as adminUsersRepository from './adminUsers.repository';
import { ListAdminUsersQueryDto } from './dto/listAdminUsersQueryDto';
import { AdminUserRow } from './types/adminUserRows';
import {
  AdminUserListItem,
  AdminUserListResponse,
  AdminUserWithAccessListResponse,
} from './types/adminUserListResponse';

const toListItem = async (
  storageService: StorageService,
  row: AdminUserRow,
): Promise<AdminUserListItem> => ({
  id: row.id,
  email: row.email,
  firstName: row.first_name,
  lastName: row.last_name,
  avatarUrl: await resolveAvatarUrl(storageService, row),
  status: row.status,
  roles: row.roles,
  organisation: { id: row.tenant_id, name: row.tenant_name },
  lastActiveAt: row.last_login_at?.toISOString() ?? null,
  createdAt: row.created_at.toISOString(),
});

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
    private readonly machineAccess: UserMachineAccessService,
  ) {}

  listUsers = async (
    scope: AdminScope,
    query: ListAdminUsersQueryDto,
  ): Promise<AdminUserListResponse> => {
    // Narrows a platform-wide list to one organisation; never widens.
    const listScope =
      scope.isPlatform && query.organisationId
        ? { ...scope, tenantId: query.organisationId }
        : scope;
    const rows = await adminUsersRepository.listAdminUsers(
      this.databaseService,
      listScope,
      {
        search: query.search,
        role: query.role,
        limit: query.pageSize,
        offset: (query.page - 1) * query.pageSize,
      },
    );
    return {
      users: await Promise.all(
        rows.map((row) => toListItem(this.storageService, row)),
      ),
      // A page past the end has no rows to carry the count; 0 is only
      // wrong there, and the portal never requests such a page.
      total: rows.length ? Number(rows[0].total_count) : 0,
      page: query.page,
      pageSize: query.pageSize,
    };
  };

  // The same list with each person's machine access: their mode and the
  // shared groups assigned to them or their organisation. The caller's
  // own organisation's people, or anyone's for the platform administrator.
  listUsersWithMachineAccess = async (
    actor: AuthenticatedUser,
    scope: AdminScope,
    query: ListAdminUsersQueryDto,
  ): Promise<AdminUserWithAccessListResponse> => {
    const list = await this.listUsers(scope, query);
    const access = await this.machineAccess.listAccess(
      actor,
      list.users.map((user) => user.id),
    );
    return {
      ...list,
      users: list.users.map((user) => ({
        ...user,
        machineAccess: access.get(user.id) ?? null,
      })),
    };
  };
}
