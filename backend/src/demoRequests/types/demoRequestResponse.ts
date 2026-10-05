import { DemoRequestStatus } from './demoRequestStatus';

// The admin portal's view of one demo request.
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

// The only thing the public endpoint ever returns (with 201).
export interface DemoRequestAccepted {
  ok: true;
}
