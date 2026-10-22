import { ForbiddenException } from '@nestjs/common';

// Knowledge admins see documents in every state (needs review, failed,
// archived) and the admin counts; everyone else sees live documents only.
export const KNOWLEDGE_ADMIN_PERMISSION = 'knowledge.publish';

const BRAND_NOT_IN_PLAN_MESSAGE =
  "This brand isn't included in your organisation's plan.";

export interface KnowledgeAccess {
  tenantId: string;
  userId: string;
  isAdmin: boolean;
  // platform.manage: may change shared-library classification and other
  // organisations' brand access.
  isPlatform: boolean;
  // The brands the plan includes; null = every brand (not restricted).
  brandIds: string[] | null;
}

// Documents without a brand are visible to everyone.
export const canOpenBrand = (
  access: KnowledgeAccess,
  brandId: string | null,
): boolean =>
  brandId === null ||
  access.brandIds === null ||
  access.brandIds.includes(brandId);

export const assertCanOpenBrand = (
  access: KnowledgeAccess,
  brandId: string | null,
): void => {
  if (!canOpenBrand(access, brandId)) {
    throw new ForbiddenException(BRAND_NOT_IN_PLAN_MESSAGE);
  }
};
