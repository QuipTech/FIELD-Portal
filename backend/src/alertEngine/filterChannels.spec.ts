import { filterChannels } from './filterChannels';
import { buildRule } from './alertTestFixtures';

describe('filterChannels', () => {
  it('keeps channels on for both the rule and the organisation', () => {
    const rule = buildRule({
      channels: ['push', 'email'],
      organisationChannels: { push: false, email: true, sms: true },
    });
    expect(filterChannels(rule)).toEqual(['email']);
  });

  it('allows SMS for P1 case rules', () => {
    expect(filterChannels(buildRule())).toEqual(['push', 'email', 'sms']);
  });

  it('drops SMS from every other rule', () => {
    const p2 = buildRule({ triggerParams: { priority: 'P2', minutes: 30 } });
    const machineDown = buildRule({
      triggerType: 'machine_down',
      triggerParams: { hours: 4 },
    });
    expect(filterChannels(p2)).toEqual(['push', 'email']);
    expect(filterChannels(machineDown)).toEqual(['push', 'email']);
  });

  it('drops SMS when the organisation switched it off', () => {
    const rule = buildRule({
      organisationChannels: { push: true, email: true, sms: false },
    });
    expect(filterChannels(rule)).toEqual(['push', 'email']);
  });
});
