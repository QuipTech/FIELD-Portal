export interface CaseMessage {
  id: string;
  authorInitials: string;
  authorName: string;
  roleLabel: "Reported" | "Support";
  timestampLabel: string;
  body: string;
  photoCount?: number;
}
