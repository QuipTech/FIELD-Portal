import type { AdminSupportCase } from "@/lib/types/adminSupportCase";
import type { CaseStatus } from "@/lib/types/supportCase";

// The API's rules (caseAccessPolicy), mirrored to show the right controls;
// the API still refuses anything outside them.

const ADMIN_STATUSES: CaseStatus[] = ["open", "waiting_on_customer", "resolved", "closed"];
const ASSIGNEE_STATUSES: CaseStatus[] = ["open", "waiting_on_customer", "resolved"];

// "new" is never chosen: it follows from unassigning.
export const selectableStatuses = (item: AdminSupportCase): CaseStatus[] =>
  item.viewerRole === "admin" ? ADMIN_STATUSES : ASSIGNEE_STATUSES;

export const isAdminViewer = (item: AdminSupportCase): boolean => item.viewerRole === "admin";

export const canMarkWaiting = (item: AdminSupportCase): boolean => item.status === "new" || item.status === "open";

export const canResolve = (item: AdminSupportCase): boolean =>
  item.status === "new" || item.status === "open" || item.status === "waiting_on_customer";

export const staffReplyClosedReason = (item: AdminSupportCase): string | null => {
  if (item.status === "resolved") return "Resolved: the customer can reopen it within 7 days. Internal notes are still open.";
  if (item.status === "closed") return "This case is closed.";
  return null;
};
