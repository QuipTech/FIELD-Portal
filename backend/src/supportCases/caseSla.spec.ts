import { CaseSlaFields, toCaseSla } from './caseSla';

const NOW = new Date('2026-10-21T12:00:00Z');

// A P1 case: created 10:00, due 14:00 (4 hours).
const fields = (overrides: Partial<CaseSlaFields> = {}): CaseSlaFields => ({
  status: 'open',
  created_at: new Date('2026-10-21T10:00:00Z'),
  resolved_at: null,
  sla_due_at: new Date('2026-10-21T14:00:00Z'),
  sla_paused_at: null,
  first_response_at: null,
  ...overrides,
});

describe('toCaseSla', () => {
  it('is on track with time left', () => {
    expect(toCaseSla(fields(), NOW)).toMatchObject({
      state: 'on_track',
      minutesRemaining: 120,
    });
  });

  it('is due soon in the last quarter of its time', () => {
    const at1315 = new Date('2026-10-21T13:15:00Z');
    expect(toCaseSla(fields(), at1315).state).toBe('due_soon');
  });

  it('is breached past due, with negative minutes', () => {
    const at1430 = new Date('2026-10-21T14:30:00Z');
    expect(toCaseSla(fields(), at1430)).toMatchObject({
      state: 'breached',
      minutesRemaining: -30,
    });
  });

  it('is paused while waiting on the customer, with no countdown', () => {
    const paused = fields({
      status: 'waiting_on_customer',
      sla_paused_at: new Date('2026-10-21T11:00:00Z'),
    });
    expect(toCaseSla(paused, NOW)).toMatchObject({
      state: 'paused',
      minutesRemaining: null,
    });
  });

  it('is met or missed once resolved', () => {
    const resolvedAt = (time: string) =>
      fields({ status: 'resolved', resolved_at: new Date(time) });
    expect(toCaseSla(resolvedAt('2026-10-21T13:00:00Z'), NOW).state).toBe(
      'met',
    );
    expect(toCaseSla(resolvedAt('2026-10-21T15:00:00Z'), NOW).state).toBe(
      'missed',
    );
  });

  it('has no state without a due time', () => {
    expect(toCaseSla(fields({ sla_due_at: null }), NOW).state).toBeNull();
  });
});
