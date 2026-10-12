// Rows read by the dashboard repositories. count(*) arrives as a string.

export interface CaseCountsRow {
  total: string;
  breaching: string;
  p1: string;
  p2: string;
  p3: string;
}

export interface DownMachineRow {
  id: string;
  label: string;
  total: string;
}

export interface EntryCountsRow {
  total: string;
  mine: string;
}

export interface StatusEventRow {
  machine_id: string;
  status: string;
  changed_at: Date;
}

export interface CaseActivityRow {
  case_number: string;
  subject: string;
  status: string;
  priority: string;
  machine_label: string | null;
  updated_at: Date;
}

export interface EntryActivityRow {
  id: string;
  machine_id: string;
  machine_label: string;
  entry_type: string;
  description: string;
  author_first_name: string | null;
  author_last_name: string | null;
  created_at: Date;
}

export interface ThreadActivityRow {
  id: string;
  title: string | null;
  machine_label: string | null;
  latest_answer: string | null;
  source_count: string;
  updated_at: Date;
}

export interface KnowledgeActivityRow {
  id: string;
  title: string;
  type: string;
  is_shared: boolean;
  created_at: Date;
}
