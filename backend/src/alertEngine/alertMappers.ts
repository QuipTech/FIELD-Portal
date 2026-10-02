import {
  AlertAudience,
  AlertChannel,
  TriggerParams,
} from '../organisationNotifications/alertTriggerCatalog';
import { AlertRuleRow, RecipientCandidateRow } from './types/alertRows';
import { AlertRuleToEvaluate, RecipientCandidate } from './types/alertTypes';

export const toRuleToEvaluate = (row: AlertRuleRow): AlertRuleToEvaluate => ({
  id: row.id,
  tenantId: row.tenant_id,
  name: row.name,
  triggerType: row.trigger_type,
  triggerParams: row.trigger_params as TriggerParams,
  audiences: row.audiences as AlertAudience[],
  channels: row.channels as AlertChannel[],
  cooldownMinutes: row.cooldown_minutes,
  organisationChannels: {
    push: row.push_enabled,
    email: row.email_enabled,
    sms: row.sms_enabled,
  },
});

export const toRecipientCandidate = (
  row: RecipientCandidateRow,
): RecipientCandidate => ({
  userId: row.user_id,
  tenantId: row.tenant_id,
  firstName: row.first_name,
  email: row.email,
  phoneNumber: row.phone_number,
  roleNames: row.role_names,
  isCaseAssignee: row.is_case_assignee,
  hasWorkedOnMachine: row.has_worked_on_machine,
  hasReviewedAnswers: row.has_reviewed_answers,
});
