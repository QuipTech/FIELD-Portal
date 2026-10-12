import {
  caseToActivity,
  mergeActivity,
  threadToActivity,
} from './recentActivityMapper';

describe('recentActivityMapper', () => {
  it('describes a case with its machine, status and priority tag', () => {
    const item = caseToActivity({
      case_number: '1042',
      subject: 'Brake pressure alarm',
      status: 'open',
      priority: 'P1',
      machine_label: 'HT-2201',
      updated_at: new Date('2026-10-01T10:00:00Z'),
    });
    expect(item).toMatchObject({
      title: 'Case #1042 · Brake pressure alarm',
      caption: 'HT-2201 · open',
      href: '/cases/1042',
      tag: { label: 'P1 open', tone: 'danger' },
    });
  });

  it('counts only the sources an AI answer actually cites', () => {
    const item = threadToActivity({
      id: 't1',
      title: 'Fault E-2204',
      machine_label: null,
      latest_answer: 'Recharge [1]. Then check [3].',
      source_count: '4',
      updated_at: new Date('2026-10-01T10:00:00Z'),
    });
    expect(item.caption).toBe('2 sources cited');
    expect(item.href).toBe('/assistant?thread=t1');
  });

  it('merges sources newest first and keeps the limit', () => {
    const at = (iso: string) => ({ occurredAt: iso }) as never;
    const merged = mergeActivity(
      [
        at('2026-10-01T01:00:00Z'),
        at('2026-10-01T03:00:00Z'),
        at('2026-10-01T02:00:00Z'),
      ],
      2,
    );
    expect(merged.map((item) => item.occurredAt)).toEqual([
      '2026-10-01T03:00:00Z',
      '2026-10-01T02:00:00Z',
    ]);
  });
});
