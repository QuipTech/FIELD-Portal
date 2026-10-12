import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { findUserPermissionCodes } from '../auth/userAccess.repository';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { isSupportAdmin } from './caseAccessPolicy';
import { findIsSupportStaff } from './supportStaffStatus';

const NOT_STAFF_MESSAGE = 'Only QuipTech support staff can do this.';

export interface SupportStaffContext {
  // The admin works every case; anyone else only the cases assigned to them.
  isAdmin: boolean;
}

interface SupportStaffRequest {
  user: AuthenticatedUser;
  supportStaff?: SupportStaffContext;
}

// For /admin/cases: the caller must be QuipTech support staff
// (supportStaffStatus.ts), read from the database on every request. Must run
// after JwtAuthGuard. Which cases they may touch is CaseAccessService's.
@Injectable()
export class SupportStaffGuard implements CanActivate {
  constructor(private readonly databaseService: DatabaseService) {}

  canActivate = async (context: ExecutionContext): Promise<boolean> => {
    const request = context.switchToHttp().getRequest<SupportStaffRequest>();
    const permissions = await this.databaseService.withTenant(
      request.user.tenantId,
      (client) => findUserPermissionCodes(client, request.user.userId),
    );
    if (
      !(await findIsSupportStaff(this.databaseService, request.user.userId))
    ) {
      throw new ForbiddenException(NOT_STAFF_MESSAGE);
    }
    request.supportStaff = { isAdmin: isSupportAdmin(permissions) };
    return true;
  };
}

// Throws rather than defaulting, so a route that forgot the guard can never
// treat its caller as the admin.
export const CurrentSupportStaff = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SupportStaffContext => {
    const staff = context
      .switchToHttp()
      .getRequest<SupportStaffRequest>().supportStaff;
    if (!staff) {
      throw new InternalServerErrorException('SupportStaffGuard is missing.');
    }
    return staff;
  },
);
