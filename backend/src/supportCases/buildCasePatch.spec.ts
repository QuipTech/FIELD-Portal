import { buildCasePatch } from './buildCasePatch';

const SLA_HOURS = { P1: 4, P2: 24, P3: 72 };

describe('buildCasePatch', () => {
  it('assigning a new case sets its status to open, with a line for each', () => {
    const { patch, events } = buildCasePatch(
      { status: 'new', priority: 'P2', assignee_id: null },
      { assigneeId: 'staff-1' },
      SLA_HOURS,
    );
    expect(patch).toEqual({ assigneeId: 'staff-1', status: 'open' });
    expect(events).toEqual([
      { type: 'assigned', fromValue: null, toValue: 'staff-1' },
      { type: 'status_changed', fromValue: 'new', toValue: 'open' },
    ]);
  });

  it('records an unassignment with the previous assignee', () => {
    const { patch, events } = buildCasePatch(
      { status: 'open', priority: 'P2', assignee_id: 'staff-1' },
      { assigneeId: null },
      SLA_HOURS,
    );
    expect(patch).toEqual({ assigneeId: null, status: 'new' });
    expect(events[0]).toEqual({
      type: 'unassigned',
      fromValue: 'staff-1',
      toValue: null,
    });
  });

  it('moves the SLA due time by the difference in targets', () => {
    const { patch, events } = buildCasePatch(
      { status: 'open', priority: 'P3', assignee_id: 'staff-1' },
      { priority: 'P1' },
      SLA_HOURS,
    );
    expect(patch).toEqual({ priority: 'P1', slaShiftHours: -68 });
    expect(events).toEqual([
      { type: 'priority_changed', fromValue: 'P3', toValue: 'P1' },
    ]);
  });

  it('changes nothing for values the case already has', () => {
    expect(
      buildCasePatch(
        { status: 'open', priority: 'P2', assignee_id: 'staff-1' },
        { status: 'open', priority: 'P2', assigneeId: 'staff-1' },
        SLA_HOURS,
      ),
    ).toEqual({ patch: {}, events: [] });
  });
});
