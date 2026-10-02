// Mirrors backend/src/notifications/types/notificationResponse.ts.

export type NotificationKind =
  | "case_message"
  | "case_assigned"
  | "case_status"
  | "case_priority"
  | "machine_status"
  | "ai_review"
  | "knowledge_document"
  // From the organisation's alert rules.
  | "alert";

export interface UserNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  // Portal path it opens, e.g. /cases/1042.
  link: string;
  createdAt: string;
  isRead: boolean;
}

export interface NotificationList {
  items: UserNotification[];
  unreadCount: number;
  // Pass as `before` for the next page; null when there are no more.
  nextBefore: string | null;
}
