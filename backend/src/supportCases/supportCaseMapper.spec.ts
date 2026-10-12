import {
  toCaseEvent,
  toCaseMessage,
  toStatusCounts,
  toSupportCase,
} from './supportCaseMapper';
import {
  buildCaseRow,
  buildEventRow,
  buildMessageRow,
} from './supportCaseTestRows';

describe('toSupportCase', () => {
  it('maps the case number to a number and nests the machine and people', () => {
    const result = toSupportCase(buildCaseRow());
    expect(result.caseNumber).toBe(1042);
    expect(result.machine).toEqual({
      id: 'machine-1',
      label: 'HT-2201',
      modelName: 'CAT 793F',
    });
    expect(result.assignee).toEqual({
      id: 'staff-1',
      name: 'Tobias Meyer',
      avatarUrl: null,
    });
    expect(result.slaDueAt).toBe('2026-09-29T12:00:00.000Z');
  });

  it('never exposes the reporter or assignee email', () => {
    expect(JSON.stringify(toSupportCase(buildCaseRow()))).not.toContain('@');
  });

  it('has no machine when none is linked', () => {
    expect(
      toSupportCase(buildCaseRow({ machine_id: null, machine_label: null }))
        .machine,
    ).toBeNull();
  });
});

describe('toCaseMessage', () => {
  it('keeps the author role and internal flag from the row', () => {
    const result = toCaseMessage(
      buildMessageRow({ author_role: 'admin', is_internal: true }),
    );
    expect(result.authorRole).toBe('admin');
    expect(result.isInternal).toBe(true);
    expect(result.attachments).toEqual([]);
  });

  it('has no author once their account is deleted', () => {
    expect(
      toCaseMessage(buildMessageRow({ author_id: null })).author,
    ).toBeNull();
  });
});

describe('toCaseEvent', () => {
  it('names the person an assignment went to', () => {
    const result = toCaseEvent(buildEventRow());
    expect(result.actor?.name).toBe('Amrit Kaur');
    expect(result.toPerson).toEqual({
      id: 'staff-1',
      name: 'Tobias Meyer',
      avatarUrl: null,
    });
    expect(result.fromPerson).toBeNull();
  });
});

describe('toStatusCounts', () => {
  it('fills statuses with no cases with zero', () => {
    expect(toStatusCounts([{ status: 'open', count: '7' }])).toEqual({
      new: 0,
      open: 7,
      waiting_on_customer: 0,
      resolved: 0,
      closed: 0,
    });
  });
});
