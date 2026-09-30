// Rows read by supportCases.repository / caseMessages.repository. bigint
// arrives from pg as a string.
export interface SupportCaseRow {
  id: string;
  case_number: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  created_at: Date;
  updated_at: Date;
  resolved_at: Date | null;
  machine_id: string | null;
  machine_label: string | null;
  machine_model_name: string | null;
  assignee_id: string | null;
  assignee_first_name: string | null;
  assignee_last_name: string | null;
  reporter_id: string | null;
  reporter_first_name: string | null;
  reporter_last_name: string | null;
}

export interface CaseMessageRow {
  id: string;
  note: string;
  created_at: Date;
  author_id: string | null;
  author_first_name: string | null;
  author_last_name: string | null;
  // The case's reporter, to label each message "Reported" or "Support".
  case_reporter_id: string | null;
}

export interface StatusCountRow {
  status: string;
  count: string;
}
