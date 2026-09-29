import { toAuditLogCsv, toCsvCell } from './toAuditLogCsv';

describe('toCsvCell', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(toCsvCell('plain')).toBe('plain');
    expect(toCsvCell('Pit 4, bench 7')).toBe('"Pit 4, bench 7"');
    expect(toCsvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('defuses cells a spreadsheet would run as formulas', () => {
    expect(toCsvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(toCsvCell('-1+2')).toBe("'-1+2");
    expect(toCsvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });
});

describe('toAuditLogCsv', () => {
  it('writes a header and one row per event', () => {
    const csv = toAuditLogCsv([
      {
        id: '1',
        occurredAt: '2026-03-19T09:14:00.000Z',
        action: 'create',
        entityType: 'role',
        entityId: 'r1',
        actionLabel: 'Created role',
        target: 'Supervisor',
        source: 'web',
        actor: { id: 'u1', name: 'T. Meyer', avatarUrl: null },
        organisationName: 'QuipTech',
      },
    ]);
    expect(csv).toBe(
      'Time (UTC),Actor,Organisation,Action,Target,Source\r\n' +
        '2026-03-19T09:14:00.000Z,T. Meyer,QuipTech,Created role,Supervisor,Web\r\n',
    );
  });
});
