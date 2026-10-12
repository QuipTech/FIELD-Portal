import {
  computeFleetUptime,
  startOfUtcWeek,
  uptimeWindowStart,
} from './computeFleetUptime';

// Thursday noon UTC; its week started Monday 28 Sep 2026.
const now = new Date('2026-10-01T12:00:00Z');
const at = (iso: string) => new Date(iso);

describe('startOfUtcWeek', () => {
  it('returns Monday 00:00 UTC, including for a Sunday', () => {
    expect(startOfUtcWeek(now).toISOString()).toBe('2026-09-28T00:00:00.000Z');
    expect(startOfUtcWeek(at('2026-10-04T23:00:00Z')).toISOString()).toBe(
      '2026-09-28T00:00:00.000Z',
    );
  });

  it('starts the 8-week window 7 weeks before this Monday', () => {
    expect(uptimeWindowStart(now).toISOString()).toBe(
      '2026-08-10T00:00:00.000Z',
    );
  });
});

describe('computeFleetUptime', () => {
  it('reports nothing before tracking started', () => {
    const uptime = computeFleetUptime([], null, now);
    expect(uptime.weeks).toHaveLength(8);
    expect(uptime.weeks.every((week) => week.uptimePercent === null)).toBe(
      true,
    );
    expect(uptime.averagePercent).toBeNull();
  });

  it('counts down time against tracked machine-time this week only', () => {
    // Tracked from Monday; down for the 24h from Tuesday to Wednesday.
    const uptime = computeFleetUptime(
      [
        {
          machineId: 'a',
          status: 'running',
          changedAt: at('2026-09-28T00:00:00Z'),
        },
        {
          machineId: 'a',
          status: 'down',
          changedAt: at('2026-09-29T00:00:00Z'),
        },
        {
          machineId: 'a',
          status: 'service_due',
          changedAt: at('2026-09-30T00:00:00Z'),
        },
      ],
      at('2026-09-28T00:00:00Z'),
      now,
    );
    // 3.5 days tracked, 1 day down → 71.4%.
    expect(uptime.weeks[7]).toEqual({
      weekStart: '2026-09-28',
      uptimePercent: 71.4,
    });
    expect(uptime.weeks[6].uptimePercent).toBeNull();
    expect(uptime.averagePercent).toBe(71.4);
  });

  it('carries a status from before the window into it', () => {
    const uptime = computeFleetUptime(
      [
        {
          machineId: 'a',
          status: 'down',
          changedAt: at('2026-06-01T00:00:00Z'),
        },
      ],
      at('2026-06-01T00:00:00Z'),
      now,
    );
    expect(uptime.weeks.map((week) => week.uptimePercent)).toEqual(
      Array(8).fill(0),
    );
  });

  it('weights machines by tracked time', () => {
    const monday = at('2026-09-28T00:00:00Z');
    const uptime = computeFleetUptime(
      [
        { machineId: 'a', status: 'running', changedAt: monday },
        { machineId: 'b', status: 'down', changedAt: monday },
      ],
      monday,
      now,
    );
    expect(uptime.weeks[7].uptimePercent).toBe(50);
  });
});
