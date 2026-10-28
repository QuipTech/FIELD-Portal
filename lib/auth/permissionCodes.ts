// Permission codes the portal gates actions on. They must match the codes
// seeded in the backend's permissions table (migrations 0004 / 0029).
export const PERMISSIONS = {
  viewMachines: "machine.view",
  registerMachine: "machine.create",
  manageMachine: "machine.manage",
  // Organisation Admin and Owner: activate (start billing), archive, reactivate.
  manageMachineLifecycle: "machine.lifecycle",
  // Owner and Organisation Admin: the organisation's plan, invoices and payment method.
  manageBilling: "billing.manage",
  addHistoryEntry: "history.create",
  useAiAssistant: "ai.use",
  raiseSupportCase: "support.create",
  manageSupportCases: "support.manage",
  // QuipTech support staff (Support Agent, and Owner): the support queue.
  workSupportCases: "support.agent",
  submitDocuments: "knowledge.submit",
  deleteMachinePhotos: "history.delete_photos",
  // Owner only: the platform administrator — every organisation + platform screens.
  managePlatform: "platform.manage",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Shown in "your role doesn't allow …" messages.
export const permissionLabels: Record<PermissionCode, string> = {
  "machine.view": "View machines",
  "machine.create": "Register a new machine",
  "machine.manage": "Edit machine records",
  "machine.lifecycle": "Activate, archive and reactivate machines",
  "billing.manage": "Manage the organisation's billing and plan",
  "history.create": "Add history entries",
  "ai.use": "Use the AI assistant",
  "support.create": "Raise support cases",
  "support.manage": "Manage support cases",
  "support.agent": "Work support cases (QuipTech support staff)",
  "knowledge.submit": "Submit knowledge items for review",
  "history.delete_photos": "Delete machine photos",
  "platform.manage": "Manage the whole platform",
};

export const describeMissingPermission = (permission: PermissionCode): string =>
  `Your role doesn't include "${permissionLabels[permission]}". Ask your administrator for access.`;
