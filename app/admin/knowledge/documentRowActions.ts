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

export const availableRowActions = (document: KnowledgeDocument) =>
  (Object.entries(ROW_ACTIONS) as [DocumentRowAction, RowActionMeta][])
    .filter(([, meta]) => meta.states.includes(document.state))
    .map(([action, meta]) => ({ action, ...meta }));
