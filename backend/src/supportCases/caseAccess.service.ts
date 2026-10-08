import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { findUserPermissionCodes } from '../auth/userAccess.repository';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { findCaseTenantId } from './adminSupportCases.repository';
import { findCaseByNumber } from './supportCases.repository';
import { CaseViewerRole, resolveCaseViewerRole } from './caseAccessPolicy';
import { CaseStaffRole } from './types/adminSupportCaseResponse';
import { SupportCaseRow } from './types/supportCaseRows';

const CASE_NOT_FOUND_MESSAGE = 'Support case not found.';

export interface CaseAccess {
  role: CaseViewerRole;
  // The case's organisation: everything after this runs under its RLS.
  caseTenantId: string;
  supportCase: SupportCaseRow;
}

export interface StaffCaseAccess extends CaseAccess {
  role: CaseStaffRole;
}

// Finds a case by number in any organisation and decides who the caller
// is on it (caseAccessPolicy). Permissions are read per call, so a role
// change applies immediately.
@Injectable()
export class CaseAccessService {
  constructor(private readonly databaseService: DatabaseService) {}

  loadPermissions = (actor: AuthenticatedUser): Promise<string[]> =>
    this.databaseService.withTenant(actor.tenantId, (client) =>
      findUserPermissionCodes(client, actor.userId),
    );

  // null when the case doesn't exist or isn't the caller's to see.
  resolveAccess = async (
    actor: AuthenticatedUser,
    caseNumber: number,
    permissions?: string[],
  ): Promise<CaseAccess | null> => {
    const granted = permissions ?? (await this.loadPermissions(actor));
    const caseTenantId = await findCaseTenantId(
      this.databaseService,
      caseNumber,
    );
    if (!caseTenantId) return null;
    const supportCase = await this.databaseService.withTenant(
      caseTenantId,
      (client) => findCaseByNumber(client, caseTenantId, caseNumber),
    );
    if (!supportCase) return null;
    const role = resolveCaseViewerRole(
      { userId: actor.userId, tenantId: actor.tenantId, permissions: granted },
      { tenantId: caseTenantId, assigneeId: supportCase.assignee_id },
    );
    return role ? { role, caseTenantId, supportCase } : null;
  };

  // The admin and staff routes: 404 unless the caller is the admin or the
  // case's assignee — a customer of the case gets 404 here too.
  requireStaffAccess = async (
    actor: AuthenticatedUser,
    caseNumber: number,
  ): Promise<StaffCaseAccess> => {
    const access = await this.resolveAccess(actor, caseNumber);
    if (!access || access.role === 'customer') {
      throw new NotFoundException(CASE_NOT_FOUND_MESSAGE);
    }
    return access as StaffCaseAccess;
  };
}
