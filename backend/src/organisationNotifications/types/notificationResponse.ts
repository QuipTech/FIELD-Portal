import {
  AlertAudience,
  AlertChannel,
  TriggerParams,
} from '../alertTriggerCatalog';

export interface AlertRule {
  id: string;
  name: string;
  triggerType: string;
  triggerParams: TriggerParams;
  audiences: AlertAudience[];
  channels: AlertChannel[];
  isEnabled: boolean;
  cooldownMinutes: number;
  // Ready-to-show text for the table.
  triggerLabel: string;
  notifyLabel: string;
  channelLabel: string;
  // Channels this rule uses that are switched off organisation-wide.
  disabledChannels: AlertChannel[];
  createdAt: string;
  updatedAt: string;
}

export type DeliveryChannels = Record<AlertChannel, boolean>;

export interface NotificationSettings {
  rules: AlertRule[];
  channels: DeliveryChannels;
}
