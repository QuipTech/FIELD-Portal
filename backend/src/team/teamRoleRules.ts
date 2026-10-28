import { PLATFORM_PERMISSION_CODE } from '../auth/systemRoleNames';

// Permissions only QuipTech staff may hold. A role granting any of them
// (Owner, Support Agent) is never offered on an organisation's Team
// screen, so an organisation admin can't make someone a platform admin or
// support staff.
export const QUIPTECH_ONLY_PERMISSIONS = [
  PLATFORM_PERMISSION_CODE,
  'support.agent',
  'support.manage',
];

export const isTeamAssignableRole = (permissionCodes: string[]): boolean =>
  !permissionCodes.some((code) => QUIPTECH_ONLY_PERMISSIONS.includes(code));
