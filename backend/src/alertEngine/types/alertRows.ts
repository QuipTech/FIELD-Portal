// Rows of the alert_* functions in migration 0065.

export interface AlertRuleRow {
  id: string;
  tenant_id: string;
  name: string;
  trigger_type: string;
  trigger_params: Record<string, unknown>;
  audiences: string[];
  channels: string[];
  cooldown_minutes: number;
  push_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
}

export interface MachineInStatusRow {
  machine_id: string;
  label: string;
  detail: string;
  since: Date;
}

export interface UnactionedCaseRow {
  case_id: string;
  // bigint arrives as a string.
  case_number: string;
  subject: string;
  site: string | null;
  created_at: Date;
}

export interface RecipientCandidateRow {
  user_id: string;
  tenant_id: string;
  first_name: string;
  email: string | null;
  phone_number: string | null;
  role_names: string[];
  is_case_assignee: boolean;
  has_worked_on_machine: boolean;
  has_reviewed_answers: boolean;
}

export interface TenantBrandingRow {
  name: string;
  branding_color_accent: string | null;
  branding_color_primary: string | null;
}
