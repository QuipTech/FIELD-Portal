import { UserAccess } from '../userAccess.repository';
import { PLATFORM_PERMISSION_CODE } from '../systemRoleNames';

// Which organisations an admin request may see. tenantId null means every
// organisation. Today the only admin level is the platform administrator
// (platform.manage, held by Owner); the admin repositories also accept a
// single organisation's id, which narrows a list (e.g. the Users screen's
// Organisation filter).
export interface AdminScope {
  tenantId: string | null;
  isPlatform: boolean;
}

// null when the caller has no admin access at all.
export const resolveAdminScope = (access: UserAccess): AdminScope | null =>
  access.permissions.includes(PLATFORM_PERMISSION_CODE)
    ? { tenantId: null, isPlatform: true }
    : null;
