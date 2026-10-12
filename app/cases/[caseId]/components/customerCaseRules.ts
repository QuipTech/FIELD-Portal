import type { SupportCase } from "@/lib/types/supportCase";

// The API's rules (caseAccessPolicy), mirrored to show the right controls;
// the API still refuses anything outside them.

const REOPEN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const isReopenable = (item: SupportCase, now = new Date()): boolean =>
  item.status === "resolved" &&
  item.resolvedAt !== null &&
  now.getTime() - new Date(item.resolvedAt).getTime() <= REOPEN_WINDOW_MS;

export const replyClosedReason = (item: SupportCase): string | null => {
  if (item.status === "resolved") return "This case is resolved. Reopen it to reply.";
  if (item.status === "closed") return "This case is closed. Raise a new case if you need more help.";
  return null;
};
