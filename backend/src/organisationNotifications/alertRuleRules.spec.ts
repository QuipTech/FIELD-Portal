import { BadRequestException } from '@nestjs/common';
import { toAlertRule, validateAlertRule } from './alertRuleRules';
import { AlertRuleDto } from './dto/alertRuleDto';

const dto = (overrides: Partial<AlertRuleDto>): AlertRuleDto =>
  Object.assign(new AlertRuleDto(), {
    name: 'Rule',
    triggerType: 'machine_down',
    triggerParams: {},
    audiences: ['admins'],
    channels: ['push'],
    ...overrides,
  });

const problemsOf = (rule: AlertRuleDto): string[] => {
  try {
    validateAlertRule(rule);
    return [];
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    return (
      (error as BadRequestException).getResponse() as { message: string[] }
    ).message;
  }
};

describe('validateAlertRule', () => {
  it('fills in defaults and drops unknown settings', () => {
    expect(validateAlertRule(dto({ triggerParams: { extra: 1 } }))).toEqual({
      hours: 4,
    });
    expect(
      validateAlertRule(
        dto({ triggerType: 'uptime_drop', triggerParams: { percent: 90 } }),
      ),
    ).toEqual({
      percent: 90,
      period: 'weekly',
    });
  });

  it('rejects out-of-range numbers, unknown options and unknown trigger types', () => {
    expect(problemsOf(dto({ triggerParams: { hours: 0 } }))).toEqual([
      'Down for more than must be a number from 1 to 720.',
    ]);
    expect(
      problemsOf(
        dto({
          triggerType: 'case_unactioned',
          triggerParams: { priority: 'P9' },
        }),
      )[0],
    ).toContain('Priority');
    expect(
      problemsOf(
        dto({
          triggerType: 'ai_answer_flagged',
          triggerParams: { reasons: [] },
        }),
      )[0],
    ).toContain('Flagged for');
    expect(problemsOf(dto({ triggerType: 'weather' }))).toEqual([
      'Unknown trigger type "weather".',
    ]);
  });

  it('allows SMS only on P1 case rules', () => {
    expect(() =>
      validateAlertRule(
        dto({
          triggerType: 'case_unactioned',
          triggerParams: { priority: 'P1' },
          channels: ['push', 'sms'],
        }),
      ),
    ).not.toThrow();
    expect(
      problemsOf(
        dto({
          triggerType: 'case_unactioned',
          triggerParams: { priority: 'P2' },
          channels: ['sms'],
        }),
      )[0],
    ).toContain('SMS');
    expect(problemsOf(dto({ channels: ['sms'] }))[0]).toContain('SMS');
  });
});

describe('toAlertRule', () => {
  it('writes the table labels and spots channels switched off organisation-wide', () => {
    const rule = toAlertRule(
      {
        id: 'r1',
        name: 'Machine down too long',
        trigger_type: 'machine_down',
        trigger_params: { hours: 4 },
        audiences: ['site_supervisors', 'admins'],
        channels: ['push', 'email'],
        is_enabled: true,
        created_at: new Date('2027-01-01T00:00:00Z'),
        updated_at: new Date('2027-01-01T00:00:00Z'),
      },
      { push: true, email: false, sms: true },
    );
    expect(rule).toMatchObject({
      triggerLabel: 'Status = Down for > 4 h',
      notifyLabel: 'Admins + Site supervisor',
      channelLabel: 'Push · Email',
      disabledChannels: ['email'],
    });
  });

  it('describes flagged-answer reasons in plain words', () => {
    const rule = toAlertRule(
      {
        id: 'r2',
        name: 'AI answer flagged',
        trigger_type: 'ai_answer_flagged',
        trigger_params: { reasons: ['low_confidence', 'safety_refusal'] },
        audiences: ['ai_reviewers'],
        channels: ['email'],
        is_enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      { push: true, email: true, sms: true },
    );
    expect(rule.triggerLabel).toBe('Low confidence or safety refusal');
  });
});
