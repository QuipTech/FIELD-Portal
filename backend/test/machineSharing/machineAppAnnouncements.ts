import { BillingTestDatabase } from '../billing/billingTestDatabase';

export interface Announced {
  event: string;
  reason?: string | null;
  status?: string;
  tabletOnline?: boolean;
  portalOnline?: boolean;
}

// pg_notify only fires on COMMIT and the specs roll back, so mc_announce()
// is swapped for one that records each payload in a table (rolled back too).
export const recordMachineAppAnnouncements = (fixture: BillingTestDatabase) =>
  fixture.db.exec(`
    CREATE TABLE test_announced (payload jsonb, at serial);
    GRANT ALL ON test_announced TO PUBLIC;
    GRANT ALL ON SEQUENCE test_announced_at_seq TO PUBLIC;
    CREATE OR REPLACE FUNCTION mc_announce(p_payload jsonb)
    RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
      INSERT INTO test_announced (payload) VALUES (p_payload);
    $$;`);

// Status events keep their state fields; the others their reason.
export const readMachineAppAnnouncements = async (
  fixture: BillingTestDatabase,
): Promise<Announced[]> => {
  const { rows } = await fixture.query(
    'SELECT payload FROM test_announced ORDER BY at',
  );
  return rows.map(({ payload }: { payload: Announced }) => {
    const { event, reason, status, tabletOnline, portalOnline } = payload;
    return status
      ? { event, status, tabletOnline, portalOnline }
      : { event, reason };
  });
};
