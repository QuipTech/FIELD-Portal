import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseService } from '../../database/database.service';
import { findUserRoleNames } from '../userAccess.repository';
import { REQUIRED_ROLES_KEY } from '../decorators/requireRoles.decorator';
import { AuthenticatedUser } from '../types/authenticatedUser';

const MISSING_ROLE_MESSAGE = "You don't have permission to do this.";

// Roles are read from the database on every request rather than trusted
// from the access token, so removing a role takes effect immediately.
// Must run after JwtAuthGuard, which puts the caller on request.user.
@Injectable()
export class RequireRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly databaseService: DatabaseService,
  ) {}

  canActivate = async (context: ExecutionContext): Promise<boolean> => {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles?.length) return true;

    const user = context.switchToHttp().getRequest<{
      user: AuthenticatedUser;
    }>().user;
    const callerRoles = await this.databaseService.withTenant(
      user.tenantId,
      (client) => findUserRoleNames(client, user.userId),
    );
    if (!callerRoles.some((role) => requiredRoles.includes(role))) {
      throw new ForbiddenException(MISSING_ROLE_MESSAGE);
    }
    return true;
  };
}
