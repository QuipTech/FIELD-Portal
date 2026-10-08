// Rows read by the supportCases repositories. bigint arrives from pg as a
// string.
export interface SupportCaseRow {
  id: string;
  tenant_id: string;
  case_number: string;
  subject: string;
  description: string | null;
  category: string;
  status: string;
  priority: string;
  created_at: Date;
  updated_at: Date;
  resolved_at: Date | null;
  closed_at: Date | null;
  sla_due_at: Date | null;
  sla_paused_at: Date | null;
  machine_id: string | null;
  machine_label: string | null;
  machine_model_name: string | null;
  assignee_id: string | null;
  assignee_first_name: string | null;
  assignee_last_name: string | null;
  assignee_email: string | null;
  assignee_avatar_url: string | null;
  reporter_id: string | null;
  reporter_first_name: string | null;
  reporter_last_name: string | null;
  reporter_email: string | null;
  reporter_avatar_url: string | null;
}

export interface CaseMessageRow {
  id: string;
  note: string;
  created_at: Date;
  author_role: string;
  is_internal: boolean;
  author_id: string | null;
  author_first_name: string | null;
  author_last_name: string | null;
  author_avatar_url: string | null;
}

export interface CaseAttachmentRow {
  id: string;
  message_id: string | null;
  file_name: string;
  file_type: string;
  size_bytes: string;
  storage_key: string;
}

export interface CaseEventRow {
  id: string;
  type: string;
  from_value: string | null;
  to_value: string | null;
  created_at: Date;
  actor_id: string | null;
  actor_first_name: string | null;
  actor_last_name: string | null;
  actor_avatar_url: string | null;
  from_person_first_name: string | null;
  from_person_last_name: string | null;
  to_person_first_name: string | null;
  to_person_last_name: string | null;
}

export interface StatusCountRow {
  status: string;
  count: string;
}

export interface AdminCaseListRow {
  id: string;
  case_number: string;
  tenant_id: string;
  tenant_name: string;
  subject: string;
  status: string;
  priority: string;
  created_at: Date;
  updated_at: Date;
  sla_due_at: Date | null;
  sla_paused_at: Date | null;
  reporter_first_name: string | null;
  reporter_last_name: string | null;
  assignee_id: string | null;
  assignee_first_name: string | null;
  assignee_last_name: string | null;
  assignee_avatar_url: string | null;
  is_unread: boolean;
  total_count: string;
}

export interface AdminCaseStatsRow {
  unassigned: string;
  open: string;
  waiting_on_customer: string;
  sla_breached: string;
  assigned_to_viewer: string;
  all_open: string;
}

export interface SupportStaffRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url: string | null;
  is_admin: boolean;
  open_case_count: string;
}
