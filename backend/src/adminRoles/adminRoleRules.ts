import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  OWNER_ROLE_NAME,
  PLATFORM_PERMISSION_CODE,
} from '../auth/systemRoleNames';
import { AdminScope } from '../auth/adminScope/adminScope';
import { AdminRoleRow } from './types/adminRoleRows';
import { AdminRole } from './types/adminRoleResponse';

export const ROLE_NOT_FOUND_MESSAGE = 'Role not found.';

const SYSTEM_ROLE_MESSAGE =
  'System roles are shared by every organisation, so only QuipTech admins can change them. Create a role for your organisation instead.';

// Owner (platform): any role. Organisation admin: only their own roles.
const canEditRole = (scope: AdminScope, row: AdminRoleRow): boolean =>
  scope.isPlatform ||
  (row.tenant_id !== null && row.tenant_id === scope.tenantId);

export const toAdminRole = (
  row: AdminRoleRow,
  scope: AdminScope,
): AdminRole => ({
  id: row.id,
  name: row.name,
  userCount: Number(row.user_count),
  permissionCodes: row.permission_codes,
  organisation:
    row.tenant_id && row.organisation_name
      ? { id: row.tenant_id, name: row.organisation_name }
      : null,
  isEditable: canEditRole(scope, row),
  isBuiltIn: row.is_default,
  arePermissionsLocked: row.tenant_id === null && row.name === OWNER_ROLE_NAME,
});

export const assertRoleFound = (
  row: AdminRoleRow | undefined,
): AdminRoleRow => {
  if (!row) throw new NotFoundException(ROLE_NOT_FOUND_MESSAGE);
  return row;
};

export const assertPermissionCodesKnown = (
  permissionCodes: string[],
  knownCodes: Set<string>,
): void => {
  if (permissionCodes.includes(PLATFORM_PERMISSION_CODE)) {
    throw new BadRequestException(
      'Platform management belongs to the Owner role only.',
    );
  }
  const unknownCodes = permissionCodes.filter((code) => !knownCodes.has(code));
  if (unknownCodes.length) {
    throw new BadRequestException(
      `Unknown permission codes: ${unknownCodes.join(', ')}.`,
    );
  }
};

export const assertRoleEditable = (
  role: AdminRole,
  change: { isRename: boolean; isPermissionChange: boolean },
): void => {
  if (!role.isEditable) throw new ForbiddenException(SYSTEM_ROLE_MESSAGE);
  if (change.isRename && role.isBuiltIn) {
    throw new ForbiddenException(`The ${role.name} role can't be renamed.`);
  }
  if (change.isPermissionChange && role.arePermissionsLocked) {
    throw new ForbiddenException(
      `The ${role.name} role always has every permission.`,
    );
  }
};

export const assertRoleDeletable = (role: AdminRole): void => {
  if (!role.isEditable) throw new ForbiddenException(SYSTEM_ROLE_MESSAGE);
  if (role.isBuiltIn) {
    throw new ForbiddenException(
      `${role.name} is a default role, so it can't be deleted.`,
    );
  }
};
