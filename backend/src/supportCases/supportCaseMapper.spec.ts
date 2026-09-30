import {
  toCaseMessage,
  toStatusCounts,
  toSupportCase,
} from './supportCaseMapper';
import { CaseMessageRow, SupportCaseRow } from './types/supportCaseRows';

const caseRow = (overrides: Partial<SupportCaseRow> = {}): SupportCaseRow => ({
  id: 'case-1',
  case_number: '1042',
  subject: 'Brake pressure alarm on cold start',
  category: 'alarm',
  status: 'open',
  priority: 'P1',
  created_at: new Date('2026-09-29T08:00:00Z'),
  updated_at: new Date('2026-09-29T09:00:00Z'),
  resolved_at: null,
  machine_id: 'machine-1',
  machine_label: 'HT-2201',
  machine_model_name: 'CAT 793F',
  assignee_id: null,
  assignee_first_name: null,
  assignee_last_name: null,
  reporter_id: 'user-1',
  reporter_first_name: 'Ada',
  reporter_last_name: 'Okoye',
  ...overrides,
});

const messageRow = (
  overrides: Partial<CaseMessageRow> = {},
): CaseMessageRow => ({
  id: 'message-1',
  note: 'E-2204 on every cold start.',
  created_at: new Date('2026-09-29T08:00:00Z'),
  author_id: 'user-1',
  author_first_name: 'Ada',
  author_last_name: 'Okoye',
  case_reporter_id: 'user-1',
  ...overrides,
});

describe('toSupportCase', () => {
  it('maps the case number to a number and nests the machine', () => {
    const result = toSupportCase(caseRow());
    expect(result.caseNumber).toBe(1042);
    expect(result.machine).toEqual({
      id: 'machine-1',
      label: 'HT-2201',
      modelName: 'CAT 793F',
    });
    expect(result.assignee).toBeNull();
    expect(result.reporter).toEqual({ id: 'user-1', name: 'Ada Okoye' });
  });

  it('has no machine when none is linked', () => {
    expect(
      toSupportCase(caseRow({ machine_id: null, machine_label: null })).machine,
    ).toBeNull();
  });
});

describe('toCaseMessage', () => {
  it("labels the reporter's own messages as reporter", () => {
    expect(toCaseMessage(messageRow()).authorRole).toBe('reporter');
  });

  it('labels everyone else as support', () => {
    expect(toCaseMessage(messageRow({ author_id: 'user-2' })).authorRole).toBe(
      'support',
    );
  });

  it('treats a deleted author as support, with no author', () => {
    const result = toCaseMessage(
      messageRow({ author_id: null, case_reporter_id: null }),
    );
    expect(result.author).toBeNull();
    expect(result.authorRole).toBe('support');
  });
});

describe('toStatusCounts', () => {
  it('fills statuses with no cases with zero', () => {
    expect(toStatusCounts([{ status: 'open', count: '7' }])).toEqual({
      open: 7,
      in_progress: 0,
      resolved: 0,
    });
  });
});
