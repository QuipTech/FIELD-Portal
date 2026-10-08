import {
  CaseEventRow,
  CaseMessageRow,
  SupportCaseRow,
} from './types/supportCaseRows';

// Rows as the repositories return them, for the module's unit tests.

export const buildCaseRow = (
  overrides: Partial<SupportCaseRow> = {},
): SupportCaseRow => ({
  id: 'case-1',
  tenant_id: 'tenant-a',
  case_number: '1042',
  subject: 'Brake pressure alarm on cold start',
  description: 'E-2204 on every cold start.',
  category: 'alarm',
  status: 'open',
  priority: 'P1',
  created_at: new Date('2026-09-29T08:00:00Z'),
  updated_at: new Date('2026-09-29T09:00:00Z'),
  resolved_at: null,
  closed_at: null,
  sla_due_at: new Date('2026-09-29T12:00:00Z'),
  sla_paused_at: null,
  machine_id: 'machine-1',
  machine_label: 'HT-2201',
  machine_model_name: 'CAT 793F',
  assignee_id: 'staff-1',
  assignee_first_name: 'Tobias',
  assignee_last_name: 'Meyer',
  assignee_email: 'tobias@quiptech.example',
  assignee_avatar_url: null,
  reporter_id: 'customer-1',
  reporter_first_name: 'Ada',
  reporter_last_name: 'Okoye',
  reporter_email: 'ada@mine.example',
  reporter_avatar_url: null,
  ...overrides,
});

export const buildMessageRow = (
  overrides: Partial<CaseMessageRow> = {},
): CaseMessageRow => ({
  id: 'message-1',
  note: 'E-2204 on every cold start.',
  created_at: new Date('2026-09-29T08:00:00Z'),
  author_role: 'customer',
  is_internal: false,
  author_id: 'customer-1',
  author_first_name: 'Ada',
  author_last_name: 'Okoye',
  author_avatar_url: null,
  ...overrides,
});

export const buildEventRow = (
  overrides: Partial<CaseEventRow> = {},
): CaseEventRow => ({
  id: 'event-1',
  type: 'assigned',
  from_value: null,
  to_value: 'staff-1',
  created_at: new Date('2026-09-29T08:31:00Z'),
  actor_id: 'admin-1',
  actor_first_name: 'Amrit',
  actor_last_name: 'Kaur',
  actor_avatar_url: null,
  from_person_first_name: null,
  from_person_last_name: null,
  to_person_first_name: 'Tobias',
  to_person_last_name: 'Meyer',
  ...overrides,
});
