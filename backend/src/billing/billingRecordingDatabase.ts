import { PoolClient } from 'pg';
import { ServiceDatabaseService } from '../database/serviceDatabase.service';

export interface RecordedQuery {
  sql: string;
  params: unknown[];
}

// A service-role pool for the billing service specs that records every
// statement and answers from `respond` (unmatched statements get no rows),
// so a spec can assert exactly what was written, and that nothing was.
export const createRecordingDatabase = (
  respond: (sql: string, params: unknown[]) => unknown[] | undefined = () =>
    undefined,
) => {
  const queries: RecordedQuery[] = [];
  const query = async (sql: string, params: unknown[] = []) => {
    queries.push({ sql, params });
    const rows = respond(sql, params) ?? [];
    return { rows, rowCount: rows.length };
  };
  const client = { query } as unknown as PoolClient;
  const serviceDatabase = {
    query,
    transaction: async <T>(work: (pool: PoolClient) => Promise<T>) =>
      work(client),
  } as unknown as ServiceDatabaseService;
  const writes = () =>
    queries.filter((entry) => /^\s*(INSERT|UPDATE|DELETE)/i.test(entry.sql));
  return { serviceDatabase, client, queries, writes };
};
