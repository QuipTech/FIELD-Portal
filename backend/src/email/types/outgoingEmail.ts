export interface EmailAttachment {
  // ASCII only, e.g. fleet-uptime-2026-10-02.csv.
  fileName: string;
  contentType: string;
  content: string;
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachment?: EmailAttachment;
}

// messageId is null when sending is switched off (logged instead).
export interface SentEmail {
  messageId: string | null;
}
