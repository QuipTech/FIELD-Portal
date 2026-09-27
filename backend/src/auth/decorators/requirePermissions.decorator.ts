import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';

// Pair with @UseGuards(JwtAuthGuard, RequirePermissionsGuard): the caller
// must hold every one of these permission codes (e.g. 'history.create').
export const RequirePermissions = (...permissionCodes: string[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissionCodes);
