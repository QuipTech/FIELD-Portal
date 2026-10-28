import { applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../auth/guards/requirePermissions.guard';
import { RequirePermissions } from '../auth/decorators/requirePermissions.decorator';
import { PLATFORM_PERMISSION_CODE } from '../auth/systemRoleNames';

// The platform administrator (Owner + platform.manage — what the brief
// calls super_admin, retired by migration 0060). Everyone else gets 403.
export const PlatformAdminOnly = () =>
  applyDecorators(
    UseGuards(JwtAuthGuard, RequirePermissionsGuard),
    RequirePermissions(PLATFORM_PERMISSION_CODE),
  );
