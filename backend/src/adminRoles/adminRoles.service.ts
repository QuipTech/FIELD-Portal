import { PLATFORM_PERMISSION_CODE } from '../auth/systemRoleNames';
import { ConflictException, Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AdminScope } from '../auth/adminScope/adminScope';
import * as authRepository from '../auth/auth.repository';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import * as adminRolesRepository from './adminRoles.repository';
import {
  assertPermissionCodesKnown,
  assertRoleDeletable,
  assertRoleEditable,
  assertRoleFound,
  toAdminRole,
} from './adminRoleRules';
import { CreateRoleDto } from './dto/createRoleDto';
import { UpdateRoleDto } from './dto/updateRoleDto';
import { AdminPermission, AdminRole } from './types/adminRoleResponse';

const UNIQUE_VIOLATION_CODE = '23505';
const DUPLICATE_NAME_MESSAGE = 'A role with that name already exists.';
const ROLE_IN_USE_MESSAGE =
  'This role is still assigned to users. Move them to another role first.';

interface RoleAuditEntry {
  action: 'create' | 'update' | 'delete';
  roleId: string;
  metadata: Record<string, unknown>;
}

const isUniqueViolation = (error: unknown): boolean =>
  (error as { code?: string } | null)?.code === UNIQUE_VIOLATION_CODE;

// Roles & permissions: system roles (every organisation) plus each
// organisation's own roles. The Owner manages all of them. Each
// change is audited under the acting admin's own organisation.
@Injectable()
export class AdminRolesService {
  constructor(private readonly databaseService: DatabaseService) {}

  listPermissions = async (): Promise<AdminPermission[]> => {
    const rows = await adminRolesRepository.listPermissions(
      this.databaseService,
    );
    // platform.manage isn't a toggle: only Owner holds it (0055).
    return rows
      .filter((row) => row.code !== PLATFORM_PERMISSION_CODE)
      .map((row) => ({ code: row.code, label: row.description }));
  };

  listRoles = async (scope: AdminScope): Promise<AdminRole[]> => {
    const rows = await adminRolesRepository.listRoles(
      this.databaseService,
      scope,
    );
    return rows.map((row) => toAdminRole(row, scope));
  };

  getRole = async (scope: AdminScope, roleId: string): Promise<AdminRole> => {
    const [row] = await adminRolesRepository.listRoles(
      this.databaseService,
      scope,
      roleId,
    );
    return toAdminRole(assertRoleFound(row), scope);
  };

  createRole = async (
    actor: AuthenticatedUser,
    scope: AdminScope,
    dto: CreateRoleDto,
  ): Promise<AdminRole> => {
    await this.assertKnownPermissions(dto.permissionCodes);
    const roleId = await this.runAudited(actor, async (client) => {
      const id = await adminRolesRepository.createRole(client, scope, dto);
      return { action: 'create', roleId: id, metadata: { ...dto } };
    });
    return this.getRole(scope, roleId);
  };

  updateRole = async (
    actor: AuthenticatedUser,
    scope: AdminScope,
    roleId: string,
    dto: UpdateRoleDto,
  ): Promise<AdminRole> => {
    const role = await this.getRole(scope, roleId);
    assertRoleEditable(role, {
      isRename: dto.name !== undefined && dto.name !== role.name,
      isPermissionChange: dto.permissionCodes !== undefined,
    });
    if (dto.permissionCodes) {
      await this.assertKnownPermissions(dto.permissionCodes);
    }

    await this.runAudited(actor, async (client) => {
      const isUpdated = await adminRolesRepository.updateRole(client, scope, {
        roleId,
        ...dto,
      });
      // Deleted by someone else between the read above and now.
      if (!isUpdated) assertRoleFound(undefined);
      const before = { name: role.name, permissionCodes: role.permissionCodes };
      return { action: 'update', roleId, metadata: { before, after: dto } };
    });
    return this.getRole(scope, roleId);
  };

  deleteRole = async (
    actor: AuthenticatedUser,
    scope: AdminScope,
    roleId: string,
  ): Promise<void> => {
    const role = await this.getRole(scope, roleId);
    assertRoleDeletable(role);
    await this.runAudited(actor, async (client) => {
      const outcome = await adminRolesRepository.deleteRole(
        client,
        scope,
        roleId,
      );
      if (outcome === 'in_use')
        throw new ConflictException(ROLE_IN_USE_MESSAGE);
      if (outcome === 'not_found') assertRoleFound(undefined);
      // The service checks first; this covers a role marked default since.
      if (outcome === 'default_role')
        assertRoleDeletable({ ...role, isBuiltIn: true });
      return { action: 'delete', roleId, metadata: { name: role.name } };
    });
  };

  private assertKnownPermissions = async (
    permissionCodes: string[],
  ): Promise<void> => {
    const permissions = await this.listPermissions();
    assertPermissionCodesKnown(
      permissionCodes,
      new Set(permissions.map((permission) => permission.code)),
    );
  };

  // The change and its audit entry share one transaction, so neither is
  // ever saved without the other. Resolves to the changed role's id.
  private runAudited = async (
    actor: AuthenticatedUser,
    applyChange: (client: PoolClient) => Promise<RoleAuditEntry>,
  ): Promise<string> => {
    try {
      return await this.databaseService.withTenant(
        actor.tenantId,
        async (client) => {
          const entry = await applyChange(client);
          await authRepository.insertAuditLog(client, {
            tenantId: actor.tenantId,
            userId: actor.userId,
            action: entry.action,
            entityType: 'role',
            entityId: entry.roleId,
            metadata: entry.metadata,
          });
          return entry.roleId;
        },
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(DUPLICATE_NAME_MESSAGE);
      }
      throw error;
    }
  };
}
