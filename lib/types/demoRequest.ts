// Demo requests from the marketing site (backend src/demoRequests).
export type DemoRequestStatus = "new" | "contacted" | "scheduled" | "completed" | "converted" | "lost";

export interface DemoRequest {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  country: string;
  phone: string | null;
  message: string | null;
  status: DemoRequestStatus;
  notes: string | null;
  // null = not sent yet (failed, or sending switched off).
  teamEmailSentAt: string | null;
  userEmailSentAt: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DemoRequestPage {
  items: DemoRequest[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DemoRequestListQuery {
  status?: DemoRequestStatus;
  search?: string;
  page: number;
  pageSize: number;
}

export interface DemoRequestUpdate {
  status?: DemoRequestStatus;
  notes?: string;
}

export interface ResendEmailsResult {
  teamEmailSent: boolean;
  userEmailSent: boolean;
  request: DemoRequest;
}
