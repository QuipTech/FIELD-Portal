import {
  AlertAudience,
  AlertChannel,
  TriggerParams,
} from '../../organisationNotifications/alertTriggerCatalog';
import { DeliveryChannels } from '../../organisationNotifications/types/notificationResponse';

export interface AlertRuleToEvaluate {
  id: string;
  tenantId: string;
  name: string;
  triggerType: string;
  triggerParams: TriggerParams;
  audiences: AlertAudience[];
  channels: AlertChannel[];
  cooldownMinutes: number;
  // The organisation's Delivery channels switches.
  organisationChannels: DeliveryChannels;
}

// One thing a rule fired for, e.g. one machine that's been down too long.
export interface AlertMatch {
  // machine:<id>, case:<id>, site:<name>… The cooldown is per rule + user
  // + entityKey.
  entityKey: string;
  title: string;
  body: string;
  // Portal path, e.g. /cases/1042.
  link: string;
  machineId: string | null;
  caseId: string | null;
}

export interface RecipientCandidate {
  userId: string;
  tenantId: string;
  firstName: string;
  email: string | null;
  phoneNumber: string | null;
  roleNames: string[];
  isCaseAssignee: boolean;
  hasWorkedOnMachine: boolean;
  hasReviewedAnswers: boolean;
}

export type DeliveryChannelName = 'in_app' | AlertChannel;

export interface DeliveryResult {
  status: 'sent' | 'failed' | 'skipped';
  providerMessageId?: string | null;
  error?: string;
}

// What each recipient gets, whatever the channel.
export interface AlertMessage {
  title: string;
  body: string;
  // Full URL into the portal.
  url: string;
  ruleName: string;
  organisationName: string;
  accentColor: string | null;
}

export interface RecipientDelivery {
  userId: string;
  // False when the cooldown held this recipient back.
  isNotified: boolean;
  deliveries: { channel: DeliveryChannelName; result: DeliveryResult }[];
}
