import type { PermissionCode } from "../auth/permissionCodes";

export interface ChatSource {
  label: string;
  icon: "book" | "alert";
}

export interface ChatAction {
  label: string;
  icon: "ext" | "file" | "life";
  // Set for actions that need one, e.g. "Raise case" needs support.create.
  permission?: PermissionCode;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  paragraphs: string[];
  sources?: ChatSource[];
  actions?: ChatAction[];
}

export interface AssistantThread {
  id: string;
  title: string;
}
