import { describeCaseSla } from './describeCaseSla';

const created = new Date('2026-10-01T00:00:00Z');
const now = new Date('2026-10-02T00:00:00Z');

describe('describeCaseSla', () => {
  it('rates resolved cases against their target', () => {
    const resolved = new Date('2026-10-01T03:00:00Z');
    expect(describeCaseSla(created, resolved, 4, now)).toEqual({
      hoursOpen: 3,
      status: 'Met',
    });
    expect(describeCaseSla(created, resolved, 2, now).status).toBe('Missed');
  });

  it('rates open cases by how long they have been open so far', () => {
    expect(describeCaseSla(created, null, 72, now)).toEqual({
      hoursOpen: 24,
      status: 'Within target',
    });
    expect(describeCaseSla(created, null, 4, now).status).toBe('Breaching');
  });
});
