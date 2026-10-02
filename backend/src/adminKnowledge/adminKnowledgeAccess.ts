import { ForbiddenException } from '@nestjs/common';
import { AdminScope } from '../auth/adminScope/adminScope';
import { KnowledgeDocumentRow } from '../knowledge/types/knowledgeDocumentRows';
import { KnowledgeDocumentFilter } from '../knowledge/knowledgeDocuments.repository';

const SHARED_DOCUMENT_MESSAGE =
  'This document is in the shared QuipTech library. Only QuipTech admins can change it.';

// What the admin Knowledge screen lists for the caller's AdminScope: the
// shared library plus that organisation's documents, or every document for
// the Owner.
export const toKnowledgeVisibility = (
  scope: AdminScope,
): Pick<
  KnowledgeDocumentFilter,
  'visibleToTenantId' | 'includeAllTenants'
> => ({
  visibleToTenantId: scope.tenantId,
  includeAllTenants: scope.isPlatform,
});

// Owner (platform): any document. Organisation admin: only their own.
export const canManageKnowledgeDocument = (
  scope: AdminScope,
  row: KnowledgeDocumentRow,
): boolean =>
  scope.isPlatform ||
  (row.tenant_id !== null && row.tenant_id === scope.tenantId);

export const assertCanManageKnowledgeDocument = (
  scope: AdminScope,
  row: KnowledgeDocumentRow,
): void => {
  if (!canManageKnowledgeDocument(scope, row)) {
    throw new ForbiddenException(SHARED_DOCUMENT_MESSAGE);
  }
};
