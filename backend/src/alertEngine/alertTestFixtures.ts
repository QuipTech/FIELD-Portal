import { AlertRuleToEvaluate, RecipientCandidate } from './types/alertTypes';

// Shared fixtures for the alert engine specs.
export const ORG_A = 'org-a';
export const ORG_B = 'org-b';

export const buildRule = (
  overrides: Partial<AlertRuleToEvaluate> = {},
): AlertRuleToEvaluate => ({
  id: 'rule-1',
  tenantId: ORG_A,
  name: 'P1 case unactioned',
  triggerType: 'case_unactioned',
  triggerParams: { priority: 'P1', minutes: 30 },
  audiences: ['site_supervisors'],
  channels: ['push', 'email', 'sms'],
  cooldownMinutes: 240,
  organisationChannels: { push: true, email: true, sms: true },
  ...overrides,
});

export const buildCandidate = (
  overrides: Partial<RecipientCandidate> = {},
): RecipientCandidate => ({
  userId: 'user-1',
  tenantId: ORG_A,
  firstName: 'Ada',
  email: 'ada@example.com',
  phoneNumber: '+61412345678',
  roleNames: ['Technical Manager'],
  isCaseAssignee: false,
  hasWorkedOnMachine: false,
  hasReviewedAnswers: false,
  ...overrides,
});
