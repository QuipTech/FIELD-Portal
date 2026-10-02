import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { findUserAccess } from '../userAccess.repository';
import { AuthenticatedUser } from '../types/authenticatedUser';
import { AdminScope, resolveAdminScope } from './adminScope';

const NO_ADMIN_ACCESS_MESSAGE = "You don't have permission to do this.";

export interface AdminScopedRequest {
  user: AuthenticatedUser;
  adminScope?: AdminScope;
}

// For admin routes scoped by AdminScope (the Owner: every organisation). Reads roles and permissions from the
// database on every request and puts the result on request.adminScope;
// read it with @CurrentAdminScope(). Must run after JwtAuthGuard.
@Injectable()
export class AdminScopeGuard implements CanActivate {
  constructor(private readonly databaseService: DatabaseService) {}

  canActivate = async (context: ExecutionContext): Promise<boolean> => {
    const request = context.switchToHttp().getRequest<AdminScopedRequest>();
    const access = await this.databaseService.withTenant(
      request.user.tenantId,
      (client) => findUserAccess(client, request.user.userId),
    );
    const scope = resolveAdminScope(access);
    if (!scope) throw new ForbiddenException(NO_ADMIN_ACCESS_MESSAGE);
    request.adminScope = scope;
    return true;
  };
}
