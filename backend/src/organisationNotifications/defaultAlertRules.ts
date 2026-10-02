import {
  AlertAudience,
  AlertChannel,
  TriggerParams,
} from './alertTriggerCatalog';

export interface NewAlertRule {
  name: string;
  triggerType: string;
  triggerParams: TriggerParams;
  audiences: AlertAudience[];
  channels: AlertChannel[];
  isEnabled: boolean;
  // How long before the rule may alert the same person about the same
  // machine or case again. DEFAULT_COOLDOWN_MINUTES when left out.
  cooldownMinutes?: number;
}

export const DEFAULT_COOLDOWN_MINUTES = 240;

// What every organisation starts with, the first time its notification
// settings are opened. Deleting them later doesn't bring them back.
export const DEFAULT_ALERT_RULES: NewAlertRule[] = [
  {
    name: 'Machine down too long',
    triggerType: 'machine_down',
    triggerParams: { hours: 4 },
    audiences: ['site_supervisors', 'admins'],
    channels: ['push', 'email'],
    isEnabled: true,
  },
  {
    name: 'Service overdue',
    triggerType: 'service_overdue',
    triggerParams: { hours: 100 },
    audiences: ['assigned_technician'],
    channels: ['push'],
    isEnabled: true,
  },
  {
    name: 'P1 case unactioned',
    triggerType: 'case_unactioned',
    triggerParams: { priority: 'P1', minutes: 30 },
    audiences: ['site_supervisors'],
    channels: ['push', 'sms'],
    isEnabled: true,
  },
  {
    name: 'AI answer flagged',
    triggerType: 'ai_answer_flagged',
    triggerParams: { reasons: ['low_confidence', 'safety_refusal'] },
    audiences: ['ai_reviewers'],
    channels: ['email'],
    isEnabled: true,
  },
  {
    name: 'Fleet uptime drop',
    triggerType: 'uptime_drop',
    triggerParams: { percent: 85, period: 'weekly' },
    audiences: ['admins'],
    channels: ['email'],
    isEnabled: true,
  },
];
