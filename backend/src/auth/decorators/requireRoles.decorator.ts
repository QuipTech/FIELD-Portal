import { SetMetadata } from '@nestjs/common';

export const REQUIRED_ROLES_KEY = 'requiredRoles';

// Pair with @UseGuards(JwtAuthGuard, RequireRolesGuard): the caller must
// hold at least one of these role names.
export const RequireRoles = (...roleNames: string[]) =>
  SetMetadata(REQUIRED_ROLES_KEY, roleNames);
