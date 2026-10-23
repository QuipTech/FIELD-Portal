import { PLATFORM_PERMISSION_CODE } from './systemRoleNames';

// What the apps branch on, from permission codes rather than role names:
// roles can be renamed or added per organisation, permissions can't.
export interface MeCapabilities {
  // platform.manage: QuipTech's own admin (the Owner role).
  isPlatformAdmin: boolean;
  // admin.manage_users: manages the organisation's team (/team).
  isOrganisationAdmin: boolean;
  // knowledge.publish: Knowledge admin (documents in every state, attention).
  isKnowledgeAdmin: boolean;
  // support.agent: QuipTech support staff (/admin/cases).
  isSupportStaff: boolean;
  canUseAi: boolean;
  canManageMachines: boolean;
}

export const toMeCapabilities = (permissions: string[]): MeCapabilities => {
  const has = (code: string) => permissions.includes(code);
  return {
    isPlatformAdmin: has(PLATFORM_PERMISSION_CODE),
    isOrganisationAdmin: has('admin.manage_users'),
    isKnowledgeAdmin: has('knowledge.publish'),
    isSupportStaff: has('support.agent'),
    canUseAi: has('ai.use'),
    canManageMachines: has('machine.manage'),
  };
};
