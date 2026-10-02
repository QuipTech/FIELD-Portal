import type { IconName } from "@/components/icons/icon";
import type { KnowledgeDocument, KnowledgeDocumentState } from "@/lib/types/adminDocument";

export type DocumentRowAction = "approve" | "reject" | "retry" | "archive" | "newVersion" | "download" | "delete";

interface RowActionMeta {
  label: string;
  icon: IconName;
  tone?: "danger";
  // States in which the backend accepts this action.
  states: KnowledgeDocumentState[];
}

// Mirrors the backend's rules (transition_knowledge_item and
// assertAcceptsNewVersion), so the menu never offers an action that would
// be refused. Order is the menu order.
const ROW_ACTIONS: Record<DocumentRowAction, RowActionMeta> = {
  approve: { label: "Approve", icon: "check", states: ["needs_review"] },
  reject: { label: "Reject", icon: "x", states: ["needs_review"] },
  retry: { label: "Retry indexing", icon: "history", states: ["failed"] },
  archive: { label: "Archive", icon: "layers", states: ["live"] },
  newVersion: { label: "New version", icon: "upload", states: ["live", "needs_review", "failed"] },
  download: {
    label: "Download",
    icon: "download",
    states: ["queued", "indexing", "failed", "needs_review", "live", "archived"],
  },
  delete: {
    label: "Delete",
    icon: "x",
    tone: "danger",
    states: ["uploading", "queued", "indexing", "failed", "needs_review", "live", "archived"],
  },
};

// Approving and rejecting is a QuipTech (Owner) decision.
const REVIEW_ACTIONS: DocumentRowAction[] = ["approve", "reject"];

// A document the admin can't change (the shared library, for an Owner)
// only offers Download; review actions need canReview as well.
export const availableRowActions = (document: KnowledgeDocument, canReview: boolean) =>
  (Object.entries(ROW_ACTIONS) as [DocumentRowAction, RowActionMeta][])
    .filter(([, meta]) => meta.states.includes(document.state))
    .filter(([action]) => (document.isEditable ?? false) || action === "download")
    .filter(([action]) => canReview || !REVIEW_ACTIONS.includes(action))
    .map(([action, meta]) => ({ action, ...meta }));
