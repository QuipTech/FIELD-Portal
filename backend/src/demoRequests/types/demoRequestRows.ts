import { DemoRequestStatus } from './demoRequestStatus';

// A platform.demo_requests row, as selected by demoRequests.repository.
export interface DemoRequestRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  company: string;
  country: string;
  phone: string | null;
  message: string | null;
  status: DemoRequestStatus;
  notes: string | null;
  team_email_sent_at: Date | null;
  user_email_sent_at: Date | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DemoRequestListRow extends DemoRequestRow {
  // count(*) OVER () — the matching total before paging.
  total_count: string;
}
