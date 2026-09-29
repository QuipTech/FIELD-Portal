import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseService } from '../../database/database.service';
import { findUserPermissionCodes } from '../userAccess.repository';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/requirePermissions.decorator';
import { AuthenticatedUser } from '../types/authenticatedUser';

const MISSING_PERMISSION_MESSAGE = "Your role doesn't allow this action.";

// The server-side twin of the portal's PermissionButton: the UI only
// disables actions, this is what actually refuses them. Permissions are
// read per request, so a change on the Roles page applies immediately.
// Must run after JwtAuthGuard, which puts the caller on request.user.
@Injectable()
export class RequirePermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly databaseService: DatabaseService,
  ) {}

  canActivate = async (context: ExecutionContext): Promise<boolean> => {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermissions?.length) return true;

    const user = context
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUser }>().user;
    const granted = await this.databaseService.withTenant(
      user.tenantId,
      (client) => findUserPermissionCodes(client, user.userId),
    );
    if (!requiredPermissions.every((code) => granted.includes(code))) {
      throw new ForbiddenException(MISSING_PERMISSION_MESSAGE);
    }
    return true;
  };
}
