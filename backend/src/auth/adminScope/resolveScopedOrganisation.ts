import { NotFoundException } from '@nestjs/common';
import { AdminScope } from './adminScope';

const ORGANISATION_NOT_FOUND_MESSAGE = 'Organisation not found.';

// The organisation an admin request acts in: the one asked for when the
// scope covers it (the Owner: any), else the caller's own.
export const resolveScopedOrganisation = (
  scope: AdminScope,
  callerTenantId: string,
  requestedTenantId?: string,
): string => {
  if (!requestedTenantId) return scope.tenantId ?? callerTenantId;
  if (scope.tenantId && scope.tenantId !== requestedTenantId) {
    throw new NotFoundException(ORGANISATION_NOT_FOUND_MESSAGE);
  }
  return requestedTenantId;
};
