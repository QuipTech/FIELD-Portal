import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BUILT_IN_ROLE_NAMES, OWNER_ROLE_NAME } from '../auth/systemRoleNames';
import { AdminRoleRow } from './types/adminRoleRows';
import { AdminRole } from './types/adminRoleResponse';

export const ROLE_NOT_FOUND_MESSAGE = 'Role not found.';

export const toAdminRole = (row: AdminRoleRow): AdminRole => ({
  id: row.id,
  name: row.name,
  userCount: Number(row.user_count),
  permissionCodes: row.permission_codes,
  isBuiltIn: BUILT_IN_ROLE_NAMES.includes(row.name),
  arePermissionsLocked: row.name === OWNER_ROLE_NAME,
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
  if (role.isBuiltIn) {
    throw new ForbiddenException(`The ${role.name} role can't be deleted.`);
  }
};
