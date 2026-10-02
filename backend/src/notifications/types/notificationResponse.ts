export type NotificationKind =
  | 'case_message'
  | 'case_assigned'
  | 'case_status'
  | 'case_priority'
  | 'machine_status'
  | 'ai_review'
  | 'knowledge_document'
  // From an organisation's alert rules (src/alertEngine).
  | 'alert';

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
  // Pass as `before` to load the next page; null when there are no more.
  nextBefore: string | null;
}
