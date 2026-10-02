export interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string;
  created_at: Date;
  read_at: Date | null;
}
