import { AlertChannel } from '../organisationNotifications/alertTriggerCatalog';
import { AlertRuleToEvaluate } from './types/alertTypes';

// Only "P1 case unactioned" rules may text people.
export const isP1Rule = (rule: AlertRuleToEvaluate): boolean =>
  rule.triggerType === 'case_unactioned' &&
  rule.triggerParams.priority === 'P1';

// Channels the rule uses that are also switched on for the organisation;
// SMS only for P1 rules, even if a rule somehow has it.
export const filterChannels = (rule: AlertRuleToEvaluate): AlertChannel[] =>
  rule.channels.filter(
    (channel) =>
      rule.organisationChannels[channel] &&
      (channel !== 'sms' || isP1Rule(rule)),
  );
