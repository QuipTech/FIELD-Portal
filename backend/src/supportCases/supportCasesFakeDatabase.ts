import { PoolClient } from 'pg';
import {
  buildCaseRow,
  buildEventRow,
  buildMessageRow,
} from './supportCaseTestRows';
import { SupportCaseRow } from './types/supportCaseRows';

// An in-memory stand-in for DatabaseService in supportCases.http.spec.ts.
// It answers the module's queries by recognising their SQL, and — like the
// real queries — only returns a case to a query naming its own tenant.

export const TEST_USERS: Record<
  string,
  { tenantId: string; permissions: string[] }
> = {
  'admin-1': {
    tenantId: 'quiptech',
    permissions: ['support.create', 'support.agent', 'platform.manage'],
  },
  'staff-1': {
    tenantId: 'quiptech',
    permissions: ['support.create', 'support.agent'],
  },
  'staff-2': {
    tenantId: 'quiptech',
    permissions: ['support.create', 'support.agent'],
  },
  'customer-a': { tenantId: 'tenant-a', permissions: ['support.create'] },
  'customer-b': { tenantId: 'tenant-b', permissions: ['support.create'] },
};

// A support person the admin can assign (assigneeId must be a UUID).
export const ASSIGNABLE_STAFF_ID = '7a1d2b9e-0c1f-4c55-9a7e-2f3b4c5d6e7f';

export interface FakeDatabaseState {
  supportCase: SupportCaseRow;
  updates: unknown[][];
  messageQueries: { includeInternal: boolean }[];
}

const MESSAGES = [
  buildMessageRow(),
  buildMessageRow({
    id: 'note-1',
    note: 'Customer is on an old firmware — check before replying.',
    author_id: 'staff-1',
    author_role: 'assignee',
    is_internal: true,
  }),
];

const answer = (state: FakeDatabaseState, sql: string, params: unknown[]) => {
  if (sql.includes('p.code')) {
    const userId = params[0] as string;
    return (TEST_USERS[userId]?.permissions ?? []).map((code) => ({ code }));
  }
  if (sql.includes('support_case_tenant_id')) {
    const isKnown = Number(params[0]) === Number(state.supportCase.case_number);
    return [{ tenant_id: isKnown ? state.supportCase.tenant_id : null }];
  }
  if (sql.includes('admin_list_support_staff')) {
    return ['admin-1', 'staff-1', 'staff-2', ASSIGNABLE_STAFF_ID].map((id) => ({
      id,
    }));
  }
  if (
    sql.includes('FROM support_cases c') &&
    sql.includes('c.case_number = $2')
  ) {
    const [tenantId, caseNumber] = params;
    const isMatch =
      tenantId === state.supportCase.tenant_id &&
      Number(caseNumber) === Number(state.supportCase.case_number);
    return isMatch ? [state.supportCase] : [];
  }
  if (
    sql.includes('UPDATE support_cases SET') &&
    !sql.includes('updated_at = now() WHERE')
  ) {
    state.updates.push(params);
    return [];
  }
  if (sql.includes('FROM support_updates u') && sql.includes('$3::boolean')) {
    const includeInternal = params[2] as boolean;
    state.messageQueries.push({ includeInternal });
    return MESSAGES.filter(
      (message) => includeInternal || !message.is_internal,
    );
  }
  if (sql.includes('INSERT INTO case_events')) return [{ id: 'event-1' }];
  if (sql.includes('FROM case_events e')) return [buildEventRow()];
  if (sql.includes('FROM tenants t')) {
    return [
      {
        id: state.supportCase.tenant_id,
        name: 'Acme Mining',
        plan: 'standard',
      },
    ];
  }
  return [];
};

export const createFakeDatabase = () => {
  const state: FakeDatabaseState = {
    supportCase: buildCaseRow(),
    updates: [],
    messageQueries: [],
  };
  const client = {
    query: async (sql: string, params: unknown[] = []) => {
      const rows = answer(state, sql, params);
      return { rows, rowCount: rows.length };
    },
  } as unknown as PoolClient;
  const run = <T>(_context: unknown, work: (fake: PoolClient) => Promise<T>) =>
    work(client);
  const databaseService = {
    query: client.query,
    withTenant: run,
    withActor: run,
    transaction: (work: (fake: PoolClient) => Promise<unknown>) => work(client),
  };
  const reset = (supportCase: Partial<SupportCaseRow> = {}) => {
    state.supportCase = buildCaseRow(supportCase);
    state.updates = [];
    state.messageQueries = [];
  };
  return { databaseService, state, reset };
};
